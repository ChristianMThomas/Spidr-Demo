/**
 * Stripe Payments — Spidr Apex ($7.99/mo, $69.99/yr)
 *
 * POST /payments/create-checkout-session  — start a subscription (JWT required)
 * POST /payments/create-portal-session    — open Billing Portal (JWT required)
 *
 * All tier flips (apex_tier ← 'apex' | 'free') happen in routes/webhooks/stripe.js
 * against a signature-verified webhook — this route never writes apex_tier
 * or stripe_subscription_* fields directly. It only creates Stripe-side
 * sessions and returns the redirect URL to the client.
 */

const express     = require('express');
const Stripe      = require('stripe');
const authMW      = require('../middleware/auth');
const UserProfile = require('../models/UserProfile');

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

function ensureConfigured(res) {
  if (!stripe) {
    res.status(503).json({ error: 'Stripe not configured on this server' });
    return false;
  }
  return true;
}

function priceIdFor(planType) {
  if (planType === 'yearly')  return process.env.STRIPE_PRICE_YEARLY;
  if (planType === 'monthly') return process.env.STRIPE_PRICE_MONTHLY;
  return null;
}

// ── POST /payments/create-checkout-session ───────────────────────────────────
// Body: { planType: 'monthly' | 'yearly' }
// Returns: { url } → client redirects to Stripe-hosted checkout page.
router.post('/create-checkout-session', authMW, async (req, res) => {
  if (!ensureConfigured(res)) return;

  try {
    const { planType } = req.body || {};
    const price = priceIdFor(planType);
    if (!price) {
      return res.status(400).json({ error: 'Invalid planType — expected "monthly" or "yearly"' });
    }

    const userId = req.user.id;
    const email  = req.user.email;

    // Load the profile — we need stripe_customer_id + apex_first_activated_at
    // (the trial gate). Profile might not exist yet for brand-new users;
    // create a stub with just user_id so the customer id write below has
    // somewhere to land.
    let profile = await UserProfile.findOne({ user_id: userId });
    if (!profile) {
      profile = await UserProfile.create({ user_id: userId });
    }

    // Get or create a Stripe Customer for this user. Persisting customer_id
    // means re-subscribes (after cancel) reuse the same billing history,
    // saved payment methods, and — critically — Stripe's own trial-eligibility
    // check (Stripe blocks a second trial on the same customer for the same
    // price, so this + apex_first_activated_at is belt-and-suspenders).
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;
      profile.stripe_customer_id = customerId;
      await profile.save();
    }

    // Trial: 30 days ONLY if user has never held Apex.
    // apex_first_activated_at is set once in the webhook on first checkout.session.completed
    // and never cleared, so cancel-and-resubscribe pays from day one.
    const isFirstTime = !profile.apex_first_activated_at;
    const subscriptionData = isFirstTime
      ? { trial_period_days: 30, metadata: { userId, planType } }
      : { metadata: { userId, planType } };

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode:                'subscription',
      customer:            customerId,
      line_items:          [{ price, quantity: 1 }],
      client_reference_id: userId,
      metadata:            { userId, planType },
      subscription_data:   subscriptionData,
      allow_promotion_codes: true,
      success_url:         `${clientOrigin}/settings?apex=success`,
      cancel_url:          `${clientOrigin}/settings?apex=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[payments] create-checkout-session failed:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── POST /payments/create-portal-session ─────────────────────────────────────
// No body. User must already have a stripe_customer_id (set on first checkout).
// Returns: { url } → client redirects to Stripe Billing Portal.
router.post('/create-portal-session', authMW, async (req, res) => {
  if (!ensureConfigured(res)) return;

  try {
    const profile = await UserProfile.findOne({ user_id: req.user.id }).lean();
    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer on record — subscribe first' });
    }

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: `${clientOrigin}/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[payments] create-portal-session failed:', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

module.exports = router;
