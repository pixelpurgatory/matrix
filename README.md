# RESIDUAL // a survivor program

A **Vampire-Survivors-style** action roguelite reskinned into an original
**Matrix-aesthetic** cyber-world, wrapped in a faithful reproduction of the
**Chinese live-service monetization stack** seen in titles like *勇者活下去*
(login streaks, gacha with pity, battle pass, countdown offers, top-up shop).

Everything runs in a single static page — **no build step, no backend, no
network, no real money.** Open it and play.

```bash
npm start          # serves on http://localhost:8099
# or just open index.html in any modern browser / on your phone
```

---

## What it is

You are an **operator** jacked into a hostile construct. Agents, Sentinels and
glitch-wraiths swarm in from every edge. Your weapons fire automatically — you
only **move and choose upgrades**. Survive, level, evolve your loadout, and put
down the Agent that manifests around the 90-second mark.

### Controls
- **Touch:** drag anywhere to spawn a floating joystick.
- **Desktop:** `WASD` / arrow keys, or click-drag. `II` button pauses.

### Combat systems
- 7 weapons across 5 behaviours — homing rounds, orbiting light-discs, EMP novas,
  forking lightning, glyph spread, slow trackers, loyal sentinel husks.
- 8 passives (overclock, amplifier, kevlar, crit, area, magnet…), each levelling
  with classic survivor card-draws on level-up.
- XP gems, byte drops, hearts, magnets, and a screen-clearing bomb on boss kill.
- Screen shake, hit-flash, damage numbers, particle bursts, bullet-time on revive.

---

## The art & audio are 100% procedural

There are **no image, audio, or font assets in this repo** — and that's by design.

- **Characters, enemies, pickups and the menu portraits** are drawn live on the
  canvas every frame (see `js/sprites.js`): layered trench-coat operators with
  reflective shades and scrolling-code lenses, mechanical Sentinels, replicating
  Agent bosses.
- **The soundtrack** is a dark-techno loop **synthesized note-by-note** with the
  Web Audio API (`js/audio.js`) — a four-on-floor kick, acid bass, and an arp that
  intensifies with on-screen danger. Every SFX (shots, impacts, gacha risers,
  rarity reveals) is generated, not sampled.
- **The world** is the iconic falling green glyph cascade (`js/rain.js`), rendered
  as a dense, world-anchored backdrop.

This makes the project self-contained, offline, copyright-clean, and infinitely
re-skinnable by tweaking palette tables in `js/data.js`.

---

## The monetization study

The reference screenshots are textbook examples of engagement-engineering. This
build reproduces the loops so you can see exactly how they fit together —
**every system is annotated in `js/monetization.js` with the behavioural
mechanism it leans on:**

| System | File hook | Mechanism |
| --- | --- | --- |
| Gacha (Construct Loadout) | `pull()` | variable-ratio reward → dopaminergic prediction-error |
| Pity counter | `effectiveRates()` | goal-gradient + sunk-cost; SSR rate ramps toward the guarantee |
| 7-day login | `claimLogin()` | habit formation + loss-aversion on the streak |
| Limited offers w/ countdown | `offerState()` | scarcity / FOMO urgency |
| Battle pass | `bpClaim()` | endowed progress + completion drive |
| First top-up ×2 | `buyBundle()` | foot-in-the-door conversion |
| Red-dot badges | `badgeCount()` | notification-as-reward compulsion |

> ⚠️ **All currency is fake.** "Purchases" are buttons that grant in-game
> Bytes/Redpills locally via `localStorage`. There is no payment integration and
> no data leaves the device. It is a sandbox for understanding (and critiquing)
> these designs, not a shippable storefront.

---

## Self-evaluation chain

```bash
npm test           # logic + runtime smoke suites (no browser needed)
npm run shots      # headless-Chromium screenshots into assets/ (needs puppeteer)
```

- **`tests/logic.test.js`** — 35 assertions over the economy & progression math
  (pity ramps, hard-pity guarantee, 10-pull SR+ floor, statistical SSR rate band,
  login/battle-pass/meta/offer/reward correctness).
- **`tests/smoke.test.js`** — boots the *real* front-end against a stubbed DOM +
  canvas + Web Audio, then drives a full session (spawning, every weapon kind,
  boss, level-ups, game-over) and every menu screen, asserting **zero runtime
  errors**.
- **`tests/shot.js`** — loads the live game in headless Chromium and captures the
  hub, gacha, shop and gameplay frames (samples in `assets/`).

Current status: **logic 35/35 ✓ · smoke 20/20 ✓ · 0 console/page errors.**

---

## Project layout

```
index.html            boot gate + DOM shell
css/style.css         all UI / HUD / screen styling
js/util.js            math, RNG, object pool
js/save.js            localStorage profile
js/audio.js           Web Audio synth: music loop + SFX
js/rain.js            digital-rain renderer
js/sprites.js         procedural characters, enemies, portraits, VFX
js/data.js            characters, weapons, passives, stages, economy tables
js/monetization.js    gacha / login / pass / offers / meta (annotated)
js/entities.js        particles, bullets, enemies, pickups
js/game.js            engine: loop, player, weapons, spawn director, camera
js/ui.js              HUD + every menu/shop/gacha screen
js/main.js            bootstrap + input + pause
tests/                logic, smoke, and screenshot harnesses
```

Built for a friend. Stay jacked in.
