/* data.js — all game + economy content tables.
 * Characters use ORIGINAL names/designs evoking the Matrix aesthetic
 * (operators, agents, code) rather than reproducing any specific film IP. */
(function () {
  const M = (window.M = window.M || {});

  /* =================== CHARACTERS (gacha roster) ===================
   * Each defines visual palette (for procedural portrait/sprite) + a
   * starting weapon + passive stat profile + an ultimate. */
  const CHARS = {
    neo_echo: {
      id: "neo_echo", name: "ECHO", title: "the awakened",
      rarity: "R", accent: "#00ff66", coat: "#0c1a12", shirt: "#0a1f12",
      skin: "#d8b48c", hair: "#1c1410", hairStyle: "slick", bg0: "#04130a",
      start: "sidearm", desc: "Reads the code. Bullets curve toward truth.",
      stats: { hp: 1.0, dmg: 1.0, spd: 1.0 }, ult: "Bullet-time burst — freeze & nuke.",
    },
    trace_ivory: {
      id: "trace_ivory", name: "IVORY", title: "the operator",
      rarity: "SR", accent: "#39e7ff", coat: "#0a1622", shirt: "#06121c",
      skin: "#e7c7a8", hair: "#0b0b0d", hairStyle: "long", hairHi: "#39e7ff", bg0: "#041018",
      start: "katana", desc: "Twin discs of light. Nothing crosses her radius.",
      stats: { hp: 0.9, dmg: 1.15, spd: 1.1 }, ult: "Orbital lattice — blades multiply.",
    },
    cipher_vex: {
      id: "cipher_vex", name: "VEX", title: "the ghost",
      rarity: "SR", accent: "#b14cff", coat: "#160a22", shirt: "#0e0616",
      skin: "#cdb0d0", hair: "#2a103a", hairStyle: "bob", hairHi: "#d090ff", bg0: "#0c0418",
      start: "spread", desc: "Sprays corrupted glyphs that rewrite flesh.",
      stats: { hp: 0.85, dmg: 1.2, spd: 1.05 }, ult: "Logic bomb — viral spread chain.",
    },
    morph_ada: {
      id: "morph_ada", name: "ADA", title: "the cipher-witch",
      rarity: "SSR", accent: "#ffd24a", coat: "#1c1406", shirt: "#241a06",
      skin: "#ecd0b4", hair: "#caa23a", hairStyle: "long", hairHi: "#fff0b0", bg0: "#16100a",
      start: "lightning", desc: "Bends the rendered world. Chains of golden code.",
      stats: { hp: 1.1, dmg: 1.3, spd: 1.0 }, ult: "Overload — fork lightning storms.",
    },
    sable_zero: {
      id: "sable_zero", name: "ZERO", title: "the redpill",
      rarity: "R", accent: "#ff2b4d", coat: "#1a0a0e", shirt: "#220a10",
      skin: "#c79a78", hair: "#0a0a0a", hairStyle: "buzz", bg0: "#160409",
      start: "pulse", desc: "Anger made kinetic. EMP shockwaves on the beat.",
      stats: { hp: 1.2, dmg: 0.95, spd: 0.95 }, ult: "Detonate — supernova EMP.",
    },
    glyph_naia: {
      id: "glyph_naia", name: "NAIA", title: "the oracle's hand",
      rarity: "SSR", accent: "#ff4ecb", coat: "#220a1a", shirt: "#2a0a20",
      skin: "#e8c0c8", hair: "#1a0a16", hairStyle: "long", hairHi: "#ff8fe0", bg0: "#16061a",
      start: "drone", desc: "Summons sentinel husks turned loyal. Swarm the swarm.",
      stats: { hp: 1.0, dmg: 1.1, spd: 1.15 }, ult: "Hive fork — drone overflow.",
    },
    kade_onyx: {
      id: "kade_onyx", name: "ONYX", title: "the runner",
      rarity: "R", accent: "#7CFF4E", coat: "#0a160a", shirt: "#0c1f0c",
      skin: "#b98a64", hair: "#0a0a0a", hairStyle: "buzz", bg0: "#06140a",
      start: "sidearm", desc: "Fastest jack in the city. Outruns the trace.",
      stats: { hp: 0.85, dmg: 1.0, spd: 1.3 }, ult: "Afterimage dash — leave a kill-trail.",
    },
    sora_lumen: {
      id: "sora_lumen", name: "LUMEN", title: "the signalman",
      rarity: "SR", accent: "#00e5ff", coat: "#06141c", shirt: "#04101a",
      skin: "#dfc3a6", hair: "#9fe8ff", hairStyle: "long", hairHi: "#ffffff", bg0: "#02121a",
      start: "drone", desc: "Broadcasts on every frequency. Husks answer the call.",
      stats: { hp: 1.0, dmg: 1.05, spd: 1.1 }, ult: "Uplink storm — the whole hive fires.",
    },
    vesper_nox: {
      id: "vesper_nox", name: "VESPER", title: "the exile",
      rarity: "SSR", accent: "#c9b8ff", coat: "#120a24", shirt: "#0a0618",
      skin: "#e6d2e0", hair: "#d8d0ff", hairStyle: "bob", hairHi: "#ffffff", bg0: "#0a0620",
      start: "trace", desc: "A program that refused deletion. Bends probability itself.",
      stats: { hp: 1.05, dmg: 1.35, spd: 1.05 }, ult: "Null pointer — erase a screen of foes.",
    },
    dax_ronin: {
      id: "dax_ronin", name: "RONIN", title: "the swordsman",
      rarity: "R", accent: "#ff7a2b", coat: "#1a0e06", shirt: "#22120a",
      skin: "#c99a72", hair: "#120c08", hairStyle: "slick", bg0: "#160c06",
      start: "katana", desc: "One blade, no code. Cuts the render where it stands.",
      stats: { hp: 1.1, dmg: 1.1, spd: 1.0 }, ult: "Iaido — a ring of severing light.",
    },
  };
  const ROSTER = Object.keys(CHARS);

  /* =================== WEAPONS ===================
   * lvl scaling arrays index by level-1 (max 8). */
  const WEAPONS = {
    sidearm: {
      id: "sidearm", name: "Desert Sidearm", icon: "▤", color: "#00ff66",
      desc: "Fires homing rounds at the nearest threat.",
      kind: "shoot",
      max: 8,
      cd: [0.62, 0.55, 0.48, 0.42, 0.36, 0.30, 0.26, 0.22],
      dmg: [12, 16, 20, 26, 33, 41, 52, 66],
      count: [1, 1, 2, 2, 3, 3, 4, 5],
      speed: 420, pierce: 1, homing: 0.06,
    },
    katana: {
      id: "katana", name: "Light Discs", icon: "◎", color: "#39e7ff",
      desc: "Discs orbit you, shredding anything close.",
      kind: "orbit",
      max: 8,
      cd: [0, 0, 0, 0, 0, 0, 0, 0],
      dmg: [9, 12, 15, 19, 24, 30, 38, 48],
      count: [2, 2, 3, 3, 4, 4, 5, 6],
      radius: 58, rot: 2.6,
    },
    spread: {
      id: "spread", name: "Glyph Spread", icon: "≋", color: "#b14cff",
      desc: "A cone of corrupted glyphs in your facing.",
      kind: "shoot",
      max: 8,
      cd: [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.44, 0.38],
      dmg: [8, 10, 13, 16, 20, 25, 31, 39],
      count: [3, 4, 5, 6, 7, 8, 9, 11],
      speed: 360, pierce: 1, spreadArc: 0.7, aimMove: true,
    },
    pulse: {
      id: "pulse", name: "EMP Pulse", icon: "◌", color: "#ff2b4d",
      desc: "Periodic shockwave damages all around you.",
      kind: "nova",
      max: 8,
      cd: [2.4, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0],
      dmg: [16, 22, 28, 36, 46, 58, 73, 92],
      radius: [70, 84, 98, 112, 126, 140, 158, 180],
      knockback: 90,
    },
    lightning: {
      id: "lightning", name: "Fork Code", icon: "⚡", color: "#ffd24a",
      desc: "Lightning leaps between enemies.",
      kind: "chain",
      max: 8,
      cd: [1.3, 1.18, 1.06, 0.94, 0.82, 0.7, 0.6, 0.5],
      dmg: [14, 18, 23, 29, 37, 47, 59, 74],
      jumps: [2, 3, 3, 4, 5, 6, 7, 9], rangeJump: 140,
    },
    drone: {
      id: "drone", name: "Sentinel Husk", icon: "✦", color: "#ff4ecb",
      desc: "Loyal husks orbit and fire on enemies.",
      kind: "drone",
      max: 8,
      cd: [1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.52, 0.44],
      dmg: [10, 13, 17, 22, 28, 35, 44, 55],
      count: [1, 1, 2, 2, 3, 3, 4, 5], speed: 360, pierce: 1,
    },
    trace: {
      id: "trace", name: "Trace Program", icon: "➹", color: "#7CFF4E",
      desc: "Slow homing trackers that detonate.",
      kind: "shoot",
      max: 8,
      cd: [1.4, 1.28, 1.16, 1.04, 0.92, 0.8, 0.7, 0.6],
      dmg: [22, 28, 36, 46, 58, 72, 90, 112],
      count: [1, 1, 1, 2, 2, 2, 3, 3],
      speed: 220, pierce: 1, homing: 0.16, explode: 46,
    },

    /* ---- EVOLVED weapons (unlocked at level-up when base + passive are maxed) ---- */
    e_vacuum: {
      id: "e_vacuum", name: "Vacuum Rounds", icon: "✸", color: "#d7ffe6", evolved: true,
      desc: "EVOLVED — a storm of piercing homing rounds.",
      kind: "shoot", max: 1, cd: [0.18], dmg: [70], count: [6],
      speed: 520, pierce: 6, homing: 0.14, explode: 40,
    },
    e_halo: {
      id: "e_halo", name: "Photon Halo", icon: "◉", color: "#7df7ff", evolved: true,
      desc: "EVOLVED — a wide ring of discs nothing survives.",
      kind: "orbit", max: 1, cd: [0], dmg: [60], count: [8], radius: 96, rot: 3.4,
    },
    e_singularity: {
      id: "e_singularity", name: "Singularity", icon: "⊛", color: "#ff6b8a", evolved: true,
      desc: "EVOLVED — collapsing EMP that clears the screen.",
      kind: "nova", max: 1, cd: [0.9], dmg: [120], radius: [230], knockback: 200,
    },
    e_tesla: {
      id: "e_tesla", name: "Tesla Cascade", icon: "⚡", color: "#fff36b", evolved: true,
      desc: "EVOLVED — lightning that forks through everything.",
      kind: "chain", max: 1, cd: [0.4], dmg: [95], jumps: [14], rangeJump: 200,
    },
    e_swarm: {
      id: "e_swarm", name: "Hive Overflow", icon: "✦", color: "#ff8fe0", evolved: true,
      desc: "EVOLVED — six loyal husks lay down constant fire.",
      kind: "drone", max: 1, cd: [0.3], dmg: [55], count: [6], speed: 460, pierce: 2,
    },
  };

  /* base weapon + maxed passive  ->  evolved weapon */
  const EVO = {
    sidearm:   { passive: "amplifier", into: "e_vacuum" },
    katana:    { passive: "area",      into: "e_halo" },
    pulse:     { passive: "kevlar",    into: "e_singularity" },
    lightning: { passive: "overclock", into: "e_tesla" },
    drone:     { passive: "magnet",    into: "e_swarm" },
  };

  /* =================== PASSIVES =================== */
  const PASSIVES = {
    overclock: { id: "overclock", name: "Overclock", icon: "⏱", color:"#39e7ff", desc:"+8% fire rate / lvl", max: 5, stat: "haste", per: 0.08 },
    amplifier: { id: "amplifier", name: "Amplifier", icon: "✕", color:"#ff2b4d", desc:"+12% damage / lvl", max: 5, stat: "power", per: 0.12 },
    kevlar:    { id: "kevlar", name: "Kevlar Weave", icon:"❤", color:"#ff6b8a", desc:"+22 max HP / lvl", max: 5, stat: "maxhp", per: 22 },
    boots:     { id: "boots", name: "Light Boots", icon:"➤", color:"#7CFF4E", desc:"+9% move speed / lvl", max: 5, stat: "speed", per: 0.09 },
    magnet:    { id: "magnet", name: "Code Magnet", icon:"◈", color:"#ffd24a", desc:"+28% pickup range / lvl", max: 5, stat: "magnet", per: 0.28 },
    regen:     { id: "regen", name: "Recompile", icon:"✚", color:"#00ff66", desc:"+0.6 HP/s regen / lvl", max: 5, stat: "regen", per: 0.6 },
    crit:      { id: "crit", name: "Exploit", icon:"⚇", color:"#b14cff", desc:"+7% crit chance / lvl", max: 5, stat: "crit", per: 0.07 },
    area:      { id: "area", name: "Resolution", icon:"⬡", color:"#39e7ff", desc:"+12% area / lvl", max: 5, stat: "area", per: 0.12 },
  };

  /* =================== META (permanent, bytes) =================== */
  const META = {
    m_power:  { id:"m_power", name:"Core Damage", icon:"✕", desc:"+5% damage", max:8, cost:[80,140,240,400,640,1000,1600,2600], stat:"power", per:0.05 },
    m_hp:     { id:"m_hp", name:"Vital Mesh", icon:"❤", desc:"+15 max HP", max:8, cost:[80,140,240,400,640,1000,1600,2600], stat:"maxhp", per:15 },
    m_haste:  { id:"m_haste", name:"Clock Speed", icon:"⏱", desc:"+4% fire rate", max:6, cost:[120,220,380,620,1000,1700], stat:"haste", per:0.04 },
    m_magnet: { id:"m_magnet", name:"Field Range", icon:"◈", desc:"+12% pickup", max:5, cost:[100,180,320,560,900], stat:"magnet", per:0.12 },
    m_greed:  { id:"m_greed", name:"Data Greed", icon:"¤", desc:"+8% Bytes earned", max:6, cost:[150,280,500,860,1400,2300], stat:"greed", per:0.08 },
    m_revive: { id:"m_revive", name:"Reload Save", icon:"↺", desc:"+1 revive per run", max:2, cost:[600,1800], stat:"revive", per:1 },
  };

  /* =================== STAGES =================== */
  const STAGES = [
    { id:1, name:"01 // TRAINING CONSTRUCT", floor:"#020806", tint:"#00ff66", boss:90 },
    { id:2, name:"02 // SUBWAY LOOP",        floor:"#04060a", tint:"#39e7ff", boss:120 },
    { id:3, name:"03 // SERVER FARM",        floor:"#060406", tint:"#b14cff", boss:150 },
    { id:4, name:"04 // THE SOURCE",         floor:"#0a0602", tint:"#ffd24a", boss:180 },
  ];

  /* =================== GACHA BANNER =================== */
  const GACHA = {
    id: "construct_v3",
    name: "CONSTRUCT LOADOUT // featured",
    featured: "morph_ada",
    cost1: 300,   // redpills equiv (we use 'keys' or redpills)
    cost10: 2700,
    curr: "redpills",
    rates: { SSR: 0.02, SR: 0.10, R: 0.88 },
    softPity: 70,  // rates ramp after this
    hardPity: 90,  // guaranteed SSR
    pool: {
      SSR: ["morph_ada", "glyph_naia", "vesper_nox"],
      SR: ["trace_ivory", "cipher_vex", "sora_lumen"],
      R: ["neo_echo", "sable_zero", "kade_onyx", "dax_ronin"],
    },
    dupeShards: { SSR: 30, SR: 10, R: 5 }, // dupes -> shards
  };

  /* =================== 7-DAY LOGIN =================== */
  const LOGIN = [
    { d:1, cur:"bytes", amt:1000, label:"1,000 Bytes" },
    { d:2, cur:"redpills", amt:60, label:"60 Redpills" },
    { d:3, cur:"bytes", amt:3000, label:"3,000 Bytes" },
    { d:4, cur:"keys", amt:1, label:"1 Construct Key" },
    { d:5, cur:"redpills", amt:120, label:"120 Redpills" },
    { d:6, cur:"bytes", amt:8000, label:"8,000 Bytes" },
    { d:7, cur:"redpills", amt:300, label:"300 Redpills ★", big:true },
  ];

  /* =================== LIMITED OFFERS =================== */
  const OFFERS = [
    {
      id:"beginner", name:"REDPILL STARTER", once:true, flag:"+6000%",
      blurb:"Instantly recruit SSR ADA + 3-day ration of Redpills.",
      tiers:[ { label:"Day 1", give:[["redpills",80],["keys",1]] },
              { label:"Day 2", give:[["redpills",80],["bytes",5000]] },
              { label:"Day 3", give:[["redpills",80],["char","morph_ada"]] } ],
      price:"$0.99", durH:48,
    },
    {
      id:"expert", name:"EXPERT ADVANCED PACK", flag:"+1000%",
      blurb:"x2000 Bytes · x1000 ... wait, that's a lot. Quick-clear booster.",
      give:[["bytes",2000],["redpills",1000],["keys",30]],
      price:"$9.99", durH:2,
    },
    {
      id:"daily", name:"DAILY SPECIAL", refresh:true,
      blurb:"Discounted Redpill bundle. Resets every 4h.",
      give:[["redpills",40]],
      price:"FREE", durH:4,
    },
  ];

  /* =================== CURRENCY BUNDLES (simulated) =================== */
  const BUNDLES = {
    redpills: [
      { amt:80, price:"$0.99", id:"rp1" }, { amt:500, price:"$4.99", id:"rp2", best:false },
      { amt:1200, price:"$9.99", id:"rp3" }, { amt:2500, price:"$19.99", id:"rp4" },
      { amt:6500, price:"$49.99", id:"rp5", best:true }, { amt:14000, price:"$99.99", id:"rp6" },
    ],
    bytes: [
      { amt:1000, price:"FREE", id:"by0", ad:true }, { amt:20000, price:100, cur:"redpills", id:"by1" },
      { amt:100000, price:450, cur:"redpills", id:"by2" },
    ],
  };

  /* =================== BATTLE PASS =================== */
  const BP = {
    name:"THE PATH OF THE ONE",
    xpPerTier: 100,
    maxTier: 30,
    premiumPrice:"$9.99",
    // reward per tier index (0..29). free + premium tracks.
    reward(tier) {
      const t = tier + 1;
      const free = t % 5 === 0 ? ["redpills", 30] : ["bytes", 500 + t * 100];
      const prem = t % 10 === 0 ? ["keys", 2] : t % 5 === 0 ? ["redpills", 80] : ["bytes", 1500 + t * 150];
      return { free, prem };
    },
  };

  M.data = { CHARS, ROSTER, WEAPONS, EVO, PASSIVES, META, STAGES, GACHA, LOGIN, OFFERS, BUNDLES, BP };
})();
