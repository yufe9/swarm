// 진입점 — 입력, 화면 크기, 메인 루프.
//
// **렌더러 중립입니다.** 아래 루프는 `draw(g)` · `resize(w,h,dpr)` · `screenToWorld(g,sx,sy)`
// 세 함수만 호출하므로, 2D(render.js)든 3D(render3d.js)든 그대로 돌아갑니다.
// index3d.html 이 `window.ACTIVE_RENDERER = Render3D` 로 바꿔 끼웁니다.

var G = null;

// 지금 쓸 렌더러. 3D 는 Three.js 를 비동기로 불러오므로 준비되기 전까지는
// 2D 로 그리다가 준비되는 즉시 자동으로 넘어갑니다.
function activeRenderer() {
  var r = window.ACTIVE_RENDERER;
  return (r && r.ready !== false) ? r : Render;
}

(function () {
  var canvas = document.getElementById('cv');
  G = new Game(canvas);
  UI.init(G);

  // ── 화면 크기 ────────────────────────────────────────────────
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    G.vw = w; G.vh = h; G.dpr = dpr;
    var r = window.ACTIVE_RENDERER;
    if (r && r.resize) r.resize(w, h, dpr);
  }
  window.__swarmResize = resize;   // 3D 준비 완료 시 다시 한 번 부릅니다
  window.addEventListener('resize', resize);
  resize();

  // ── 키보드 ───────────────────────────────────────────────────
  var keys = {};
  var MOVE_KEYS = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0]
  };
  // ev.key 로 들어오는 경우(일부 가상 키보드 등)를 위한 대응표.
  // 한글 입력 상태에서는 ev.key 가 자모로 바뀌므로 ev.code 를 먼저 봅니다.
  var KEY_ALIAS = {
    w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', p: 'KeyP',
    e: 'KeyE', r: 'KeyR', c: 'KeyC',
    arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
    ' ': 'Space', spacebar: 'Space', escape: 'Escape', esc: 'Escape'
  };

  // 브라우저가 code 를 비워 보내는 상황까지 감안해 하나의 이름으로 정규화합니다.
  function keyCode(ev) {
    if (ev.code) return ev.code;
    return KEY_ALIAS[(ev.key || '').toLowerCase()] || ev.key || '';
  }

  window.addEventListener('keydown', function (ev) {
    var code = keyCode(ev);
    if (MOVE_KEYS[code] || code === 'Space') ev.preventDefault();
    if (keys[code]) return;
    keys[code] = true;

    // 원작과 같은 조작: E 기본 스킬 / R 궁극기 / C 조준 전환.
    if (code === 'KeyE') { G.useE(); }
    else if (code === 'KeyR' || code === 'Space') { G.useR(); }
    else if (code === 'KeyC') {
      G.autoAim = !G.autoAim;
      if (G.state === 'playing') G.announce(G.autoAim ? '자동 조준' : '수동 조준');
    }
    else if (code === 'Escape' || code === 'KeyP') {
      if (G.state === 'playing') UI.openPause();
      else if (G.state === 'paused') UI.closePause();
    }
  });
  window.addEventListener('keyup', function (ev) { keys[keyCode(ev)] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  // ── 터치 조이스틱 ────────────────────────────────────────────
  var stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  var stickEl = document.getElementById('stick');
  var stickKnob = document.getElementById('stick-knob');

  function touchStart(ev) {
    if (G.state !== 'playing') return;
    for (var i = 0; i < ev.changedTouches.length; i++) {
      var t = ev.changedTouches[i];
      if (t.target.closest && t.target.closest('.touch-btn')) continue;
      if (stick.active) continue;
      stick.active = true; stick.id = t.identifier;
      stick.ox = t.clientX; stick.oy = t.clientY;
      stick.x = 0; stick.y = 0;
      stickEl.hidden = false;
      stickEl.style.left = t.clientX + 'px';
      stickEl.style.top = t.clientY + 'px';
      stickKnob.style.transform = 'translate(-50%,-50%)';
    }
  }
  function touchMove(ev) {
    if (!stick.active) return;
    for (var i = 0; i < ev.changedTouches.length; i++) {
      var t = ev.changedTouches[i];
      if (t.identifier !== stick.id) continue;
      var dx = t.clientX - stick.ox, dy = t.clientY - stick.oy;
      var d = Math.sqrt(dx * dx + dy * dy);
      var max = 52;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      stick.x = dx / max; stick.y = dy / max;
      stickKnob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      ev.preventDefault();
    }
  }
  function touchEnd(ev) {
    for (var i = 0; i < ev.changedTouches.length; i++) {
      if (ev.changedTouches[i].identifier !== stick.id) continue;
      stick.active = false; stick.x = 0; stick.y = 0;
      stickEl.hidden = true;
    }
  }
  canvas.addEventListener('touchstart', touchStart, { passive: true });
  window.addEventListener('touchmove', touchMove, { passive: false });
  window.addEventListener('touchend', touchEnd);
  window.addEventListener('touchcancel', touchEnd);

  // ── 마우스 (수동 조준) ───────────────────────────────────────
  // 화면 좌표를 월드 좌표로 바꿔 둡니다. 카메라 축척(CAM_ZOOM)의 역변환입니다.
  function trackMouse(ev) {
    G.mouse.sx = ev.clientX;
    G.mouse.sy = ev.clientY;
  }
  window.addEventListener('mousemove', trackMouse);
  // 우클릭으로도 조준 모드를 바꿀 수 있게 둡니다(메뉴는 막습니다).
  canvas.addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
    G.autoAim = !G.autoAim;
  });

  // HUD 의 E·R 버튼 (터치·클릭 공용)
  document.getElementById('skill-btn').addEventListener('pointerdown', function (e) { e.preventDefault(); G.useE(); });
  document.getElementById('ult-btn').addEventListener('pointerdown', function (e) { e.preventDefault(); G.useR(); });
  document.getElementById('pause-btn').addEventListener('pointerdown', function (e) { e.preventDefault(); UI.openPause(); });
  document.getElementById('aim-mode').addEventListener('pointerdown', function (e) {
    e.preventDefault(); G.autoAim = !G.autoAim;
  });

  // ── 루프 ─────────────────────────────────────────────────────
  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;

    var R = activeRenderer();

    if (G.p) {
      // 커서의 월드 좌표 — 수동 조준과 일부 스킬의 목표 지점으로 씁니다.
      // 2D 는 단순 나눗셈, 3D 는 바닥 평면 레이캐스트로 각자 계산합니다.
      var mw = R.screenToWorld(G, G.mouse.sx, G.mouse.sy);
      G.mouse.wx = mw.x;
      G.mouse.wy = mw.y;
    }
    if (G.p && G.state === 'playing') {
      var mx = 0, my = 0;
      for (var code in MOVE_KEYS) {
        if (keys[code]) { mx += MOVE_KEYS[code][0]; my += MOVE_KEYS[code][1]; }
      }
      if (stick.active) { mx += stick.x; my += stick.y; }
      G.p.moveX = U.clamp(mx, -1, 1);
      G.p.moveY = U.clamp(my, -1, 1);
    }

    G.update(dt);
    R.draw(G);
    if (G.p && G.state !== 'menu') UI.updateHud();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
