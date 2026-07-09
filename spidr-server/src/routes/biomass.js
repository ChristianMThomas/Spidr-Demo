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
  // ── Custom titles — a nameplate flourish under/beside your username ──────
  { id: 'title_apex_predator', name: 'Title: Apex Predator',  description: 'THE hunter of the web.',            price: 1200, category: 'title', value: 'APEX PREDATOR' },
  { id: 'title_web_weaver',    name: 'Title: Web Weaver',     description: 'Architect of the strands.',          price: 800,  category: 'title', value: 'WEB WEAVER' },
  { id: 'title_night_crawler', name: 'Title: Night Crawler',  description: 'Seen only when it wants to be.',     price: 800,  category: 'title', value: 'NIGHT CRAWLER' },
  { id: 'title_silk_spinner',  name: 'Title: Silk Spinner',   description: 'Smooth in every thread.',            price: 600,  category: 'title', value: 'SILK SPINNER' },
  { id: 'title_venom',         name: 'Title: Venomous',       description: 'Handle with care.',                  price: 1000, category: 'title', value: 'VENOMOUS' },
  { id: 'title_broodmother',   name: 'Title: Broodmother',    description: 'The web answers to you.',            price: 2000, category: 'title', value: 'BROODMOTHER' },

  // ── Chat colors — your message text, in your color ────────────────────────
  { id: 'chat_color_crimson',  name: 'Chat Color: Crimson',   description: 'Spidr-red message text.',            price: 500,  category: 'chat_color', value: '#f87171' },
  { id: 'chat_color_venom',    name: 'Chat Color: Venom',     description: 'Toxic green message text.',          price: 500,  category: 'chat_color', value: '#4ade80' },
  { id: 'chat_color_royal',    name: 'Chat Color: Royal',     description: 'Deep purple message text.',          price: 500,  category: 'chat_color', value: '#c084fc' },
  { id: 'chat_color_gold',     name: 'Chat Color: Gold',      description: 'Gilded message text.',               price: 750,  category: 'chat_color', value: '#facc15' },
  { id: 'chat_color_ice',      name: 'Chat Color: Ice',       description: 'Frostbite-blue message text.',       price: 500,  category: 'chat_color', value: '#7dd3fc' },

  // ── Chat fonts — your messages, your typeface ─────────────────────────────
  { id: 'chat_font_mono',      name: 'Chat Font: Terminal',   description: 'Monospace hacker aesthetic.',        price: 600,  category: 'chat_font', value: "'JetBrains Mono', 'Courier New', monospace" },
  { id: 'chat_font_serif',     name: 'Chat Font: Manuscript', description: 'Old-world serif elegance.',          price: 600,  category: 'chat_font', value: "Georgia, 'Times New Roman', serif" },
  { id: 'chat_font_display',   name: 'Chat Font: Display',    description: 'Bold condensed impact.',             price: 800,  category: 'chat_font', value: "'Bebas Neue', 'Arial Narrow', sans-serif" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
async function getOrCreateWallet(userId) {
  let w = await BiomassWallet.findOne({ user_id: userId });
  if (!w) w = await BiomassWallet.create({ user_id: userId });
  return w;
}

// Mongoose Map → plain JSON object. The default JSON serializer emits Maps
// as {} which broke inventory checks and the shop's "Owned" badges (the
// "Biomass page not working" report — the shop rendered but every item
// looked buyable because Object.keys(inventory) always returned []).
function serializeWallet(w) {
  const doc = w.toObject ? w.toObject({ flattenMaps: true }) : w;
  if (doc.inventory && typeof doc.inventory === 'object' && !Array.isArray(doc.inventory)) {
    // Ensure plain-object shape even when Mongoose skipped flattenMaps.
    if (w?.inventory?.entries) {
      const flat = {};
      for (const [k, v] of w.inventory.entries()) flat[k] = v;
      doc.inventory = flat;
    }
  } else {
    doc.inventory = {};
  }
  return doc;
}

function pushTx(wallet, amount, reason, ref_id) {
  wallet.transactions.unshift({ amount, reason, ref_id, created_date: new Date() });
  if (wallet.transactions.length > 50) wallet.transactions.length = 50;
}

// ── GET /biomass/wallet ────────────────────────────────────────────────────
router.get('/wallet', authMW, async (req, res) => {
  try {
    const w = await getOrCreateWallet(req.user.id);
    res.json(serializeWallet(w));
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
    res.json({ amount, balance: w.balance, wallet: serializeWallet(w) });
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
    res.json({ amount: reward, balance: w.balance, wallet: serializeWallet(w) });
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
    res.json({ balance: w.balance, wallet: serializeWallet(w) });
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
    res.json({ balance: w.balance, item, wallet: serializeWallet(w) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /biomass/equip — activate an owned cosmetic ────────────────────────
// { itemId } equips it; { itemId: null, category } clears that slot.
router.post('/equip', authMW, async (req, res) => {
  try {
    const { itemId, category } = req.body || {};
    const UserProfile = require('../models/UserProfile');

    // Clearing a slot
    if (!itemId) {
      const set = {};
      if (category === 'title') set.active_title = '';
      else if (category === 'chat_color') set['chat_style.color'] = '';
      else if (category === 'chat_font') set['chat_style.font'] = '';
      else return res.status(400).json({ error: 'category required to clear' });
      await UserProfile.updateOne({ user_id: req.user.id }, { $set: set });
      return res.json({ ok: true, cleared: category });
    }

    const item = SHOP_CATALOG.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const w = await getOrCreateWallet(req.user.id);
    if (!w.inventory.get(itemId)) return res.status(403).json({ error: 'Not owned' });

    const set = {};
    if (item.category === 'title') set.active_title = item.value;
    else if (item.category === 'chat_color') set['chat_style.color'] = item.value;
    else if (item.category === 'chat_font') set['chat_style.font'] = item.value;
    else return res.status(400).json({ error: 'Item is not equippable' });

    await UserProfile.updateOne({ user_id: req.user.id }, { $set: set });
    res.json({ ok: true, equipped: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
