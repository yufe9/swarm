// 캔버스 렌더링. 모든 그림은 도형으로 직접 그립니다(이미지 에셋 없음).

var Render = {
  // 3D 렌더러(render3d.js)와 **같은 세 함수**만 맞추면 서로 갈아끼워집니다.
  //   draw(g) · resize(w, h, dpr) · screenToWorld(g, sx, sy)
  // main.js 는 이 셋만 호출하므로 게임 로직은 렌더러를 전혀 모릅니다.
  is3D: false,

  resize: function () { /* 2D 는 main.js 가 캔버스 크기를 직접 잡습니다 */ },

  // 화면 좌표 → 월드 좌표. 2D 는 카메라 축척의 역수면 끝입니다.
  screenToWorld: function (g, sx, sy) {
    return {
      x: g.cam.x + (sx - g.vw / 2) / CAM_ZOOM,
      y: g.cam.y + (sy - g.vh / 2) / CAM_ZOOM
    };
  },

  draw: function (g) {
    var ctx = g.ctx, p = g.p;
    var w = g.vw, h = g.vh;

    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!p) { this.drawVoid(g, ctx, w, h); return; }

    var sx = 0, sy = 0;
    if (g.cam.shake > 0) {
      sx = U.rand(-g.cam.shake, g.cam.shake);
      sy = U.rand(-g.cam.shake, g.cam.shake);
    }
    // 월드 좌표는 리그 오브 레전드 단위입니다. CAM_ZOOM 으로 축소해 원작과 비슷한 시야를 냅니다.
    // 3D 로 옮길 때는 이 변환이 곧 카메라 행렬이 됩니다 — 여기 한 곳만 바꾸면 됩니다.
    var Z = CAM_ZOOM;
    var hw = w / 2 / Z, hh = h / 2 / Z;
    var ox = w / 2 - g.cam.x * Z + sx;
    var oy = h / 2 - g.cam.y * Z + sy;

    this.drawFloor(g, ctx, ox, oy, w, h, Z);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(Z, Z);

    var view = { x0: g.cam.x - hw - 200, y0: g.cam.y - hh - 200, x1: g.cam.x + hw + 200, y1: g.cam.y + hh + 200 };
    var vis = function (x, y, r) { return x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1; };

    this.drawGimmicks(g, ctx, vis);
    this.drawZones(g, ctx, vis);
    this.drawObstacles(g, ctx, vis);
    this.drawFeathers(g, ctx, vis);
    this.drawTentacles(g, ctx, vis);
    this.drawMines(g, ctx, vis);
    this.drawPickups(g, ctx, vis);
    this.drawShop(g, ctx);
    this.drawFxBelow(g, ctx, vis);
    this.drawEnemies(g, ctx, vis);
    this.drawEnemyBullets(g, ctx, vis);
    this.drawBullets(g, ctx, vis);
    this.drawPlayer(g, ctx);
    this.drawWindwalls(g, ctx);
    this.drawBeams(g, ctx);
    this.drawFxAbove(g, ctx, vis);
    this.drawTexts(g, ctx, vis);

    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (g.flash * 0.9) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    if (p.hitFlash > 0) {
      var a = p.hitFlash * 0.7;
      var grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.62);
      grd.addColorStop(0, 'rgba(255,40,70,0)');
      grd.addColorStop(1, 'rgba(255,40,70,' + a + ')');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
    if (g.announceT > 0) this.drawAnnounce(g, ctx, w, h);
    this.drawMinimap(g, ctx, w, h);
  },

  // 메뉴 화면 뒤에 흐르는 배경.
  drawVoid: function (g, ctx, w, h) {
    ctx.fillStyle = '#080B14';
    ctx.fillRect(0, 0, w, h);
    var t = performance.now() / 1000;
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < 46; i++) {
      var x = ((i * 337 + t * (18 + i % 7 * 9)) % (w + 120)) - 60;
      var y = (i * 211 % h);
      ctx.fillStyle = i % 3 === 0 ? '#1F3350' : '#152238';
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 4), 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  drawFloor: function (g, ctx, ox, oy, w, h, Z) {
    ctx.fillStyle = (g.stage && g.stage.floor) || '#0A0E1A';
    ctx.fillRect(0, 0, w, h);

    // 격자 — 월드 격자를 화면 축척으로 그립니다.
    var cell = 220 * Z;
    var startX = ((ox % cell) + cell) % cell;
    var startY = ((oy % cell) + cell) % cell;
    ctx.strokeStyle = 'rgba(88,130,200,0.075)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = startX; x < w; x += cell) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (var y = startY; y < h; y += cell) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();

    // 중앙 발광
    var grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    grd.addColorStop(0, 'rgba(60,110,190,0.10)');
    grd.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // 월드 경계
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(Z, Z);
    ctx.strokeStyle = 'rgba(120,180,255,0.35)';
    ctx.lineWidth = 8;
    ctx.setLineDash([36, 28]);
    ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
    ctx.setLineDash([]);
    ctx.restore();
  },

  // 스테이지 고유 기믹 — 회복 지대 / 냉각 장치 / 포격 지원 표시.
  drawGimmicks: function (g, ctx, vis) {
    if (!g.gimmicks) return;
    for (var i = 0; i < g.gimmicks.length; i++) {
      var gm = g.gimmicks[i];
      if (!vis(gm.x, gm.y, gm.r)) continue;
      var col = gm.kind === 'heal' ? '#8BE3A8' : (gm.kind === 'freeze' ? '#7FE0D4' : '#FFD98E');
      var pulse = 0.5 + 0.5 * Math.sin(gm.pulse * 1.6);
      ctx.globalAlpha = 0.10 + pulse * 0.06;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(gm.x, gm.y, gm.r, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = col; ctx.lineWidth = 6;
      ctx.setLineDash([40, 30]);
      ctx.beginPath(); ctx.arc(gm.x, gm.y, gm.r, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.font = 'bold 90px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(gm.kind === 'heal' ? '💚' : (gm.kind === 'freeze' ? '❄️' : '🎯'), gm.x, gm.y);
    }
  },

  // 자야의 깃털 — 바닥에 꽂혀 있다가 깃부르미(E)로 회수됩니다.
  drawFeathers: function (g, ctx, vis) {
    for (var i = 0; i < g.feathers.length; i++) {
      var f = g.feathers[i];
      if (!vis(f.x, f.y, 40)) continue;
      var bob = Math.sin(f.wob) * 4;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 14, 16, 6, 0, 0, U.TAU); ctx.fill();
      ctx.save();
      ctx.translate(f.x, f.y + bob);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#FF5C7A';
      ctx.beginPath();
      ctx.moveTo(0, -30); ctx.lineTo(9, 10); ctx.lineTo(0, 22); ctx.lineTo(-9, 10);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#F3C96B'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, 20); ctx.stroke();
      ctx.restore();
    }
  },

  // 야스오의 바람 장막.
  drawWindwalls: function (g, ctx) {
    for (var i = 0; i < g.windwalls.length; i++) {
      var w = g.windwalls[i];
      var k = U.clamp(w.life / w.maxLife, 0, 1);
      var hx = Math.cos(w.ang) * w.len / 2, hy = Math.sin(w.ang) * w.len / 2;
      ctx.save();
      ctx.globalAlpha = 0.25 * k;
      ctx.strokeStyle = '#B6F2FF';
      ctx.lineWidth = 90;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w.x - hx, w.y - hy); ctx.lineTo(w.x + hx, w.y + hy);
      ctx.stroke();
      ctx.globalAlpha = 0.85 * k;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(w.x - hx, w.y - hy); ctx.lineTo(w.x + hx, w.y + hy);
      ctx.stroke();
      ctx.restore();
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }
  },

  drawZones: function (g, ctx, vis) {
    for (var i = 0; i < g.zones.length; i++) {
      var z = g.zones[i];
      if (!vis(z.x, z.y, z.r)) continue;
      var a = U.clamp(z.life / z.maxLife, 0, 1);
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(z.t * 8);
      ctx.fillStyle = z.color;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.5 * a;
      ctx.strokeStyle = z.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  // 맵 장애물 — 바위와 기둥은 길을 막고, 나무 상자는 부술 수 있습니다.
  drawObstacles: function (g, ctx, vis) {
    if (!g.obstacles) return;
    for (var i = 0; i < g.obstacles.length; i++) {
      var o = g.obstacles[i];
      if (o.dead || !vis(o.x, o.y, o.r + 20)) continue;

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + o.r * 0.55, o.r * 0.95, o.r * 0.38, 0, 0, U.TAU);
      ctx.fill();

      if (o.kind === 'crate') {
        var hit = o.flash > 0;
        ctx.fillStyle = hit ? '#FFFFFF' : '#8A5F32';
        ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
        ctx.fillStyle = hit ? '#FFFFFF' : '#C89A5B';
        ctx.fillRect(o.x - o.r * 0.82, o.y - o.r * 0.82, o.r * 1.64, o.r * 1.64);
        ctx.strokeStyle = '#6B4522'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(o.x - o.r, o.y - o.r); ctx.lineTo(o.x + o.r, o.y + o.r);
        ctx.moveTo(o.x + o.r, o.y - o.r); ctx.lineTo(o.x - o.r, o.y + o.r);
        ctx.stroke();
        if (o.hp < o.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(o.x - o.r, o.y - o.r - 8, o.r * 2, 3);
          ctx.fillStyle = '#C89A5B';
          ctx.fillRect(o.x - o.r, o.y - o.r - 8, o.r * 2 * (o.hp / o.maxHp), 3);
        }
      } else if (o.kind === 'pillar') {
        // 협곡의 부서진 석주
        ctx.fillStyle = '#3E4A63';
        ctx.fillRect(o.x - o.r * 0.7, o.y - o.r * 1.5, o.r * 1.4, o.r * 2.1);
        ctx.fillStyle = '#566483';
        ctx.fillRect(o.x - o.r * 0.7, o.y - o.r * 1.5, o.r * 0.45, o.r * 2.1);
        ctx.fillStyle = '#6E7D9E';
        ctx.fillRect(o.x - o.r, o.y - o.r * 1.75, o.r * 2, o.r * 0.42);
        ctx.fillRect(o.x - o.r * 0.9, o.y + o.r * 0.35, o.r * 1.8, o.r * 0.32);
      } else {
        // 바위 — 모양이 겹치지 않게 seed 로 굴곡을 줍니다.
        ctx.fillStyle = '#39445C';
        ctx.beginPath();
        for (var k = 0; k < 7; k++) {
          var a = (U.TAU / 7) * k;
          var rr = o.r * (0.82 + 0.3 * Math.abs(Math.sin(o.seed + k * 2.1)));
          var px = o.x + Math.cos(a) * rr, py = o.y + Math.sin(a) * rr * 0.86;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath();
        ctx.ellipse(o.x - o.r * 0.22, o.y - o.r * 0.3, o.r * 0.45, o.r * 0.26, -0.5, 0, U.TAU);
        ctx.fill();
      }
      if (o.flash > 0) o.flash -= 0.016;
    }
  },

  // 일라오이의 촉수 — 바닥에서 솟아나 내려찍습니다.
  drawTentacles: function (g, ctx, vis) {
    for (var i = 0; i < g.tentacles.length; i++) {
      var tc = g.tentacles[i];
      if (!vis(tc.x, tc.y, 260)) continue;
      var swing = tc.anim > 0 ? tc.anim / 0.3 : 0;
      var scale = tc.giant ? 2 : 1;
      var len = (110 + swing * 90) * scale;
      var lean = (tc.ang !== undefined ? tc.ang : -Math.PI / 2);

      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(tc.x, tc.y + 20, 50 * scale, 20 * scale, 0, 0, U.TAU); ctx.fill();

      ctx.save();
      ctx.translate(tc.x, tc.y);
      ctx.strokeStyle = tc.giant ? '#2FA383' : '#4FC3A1';
      ctx.lineCap = 'round';
      ctx.lineWidth = 38 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.quadraticCurveTo(
        Math.cos(lean) * len * 0.35, -len * 0.85,
        Math.cos(lean) * len, Math.sin(lean) * len * 0.5 - len * 0.25
      );
      ctx.stroke();
      ctx.strokeStyle = '#B7F2E0';
      ctx.lineWidth = 12 * scale;
      ctx.stroke();
      ctx.restore();
      ctx.lineCap = 'butt';
    }
  },

  drawMines: function (g, ctx, vis) {
    for (var i = 0; i < g.mines.length; i++) {
      var m = g.mines[i];
      if (!vis(m.x, m.y, m.aoe)) continue;
      var blink = 0.55 + 0.45 * Math.sin(m.blink * 7);
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = m.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.trigger, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + blink + ')';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.42, 0, U.TAU); ctx.fill();
    }
  },

  drawPickups: function (g, ctx, vis) {
    for (var i = 0; i < g.pickups.length; i++) {
      var u = g.pickups[i];
      if (!vis(u.x, u.y, 60)) continue;
      // 줍는 물건은 '바닥에 놓여 있다'는 느낌이 나야 날아다니는 탄환과 헷갈리지 않습니다.
      // 그래서 흔들림을 최소로 줄이고 바닥 그림자를 깔았습니다.
      var bob = Math.sin(u.t * 3 + u.x * 0.02) * 0.8;
      ctx.fillStyle = u.color;
      if (u.kind === 'xp' || u.kind === 'gold') {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(u.x, u.y + u.r * 0.95, u.r * 0.95, u.r * 0.34, 0, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = u.color;
      }

      if (u.kind === 'xp') {
        // 각진 보석. 흰 테두리를 둘러 적 탄환의 붉은 가시와 확실히 갈라둡니다.
        ctx.globalAlpha = 0.16;
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, u.r * 1.7, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(u.x, u.y + bob - u.r);
        ctx.lineTo(u.x + u.r * 0.8, u.y + bob);
        ctx.lineTo(u.x, u.y + bob + u.r);
        ctx.lineTo(u.x - u.r * 0.8, u.y + bob);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // 보석 단면
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(u.x - u.r * 0.8, u.y + bob);
        ctx.lineTo(u.x + u.r * 0.8, u.y + bob);
        ctx.stroke();
      } else if (u.kind === 'gold') {
        ctx.globalAlpha = 0.16;
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, u.r * 1.7, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, u.r, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,20,0.9)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(u.x - u.r * 0.3, u.y + bob - u.r * 0.3, u.r * 0.28, 0, U.TAU); ctx.fill();
      } else if (u.kind === 'card') {
        // 접근 카드 — 무기 진화의 열쇠. 프리즘 테두리 카드로 눈에 띄게 그립니다.
        var spin = Math.sin(u.t * 2.4);
        ctx.globalAlpha = 0.28 + 0.2 * Math.sin(u.t * 5);
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, u.r * 2.4, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(u.x, u.y + bob);
        ctx.scale(Math.max(0.25, Math.abs(spin)), 1);
        var gw = u.r * 0.78, gh = u.r * 1.12;
        var grd = ctx.createLinearGradient(-gw, -gh, gw, gh);
        grd.addColorStop(0, '#C46BFF');
        grd.addColorStop(0.5, '#7EF2D8');
        grd.addColorStop(1, '#FFD98E');
        ctx.fillStyle = grd;
        ctx.fillRect(-gw, -gh, gw * 2, gh * 2);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4;
        ctx.strokeRect(-gw, -gh, gw * 2, gh * 2);
        ctx.fillStyle = 'rgba(10,14,26,0.75)';
        ctx.fillRect(-gw * 0.6, -gh * 0.6, gw * 1.2, gh * 1.2);
        ctx.restore();
      } else {
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, u.r * 1.9, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, u.r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#0A0E1A';
        ctx.font = 'bold 40px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(u.kind === 'heal' ? '+' : (u.kind === 'magnet' ? 'M' : 'B'), u.x, u.y + bob + 2);
      }
      ctx.globalAlpha = 1;
    }
  },

  drawShop: function (g, ctx) {
    var s = g.shopObj;
    if (!s) return;
    var pulse = 0.5 + 0.5 * Math.sin(s.pulse * 3);
    ctx.globalAlpha = 0.18 + pulse * 0.16;
    ctx.fillStyle = '#F3C96B';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 90 + pulse * 36, 0, U.TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1A1F33';
    ctx.strokeStyle = '#F3C96B'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, U.TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F3C96B';
    ctx.font = 'bold 92px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💰', s.x, s.y + 6);
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('보급 상점', s.x, s.y - s.r - 44);
  },

  drawEnemies: function (g, ctx, vis) {
    var list = g.enemies;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!vis(e.x, e.y, e.r + 10)) continue;
      var r = e.r;
      if (e.spawnT > 0) {
        // 등장 연출
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = e.def.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, r + e.spawnT * 40, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        r = r * (1 - e.spawnT * 1.2);
        if (r < 1) continue;
      }

      // 렉사이 땅 파기 — 몸은 숨고 흙더미만 보입니다.
      if (e.hidden) {
        ctx.fillStyle = 'rgba(120,90,60,0.85)';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.r * 0.9, e.r * 0.4, 0, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = e.def.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      var color = e.flash > 0 ? '#FFFFFF' : e.def.color;
      var shape = e.def.shape;

      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.75, r * 0.8, r * 0.32, 0, 0, U.TAU); ctx.fill();

      ctx.fillStyle = color;
      if (shape !== 'boss' && this.mob[shape]) {
        // 유닛마다 실루엣이 다릅니다. 각 그리기 함수는 mob 아래에 모아 뒀습니다.
        this.mob[shape](ctx, e, r, color, g);
      } else if (shape === 'boss') {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(g.t * 0.5);
        ctx.globalAlpha = 0.25;
        this.star(ctx, 0, 0, r * 1.5, r * 0.9, 9); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#0A0E1A';
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.55, 0, U.TAU); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.3, 0, U.TAU); ctx.fill();
        if (e.pattern === 'charge' && e.patPhase > 0.7) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(e.chargeAng) * 400, e.y + Math.sin(e.chargeAng) * 400);
          ctx.stroke();
        }
      } else {
        // blob — 살짝 일그러진 원
        var wob = Math.sin(e.wob * 2) * r * 0.08;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, r + wob, r - wob, 0, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.arc(e.x - r * 0.25, e.y - r * 0.2, r * 0.18, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(e.x + r * 0.25, e.y - r * 0.2, r * 0.18, 0, U.TAU); ctx.fill();
      }

      // 상태 표시
      if (e.freezeT > 0) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#7FE0D4';
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 8, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#B6F2FF'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 8, 0, U.TAU); ctx.stroke();
      } else if (e.slow > 0) {
        ctx.strokeStyle = 'rgba(127,224,212,0.7)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 7, 0, U.TAU); ctx.stroke();
      }
      if (e.curseT > 0) {
        ctx.strokeStyle = 'rgba(196,107,255,0.8)'; ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 14, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (e.sunT > 0) {
        // 레오나 햇빛 — 다른 무기로 터뜨릴 수 있다는 표시.
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(g.t * 9);
        ctx.strokeStyle = '#FFC24D'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 18, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (e.burnT > 0 || e.bleedT > 0) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = e.bleedT > 0 ? '#E85C8A' : '#FF7A3D';
        ctx.beginPath(); ctx.arc(e.x, e.y - r - 10, 8, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 체력바 (정예·보스·큰 적만)
      if ((e.elite || e.boss || e.maxHp > 600) && e.hp < e.maxHp) {
        var bw = r * 2.2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - bw / 2, e.y - r - 34, bw, 12);
        ctx.fillStyle = e.boss ? '#FF5C7A' : (e.elite ? '#FFD36B' : '#8BE3A8');
        ctx.fillRect(e.x - bw / 2, e.y - r - 34, bw * (e.hp / e.maxHp), 12);
      }
    }
  },

  // 적 탄환 — 붉은 가시형. 내 탄환(길쭉한 캡슐)·경험치 구슬(바닥의 보석)과
  // 한눈에 구별되도록 모양·색·테두리를 모두 다르게 씁니다.
  drawEnemyBullets: function (g, ctx, vis) {
    for (var i = 0; i < g.ebullets.length; i++) {
      var b = g.ebullets[i];
      if (!vis(b.x, b.y, b.r * 3)) continue;
      var ang = Math.atan2(b.vy, b.vx);

      // 날아온 궤적을 알 수 있게 짧은 꼬리를 답니다.
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.r * 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(ang) * b.r * 3, b.y - Math.sin(ang) * b.r * 3);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // 위험을 알리는 맥동 링
      ctx.globalAlpha = 0.22 + 0.16 * Math.sin(g.t * 11 + b.x * 0.05);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.1, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;

      // 본체: 천천히 도는 4갈래 가시 + 검은 테두리
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(g.t * 5 + b.y * 0.03);
      this.star(ctx, 0, 0, b.r * 1.7, b.r * 0.78, 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, U.TAU); ctx.fill();
    }
  },

  drawBullets: function (g, ctx, vis) {
    for (var i = 0; i < g.bullets.length; i++) {
      var b = g.bullets[i];
      if (!vis(b.x, b.y, b.r + 12)) continue;
      var ang = Math.atan2(b.vy, b.vx);
      ctx.fillStyle = b.color;
      // 내 탄환은 전부 '진행 방향으로 길쭉하고 흰 코어가 박힌' 모양으로 통일합니다.
      // 적 탄환(회전하는 붉은 가시)과 실루엣부터 다르게 하려는 것입니다.
      if (b.shape === 'wave') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(-b.r * 0.5, 0, b.r * 0.4, b.r * 1.25, 0, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 0.55, b.r, 0, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.ellipse(0, 0, b.r * 0.2, b.r * 0.62, 0, 0, U.TAU); ctx.fill();
        ctx.restore();
      } else if (b.shape === 'rocket') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(b.r * 1.6, 0); ctx.lineTo(-b.r, b.r * 0.85); ctx.lineTo(-b.r * 0.5, 0); ctx.lineTo(-b.r, -b.r * 0.85);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(b.r * 0.35, 0, b.r * 0.3, 0, U.TAU); ctx.fill();
        ctx.restore();
      } else {
        // bolt — 진행 방향으로 늘어난 캡슐
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.ellipse(-b.r * 1.4, 0, b.r * 2.4, b.r * 0.8, 0, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.9, b.r * 0.85, 0, 0, U.TAU);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.ellipse(b.r * 0.45, 0, b.r * 0.8, b.r * 0.38, 0, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
    }
  },

  drawBeams: function (g, ctx) {
    for (var i = 0; i < g.beams.length; i++) {
      var b = g.beams[i];
      var k = 1 - b.t / b.life;
      ctx.globalAlpha = k;
      ctx.strokeStyle = b.color;
      ctx.lineCap = 'round';
      if (b.jagged) {
        // 번개: 중간 점을 흔들어 그립니다.
        ctx.lineWidth = b.w * k;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        var steps = 5;
        for (var s = 1; s < steps; s++) {
          var t = s / steps;
          var mx = U.lerp(b.x1, b.x2, t) + U.rand(-9, 9);
          var my = U.lerp(b.y1, b.y2, t) + U.rand(-9, 9);
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      } else {
        ctx.lineWidth = b.w * k * 2;
        ctx.globalAlpha = k * 0.3;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = k;
        ctx.lineWidth = b.w * k;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1, b.w * k * 0.3);
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
    }
  },

  drawPlayer: function (g, ctx) {
    var p = g.p, i, w;

    // 서리 오라 / 회전 칼날 / 드론 — 무기 상태에서 직접 읽습니다.
    for (i = 0; i < p.weapons.length; i++) {
      w = p.weapons[i];
      if (w.aura) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = WEAPONS[w.id].color;
        ctx.beginPath(); ctx.arc(p.x, p.y, w.aura, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = WEAPONS[w.id].color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, w.aura, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.8, p.r * 0.85, p.r * 0.34, 0, 0, U.TAU); ctx.fill();

    // 보호막
    if (p.shield > 0) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#6FD3FF'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#6FD3FF';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 본체
    var blink = p.iframe > 0 && Math.floor(p.iframe * 18) % 2 === 0;
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.fillStyle = p.champ.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.fill();
    ctx.fillStyle = p.champ.accent;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.55, 0, U.TAU); ctx.fill();
    // 바라보는 방향 표시
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.face) * p.r * 0.85, p.y + Math.sin(p.face) * p.r * 0.85, 4, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 회오리 칼날 — 주위를 도는 공전 투사체
    for (i = 0; i < p.weapons.length; i++) {
      w = p.weapons[i];
      if (!w.orb || !w.orb.length) continue;
      var oc = WEAPONS[w.id].color;
      for (var j = 0; j < w.orb.length; j++) {
        var n = w.orb[j];
        if (n.x === undefined) continue;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(g.t * 9 + j);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = oc;
        ctx.fillRect(-58, -58, 116, 116);
        ctx.globalAlpha = 1;
        ctx.fillRect(-30, -30, 60, 60);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.restore();
      }
    }

    // 티버 — 주인 곁을 떠나 싸우는 소환수
    for (i = 0; i < p.weapons.length; i++) {
      w = p.weapons[i];
      if (!w.pet) continue;
      var pet = w.pet, pc = WEAPONS[w.id].color;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(pet.x, pet.y + pet.r * 0.8, pet.r * 0.85, pet.r * 0.32, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = pc;
      ctx.beginPath(); ctx.arc(pet.x, pet.y, pet.r * 2.6, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pc;
      ctx.beginPath(); ctx.arc(pet.x, pet.y, pet.r, 0, U.TAU); ctx.fill();
      // 귀
      ctx.beginPath(); ctx.arc(pet.x - pet.r * 0.7, pet.y - pet.r * 0.7, pet.r * 0.36, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(pet.x + pet.r * 0.7, pet.y - pet.r * 0.7, pet.r * 0.36, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#2B1405';
      ctx.beginPath(); ctx.arc(pet.x - pet.r * 0.3, pet.y - pet.r * 0.1, pet.r * 0.14, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(pet.x + pet.r * 0.3, pet.y - pet.r * 0.1, pet.r * 0.14, 0, U.TAU); ctx.fill();
    }

    // 드론
    for (i = 0; i < p.weapons.length; i++) {
      w = p.weapons[i];
      if (!w.drones) continue;
      for (var k = 0; k < w.drones.length; k++) {
        var d = w.drones[k];
        ctx.fillStyle = WEAPONS[w.id].color;
        // 유미봇이 전리품을 끌어오는 반경
        if (w.collect) {
          ctx.globalAlpha = 0.07;
          ctx.beginPath(); ctx.arc(d.x, d.y, w.collect, 0, U.TAU); ctx.fill();
          ctx.globalAlpha = 1;
        }
        this.poly(ctx, d.x, d.y, 26, 3, g.t * 6);
        ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(d.x, d.y, 44, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(d.x, d.y, 8, 0, U.TAU); ctx.fill();
      }
    }

    // 조준 표시 — 수동 조준일 때 커서 방향을 알려 줍니다.
    if (!g.autoAim) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4;
      ctx.setLineDash([24, 20]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(g.mouse.wx, g.mouse.wy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(g.mouse.wx, g.mouse.wy, 40, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(g.mouse.wx, g.mouse.wy, 8, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  drawFxBelow: function (g, ctx, vis) {
    for (var i = 0; i < g.fx.length; i++) {
      var f = g.fx[i];
      var k = 1 - f.t / f.life;
      if (f.kind === 'trail') {
        ctx.globalAlpha = k * 0.4;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.kind === 'ring' || f.kind === 'pulse') {
        ctx.globalAlpha = k * 0.75;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = f.kind === 'ring' ? 4 * k : 2 * k;
        var rr = f.kind === 'ring' ? f.r * (0.4 + 0.6 * (1 - k)) : f.r * (1 - k * 0.15);
        ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  },

  drawFxAbove: function (g, ctx, vis) {
    for (var i = 0; i < g.fx.length; i++) {
      var f = g.fx[i];
      var k = 1 - f.t / f.life;
      if (f.kind === 'spark') {
        ctx.globalAlpha = k;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, U.TAU); ctx.fill();
      } else if (f.kind === 'puff' || f.kind === 'frag') {
        ctx.globalAlpha = k * 0.9;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.kind === 'puff' ? k : 1), 0, U.TAU); ctx.fill();
      } else if (f.kind === 'boom') {
        ctx.globalAlpha = k * 0.55;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k * 0.55), 0, U.TAU); ctx.fill();
        ctx.globalAlpha = k;
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3 * k;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k * 0.3), 0, U.TAU); ctx.stroke();
      } else if (f.kind === 'slash') {
        ctx.globalAlpha = k * 0.85;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 9 * k;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.7 + 0.3 * (1 - k)), f.ang - f.arc / 2, f.ang + f.arc / 2);
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.7 + 0.3 * (1 - k)), f.ang - f.arc / 2, f.ang + f.arc / 2);
        ctx.stroke();
      } else if (f.kind === 'muzzle') {
        ctx.globalAlpha = k;
        ctx.fillStyle = '#FFFFFF';
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
        ctx.beginPath(); ctx.ellipse(18, 0, f.r * k, f.r * 0.5 * k, 0, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  },

  drawTexts: function (g, ctx, vis) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < g.texts.length; i++) {
      var t = g.texts[i];
      if (!vis(t.x, t.y, 40)) continue;
      var k = 1 - t.t / t.life;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = 'bold ' + t.size + 'px system-ui, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.v, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.v, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },

  drawAnnounce: function (g, ctx, w, h) {
    var k = U.clamp(g.announceT / 2.6, 0, 1);
    var a = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k / 0.25);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(g.announceMsg, w / 2, h * 0.24);
    ctx.fillStyle = '#FFD36B';
    ctx.fillText(g.announceMsg, w / 2, h * 0.24);
    ctx.globalAlpha = 1;
  },

  // 우하단 미니맵: 적 밀집 방향을 파악하는 용도.
  drawMinimap: function (g, ctx, w, h) {
    // 오른쪽 아래의 E/R 버튼 위에 얹습니다 (버튼 높이 + 여유).
    var size = 108, pad = 14;
    var x0 = w - size - pad, y0 = h - size - pad - 122;
    var range = 4200;   // 월드(리그 오브 레전드) 단위
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#060911';
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = 'rgba(120,180,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
    ctx.globalAlpha = 1;
    var cx = x0 + size / 2, cy = y0 + size / 2;
    var sc = (size / 2) / range;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      var dx = (e.x - g.p.x) * sc, dy = (e.y - g.p.y) * sc;
      if (Math.abs(dx) > size / 2 || Math.abs(dy) > size / 2) continue;
      ctx.fillStyle = e.boss ? '#FF5C7A' : (e.elite ? '#FFD36B' : 'rgba(255,120,120,0.75)');
      var s = e.boss ? 6 : (e.elite ? 4 : 2);
      ctx.fillRect(cx + dx - s / 2, cy + dy - s / 2, s, s);
    }
    // 접근 카드 위치도 표시합니다 — 진화의 열쇠라 놓치면 안 됩니다.
    for (var c = 0; c < g.pickups.length; c++) {
      if (g.pickups[c].kind !== 'card') continue;
      var kx = U.clamp((g.pickups[c].x - g.p.x) * sc, -size / 2 + 3, size / 2 - 3);
      var ky = U.clamp((g.pickups[c].y - g.p.y) * sc, -size / 2 + 3, size / 2 - 3);
      ctx.fillStyle = '#C46BFF';
      ctx.fillRect(cx + kx - 3, cy + ky - 4, 6, 8);
    }
    if (g.shopObj) {
      var sx = (g.shopObj.x - g.p.x) * sc, sy = (g.shopObj.y - g.p.y) * sc;
      sx = U.clamp(sx, -size / 2 + 3, size / 2 - 3);
      sy = U.clamp(sy, -size / 2 + 3, size / 2 - 3);
      ctx.fillStyle = '#F3C96B';
      ctx.fillRect(cx + sx - 3, cy + sy - 3, 6, 6);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, U.TAU); ctx.fill();
  },

  // ── 유닛별 생김새 ────────────────────────────────────────────
  // 같은 원에 색만 다른 적은 난전에서 구별이 안 되므로, 실루엣을 전부 다르게 그립니다.
  // 각 함수는 (ctx, e, r, color, g) 를 받아 e.x, e.y 를 중심으로 그립니다.
  mob: {
    // 근접 미니언 — 각진 몸통에 뿔 하나
    minion: function (ctx, e, r, color) {
      var bob = Math.sin(e.wob * 3) * r * 0.1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.75, e.y + r * 0.8 + bob);
      ctx.lineTo(e.x - r * 0.62, e.y - r * 0.45 + bob);
      ctx.lineTo(e.x, e.y - r * 0.95 + bob);
      ctx.lineTo(e.x + r * 0.62, e.y - r * 0.45 + bob);
      ctx.lineTo(e.x + r * 0.75, e.y + r * 0.8 + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - r * 0.42, e.y - r * 0.3 + bob, r * 0.28, r * 0.2);
      ctx.fillRect(e.x + r * 0.14, e.y - r * 0.3 + bob, r * 0.28, r * 0.2);
    },

    // 원거리 미니언 — 후드를 쓴 형상에 지팡이 구슬
    caster: function (ctx, e, r, color, g) {
      var ea = Math.atan2(g.p.y - e.y, g.p.x - e.x);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - r * 1.15);
      ctx.lineTo(e.x + r * 0.85, e.y + r * 0.85);
      ctx.lineTo(e.x - r * 0.85, e.y + r * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0A0E1A';
      ctx.beginPath(); ctx.arc(e.x, e.y + r * 0.05, r * 0.36, 0, U.TAU); ctx.fill();
      // 들고 있는 구슬이 플레이어 쪽을 향합니다.
      ctx.fillStyle = e.fireT < 0.4 ? '#FFFFFF' : color;
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(ea) * r * 1.05, e.y + Math.sin(ea) * r * 1.05, r * 0.28, 0, U.TAU);
      ctx.fill();
    },

    // 대포 미니언 — 네모 몸통에 포신
    cannon: function (ctx, e, r, color, g) {
      var ea = Math.atan2(g.p.y - e.y, g.p.x - e.x);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.save(); ctx.rotate(ea);
      ctx.fillRect(0, -r * 0.3, r * 1.5, r * 0.6);
      ctx.restore();
      ctx.fillStyle = color;
      ctx.fillRect(-r * 0.8, -r * 0.7, r * 1.6, r * 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-r * 0.8, -r * 0.7, r * 1.6, r * 0.3);
      ctx.fillStyle = '#0A0E1A';
      ctx.fillRect(-r * 0.45, -r * 0.25, r * 0.9, r * 0.3);
      ctx.restore();
    },

    // 슈퍼 미니언 — 어깨 장갑이 달린 큰 로봇
    super: function (ctx, e, r, color) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(e.x - r * 1.05, e.y - r * 0.5, r * 2.1, r * 0.55);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.8, e.y + r * 0.95);
      ctx.lineTo(e.x - r * 0.9, e.y - r * 0.55);
      ctx.lineTo(e.x - r * 0.4, e.y - r * 1.0);
      ctx.lineTo(e.x + r * 0.4, e.y - r * 1.0);
      ctx.lineTo(e.x + r * 0.9, e.y - r * 0.55);
      ctx.lineTo(e.x + r * 0.8, e.y + r * 0.95);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFE066';
      ctx.fillRect(e.x - r * 0.5, e.y - r * 0.55, r * 0.34, r * 0.22);
      ctx.fillRect(e.x + r * 0.16, e.y - r * 0.55, r * 0.34, r * 0.22);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - r * 0.2); ctx.lineTo(e.x, e.y + r * 0.9); ctx.stroke();
    },

    // 어스름 늑대 — 뾰족한 귀와 이빨
    wolf: function (ctx, e, r, color, g) {
      var a = Math.atan2(g.p.y - e.y, g.p.x - e.x);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(r * 1.35, 0);
      ctx.lineTo(r * 0.1, r * 0.75);
      ctx.lineTo(-r * 0.9, r * 0.5);
      ctx.lineTo(-r * 0.55, 0);
      ctx.lineTo(-r * 0.9, -r * 0.5);
      ctx.lineTo(r * 0.1, -r * 0.75);
      ctx.closePath(); ctx.fill();
      // 귀
      ctx.beginPath();
      ctx.moveTo(r * 0.25, -r * 0.6); ctx.lineTo(r * 0.05, -r * 1.25); ctx.lineTo(-r * 0.2, -r * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.25, r * 0.6); ctx.lineTo(r * 0.05, r * 1.25); ctx.lineTo(-r * 0.2, r * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FF4D6D';
      ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.22, r * 0.14, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.55, r * 0.22, r * 0.14, 0, U.TAU); ctx.fill();
      ctx.restore();
    },

    // 칼날부리 — 긴 부리와 벼슬
    raptor: function (ctx, e, r, color, g) {
      var a = Math.atan2(g.p.y - e.y, g.p.x - e.x);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(-r * 0.15, 0, r * 0.85, r * 0.62, 0, 0, U.TAU); ctx.fill();
      // 부리
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0); ctx.lineTo(r * 0.35, r * 0.3); ctx.lineTo(r * 0.35, -r * 0.3);
      ctx.closePath(); ctx.fill();
      // 벼슬
      ctx.fillStyle = '#FFE066';
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.1 - i * r * 0.32, -r * 0.5);
        ctx.lineTo(-r * 0.25 - i * r * 0.32, -r * 1.1);
        ctx.lineTo(-r * 0.42 - i * r * 0.32, -r * 0.45);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#0A0E1A';
      ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.2, r * 0.12, 0, U.TAU); ctx.fill();
      ctx.restore();
    },

    // 돌거북 — 각진 바위 덩어리
    krug: function (ctx, e, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(e.x - r, e.y + r * 0.4);
      ctx.lineTo(e.x - r * 0.72, e.y - r * 0.62);
      ctx.lineTo(e.x + r * 0.1, e.y - r);
      ctx.lineTo(e.x + r * 0.92, e.y - r * 0.5);
      ctx.lineTo(e.x + r * 0.82, e.y + r * 0.62);
      ctx.lineTo(e.x - r * 0.3, e.y + r);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.5, e.y - r * 0.5); ctx.lineTo(e.x - r * 0.1, e.y + r * 0.1);
      ctx.lineTo(e.x + r * 0.55, e.y - r * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(e.x - r * 0.3, e.y - r * 0.15, r * 0.13, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.2, e.y - r * 0.28, r * 0.13, 0, U.TAU); ctx.fill();
    },

    // 심술 두꺼비 — 넓적하고 입이 큼
    gromp: function (ctx, e, r, color, g) {
      var breathe = Math.sin(e.wob * 2) * r * 0.06;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + r * 0.1, r * 1.05 + breathe, r * 0.8 - breathe, 0, 0, U.TAU);
      ctx.fill();
      // 눈 두 덩이
      ctx.beginPath(); ctx.arc(e.x - r * 0.45, e.y - r * 0.55, r * 0.3, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.45, e.y - r * 0.55, r * 0.3, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#0A0E1A';
      ctx.beginPath(); ctx.arc(e.x - r * 0.45, e.y - r * 0.55, r * 0.13, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.45, e.y - r * 0.55, r * 0.13, 0, U.TAU); ctx.fill();
      // 곧 뱉으려 하면 입이 벌어집니다.
      var open = e.fireT < 0.4 ? r * 0.4 : r * 0.14;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + r * 0.42, r * 0.55, open, 0, 0, U.TAU);
      ctx.fill();
    },

    // 공허충 — 촉수가 달린 작은 덩어리
    voidling: function (ctx, e, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.85, 0, U.TAU); ctx.fill();
      for (var i = 0; i < 5; i++) {
        var a = e.wob + (U.TAU / 5) * i;
        ctx.strokeStyle = color;
        ctx.lineWidth = r * 0.28;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(a) * r * 1.5, e.y + Math.sin(a) * r * 1.5);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.3, 0, U.TAU); ctx.fill();
    },

    // 공허 유충 — 터지기 직전 하얗게 부풀어 오릅니다.
    grub: function (ctx, e, r, color) {
      var glow = e.fuse > 0 ? (0.4 + 0.6 * Math.sin(e.fuse * 34)) : 0;
      var swell = 1 + (e.fuse > 0 ? e.fuse * 0.6 : 0);
      ctx.fillStyle = glow > 0.5 ? '#FFFFFF' : color;
      // 마디가 있는 몸통
      for (var i = 2; i >= 0; i--) {
        ctx.beginPath();
        ctx.arc(e.x, e.y + i * r * 0.3, r * (0.85 - i * 0.16) * swell, 0, U.TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#0A0E1A';
      ctx.beginPath(); ctx.arc(e.x - r * 0.28, e.y - r * 0.3, r * 0.15, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.28, e.y - r * 0.3, r * 0.15, 0, U.TAU); ctx.fill();
      if (e.fuse > 0) {
        ctx.strokeStyle = 'rgba(255,60,90,' + glow + ')';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.def.blast, 0, U.TAU); ctx.stroke();
      }
    },

    // ── 미니 보스 · 정예병 ─────────────────────────────────────
    // 크고 위험한 유닛은 실루엣부터 잡몹과 확실히 다르게 그립니다.

    // 거미탄 (우르곳 베이스) — 다리 여섯에 사방 포구
    spider: function (ctx, e, r, color, g) {
      var i, a;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = r * 0.18;
      ctx.lineCap = 'round';
      for (i = 0; i < 6; i++) {
        a = e.wob * 0.5 + (U.TAU / 6) * i;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(a) * r * 1.5, e.y + Math.sin(a) * r * 1.5);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.fillStyle = color;
      Render.poly(ctx, e.x, e.y, r, 6, e.wob * 0.3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      Render.poly(ctx, e.x, e.y, r * 0.55, 6, e.wob * 0.3); ctx.fill();
      // 발사 직전이면 포구가 빛납니다.
      ctx.fillStyle = e.fireT < 0.5 ? '#FFFFFF' : color;
      for (i = 0; i < 6; i++) {
        a = (U.TAU / 6) * i;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * r * 0.75, e.y + Math.sin(a) * r * 0.75, r * 0.16, 0, U.TAU);
        ctx.fill();
      }
    },

    // 딱정벌레 (녹턴 베이스) — 돌진 방향을 예고하는 화살촉
    beetle: function (ctx, e, r, color, g) {
      var a = e.chargeAng !== undefined && e.chargeAng ? e.chargeAng : Math.atan2(g.p.y - e.y, g.p.x - e.x);
      // 돌진 경로 예고
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = color; ctx.lineWidth = r * 1.5;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(a) * r * 9, e.y + Math.sin(a) * r * 9);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(r * 0.1, r * 0.9);
      ctx.lineTo(-r * 1.0, r * 0.55);
      ctx.lineTo(-r * 0.6, 0);
      ctx.lineTo(-r * 1.0, -r * 0.55);
      ctx.lineTo(r * 0.1, -r * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.8, 0); ctx.stroke();
      ctx.fillStyle = '#FF4D6D';
      ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.3, r * 0.16, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.55, r * 0.3, r * 0.16, 0, U.TAU); ctx.fill();
      ctx.restore();
    },

    // 분쇄자 (푸른 파수꾼 베이스) — 두툼한 팔 두 개
    crusher: function (ctx, e, r, color) {
      var swing = Math.sin(e.wob * 2) * r * 0.2;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.arc(e.x - r * 0.95, e.y + swing, r * 0.5, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.95, e.y - swing, r * 0.5, 0, U.TAU); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.85, e.y + r * 0.9);
      ctx.lineTo(e.x - r * 0.72, e.y - r * 0.7);
      ctx.lineTo(e.x, e.y - r * 1.05);
      ctx.lineTo(e.x + r * 0.72, e.y - r * 0.7);
      ctx.lineTo(e.x + r * 0.85, e.y + r * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x - r * 0.95, e.y + swing, r * 0.42, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.95, e.y - swing, r * 0.42, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(e.x - r * 0.3, e.y - r * 0.4, r * 0.15, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.3, e.y - r * 0.4, r * 0.15, 0, U.TAU); ctx.fill();
    },

    // 용트림 (코그모 베이스) — 커다란 입에서 곡사포를 뿜습니다.
    belcher: function (ctx, e, r, color, g) {
      var a = Math.atan2(g.p.y - e.y, g.p.x - e.x);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.12, r, r * 0.85, 0, 0, U.TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      // 발사 직전이면 입이 크게 벌어집니다.
      var open = e.fireT < 0.6 ? r * 0.6 : r * 0.28;
      ctx.fillStyle = '#2B0F14';
      ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.45, open, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = e.fireT < 0.3 ? '#FFFFFF' : '#FF9F43';
      ctx.beginPath(); ctx.arc(r * 0.7, 0, open * 0.45, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0A0E1A';
      ctx.beginPath(); ctx.arc(e.x - r * 0.4, e.y - r * 0.5, r * 0.16, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.4, e.y - r * 0.5, r * 0.16, 0, U.TAU); ctx.fill();
    },

    // 해마 (오른 궁의 산양 베이스) — 뿔을 앞세우고 돌진합니다.
    seahorse: function (ctx, e, r, color, g) {
      var a = e.chargeAng !== undefined && e.chargeAng ? e.chargeAng : Math.atan2(g.p.y - e.y, g.p.x - e.x);
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = color; ctx.lineWidth = r * 1.8;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(a) * r * 12, e.y + Math.sin(a) * r * 12);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(-r * 0.2, 0, r * 1.05, r * 0.72, 0, 0, U.TAU); ctx.fill();
      // 뿔
      ctx.fillStyle = '#F5F5F7';
      ctx.beginPath();
      ctx.moveTo(r * 1.7, 0); ctx.lineTo(r * 0.3, r * 0.5); ctx.lineTo(r * 0.5, 0); ctx.lineTo(r * 0.3, -r * 0.5);
      ctx.closePath(); ctx.fill();
      // 갈기
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (var i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.2 - i * r * 0.3, -r * 0.55);
        ctx.lineTo(-r * 0.4 - i * r * 0.3, -r * 1.15);
        ctx.lineTo(-r * 0.6 - i * r * 0.3, -r * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.3, r * 0.14, 0, U.TAU); ctx.fill();
      ctx.restore();
    },

    // 정예병 — 크고 알록달록한 미니언. 왕관으로 한눈에 구분됩니다.
    elite: function (ctx, e, r, color, g) {
      var ea = Math.atan2(g.p.y - e.y, g.p.x - e.x);
      var bob = Math.sin(e.wob * 2) * r * 0.06;
      // 무지개 외곽
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(g.t * 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, r * 1.25, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.8, e.y + r * 0.9 + bob);
      ctx.lineTo(e.x - r * 0.68, e.y - r * 0.5 + bob);
      ctx.lineTo(e.x, e.y - r * 1.0 + bob);
      ctx.lineTo(e.x + r * 0.68, e.y - r * 0.5 + bob);
      ctx.lineTo(e.x + r * 0.8, e.y + r * 0.9 + bob);
      ctx.closePath(); ctx.fill();
      // 왕관
      ctx.fillStyle = '#FFE066';
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.55, e.y - r * 0.95 + bob);
      ctx.lineTo(e.x - r * 0.4, e.y - r * 1.5 + bob);
      ctx.lineTo(e.x - r * 0.18, e.y - r * 1.1 + bob);
      ctx.lineTo(e.x, e.y - r * 1.6 + bob);
      ctx.lineTo(e.x + r * 0.18, e.y - r * 1.1 + bob);
      ctx.lineTo(e.x + r * 0.4, e.y - r * 1.5 + bob);
      ctx.lineTo(e.x + r * 0.55, e.y - r * 0.95 + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = e.fireT < 0.5 ? '#FFFFFF' : 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(ea) * r * 0.9, e.y + Math.sin(ea) * r * 0.9 + bob, r * 0.24, 0, U.TAU);
      ctx.fill();
    },

    // 화수분 — 도망만 칩니다. 잡으면 대량 골드.
    cornucopia: function (ctx, e, r, color, g) {
      var wob = Math.sin(g.t * 14) * r * 0.16;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, r * 0.95, r * 0.8 + wob, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold ' + Math.round(r * 1.1) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💰', e.x, e.y + 2);
    }
  },

  // 정다각형 경로
  poly: function (ctx, x, y, r, n, rot) {
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var a = rot + (U.TAU / n) * i;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  // 별 모양 경로
  star: function (ctx, x, y, ro, ri, n) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 === 0 ? ro : ri;
      var a = (Math.PI / n) * i - Math.PI / 2;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
};
