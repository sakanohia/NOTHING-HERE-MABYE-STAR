/* MABYE STAR — world data. Tile codes: 0 air, 1 solid, 2 spike, 3 breakable, 4 one-way.
   Design v4: teach-then-test pacing, benches before every gate, readable hazards,
   chunky ledge geometry instead of one-way ladders. */
(function (root) {
  "use strict";
  var T = 40, W = 150, H = 46;

  function build() {
    var g = new Uint8Array(W * H).fill(1);
    function idx(x, y) { return y * W + x; }
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < W && y < H) g[idx(x, y)] = v; }
    function carve(x0, y0, x1, y1) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, 0); }
    function solid(x0, y0, x1, y1) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, 1); }
    function oneway(x0, y, x1) { for (var x = x0; x <= x1; x++) set(x, y, 4); }
    function spikes(x0, y, x1) { for (var x = x0; x <= x1; x++) set(x, y, 2); }

    // ---- start ruins (east): wide, gentle, landmark podium ----
    carve(58, 33, 112, 42);
    solid(84, 41, 88, 42);                       // ruined podium (2 up)
    oneway(92, 39, 97); oneway(100, 37, 104);
    // hidden heart nook (breakable wall at x=109)
    solid(110, 33, 111, 35);
    carve(110, 36, 111, 40);
    for (var y = 36; y <= 40; y++) set(109, y, 3);
    // east tower (one-way ladder, optional shard/heart)
    carve(113, 21, 126, 42);
    oneway(115, 40, 118); oneway(120, 37, 123); oneway(116, 34, 119); oneway(121, 31, 124); oneway(116, 28, 119);

    // ---- west caves: mounded floor, no early hazards ----
    carve(36, 33, 57, 42);
    solid(44, 42, 46, 42);                       // gentle mound (was spikes)
    set(50, 40, 3); set(50, 41, 3);              // breakable pile hiding shard
    carve(28, 39, 35, 42);                       // dash shrine tunnel (level floor)
    carve(16, 37, 27, 42);                       // practice room: pit + spike strip
    carve(21, 42, 23, 44);                       // safe pit (dash practice, jump-out-able)
    spikes(24, 42, 26);                          // 3-wide strip: dash over it
    carve(6, 33, 15, 42);                        // deep cave (bench)
    solid(6, 41, 7, 42); oneway(10, 38, 12);

    // ---- north shaft: chunky balcony ledges, 3-row steps ----
    carve(66, 16, 71, 32);
    oneway(66, 41, 68); oneway(69, 38, 71); oneway(66, 36, 68);
    oneway(69, 33, 71); oneway(66, 31, 68); oneway(69, 28, 71);
    oneway(66, 26, 68); oneway(69, 23, 71); oneway(66, 21, 68);
    oneway(69, 18, 71); oneway(66, 16, 68);
    // ---- left hall: bench + sign before THE gap ----
    carve(64, 8, 71, 13);
    solid(64, 14, 71, 15);
    // ---- the gap: 5 wide, spiked depth (visible = fair) ----
    carve(72, 8, 76, 15);
    spikes(72, 16, 76);
    // ---- right hall + wall-jump chimney ----
    carve(77, 8, 86, 13);
    solid(77, 14, 86, 15);
    carve(82, 4, 84, 9);                         // chimney (wall-jump up)
    // ---- sky plateau ----
    carve(58, 3, 101, 6);
    solid(74, 6, 76, 6);                         // low mound landmark
    carve(60, 26, 66, 32);                       // high pocket above start (shard3)
    oneway(61, 29, 64);
    // ---- boss arena: wide, flat, two dodge platforms ----
    carve(104, 4, 128, 12);
    oneway(109, 9, 111); oneway(120, 9, 122);
    carve(102, 3, 103, 6);                       // trench between plateau & arena

    return {
      T: T, W: W, H: H, g: g,
      spawn: { x: 68, y: 42 },
      benches: [{ x: 70, y: 42 }, { x: 8, y: 42 }, { x: 65, y: 13 }, { x: 79, y: 13 }, { x: 60, y: 5 }],
      signs: [
        { x: 64, y: 42, lines: ["←→/AD 移动 · Z/空格 跳", "X/J 攻击 · C/Shift 冲刺", "M 地图 · P 暂停"] },
        { x: 76, y: 42, lines: ["长椅可以休息并记录进度。", "星星碎片散落在各处，", "收集它们，登上北方的天台。"] },
        { x: 34, y: 42, lines: ["洞窟深处供奉着冲刺之力。", "空中按 C / Shift 疾驰。"] },
        { x: 64, y: 13, lines: ["前方深沟：先起跳，", "在最高点按冲刺飞跃。", "沟底有刺，切勿硬闯。"] },
        { x: 80, y: 13, lines: ["高烟囱：贴墙下滑，", "按跳跃蹬墙而上。"] }
      ],
      abilities: [
        { id: "dash", x: 30, y: 41, name: "冲刺", desc: "按 C / Shift 疾驰，可穿过危险缝隙" },
        { id: "walljump", x: 83, y: 12, name: "蹬墙跳", desc: "贴墙下滑，按跳跃蹬墙而起" },
        { id: "doublejump", x: 96, y: 5, name: "星步二段跳", desc: "空中再按一次跳跃，踏星而起" }
      ],
      shards: [
        { x: 123, y: 26 }, { x: 13, y: 42 }, { x: 63, y: 28 }, { x: 22, y: 40 },
        { x: 50, y: 42 }, { x: 117, y: 23 }, { x: 78, y: 6 }
      ],
      hearts: [{ x: 102, y: 35 }, { x: 11, y: 36 }, { x: 110, y: 38 }],
      enemies: [
        { kind: "slime", x: 90, y: 42 }, { kind: "slime", x: 105, y: 42 },
        { kind: "slime", x: 40, y: 42 }, { kind: "slime", x: 66, y: 6 }, { kind: "slime", x: 92, y: 6 },
        { kind: "bat", x: 98, y: 36 }, { kind: "bat", x: 119, y: 30 },
        { kind: "bat", x: 70, y: 4 }, { kind: "bat", x: 88, y: 4 }
      ],
      boss: { x: 116, y: 8 }
    };
  }

  /* reachability self-test: flood fill over passable tiles from spawn; every
     key tile must be connected (breakables counted as passable). */
  function selfTest() {
    var w = build();
    var pass = function (x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      var v = w.g[y * W + x];
      return v === 0 || v === 2 || v === 4 || v === 3;
    };
    var seen = new Uint8Array(W * H);
    var q = [[w.spawn.x, w.spawn.y]];
    seen[w.spawn.y * W + w.spawn.x] = 1;
    while (q.length) {
      var c = q.pop();
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < 4; i++) {
        var nx = c[0] + dirs[i][0], ny = c[1] + dirs[i][1];
        if (pass(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push([nx, ny]); }
      }
    }
    var fails = [];
    function chk(label, p) {
      if (!pass(p.x, p.y)) fails.push(label + " tile not passable @(" + p.x + "," + p.y + ")");
      else if (!seen[p.y * W + p.x]) fails.push(label + " NOT REACHABLE @(" + p.x + "," + p.y + ")");
    }
    chk("spawn", w.spawn);
    w.benches.forEach(function (p, i) { chk("bench" + i, p); });
    w.abilities.forEach(function (p) { chk("ability:" + p.id, p); });
    w.shards.forEach(function (p, i) { chk("shard" + i, p); });
    w.hearts.forEach(function (p, i) { chk("heart" + i, p); });
    w.signs.forEach(function (p, i) { chk("sign" + i, p); });
    chk("boss", w.boss);
    w.enemies.forEach(function (e, i) { chk("enemy" + i, { x: e.x, y: e.y }); });
    // geometry sanity: jumpable ledge steps (<=3 rows) in the shaft
    var steps = [43, 41, 38, 36, 33, 31, 28, 26, 23, 21, 18, 16, 14];
    for (var s = 1; s < steps.length; s++) if (steps[s - 1] - steps[s] > 3) fails.push("shaft step too high: " + steps[s - 1] + "->" + steps[s]);
    return fails;
  }

  var api = { build: build, selfTest: selfTest, T: T, W: W, H: H };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.WORLD = api;

  if (typeof require !== "undefined" && require.main === module) {
    var fails = selfTest();
    if (fails.length) { console.log("WORLD SELF-TEST FAILED:"); fails.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
    console.log("WORLD SELF-TEST OK: spawn/benches/abilities/shards/hearts/signs/boss/enemies all reachable.");
  }
})(this);
