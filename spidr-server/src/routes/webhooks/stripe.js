/**
 * Stripe Webhook — the ONLY writer of apex_tier + stripe_subscription_* fields.
 *
 * Mounted at /webhooks/stripe in src/index.js BEFORE express.json() with
 * express.raw({ type: 'application/json' }) — Stripe's signature verification
 * requires the raw bytes exactly as sent, not a JSON.parse round-trip.
 *
 * Events handled:
 *   - checkout.session.completed        — activate Apex + set stripe_* fields
 *   - customer.subscription.updated     — sync status/period_end/cancel_at_period_end
 *   - customer.subscription.deleted     — flip apex_tier back to 'free'
 *
 * Idempotency: StripeWebhookEvent.eventId is a unique index; we insert BEFORE
 * processing so at-least-once redelivery no-ops instead of double-applying.
 */

const express            = require('express');
const Stripe             = require('stripe');
const UserProfile        = require('../../models/UserProfile');
const StripeWebhookEvent = require('../../models/StripeWebhookEvent');

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

router.post('/', async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('[stripe-webhook] Stripe not configured — rejecting');
    return res.status(503).json({ error: 'stripe_not_configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.body is a Buffer here because index.js mounts express.raw() upstream.
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Idempotency: insert-and-check. Duplicate hits E11000 → we already processed
  // this event.id, respond 200 without reprocessing so Stripe stops retrying.
  try {
    await StripeWebhookEvent.create({ eventId: event.id, type: event.type });
  } catch (err) {
    if (err.code === 11000) {
      console.log(`[stripe-webhook] Duplicate event ${event.id} (${event.type}) — skipping`);
      return res.json({ received: true, duplicate: true });
    }
    console.error('[stripe-webhook] Idempotency insert failed:', err.message);
    // Fall through — better to process than to lose the event.
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`[stripe-webhook] Ignoring event type: ${event.type}`);
    }
  } catch (err) {
    // Log but respond 200 anyway — Stripe retries on non-2xx, and if the failure
    // is deterministic (bad user id, DB down for the record) we'd just spin. The
    // idempotency table already blocks true replays, so responding 200 here loses
    // at most this specific event and we surface it via server logs.
    console.error(`[stripe-webhook] Handler failed for ${event.type} (${event.id}):`, err.message);
  }

  res.json({ received: true });
});

// ── checkout.session.completed ───────────────────────────────────────────────
// Fires when the user finishes Stripe Checkout (whether trial or paid).
// This is the moment we activate Apex.
async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId) {
    console.error('[stripe-webhook] checkout.session.completed missing userId', session.id);
    return;
  }

  const planType = session.metadata?.planType || 'monthly';

  // Retrieve the subscription so we get status + current_period_end. session.subscription
  // is just the id at this point.
  let sub = null;
  if (session.subscription) {
    sub = await stripe.subscriptions.retrieve(session.subscription);
  }

  const profile = await UserProfile.findOne({ user_id: userId });
  if (!profile) {
    console.error('[stripe-webhook] No profile for userId', userId);
    return;
  }

  profile.apex_tier                   = 'apex';
  profile.stripe_subscription_id      = sub?.id || session.subscription || profile.stripe_subscription_id;
  profile.stripe_subscription_status  = sub?.status || 'active';
  profile.stripe_current_period_end   = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  profile.stripe_cancel_at_period_end = !!sub?.cancel_at_period_end;

  // Set apex_first_activated_at ONCE. If it's already set (customer cancelled
  // and re-subscribed), leave the original date so trial-eligibility stays
  // burned. This is the belt on top of Stripe's own suspenders.
  if (!profile.apex_first_activated_at) {
    profile.apex_first_activated_at = new Date();
  }

  profile.apex_features = {
    ...(profile.apex_features || {}),
    thread_skin:     profile.apex_features?.thread_skin || 'default',
    squad_overclock: true,
    deep_storage:    true,
    entry_protocol:  profile.apex_features?.entry_protocol || 'default',
    activated_at:    new Date().toISOString(),
    plan_type:       planType,
  };

  await profile.save();
  console.log(`[stripe-webhook] Apex activated for user=${userId} plan=${planType} status=${sub?.status}`);
}

// ── customer.subscription.updated ────────────────────────────────────────────
// Fires on renewals, cancellations, payment failures, trial→active transitions.
// Look up by stripe_customer_id since we can't rely on metadata being carried
// through every event type.
async function handleSubscriptionUpdated(sub) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const profile = await UserProfile.findOne({ stripe_customer_id: customerId });
  if (!profile) {
    console.warn('[stripe-webhook] subscription.updated for unknown customer', customerId);
    return;
  }

  profile.stripe_subscription_id      = sub.id;
  profile.stripe_subscription_status  = sub.status;
  profile.stripe_current_period_end   = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  profile.stripe_cancel_at_period_end = !!sub.cancel_at_period_end;

  // Only 'active' and 'trialing' mean the user should have Apex. Anything else
  // (past_due, unpaid, canceled, incomplete_expired) → downgrade to free.
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    profile.apex_tier = 'free';
  }

  await profile.save();
  console.log(`[stripe-webhook] subscription.updated user=${profile.user_id} status=${sub.status} tier=${profile.apex_tier}`);
}

// ── customer.subscription.deleted ────────────────────────────────────────────
// Fires when a subscription is fully removed (cancel_at_period_end has come due,
// or an immediate cancel). Downgrade to free but KEEP apex_first_activated_at.
async function handleSubscriptionDeleted(sub) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const profile = await UserProfile.findOne({ stripe_customer_id: customerId });
  if (!profile) return;

  profile.apex_tier                   = 'free';
  profile.stripe_subscription_status  = 'canceled';
  profile.stripe_cancel_at_period_end = false;
  // Deliberately DO NOT clear apex_first_activated_at — it's the permanent
  // trial-consumed flag.

  await profile.save();
  console.log(`[stripe-webhook] subscription.deleted user=${profile.user_id} — downgraded to free`);
}

module.exports = router;
