/* save.js — persistent player profile in localStorage.
   All "currency" here is purely simulated/local. No real money, no network. */
(function () {
  const M = (window.M = window.M || {});
  const KEY = "residual.save.v1";

  const DEFAULT = () => ({
    created: Date.now(),
    lastSeen: 0,
    loginDay: 0, // how many daily rewards claimed (streak index)
    loginClaimedToday: false,
    // currencies (all fake)
    bytes: 500, // soft currency (gold-equivalent)
    redpills: 80, // premium currency (diamond-equivalent)
    keys: 0, // gacha tokens
    // gacha
    pity: 0, // pulls since last SSR
    rosterOwned: { neo_echo: true }, // starter
    selected: "neo_echo",
    dupes: {}, // id -> shards
    // meta upgrades: id -> level
    meta: {},
    // battle pass
    bpXp: 0,
    bpPremium: false,
    bpClaimed: {}, // "tier:track" -> true
    // offers
    offerExpires: {}, // id -> timestamp
    boughtOffers: {}, // id -> count
    beginnerBought: false,
    // stats
    bestTime: 0,
    totalKills: 0,
    runs: 0,
    stage: 1,
    firstTopup: {}, // pack id -> done (2x bonus shown once)
  });

  let data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? Object.assign(DEFAULT(), JSON.parse(raw)) : DEFAULT();
    } catch (e) {
      data = DEFAULT();
    }
    return data;
  }
  function save() {
    try {
      data.lastSeen = Date.now();
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function reset() {
    data = DEFAULT();
    save();
  }

  M.save = {
    get data() {
      return data || load();
    },
    load,
    save,
    reset,
    // helpers
    add(cur, n) {
      data[cur] = (data[cur] || 0) + n;
      save();
    },
    spend(cur, n) {
      if ((data[cur] || 0) < n) return false;
      data[cur] -= n;
      save();
      return true;
    },
  };
})();
