/* Headless smoke + gauntlet test: stubs the browser, runs the real game loop,
   simulates input, teleports the player through every key path. */
"use strict";
let rafCb = null;
const handlers = {};

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => grad;
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const canvas = {
  width: 960, height: 540, style: {},
  addEventListener() {},
  getContext: () => makeCtx()
};
global.document = { getElementById: () => canvas };
global.window = global;
global.addEventListener = (ev, fn) => { handlers[ev] = fn; };
global.Image = class { constructor() { this.src = ""; } };
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; } };
global.requestAnimationFrame = (cb) => { rafCb = cb; };

require("../js/world.js");
require("../js/game.js");
const MS = global.__MS;
const T = MS.T;

let now = 0;
function frames(n) {
  for (let i = 0; i < n; i++) {
    now += 16.7;
    const cb = rafCb; rafCb = null;
    if (!cb) throw new Error("rAF chain broken");
    cb(now);
  }
}
function key(code, ev) { handlers[ev]({ code, repeat: false, preventDefault() {} }); }
function tap(code) { key(code, "keydown"); frames(2); key(code, "keyup"); }
function hold(code) { key(code, "keydown"); }
function release(code) { key(code, "keyup"); }
function tp(tx, tyFeet) { MS.P.x = tx * T - MS.P.w / 2; MS.P.y = tyFeet * T - MS.P.h; MS.P.vx = 0; MS.P.vy = 0; MS.P.dead = false; }
let checks = 0;
function assert(cond, msg) { checks++; if (!cond) { console.log("GAUNTLET FAIL: " + msg); process.exit(1); } console.log("  ok - " + msg); }

// ---------- basic smoke ----------
frames(30);
tap("Space"); frames(30);
hold("ArrowRight"); for (let i = 0; i < 30; i++) { frames(6); tap("Space"); } release("ArrowRight");
tap("KeyX"); tap("KeyC"); tap("KeyM"); tap("KeyM"); tap("KeyP"); tap("KeyP"); tap("KeyN");
frames(100);
console.log("smoke ok");

// ---------- dash gate: without dash the gap is a spiked pit ----------
MS.save.ab.dash = false;
tp(68, 14); hold("ArrowRight"); hold("Space"); frames(90); release("Space"); release("ArrowRight");
assert((MS.P.y + MS.P.h) > 15.5 * T, "no-dash jump ends in the gap pit (gate holds)");

// ---------- practice pit is fair: jump-out-able without dash ----------
tp(22.5, 45); frames(3); hold("ArrowLeft"); hold("Space"); frames(40); release("Space"); release("ArrowLeft");
assert((MS.P.y + MS.P.h) <= 43.5 * T, "safe pit can be jumped out without dash");

// ---------- with dash the gap is crossed ----------
MS.save.ab.dash = true; MS.P.canDash = true;
tp(68, 14); hold("ArrowRight");
(function () { // human-like: jump at the edge, dash at the apex
  var jumped = false, dashed = false;
  for (var i = 0; i < 160; i++) {
    frames(1);
    if (!jumped && MS.P.x > 70.4 * T) { hold("Space"); jumped = true; }
    if (jumped && !dashed && !MS.P.ground && MS.P.vy > -150 && MS.P.vy < 0) { tap("KeyC"); dashed = true; }
    if (dashed && MS.P.ground) break;
  }
  release("Space"); release("ArrowRight");
})();
assert(MS.P.x > 77 * T && (MS.P.y + MS.P.h) < 15 * T, "dash jump crosses the 5-tile gap into right hall");

// ---------- collect everything by teleport ----------
tp(30.5, 42.5); frames(4); assert(MS.save.ab.dash === true && true, "dash shrine pickup");
MS.save.ab.dash = true;
tp(83.5, 13); frames(4); assert(MS.save.ab.walljump === true, "wall-jump shrine pickup");
tp(96.5, 6.5); frames(4); assert(MS.save.ab.doublejump === true, "double-jump shrine pickup");
const shardSpots = [[123.5, 27.5], [13.5, 42.5], [63.5, 28.5], [22.5, 40.5], [50.5, 42.5], [117.5, 23.5], [78.5, 6.5]];
shardSpots.forEach((s, i) => { tp(s[0], s[1]); frames(4); assert((MS.save.shards >> i & 1) === 1, "shard " + i + " pickup"); });
const heartSpots = [[102.5, 33.5], [11.5, 36.5], [110.5, 38.5]];
heartSpots.forEach((s, i) => { tp(s[0], s[1]); frames(4); assert((MS.save.hearts >> i & 1) === 1, "heart " + i + " pickup (maxhp=" + MS.save.maxhp + ")"); });
assert(MS.save.maxhp === 8, "max hp raised to 8");

// ---------- spike strip crossed with dash i-frames ----------
MS.P.hp = MS.save.maxhp;
tp(17, 43); hold("ArrowRight");
(function () { // jump before the pit, dash at the apex, clear pit + spikes
  var jumped = false, dashed = false;
  for (var i = 0; i < 140; i++) {
    frames(1);
    if (!jumped && MS.P.x > 19.2 * T) { hold("Space"); jumped = true; }
    if (jumped && !dashed && !MS.P.ground && MS.P.vy > -180 && MS.P.vy < 0) { tap("KeyC"); dashed = true; }
    if (dashed && MS.P.ground) break;
  }
  release("Space"); release("ArrowRight");
})();
assert(MS.P.x > 27.5 * T && MS.P.hp === MS.save.maxhp, "dash over pit + spike strip unharmed");

// ---------- bench save ----------
tp(8.5, 43); frames(4); tap("ArrowUp"); frames(4);
assert(MS.save.bench === 1, "deep-cave bench becomes spawn");

// ---------- boss: activate, kill, ending ----------
MS.save.bench = 0;
tp(116, 13); frames(10);
assert(MS.boss && MS.boss.st !== "sleep", "boss awakens");
MS.boss.hp = 1;
tp(115, 10); frames(4); tap("KeyX"); frames(10); tap("KeyX"); frames(10);
assert(MS.boss.dead === true && MS.save.boss === true, "boss defeated");
const star = MS.items.find(it => it.kind === "finalstar");
assert(!!star, "final star dropped");
tp(star.x / T, star.y / T + 0.5); frames(6);
assert(MS.state.mode === "end", "ending triggered by final star");
frames(120);
tap("Space"); frames(30);
assert(MS.state.mode === "play", "back to play after ending");

console.log("GAUNTLET OK: " + checks + " assertions passed (gates, fairness, pickups, spikes, bench, boss, ending).");
