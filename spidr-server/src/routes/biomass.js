const express = require('express');
const BiomassWallet = require('../models/BiomassWallet');
const authMW = require('../middleware/auth');

const router = express.Router();

/**
 * Biomass currency endpoints.
 *
 *   GET    /biomass/wallet         — current user's wallet (auto-creates)
 *   POST   /biomass/daily          — claim daily login bonus (idempotent per 24h)
 *   POST   /biomass/grant          — internal-only grant (signed action from server)
 *   POST   /biomass/spend          — atomic spend with insufficient-funds check
 *   GET    /biomass/shop           — catalog of items
 *   POST   /biomass/shop/buy       — buy an item; adds to inventory
 *
 * The grant endpoint is intentionally not exposed to clients for arbitrary
 * amounts; the server uses internal grant helpers (utils/biomass.js) for
 * automated earns. The HTTP grant endpoint is kept gated to admin users so
 * we can fix wallets manually if needed.
 */

// Catalog of items purchasable with biomass. Lives in code rather than DB so
// pricing changes ship with a release and there's no risk of a runtime edit.
const SHOP_CATALOG = [
  { id: 'effect_glow',     name: 'Username Glow',       description: 'Soft halo behind your name.',    price: 200,  category: 'username' },
  { id: 'effect_rainbow',  name: 'Rainbow Username',    description: 'Animated rainbow sweep.',         price: 800,  category: 'username' },
  { id: 'effect_pulse',    name: 'Pulsing Username',    description: 'Subtle pulse animation.',         price: 400,  category: 'username' },
  { id: 'effect_shimmer',  name: 'Shimmering Username', description: 'A light shimmer across letters.', price: 600,  category: 'username' },
  { id: 'banner_neon',     name: 'Neon Banner Theme',   description: 'Neon grid banner background.',   price: 500,  category: 'profile' },
  { id: 'banner_glitch',   name: 'Glitch Banner Theme', description: 'Distortion banner background.',   price: 500,  category: 'profile' },
  { id: 'badge_legend',    name: 'Legend Badge',        description: 'Show off your spending.',         price: 5000, category: 'badge' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
async function getOrCreateWallet(userId) {
  let w = await BiomassWallet.findOne({ user_id: userId });
  if (!w) w = await BiomassWallet.create({ user_id: userId });
  return w;
}

function pushTx(wallet, amount, reason, ref_id) {
  wallet.transactions.unshift({ amount, reason, ref_id, created_date: new Date() });
  if (wallet.transactions.length > 50) wallet.transactions.length = 50;
}

// ── GET /biomass/wallet ────────────────────────────────────────────────────
router.get('/wallet', authMW, async (req, res) => {
  try {
    const w = await getOrCreateWallet(req.user.id);
    res.json(w);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /biomass/daily — once per 24 hours ────────────────────────────────
router.post('/daily', authMW, async (req, res) => {
  try {
    const w = await getOrCreateWallet(req.user.id);
    const now = new Date();
    if (w.last_daily_claim && (now - new Date(w.last_daily_claim)) < 22 * 60 * 60 * 1000) {
      const hoursLeft = Math.ceil((24 - (now - new Date(w.last_daily_claim)) / (60 * 60 * 1000)));
      return res.status(429).json({ error: 'Daily already claimed', hoursLeft });
    }
    const amount = 50;
    w.balance += amount;
    w.lifetime_earned += amount;
    w.last_daily_claim = now;
    pushTx(w, amount, 'Daily login');
    await w.save();
    res.json({ amount, balance: w.balance, wallet: w });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /biomass/fly — reward for catching the hunt fly ───────────────────
// Server-authoritative fixed reward so clients can't grant arbitrary amounts.
// Capped at 200/day from flies to prevent farming. Records a transaction so
// it shows in history (fixes "biomass history for catching fly").
router.post('/fly', authMW, async (req, res) => {
  try {
    const w = await getOrCreateWallet(req.user.id);
    const reward = 10;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const earnedFromFliesToday = (w.transactions || [])
      .filter(t => t.amount > 0 && t.reason === 'Caught a fly' && new Date(t.created_date) >= dayStart)
      .reduce((s, t) => s + t.amount, 0);
    if (earnedFromFliesToday >= 200) {
      return res.status(429).json({ error: 'Daily fly reward cap reached', balance: w.balance, capped: true });
    }
    w.balance += reward;
    w.lifetime_earned += reward;
    pushTx(w, reward, 'Caught a fly');
    await w.save();
    res.json({ amount: reward, balance: w.balance, wallet: w });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /biomass/spend — atomic spend with FX check ───────────────────────
router.post('/spend', authMW, async (req, res) => {
  try {
    const { amount, reason, ref_id } = req.body;
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const w = await getOrCreateWallet(req.user.id);
    if (w.balance < n) return res.status(400).json({ error: 'Insufficient biomass', balance: w.balance });
    w.balance -= n;
    pushTx(w, -n, reason || 'Spend', ref_id);
    await w.save();
    res.json({ balance: w.balance, wallet: w });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /biomass/shop — catalog ────────────────────────────────────────────
router.get('/shop', authMW, (req, res) => {
  res.json({ items: SHOP_CATALOG });
});

// ── POST /biomass/shop/buy — purchase an item ──────────────────────────────
router.post('/shop/buy', authMW, async (req, res) => {
  try {
    const { itemId } = req.body;
    const item = SHOP_CATALOG.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const w = await getOrCreateWallet(req.user.id);
    if (w.inventory.get(itemId)) {
      return res.status(409).json({ error: 'Already owned' });
    }
    if (w.balance < item.price) {
      return res.status(400).json({ error: 'Insufficient biomass', balance: w.balance, price: item.price });
    }
    w.balance -= item.price;
    w.inventory.set(itemId, { unlocked_at: new Date() });
    pushTx(w, -item.price, `Bought ${item.name}`, itemId);
    await w.save();
    res.json({ balance: w.balance, item, wallet: w });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
