/* MABYE STAR — a tiny metroidvania starring the purple-haired girl.
   Canvas 2D, no dependencies. Requires window.WORLD (js/world.js). */
(function () {
  "use strict";
  var WD = window.WORLD, T = WD.T, W = WD.W, H = WD.H;
  var world = WD.build();
  var g = world.g;

  var cvs = document.getElementById("game");
  var ctx = cvs.getContext("2d");
  var VW = 960, VH = 540;
  ctx.imageSmoothingEnabled = false;

  // ---------------- input ----------------
  var keys = {}, pressed = {};
  var KEYMAP = {
    left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"],
    jump: ["KeyZ", "Space", "KeyK"], atk: ["KeyX", "KeyJ"],
    dash: ["KeyC", "ShiftLeft", "ShiftRight"], down: ["ArrowDown", "KeyS"],
    map: ["KeyM", "Tab"], pause: ["KeyP", "Escape"], interact: ["ArrowUp", "KeyE"], mute: ["KeyN"]
  };
  function down(act) { return KEYMAP[act].some(function (k) { return keys[k]; }); }
  function hit(act) { return KEYMAP[act].some(function (k) { return pressed[k]; }); }
  window.addEventListener("keydown", function (e) {
    if (["Space", "Tab", "ArrowUp", "ArrowDown"].indexOf(e.code) >= 0) e.preventDefault();
    if (!e.repeat) pressed[e.code] = true;
    keys[e.code] = true;
    AU.unlock();
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  cvs.addEventListener("mousedown", function () { AU.unlock(); });

  // ---------------- audio ----------------
  var AU = {
    ctx: null, master: null, muted: false,
    unlock: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        BG.start();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    },
    tone: function (f0, f1, dur, type, vol, delay) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime + (delay || 0);
      var o = this.ctx.createOscillator(), gn = this.ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      gn.gain.setValueAtTime(vol || 0.2, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(gn); gn.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise: function (dur, vol, delay) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime + (delay || 0);
      var n = this.ctx.sampleRate * dur, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = this.ctx.createBufferSource(); s.buffer = buf;
      var gn = this.ctx.createGain(); gn.gain.value = vol || 0.2;
      s.connect(gn); gn.connect(this.master);
      s.start(t);
    }
  };
  function sfx(n) {
    switch (n) {
      case "jump": AU.tone(300, 620, 0.14, "square", 0.12); break;
      case "djump": AU.tone(420, 900, 0.16, "square", 0.12); AU.tone(630, 1200, 0.14, "sine", 0.1, 0.03); break;
      case "wj": AU.tone(240, 500, 0.12, "triangle", 0.15); break;
      case "dash": AU.noise(0.14, 0.14); AU.tone(700, 180, 0.16, "sawtooth", 0.08); break;
      case "atk": AU.noise(0.07, 0.12); AU.tone(900, 300, 0.08, "square", 0.06); break;
      case "hit": AU.tone(220, 60, 0.12, "sawtooth", 0.2); AU.noise(0.08, 0.15); break;
      case "hurt": AU.tone(300, 70, 0.3, "sawtooth", 0.25); break;
      case "break": AU.noise(0.2, 0.25); AU.tone(140, 50, 0.2, "square", 0.15); break;
      case "pick": AU.tone(660, 660, 0.08, "square", 0.12); AU.tone(880, 880, 0.08, "square", 0.12, 0.08); AU.tone(1320, 1320, 0.12, "square", 0.12, 0.16); break;
      case "heart": AU.tone(520, 520, 0.1, "triangle", 0.15); AU.tone(780, 780, 0.14, "triangle", 0.15, 0.1); break;
      case "save": AU.tone(523, 523, 0.12, "sine", 0.15); AU.tone(659, 659, 0.12, "sine", 0.15, 0.12); AU.tone(784, 784, 0.2, "sine", 0.15, 0.24); break;
      case "die": AU.tone(400, 40, 0.5, "sawtooth", 0.25); AU.noise(0.4, 0.2); break;
      case "boss": AU.tone(90, 45, 0.5, "sawtooth", 0.3); AU.noise(0.4, 0.25); break;
    }
  }
  // --- tiny sequencer bgm ---
  var BG = {
    step: 0, next: 0, timer: null,
    field: { bass: [55, 0, 55, 0, 49, 0, 49, 0, 44, 0, 44, 0, 58, 0, 62, 0],
             mel: [220, 0, 262, 330, 0, 262, 0, 220, 196, 0, 220, 262, 0, 330, 392, 330] },
    bossP: { bass: [41, 41, 0, 41, 44, 44, 0, 44, 39, 39, 0, 39, 46, 46, 0, 46],
             mel: [165, 0, 196, 0, 220, 0, 196, 165, 155, 0, 175, 0, 196, 0, 233, 220] },
    start: function () {
      var self = this;
      this.next = AU.ctx.currentTime + 0.1;
      this.timer = setInterval(function () { self.tick(); }, 60);
    },
    tick: function () {
      if (!AU.ctx || AU.muted) { this.next = AU.ctx ? AU.ctx.currentTime + 0.1 : this.next; return; }
      var spb = 60 / 132 / 2; // 8th notes
      while (this.next < AU.ctx.currentTime + 0.15) {
        var pat = (state.mode === "play" && P.bossActive) ? this.bossP : this.field;
        var i = this.step % 16;
        var b = pat.bass[i], m = pat.mel[i];
        var d = this.next - AU.ctx.currentTime;
        if (b) AU.tone(b, b, spb * 0.9, "triangle", 0.16, d);
        if (m) AU.tone(m, m, spb * 0.8, "square", 0.05, d);
        if (i % 4 === 2) AU.noise(0.03, 0.03, d);
        this.step++;
        this.next += spb;
      }
    }
  };

  // ---------------- save ----------------
  var SAVE_KEY = "mabyestar_v1";
  var save = { maxhp: 5, ab: { dash: false, walljump: false, doublejump: false }, shards: 0, hearts: 0, bench: 0, boss: false, time: 0 };
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) { var s = JSON.parse(raw); for (var k in s) save[k] = s[k]; }
  } catch (e) {}
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  // ---------------- player ----------------
  var P = {
    x: 0, y: 0, w: 26, h: 76, vx: 0, vy: 0, face: 1, ground: false,
    coyote: 0, jbuf: 0, canDJ: false, wall: 0, wallSlide: false,
    dashT: 0, dashCD: 0, canDash: true, atkT: 0, atkCD: 0,
    hp: save.maxhp, inv: 0, dead: false, deadT: 0,
    anim: "idle", animT: 0, squash: 0, stretch: 0, fallMax: 0, combo: -1, comboT: 0, pendDash: false,
    bossActive: false, dropT: 0
  };
  function tileAt(px, py) {
    var tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return 1;
    return g[ty * W + tx];
  }
  function solidAt(px, py) { var v = tileAt(px, py); return v === 1 || v === 3; }

  function benchPos() { return world.benches[save.bench]; }
  function respawn() { state.fade = 1;
    var b = benchPos();
    P.x = (b.x + 0.5) * T - P.w / 2; P.y = (b.y + 1) * T - P.h;
    P.vx = P.vy = 0; P.hp = save.maxhp; P.dead = false; P.inv = 1;
    resetEnemies();
  }

  // ---------------- entities ----------------
  var enemies = [], items = [], parts = [], shots = [];
  var boss = null;
  function resetEnemies() {
    enemies = world.enemies.map(function (e) {
      var slime = e.kind === "slime";
      return { kind: e.kind, x: (e.x + 0.5) * T, y: (e.y + 1) * T, ax: (e.x + 0.5) * T, ay: (e.y + 0.5) * T,
               vx: 0, vy: 0, w: slime ? 28 : 22, h: slime ? 24 : 20,
               hp: slime ? 2 : 1, t: Math.random() * 6, dead: false, face: 1, hurtT: 0 };
    });
    if (!save.boss) boss = { x: world.boss.x * T, y: world.boss.y * T, hp: 40, maxhp: 40, t: 0, st: "sleep", vt: 0, hurtT: 0, dead: false, face: -1 };
    else boss = null;
    shots = [];
  }
  function buildItems() {
    items = [];
    world.abilities.forEach(function (a, i) {
      if (save.ab[a.id]) return;
      items.push({ kind: "ability", id: a.id, name: a.name, desc: a.desc, x: (a.x + 0.5) * T, y: (a.y + 0.5) * T, t: i });
    });
    world.shards.forEach(function (s, i) { if (!(save.shards & (1 << i))) items.push({ kind: "shard", i: i, x: (s.x + 0.5) * T, y: (s.y + 0.5) * T, t: i }); });
    world.hearts.forEach(function (h, i) { if (!(save.hearts & (1 << i))) items.push({ kind: "heart", i: i, x: (h.x + 0.5) * T, y: (h.y + 0.5) * T, t: i }); });
  }

  // ---------------- particles ----------------
  function puff(x, y, n, c, sp) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (sp || 120) * (0.4 + Math.random() * 0.8);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0.4 + Math.random() * 0.3, life: 0.7, c: c, r: 2 + Math.random() * 3 });
    }
  }
  var toasts = [];
  function toast(txt, sub) { toasts.push({ txt: txt, sub: sub || "", t: 0 }); }

  // ---------------- game state ----------------
  var state = { mode: "title", paused: false, mapOpen: false, time: save.time, shake: 0, hitstop: 0, endT: 0, titleT: 0, fade: 0 };
  var lastZone = -1, zoneT = 0;
  var ZNAMES = ["星 之 遗 迹", "西 部 洞 窟", "北 方 天 台"];
  var cam = { x: 0, y: 0 };
  var visited = {};

  // ---------------- physics ----------------
  var GRAV = 2600, MOVE = 330, JUMPV = 870, MAXFALL = 1400;
  function moveY(ent, dy) {
    ent.y += dy;
    var x0 = Math.floor(ent.x / T), x1 = Math.floor((ent.x + ent.w - 1) / T);
    if (dy > 0) {
      var ty = Math.floor((ent.y + ent.h) / T);
      for (var x = x0; x <= x1; x++) {
        var v = (ty < 0 || ty >= H) ? 1 : g[ty * W + x];
        if (v === 1 || v === 3 || (v === 4 && ent.prevFeet <= ty * T + 1 && ent.dropT <= 0)) {
          ent.y = ty * T - ent.h; ent.vy = 0; return "floor";
        }
      }
    } else if (dy < 0) {
      var ty2 = Math.floor(ent.y / T);
      for (var x2 = x0; x2 <= x1; x2++) {
        if (solidAt(x2 * T + 1, ty2 * T + 1)) { ent.y = (ty2 + 1) * T; ent.vy = 0; return "ceil"; }
      }
    }
    return null;
  }
  function moveX(ent, dx) {
    ent.x += dx;
    var y0 = Math.floor(ent.y / T), y1 = Math.floor((ent.y + ent.h - 1) / T);
    if (dx > 0) {
      var tx = Math.floor((ent.x + ent.w) / T);
      for (var y = y0; y <= y1; y++) if (solidAt(tx * T + 1, y * T + 1)) { ent.x = tx * T - ent.w; ent.vx = 0; return 1; }
    } else if (dx < 0) {
      var tx2 = Math.floor(ent.x / T);
      for (var y2 = y0; y2 <= y1; y2++) if (solidAt(tx2 * T + 1, y2 * T + 1)) { ent.x = (tx2 + 1) * T; ent.vx = 0; return -1; }
    }
    return 0;
  }

  function hurtPlayer(dmg, kx) {
    if (P.inv > 0 || P.dead || P.dashT > 0) return;
    P.hp -= dmg; P.inv = 1.2; P.vy = -420; P.vx = kx || 0;
    state.shake = 8; state.hitstop = 0.06;
    sfx("hurt"); puff(P.x + P.w / 2, P.y + P.h / 2, 10, "#f66");
    if (P.hp <= 0) { P.dead = true; P.deadT = 0; state.fade = 0.85; sfx("die"); puff(P.x + P.w / 2, P.y + P.h / 2, 30, "#c9a"); }
  }

  function updatePlayer(dt) {
    if (P.dead) {
      P.deadT += dt;
      if (P.deadT > 1.2) { respawn(); toast("在长椅边醒来…", ""); }
      return;
    }
    P.coyote -= dt; P.jbuf -= dt; P.inv -= dt; P.dashCD -= dt; P.atkCD -= dt; P.dropT -= dt;
    P.squash = Math.max(0, P.squash - dt * 4); P.stretch = Math.max(0, P.stretch - dt * 4);

    var ax = 0;
    if (down("left")) { ax = -1; P.face = -1; }
    if (down("right")) { ax = 1; P.face = 1; }

    if (hit("jump")) P.jbuf = 0.15;
    // dash is resolved after jumps below so same-frame jump+dash keeps the jump
    P.pendDash = hit("dash") && save.ab.dash && P.dashCD <= 0 && P.canDash;
    if (hit("atk") && P.atkCD <= 0) {
      P.atkT = 0.2; P.atkCD = 0.3;
      P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0;   // 3-hit chain, 3rd is heavy
      P.comboT = 0.8;
      sfx("atk");
    }
    P.comboT -= dt;
    if (P.comboT <= 0) P.combo = -1;

    if (P.dashT > 0) {
      P.dashT -= dt; P.vy = 0;
      if (P.dashT <= 0) P.vx = P.face * 470;   // dash momentum carries into the air
      parts.push({ x: P.x + P.w / 2, y: P.y + P.h / 2, vx: 0, vy: 0, t: 0.2, life: 0.2, c: "#9cf", r: 0, ghost: true, face: P.face });
    } else {
      var target = ax * MOVE;
      var acc = P.ground ? 2600 : 1800;
      if (P.vx < target) P.vx = Math.min(target, P.vx + acc * dt);
      else if (P.vx > target) P.vx = Math.max(target, P.vx - acc * dt);
      P.vy += GRAV * dt;
      // wall slide
      P.wallSlide = false;
      if (save.ab.walljump && !P.ground && P.vy > 0 && P.wall !== 0 && ax === P.wall) {
        P.vy = Math.min(P.vy, 140); P.wallSlide = true; P.canDash = true;
        if (Math.random() < 0.3) puff(P.x + (P.wall > 0 ? P.w : 0), P.y + P.h * 0.7, 1, "#aaa", 40);
      }
      P.vy = Math.min(P.vy, MAXFALL);
      // variable jump height: releasing early cuts the jump short
      if (!down("jump") && P.vy < -320) P.vy = -320;
      P.fallMax = Math.max(P.fallMax, P.vy);
      // drop through one-way
      if (down("down") && hit("jump") && P.ground) {
        P.dropT = 0.22; P.ground = false; P.jbuf = 0; P.y += 2;
      }
      // jumps
      var jumpedNow = false;
      if (P.jbuf > 0) {
        if (P.ground || P.coyote > 0) {
          P.vy = -JUMPV; P.jbuf = 0; P.coyote = 0; P.ground = false;
          P.stretch = 1; jumpedNow = true; sfx("jump"); puff(P.x + P.w / 2, P.y + P.h, 5, "#999", 80);
        } else if (P.wall !== 0 && save.ab.walljump) {
          P.vy = -800; P.vx = -P.wall * 420; P.face = -P.wall; P.jbuf = 0; P.stretch = 1;
          jumpedNow = true; sfx("wj"); puff(P.x + (P.wall > 0 ? P.w : 0), P.y + P.h / 2, 6, "#aaa", 90);
        } else if (save.ab.doublejump && P.canDJ) {
          P.vy = -780; P.jbuf = 0; P.canDJ = false; P.stretch = 1; jumpedNow = true; sfx("djump");
          puff(P.x + P.w / 2, P.y + P.h, 10, "#7ef", 120);
          parts.push({ x: P.x + P.w / 2, y: P.y + P.h, vx: 0, vy: 0, t: 0.35, life: 0.35, c: "#7ef", r: 46, ring: true });
        }
      }
      if (P.pendDash) {
        P.pendDash = false;
        P.dashT = 0.18; P.dashCD = 0.35; P.canDash = false;
        P.vx = P.face * 820;
        P.vy = jumpedNow ? -420 : 0;   // jump+dash same frame keeps a rising arc
        sfx("dash");
        puff(P.x + P.w / 2, P.y + P.h - 8, 6, "#baf");
      }
    }

    P.prevFeet = P.y + P.h;
    moveX(P, P.vx * dt);
    P.wall = 0;
    if (!P.ground) {
      if (solidAt(P.x + P.w + 2, P.y + P.h * 0.5)) P.wall = 1;
      else if (solidAt(P.x - 2, P.y + P.h * 0.5)) P.wall = -1;
    }
    var hy = moveY(P, P.vy * dt);
    if (hy === "floor") {
      if (!P.ground && P.vy >= 0) {
        P.squash = 1;
        var impact = P.fallMax;
        if (impact > 900) { state.shake = Math.max(state.shake, 3); puff(P.x + P.w / 2, P.y + P.h, 9, "#aaa", 130); }
        else puff(P.x + P.w / 2, P.y + P.h, 4, "#999", 70);
      }
      P.fallMax = 0;
      P.ground = true; P.coyote = 0.12; P.canDJ = true; P.canDash = true;
    } else if (hy === "ceil") { /* bonk */ }
    else { if (P.ground) P.coyote = 0.12; P.ground = false; }

    // spikes
    var cx0 = Math.floor((P.x + 4) / T), cx1 = Math.floor((P.x + P.w - 4) / T);
    var cy0 = Math.floor((P.y + 4) / T), cy1 = Math.floor((P.y + P.h - 2) / T);
    for (var ty = cy0; ty <= cy1; ty++) for (var tx = cx0; tx <= cx1; tx++) {
      if (tileAt(tx * T + 2, ty * T + 2) === 2 && P.dashT <= 0) hurtPlayer(1, P.vx > 0 ? -200 : 200);
    }

    // attack hitbox vs enemies / breakables / boss
    if (P.atkT > 0) {
      P.atkT -= dt;
      var hb = { x: P.face > 0 ? P.x + P.w : P.x - 46, y: P.y + 10, w: 46, h: P.h - 20 };
      enemies.forEach(function (e) {
        if (e.dead) return;
        var ew = e.kind === "slime" ? 34 : 26, eh = e.kind === "slime" ? 26 : 22;
        if (e.x - ew / 2 < hb.x + hb.w && e.x + ew / 2 > hb.x && e.y - eh < hb.y + hb.h && e.y > hb.y) {
          if (e.hurtT <= 0) {
            var heavy = P.combo === 2;
            e.hp--; e.hurtT = 0.25;
            e.vx = P.face * (heavy ? 420 : 260); e.vy = heavy ? -280 : -160;
            state.hitstop = heavy ? 0.07 : 0.04;
            if (heavy) state.shake = Math.max(state.shake, 3);
            sfx("hit");
            puff(e.x, e.y - eh / 2, heavy ? 10 : 6, "#fff", 140);
            if (e.hp <= 0) {
              e.dead = true;
              puff(e.x, e.y - eh / 2, 14, e.kind === "slime" ? "#8f8" : "#c8f", 160);
              parts.push({ x: e.x, y: e.y - eh / 2, vx: 0, vy: -60, t: 0.9, life: 0.9, c: e.kind === "slime" ? "#bfb" : "#dbf", r: 5, wisp: true });
              if (Math.random() < 0.18) items.push({ kind: "heal", x: e.x, y: e.y - 12, t: Math.random() * 6 });
            }
          }
        }
      });
      if (boss && !boss.dead && boss.st !== "sleep") {
        if (boss.x - 30 < hb.x + hb.w && boss.x + 30 > hb.x && boss.y - 40 < hb.y + hb.h && boss.y + 40 > hb.y) {
          if (boss.hurtT <= 0) {
            boss.hp--; boss.hurtT = 0.2;
            state.hitstop = P.combo === 2 ? 0.08 : 0.05;
            if (P.combo === 2) state.shake = Math.max(state.shake, 3);
            sfx("hit");
            puff(boss.x, boss.y, 8, "#f8f", 160);
            if (boss.hp <= 0) killBoss();
          }
        }
      }
      // breakable tiles
      var btx0 = Math.floor(hb.x / T), btx1 = Math.floor((hb.x + hb.w) / T);
      var bty0 = Math.floor(hb.y / T), bty1 = Math.floor((hb.y + hb.h) / T);
      for (var by = bty0; by <= bty1; by++) for (var bx = btx0; bx <= btx1; bx++) {
        if (bx >= 0 && by >= 0 && bx < W && by < H && g[by * W + bx] === 3) {
          g[by * W + bx] = 0; sfx("break"); state.shake = 4;
          puff(bx * T + T / 2, by * T + T / 2, 12, "#776", 160);
        }
      }
    }

    // items pickup
    items = items.filter(function (it) {
      if (it.kind === "finalstar") return true;
      var dx = P.x + P.w / 2 - it.x, dy = P.y + P.h / 2 - it.y;
      if (dx * dx + dy * dy < 55 * 55) {
        if (it.kind === "heal") {
          if (P.hp < save.maxhp) { P.hp++; sfx("heart"); puff(it.x, it.y, 8, "#f8a", 120); }
          return false;
        }
        if (it.kind === "ability") {
          save.ab[it.id] = true; persist();
          toast("获得能力 · " + it.name, it.desc); sfx("pick");
          puff(it.x, it.y, 24, "#fe8", 200);
        } else if (it.kind === "shard") {
          save.shards |= (1 << it.i); persist();
          toast("星星碎片 " + bitCount(save.shards) + " / 7", "微光在口袋里闪烁"); sfx("pick");
          puff(it.x, it.y, 16, "#8ef", 180);
        } else {
          save.hearts |= (1 << it.i); save.maxhp++; P.hp = save.maxhp; persist();
          toast("生命上限提升！", "当前 " + save.maxhp + " 颗心"); sfx("heart");
          puff(it.x, it.y, 16, "#f8a", 180);
        }
        return false;
      }
      return true;
    });

    // benches & signs
    world.benches.forEach(function (b, i) {
      var bx = (b.x + 0.5) * T, by = (b.y + 1) * T;
      if (Math.abs(P.x + P.w / 2 - bx) < 40 && Math.abs(P.y + P.h - by) < 50) {
        if (hit("interact") || hit("jump") && down("down")) {
          if (save.bench !== i || P.hp < save.maxhp) {
            save.bench = i; P.hp = save.maxhp; persist();
            sfx("save"); puff(bx, by - 30, 14, "#fe9", 120);
            toast("进度已记录", "星星会记住你走过的路");
          }
        }
      }
    });
    world.signs.forEach(function (s) {
      var sx = (s.x + 0.5) * T, sy = (s.y + 1) * T;
      if (Math.abs(P.x + P.w / 2 - sx) < 36 && Math.abs(P.y + P.h - sy) < 50 && down("interact")) {
        state.signLines = s.lines;
      } else if (state.signLines === s.lines) state.signLines = null;
    });

    // boss trigger
    if (boss && !boss.dead && Math.abs(P.x - boss.x) < 380 && Math.abs(P.y - boss.y) < 260) {
      if (boss.st === "sleep") { boss.st = "intro"; boss.t = 0; P.bossActive = true; toast("!! 蚀星者 !!", "吞噬星光的幽灵，夺回碎片！"); sfx("boss"); }
    }

    // anim
    P.animT += dt;
    if (P.dashT > 0) P.anim = "dash";
    else if (!P.ground) P.anim = "jump";
    else if (Math.abs(P.vx) > 30) P.anim = "run";
    else P.anim = "idle";

    // fell out of world (safety)
    if (P.y > H * T + 200) hurtPlayer(99, 0);

    // visited map cells
    var vx = Math.floor(P.x / (T * 4)), vy = Math.floor(P.y / (T * 4));
    visited[vx + "," + vy] = 1;
    state.time += dt; save.time = state.time;
  }

  function bitCount(n) { var c = 0; while (n) { c += n & 1; n >>= 1; } return c; }

  function killBoss() {
    boss.dead = true; P.bossActive = false;
    state.shake = 14; state.hitstop = 0.22; sfx("boss");
    puff(boss.x, boss.y, 60, "#f8f", 320);
    puff(boss.x, boss.y, 40, "#8ef", 260);
    for (var ri = 0; ri < 3; ri++) parts.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, t: 0.6 + ri * 0.25, life: 0.6 + ri * 0.25, c: ri === 1 ? "#8ef" : "#f8f", r: 150, ring: true });
    for (var wi = 0; wi < 10; wi++) parts.push({ x: boss.x + (Math.random() - 0.5) * 60, y: boss.y + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 80, vy: -80 - Math.random() * 120, t: 1.2, life: 1.2, c: Math.random() < 0.5 ? "#dbf" : "#fff", r: 4, wisp: true });
    save.boss = true; persist();
    items.push({ kind: "finalstar", x: boss.x, y: boss.y, t: 0 });
    toast("蚀星者消散了…", "一颗完整的星星缓缓落下");
  }

  function updateEnemies(dt) {
    enemies.forEach(function (e) {
      if (e.dead) return;
      e.t += dt; e.hurtT -= dt;
      if (e.kind === "slime") {
        e.vy = (e.vy || 0) + GRAV * dt;
        e.vx = e.hurtT > 0 ? e.vx : (Math.floor(e.t) % 4 < 2 ? 40 * e.face : 0);
        if (Math.floor(e.t) % 4 === 0 && e.vx === 0) e.face = Math.random() < 0.5 ? 1 : -1;
        var wasG = moveY(e, e.vy * dt) === "floor";
        if (wasG && e.vx === 0 && Math.random() < dt * 0.5) e.vy = -240;
        var wx = moveX(e, e.vx * dt);
        if (wx !== 0) e.face = -wx;
        // turn at edges
        if (wasG && e.vx !== 0) {
          var ahead = solidAt(e.x + (e.face > 0 ? 36 : -4), e.y + 6);
          if (!ahead) e.face = -e.face;
        }
      } else { // bat: hover, then telegraphed swoop
        var dx = P.x + P.w / 2 - e.x, dy = P.y + P.h / 2 - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (e.sw === undefined) { e.sw = 0; e.swT = 1; }
        e.swT -= dt;
        if (e.sw === 0) {
          e.x = e.ax + Math.cos(e.t * 1.3) * 60; e.y = e.ay + Math.sin(e.t * 2.1) * 40;
          if (d < 240 && !P.dead && e.swT <= 0) { e.sw = 1; e.swT = 0.9; e.svx = dx / d * 300; e.svy = dy / d * 300; }
        } else {
          e.x += e.svx * dt; e.y += e.svy * dt;
          if (e.swT <= 0) { e.sw = 0; e.swT = 1.8; e.ax = e.x; e.ay = e.y; }
        }
        e.face = dx > 0 ? 1 : -1;
      }
      // contact damage
      var ew = e.kind === "slime" ? 30 : 22, eh = e.kind === "slime" ? 24 : 20;
      if (P.x < e.x + ew / 2 && P.x + P.w > e.x - ew / 2 && P.y < e.y && P.y + P.h > e.y - eh) {
        hurtPlayer(1, (P.x + P.w / 2 < e.x ? -1 : 1) * 260);
      }
    });
  }

  function updateBoss(dt) {
    if (!boss || boss.dead) return;
    boss.t += dt; boss.hurtT -= dt;
    if (boss.st === "sleep") return;
    if (boss.st === "intro") {
      boss.y += Math.sin(boss.t * 3) * 20 * dt;
      if (boss.t > 1.4) { boss.st = "hover"; boss.t = 0; }
      return;
    }
    var phase = boss.hp < boss.maxhp / 2 ? 2 : 1;
    if (boss.st === "hover") {
      var tx = P.x + P.w / 2, ty = P.y - 140;
      boss.x += (tx - boss.x) * dt * (phase === 2 ? 1.6 : 1.0);
      boss.y += (ty - boss.y) * dt * 1.2;
      boss.face = tx > boss.x ? 1 : -1;
      boss.vt -= dt;
      if (boss.vt <= 0) {
        boss.vt = phase === 2 ? 1.1 : 1.7;
        boss.volley = (boss.volley || 0) + 1;
        for (var i = -1; i <= 1; i++) {
          var a = Math.atan2(P.y - boss.y, P.x - boss.x) + i * 0.3;
          shots.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 3 });
        }
        if (phase === 2 && boss.volley % 3 === 0) {
          for (var k = 0; k < 8; k++) {
            var a2 = k * Math.PI / 4 + state.time;
            shots.push({ x: boss.x, y: boss.y, vx: Math.cos(a2) * 180, vy: Math.sin(a2) * 180, t: 3 });
          }
          state.shake = Math.max(state.shake, 3);
          parts.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, t: 0.4, life: 0.4, c: "#f8f", r: 90, ring: true });
        }
        sfx("atk");
      }
      if (Math.random() < dt * (phase === 2 ? 0.5 : 0.2)) boss.st = "dashT"; boss.t = 0;
    } else if (boss.st === "dashT") {
      if (boss.t > 0.5) { boss.st = "dash"; boss.t = 0; boss.vx = (P.x > boss.x ? 1 : -1) * 520; boss.vy = (P.y > boss.y ? 1 : -1) * 300; sfx("dash"); }
    } else if (boss.st === "dash") {
      boss.x += boss.vx * dt; boss.y += boss.vy * dt;
      if (boss.t > 0.55) { boss.st = "hover"; boss.t = 0; }
      if (P.x < boss.x + 30 && P.x + P.w > boss.x - 30 && P.y < boss.y + 34 && P.y + P.h > boss.y - 34) hurtPlayer(1, boss.vx > 0 ? 300 : -300);
    }
    // contact
    if (P.x < boss.x + 26 && P.x + P.w > boss.x - 26 && P.y < boss.y + 30 && P.y + P.h > boss.y - 30) hurtPlayer(1, P.x < boss.x ? -280 : 280);
  }

  function updateShots(dt) {
    shots = shots.filter(function (s) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
      if (solidAt(s.x, s.y)) { puff(s.x, s.y, 4, "#f8f", 80); return false; }
      if (P.x < s.x + 8 && P.x + P.w > s.x - 8 && P.y < s.y + 8 && P.y + P.h > s.y - 8) { hurtPlayer(1, s.vx > 0 ? 200 : -200); return false; }
      return s.t > 0;
    });
  }

  // ---------------- drawing ----------------
  var hero = new Image();
  hero.src = "assets/hero.png";
  function heroOk() { return hero.complete && hero.naturalWidth > 0; }
  var BGIMG = [new Image(), new Image(), new Image()];
  BGIMG[0].src = "assets/bg_ruins.png";
  BGIMG[1].src = "assets/bg_caves.png";
  BGIMG[2].src = "assets/bg_sky.png";
  function bgOk(i) { return BGIMG[i] && BGIMG[i].complete && BGIMG[i].naturalWidth > 0; }
  var glows = [];  // light sources collected per frame (world space)
  var amb = [];    // ambient drifting motes
  var RIVET = "#8a7a52";
  function hash2(x, y) { var n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >> 13), 1274126177); return ((n ^ (n >> 16)) >>> 0) % 1000; }
  function drawBGImage(img, factor, alpha, yoff) {
    if (!(img.complete && img.naturalWidth)) return;
    var scale = (VH * 1.35) / img.naturalHeight;
    var w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    var ox = -((cam.x * factor) % w);
    ctx.save();
    ctx.imageSmoothingEnabled = true;   // painterly layers stay soft
    ctx.globalAlpha = alpha;
    for (var x = ox - w; x < VW + w; x += w) ctx.drawImage(img, x, VH - h + yoff, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function glow(x, y, r, c, a) { glows.push({ x: x, y: y, r: r, c: c, a: a || 0.16 }); }
  function drawGlows() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < glows.length; i++) {
      var gl = glows[i];
      var gr = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r);
      gr.addColorStop(0, gl.c); gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = gl.a;
      ctx.fillStyle = gr;
      ctx.fillRect(gl.x - gl.r, gl.y - gl.r, gl.r * 2, gl.r * 2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function vignette() {
    var gr = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(5,3,12,0.5)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  }
  var bloomCv = null, bctx = null;
  function postFX() {
    // drifting god-ray shafts (HD-2D light)
    var zi = zone(cam.x + VW / 2);
    var rc = zi === 0 ? "255,200,160" : zi === 1 ? "126,240,224" : "207,216,255";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 4; i++) {
      var x0 = ((i * 290 + state.time * 9) % (VW + 460)) - 230;
      var sway = Math.sin(state.time * 0.4 + i) * 30;
      ctx.fillStyle = "rgba(" + rc + ",0.032)";
      ctx.beginPath();
      ctx.moveTo(x0 + sway, -4); ctx.lineTo(x0 + 80 + sway, -4);
      ctx.lineTo(x0 + 240, VH); ctx.lineTo(x0 + 130, VH);
      ctx.fill();
    }
    ctx.restore();
    // bloom: downsample frame, add back softly
    if (!bloomCv && typeof document !== "undefined" && document.createElement) {
      bloomCv = document.createElement("canvas"); bloomCv.width = 240; bloomCv.height = 135;
      bctx = bloomCv.getContext("2d");
    }
    if (bctx) {
      bctx.clearRect(0, 0, 240, 135);
      bctx.drawImage(cvs, 0, 0, 240, 135);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.17;
      ctx.drawImage(bloomCv, 0, 0, VW, VH);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function zone(px) {
    var tx = px / T;
    if (tx < 58) return 1;         // west caves
    var ty = P.y / T;
    if (ty < 14) return 2;         // sky plateau
    return 0;                      // ruins
  }
  var ZCOL = [
    { bg1: "#171226", bg2: "#241a3d", tile: "#3b2f57", edge: "#6f5aa8", crys: "#3fd0a4", star: "#9a86e8" },
    { bg1: "#120d1c", bg2: "#1d1330", tile: "#332547", edge: "#5c4390", crys: "#b06df0", star: "#7d64c8" },
    { bg1: "#0d1026", bg2: "#1a1f45", tile: "#2e3560", edge: "#5a67b8", crys: "#7ef0e0", star: "#cfd8ff" }
  ];

  function draw() {
    var z = ZCOL[zone(cam.x + VW / 2)];
    // bg gradient
    var gr = ctx.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, z.bg1); gr.addColorStop(1, z.bg2);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);

    // star field
    ctx.save();
    for (var i = 0; i < 70; i++) {
      var sx = ((i * 173 + 51) % 1200) - ((cam.x * 0.1) % 1200);
      var sy = ((i * 97 + 13) % (VH + 40)) - 20;
      if (sx < -10) sx += 1200;
      var tw = 0.5 + 0.5 * Math.sin(state.time * 2 + i);
      ctx.globalAlpha = 0.25 + 0.55 * tw;
      ctx.fillStyle = i % 5 === 0 ? "#fff" : z.star;
      ctx.fillRect(sx, sy, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
    }
    ctx.restore();
    // painted panorama, far parallax
    var zi = zone(cam.x + VW / 2);
    if (bgOk(zi)) { drawBGImage(BGIMG[zi], 0.15, 0.6, 8); drawBGImage(BGIMG[zi], 0.34, 0.25, 46); }
    // mid crystal silhouettes
    ctx.save();
    for (var c2 = 0; c2 < 14; c2++) {
      var cx2 = ((c2 * 331) % 1600) - ((cam.x * 0.45) % 1600);
      if (cx2 < -120) cx2 += 1600;
      var ch = 50 + (c2 * 53) % 110;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = z.edge;
      ctx.beginPath();
      ctx.moveTo(cx2, VH); ctx.lineTo(cx2 + 20, VH - ch); ctx.lineTo(cx2 + 40, VH);
      ctx.fill();
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(state.time * 2 + c2);
      ctx.fillRect(cx2 + 18, VH - ch - 4, 3, 3);
    }
    ctx.restore();

    // camera shake
    var shx = 0, shy = 0;
    if (state.shake > 0) { shx = (Math.random() - 0.5) * state.shake; shy = (Math.random() - 0.5) * state.shake; }
    ctx.save();
    ctx.translate(-Math.round(cam.x) + shx, -Math.round(cam.y) + shy);

    glows.length = 0;
    drawTiles(z);
    drawItems();
    drawBenchesSigns();
    drawEnemies();
    drawBoss();
    drawShots();
    drawPlayer();
    drawParts();
    drawAmb();
    drawGlows();
    ctx.restore();

    postFX();
    vignette();
    if (state.fade > 0) { ctx.fillStyle = "rgba(5,3,10," + state.fade.toFixed(3) + ")"; ctx.fillRect(0, 0, VW, VH); }
    drawHUD();
    drawZoneCard();
    if (state.mapOpen) drawMap();
    if (state.signLines) drawSign();
    drawToasts();
    if (state.paused) overlay("暂停", "P 继续 · M 地图 · N 静音" + (AU.muted ? "(已静音)" : ""));
  }

  var TILES = new Image();
  TILES.src = "assets/tiles.png";
  function tilesOk() { return TILES.complete && TILES.naturalWidth > 0; }

  function drawTiles(z) {
    var x0 = Math.max(0, Math.floor(cam.x / T) - 1), x1 = Math.min(W - 1, Math.ceil((cam.x + VW) / T) + 1);
    var y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.min(H - 1, Math.ceil((cam.y + VH) / T) + 1);
    var glowC = ["rgba(63,208,164,0.55)", "rgba(176,109,240,0.55)", "rgba(126,240,224,0.55)"];
    var useTS = tilesOk();
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      var v = g[ty * W + tx];
      var px = tx * T, py = ty * T;
      var up = ty > 0 ? g[(ty - 1) * W + tx] : 1, dn = ty < H - 1 ? g[(ty + 1) * W + tx] : 1;
      var lf = tx > 0 ? g[ty * W + tx - 1] : 1, rt = tx < W - 1 ? g[ty * W + tx + 1] : 1;
      function air(t) { return t === 0 || t === 2 || t === 4; }
      var zix = tx < 58 ? 1 : (ty < 16 ? 2 : 0);   // halls read as sky-marble
      var hsh = hash2(tx, ty);
      if (v === 1 || v === 3) {
        if (useTS) {
          var by = zix * 40, bx = (hsh % 3) * 40;
          ctx.drawImage(TILES, bx, by, 40, 40, px, py, T, T);
          if (air(up)) {
            var cap = (hsh % 6 === 0) ? 160 : 120;
            ctx.drawImage(TILES, cap, by, 40, 40, px, py, T, T);
            if (zix === 1 && cap === 160) glow(px + 20, py - 6, 48, glowC[1], 0.12 + 0.05 * Math.sin(state.time * 3 + tx));
            if (zix === 2 && hsh % 8 === 0) glow(px + 20, py - 4, 26, "rgba(207,216,255,0.5)", 0.1);
          }
          if (air(lf)) ctx.drawImage(TILES, 200, by, 40, 40, px, py, T, T);
          if (air(rt)) ctx.drawImage(TILES, 240, by, 40, 40, px, py, T, T);
          if (air(dn)) ctx.drawImage(TILES, 280, by, 40, 40, px, py, T, T);
        } else {
          ctx.fillStyle = z.tile; ctx.fillRect(px, py, T, T);
          ctx.fillStyle = z.edge; if (air(up)) ctx.fillRect(px, py, T, 3);
        }
        if (v === 3) { // breakable: cracks + rivets overlay
          ctx.strokeStyle = "#1c1626"; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 6); ctx.lineTo(px + 16, py + 16); ctx.lineTo(px + 10, py + 26);
          ctx.moveTo(px + 26, py + 10); ctx.lineTo(px + 20, py + 22); ctx.lineTo(px + 28, py + 32);
          ctx.stroke();
          ctx.fillStyle = "rgba(254,232,150,0.14)"; ctx.fillRect(px + 2, py + 2, 4, 4); ctx.fillRect(px + T - 6, py + T - 6, 4, 4);
        }
      } else if (v === 2) { // spikes: outlined blades w/ glint + faint tip glow
        ctx.fillStyle = "#241d33"; ctx.fillRect(px, py + T - 5, T, 5);
        for (var s = 0; s < 4; s++) {
          var bxx = px + s * 10;
          ctx.fillStyle = "#241d33";
          ctx.beginPath(); ctx.moveTo(bxx, py + T); ctx.lineTo(bxx + 5, py + 6); ctx.lineTo(bxx + 10, py + T); ctx.fill();
          ctx.fillStyle = "#c9c2dd";
          ctx.beginPath(); ctx.moveTo(bxx + 2, py + T); ctx.lineTo(bxx + 5, py + 9); ctx.lineTo(bxx + 7, py + T); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.fillRect(bxx + 4, py + 8, 2, 2);
        }
        glow(px + 20, py + 8, 26, "rgba(201,194,221,0.35)", 0.08);
      } else if (v === 4) { // one-way slab
        if (useTS) ctx.drawImage(TILES, 320, zix * 40, 40, 40, px, py, T, T);
        else { ctx.fillStyle = z.edge; ctx.fillRect(px, py, T, 6); }
      }
    }
  }

  function drawPlayer() {
    if (P.dead) return;
    var cx = P.x + P.w / 2, feet = P.y + P.h;
    var gty = Math.floor(feet / T), gd = -1;
    for (var gy2 = gty; gy2 < gty + 7; gy2++) if (solidAt(cx, gy2 * T + 2)) { gd = gy2 * T - feet; break; }
    if (gd >= 0) {
      var ks = Math.max(0, 1 - gd / 260);
      if (ks > 0) { ctx.fillStyle = "rgba(0,0,0," + (0.32 * ks).toFixed(3) + ")"; ctx.beginPath(); ctx.ellipse(cx, feet + gd + 3, 9 + 11 * ks, 3 + 2 * ks, 0, 0, 7); ctx.fill(); }
    }
    // frames: 0 idle, 1 blink, 2-5 run, 6 jump, 7 dash, 8 atk1, 9 land,
    // 10 wallslide, 11 hurt, 12 atk2, 13 atk3
    var f;
    if (P.atkT > 0) f = P.combo === 1 ? 12 : P.combo === 2 ? 13 : 8;
    else if (P.inv > 0.35) f = 11;
    else if (P.wallSlide) f = 10;
    else if (P.ground && P.squash > 0.55) f = 9;
    else if (P.anim === "run") f = 2 + (Math.floor(P.animT * 12) % 4);
    else if (P.anim === "jump") f = 6;
    else if (P.anim === "dash") f = 7;
    else f = (P.animT % 3.2 < 0.16) ? 1 : 0;
    var dh = 112, dw = 49;
    var sq = 1 + P.squash * 0.12 - P.stretch * 0.1;
    var sw = 1 - P.squash * 0.1 + P.stretch * 0.08;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(feet));
    if (P.inv > 0 && Math.floor(P.inv * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    var tilt = 0;
    if (P.anim === "run") tilt = Math.sin(P.animT * 24) * 0.03 + 0.05 * P.face;
    if (P.anim === "dash") tilt = 0.18 * P.face;
    if (P.atkT > 0) tilt = 0.08 * P.face;
    ctx.rotate(tilt);
    ctx.scale(P.face * sw, sq);
    if (heroOk()) ctx.drawImage(hero, f * 53, 0, 53, 121, -dw / 2, -dh, dw, dh);
    ctx.restore();
    // attack slash
    if (P.atkT > 0) {
      ctx.save();
      ctx.translate(cx, P.y + P.h * 0.45);
      ctx.scale(P.face, 1);
      ctx.strokeStyle = "rgba(255,255,255," + (P.atkT / 0.2) + ")";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(10, 0, 42, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = "rgba(126,240,224," + (P.atkT / 0.2) * 0.8 + ")";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(10, 0, 50, -1.0, 1.0); ctx.stroke();
      ctx.restore();
    }
  }

  function drawItems() {
    items.forEach(function (it) {
      var bobY = Math.sin(state.time * 3 + it.t) * 5;
      var x = it.x, y = it.y + bobY;
      ctx.save();
      if (it.kind === "ability") {
        glow(x, y, 70, "rgba(254,232,150,0.55)", 0.3);
        ctx.fillStyle = "rgba(254,232,150," + (0.25 + 0.1 * Math.sin(state.time * 5)) + ")";
        ctx.beginPath(); ctx.arc(x, y, 16 + Math.sin(state.time * 5) * 2, 0, 7); ctx.fill();
        ctx.fillStyle = "#fe8";
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        star4(x, y, 7);
      } else if (it.kind === "shard") {
        glow(x, y, 52, "rgba(136,238,255,0.5)", 0.26);
        ctx.fillStyle = "#274055";
        ctx.beginPath();
        ctx.moveTo(x, y - 13); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 13); ctx.lineTo(x - 8, y);
        ctx.fill();
        ctx.fillStyle = "#8ef";
        ctx.beginPath();
        ctx.moveTo(x, y - 11); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 6, y);
        ctx.fill();
        ctx.fillStyle = "#dffaff"; ctx.fillRect(x - 1, y - 5, 2, 7);
      } else if (it.kind === "heart") {
        glow(x, y, 52, "rgba(255,136,170,0.5)", 0.26);
        ctx.fillStyle = "#7c2337";
        heart(x, y, 13);
        ctx.fillStyle = "#f56";
        heart(x, y, 11);
        ctx.fillStyle = "#ffd"; ctx.fillRect(x - 4, y - 5, 3, 3);
      } else if (it.kind === "heal") {
        glow(x, y, 30, "rgba(255,136,170,0.45)", 0.22);
        ctx.fillStyle = "#7c2337"; heart(x, y, 8);
        ctx.fillStyle = "#f56"; heart(x, y, 6);
        ctx.fillStyle = "#ffd"; ctx.fillRect(x - 2, y - 3, 2, 2);
      } else if (it.kind === "finalstar") {
        glow(x, y, 110, "rgba(254,232,150,0.6)", 0.4);
        ctx.fillStyle = "#fe8"; star4(x, y, 20 + Math.sin(state.time * 4) * 3);
        ctx.fillStyle = "#fff"; star4(x, y, 9);
      }
      ctx.restore();
    });
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function panel(x, y, w, h, a) {
    ctx.save();
    ctx.fillStyle = "rgba(12,8,22," + (a || 0.82) + ")"; rr(x, y, w, h, 9); ctx.fill();
    ctx.strokeStyle = "rgba(140,110,220,0.5)"; ctx.lineWidth = 2; rr(x + 1, y + 1, w - 2, h - 2, 8); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1; rr(x + 4, y + 4, w - 8, h - 8, 5); ctx.stroke();
    ctx.restore();
  }
  function star4(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
  function heart(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.8);
    ctx.bezierCurveTo(x - r, y, x - r * 0.7, y - r, x, y - r * 0.3);
    ctx.bezierCurveTo(x + r * 0.7, y - r, x + r, y, x, y + r * 0.8);
    ctx.fill();
  }

  function drawBenchesSigns() {
    world.benches.forEach(function (b) {
      var x = (b.x + 0.5) * T, y = (b.y + 1) * T;
      glow(x, y - 26, 60, "rgba(254,232,150,0.4)", 0.22);
      ctx.fillStyle = "#3d3126";
      ctx.fillRect(x - 19, y - 10, 5, 10); ctx.fillRect(x + 14, y - 10, 5, 10);
      ctx.fillStyle = "#5a4a3a";
      ctx.fillRect(x - 24, y - 16, 48, 4);
      ctx.fillStyle = "#6d5b46";
      ctx.fillRect(x - 24, y - 20, 48, 4);
      ctx.fillStyle = "#7a6a52";
      ctx.fillRect(x - 24, y - 30, 4, 12); ctx.fillRect(x + 20, y - 30, 4, 12);
      ctx.fillRect(x - 24, y - 32, 48, 3);
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(x - 24, y - 32, 48, 1);
      var ly = y - 42 + Math.sin(state.time * 2) * 3;
      ctx.fillStyle = "rgba(254,232,150," + (0.5 + 0.3 * Math.sin(state.time * 2)) + ")";
      star4(x, ly, 7);
      ctx.fillStyle = "#fff"; star4(x, ly, 3);
    });
    world.signs.forEach(function (s) {
      var x = (s.x + 0.5) * T, y = (s.y + 1) * T;
      ctx.fillStyle = "#4a3c2c";
      ctx.fillRect(x - 2, y - 24, 4, 24);
      ctx.fillStyle = "#6a5a44";
      ctx.fillRect(x - 16, y - 38, 32, 16);
      ctx.strokeStyle = "#3a2f24"; ctx.lineWidth = 2;
      ctx.strokeRect(x - 16, y - 38, 32, 16);
      ctx.fillStyle = "#3a2f24"; ctx.fillRect(x - 11, y - 33, 22, 2); ctx.fillRect(x - 11, y - 28, 15, 2);
      ctx.fillStyle = "#8a7a5c"; ctx.fillRect(x - 14, y - 36, 2, 2); ctx.fillRect(x + 12, y - 36, 2, 2);
    });
  }

  function drawEnemies() {
    enemies.forEach(function (e) {
      if (e.dead) return;
      ctx.save();
      if (e.hurtT > 0) ctx.globalAlpha = 0.6;
      if (e.kind === "slime") {
        var sq2 = 1 + Math.sin(e.t * 6) * 0.12;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 1, 16, 4, 0, 0, 7); ctx.fill();   // shadow
        ctx.fillStyle = "#101810";
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 12 * sq2, 20, 15 * sq2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = e.hurtT > 0 ? "#e8ffe0" : "#3f7a37";
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 12 * sq2, 18, 13 * sq2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = e.hurtT > 0 ? "#fff" : "#7ec86f";
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 13 * sq2, 15, 10 * sq2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.ellipse(e.x - 5, e.y - 17 * sq2, 5, 3, -0.4, 0, 7); ctx.fill();
        var ex = e.face > 0 ? 4 : -9;
        ctx.fillStyle = "#fff"; ctx.fillRect(e.x + ex, e.y - 16, 5, 6); ctx.fillRect(e.x + ex + 7, e.y - 16, 5, 6);
        ctx.fillStyle = "#1c2f1a"; ctx.fillRect(e.x + ex + (e.face > 0 ? 2 : 0), e.y - 14, 3, 4); ctx.fillRect(e.x + ex + 7 + (e.face > 0 ? 2 : 0), e.y - 14, 3, 4);
      } else {
        var wf = Math.sin(e.t * 16);
        ctx.fillStyle = "#5b3a86";
        // wings: two-segment membrane
        ctx.beginPath(); ctx.moveTo(e.x - 7, e.y - 11); ctx.lineTo(e.x - 16, e.y - 16 - wf * 7); ctx.lineTo(e.x - 22, e.y - 8 - wf * 9); ctx.lineTo(e.x - 8, e.y - 5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.x + 7, e.y - 11); ctx.lineTo(e.x + 16, e.y - 16 - wf * 7); ctx.lineTo(e.x + 22, e.y - 8 - wf * 9); ctx.lineTo(e.x + 8, e.y - 5); ctx.fill();
        ctx.fillStyle = "#8a63d2";
        ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 11); ctx.lineTo(e.x - 13, e.y - 14 - wf * 6); ctx.lineTo(e.x - 7, e.y - 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.x + 6, e.y - 11); ctx.lineTo(e.x + 13, e.y - 14 - wf * 6); ctx.lineTo(e.x + 7, e.y - 6); ctx.fill();
        // ears + body
        ctx.fillStyle = "#b08ae8";
        ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 15); ctx.lineTo(e.x - 4, e.y - 22); ctx.lineTo(e.x - 1, e.y - 15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.x + 6, e.y - 15); ctx.lineTo(e.x + 4, e.y - 22); ctx.lineTo(e.x + 1, e.y - 15); ctx.fill();
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 10, 9, 8, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.ellipse(e.x - 3, e.y - 13, 3, 2, -0.4, 0, 7); ctx.fill();
        ctx.fillStyle = "#fdd"; ctx.fillRect(e.x - 3, e.y - 5, 2, 3); ctx.fillRect(e.x + 2, e.y - 5, 2, 3);  // fangs
        ctx.fillStyle = "#f33"; ctx.fillRect(e.x - 5, e.y - 13, 3, 3); ctx.fillRect(e.x + 2, e.y - 13, 3, 3);
        ctx.fillStyle = "#fff"; ctx.fillRect(e.x - 5, e.y - 13, 1, 1); ctx.fillRect(e.x + 2, e.y - 13, 1, 1);
        glow(e.x - 4, e.y - 12, 9, "rgba(255,80,80,0.6)", 0.2);
        glow(e.x + 3, e.y - 12, 9, "rgba(255,80,80,0.6)", 0.2);
      }
      ctx.restore();
    });
  }

  function drawBoss() {
    if (!boss || boss.dead) return;
    glow(boss.x, boss.y, 95, "rgba(200,109,240,0.5)", 0.3);
    if (boss.hp < boss.maxhp / 2 && boss.st !== "sleep") {   // phase-2 burning aura
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,120,220," + (0.25 + 0.15 * Math.sin(state.time * 6)) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(boss.x, boss.y - 6, 44 + Math.sin(state.time * 5) * 4, state.time * 2, state.time * 2 + 4.5); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    var fl = Math.sin(state.time * 5) * 4;
    ctx.translate(boss.x, boss.y + fl * 0.3);
    if (boss.st === "dashT" && Math.floor(state.time * 14) % 2 === 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3;   // telegraph flash
      ctx.beginPath(); ctx.arc(0, -6, 40, 0, 7); ctx.stroke();
    }
    // outer cloak
    ctx.fillStyle = boss.hurtT > 0 ? "#fff" : "#2a1740";
    ctx.beginPath();
    ctx.arc(0, -8, 33, Math.PI, 0);
    ctx.lineTo(33, 14);
    for (var i = 3; i >= -3; i--) ctx.lineTo(i * 11, 14 + (i % 2 === 0 ? 14 : 4) + Math.sin(state.time * 6 + i) * 3);
    ctx.lineTo(-33, 14);
    ctx.fill();
    // inner body
    ctx.fillStyle = boss.hurtT > 0 ? "#fff" : "#4a2a66";
    ctx.beginPath();
    ctx.arc(0, -8, 27, Math.PI, 0);
    ctx.lineTo(27, 12);
    for (var j = 2; j >= -2; j--) ctx.lineTo(j * 11, 12 + (j % 2 === 0 ? 10 : 2));
    ctx.lineTo(-27, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(176,109,240,0.35)";
    ctx.beginPath(); ctx.arc(-8, -16, 14, 0, 7); ctx.fill();   // rim sheen
    // rotating star core
    ctx.save();
    ctx.translate(0, -10);
    ctx.rotate(state.time * 1.5);
    ctx.fillStyle = "#fe8"; star4(0, 0, 11);
    ctx.fillStyle = "#fff"; star4(0, 0, 5);
    ctx.restore();
    // angry eyes
    var eo = boss.face > 0 ? 3 : -3;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(-16 + eo, -26); ctx.lineTo(-6 + eo, -22); ctx.lineTo(-14 + eo, -16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16 + eo, -26); ctx.lineTo(6 + eo, -22); ctx.lineTo(14 + eo, -16); ctx.fill();
    ctx.fillStyle = "#c86df0";
    ctx.fillRect(-12 + eo, -22, 3, 3); ctx.fillRect(9 + eo, -22, 3, 3);
    ctx.restore();
    // hp bar
    if (boss.st !== "sleep") {
      var bw = 340, bx = VW / 2 - bw / 2, byy = 26;
      ctx.fillStyle = "rgba(8,5,16,0.75)"; rr(bx - 6, byy - 6, bw + 12, 20, 6); ctx.fill();
      ctx.strokeStyle = "rgba(200,109,240,0.6)"; ctx.lineWidth = 1.5; rr(bx - 6, byy - 6, bw + 12, 20, 6); ctx.stroke();
      ctx.fillStyle = "rgba(200,109,240,0.25)"; ctx.fillRect(bx, byy, bw, 8);
      var fr = Math.max(0, boss.hp / boss.maxhp);
      var grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grd.addColorStop(0, "#8a3df0"); grd.addColorStop(1, "#f06ad0");
      ctx.fillStyle = grd; ctx.fillRect(bx, byy, bw * fr, 8);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(bx, byy, bw * fr, 2);
      ctx.fillStyle = "#c86df0";
      ctx.save(); ctx.translate(bx - 12, byy + 4); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
      ctx.save(); ctx.translate(bx + bw + 12, byy + 4); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
      ctx.fillStyle = "#f0e6ff"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
      ctx.fillText("蚀 星 者", VW / 2, byy - 10);
    }
  }

  function drawShots() {
    shots.forEach(function (s) {
      glow(s.x, s.y, 30, "rgba(255,136,255,0.5)", 0.3);
      ctx.strokeStyle = "rgba(255,136,255,0.4)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s.x - s.vx * 0.06, s.y - s.vy * 0.06); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = "#f8f";
      star4(s.x, s.y, 7);
      ctx.fillStyle = "#fff"; star4(s.x, s.y, 3);
    });
  }
  function drawAmb() {
    for (var i = 0; i < amb.length; i++) {
      var a = amb[i];
      ctx.globalAlpha = a.a * (0.5 + 0.5 * Math.sin(state.time * 2 + a.p));
      ctx.fillStyle = a.c;
      ctx.fillRect(a.x, a.y, a.r, a.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawParts() {
    parts.forEach(function (p) {
      var a = Math.max(0, p.t / p.life);
      if (p.ghost) {
        ctx.globalAlpha = a * 0.4;
        if (heroOk()) ctx.drawImage(hero, 7 * 53, 0, 53, 121, p.x - 24, p.y - 56, 49, 112);
        ctx.globalAlpha = 1;
      } else if (p.wisp) {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + a), 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.35 * a + 1, 0, 7); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;
      } else if (p.ring) {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
        ctx.strokeStyle = p.c; ctx.lineWidth = 1 + 4 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, (1 - a) * p.r + 8, 0, 7); ctx.stroke();
        ctx.restore(); ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
        ctx.globalAlpha = 1;
      }
    });
  }

  function drawHUD() {
    var pw = 46 + save.maxhp * 24;
    panel(12, 10, pw, 66);
    for (var i = 0; i < save.maxhp; i++) {
      var x = 30 + i * 24, y = 30;
      if (i < P.hp) {
        ctx.fillStyle = "#3a0d18"; heart(x, y, 11);
        ctx.fillStyle = "#f56"; heart(x, y, 9);
        ctx.fillStyle = "#ff8fa0"; heart(x - 1, y - 1, 5);
        ctx.fillStyle = "#ffd9e0"; ctx.fillRect(x - 4, y - 5, 3, 3);
      } else {
        ctx.strokeStyle = "rgba(255,120,150,0.35)"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.bezierCurveTo(x - 9, y, x - 7, y - 9, x, y - 3);
        ctx.bezierCurveTo(x + 7, y - 9, x + 9, y, x, y + 8);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#8ef"; star4(30, 58, 7);
    ctx.fillStyle = "#fff"; star4(30, 58, 3);
    ctx.fillStyle = "#dfeaff"; ctx.font = "bold 13px monospace"; ctx.textAlign = "left";
    ctx.fillText(bitCount(save.shards) + " / 7", 42, 62);
    var axx = 96;
    [["dash", "冲", "#9cf"], ["walljump", "壁", "#fc9"], ["doublejump", "星", "#7ef"]].forEach(function (a) {
      var on = save.ab[a[0]];
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.3;
      ctx.fillStyle = "rgba(10,8,18,0.9)";
      ctx.beginPath(); ctx.arc(axx, 58, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = a[2]; ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath(); ctx.arc(axx, 58, 10, 0, 7); ctx.stroke();
      if (on) glow(axx, 58, 16, "rgba(255,255,255,0.4)", 0.2);
      ctx.fillStyle = a[2]; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
      ctx.fillText(a[1], axx, 62);
      ctx.restore();
      axx += 26;
    });
    if (state.time < 25) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, 25 - state.time) * 0.75;
      panel(12, VH - 34, 306, 24, 0.6);
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "12px monospace"; ctx.textAlign = "left";
      ctx.fillText("←→/AD 移动 · Z/空格 跳 · X 攻击 · C 冲刺 · M 图", 22, VH - 18);
      ctx.restore();
    }
  }

  function drawZoneCard() {
    if (zoneT <= 0 || state.mode !== "play") return;
    var a = Math.max(0, Math.min(1, Math.min(zoneT / 0.5, (2.6 - zoneT) / 0.4)));
    var n = ZNAMES[zone(P.x + P.w / 2)];
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(8,5,16,0.5)";
    ctx.fillRect(VW / 2 - 200, 116, 400, 58);
    ctx.fillStyle = "rgba(200,170,255,0.8)";
    ctx.fillRect(VW / 2 - 200, 116, 400, 1); ctx.fillRect(VW / 2 - 200, 173, 400, 1);
    ctx.fillStyle = "#efe8ff"; ctx.font = "bold 27px monospace";
    ctx.fillText(n, VW / 2, 152);
    ctx.fillStyle = "#9a86e8"; star4(VW / 2 - 178, 145, 5); star4(VW / 2 + 178, 145, 5);
    ctx.restore();
  }

  function drawMap() {
    ctx.fillStyle = "rgba(6,4,12,0.93)"; ctx.fillRect(0, 0, VW, VH);
    panel(VW / 2 - 320, 30, 640, VH - 70, 0.9);
    ctx.fillStyle = "#efe8ff"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
    ctx.fillText("— 星 图 —", VW / 2, 66);
    ctx.fillStyle = "rgba(200,170,255,0.5)"; ctx.fillRect(VW / 2 - 90, 76, 180, 1);
    var cs = 7, ox = VW / 2 - (W / 4) * cs / 2, oy = 96;
    for (var key in visited) {
      var p = key.split(","), vx = +p[0], vy = +p[1];
      var zc = vx < 58 / 4 ? "#7a4fc0" : (vy < 16 / 4 ? "#5a67b8" : "#6f5aa8");
      ctx.fillStyle = zc; ctx.globalAlpha = 0.75;
      ctx.fillRect(ox + vx * cs, oy + vy * cs, cs - 1, cs - 1);
      ctx.globalAlpha = 1;
    }
    world.benches.forEach(function (b) {
      ctx.fillStyle = "#fe9";
      ctx.fillRect(ox + (b.x / 4) * cs - 1, oy + (b.y / 4) * cs - 1, 4, 4);
    });
    if (!save.boss) {
      ctx.fillStyle = "#f6f";
      ctx.save(); ctx.translate(ox + (world.boss.x / 4) * cs + 1, oy + (world.boss.y / 4) * cs + 1);
      ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
    if (Math.floor(state.time * 3) % 2 === 0) ctx.fillStyle = "#fff";
    else ctx.fillStyle = "#9cf";
    ctx.fillRect(ox + (P.x / T / 4) * cs - 1, oy + (P.y / T / 4) * cs - 1, 4, 4);
    ctx.font = "12px monospace"; ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("白点=你 · 黄=长椅 · 紫菱=蚀星者 · M 关闭", VW / 2, VH - 56);
  }

  function drawSign() {
    var n = state.signLines.length;
    var h = 40 + n * 24;
    panel(VW / 2 - 230, VH - 40 - h, 460, h, 0.92);
    ctx.fillStyle = "#fe8"; ctx.fillRect(VW / 2 - 230, VH - 40 - h, 4, h);
    ctx.textAlign = "center";
    state.signLines.forEach(function (l, i) {
      ctx.fillStyle = i === 0 ? "#fff" : "rgba(255,255,255,0.75)";
      ctx.font = i === 0 ? "bold 15px monospace" : "14px monospace";
      ctx.fillText(l, VW / 2, VH - 16 - h + 26 + i * 24);
    });
  }

  function drawToasts() {
    toasts.forEach(function (t, i) {
      var inT = Math.min(1, t.t * 5), outT = Math.max(0, (t.t - 2.4) / 0.6);
      var a = Math.max(0, inT * (1 - outT));
      var slide = (1 - inT) * -26;
      ctx.save();
      ctx.globalAlpha = a;
      var w1 = 400, y = 108 + i * 70 + slide;
      ctx.fillStyle = "rgba(16,11,28,0.92)";
      ctx.fillRect(VW / 2 - w1 / 2, y, w1, 58);
      ctx.strokeStyle = "#6f5aa8"; ctx.lineWidth = 2;
      ctx.strokeRect(VW / 2 - w1 / 2, y, w1, 58);
      ctx.fillStyle = "#fe8"; ctx.fillRect(VW / 2 - w1 / 2, y, 5, 58);
      ctx.fillStyle = "#8ef"; star4(VW / 2 - w1 / 2 + 26, y + 29, 8);
      ctx.fillStyle = "#fe8"; ctx.font = "bold 16px monospace"; ctx.textAlign = "left";
      ctx.fillText(t.txt, VW / 2 - w1 / 2 + 44, y + 25);
      ctx.fillStyle = "#bbb"; ctx.font = "12px monospace";
      ctx.fillText(t.sub, VW / 2 - w1 / 2 + 44, y + 45);
      ctx.restore();
    });
  }

  function overlay(title, sub) {
    ctx.fillStyle = "rgba(6,4,12,0.78)"; ctx.fillRect(0, 0, VW, VH);
    panel(VW / 2 - 240, VH / 2 - 70, 480, 140, 0.95);
    ctx.fillStyle = "#efe8ff"; ctx.font = "bold 34px monospace"; ctx.textAlign = "center";
    ctx.fillText(title, VW / 2, VH / 2 - 10);
    ctx.font = "14px monospace"; ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(sub, VW / 2, VH / 2 + 30);
    ctx.fillStyle = "#9a86e8"; star4(VW / 2 - 200, VH / 2 - 20, 6); star4(VW / 2 + 200, VH / 2 - 20, 6);
  }

  function drawTitle() {
    var t = state.titleT;
    ctx.fillStyle = "#070512"; ctx.fillRect(0, 0, VW, VH);
    if (bgOk(2)) drawBGImage(BGIMG[2], 0.03, 0.9, 0);
    for (var i = 0; i < 110; i++) {
      var sx = (i * 173 + 51) % VW, sy = (i * 97 + 13) % (VH * 0.75);
      ctx.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
      ctx.fillStyle = i % 5 === 0 ? "#fff" : i % 3 ? "#9a86e8" : "#7ef0e0";
      ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    glows.length = 0;
    glow(VW / 2, 150, 260, "rgba(126,240,224,0.3)", 0.4);
    glow(VW / 2, 150, 120, "rgba(154,134,232,0.5)", 0.35);
    drawGlows();
    ctx.textAlign = "center";
    // logo
    ctx.save();
    ctx.shadowColor = "#7ef0e0"; ctx.shadowBlur = 26;
    ctx.fillStyle = "#f4f0ff"; ctx.font = "bold 64px monospace";
    ctx.fillText("也 许 之 星", VW / 2, 158);
    ctx.restore();
    ctx.fillStyle = "#7ef0e0"; ctx.font = "bold 17px monospace";
    ctx.fillText("M A B Y E   S T A R", VW / 2, 190);
    ctx.fillStyle = "rgba(200,170,255,0.7)";
    ctx.fillRect(VW / 2 - 190, 204, 150, 1); ctx.fillRect(VW / 2 + 40, 204, 150, 1);
    ctx.fillStyle = "#9a86e8"; star4(VW / 2, 204, 5);
    ctx.fillStyle = "#b9a6f2"; ctx.font = "14px monospace";
    ctx.fillText("银 河 恶 魔 城 · 收集星星碎片 · 登上北方天台", VW / 2, 228);
    // heroine on a lit stage
    var sc = 2.6, dh = 121 * sc;
    var f = (t % 3.2 < 0.16) ? 1 : 0;
    var hop = Math.abs(Math.sin(t * 1.6)) * -4;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); ctx.ellipse(VW / 2, 476, 52, 8, 0, 0, 7); ctx.fill();
    if (heroOk()) ctx.drawImage(hero, f * 53, 0, 53, 121, VW / 2 - 26 * sc, 474 - dh + hop, 53 * sc, dh);
    glow(VW / 2, 420, 90, "rgba(154,134,232,0.4)", 0.25);
    // prompt
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 4);
    ctx.fillStyle = "#fff"; ctx.font = "bold 17px monospace";
    ctx.fillText(save.time > 0 ? "按 Z / 空格 继续旅程" : "按 Z / 空格 开始旅程", VW / 2, 502);
    ctx.globalAlpha = 1;
    panel(VW / 2 - 260, 512, 520, 24, 0.6);
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "12px monospace";
    ctx.fillText("←→ 移动 · Z/空格 跳 · X 攻击 · C/Shift 冲刺 · M 地图 · P 暂停", VW / 2, 528);
    vignette();
  }

  function drawEnd() {
    ctx.fillStyle = "rgba(8,6,14," + Math.min(0.85, state.endT * 0.5) + ")";
    ctx.fillRect(0, 0, VW, VH);
    if (state.endT < 1) return;
    ctx.textAlign = "center";
    ctx.save(); ctx.shadowColor = "#fe8"; ctx.shadowBlur = 30;
    ctx.fillStyle = "#fe8"; star4(VW / 2, 140, 40 + Math.sin(state.endT * 3) * 4);
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.font = "bold 30px monospace";
    ctx.fillText("星星回到了夜空", VW / 2, 230);
    ctx.font = "15px monospace"; ctx.fillStyle = "#ccc";
    ctx.fillText("碎片收集 " + bitCount(save.shards) + " / 7 · 用时 " + Math.floor(state.time / 60) + " 分 " + Math.floor(state.time % 60) + " 秒", VW / 2, 268);
    var sc = 1.8, dh = 121 * sc;
    if (heroOk()) ctx.drawImage(hero, 0, 0, 53, 121, VW / 2 - 26 * sc, 460 - dh, 53 * sc, dh);
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "13px monospace";
    ctx.fillText("按 Z 回到长椅继续探索", VW / 2, 500);
  }

  // ---------------- main loop ----------------
  var last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    if (state.hitstop > 0) { state.hitstop -= dt; pressed = {}; return; }
    state.shake = Math.max(0, state.shake - dt * 30);
    state.fade = Math.max(0, state.fade - dt * 1.6);

    if (state.mode === "title") {
      state.titleT += dt;
      drawTitle();
      if (hit("jump")) { state.mode = "play"; respawn(); }
      pressed = {};
      return;
    }
    if (state.mode === "end") {
      state.endT += dt;
      draw();
      drawEnd();
      if (hit("jump") && state.endT > 1.5) { state.mode = "play"; }
      pressed = {};
      return;
    }

    if (hit("pause")) state.paused = !state.paused;
    if (hit("map")) state.mapOpen = !state.mapOpen;
    if (hit("mute")) { AU.muted = !AU.muted; toast(AU.muted ? "静音" : "声音开", ""); }
    if (state.paused || state.mapOpen) { draw(); pressed = {}; return; }

    var zc = zone(P.x + P.w / 2);
    if (zc !== lastZone) { lastZone = zc; zoneT = 2.6; }
    zoneT -= dt;
    updatePlayer(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateShots(dt);
    parts = parts.filter(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.wisp) p.vy -= 60 * dt; else if (!p.ring && !p.ghost) p.vy += 300 * dt; return p.t > 0; });
    // ambient motes
    var zAmb = zone(P.x + P.w / 2);
    var arena = P.x > 104 * T && P.y < 14 * T;
    if (amb.length < 56 && Math.random() < dt * 12) {
      var axx = cam.x + Math.random() * VW, ayy = cam.y + Math.random() * VH, am;
      if (arena) am = { x: axx, y: cam.y + VH + 6, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 70, r: Math.random() < 0.4 ? 2 : 1, a: 0.5, p: Math.random() * 7, c: Math.random() < 0.5 ? "#fb6" : "#f8f" };
      else if (zAmb === 0) am = { x: axx, y: ayy, vx: 12 + Math.random() * 16, vy: 6 + Math.random() * 8, r: Math.random() < 0.25 ? 2 : 1, a: 0.3, p: Math.random() * 7, c: Math.random() < 0.2 ? "#ffb6d5" : "#ffe9c9" };
      else if (zAmb === 1) am = { x: axx, y: ayy, vx: (Math.random() - 0.5) * 14, vy: -10 - Math.random() * 14, r: Math.random() < 0.35 ? 2 : 1, a: 0.35, p: Math.random() * 7, c: Math.random() < 0.5 ? "#7ef0e0" : "#b06df0" };
      else am = { x: axx, y: ayy, vx: -20 - Math.random() * 26, vy: 10 + Math.random() * 14, r: Math.random() < 0.3 ? 2 : 1, a: 0.4, p: Math.random() * 7, c: "#eef2ff" };
      amb.push(am);
    }
    amb = amb.filter(function (a) {
      a.x += a.vx * dt; a.y += a.vy * dt;
      return a.x > cam.x - 20 && a.x < cam.x + VW + 20 && a.y > cam.y - 20 && a.y < cam.y + VH + 20;
    });
    toasts = toasts.filter(function (t) { t.t += dt; return t.t < 3; });

    // final star pickup -> ending (consume the star so it cannot retrigger)
    var star = null;
    items.forEach(function (it) {
      if (it.kind === "finalstar") {
        var dx = P.x + P.w / 2 - it.x, dy = P.y + P.h / 2 - it.y;
        if (dx * dx + dy * dy < 60 * 60) star = it;
      }
    });
    if (star) {
      items = items.filter(function (i) { return i !== star; });
      state.mode = "end"; state.endT = 0; sfx("save");
    }

    // camera w/ facing lookahead, slight vertical bias
    var tx = P.x + P.w / 2 + P.face * 70 - VW / 2, ty = P.y + P.h / 2 - VH * 0.55;
    cam.x += (tx - cam.x) * Math.min(1, dt * 5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 7);
    cam.x = Math.max(0, Math.min(W * T - VW, cam.x));
    cam.y = Math.max(0, Math.min(H * T - VH, cam.y));

    draw();
    pressed = {};
  }

  buildItems();
  respawn();
  cam.x = P.x - VW / 2; cam.y = P.y - VH / 2;
  // debug / test hook
  window.__MS = {
    P: P, world: world, g: g, state: state, save: save, T: T,
    get boss() { return boss; }, get items() { return items; }, get enemies() { return enemies; },
    get pressed() { return pressed; },
    respawn: respawn, buildItems: buildItems
  };
  requestAnimationFrame(loop);
})();
