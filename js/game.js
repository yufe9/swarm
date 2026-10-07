// 게임 코어 — 상태, 루프, 스폰, 전투 판정.
// 렌더링은 render.js, 화면(UI)은 ui.js 가 담당합니다.
//
// **좌표는 리그 오브 레전드 단위입니다.** 챔피언 몸통 반지름이 약 55, 사거리 550이 근접,
// 1500이 최장거리입니다. 화면에는 CAM_ZOOM 으로 축소해 그립니다 (render.js).
// 체력도 원작 스케일이라 챔피언 기본 1000, 무기 한 방이 60~600 수준입니다.

// 맵 크기는 스테이지마다 다릅니다 (data.stages.js). startRun 에서 채워집니다.
var WORLD = { w: 13000, h: 13000 };

// 1 LoL 단위를 화면 몇 px 로 그릴지. 원작과 비슷한 시야(가로 약 2500 단위)를 만듭니다.
var CAM_ZOOM = 0.5;

var MAX_ENEMIES = 420;

// 무기 칸 — 원작과 같이 5칸이고, **챔피언 전용 무기가 그중 1칸을 차지합니다.**
var WEAPON_SLOTS = 5;

// 적의 탄환은 쏜 적이 무슨 색이든 항상 이 색으로만 그립니다.
// '붉고 뾰족한 것 = 나를 때리는 것' 이라는 규칙을 화면 전체에서 깨지 않기 위해서입니다.
var ENEMY_SHOT_COLOR = '#FF1E3C';

function Game(canvas) {
  this.cv = canvas;
  this.ctx = canvas.getContext('2d');
  this.state = 'menu';
  this.grid = new SpatialGrid(140);
  this._q = [];        // 그리드 질의 결과 재사용 버퍼
  this.vw = 1280; this.vh = 720;
  this.cam = { x: 0, y: 0, shake: 0 };
  this.autoAim = true;                 // C 키로 토글. 원작과 같습니다.
  this.mouse = { sx: 0, sy: 0, wx: 0, wy: 0 };
  this.meta = loadMeta();
  this.reset();
}

// ── 판 초기화 ───────────────────────────────────────────────────
Game.prototype.reset = function () {
  this.t = 0;
  this.enemies = [];
  this.bullets = [];
  this.ebullets = [];
  this.pickups = [];
  this.mines = [];
  this.zones = [];
  this.tentacles = [];
  this.feathers = [];
  this.windwalls = [];
  this.beams = [];
  this.fx = [];
  this.texts = [];
  this.timers = [];
  this.boss = null;
  this.shopObj = null;
  this.shopCount = 0;
  this.spawnAcc = 0;
  this.eventIdx = 0;
  this.levelQueue = 0;
  this.evoQueue = 0;          // 접근 카드로 열린 진화 선택 횟수
  this.bossSpawned = false;
  this.gimmicks = [];
  this.flash = 0;
  this.announceT = 0;
  this.stats = { kills: 0, goldEarned: 0, dmg: 0, bossKills: 0, evolutions: 0, crates: 0, cards: 0, elites: 0 };
};

Game.prototype.startRun = function (champId, diffId, stageId) {
  this.reset();
  var champ = CHAMPION_BY_ID[champId];
  var diff = null;
  for (var i = 0; i < DIFFICULTIES.length; i++) if (DIFFICULTIES[i].id === diffId) diff = DIFFICULTIES[i];
  this.diff = diff || DIFFICULTIES[0];
  this.champ = champ;
  this.stage = STAGE_BY_ID[stageId] || STAGES[0];
  WORLD.w = this.stage.size;
  WORLD.h = this.stage.size;

  var m = metaStats(this.meta);
  var st = makeStats(m, champ);
  var baseHp = Math.round(champ.hp * m.hpMul);
  var p = {
    champ: champ,
    x: WORLD.w / 2, y: WORLD.h / 2, vx: 0, vy: 0, r: 55, face: 0,
    baseMaxHp: baseHp, maxHp: baseHp, hp: baseHp,
    shield: 0, shieldT: 0,
    level: 1, xp: 0, xpNeed: xpNeedFor(1),
    gold: Math.round(m.startGold),
    // [0] 은 항상 챔피언 전용 무기입니다. 원작처럼 5칸 중 1칸을 차지합니다.
    weapons: [{ id: champ.weapon, lvl: 1, evolved: false, t: 0 }],
    perks: {},              // 지속 효과 id -> 레벨(1~5). 최대 PERK_SLOTS 종류
    cards: 0,               // 접근 카드 보유 수
    st: st,
    eT: 0, eCharges: champ.e.charges || 0, eChargeT: 0, rT: 0,
    dashT: 0, dashAng: 0, dashPower: 1,
    iframe: 0, hitFlash: 0, regenAcc: 0,
    moveX: 0, moveY: 0, dead: false,
    px: {}                  // 챔피언 패시브가 쓰는 상태 보관함
  };
  this.p = p;
  this.cam.x = p.x; this.cam.y = p.y;
  this.state = 'playing';
  this.generateObstacles();
  this.buildGimmicks();
  if (champ.passive.init) champ.passive.init(this, p);
  this.announce(this.stage.name);
};

// 스테이지 고유 기믹 — 회복 지대 / 냉각 장치 / 지원 포격.
Game.prototype.buildGimmicks = function () {
  this.gimmicks = [];
  var s = this.stage;
  if (!s.gimmick || !s.zones) return;
  for (var i = 0; i < s.zones.length; i++) {
    this.gimmicks.push({
      kind: s.gimmick,
      x: s.zones[i][0] * WORLD.w,
      y: s.zones[i][1] * WORLD.h,
      r: s.gimmick === 'heal' ? 700 : 900,
      t: 0, pulse: 0
    });
  }
};

Game.prototype.updateGimmicks = function (dt) {
  var p = this.p;
  for (var i = 0; i < this.gimmicks.length; i++) {
    var gm = this.gimmicks[i];
    gm.pulse += dt;
    gm.t -= dt;
    if (gm.t > 0) continue;

    if (gm.kind === 'heal') {
      gm.t = 1;
      // 물류 창고 지구 — 중앙에 서 있으면 계속 회복합니다.
      if (U.dist(p.x, p.y, gm.x, gm.y) < gm.r) {
        this.healPlayer(p.maxHp * 0.05);
        this.ring(p.x, p.y, 180, '#8BE3A8');
      }
    } else if (gm.kind === 'freeze') {
      gm.t = 2;
      // 지하 세계 실험실 — 냉각 장치가 범위 안의 적을 얼립니다.
      var list = this.enemiesInCircle(gm.x, gm.y, gm.r);
      if (!list.length) continue;
      for (var j = 0; j < list.length; j++) list[j].freezeT = Math.max(list[j].freezeT, 1.6);
      this.pulse(gm.x, gm.y, gm.r, '#7FE0D4');
    } else if (gm.kind === 'cannon') {
      gm.t = 4;
      // 외곽 지대 / 상륙지 — 성벽에서 플레이어 주변으로 포격 지원이 들어옵니다.
      if (U.dist(p.x, p.y, gm.x, gm.y) > WORLD.w * 0.75) continue;
      var self = this;
      for (var k = 0; k < 3; k++) {
        (function (idx) {
          var a = U.rand(0, U.TAU), d = U.rand(200, 900);
          var tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d;
          self.ring(tx, ty, 320, '#FFD98E');
          self.delay(0.6 + idx * 0.2, function () {
            self.damageCircle(tx, ty, 320, 900 * self.diff.reward, { color: '#FFD98E', knock: 400 });
            self.boom(tx, ty, 320, '#FFD98E');
          });
        })(k);
      }
    }
  }
};

function xpNeedFor(level) {
  return Math.round(6 + level * 5 + Math.pow(level, 1.72));
}

// 영구 강화를 반영한 시작 보정치.
function metaStats(meta) {
  var st = { hpMul: 1, dmgMul: 1, speedMul: 1, haste: 0, armor: 0, goldMul: 1, xpMul: 1, crit: 0, startGold: 0 };
  for (var i = 0; i < META_UPGRADES.length; i++) {
    var u = META_UPGRADES[i];
    var lv = meta.up[u.id] || 0;
    if (lv > 0) u.apply(st, lv);
  }
  return st;
}

// 전투 중 쓰이는 능력치 묶음.
//
// dmgMul / asMul / areaMul 은 getter 입니다. 챔피언 패시브(룬 검, 생존 본능 …)처럼
// '매 순간 변하는 보정'이 걸리기 때문입니다. 저장된 값(_dmg 등)과 순간 보정(_bf 등)을
// 나눠 두면, 지속 효과가 `st.dmgMul *= 1.1` 처럼 평범하게 곱해도 정확히 누적됩니다.
//
// **스킬 가속(haste)이 공격 속도를 겸합니다.** 본 모드에선 기본 공격도 무기 판정이라
// 원작과 같이 하나의 능력치가 둘 다 줄입니다. asMul = 1 + haste/100, cdrMul = 1/asMul.
function makeStats(m, champ) {
  var st = {
    _dmg: m.dmgMul, _bf: 1,
    _asf: 1,
    _area: 1, _areaf: 1,
    haste: m.haste,
    armor: champ.armor + m.armor,
    speedMul: m.speedMul,
    durMul: 1,
    pickupMul: 1, goldMul: m.goldMul, xpMul: m.xpMul,
    projAdd: 0, pierceAdd: 0,
    crit: 0.05 + m.crit, critDmg: 1.75,
    regenPct: 0, lifesteal: 0, thorns: 0,
    echo: 0                 // 세라핀 패시브 — 투사체를 한 번 더 발사할 확률
  };
  Object.defineProperty(st, 'dmgMul', {
    get: function () { return this._dmg * this._bf; },
    set: function (v) { this._dmg = v / this._bf; },
    enumerable: true
  });
  Object.defineProperty(st, 'asMul', {
    get: function () { return (1 + this.haste / 100) * this._asf; },
    enumerable: true
  });
  Object.defineProperty(st, 'cdrMul', {
    get: function () { return 1 / this.asMul; },
    enumerable: true
  });
  Object.defineProperty(st, 'areaMul', {
    get: function () { return this._area * this._areaf; },
    set: function (v) { this._area = v / this._areaf; },
    enumerable: true
  });
  return st;
}

// ── 메인 업데이트 ───────────────────────────────────────────────
Game.prototype.update = function (dt) {
  if (this.state !== 'playing') return;
  if (dt > 1 / 20) dt = 1 / 20; // 탭 전환 등으로 튀는 프레임 방지
  this.t += dt;

  this.runTimers(dt);
  this.updatePlayer(dt);
  this.updateWeapons(dt);
  this.updateSpawning(dt);
  this.rebuildGrid();
  this.updateEnemies(dt);
  this.updateBullets(dt);
  this.updateEnemyBullets(dt);
  this.updateMines(dt);
  this.updateZones(dt);
  this.updateTentacles(dt);
  this.updateFeathers(dt);
  this.updateWindwalls(dt);
  this.updatePickups(dt);
  this.updateGimmicks(dt);
  this.updateFx(dt);
  this.updateCamera(dt);
  this.checkShop();

  // 원작처럼 15분에 그 스테이지의 최종 보스가 등장합니다. 잡아야 승리입니다.
  if (this.t >= RUN_LENGTH && !this.boss && !this.bossSpawned && this.state === 'playing') {
    this.bossSpawned = true;
    this.spawnBoss(this.stage.boss);
  }
};

Game.prototype.runTimers = function (dt) {
  for (var i = this.timers.length - 1; i >= 0; i--) {
    var tm = this.timers[i];
    tm.t -= dt;
    if (tm.t <= 0) { tm.fn(); U.swapPop(this.timers, i); }
  }
};
Game.prototype.delay = function (t, fn) { this.timers.push({ t: t, fn: fn }); };

// ── 플레이어 ────────────────────────────────────────────────────
Game.prototype.updatePlayer = function (dt) {
  var p = this.p, st = p.st;
  var pas = p.champ.passive;

  // 챔피언 패시브를 먼저 돌린 뒤, 그 결과를 순간 보정값에 반영합니다.
  if (pas.tick) pas.tick(this, p, dt);
  st._bf = pas.dmgFactor ? pas.dmgFactor(this, p) : 1;
  st._asf = pas.asFactor ? pas.asFactor(this, p) : 1;
  st._areaf = pas.areaFactor ? pas.areaFactor(this, p) : 1;

  // 챔피언별 지속 상태
  this.tickChampState(dt);

  var speed = p.champ.speed * st.speedMul;
  if (p.px.surround > 0) speed *= 1.25;             // 세라핀 E
  if (p.px.spirit > 0) speed *= 1.4;                // 오로라 E
  if (p.px.exile > 0) speed *= 1.35;                // 리븐 R
  if (p.px.toxinMsN) speed *= 1 + p.px.toxinMsN;    // 맨발 화학 물질 분사기
  // 브라이어 생존 본능 — 잃은 체력에 비례해 최대 +100%
  if (p.champ.id === 'briar') speed *= 1 + 1.0 * (1 - p.hp / p.maxHp);
  // 징크스 신난다! — 남은 시간에 비례해 사그라드는 이동 속도
  if (p.px.excited > 0) speed *= 1 + 0.6 * (p.px.excited / 8);

  var px0 = p.x, py0 = p.y;
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += Math.cos(p.dashAng) * speed * p.dashPower * dt;
    p.y += Math.sin(p.dashAng) * speed * p.dashPower * dt;
    this.trail(p.x, p.y, p.champ.color);
  } else if (p.px.frenzy > 0) {
    // 브라이어 광분 — 조작이 막히고 가장 가까운 적에게 스스로 달려듭니다.
    var tgt = this.nearestEnemy(p.x, p.y, 2000);
    if (tgt) {
      var fa = U.angle(p.x, p.y, tgt.x, tgt.y);
      p.face = fa;
      p.x += Math.cos(fa) * speed * 1.15 * dt;
      p.y += Math.sin(fa) * speed * 1.15 * dt;
    }
  } else {
    var mx = p.moveX, my = p.moveY;
    var len = Math.sqrt(mx * mx + my * my);
    if (len > 1) { mx /= len; my /= len; }
    if (len > 0.01) p.face = Math.atan2(my, mx);
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
  }
  p.x = U.clamp(p.x, 100, WORLD.w - 100);
  p.y = U.clamp(p.y, 100, WORLD.h - 100);
  this.pushOutOfObstacles(p, p.r);
  // 실제 이동량 — 리븐 토끼뜀이 이 값으로 충전합니다.
  p.vx = (p.x - px0) / Math.max(dt, 0.0001);
  p.vy = (p.y - py0) / Math.max(dt, 0.0001);

  if (p.iframe > 0) p.iframe -= dt;
  if (p.hitFlash > 0) p.hitFlash -= dt;
  if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }

  // 스킬 재사용 대기시간 / 충전
  if (p.eT > 0) p.eT -= dt;
  if (p.champ.e.charges) {
    if (p.eCharges < p.champ.e.charges) {
      p.eChargeT -= dt;
      if (p.eChargeT <= 0) {
        p.eCharges++;
        if (p.eCharges < p.champ.e.charges) p.eChargeT = p.champ.e.cd * p.st.cdrMul;
      }
    }
  }
  if (p.rT > 0) p.rT -= dt;

  // 체력 재생 (최대 체력 비례)
  if (st.regenPct > 0 && p.hp < p.maxHp) {
    p.regenAcc += p.maxHp * st.regenPct * dt;
    if (p.regenAcc >= 1) { var h = Math.floor(p.regenAcc); p.regenAcc -= h; this.healPlayer(h, true); }
  }
};

// 챔피언 E/R 가 남긴 지속 상태를 한곳에서 정리합니다.
Game.prototype.tickChampState = function (dt) {
  var p = this.p, px = p.px;
  if (px.surround > 0) px.surround -= dt;
  if (px.spirit > 0) {
    px.spirit -= dt;
    // 오로라 E — 통과한 적에게 피해와 저주를 남깁니다.
    var list = this.enemiesInCircle(p.x, p.y, 220);
    for (var i = 0; i < list.length; i++) {
      if (!this.canHit(list[i], 'spirit', 0.4)) continue;
      this.hurtEnemy(list[i], 300 * p.st.dmgMul, { color: '#7EF2D8', curse: 6 * p.st.durMul });
    }
  }
  if (px.exile > 0) px.exile -= dt;
  if (px.gather > 0) px.gather -= dt;
  if (px.frenzy > 0) {
    px.frenzy -= dt;
    if (px.frenzy <= 0) {
      px.frenzyBoost = 0;
      this.damageCircle(p.x, p.y, 560 * p.st.areaMul, 700 * p.st.dmgMul, { color: '#E85C8A', knock: 420 });
      this.boom(p.x, p.y, 560 * p.st.areaMul, '#E85C8A');
      this.healPlayer(p.maxHp * 0.15);
    }
  }
  if (px.eclipse > 0) px.eclipse -= dt;
  // 맨발 화학 물질 분사기 중첩은 서서히 사라집니다.
  if (px.toxinMsN > 0) px.toxinMsN = Math.max(0, px.toxinMsN - dt * 0.12);
};

// 방어력을 피해 감소율로 환산합니다 (원작 공식과 같습니다).
Game.prototype.playerDR = function () {
  var a = this.p.st.armor * (this.p.px.eclipse > 0 ? 2 : 1);   // 레오나 E 는 방어력 2배
  return a / (100 + a);
};

// ── 스킬 ────────────────────────────────────────────────────────
Game.prototype.useE = function () {
  var p = this.p;
  if (this.state !== 'playing' || p.dead) return;
  var e = p.champ.e;
  if (e.charges) {
    if (p.eCharges <= 0) return;
    p.eCharges--;
    if (p.eChargeT <= 0) p.eChargeT = e.cd * p.st.cdrMul;
  } else {
    if (p.eT > 0) return;
    p.eT = e.cd * p.st.cdrMul;
  }
  e.use(this, p);
};

Game.prototype.useR = function () {
  var p = this.p;
  if (this.state !== 'playing' || p.dead || p.rT > 0) return;
  p.rT = p.champ.r.cd * p.st.cdrMul;
  p.champ.r.use(this, p);
};

Game.prototype.healPlayer = function (amount, quiet) {
  var p = this.p;
  var before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  var gained = p.hp - before;
  if (gained >= 1 && !quiet) this.text(p.x, p.y - 80, '+' + Math.round(gained), '#8BE3A8', 34);
};

Game.prototype.hurtPlayer = function (dmg, src) {
  var p = this.p;
  if (p.iframe > 0 || p.dead) return;
  dmg = dmg * (1 - this.playerDR()) * this.diff.dmg;
  if (p.px.frenzy > 0) dmg *= 0.75;          // 브라이어 광분 — 피해 감소 25%
  if (p.shield > 0) {
    var absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed; dmg -= absorbed;
    if (p.shield <= 0) p.shieldT = 0;
  }
  if (dmg > 0) p.hp -= dmg;
  p.iframe = 0.55;
  p.hitFlash = 0.25;
  this.shake(5);
  this.text(p.x, p.y - 90, '-' + Math.round(dmg), '#FF5C7A', 40);
  if (src) {
    var a = U.angle(src.x, src.y, p.x, p.y);
    p.x += Math.cos(a) * 40; p.y += Math.sin(a) * 40;
  }
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true;
    this.finish(false);
  }
};

// ── 무기 ────────────────────────────────────────────────────────
Game.prototype.updateWeapons = function (dt) {
  var ws = this.p.weapons;
  for (var i = 0; i < ws.length; i++) {
    var def = WEAPONS[ws[i].id];
    if (def) def.update(this, ws[i], dt);
  }
};

// ── 조준 ────────────────────────────────────────────────────────
//
// 원작처럼 C 키로 자동/수동을 바꿉니다.
//   자동 — 가장 가까운 적. 사거리 안에 아무도 없으면 aimAngle 이 null 을 돌려주고
//          무기는 발사를 건너뜁니다 (레오나 방패 타격이 허공을 치지 않는 이유).
//   수동 — 항상 마우스 커서 방향. 적이 없어도 쏩니다.
Game.prototype.aimAngle = function (x, y, range) {
  if (!this.autoAim) return U.angle(x, y, this.mouse.wx, this.mouse.wy);
  var e = this.nearestEnemy(x, y, range);
  return e ? U.angle(x, y, e.x, e.y) : null;
};

Game.prototype.aimTarget = function (x, y, range) {
  if (!this.autoAim) {
    return this.nearestEnemy(this.mouse.wx, this.mouse.wy, 700) || this.nearestEnemy(x, y, range);
  }
  return this.nearestEnemy(x, y, range);
};

// 스킬이 '지점'을 필요로 할 때 (레오나 R, 브라이어 R 등).
Game.prototype.aimPoint = function (x, y, range) {
  if (!this.autoAim) {
    var dx = this.mouse.wx - x, dy = this.mouse.wy - y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = Math.min(1, range / d);
    return { x: x + dx * k, y: y + dy * k };
  }
  var e = this.nearestEnemy(x, y, range);
  if (e) return { x: e.x, y: e.y };
  return { x: x + Math.cos(this.p.face) * range * 0.4, y: y + Math.sin(this.p.face) * range * 0.4 };
};

// ── 스폰 ────────────────────────────────────────────────────────
Game.prototype.currentPool = function () {
  var pool = WAVES[0].pool;
  for (var i = 0; i < WAVES.length; i++) if (this.t >= WAVES[i].from) pool = WAVES[i].pool;
  return pool;
};

Game.prototype.updateSpawning = function (dt) {
  var rate = (1.1 + this.t / 60 * 1.35) * this.diff.rate;
  if (this.boss) rate *= 0.45;
  this.spawnAcc += rate * dt;
  var pool = this.currentPool();
  while (this.spawnAcc >= 1) {
    this.spawnAcc -= 1;
    if (this.enemies.length < MAX_ENEMIES) this.spawnAt(U.weighted(pool), null, null);
  }
  while (this.eventIdx < EVENTS.length && this.t >= EVENTS[this.eventIdx].t) {
    this.runEvent(EVENTS[this.eventIdx]);
    this.eventIdx++;
  }
};

Game.prototype.runEvent = function (ev) {
  var i;
  if (ev.type === 'elite') {
    this.announce(ev.label || '정예병 출현!');
    for (i = 0; i < ev.n; i++) this.spawnAt(ev.enemy, null, null);
  } else if (ev.type === 'swarm') {
    this.announce(ev.label || '대규모 습격!');
    for (i = 0; i < ev.n; i++) {
      if (this.enemies.length < MAX_ENEMIES) this.spawnAt(ev.enemy || 'minion', null, null);
    }
  } else if (ev.type === 'boss') {
    this.spawnBoss(ev.id);
  } else if (ev.type === 'shop') {
    this.spawnShop();
  }
};

// 화면 밖 링 위의 한 지점. 원작처럼 카메라 바로 바깥에서 스폰합니다.
Game.prototype.offscreenPoint = function () {
  var p = this.p;
  var rad = Math.max(this.vw, this.vh) / CAM_ZOOM * 0.62 + U.rand(100, 500);
  for (var tries = 0; tries < 8; tries++) {
    var a = U.rand(0, U.TAU);
    var x = p.x + Math.cos(a) * rad, y = p.y + Math.sin(a) * rad;
    if (x > 80 && y > 80 && x < WORLD.w - 80 && y < WORLD.h - 80) return { x: x, y: y };
  }
  return {
    x: U.clamp(p.x + U.rand(-rad, rad), 80, WORLD.w - 80),
    y: U.clamp(p.y + U.rand(-rad, rad), 80, WORLD.h - 80)
  };
};

Game.prototype.spawnAt = function (typeId, x, y) {
  var def = ENEMY_TYPES[typeId];
  if (!def) return null;
  if (x === null || x === undefined) { var pt = this.offscreenPoint(); x = pt.x; y = pt.y; }
  // 적 체력 증가 곡선. 선형으로 두면 후반에 플레이어 화력이 일방적으로 앞질러
  // 가만히 서 있어도 클리어됩니다. 그래서 뒤로 갈수록 가팔라지는 항을 더했습니다.
  var m = this.t / 60;
  var mul = (1 + m * 0.32 + Math.pow(m, 1.85) * 0.04) * this.diff.hp;
  var e = {
    type: typeId, def: def, boss: false, elite: !!def.elite,
    x: x, y: y, vx: 0, vy: 0, r: def.r,
    hp: def.hp * mul, maxHp: def.hp * mul,
    dmg: def.dmg * (1 + this.t / 300),
    speed: def.speed * U.rand(0.92, 1.08),
    slow: 0, slowT: 0, stun: 0, freezeT: 0, kx: 0, ky: 0,
    hc: {}, flash: 0, burn: 0, burnT: 0, bleedN: 0, bleedT: 0, bleedDmg: 0,
    curseT: 0, sunT: 0, sunDmg: 0, gatN: 0, corpseDmg: 0, goldChance: 0, xpBonus: 0,
    fireT: U.rand(0.5, 2), fuse: 0, touchT: 0,
    wob: U.rand(0, U.TAU), spawnT: 0.25
  };
  this.enemies.push(e);
  return e;
};

Game.prototype.spawnBoss = function (id) {
  var def = BOSSES[id];
  if (!def) return;
  var pt = this.offscreenPoint();
  var mul = (1 + this.t / 240 * 0.3) * this.diff.hp;
  var e = {
    type: id, def: def, boss: true, elite: false,
    x: pt.x, y: pt.y, vx: 0, vy: 0, r: def.r,
    hp: def.hp * mul, maxHp: def.hp * mul,
    dmg: def.dmg, speed: def.speed,
    slow: 0, slowT: 0, stun: 0, freezeT: 0, kx: 0, ky: 0,
    hc: {}, flash: 0, burn: 0, burnT: 0, bleedN: 0, bleedT: 0, bleedDmg: 0,
    curseT: 0, sunT: 0, sunDmg: 0, gatN: 0, corpseDmg: 0, goldChance: 0, xpBonus: 0,
    patT: 3, pattern: null, patPhase: 0, chargeAng: 0,
    wob: 0, spawnT: 0.4
  };
  this.enemies.push(e);
  this.boss = e;
  this.announce(def.name + ' · ' + (def.title || '') + ' 등장!');
  this.shake(18);
};

Game.prototype.spawnShop = function () {
  var p = this.p;
  var a = U.rand(0, U.TAU), d = U.rand(700, 1200);
  this.shopObj = {
    x: U.clamp(p.x + Math.cos(a) * d, 300, WORLD.w - 300),
    y: U.clamp(p.y + Math.sin(a) * d, 300, WORLD.h - 300),
    r: 120, pulse: 0
  };
  this.announce('보급 상점이 열렸습니다');
};

// ── 적 ──────────────────────────────────────────────────────────
Game.prototype.rebuildGrid = function () {
  this.grid.clear();
  for (var i = 0; i < this.enemies.length; i++) this.grid.insert(this.enemies[i]);
};

Game.prototype.updateEnemies = function (dt) {
  var p = this.p, st = p.st;
  var q = [];
  for (var i = this.enemies.length - 1; i >= 0; i--) {
    var e = this.enemies[i];
    if (e.hp <= 0) { U.swapPop(this.enemies, i); continue; }

    if (e.spawnT > 0) e.spawnT -= dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
    if (e.stun > 0) e.stun -= dt;
    if (e.freezeT > 0) e.freezeT -= dt;
    if (e.curseT > 0) e.curseT -= dt;
    if (e.sunT > 0) e.sunT -= dt;

    // 화상 / 출혈 지속 피해
    if (e.burnT > 0) {
      e.burnT -= dt;
      this.hurtEnemy(e, e.burn * dt, { quiet: true, color: '#FF7A3D', noLifesteal: true });
      if (e.hp <= 0) continue;
    }
    if (e.bleedT > 0) {
      e.bleedT -= dt;
      e.bleedAcc = (e.bleedAcc || 0) + dt;
      if (e.bleedAcc >= 0.25) {
        e.bleedAcc -= 0.25;
        this.hurtEnemy(e, e.bleedDmg * e.bleedN, { quiet: true, color: '#E85C8A', noLifesteal: true });
        if (e.hp <= 0) continue;
      }
      if (e.bleedT <= 0) e.bleedN = 0;
    }

    var frozen = e.freezeT > 0;
    var slowF = frozen ? 0 : (1 - e.slow);
    var sp = e.speed * slowF;
    var dx = p.x - e.x, dy = p.y - e.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;

    if (e.stun <= 0 && e.spawnT <= 0 && !frozen) {
      if (e.boss) {
        this.bossAI(e, dt, d);
      } else if (e.def.kind === 'ranged') {
        var want = e.def.range * 0.75;
        var dir = d > want + 100 ? 1 : (d < want - 150 ? -1 : 0);
        e.x += (dx / d) * sp * dir * dt;
        e.y += (dy / d) * sp * dir * dt;
        e.fireT -= dt;
        if (e.fireT <= 0 && d < e.def.range * 1.2) {
          e.fireT = e.def.fireCd * U.rand(0.85, 1.15);
          this.enemyShoot(e, d);
        }
      } else if (e.def.kind === 'bomber') {
        if (d < 120 || e.fuse > 0) {
          e.fuse += dt;
          if (e.fuse >= e.def.fuse) { this.bomberBlast(e); continue; }
        } else {
          e.x += (dx / d) * sp * dt; e.y += (dy / d) * sp * dt;
        }
      } else if (e.def.kind === 'flee') {
        // 화수분 — 패턴 없이 도망만 칩니다.
        e.x -= (dx / d) * sp * dt;
        e.y -= (dy / d) * sp * dt;
      } else if (e.def.kind === 'charger') {
        // 해마·딱정벌레 — 한 방향으로 가속하며 돌진합니다.
        if (!e.chargeAng || e.chargeT <= 0) {
          e.chargeAng = U.angle(e.x, e.y, p.x, p.y);
          e.chargeT = e.def.chargeTime || 3;
          e.chargeSp = sp;
          this.ring(e.x, e.y, e.r * 2, e.def.color);
        }
        e.chargeT -= dt;
        e.chargeSp = Math.min(sp * 3.2, e.chargeSp + sp * 1.4 * dt);
        e.x += Math.cos(e.chargeAng) * e.chargeSp * dt;
        e.y += Math.sin(e.chargeAng) * e.chargeSp * dt;
        this.trail(e.x, e.y, e.def.color);
      } else {
        e.wob += dt * 3;
        var ox = Math.cos(e.wob) * 0.18;
        e.x += ((dx / d) + ox * (-dy / d)) * sp * dt;
        e.y += ((dy / d) + ox * (dx / d)) * sp * dt;
      }
    }

    // 넉백 감쇠
    if (e.kx || e.ky) {
      e.x += e.kx * dt; e.y += e.ky * dt;
      var damp = Math.pow(0.0008, dt);
      e.kx *= damp; e.ky *= damp;
      if (Math.abs(e.kx) < 8) e.kx = 0;
      if (Math.abs(e.ky) < 8) e.ky = 0;
    }

    e.x = U.clamp(e.x, 30, WORLD.w - 30);
    e.y = U.clamp(e.y, 30, WORLD.h - 30);
    if (!e.boss) this.pushOutOfObstacles(e, e.r);
    if (!e.boss) this.blockByWindwall(e);

    // 서로 겹치지 않게 밀어냅니다 (군집 처리).
    if (!e.boss) {
      this.grid.query(e.x, e.y, e.r * 2, q);
      for (var j = 0; j < q.length; j++) {
        var o = q[j];
        if (o === e || o.boss) continue;
        var ddx = o.x - e.x, ddy = o.y - e.y;
        var dd2 = ddx * ddx + ddy * ddy;
        var min = e.r + o.r;
        if (dd2 > min * min || dd2 < 0.0001) continue;
        var dd = Math.sqrt(dd2);
        var push = (min - dd) * 0.5;
        var nx = ddx / dd, ny = ddy / dd;
        e.x -= nx * push; e.y -= ny * push;
        o.x += nx * push; o.y += ny * push;
      }
    }

    // 플레이어 접촉 피해
    var touchDist = e.r + p.r;
    if (d < touchDist) {
      e.touchT -= dt;
      if (e.touchT <= 0) {
        e.touchT = 0.55;
        this.hurtPlayer(e.dmg * (e.def.kind === 'charger' ? 2.2 : 1), e);
        if (e.def.kind === 'charger') { e.stun = 1.2; e.chargeT = 0; e.chargeAng = 0; }
      }
      if (st.thorns > 0) this.hurtEnemy(e, st.thorns * dt, { quiet: true, color: '#F3C96B', noLifesteal: true });
    }
  }
};

Game.prototype.enemyShoot = function (e, d) {
  var p = this.p;
  var base = U.angle(e.x, e.y, p.x, p.y);
  var n = e.def.spread || 1;
  for (var i = 0; i < n; i++) {
    // 거미탄은 사방으로 뿌립니다. 나머지는 플레이어 쪽 원뿔.
    var a = e.def.radial ? base + (U.TAU / n) * i : base + (i - (n - 1) / 2) * 0.18;
    this.ebullets.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * e.def.bulletSpeed, vy: Math.sin(a) * e.def.bulletSpeed,
      r: e.elite ? 36 : 26, dmg: e.dmg * 0.8, life: 4, color: ENEMY_SHOT_COLOR
    });
  }
  // 용트림의 곡사포 — 착탄 지점을 예고하고 터집니다.
  if (e.def.lob) {
    var lx = p.x, ly = p.y, self = this;
    this.ring(lx, ly, 300, ENEMY_SHOT_COLOR);
    this.delay(1.1, function () {
      if (U.dist(lx, ly, self.p.x, self.p.y) < 300 + self.p.r) self.hurtPlayer(e.dmg, null);
      self.boom(lx, ly, 300, ENEMY_SHOT_COLOR);
    });
  }
};

Game.prototype.bomberBlast = function (e) {
  var d = U.dist(e.x, e.y, this.p.x, this.p.y);
  if (d < e.def.blast + this.p.r) this.hurtPlayer(e.dmg, e);
  this.boom(e.x, e.y, e.def.blast, '#7CFF6B');
  // 원작의 독두꺼비 — 죽은 자리에 독 웅덩이를 남깁니다.
  if (e.def.poolDmg) {
    this.spawnZone(e.x, e.y, e.def.blast, e.def.poolDmg * (1 + this.t / 300), 6, '#7CFF6B', 'poison', true);
  }
  this.shake(6);
  e.hp = 0;
  this.killEnemy(e, true);
};

// 보스 패턴 — 각 보스의 실제 스킬입니다.
Game.prototype.bossAI = function (e, dt, d) {
  var p = this.p;
  var self = this;
  e.patT -= dt;

  if (e.pattern === 'charge') {
    e.patPhase -= dt;
    if (e.patPhase > 0.7) {
      // 준비 동작
    } else if (e.patPhase > 0) {
      e.x += Math.cos(e.chargeAng) * e.speed * 6.5 * dt;
      e.y += Math.sin(e.chargeAng) * e.speed * 6.5 * dt;
      this.trail(e.x, e.y, e.def.color);
      if (d < e.r + p.r + 30) this.hurtPlayer(e.dmg * 1.3, e);
    } else { e.pattern = null; }
    return;
  }

  if (e.pattern === 'burrow') {
    e.patPhase -= dt;
    e.hidden = e.patPhase > 0.5;
    if (e.patPhase <= 0.5 && !e.surfaced) {
      e.surfaced = true;
      e.x = p.x + U.rand(-120, 120);
      e.y = p.y + U.rand(-120, 120);
      this.ring(e.x, e.y, 400, e.def.color);
    }
    if (e.patPhase <= 0) {
      e.pattern = null; e.hidden = false; e.surfaced = false;
      if (U.dist(e.x, e.y, p.x, p.y) < 440 + p.r) this.hurtPlayer(e.dmg * 1.2, e);
      this.boom(e.x, e.y, 440, e.def.color);
      this.shake(12);
    }
    return;
  }

  var dx = p.x - e.x, dy = p.y - e.y;
  var dd = Math.sqrt(dx * dx + dy * dy) || 1;
  var sp = e.speed * (1 - e.slow * 0.5);
  if (d > e.r + 160) { e.x += (dx / dd) * sp * dt; e.y += (dy / dd) * sp * dt; }

  if (e.patT > 0) return;
  var pat = U.pick(e.def.patterns);
  e.patT = U.rand(3.2, 4.8);

  if (pat === 'charge') {
    e.pattern = 'charge'; e.patPhase = 1.5;
    e.chargeAng = U.angle(e.x, e.y, p.x, p.y);
    this.ring(e.x, e.y, e.r + 80, e.def.color);

  } else if (pat === 'burrow') {
    e.pattern = 'burrow'; e.patPhase = 1.6; e.surfaced = false;
    this.boom(e.x, e.y, e.r * 1.6, e.def.color);

  } else if (pat === 'spray') {
    var n = 20;
    for (var i = 0; i < n; i++) {
      var a = (U.TAU / n) * i + U.rand(-0.05, 0.05);
      this.ebullets.push({
        x: e.x, y: e.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
        r: 30, dmg: e.dmg * 0.55, life: 5, color: ENEMY_SHOT_COLOR
      });
    }
    this.shake(5);

  } else if (pat === 'spikes') {
    var base = U.angle(e.x, e.y, p.x, p.y);
    for (var s2 = 0; s2 < 9; s2++) {
      var sa = base + (s2 - 4) * 0.13;
      this.ebullets.push({
        x: e.x, y: e.y, vx: Math.cos(sa) * 800, vy: Math.sin(sa) * 800,
        r: 26, dmg: e.dmg * 0.6, life: 3, color: ENEMY_SHOT_COLOR
      });
    }

  } else if (pat === 'summon') {
    for (var k = 0; k < 7; k++) {
      var a2 = U.rand(0, U.TAU), dist = U.rand(200, 450);
      if (this.enemies.length < MAX_ENEMIES) {
        this.spawnAt(U.pick(e.def.summons || ['minion']), e.x + Math.cos(a2) * dist, e.y + Math.sin(a2) * dist);
      }
    }

  } else if (pat === 'rupture') {
    var px = p.x, py = p.y;
    var col = e.def.color;
    this.ring(px, py, 380, col);
    this.delay(0.9, function () {
      if (U.dist(px, py, self.p.x, self.p.y) < 380 + self.p.r) self.hurtPlayer(e.dmg * 0.9, null);
      self.spawnZone(px, py, 380, e.dmg * 0.5, 4, col, 'rupture', true);
      self.boom(px, py, 380, col);
      self.shake(8);
    });

  } else if (pat === 'laser') {
    var lb = U.angle(e.x, e.y, p.x, p.y);
    for (var b = 0; b < 4; b++) {
      (function (ang) {
        self.delay(0.6 + b * 0.18, function () {
          var ex = e.x + Math.cos(ang) * 5000, ey = e.y + Math.sin(ang) * 5000;
          self.beam(e.x, e.y, ex, ey, 70, ENEMY_SHOT_COLOR, 0.35, false);
          if (self.pointNearLine(self.p.x, self.p.y, e.x, e.y, ex, ey) < 70 + self.p.r) self.hurtPlayer(e.dmg, e);
        });
      })(lb + (U.TAU / 4) * b);
    }
  }
};

// ── 피해 처리 ───────────────────────────────────────────────────
Game.prototype.canHit = function (e, key, cd) {
  var until = e.hc[key] || 0;
  if (until > this.t) return false;
  e.hc[key] = this.t + cd;
  return true;
};

Game.prototype.hurtEnemy = function (e, dmg, o) {
  if (e.hp <= 0) return;
  o = o || {};
  var p = this.p, st = p.st;

  var crit = false;
  if (!o.quiet) {
    var chance = st.crit + (o.critBonus || 0);
    if (chance > 0 && Math.random() < chance) {
      crit = true;
      dmg *= st.critDmg;
      if (p.champ.passive.onCrit) p.champ.passive.onCrit(this, p, e);
    }
  }
  if (e.def.dr) dmg *= (1 - e.def.dr);

  e.hp -= dmg;
  e.flash = 0.09;
  this.stats.dmg += dmg;

  // 레오나 햇빛 — 걸려 있으면 다른 공격이 터뜨립니다.
  if (e.sunT > 0 && !o.sun) {
    e.sunT = 0;
    var sd = e.sunDmg * st.dmgMul;
    e.hp -= sd;
    this.stats.dmg += sd;
    this.ring(e.x, e.y, 180, '#FFC24D');
    this.text(e.x, e.y - e.r - 60, Math.round(sd), '#FFC24D', 42, true);
  }
  if (o.sun) { e.sunT = 4 * st.durMul; e.sunDmg = o.sun; }

  // 상태 부여
  if (o.slow) { e.slow = Math.max(e.slow, o.slow); e.slowT = Math.max(e.slowT, o.slowT || 1); }
  if (o.curse) e.curseT = Math.max(e.curseT, o.curse);
  if (o.burn) { e.burn = Math.max(e.burn, o.burn); e.burnT = 2.2; }
  if (o.bleed) { e.bleedN = Math.min(10, e.bleedN + 1); e.bleedDmg = o.bleed; e.bleedT = o.bleedT || 8; }
  if (o.stun) e.stun = Math.max(e.stun, o.stun);
  if (o.corpse) e.corpseDmg = Math.max(e.corpseDmg, o.corpse);
  if (o.goldChance) e.goldChance = Math.max(e.goldChance, o.goldChance);
  if (o.xpBonus) e.xpBonus = Math.max(e.xpBonus, o.xpBonus);
  if (o.healDrop) {
    e.healAcc = (e.healAcc || 0) + dmg;
    if (e.healAcc >= o.healDrop) { e.healAcc = 0; this.dropItem(e.x, e.y, 'heal'); }
  }
  // 개틀링 토끼 건 진화 — 맞을수록 둔화가 쌓이고 결국 기절합니다.
  if (o.gatling) {
    e.gatN++;
    if (e.gatN >= o.gatling.at) {
      e.gatN = 0;
      e.stun = Math.max(e.stun, o.gatling.dur);
      e.hp -= o.gatling.bonus;
      this.text(e.x, e.y - e.r - 60, Math.round(o.gatling.bonus), '#FF9F43', 42, true);
    }
  }

  if (o.knock && !e.boss) {
    var kr = 1 - (e.def.knockRes || 0);
    if (kr > 0) {
      var sx = o.kx !== undefined ? o.kx : p.x, sy = o.ky !== undefined ? o.ky : p.y;
      var ka = U.angle(sx, sy, e.x, e.y);
      e.kx += Math.cos(ka) * o.knock * kr;
      e.ky += Math.sin(ka) * o.knock * kr;
    }
  }

  // 챔피언 패시브 (리븐 룬 검 등)
  if (!o.quiet && p.champ.passive.onHit) p.champ.passive.onHit(this, p, e, dmg);
  if (st.lifesteal > 0 && !o.noLifesteal) this.healPlayer(dmg * st.lifesteal, true);

  if (!o.quiet) {
    this.text(e.x + U.rand(-20, 20), e.y - e.r - 20, Math.round(dmg),
      crit ? '#FFE066' : '#FFFFFF', crit ? 44 : 28, crit);
    this.hitSpark(e.x, e.y, o.color || '#FFFFFF');
  }

  if (e.hp <= 0) this.killEnemy(e);
};

Game.prototype.killEnemy = function (e, noDrop) {
  var p = this.p;
  this.stats.kills++;
  this.boom(e.x, e.y, e.r * (e.boss ? 3 : 1.4), e.def.color);

  if (p.champ.passive.onKill) p.champ.passive.onKill(this, p, e);

  // 폭발의 포옹 — 시체가 터집니다.
  if (e.corpseDmg > 0) {
    this.damageCircle(e.x, e.y, 320 * p.st.areaMul, e.corpseDmg, { color: '#FFE066', quiet: true });
    this.boom(e.x, e.y, 320 * p.st.areaMul, '#FFE066');
  }

  if (!noDrop) {
    var xp = e.def.xp * this.diff.reward * (1 + (e.xpBonus || 0));
    this.dropXp(e.x, e.y, xp, e.boss || e.elite);
    var gAmt = e.def.gold * this.diff.reward;
    if (e.boss || e.elite) this.dropGold(e.x, e.y, gAmt, true);
    else if (U.chance(0.42 + (e.goldChance || 0))) this.dropGold(e.x, e.y, gAmt / 0.42);
    if (U.chance(e.boss ? 1 : 0.012)) this.dropItem(e.x, e.y, 'heal');
    if (U.chance(0.004)) this.dropItem(e.x, e.y, U.chance(0.5) ? 'magnet' : 'bomb');

    // **접근 카드** — 정예병과 미니 보스는 확정 드랍입니다 (원작과 동일).
    if (e.elite || e.boss) {
      this.dropItem(e.x, e.y, 'card');
      if (e.elite) this.stats.elites++;
    }
  }

  if (e.boss) {
    this.boss = null;
    this.stats.bossKills++;
    this.shake(24);
    this.announce(e.def.name + ' 격파!');
    for (var i = 0; i < 10; i++) {
      var a = U.rand(0, U.TAU), d = U.rand(60, 260);
      this.dropGold(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, e.def.gold / 10 * this.diff.reward, true);
    }
    if (e.def.final) this.delay(1.2, (function (self) { return function () { self.finish(true); }; })(this));
  }
};

Game.prototype.damageCircle = function (x, y, r, dmg, o) {
  o = o || {};
  var list = this.enemiesInCircle(x, y, r);
  for (var i = 0; i < list.length; i++) {
    if (dmg > 0) this.hurtEnemy(list[i], dmg, {
      knock: o.knock, kx: x, ky: y, color: o.color, stun: o.stun, quiet: o.quiet,
      critBonus: o.critBonus, sun: o.sun, curse: o.curse,
      slow: o.slow, slowT: o.slowT, bleed: o.bleed, bleedT: o.bleedT,
      corpse: o.corpse, goldChance: o.goldChance, xpBonus: o.xpBonus, minion: o.minion
    });
  }
  if (dmg > 0) this.hitObstacles(x, y, r, dmg);
  return list.length;
};

Game.prototype.damageArc = function (x, y, r, ang, arc, dmg, o) {
  o = o || {};
  var list = this.enemiesInCircle(x, y, r);
  var half = arc / 2;
  var n = 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (arc < U.TAU && Math.abs(U.angDiff(ang, U.angle(x, y, e.x, e.y))) > half) continue;
    n++;
    this.hurtEnemy(e, dmg, {
      knock: o.knock, kx: x, ky: y, color: o.color, quiet: o.quiet, stun: o.stun,
      critBonus: o.critBonus, sun: o.sun, slow: o.slow, slowT: o.slowT,
      bleed: o.bleed, bleedT: o.bleedT, gatling: o.gatling
    });
  }
  return n;
};

Game.prototype.damageLine = function (x1, y1, x2, y2, halfW, dmg, o) {
  o = o || {};
  var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  var rad = U.dist(x1, y1, x2, y2) / 2 + halfW + 120;
  var list = this.enemiesInCircle(mx, my, rad);
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (this.pointNearLine(e.x, e.y, x1, y1, x2, y2) > halfW + e.r) continue;
    this.hurtEnemy(e, dmg, {
      knock: o.knock, kx: x1, ky: y1, color: o.color, stun: o.stun,
      critBonus: o.critBonus, goldChance: o.goldChance
    });
  }
};

Game.prototype.pointNearLine = function (px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var l2 = dx * dx + dy * dy;
  if (l2 === 0) return U.dist(px, py, x1, y1);
  var t = U.clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return U.dist(px, py, x1 + t * dx, y1 + t * dy);
};

Game.prototype.nearestEnemy = function (x, y, range, exclude) {
  var best = null, bd = range * range;
  var list = this.grid.query(x, y, range, this._q);
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (e.hp <= 0) continue;
    if (exclude && exclude.indexOf(e) >= 0) continue;
    var d2 = U.dist2(x, y, e.x, e.y);
    if (d2 < bd) { bd = d2; best = e; }
  }
  if (!best && range > 700) {
    // 넓은 범위는 전수 검사로 한 번 더 확인합니다(적이 드문 경우).
    for (var j = 0; j < this.enemies.length; j++) {
      var e2 = this.enemies[j];
      if (e2.hp <= 0) continue;
      if (exclude && exclude.indexOf(e2) >= 0) continue;
      var d3 = U.dist2(x, y, e2.x, e2.y);
      if (d3 < bd) { bd = d3; best = e2; }
    }
  }
  return best;
};

// 체력이 가장 높은 적 (스태틱의 검, 진화 티버가 씁니다).
Game.prototype.toughestEnemy = function (x, y, range) {
  var best = null, bh = -1;
  var list = this.enemiesInCircle(x, y, range);
  for (var i = 0; i < list.length; i++) {
    if (list[i].hp > bh) { bh = list[i].hp; best = list[i]; }
  }
  return best;
};

Game.prototype.enemiesInCircle = function (x, y, r) {
  var out = [];
  var list = this.grid.query(x, y, r, this._q);
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (e.hp <= 0) continue;
    if (U.dist2(x, y, e.x, e.y) <= (r + e.r) * (r + e.r)) out.push(e);
  }
  return out;
};

// ── 투사체 ──────────────────────────────────────────────────────
Game.prototype.spawnBullet = function (o) {
  o.life = o.life || 2;
  o.maxLife = o.life;
  o.hits = null;
  o.pierce = o.pierce || 0;
  o.bounced = 0;
  this.bullets.push(o);
  // 세라핀 무대 장악 — 25% 확률로 한 번 더 나갑니다.
  if (this.p.st.echo > 0 && !o._echo && Math.random() < this.p.st.echo) {
    var c = {};
    for (var k in o) c[k] = o[k];
    c._echo = 1; c.hits = null; c.bounced = 0;
    c.x += U.rand(-20, 20); c.y += U.rand(-20, 20);
    this.bullets.push(c);
  }
};

Game.prototype.updateBullets = function (dt) {
  var q = [], p = this.p;
  for (var i = this.bullets.length - 1; i >= 0; i--) {
    var b = this.bullets[i];
    b.life -= dt;

    if (b.life <= 0) {
      if (b.aoe) this.explode(b);
      if (b.onEnd) b.onEnd(b.x, b.y);
      if (b.dropFeather) this.spawnFeather(b.x, b.y, b.dropFeather, b.featherLife);
      U.swapPop(this.bullets, i); continue;
    }

    // 유도
    if (b.homing) {
      if (!b.target || b.target.hp <= 0) b.target = this.nearestEnemy(b.x, b.y, 1200);
      if (b.target) this.steerBullet(b, U.angle(b.x, b.y, b.target.x, b.target.y), b.homing, dt);
    }
    // 커서 유도 (오로라 인도의 저주, 수동 조준)
    if (b.steer) this.steerBullet(b, U.angle(b.x, b.y, this.mouse.wx, this.mouse.wy), b.steer, dt);
    // 되돌아오는 투사체 — 수명의 절반에서 방향을 뒤집습니다.
    if (b.boomerang && !b.turned && b.life < b.maxLife * 0.5) {
      b.turned = 1; b.vx = -b.vx; b.vy = -b.vy; b.hits = null;
    }
    if (b.turned) this.steerBullet(b, U.angle(b.x, b.y, p.x, p.y), 8, dt);

    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.spin) b.rot = (b.rot || 0) + b.spin * dt;
    if (b.shape === 'rocket' && Math.random() < 0.6) this.puff(b.x, b.y, b.color, 10);

    // 벽 튕김 (메아리치는 박쥐칼날)
    if (b.bounce && b.bounced < b.bounce) {
      var hit = false;
      if (b.x < 60 || b.x > WORLD.w - 60) { b.vx = -b.vx; hit = true; }
      if (b.y < 60 || b.y > WORLD.h - 60) { b.vy = -b.vy; hit = true; }
      if (hit) {
        b.bounced++;
        b.hits = null;
        if (b.bounceRamp) b.dmg *= 1 + b.bounceRamp;
        b.x = U.clamp(b.x, 60, WORLD.w - 60);
        b.y = U.clamp(b.y, 60, WORLD.h - 60);
      }
    }

    // 탄환은 바위를 넘어가지만 나무 상자는 부숩니다.
    this.hitObstacles(b.x, b.y, b.r, b.dmg * 0.5);

    // 자야 진화 단검 — 돌아오면 보호막을 줍니다.
    if (b.shieldBack && b.turned && U.dist2(b.x, b.y, p.x, p.y) < (p.r + b.r) * (p.r + b.r)) {
      p.shield = Math.min(p.maxHp * 0.6, p.shield + b.shieldBack);
      p.shieldT = Math.max(p.shieldT, 3 * p.st.durMul);
      U.swapPop(this.bullets, i); continue;
    }

    this.grid.query(b.x, b.y, b.r + 80, q);
    for (var j = 0; j < q.length; j++) {
      var e = q[j];
      if (e.hp <= 0) continue;
      var rr = b.r + e.r;
      if (U.dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
      if (b.hits && b.hits.indexOf(e) >= 0) continue;

      this.hurtEnemy(e, b.dmg, {
        knock: b.knock, kx: b.x - b.vx * 0.01, ky: b.y - b.vy * 0.01, color: b.color,
        critBonus: b.critBonus, curse: b.curse, slow: b.slow, slowT: b.slowT,
        healDrop: b.healDrop, minion: b.minion
      });

      if (b.aoe) { this.explode(b); b.life = -1; break; }

      // 적 사이를 튕기는 단검(연인의 도탄)
      if (b.bounce && b.bounced < b.bounce) {
        b.bounced++;
        if (!b.hits) b.hits = [];
        b.hits.push(e);
        var nx = this.nearestEnemy(b.x, b.y, 900, b.hits);
        if (nx) {
          var na = U.angle(b.x, b.y, nx.x, nx.y);
          var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          b.vx = Math.cos(na) * spd; b.vy = Math.sin(na) * spd;
          continue;
        }
      }

      if (b.pierce > 0) {
        b.pierce--;
        if (!b.hits) b.hits = [];
        b.hits.push(e);
        if (b.falloff) b.dmg *= b.falloff;
      } else { b.life = -1; break; }
    }

    if (b.life <= 0) {
      if (b.onEnd) b.onEnd(b.x, b.y);
      if (b.dropFeather) this.spawnFeather(b.x, b.y, b.dropFeather, b.featherLife);
      U.swapPop(this.bullets, i); continue;
    }
    if (b.x < -400 || b.y < -400 || b.x > WORLD.w + 400 || b.y > WORLD.h + 400) U.swapPop(this.bullets, i);
  }
};

Game.prototype.steerBullet = function (b, want, rate, dt) {
  var cur = Math.atan2(b.vy, b.vx);
  var na = cur + U.clamp(U.angDiff(cur, want), -rate * dt, rate * dt);
  var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
  b.rot = na;
};

Game.prototype.explode = function (b) {
  this.damageCircle(b.x, b.y, b.aoe.r, b.aoe.dmg, { knock: 500, color: b.aoe.color });
  this.boom(b.x, b.y, b.aoe.r, b.aoe.color);
  this.shake(4);
};

Game.prototype.updateEnemyBullets = function (dt) {
  var p = this.p;
  for (var i = this.ebullets.length - 1; i >= 0; i--) {
    var b = this.ebullets[i];
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    // 야스오 바람 장막이 적 투사체를 막습니다.
    if (this.blockedByWindwall(b.x, b.y)) {
      this.puff(b.x, b.y, '#B6F2FF', 16);
      U.swapPop(this.ebullets, i); continue;
    }
    var rr = b.r + p.r;
    if (U.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
      this.hurtPlayer(b.dmg, b);
      this.puff(b.x, b.y, b.color, 20);
      U.swapPop(this.ebullets, i); continue;
    }
    if (b.life <= 0) U.swapPop(this.ebullets, i);
  }
};

// ── 지뢰 ────────────────────────────────────────────────────────
Game.prototype.spawnMine = function (o) {
  this.mines.push({
    x: o.x, y: o.y, r: 22, aoe: o.r, dmg: o.dmg, color: o.color,
    life: o.t, arm: 0.25, trigger: o.r * 0.55, blink: 0,
    chain: o.chain || 0, chainDmg: o.chainDmg || 0
  });
};

Game.prototype.updateMines = function (dt) {
  for (var i = this.mines.length - 1; i >= 0; i--) {
    var m = this.mines[i];
    m.life -= dt;
    m.arm -= dt;
    m.blink += dt;
    var trig = false;
    if (m.arm <= 0 && this.enemiesInCircle(m.x, m.y, m.trigger).length > 0) trig = true;
    if (trig || m.life <= 0) {
      this.damageCircle(m.x, m.y, m.aoe, m.dmg, { knock: 500, color: m.color });
      this.boom(m.x, m.y, m.aoe, m.color);
      // 진화 시 연쇄 폭발
      for (var c = 0; c < m.chain; c++) {
        (function (self, mm, idx) {
          self.delay(0.15 * (idx + 1), function () {
            var a = U.rand(0, U.TAU), d = U.rand(150, 400);
            var bx = mm.x + Math.cos(a) * d, by = mm.y + Math.sin(a) * d;
            self.damageCircle(bx, by, mm.aoe * 0.8, mm.chainDmg, { knock: 400, color: mm.color });
            self.boom(bx, by, mm.aoe * 0.8, mm.color);
          });
        })(this, m, c);
      }
      this.shake(3);
      U.swapPop(this.mines, i);
    }
  }
};

// ── 장판 ────────────────────────────────────────────────────────
Game.prototype.spawnZone = function (x, y, r, dmg, life, color, key, hostile) {
  this.zones.push({
    x: x, y: y, r: r, dmg: dmg, life: life, maxLife: life,
    color: color, key: key, hostile: !!hostile, t: 0
  });
};

Game.prototype.updateZones = function (dt) {
  var p = this.p;
  for (var i = this.zones.length - 1; i >= 0; i--) {
    var z = this.zones[i];
    z.life -= dt;
    z.t += dt;
    if (z.hostile) {
      var rr = z.r + p.r;
      if (U.dist2(z.x, z.y, p.x, p.y) < rr * rr && this.canHitPlayerZone(z, dt)) this.hurtPlayer(z.dmg, null);
    } else {
      var list = this.enemiesInCircle(z.x, z.y, z.r);
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (!this.canHit(e, 'zone' + z.key, 0.35)) continue;
        this.hurtEnemy(e, z.dmg * 0.35, { color: z.color, quiet: true });
        // 맨발 화학 물질 분사기 — 장판이 적을 때릴 때마다 보호막·이속이 쌓입니다.
        if (z.key === 'toxin' && p.px.toxinShield) {
          p.shield = Math.min(p.maxHp * 0.5, p.shield + p.maxHp * p.px.toxinShield);
          p.shieldT = Math.max(p.shieldT, 3 * p.st.durMul);
          p.px.toxinMsN = Math.min(0.4, (p.px.toxinMsN || 0) + p.px.toxinMs);
        }
      }
    }
    if (z.life <= 0) U.swapPop(this.zones, i);
  }
};

Game.prototype.canHitPlayerZone = function (z, dt) {
  z._acc = (z._acc || 0) + dt;
  if (z._acc >= 0.5) { z._acc = 0; return true; }
  return false;
};

// ── 맵 장애물 ───────────────────────────────────────────────────
// 바위·기둥은 플레이어와 적의 이동을 모두 막습니다. 투사체는 넘어갑니다
// (탄이 막히면 자동 공격 게임에서 답답함만 커지기 때문입니다).
// 나무 상자는 부술 수 있고 골드·회복·자석·폭탄을 떨어뜨립니다.
Game.prototype.generateObstacles = function () {
  this.obstacles = [];
  this.obGrid = new SpatialGrid(420);
  var cx = WORLD.w / 2, cy = WORLD.h / 2;
  var want = this.stage ? this.stage.obstacles : 420;
  var tries = 0;
  while (this.obstacles.length < want && tries++ < want * 15) {
    var x = U.rand(400, WORLD.w - 400), y = U.rand(400, WORLD.h - 400);
    if (U.dist(x, y, cx, cy) < 800) continue;      // 시작 지점 주변은 비워 둡니다
    var roll = Math.random();
    var kind = roll < 0.5 ? 'rock' : (roll < 0.78 ? 'pillar' : 'crate');
    var r = kind === 'pillar' ? U.rand(50, 68) : (kind === 'crate' ? 48 : U.rand(65, 120));
    var ok = true;
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (U.dist2(x, y, o.x, o.y) < (r + o.r + 230) * (r + o.r + 230)) { ok = false; break; }
    }
    if (!ok) continue;
    var ob = {
      x: x, y: y, r: r, kind: kind,
      hp: kind === 'crate' ? 400 : 0, maxHp: 400,
      seed: Math.random() * 100, dead: false
    };
    this.obstacles.push(ob);
    this.obGrid.insert(ob);
  }
};

Game.prototype.pushOutOfObstacles = function (o, radius) {
  var list = this.obGrid.query(o.x, o.y, radius + 150, this._qo || (this._qo = []));
  for (var i = 0; i < list.length; i++) {
    var ob = list[i];
    if (ob.dead) continue;
    var dx = o.x - ob.x, dy = o.y - ob.y;
    var min = ob.r + radius;
    var d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    var d = Math.sqrt(d2) || 0.01;
    var push = min - d;
    o.x += (dx / d) * push;
    o.y += (dy / d) * push;
  }
};

Game.prototype.hitObstacles = function (x, y, r, dmg) {
  if (!this.obGrid) return;
  var list = this.obGrid.query(x, y, r + 150, this._qo2 || (this._qo2 = []));
  for (var i = 0; i < list.length; i++) {
    var ob = list[i];
    if (ob.dead || ob.kind !== 'crate') continue;
    if (U.dist2(x, y, ob.x, ob.y) > (r + ob.r) * (r + ob.r)) continue;
    ob.hp -= dmg;
    ob.flash = 0.1;
    if (ob.hp <= 0) this.breakCrate(ob);
  }
};

Game.prototype.breakCrate = function (ob) {
  ob.dead = true;
  this.stats.crates++;
  this.boom(ob.x, ob.y, ob.r * 1.6, '#C89A5B');
  var n = U.randInt(2, 4);
  for (var i = 0; i < n; i++) {
    var a = U.rand(0, U.TAU), d = U.rand(20, 80);
    this.dropGold(ob.x + Math.cos(a) * d, ob.y + Math.sin(a) * d, U.rand(2, 5) * this.diff.reward);
  }
  if (U.chance(0.22)) this.dropItem(ob.x, ob.y, 'heal');
  else if (U.chance(0.06)) this.dropItem(ob.x, ob.y, U.chance(0.5) ? 'magnet' : 'bomb');
};

// ── 촉수 (일라오이) ─────────────────────────────────────────────
// 바닥에 박혀 있다가 사거리 안의 적을 주기적으로 내려찍습니다.
Game.prototype.spawnTentacle = function (x, y, life, o) {
  o = o || {};
  this.tentacles.push({
    x: U.clamp(x, 80, WORLD.w - 80), y: U.clamp(y, 80, WORLD.h - 80),
    life: life, t: U.rand(0, 0.6), anim: 0,
    range: o.reach || 800,
    dmg: o.dmg || 70,
    giant: !!o.giant
  });
};

Game.prototype.updateTentacles = function (dt) {
  var p = this.p;
  for (var i = this.tentacles.length - 1; i >= 0; i--) {
    var tc = this.tentacles[i];
    tc.life -= dt;
    if (tc.life <= 0) { U.swapPop(this.tentacles, i); continue; }
    if (tc.anim > 0) tc.anim -= dt;

    tc.t -= dt;
    if (tc.t > 0) continue;
    var target = this.nearestEnemy(tc.x, tc.y, tc.range);
    if (!target) { tc.t = 0.2; continue; }
    tc.t = 3 / p.st.asMul;              // 원작의 촉수 공격 재사용 대기시간 3초
    tc.anim = 0.3;
    tc.ang = U.angle(tc.x, tc.y, target.x, target.y);
    this.damageCircle(target.x, target.y, (tc.giant ? 260 : 170) * p.st.areaMul, tc.dmg, {
      color: '#4FC3A1', knock: 260, minion: true
    });
    this.boom(target.x, target.y, (tc.giant ? 240 : 150) * p.st.areaMul, '#4FC3A1');
  }
};

// ── 깃털 (자야) ─────────────────────────────────────────────────
Game.prototype.spawnFeather = function (x, y, dmg, life) {
  this.feathers.push({
    x: U.clamp(x, 60, WORLD.w - 60), y: U.clamp(y, 60, WORLD.h - 60),
    dmg: dmg, life: life || 6, wob: U.rand(0, U.TAU)
  });
};

Game.prototype.updateFeathers = function (dt) {
  for (var i = this.feathers.length - 1; i >= 0; i--) {
    var f = this.feathers[i];
    f.life -= dt;
    f.wob += dt * 2;
    if (f.life <= 0) U.swapPop(this.feathers, i);
  }
};

// 깃부르미 — 모든 깃털을 회수하며 경로상의 적을 꿰뚫습니다.
Game.prototype.recallFeathers = function () {
  var p = this.p;
  for (var i = 0; i < this.feathers.length; i++) {
    var f = this.feathers[i];
    var a = U.angle(f.x, f.y, p.x, p.y);
    this.spawnBullet({
      x: f.x, y: f.y,
      vx: Math.cos(a) * 2600, vy: Math.sin(a) * 2600,
      r: 22, dmg: f.dmg, pierce: 99, life: U.dist(f.x, f.y, p.x, p.y) / 2600 + 0.05,
      color: '#F3C96B', shape: 'bolt', rot: a, knock: 80, crit: true
    });
  }
  this.feathers.length = 0;
};

// ── 바람 장막 (야스오) ──────────────────────────────────────────
Game.prototype.spawnWindwall = function (x, y, ang, len, life) {
  this.windwalls.push({ x: x, y: y, ang: ang, len: len, life: life, maxLife: life });
};

Game.prototype.updateWindwalls = function (dt) {
  for (var i = this.windwalls.length - 1; i >= 0; i--) {
    this.windwalls[i].life -= dt;
    if (this.windwalls[i].life <= 0) U.swapPop(this.windwalls, i);
  }
};

Game.prototype.blockedByWindwall = function (x, y) {
  for (var i = 0; i < this.windwalls.length; i++) {
    var w = this.windwalls[i];
    var hx = Math.cos(w.ang) * w.len / 2, hy = Math.sin(w.ang) * w.len / 2;
    if (this.pointNearLine(x, y, w.x - hx, w.y - hy, w.x + hx, w.y + hy) < 40) return true;
  }
  return false;
};

Game.prototype.blockByWindwall = function (e) {
  for (var i = 0; i < this.windwalls.length; i++) {
    var w = this.windwalls[i];
    var hx = Math.cos(w.ang) * w.len / 2, hy = Math.sin(w.ang) * w.len / 2;
    var d = this.pointNearLine(e.x, e.y, w.x - hx, w.y - hy, w.x + hx, w.y + hy);
    if (d >= e.r + 30) continue;
    // 장막의 법선 방향으로 밀어냅니다.
    var nx = Math.cos(w.ang + Math.PI / 2), ny = Math.sin(w.ang + Math.PI / 2);
    var side = ((e.x - w.x) * nx + (e.y - w.y) * ny) >= 0 ? 1 : -1;
    var push = (e.r + 30) - d;
    e.x += nx * side * push;
    e.y += ny * side * push;
  }
};

// ── 드랍 / 획득 ─────────────────────────────────────────────────
Game.prototype.dropXp = function (x, y, value, big) {
  this.pickups.push({
    kind: 'xp', x: x + U.rand(-20, 20), y: y + U.rand(-20, 20),
    r: big ? 34 : 20, v: value, t: 0, color: big ? '#7EC8FF' : '#6FD3FF'
  });
};
Game.prototype.dropGold = function (x, y, value, big) {
  this.pickups.push({
    kind: 'gold', x: x + U.rand(-20, 20), y: y + U.rand(-20, 20),
    r: big ? 32 : 22, v: value, t: 0, color: '#F3C96B'
  });
};
Game.prototype.dropItem = function (x, y, kind) {
  var color = kind === 'heal' ? '#8BE3A8'
    : kind === 'magnet' ? '#B6F2FF'
      : kind === 'card' ? '#C46BFF' : '#FF6B4D';
  this.pickups.push({ kind: kind, x: x, y: y, r: kind === 'card' ? 42 : 38, v: 0, t: 0, color: color });
};

Game.prototype.updatePickups = function (dt) {
  var p = this.p;
  var range = 330 * p.st.pickupMul * (p.px.gather > 0 ? 6 : 1);
  // 유미봇은 자기 반경 안의 전리품을 대신 끌어옵니다.
  var yb = this.getWeapon('yuumibot');
  for (var i = this.pickups.length - 1; i >= 0; i--) {
    var u = this.pickups[i];
    u.t += dt;
    var d = U.dist(u.x, u.y, p.x, p.y);

    // 오래 방치된 드랍은 스스로 따라옵니다. 도망 다니느라 못 먹은 경험치가
    // 영영 버려지는 일을 막기 위한 장치입니다. 다만 가만히 서서 다 받아먹는
    // 플레이가 되지 않도록 느리고, 한참 뒤에야 움직입니다.
    if (u.t > 12 && !u.magnet) {
      var ta = U.angle(u.x, u.y, p.x, p.y);
      u.x += Math.cos(ta) * 130 * dt;
      u.y += Math.sin(ta) * 130 * dt;
    }

    var pulled = u.magnet || d < range;
    if (!pulled && yb && yb.collect && yb.drones) {
      for (var k = 0; k < yb.drones.length; k++) {
        if (U.dist(u.x, u.y, yb.drones[k].x, yb.drones[k].y) < yb.collect) { pulled = true; break; }
      }
    }
    if (pulled) {
      var a = U.angle(u.x, u.y, p.x, p.y);
      var pull = u.magnet ? 2600 : U.lerp(700, 2100, 1 - Math.min(1, d / range));
      u.x += Math.cos(a) * pull * dt;
      u.y += Math.sin(a) * pull * dt;
    }
    if (d < p.r + u.r + 10) {
      this.collect(u);
      U.swapPop(this.pickups, i);
    }
  }
};

Game.prototype.collect = function (u) {
  var p = this.p;
  if (u.kind === 'xp') {
    this.addXp(u.v * p.st.xpMul);
    this.lootPassive();
  } else if (u.kind === 'gold') {
    var amt = u.v * p.st.goldMul;
    p.gold += amt;
    this.stats.goldEarned += amt;
    this.lootPassive();
  } else if (u.kind === 'heal') {
    this.healPlayer(p.maxHp * 0.3);
  } else if (u.kind === 'card') {
    // **접근 카드** — 진화할 수 있는 무기가 있으면 곧바로 진화 선택창이 뜹니다.
    p.cards++;
    this.stats.cards++;
    this.announce('접근 카드 획득 (' + p.cards + ')');
    this.offerEvolution();
  } else if (u.kind === 'magnet') {
    for (var i = 0; i < this.pickups.length; i++) this.pickups[i].magnet = true;
    this.announce('자석!');
  } else if (u.kind === 'bomb') {
    this.announce('폭탄!');
    this.shake(20);
    var list = this.enemies.slice();
    for (var j = 0; j < list.length; j++) {
      if (list[j].boss) this.hurtEnemy(list[j], 4000, { color: '#FF6B4D' });
      else this.hurtEnemy(list[j], 999999, { quiet: true, color: '#FF6B4D' });
    }
    this.flash = 0.35;
  }
};

// 자야 전투 박쥐 교전 — 전리품을 주울 때 경로상의 적을 때리고, 200개마다 폭주합니다.
Game.prototype.lootPassive = function () {
  var p = this.p;
  if (p.champ.id !== 'xayah') return;
  p.px.loot++;
  this.damageCircle(p.x, p.y, 280 * p.st.areaMul, (40 + p.level * 12) * p.st.dmgMul, {
    color: '#F3C96B', quiet: true
  });
  if (p.px.loot >= 200) {
    p.px.loot = 0;
    p.px.batT = 15 * p.st.durMul;
    this.announce('전투 박쥐 교전!');
  }
};

Game.prototype.addXp = function (v) {
  var p = this.p;
  p.xp += v;
  while (p.xp >= p.xpNeed) {
    p.xp -= p.xpNeed;
    p.level++;
    p.xpNeed = xpNeedFor(p.level);
    this.levelQueue++;
    if (p.champ.passive.onLevelUp) p.champ.passive.onLevelUp(this, p);
  }
  if ((this.levelQueue > 0 || this.evoQueue > 0) && this.state === 'playing') {
    this.state = 'levelup';
    UI.openLevelUp();
  }
};

// ── 진화 (접근 카드) ────────────────────────────────────────────
//
// 원작과 같습니다: **무기 5단계 + 진화 조건 지속 효과 보유 + 접근 카드**.
// 카드를 주웠을 때 조건을 채운 무기가 있으면 프리즘 선택창이 곧바로 뜨고,
// 없으면 카드는 그대로 보관됩니다 (나중에 조건을 채우면 그때 씁니다).
Game.prototype.evolvableWeapons = function () {
  var out = [];
  for (var i = 0; i < this.p.weapons.length; i++) {
    var w = this.p.weapons[i];
    if (this.canEvolve(w.id)) out.push(w.id);
  }
  return out;
};

Game.prototype.canEvolve = function (id) {
  var w = this.getWeapon(id), def = WEAPONS[id];
  if (!w || !def || w.evolved || w.lvl < 5) return false;
  if (!def.evoPerk) return false;
  return (this.p.perks[def.evoPerk] || 0) >= 1;
};

Game.prototype.offerEvolution = function () {
  if (this.p.cards <= 0) return false;
  if (this.evolvableWeapons().length === 0) return false;
  this.evoQueue++;
  if (this.state === 'playing') {
    this.state = 'levelup';
    UI.openLevelUp();
  }
  return true;
};

// 진화까지 무엇이 모자란지 한 줄로 설명합니다.
Game.prototype.evoHint = function (id) {
  var def = WEAPONS[id], w = this.getWeapon(id);
  if (!def || !def.evoPerk) return '';
  var perk = PERKS[def.evoPerk];
  var have = (this.p.perks[def.evoPerk] || 0) >= 1;
  var lv5 = w && w.lvl >= 5;
  return '진화: ' + perk.name + (have ? ' ✔' : ' ✘') + ' · 5단계' + (lv5 ? ' ✔' : ' ✘') +
    ' · 접근 카드' + (this.p.cards > 0 ? ' ✔' : ' ✘');
};

// 그 지속 효과를 집으면 진화가 열리는 무기가 있는지 (선택지 강조용)
Game.prototype.perkUnlocksEvo = function (perkId) {
  if ((this.p.perks[perkId] || 0) >= 1) return false;
  for (var i = 0; i < this.p.weapons.length; i++) {
    var def = WEAPONS[this.p.weapons[i].id];
    if (def && def.evoPerk === perkId) return true;
  }
  return false;
};

Game.prototype.hasWeapon = function (id) {
  for (var i = 0; i < this.p.weapons.length; i++) if (this.p.weapons[i].id === id) return true;
  return false;
};
Game.prototype.getWeapon = function (id) {
  for (var i = 0; i < this.p.weapons.length; i++) if (this.p.weapons[i].id === id) return this.p.weapons[i];
  return null;
};

// ── 레벨업 선택지 ───────────────────────────────────────────────
//
// 원작 구조 그대로입니다: **무기 카드와 기본 지속 효과 카드가 섞여 3장** 나옵니다.
// 챔피언 스킬은 강화되지 않습니다. 진화는 이 목록이 아니라 접근 카드로 열립니다.
Game.prototype.rollChoices = function (count, forShop) {
  var p = this.p;
  var pool = [];
  var i;

  // ① 보유 무기 강화 (챔피언 전용 무기 포함)
  for (i = 0; i < p.weapons.length; i++) {
    var w = p.weapons[i];
    if (w.lvl < 5) pool.push({ type: 'wup', id: w.id, weight: i === 0 ? 2.2 : 1.8 });
  }
  // ② 새 무기 (칸이 남고 해금된 것만)
  if (p.weapons.length < WEAPON_SLOTS) {
    for (i = 0; i < WEAPON_IDS.length; i++) {
      var id = WEAPON_IDS[i];
      if (this.hasWeapon(id)) continue;
      if (!missionDone(this.meta, WEAPONS[id].unlock)) continue;
      pool.push({ type: 'wnew', id: id, weight: 1.6 });
    }
  }
  // ③ 기본 지속 효과 — 이미 가진 것은 레벨업, 칸이 남으면 새 효과
  var perkCount = Object.keys(p.perks).length;
  for (i = 0; i < PERK_IDS.length; i++) {
    var pid = PERK_IDS[i];
    var lv = p.perks[pid] || 0;
    if (lv >= PERK_MAX_LV) continue;
    if (lv === 0 && perkCount >= PERK_SLOTS) continue;
    // 진화를 여는 지속 효과는 조금 더 자주 보이게 합니다 (원작도 카드에 표시해 줍니다).
    pool.push({ type: 'perkup', id: pid, weight: this.perkUnlocksEvo(pid) ? 2.4 : 1.3 });
  }

  var out = [];
  var guard = 0;
  while (out.length < count && pool.length > 0 && guard++ < 200) {
    var pairs = [];
    for (i = 0; i < pool.length; i++) pairs.push([pool[i], pool[i].weight]);
    var chosen = U.weighted(pairs);
    pool.splice(pool.indexOf(chosen), 1);
    out.push(this.decorateChoice(chosen, forShop));
  }
  // 더 올릴 것이 없어도 카드가 비면 안 됩니다 (0장이면 진행이 막힙니다).
  while (out.length < count) out.push(this.decorateChoice({ type: 'bonus' }, forShop));
  return out;
};

// 접근 카드를 썼을 때 뜨는 프리즘 선택지.
Game.prototype.rollEvolutions = function () {
  var ids = this.evolvableWeapons();
  var out = [];
  for (var i = 0; i < ids.length; i++) out.push(this.decorateChoice({ type: 'wevo', id: ids[i] }));
  return out;
};

Game.prototype.decorateChoice = function (c, forShop) {
  var p = this.p;
  if (c.type === 'wup') {
    var w = this.getWeapon(c.id), def = WEAPONS[c.id];
    c.title = def.name;
    c.sub = w.lvl + ' → ' + (w.lvl + 1) + ' 단계';
    c.desc = def.upText[w.lvl - 1] || '성능 강화';
    c.icon = def.icon;
    c.color = def.color;
    c.tag = def.champOnly ? '전용 무기' : '무기 강화';
    c.kind = def.champOnly ? 'champ' : 'weapon';
    c.note = (w.lvl + 1 >= 5 && def.evoPerk) ? this.evoHint(c.id) : '';
    c.price = 120 + w.lvl * 90;

  } else if (c.type === 'wnew') {
    var d2 = WEAPONS[c.id];
    c.title = d2.name;
    c.sub = '새 무기';
    c.desc = d2.desc;
    c.icon = d2.icon;
    c.color = d2.color;
    c.tag = '신규';
    c.kind = 'weapon';
    c.note = d2.evoPerk ? '진화 조건: ' + PERKS[d2.evoPerk].name : '';
    c.price = 260;

  } else if (c.type === 'wevo') {
    var de = WEAPONS[c.id];
    c.title = de.evo;
    c.sub = '최종 진화';
    c.desc = de.evoDesc || '성능이 크게 뜁니다';
    c.icon = de.icon;
    c.color = de.color;
    c.tag = '진화';
    c.kind = 'evo';
    c.price = 0;

  } else if (c.type === 'perkup') {
    var pk = PERKS[c.id];
    var plv = (p.perks[c.id] || 0) + 1;
    c.title = pk.name;
    c.sub = (plv === 1 ? '새 지속 효과' : plv - 1 + ' → ' + plv + ' 레벨');
    c.desc = pk.desc(plv);
    c.icon = pk.icon;
    c.color = pk.color;
    c.tag = '지속 효과';
    c.kind = 'perk';
    c.note = this.perkUnlocksEvo(c.id) ? this.perkEvoNote(c.id) : '';
    c.price = 140 + plv * 90;

  } else if (c.type === 'bonus') {
    c.title = '강철의 영약';
    c.sub = 'Elixir of Iron';
    c.desc = '최대 체력 +200, 체력을 가득 채우고 골드 200을 받습니다';
    c.icon = '🧪';
    c.color = '#FF8B6B';
    c.tag = '영약';
    c.kind = 'perk';
    c.price = 180;
  }
  if (forShop) c.price = Math.round(c.price * (1 + this.shopCount * 0.2));
  return c;
};

// "이 지속 효과를 집으면 어떤 무기가 진화할 수 있는지" 안내합니다.
Game.prototype.perkEvoNote = function (perkId) {
  var names = [];
  for (var i = 0; i < this.p.weapons.length; i++) {
    var def = WEAPONS[this.p.weapons[i].id];
    if (def && def.evoPerk === perkId) names.push(def.name);
  }
  return names.length ? '진화 조건: ' + names.join(' · ') : '';
};

Game.prototype.applyChoice = function (c) {
  var p = this.p;
  var self = this;
  if (c.type === 'wup') {
    var w = this.getWeapon(c.id);
    if (w && w.lvl < 5) w.lvl++;
    // 5단계가 되면서 조건이 이미 갖춰져 있고 카드도 있으면 바로 진화 기회를 줍니다.
    if (w && w.lvl === 5) this.delay(0.01, function () { self.offerEvolution(); });

  } else if (c.type === 'wnew') {
    if (!this.hasWeapon(c.id) && p.weapons.length < WEAPON_SLOTS) {
      p.weapons.push({ id: c.id, lvl: 1, evolved: false, t: 0 });
    }

  } else if (c.type === 'wevo') {
    var we = this.getWeapon(c.id);
    if (we && this.canEvolve(c.id) && p.cards > 0) {
      p.cards--;
      we.evolved = true;
      this.stats.evolutions++;
      this.announce(WEAPONS[c.id].evo + ' 진화!');
      this.ring(p.x, p.y, 700, WEAPONS[c.id].color);
      this.shake(14);
      this.flash = 0.25;
    }

  } else if (c.type === 'perkup') {
    var lv = (p.perks[c.id] || 0) + 1;
    if (lv <= PERK_MAX_LV) {
      p.perks[c.id] = lv;
      PERKS[c.id].apply(p, lv, this);
      // 이 지속 효과로 진화 조건이 채워졌을 수 있습니다.
      this.delay(0.01, function () { self.offerEvolution(); });
    }

  } else if (c.type === 'bonus') {
    p.maxHp += 200;
    this.healPlayer(p.maxHp);
    p.gold += 200;
  }
};

// ── 상점 ────────────────────────────────────────────────────────
Game.prototype.checkShop = function () {
  if (!this.shopObj || this.state !== 'playing') return;
  var d = U.dist(this.shopObj.x, this.shopObj.y, this.p.x, this.p.y);
  if (d < this.shopObj.r + this.p.r + 20) {
    this.state = 'shop';
    this.shopStock = this.rollChoices(4, true);
    this.shopRerollCost = 60;
    UI.openShop();
  }
};

Game.prototype.closeShop = function () {
  this.shopObj = null;
  this.shopCount++;
  this.state = 'playing';
};

// ── 종료 ────────────────────────────────────────────────────────
Game.prototype.finish = function (win) {
  if (this.state === 'result') return;
  this.state = 'result';
  this.win = win;
  var crystals = Math.floor(this.stats.goldEarned / 900) + (win ? 10 : 0) + this.stats.bossKills * 5;

  var t = this.meta.totals;
  t.runs++;
  t.kills += this.stats.kills;
  t.bossKills += this.stats.bossKills;
  t.evolutions += this.stats.evolutions;
  t.cards += this.stats.cards;
  if (this.t > t.bestTime) t.bestTime = this.t;
  if (this.stats.kills > t.bestKills) t.bestKills = this.stats.kills;
  if (win) {
    t.wins++;
    if (this.diff.id === 'brutal') t.brutalWins++;
    // 스테이지 클리어 — 다음 스테이지가 열립니다.
    if (!this.meta.stages[this.stage.id]) {
      this.meta.stages[this.stage.id] = 1;
      this.stageCleared = true;
    }
  }

  // 새로 달성한 미션을 찾아 보상을 줍니다.
  this.newMissions = [];
  for (var i = 0; i < MISSIONS.length; i++) {
    var ms = MISSIONS[i];
    if (this.meta.missions[ms.id]) continue;
    if (!ms.check(t)) continue;
    this.meta.missions[ms.id] = 1;
    this.newMissions.push(ms);
    crystals += 5;
  }

  this.meta.crystals += crystals;
  this.lastCrystals = crystals;
  this.meta.lastChamp = this.champ.id;
  this.meta.lastDiff = this.diff.id;
  this.meta.lastStage = this.stage.id;
  saveMeta(this.meta);
  UI.openResult();
};

// ── 카메라 / 연출 ───────────────────────────────────────────────
Game.prototype.updateCamera = function (dt) {
  var p = this.p;
  this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 8);
  this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 8);
  if (this.cam.shake > 0) this.cam.shake = Math.max(0, this.cam.shake - dt * 60);
  if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
  if (this.announceT > 0) this.announceT -= dt;
};

Game.prototype.shake = function (v) { this.cam.shake = Math.min(26, this.cam.shake + v); };
Game.prototype.announce = function (msg) { this.announceMsg = msg; this.announceT = 2.6; };

// 연출 객체는 모두 `t`(경과)와 `life`(전체)를 씁니다. render.js 가 1 - t/life 로 페이드합니다.
Game.prototype.text = function (x, y, v, color, size, crit) {
  this.texts.push({ x: x, y: y, v: v, color: color, size: size || 28, t: 0, life: crit ? 0.9 : 0.6, crit: !!crit });
};
Game.prototype.hitSpark = function (x, y, color) {
  this.fx.push({ kind: 'spark', x: x, y: y, r: 22, t: 0, life: 0.16, color: color });
};
Game.prototype.puff = function (x, y, color, r) {
  this.fx.push({ kind: 'puff', x: x, y: y, r: r || 16, t: 0, life: 0.3, color: color });
};
Game.prototype.boom = function (x, y, r, color) {
  this.fx.push({ kind: 'boom', x: x, y: y, r: r, t: 0, life: 0.34, color: color });
};
Game.prototype.ring = function (x, y, r, color) {
  this.fx.push({ kind: 'ring', x: x, y: y, r: r, t: 0, life: 0.5, color: color });
};
Game.prototype.pulse = function (x, y, r, color) {
  this.fx.push({ kind: 'pulse', x: x, y: y, r: r, t: 0, life: 0.26, color: color });
};
Game.prototype.slash = function (x, y, r, ang, arc, color) {
  this.fx.push({ kind: 'slash', x: x, y: y, r: r, ang: ang, arc: arc, t: 0, life: 0.2, color: color });
};
Game.prototype.muzzle = function (x, y, ang, color) {
  this.fx.push({ kind: 'muzzle', x: x, y: y, ang: ang, r: 40, t: 0, life: 0.09, color: color });
};
Game.prototype.trail = function (x, y, color) {
  this.fx.push({ kind: 'trail', x: x, y: y, r: 44, t: 0, life: 0.24, color: color });
};
Game.prototype.beam = function (x1, y1, x2, y2, w, color, life, jagged) {
  this.beams.push({ x1: x1, y1: y1, x2: x2, y2: y2, w: w, color: color, t: 0, life: life, jagged: !!jagged });
};

Game.prototype.updateFx = function (dt) {
  var i;
  for (i = this.fx.length - 1; i >= 0; i--) {
    this.fx[i].t += dt;
    if (this.fx[i].t >= this.fx[i].life) U.swapPop(this.fx, i);
  }
  for (i = this.beams.length - 1; i >= 0; i--) {
    this.beams[i].t += dt;
    if (this.beams[i].t >= this.beams[i].life) U.swapPop(this.beams, i);
  }
  for (i = this.texts.length - 1; i >= 0; i--) {
    var tx = this.texts[i];
    tx.t += dt;
    tx.y -= dt * 160;
    if (tx.t >= tx.life) U.swapPop(this.texts, i);
  }
};

// ── 저장 ────────────────────────────────────────────────────────
var META_KEY = 'swarm.meta.v3';

function defaultMeta() {
  return {
    crystals: 0,
    up: {},
    missions: {},
    stages: {},        // 클리어한 스테이지 id -> 1
    totals: {
      runs: 0, kills: 0, wins: 0, brutalWins: 0,
      bossKills: 0, evolutions: 0, cards: 0, bestTime: 0, bestKills: 0
    },
    lastChamp: 'jinx', lastDiff: 'story', lastStage: 'warehouse'
  };
}

function loadMeta() {
  try {
    var raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    var m = JSON.parse(raw);
    var d = defaultMeta();
    m.crystals = m.crystals || 0;
    m.up = m.up || {};
    m.missions = m.missions || {};
    m.stages = m.stages || {};
    m.totals = m.totals || d.totals;
    for (var k in d.totals) if (m.totals[k] === undefined) m.totals[k] = d.totals[k];
    m.lastChamp = m.lastChamp || d.lastChamp;
    m.lastDiff = m.lastDiff || d.lastDiff;
    m.lastStage = m.lastStage || d.lastStage;
    return m;
  } catch (e) {
    return defaultMeta();
  }
}

function saveMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* 저장 불가 환경 */ }
}
