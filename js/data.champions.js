// 플레이할 수 있는 챔피언 — 원작 집중포화 로스터 9인 그대로입니다.
//
// **원작과 같은 구조입니다: 챔피언 스킬은 레벨이 없습니다.**
// 성장은 오직 무기(5칸)와 기본 지속 효과(6칸)로만 이뤄집니다.
// 패시브 · E · R 은 판 내내 고정이고, 스킬 가속·피해량 같은 능력치의 영향만 받습니다.
//
// 좌표·사거리는 **리그 오브 레전드 단위**입니다 (카메라가 CAM_ZOOM 으로 축소해 그립니다).
// 체력도 원작 스케일이라 기본 1000, 일라오이 1500, 브라이어 1200 입니다.
//
// passive  : 레벨 없음. 갈고리만 골라 씁니다.
//            init(g,p) · tick(g,p,dt) · onKill(g,p,e) · onHit(g,p,e,dmg) · onCrit(g,p,e)
//            onLevelUp(g,p) · asFactor(g,p) · dmgFactor(g,p) · areaFactor(g,p)
//            상태값은 전부 p.px 에 담습니다. p.st.asMul 등에 직접 곱하면 매 프레임 누적됩니다.
// e / r    : { name, en, cd, charges?, desc, use(g, p) }
//            charges 가 있으면 충전식입니다 (원작의 야스오 질풍검 3충전 등).
//            cd 는 스킬 가속 0 기준이며 g.useE/useR 이 p.st.cdrMul 을 곱합니다.
//
// unlock: 미션 id (data.missions.js). null 이면 처음부터 쓸 수 있습니다.

var CHAMPIONS = [
  // ── 징크스 ────────────────────────────────────────────────────
  {
    id: 'jinx',
    name: '징크스', title: '말썽쟁이 화력덕후', role: '연사형 원거리',
    color: '#7EC8FF', accent: '#FF6FD8',
    hp: 1000, armor: 0, speed: 355, weapon: 'meowmeow', unlock: null,
    blurb: '사거리 1500의 미니건을 난사합니다. 물몸이지만 처치가 쌓이면 폭발적으로 빨라집니다.',
    passive: {
      name: '신난다!', en: 'Get Excited!',
      desc: '처치 70회마다 8초 동안 스킬 가속 +150, 이동 속도가 대폭 증가한 뒤 서서히 줄어듭니다.',
      init: function (g, p) { p.px.kills = 0; p.px.excited = 0; },
      onKill: function (g, p) {
        p.px.kills++;
        if (p.px.kills >= 70) {
          p.px.kills = 0;
          p.px.excited = 8;
          g.announce('신난다!');
          g.ring(p.x, p.y, 240, '#FF6FD8');
        }
      },
      tick: function (g, p, dt) {
        if (p.px.excited > 0) {
          p.px.excited -= dt;
          if (Math.random() < 0.3) g.puff(p.x, p.y, '#FF6FD8', 9);
        }
      },
      // 스킬 가속 +150 → 재사용 대기시간 ×(100/250). 남은 시간에 비례해 사그라듭니다.
      asFactor: function (g, p) {
        if (p.px.excited <= 0) return 1;
        var k = p.px.excited / 8;
        return 1 + 1.5 * k;
      }
    },
    e: {
      name: '생선 대가리!', en: 'Fishbones!', cd: 8,
      desc: '커서 방향으로 로켓을 다수 발사합니다. 적과 충돌하거나 최대 사거리에서 폭발합니다.',
      use: function (g, p) {
        var base = g.aimAngle(p.x, p.y, 1600);
        var n = 3 + p.st.projAdd;
        for (var i = 0; i < n; i++) {
          var a = base + (i - (n - 1) / 2) * 0.16;
          g.spawnBullet({
            x: p.x, y: p.y,
            vx: Math.cos(a) * 1100, vy: Math.sin(a) * 1100,
            r: 22, dmg: 260 * p.st.dmgMul, pierce: 0, life: 1.5,
            color: '#FF6FD8', shape: 'rocket', knock: 260,
            aoe: { r: 220 * p.st.areaMul, dmg: 260 * p.st.dmgMul, color: '#FF6FD8' }
          });
        }
        g.muzzle(p.x, p.y, base, '#FF6FD8');
        g.shake(5);
      }
    },
    r: {
      name: '초강력 초토화 로켓!', en: 'Super Mega Death Rocket!', cd: 50,
      desc: '거대한 로켓이 커서 위치에서 폭발합니다. 잃은 체력에 비례해 피해량이 최대 3배까지 오릅니다.',
      use: function (g, p) {
        var target = g.aimTarget(p.x, p.y, 3000);
        var ang = g.aimAngle(p.x, p.y, 3000);
        // 원작 그대로 — 잃은 체력이 많을수록 세집니다.
        var mul = 1 + 2 * (1 - p.hp / p.maxHp);
        var dmg = 1400 * mul * p.st.dmgMul;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * 1000, vy: Math.sin(ang) * 1000,
          r: 34, dmg: dmg, pierce: 0, life: 4,
          color: '#FF6FD8', shape: 'rocket', homing: 2.4, target: target, knock: 700,
          aoe: { r: 520 * p.st.areaMul, dmg: dmg, color: '#FF6FD8' }
        });
        g.shake(10);
      }
    }
  },

  // ── 세라핀 ────────────────────────────────────────────────────
  {
    id: 'seraphine',
    name: '세라핀', title: '빛나는 희망', role: '지원형 원거리',
    color: '#FF8FD0', accent: '#B6F2FF',
    hp: 1000, armor: 0, speed: 350, weapon: 'soundwave', unlock: null,
    blurb: '음파로 적을 둔화시키며 쓸어냅니다. 보호막과 무적기를 가진 가장 안정적인 원거리입니다.',
    passive: {
      name: '무대 장악', en: 'Stage Presence',
      desc: '25% 확률로 투사체를 한 번 더 발사합니다.',
      init: function (g, p) { p.st.echo = 0.25; }
    },
    e: {
      name: '소리 장막', en: 'Surround Sound', cd: 16,
      desc: '5초 동안 100 + 최대 체력 25%의 보호막을 두르고 이동 속도가 오릅니다.',
      use: function (g, p) {
        var amt = 100 + p.maxHp * 0.25;
        p.shield = Math.max(p.shield, amt);
        p.shieldT = 5 * p.st.durMul;
        p.px.surround = 5 * p.st.durMul;
        g.ring(p.x, p.y, 220, '#B6F2FF');
      }
    },
    r: {
      name: '앙코르', en: 'Encore', cd: 90,
      desc: '매우 넓은 범위의 적을 멈추고 밀쳐내며, 3초 동안 무적이 됩니다.',
      use: function (g, p) {
        p.iframe = Math.max(p.iframe, 3 * p.st.durMul);
        var ang = p.face;
        for (var i = 0; i < 9; i++) {
          g.delay(i * 0.06, (function (step) {
            return function () {
              var d = 180 + step * 260;
              var x = p.x + Math.cos(ang) * d, y = p.y + Math.sin(ang) * d;
              g.damageCircle(x, y, 380 * p.st.areaMul, 420 * p.st.dmgMul, {
                color: '#FF8FD0', stun: 2.2, knock: 320
              });
              g.ring(x, y, 380 * p.st.areaMul, '#FF8FD0');
            };
          })(i));
        }
        g.shake(12);
      }
    }
  },

  // ── 레오나 ────────────────────────────────────────────────────
  {
    id: 'leona',
    name: '레오나', title: '여명의 인도자', role: '근접 탱커',
    color: '#FFC24D', accent: '#FF7A3D',
    hp: 1000, armor: 25, speed: 345, weapon: 'shieldbash', unlock: null,
    blurb: '기본 방어력 25로 가장 단단합니다. 방어력이 곧 피해량이라 탱킹 스탯만 올려도 강해집니다.',
    passive: {
      name: '햇빛', en: 'Sunlight',
      desc: '추가 방어력의 30%, 추가 체력 재생의 75%만큼 범위 크기가 늘어납니다.',
      // 원작과 같습니다. 방어·재생 능력치가 그대로 공격 범위로 환산됩니다.
      areaFactor: function (g, p) {
        var bonusArmor = p.st.armor - p.champ.armor;
        var bonusRegen = p.st.regenPct * 1000;   // 체력 1000 기준 초당 회복량으로 환산
        return 1 + (bonusArmor * 0.30 + bonusRegen * 0.75) / 100;
      }
    },
    e: {
      name: '일식', en: 'Eclipse', cd: 17,
      desc: '5초 동안 방어력이 2배가 되고 최대 체력 25%의 보호막을 얻습니다. 3초 뒤 주변이 폭발합니다.',
      use: function (g, p) {
        var dur = 5 * p.st.durMul;
        p.px.eclipse = dur;
        p.shield = Math.max(p.shield, p.maxHp * 0.25);
        p.shieldT = dur;
        g.spawnZone(p.x, p.y, 420 * p.st.areaMul, 90 * p.st.dmgMul, dur, '#FFC24D', 'eclipse');
        g.ring(p.x, p.y, 420 * p.st.areaMul, '#FFC24D');
        g.delay(3, function () {
          g.damageCircle(p.x, p.y, 520 * p.st.areaMul, 700 * p.st.dmgMul, {
            color: '#FFC24D', knock: 420, stun: 1.2, sun: true
          });
          g.boom(p.x, p.y, 520 * p.st.areaMul, '#FFC24D');
          g.shake(11);
        });
      }
    },
    r: {
      name: '흑점 폭발', en: 'Solar Flare', cd: 80,
      desc: '커서 위치에 태양광이 떨어져 적을 기절시키고, 그 자리에 불타는 영역을 남깁니다.',
      use: function (g, p) {
        var a = g.aimPoint(p.x, p.y, 1600);
        var x = a.x, y = a.y;
        g.ring(x, y, 620 * p.st.areaMul, '#FFC24D');
        g.delay(0.6, function () {
          g.damageCircle(x, y, 620 * p.st.areaMul, 1500 * p.st.dmgMul, {
            color: '#FFC24D', knock: 480, stun: 2, sun: true
          });
          g.boom(x, y, 620 * p.st.areaMul, '#FFC24D');
          g.spawnZone(x, y, 440 * p.st.areaMul, 180 * p.st.dmgMul, 5 * p.st.durMul, '#FF7A3D', 'flare');
          g.shake(16);
        });
      }
    }
  },

  // ── 일라오이 ──────────────────────────────────────────────────
  {
    id: 'illaoi',
    name: '일라오이', title: '크라켄 사제', role: '광역 근접',
    color: '#4FC3A1', accent: '#B7F2E0',
    hp: 1500, armor: 15, speed: 340, weapon: 'tentacleslam', unlock: 'kills500',
    blurb: '체력 1500으로 가장 두껍습니다. 촉수를 깔아 두면 광역 화력이 최강이지만 사거리가 250으로 가장 짧습니다.',
    passive: {
      name: '태고족의 저항', en: 'Primordial Resilience',
      desc: '근처에 있는 촉수 하나당 초당 체력 회복이 2씩 늘어납니다.',
      tick: function (g, p, dt) {
        var n = 0;
        for (var i = 0; i < g.tentacles.length; i++) {
          if (U.dist2(g.tentacles[i].x, g.tentacles[i].y, p.x, p.y) < 1200 * 1200) n++;
        }
        p.px.nearTent = n;
        if (n > 0 && p.hp < p.maxHp) g.healPlayer(n * 2 * dt, true);
      }
    },
    e: {
      name: '촉수 강타', en: 'Tentacle Smash', cd: 12, charges: 2,
      desc: '커서 방향으로 촉수를 내려쳐 적을 띄우고, 범위 끝에 촉수를 하나 남깁니다.',
      use: function (g, p) {
        var ang = g.aimAngle(p.x, p.y, 900);
        var ex = p.x + Math.cos(ang) * 800 * p.st.areaMul;
        var ey = p.y + Math.sin(ang) * 800 * p.st.areaMul;
        g.damageLine(p.x, p.y, ex, ey, 110 * p.st.areaMul, 620 * p.st.dmgMul, {
          color: '#4FC3A1', knock: 420, stun: 0.9
        });
        g.beam(p.x, p.y, ex, ey, 200 * p.st.areaMul, '#4FC3A1', 0.3, false);
        g.spawnTentacle(ex, ey, 14 * p.st.durMul);
        g.shake(6);
      }
    },
    r: {
      name: '믿음의 도약', en: 'Leap of Faith', cd: 90,
      desc: '성상으로 지면을 내려찍어 광역 피해를 주고 대량의 촉수를 소환합니다. 투사체 능력치가 촉수 수를 늘립니다.',
      use: function (g, p) {
        g.damageCircle(p.x, p.y, 700 * p.st.areaMul, 1300 * p.st.dmgMul, {
          color: '#4FC3A1', knock: 520, stun: 1.2
        });
        g.boom(p.x, p.y, 700 * p.st.areaMul, '#4FC3A1');
        var n = 8 + p.st.projAdd * 2;
        for (var i = 0; i < n; i++) {
          var a = (U.TAU / n) * i + U.rand(-0.2, 0.2);
          var d = U.rand(200, 620);
          g.spawnTentacle(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 16 * p.st.durMul);
        }
        g.shake(16);
      }
    }
  },

  // ── 브라이어 ──────────────────────────────────────────────────
  {
    id: 'briar',
    name: '브라이어', title: '억제된 굶주림', role: '흡혈 근접',
    color: '#E85C8A', accent: '#FFD1DC',
    hp: 1200, armor: 15, speed: 355, weapon: 'chainscratch', unlock: 'survive5',
    // (원작 로스터 순서상 일라오이 다음입니다)
    blurb: '피를 흘릴수록 강해집니다. 광분 상태에서는 조작이 막히는 대신 흡혈로 버팁니다.',
    passive: {
      name: '생존 본능', en: 'Survival Instincts',
      desc: '잃은 체력에 비례해 피해량이 최대 60%, 이동 속도가 최대 100% 증가합니다.',
      dmgFactor: function (g, p) { return 1 + 0.60 * (1 - p.hp / p.maxHp); },
      tick: function (g, p) { p.px.lost = 1 - p.hp / p.maxHp; }
    },
    e: {
      name: '물고기의 광분', en: 'Blood Frenzy', cd: 20,
      desc: '짧게 돌진한 뒤 6초 동안 광분합니다. 조작이 막히는 대신 피해 감소 25%와 잃은 체력 비례 회복을 얻습니다.',
      use: function (g, p) {
        // 이미 광분 중이면 재사용으로 종료하며 주변에 피해를 주고 회복합니다 (원작의 '생존의 절규').
        if (p.px.frenzy > 0) {
          p.px.frenzy = 0;
          g.damageCircle(p.x, p.y, 560 * p.st.areaMul, 700 * p.st.dmgMul, {
            color: '#E85C8A', knock: 420
          });
          g.boom(p.x, p.y, 560 * p.st.areaMul, '#E85C8A');
          g.healPlayer(p.maxHp * 0.15);
          return;
        }
        var ang = g.aimAngle(p.x, p.y, 700);
        p.dashT = 0.2; p.dashAng = ang; p.dashPower = 4.2;
        p.px.frenzy = 6 * p.st.durMul;
      }
    },
    r: {
      name: '급강하', en: 'Certain Death', cd: 120,
      desc: '혈석을 차서 날린 위치로 저지 불가 돌진합니다. 사거리 제한이 없고 이후 강화된 광분 상태가 됩니다.',
      use: function (g, p) {
        var a = g.aimPoint(p.x, p.y, 4000);
        var x = a.x, y = a.y;
        g.ring(x, y, 600, '#E85C8A');
        g.delay(0.5, function () {
          p.x = x; p.y = y;
          p.iframe = Math.max(p.iframe, 0.5);
          g.damageCircle(x, y, 700 * p.st.areaMul, 1600 * p.st.dmgMul, {
            color: '#E85C8A', knock: 620, stun: 1.4
          });
          g.boom(x, y, 700 * p.st.areaMul, '#E85C8A');
          p.px.frenzy = 8 * p.st.durMul;
          p.px.frenzyBoost = 1;
          g.shake(18);
        });
      }
    }
  },

  // ── 야스오 ────────────────────────────────────────────────────
  {
    id: 'yasuo',
    name: '야스오', title: '용서받지 못한 자', role: '중거리 전사',
    color: '#8FD8FF', accent: '#FFE6A7',
    hp: 1000, armor: 10, speed: 355, weapon: 'steeltempest', unlock: 'boss1',
    blurb: '움직여야 공격이 나갑니다. 진화 전엔 최약이지만 진화하면 화면을 통째로 갈아버립니다.',
    passive: {
      name: '낭인의 길', en: 'Way of the Wanderer',
      desc: '치명타 확률이 15% 증가하고, 치명타로 적중할 때마다 기류를 3 얻습니다.',
      init: function (g, p) { p.st.crit += 0.15; },
      onCrit: function (g, p) {
        var w = g.getWeapon('steeltempest');
        if (w) w.flow = Math.min(100, (w.flow || 0) + 3);
      }
    },
    e: {
      name: '질풍검', en: 'Sweeping Blade', cd: 10, charges: 3,
      desc: '150 + 최대 체력 10%의 보호막을 얻고 무적 상태로 돌진한 뒤 주변을 벱니다.',
      use: function (g, p) {
        var amt = 150 + p.maxHp * 0.10;
        p.shield = Math.max(p.shield, amt);
        p.shieldT = 4 * p.st.durMul;
        var ang = g.aimAngle(p.x, p.y, 800);
        p.dashT = 0.18; p.dashAng = ang; p.dashPower = 5.2;
        p.iframe = Math.max(p.iframe, 0.4);
        // 돌진 중 기류가 빠르게 차오릅니다 (원작: 돌진 시 추가 기류).
        var w = g.getWeapon('steeltempest');
        if (w) w.flow = Math.min(100, (w.flow || 0) + 35);
        g.delay(0.2, function () {
          g.damageCircle(p.x, p.y, 420 * p.st.areaMul, 480 * p.st.dmgMul, {
            color: '#8FD8FF', knock: 260
          });
          g.slash(p.x, p.y, 420 * p.st.areaMul, ang, 3.2, '#B6F2FF');
        });
      }
    },
    r: {
      name: '바람 장막', en: 'Wind Wall', cd: 25,
      desc: '커서 방향에 적과 적의 투사체를 막는 장막을 설치합니다. 최종 보스는 막지 못합니다.',
      use: function (g, p) {
        var ang = g.aimAngle(p.x, p.y, 700);
        var d = 300;
        g.spawnWindwall(
          p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d,
          ang + Math.PI / 2, 700 * p.st.areaMul, 4 * p.st.durMul
        );
      }
    }
  },

  // ── 리븐 ──────────────────────────────────────────────────────
  {
    id: 'riven',
    name: '리븐', title: '추방자', role: '근접 전사',
    color: '#9BE86B', accent: '#F5F5F7',
    hp: 1000, armor: 20, speed: 350, weapon: 'bunnyhop', unlock: 'kills2000',
    blurb: '이동 속도가 곧 공격 속도입니다. 가한 피해가 보호막으로 돌아와 후반에는 거의 죽지 않습니다.',
    passive: {
      name: '룬 검', en: 'Runic Blade',
      desc: '근접한 적에게 최대 15%의 추가 피해를 주고, 가한 피해의 25%(타격당 최대 체력 2% 한도)만큼 보호막을 얻습니다.',
      onHit: function (g, p, e, dmg) {
        var gain = Math.min(dmg * 0.25, p.maxHp * 0.02);
        if (gain <= 0) return;
        p.shield = Math.min(p.maxHp * 0.6, p.shield + gain);
        p.shieldT = Math.max(p.shieldT, 1 * p.st.durMul);
      },
      // 근접할수록 피해가 커집니다 (최대 +15%).
      dmgFactor: function (g, p) { return 1 + 0.15 * (p.px.closeness || 0); },
      tick: function (g, p) {
        var e = g.nearestEnemy(p.x, p.y, 600);
        p.px.closeness = e ? U.clamp(1 - U.dist(p.x, p.y, e.x, e.y) / 600, 0, 1) : 0;
      }
    },
    e: {
      name: '용맹', en: 'Valor', cd: 8,
      desc: '바라보는 방향으로 무적 상태로 돌진하며 주변 적에게 피해를 주고 2초 동안 기절시킵니다.',
      use: function (g, p) {
        var ang = p.face;   // 원작 그대로 — 커서가 아니라 바라보는 방향입니다.
        p.dashT = 0.18; p.dashAng = ang; p.dashPower = 5;
        p.iframe = Math.max(p.iframe, 0.36);
        g.delay(0.18, function () {
          g.damageCircle(p.x, p.y, 460 * p.st.areaMul, 620 * p.st.dmgMul, {
            color: '#9BE86B', knock: 260, stun: 2 * p.st.durMul
          });
          g.boom(p.x, p.y, 460 * p.st.areaMul, '#9BE86B');
        });
      }
    },
    r: {
      name: '추방자의 검', en: "Blade of the Exile", cd: 100,
      desc: '15초 동안 이동 속도가 크게 오르고, 도약할 때마다 바람 가르기가 함께 나갑니다.',
      use: function (g, p) {
        p.px.exile = 15 * p.st.durMul;
        g.ring(p.x, p.y, 400, '#F5F5F7');
        g.announce('추방자의 검');
      }
    }
  },

  // ── 오로라 ────────────────────────────────────────────────────
  {
    id: 'aurora',
    name: '오로라', title: '마녀들 사이의 토끼', role: '유틸형 원거리',
    color: '#C46BFF', accent: '#7EF2D8',
    hp: 1000, armor: 0, speed: 350, weapon: 'guidingcurse', unlock: 'evolve1',
    blurb: '저주를 걸고 정화해 터뜨립니다. 무적기와 순간이동이 있어 패턴 회피가 가장 쉽습니다.',
    passive: {
      name: '영혼 방호술', en: 'Spirit Abjuration',
      desc: '7레벨마다 영혼을 소환해 가까운 적에게 피해를 입히고 저주를 겁니다.',
      init: function (g, p) { p.px.soulLv = 0; },
      onLevelUp: function (g, p) {
        if (p.level - p.px.soulLv < 7) return;
        p.px.soulLv = p.level;
        for (var i = 0; i < 3; i++) {
          g.delay(i * 0.18, function () {
            var e = g.nearestEnemy(p.x, p.y, 1400);
            if (!e) return;
            g.hurtEnemy(e, 900 * p.st.dmgMul, { color: '#7EF2D8', curse: true });
            g.ring(e.x, e.y, 200, '#7EF2D8');
          });
        }
        g.announce('영혼 방호술');
      }
    },
    e: {
      name: '장막 너머로', en: 'Between Worlds', cd: 15,
      desc: '3초 동안 무적이 되고 이동 속도가 오르며, 충돌한 적에게 피해를 주고 저주를 겁니다.',
      use: function (g, p) {
        var dur = 3 * p.st.durMul;
        p.iframe = Math.max(p.iframe, dur);
        p.px.spirit = dur;
      }
    },
    r: {
      name: '세계의 경계', en: 'The Weirding', cd: 90,
      desc: '영역을 전개합니다. 다시 누르면 영역 반대편으로 이동하며 도착 지점의 적을 밀어냅니다.',
      use: function (g, p) {
        if (p.px.weird) {
          // 두 번째 사용 — 영역 반대편으로 순간이동합니다.
          var w = p.px.weird;
          var nx = w.x * 2 - p.x, ny = w.y * 2 - p.y;
          p.x = U.clamp(nx, 200, WORLD.w - 200);
          p.y = U.clamp(ny, 200, WORLD.h - 200);
          g.damageCircle(p.x, p.y, 560 * p.st.areaMul, 900 * p.st.dmgMul, {
            color: '#C46BFF', knock: 520, curse: true
          });
          g.boom(p.x, p.y, 560 * p.st.areaMul, '#C46BFF');
          p.px.weird = null;
          p.rT = 0;                    // 재사용으로 해제하면 쿨이 바로 돌기 시작합니다.
          return;
        }
        g.damageCircle(p.x, p.y, 900 * p.st.areaMul, 1100 * p.st.dmgMul, {
          color: '#C46BFF', knock: 300, curse: true
        });
        g.boom(p.x, p.y, 900 * p.st.areaMul, '#C46BFF');
        p.px.weird = { x: p.x, y: p.y };
        g.shake(12);
      }
    }
  },

  // ── 자야 ──────────────────────────────────────────────────────
  {
    id: 'xayah',
    name: '자야', title: '반란자', role: '관통형 원거리',
    color: '#FF5C7A', accent: '#F3C96B',
    hp: 1000, armor: 0, speed: 350, weapon: 'featheredknife', unlock: 'win1',
    blurb: '지면에 깃털을 뿌려 두고 한 번에 회수해 꿰뚫습니다. 전리품을 모을수록 손이 빨라집니다.',
    passive: {
      name: '전투 박쥐 교전', en: 'Battle Bat Engagement',
      desc: '전리품 획득 반경이 늘고, 전리품을 주울 때 경로상의 적에게 피해를 줍니다. 200개를 모으면 15초 동안 스킬 가속 +80.',
      init: function (g, p) { p.px.loot = 0; p.px.batT = 0; p.st.pickupMul += 0.5; },
      tick: function (g, p, dt) { if (p.px.batT > 0) p.px.batT -= dt; },
      asFactor: function (g, p) { return p.px.batT > 0 ? 1.8 : 1; }
    },
    e: {
      name: '깃부르미', en: 'Bladecaller', cd: 13,
      desc: '뿌려 둔 깃털을 모두 회수하며 경로상의 적을 꿰뚫고, 잠시 습득 반경이 크게 늘어납니다.',
      use: function (g, p) {
        g.recallFeathers();
        p.px.gather = 3 * p.st.durMul;
      }
    },
    r: {
      name: '칼날 폭풍', en: 'Featherstorm', cd: 90,
      desc: '무적 상태로 도약해 원형으로 대량의 깃털을 흩뿌립니다. 깃부르미의 재사용 대기시간을 초기화합니다.',
      use: function (g, p) {
        p.iframe = Math.max(p.iframe, 1.4);
        p.eT = 0;
        var n = 16 + p.st.projAdd * 3;
        for (var i = 0; i < n; i++) {
          var a = (U.TAU / n) * i;
          g.spawnFeather(
            p.x + Math.cos(a) * U.rand(300, 900),
            p.y + Math.sin(a) * U.rand(300, 900),
            420 * p.st.dmgMul
          );
        }
        g.damageCircle(p.x, p.y, 700 * p.st.areaMul, 800 * p.st.dmgMul, {
          color: '#FF5C7A', knock: 400
        });
        g.boom(p.x, p.y, 700 * p.st.areaMul, '#FF5C7A');
        g.shake(14);
      }
    }
  }
];

var CHAMPION_BY_ID = {};
(function () {
  for (var i = 0; i < CHAMPIONS.length; i++) CHAMPION_BY_ID[CHAMPIONS[i].id] = CHAMPIONS[i];
})();
