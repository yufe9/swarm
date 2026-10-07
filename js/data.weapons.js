// 무기 정의 — 원작 집중포화의 무기 구성을 그대로 옮겼습니다.
//
// 두 종류가 있습니다.
//   champOnly: true  — 챔피언 전용 무기. 그 챔피언만 쓰고, 처음부터 5칸 중 1칸을 차지합니다.
//   (그 외)          — 레벨업·상점에서 주울 수 있는 일반 무기.
//
// 공통 규칙
//   lv[5]            1~5단계 수치표. **5단계가 끝이고, 진화는 별도 단계입니다.**
//   evoPerk          진화 조건이 되는 기본 지속 효과 id (data.perks.js).
//                    무기 5단계 + 그 지속 효과 보유(1레벨이면 충분) + 접근 카드 = 진화.
//   evo / evoDesc    진화 후 이름과 설명.
//   evoStats         진화 후 수치. 없으면 lv[4] 를 그대로 씁니다.
//   update(g, w, dt) 매 프레임 호출. w 는 { id, lvl, evolved, t, ... } 입니다.
//   피해량에는 p.st.dmgMul, 쿨다운에는 p.st.asMul, 범위에는 p.st.areaMul,
//   지속시간에는 p.st.durMul 을 반드시 반영하세요.
//
// 좌표·사거리는 리그 오브 레전드 단위입니다 (챔피언 몸통 반지름이 약 55).
// 챔피언 전용 무기의 수치는 나무위키 '집중포화' 표를 그대로 옮긴 것입니다.

// 현재 단계의 수치 한 줄을 돌려줍니다.
function wst(def, w) {
  return (w.evolved && def.evoStats) ? def.evoStats : def.lv[w.lvl - 1];
}

var WEAPONS = {

  // ════════════════════════════════════════════════════════════
  //  챔피언 전용 무기 (원작 수치)
  // ════════════════════════════════════════════════════════════

  // 징크스 — 야옹 야옹
  meowmeow: {
    champOnly: true,
    name: '야옹 야옹', en: 'Meow Meow', icon: '🔫', color: '#7EC8FF',
    desc: '대상 방향으로 여러 발의 총알을 발사합니다. 각 총알은 처음 적중한 적에게 피해를 줍니다.',
    evo: '전투 고양이 총알 세례', evoPerk: 'haste',
    evoDesc: '총알이 대상을 관통합니다. 처음 적중한 이후에는 피해량이 감소하고, 재사용 대기시간이 크게 줄어듭니다.',
    lv: [
      { dmg: 60, cd: 2.5, count: 3, range: 1500, speed: 1900, pierce: 0, size: 16, spread: 0.10, falloff: 1 },
      { dmg: 80, cd: 2.5, count: 4, range: 1500, speed: 1900, pierce: 0, size: 16, spread: 0.11, falloff: 1 },
      { dmg: 100, cd: 2.5, count: 5, range: 1500, speed: 1900, pierce: 0, size: 17, spread: 0.12, falloff: 1 },
      { dmg: 120, cd: 2.5, count: 6, range: 1500, speed: 1900, pierce: 0, size: 17, spread: 0.13, falloff: 1 },
      { dmg: 140, cd: 2.5, count: 7, range: 1500, speed: 1900, pierce: 0, size: 18, spread: 0.14, falloff: 1 }
    ],
    evoStats: { dmg: 140, cd: 1.25, count: 7, range: 1500, speed: 2100, pierce: 99, size: 20, spread: 0.14, falloff: 0.4 },
    upText: ['총알 +1 (총 80)', '총알 +1 (총 100)', '총알 +1 (총 120)', '총알 +1 (총 140)'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var base = g.aimAngle(p.x, p.y, s.range);
      if (base === null) { w.t = 0.08; return; }
      w.t = s.cd / p.st.asMul;
      var n = s.count + p.st.projAdd;
      // 총 피해량을 총알 수로 나눕니다 (원작 표기가 '총 피해량'입니다).
      var each = s.dmg / s.count * p.st.dmgMul;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * s.spread + U.rand(-0.02, 0.02);
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: s.size, dmg: each, pierce: s.pierce + p.st.pierceAdd,
          life: s.range / s.speed, color: this.color, shape: 'bolt',
          knock: 60, crit: true, falloff: s.falloff
        });
      }
      g.muzzle(p.x, p.y, base, this.color);
    }
  },

  // 세라핀 — 음향의 물결
  soundwave: {
    champOnly: true,
    name: '음향의 물결', en: 'Sound Wave', icon: '🎵', color: '#FF8FD0',
    desc: '음향의 물결을 내보내 적중하는 적에게 피해를 입히고 둔화시킵니다.',
    evo: '동물 메아리', evoPerk: 'proj',
    evoDesc: '파동이 목표 지점에 도달한 후 되돌아오면서 피해를 입히며 세라핀을 통과해 지나갑니다.',
    lv: [
      { dmg: 90, cd: 3.0, count: 1, range: 900, speed: 900, spread: 0, slow: 0.3, slowT: 1.5 },
      { dmg: 110, cd: 2.75, count: 2, range: 900, speed: 900, spread: 0.20, slow: 0.3, slowT: 1.5 },
      { dmg: 130, cd: 2.5, count: 3, range: 900, speed: 900, spread: 0.20, slow: 0.35, slowT: 1.6 },
      { dmg: 150, cd: 2.25, count: 4, range: 900, speed: 900, spread: 0.18, slow: 0.35, slowT: 1.7 },
      { dmg: 170, cd: 2.0, count: 5, range: 900, speed: 900, spread: 0.18, slow: 0.4, slowT: 1.8 }
    ],
    evoStats: { dmg: 190, cd: 2.0, count: 6, range: 900, speed: 950, spread: 0.17, slow: 0.4, slowT: 2.0, back: 2000 },
    upText: ['음파 +1 · 피해 110', '음파 +1 · 피해 130', '음파 +1 · 피해 150', '음파 +1 · 피해 170'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var base = g.aimAngle(p.x, p.y, s.range);
      if (base === null) { w.t = 0.1; return; }
      w.t = s.cd / p.st.asMul;
      var n = s.count + p.st.projAdd;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * s.spread;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 40 * p.st.areaMul, dmg: s.dmg * p.st.dmgMul,
          pierce: 99, life: s.range / s.speed,
          color: this.color, shape: 'wave', rot: a, knock: 50, crit: true,
          slow: s.slow, slowT: s.slowT * p.st.durMul,
          // 진화하면 목표 지점에서 되돌아옵니다.
          boomerang: w.evolved ? 1 : 0
        });
      }
    }
  },

  // 레오나 — 방패 타격
  shieldbash: {
    champOnly: true,
    name: '방패 타격', en: 'Shield Bash', icon: '🛡️', color: '#FFC24D',
    desc: '방패로 후려쳐 원뿔 범위에 자신의 방어력에 비례하는 피해를 입힙니다.',
    evo: '사자의 광명', evoPerk: 'armor',
    evoDesc: '넓은 지역을 공격해 적에게 햇빛을 적용합니다. 햇빛은 다른 무기로 터뜨려 추가 피해를 입힐 수 있습니다.',
    lv: [
      { dmg: 50, cd: 2.75, range: 550, arc: 1.3, armorRatio: 3.0 },
      { dmg: 75, cd: 2.5, range: 550, arc: 1.4, armorRatio: 3.0 },
      { dmg: 100, cd: 2.25, range: 550, arc: 1.5, armorRatio: 3.0 },
      { dmg: 125, cd: 2.0, range: 550, arc: 1.6, armorRatio: 3.0 },
      { dmg: 150, cd: 1.75, range: 550, arc: 1.7, armorRatio: 3.0 }
    ],
    evoStats: { dmg: 175, cd: 1.5, range: 850, arc: 2.4, armorRatio: 3.0, sun: 300 },
    upText: ['피해 75', '피해 100', '피해 125', '피해 150'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var r = s.range * p.st.areaMul;
      var ang = g.aimAngle(p.x, p.y, r);
      // 원작처럼 범위 안에 적이 없으면 아예 휘두르지 않습니다.
      if (ang === null || !g.nearestEnemy(p.x, p.y, r)) { w.t = 0.12; return; }
      w.t = s.cd / p.st.asMul;
      var dmg = (s.dmg + p.st.armor * s.armorRatio) * p.st.dmgMul;
      g.damageArc(p.x, p.y, r, ang, s.arc, dmg, {
        knock: 260, color: this.color, crit: true,
        sun: w.evolved ? s.sun : 0
      });
      g.slash(p.x, p.y, r, ang, s.arc, this.color);
    }
  },

  // 일라오이 — 촉수 후려치기
  tentacleslam: {
    champOnly: true,
    name: '촉수 후려치기', en: 'Tentacle Slam', icon: '🐙', color: '#4FC3A1',
    desc: '성상으로 지면을 내려찍어 대상 지역에 피해를 입히고 주변의 적을 공격하는 촉수를 소환합니다.',
    evo: '곰의 강타', evoPerk: 'dur',
    evoDesc: '촉수의 지속시간이 늘고, 일정 확률로 더 큰 피해를 입히는 거대 촉수를 소환합니다.',
    // 내려찍기 사거리 250 — 원작에서도 전 무기 중 가장 짧고 범위 크기의 영향을 받지 않습니다.
    lv: [
      { dmg: 125, cd: 5.0, slamRange: 250, tentDmg: 70, tentLife: 8 },
      { dmg: 125, cd: 4.75, slamRange: 250, tentDmg: 70, tentLife: 10 },
      { dmg: 200, cd: 4.5, slamRange: 250, tentDmg: 105, tentLife: 10 },
      { dmg: 200, cd: 4.25, slamRange: 250, tentDmg: 105, tentLife: 12 },
      { dmg: 275, cd: 4.0, slamRange: 250, tentDmg: 120, tentLife: 12 }
    ],
    evoStats: { dmg: 275, cd: 4.0, slamRange: 250, tentDmg: 120, tentLife: 16, giant: true },
    upText: ['촉수 지속 10초', '피해 200 · 촉수 105', '촉수 지속 12초', '피해 275 · 촉수 120'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      // 내려찍기는 발밑입니다. 범위 크기의 영향을 받지 않습니다 (원작과 동일).
      g.damageCircle(p.x, p.y, s.slamRange, s.dmg * p.st.dmgMul, {
        color: this.color, knock: 220, crit: true
      });
      g.boom(p.x, p.y, s.slamRange, this.color);
      // 거대 촉수는 치명타 확률만큼 등장합니다 (진화 시에만).
      var giant = s.giant && Math.random() < p.st.crit;
      var a = U.rand(0, U.TAU);
      g.spawnTentacle(
        p.x + Math.cos(a) * 180, p.y + Math.sin(a) * 180,
        s.tentLife * p.st.durMul,
        { dmg: (giant ? s.tentDmg * 2 : s.tentDmg) * p.st.dmgMul, reach: (giant ? 1400 : 800) * p.st.areaMul, giant: giant }
      );
      g.shake(4);
    }
  },

  // 브라이어 — 족쇄 할퀴기
  chainscratch: {
    champOnly: true,
    name: '족쇄 할퀴기', en: 'Chain Scratch', icon: '🩸', color: '#E85C8A',
    desc: '전방을 휩쓸어 자신의 최대 체력에 비례하는 피해를 입힙니다.',
    evo: '포악한 베기', evoPerk: 'hp',
    evoDesc: '할퀴기의 사거리와 피해량이 증가하고 중첩되는 출혈 효과를 적용합니다.',
    lv: [
      { dmg: 25, cd: 2.0, range: 300, arc: 1.7, hpRatio: 0.05 },
      { dmg: 55, cd: 1.9, range: 300, arc: 1.8, hpRatio: 0.05 },
      { dmg: 85, cd: 1.8, range: 300, arc: 1.9, hpRatio: 0.05 },
      { dmg: 115, cd: 1.7, range: 300, arc: 2.0, hpRatio: 0.05 },
      { dmg: 145, cd: 1.6, range: 300, arc: 2.1, hpRatio: 0.05 }
    ],
    evoStats: { dmg: 145, cd: 1.6, range: 420, arc: 2.4, hpRatio: 0.05, bleed: 10, bleedT: 8 },
    upText: ['피해 55', '피해 85', '피해 115', '피해 145'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      // 광분 중에는 공격 속도가 오릅니다 (E 스킬).
      var frenzy = p.px.frenzy > 0 ? (p.px.frenzyBoost ? 2.2 : 1.6) : 1;
      if (w.t > 0) return;
      w.t = s.cd / (p.st.asMul * frenzy);
      var r = s.range * p.st.areaMul;
      var ang = g.aimAngle(p.x, p.y, r + 100);
      if (ang === null) ang = p.face;
      var dmg = (s.dmg + p.maxHp * s.hpRatio) * p.st.dmgMul;
      g.damageArc(p.x, p.y, r, ang, s.arc, dmg, {
        knock: 120, color: this.color, crit: true,
        bleed: w.evolved ? s.bleed * p.st.dmgMul : 0,
        bleedT: w.evolved ? s.bleedT * p.st.durMul : 0
      });
      g.slash(p.x, p.y, r, ang, s.arc, this.color);
      // 광분 중에는 입힌 피해만큼 회복합니다.
      if (p.px.frenzy > 0) g.healPlayer(dmg * 0.25 * (1 - p.hp / p.maxHp), true);
    }
  },

  // 야스오 — 강철 폭풍
  steeltempest: {
    champOnly: true,
    name: '강철 폭풍', en: 'Steel Tempest', icon: '🌪️', color: '#8FD8FF',
    desc: '1초마다 기류를 25 얻고, 이동하거나 돌진하면 추가로 얻습니다. 기류가 100이 되면 소용돌이를 내보냅니다.',
    evo: '떠도는 폭풍', evoPerk: 'crit',
    evoDesc: '수는 적지만 훨씬 큰 소용돌이가 포물선을 그리며 날아가 목표 지점에 폭풍을 남깁니다.',
    lv: [
      { dmg: 120, count: 1, range: 850, speed: 1500, spread: 0 },
      { dmg: 120, count: 3, range: 850, speed: 1500, spread: 0.16 },
      { dmg: 150, count: 3, range: 850, speed: 1500, spread: 0.16 },
      { dmg: 150, count: 5, range: 850, speed: 1500, spread: 0.14 },
      { dmg: 180, count: 5, range: 850, speed: 1500, spread: 0.14 }
    ],
    evoStats: { dmg: 180, count: 5, range: 850, speed: 1250, spread: 0.20, storm: 62.5, stormT: 2.5 },
    upText: ['소용돌이 3개', '피해 150', '소용돌이 5개', '피해 180'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      if (w.flow === undefined) w.flow = 0;
      // 원작처럼 쿨타임이 아니라 '기류'로 나갑니다. 움직이면 훨씬 빨리 찹니다.
      var moving = Math.abs(p.moveX) + Math.abs(p.moveY) > 0.1;
      w.flow += (25 + (moving ? 30 : 0)) * p.st.asMul * dt;
      if (w.flow < 100) return;
      w.flow = 0;
      var base = g.aimAngle(p.x, p.y, s.range);
      if (base === null) base = p.face;
      var n = s.count + p.st.projAdd;
      var self = this;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * s.spread;
        var b = {
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: (w.evolved ? 60 : 34) * p.st.areaMul, dmg: s.dmg * p.st.dmgMul,
          pierce: 99, life: s.range / s.speed,
          color: '#B6F2FF', shape: 'wave', rot: a, knock: 260, crit: true
        };
        // 진화하면 착탄 지점에 폭풍 장판을 남깁니다.
        if (w.evolved) {
          b.onEnd = function (bx, by) {
            g.spawnZone(bx, by, 220 * p.st.areaMul, s.storm * 4 * p.st.dmgMul,
              s.stormT * p.st.durMul, '#8FD8FF', 'storm');
          };
        }
        g.spawnBullet(b);
      }
      g.slash(p.x, p.y, 300 * p.st.areaMul, base, 2.0, '#B6F2FF');
    }
  },

  // 리븐 — 토끼뜀
  bunnyhop: {
    champOnly: true,
    name: '토끼뜀', en: 'Bunny Hop', icon: '🐰', color: '#9BE86B',
    desc: '이동하면 충전이 차오르고, 가득 차면 전방으로 도약해 피해를 입힙니다. 2번째 시전마다 적을 띄웁니다.',
    evo: '당근 격돌', evoPerk: 'speed',
    evoDesc: '추가 피해를 입히고 지면에 잔상을 남깁니다. 잔상은 잠시 후 폭발해 적을 다시 띄웁니다.',
    // 쿨타임이 아니라 '이동 거리'로 나갑니다. 그래서 이동 속도가 곧 공격 속도입니다.
    lv: [
      { dmg: 110, need: 520, radius: 260 },
      { dmg: 160, need: 500, radius: 280 },
      { dmg: 215, need: 480, radius: 300 },
      { dmg: 275, need: 460, radius: 320 },
      { dmg: 340, need: 440, radius: 340 }
    ],
    evoStats: { dmg: 420, need: 420, radius: 380, echo: 260 },
    upText: ['피해 160', '피해 215', '피해 275', '피해 340'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      if (w.charge === undefined) { w.charge = 0; w.hops = 0; }
      var moved = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * dt;
      w.charge += moved;
      if (w.charge < s.need) return;
      w.charge = 0;
      w.hops++;
      var ang = p.face;
      var dx = p.x + Math.cos(ang) * 260, dy = p.y + Math.sin(ang) * 260;
      var airborne = w.hops % 2 === 0;
      var r = s.radius * p.st.areaMul;
      g.damageCircle(dx, dy, r, s.dmg * p.st.dmgMul, {
        color: this.color, knock: airborne ? 420 : 160,
        stun: airborne ? 0.8 * p.st.durMul : 0, crit: true
      });
      g.boom(dx, dy, r, this.color);
      // 진화하면 잔상이 남아 한 번 더 터집니다.
      if (w.evolved) {
        g.delay(0.7, function () {
          g.damageCircle(dx, dy, r * 0.9, s.echo * p.st.dmgMul, {
            color: '#F5F5F7', knock: 420, stun: 0.6 * p.st.durMul, crit: true
          });
          g.boom(dx, dy, r * 0.9, '#F5F5F7');
        });
      }
      // 궁극기(추방자의 검) 중에는 도약마다 바람 가르기가 함께 나갑니다.
      if (p.px.exile > 0) {
        var n = 3 + p.st.projAdd;
        for (var i = 0; i < n; i++) {
          var a = ang + (i - (n - 1) / 2) * 0.22;
          g.spawnBullet({
            x: p.x, y: p.y,
            vx: Math.cos(a) * 1400, vy: Math.sin(a) * 1400,
            r: 46, dmg: s.dmg * 0.8 * p.st.dmgMul, pierce: 99, life: 0.8,
            color: '#F5F5F7', shape: 'wave', rot: a, knock: 300, crit: true
          });
        }
      }
    }
  },

  // 오로라 — 인도의 저주
  guidingcurse: {
    champOnly: true,
    name: '인도의 저주', en: 'Guiding Hex', icon: '🌀', color: '#C46BFF',
    desc: '저주를 쏘아 보내며 날아가는 방향을 조종합니다. 3번째 시전마다 저주를 정화하며 추가 피해를 입힙니다.',
    evo: '고양된 저주', evoPerk: 'xp',
    evoDesc: '더 많은 저주를 발사하고, 저주를 정화할 때 대상 주위에도 피해를 입힙니다.',
    lv: [
      { dmg: 70, cd: 1.6, count: 1, range: 1100, speed: 800, purge: 220 },
      { dmg: 90, cd: 1.5, count: 2, range: 1100, speed: 800, purge: 300 },
      { dmg: 115, cd: 1.4, count: 2, range: 1100, speed: 820, purge: 400 },
      { dmg: 140, cd: 1.3, count: 3, range: 1100, speed: 840, purge: 520 },
      { dmg: 170, cd: 1.2, count: 3, range: 1100, speed: 860, purge: 660 }
    ],
    evoStats: { dmg: 170, cd: 1.1, count: 5, range: 1200, speed: 900, purge: 820, splash: 420 },
    upText: ['저주 +1 · 피해 90', '피해 115', '저주 +1 · 피해 140', '피해 170'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var base = g.aimAngle(p.x, p.y, s.range);
      if (base === null) { w.t = 0.1; return; }
      w.t = s.cd / p.st.asMul;
      w.casts = (w.casts || 0) + 1;

      // 3번째 시전은 발사 대신 걸어 둔 저주를 정화합니다.
      if (w.casts % 3 === 0) {
        var list = g.enemiesInCircle(p.x, p.y, 1400 * p.st.areaMul);
        var purged = 0;
        for (var k = 0; k < list.length; k++) {
          var e = list[k];
          if (!e.curseT || e.curseT <= 0) continue;
          e.curseT = 0;
          purged++;
          g.hurtEnemy(e, s.purge * p.st.dmgMul, { color: '#7EF2D8', crit: true });
          g.ring(e.x, e.y, 160, '#7EF2D8');
          if (w.evolved) {
            g.damageCircle(e.x, e.y, 300 * p.st.areaMul, s.splash * p.st.dmgMul, {
              color: '#7EF2D8', quiet: true
            });
          }
        }
        if (purged > 0) return;   // 정화할 게 있었으면 이번 시전은 정화로 끝납니다.
        w.casts++;                // 없었으면 그냥 쏩니다.
      }

      var n = s.count + p.st.projAdd;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * 0.2;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 22, dmg: s.dmg * p.st.dmgMul, pierce: 0, life: s.range / s.speed,
          color: this.color, shape: 'bolt', knock: 40, crit: true,
          curse: 6 * p.st.durMul,
          // 수동 조준일 때는 원작처럼 커서를 따라 휘어 날아갑니다.
          steer: g.autoAim ? 0 : 6
        });
      }
    }
  },

  // 자야 — 날개 달린 단검
  featheredknife: {
    champOnly: true,
    name: '날개 달린 단검', en: 'Feathered Knife', icon: '🗡️', color: '#FF5C7A',
    desc: '전방으로 적을 관통하는 단검을 던집니다. 관통할 때마다 피해가 줄고 지면에 깃털을 남깁니다.',
    evo: '연인의 도탄', evoPerk: 'pickup',
    evoDesc: '뒤로 특별한 단검을 추가로 던집니다. 적 사이를 튕기며 피해를 주고 돌아와 보호막을 부여합니다.',
    lv: [
      { dmg: 80, cd: 1.1, count: 1, range: 1100, speed: 1600, pierce: 3, feather: 60 },
      { dmg: 105, cd: 1.05, count: 2, range: 1100, speed: 1600, pierce: 4, feather: 80 },
      { dmg: 130, cd: 1.0, count: 2, range: 1100, speed: 1650, pierce: 5, feather: 100 },
      { dmg: 160, cd: 0.95, count: 3, range: 1100, speed: 1650, pierce: 6, feather: 125 },
      { dmg: 195, cd: 0.9, count: 3, range: 1200, speed: 1700, pierce: 8, feather: 155 }
    ],
    evoStats: { dmg: 195, cd: 0.9, count: 4, range: 1200, speed: 1700, pierce: 10, feather: 200, ricochet: 260 },
    upText: ['단검 +1 · 피해 105', '피해 130', '단검 +1 · 피해 160', '피해 195'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var base = g.aimAngle(p.x, p.y, s.range);
      if (base === null) { w.t = 0.1; return; }
      w.t = s.cd / p.st.asMul;
      var n = s.count + p.st.projAdd;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * 0.13;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 16, dmg: s.dmg * p.st.dmgMul, pierce: s.pierce + p.st.pierceAdd,
          life: s.range / s.speed, color: this.color, shape: 'bolt',
          knock: 50, crit: true, falloff: 0.82,
          // 끝난 자리에 깃털을 남깁니다. 깃부르미(E)로 한 번에 회수합니다.
          dropFeather: s.feather * p.st.dmgMul, featherLife: 6 * p.st.durMul
        });
      }
      // 진화하면 뒤로 튕기는 단검이 하나 더 나가고, 돌아오면 보호막을 줍니다.
      if (w.evolved) {
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: -Math.cos(base) * s.speed * 0.8, vy: -Math.sin(base) * s.speed * 0.8,
          r: 20, dmg: s.ricochet * p.st.dmgMul, pierce: 99, life: 1.4,
          color: '#F3C96B', shape: 'wave', rot: base + Math.PI, knock: 60, crit: true,
          bounce: 4, shieldBack: p.maxHp * 0.04
        });
      }
    }
  },

  // ════════════════════════════════════════════════════════════
  //  일반 무기 — 전투 중 습득
  // ════════════════════════════════════════════════════════════

  // 귀여운 발사기 — 단일 DPS 특화 (원작 최상위 무기)
  cuteblaster: {
    name: '귀여운 발사기', en: 'Cutesy Blaster', icon: '🔫', color: '#FFB3D9',
    desc: '가장 가까운 적에게 투사체를 빠르게 발사합니다.',
    evo: '왕 귀여운 발사기', evoPerk: 'haste',
    evoDesc: '투사체를 극도로 빠르게 발사해 처음 적중하는 대상에게 피해를 입힙니다.',
    lv: [
      { dmg: 55, cd: 0.55, count: 1, range: 1100, speed: 2000 },
      { dmg: 70, cd: 0.50, count: 1, range: 1100, speed: 2000 },
      { dmg: 85, cd: 0.45, count: 1, range: 1150, speed: 2100 },
      { dmg: 105, cd: 0.40, count: 2, range: 1150, speed: 2100 },
      { dmg: 125, cd: 0.35, count: 2, range: 1200, speed: 2200 }
    ],
    evoStats: { dmg: 140, cd: 0.16, count: 2, range: 1200, speed: 2400 },
    upText: ['연사 속도 증가', '피해 85', '투사체 +1', '피해 125'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var target = g.nearestEnemy(p.x, p.y, s.range);
      if (!target) { w.t = 0.08; return; }
      w.t = s.cd / p.st.asMul;
      var base = U.angle(p.x, p.y, target.x, target.y);
      var n = s.count + p.st.projAdd;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * 0.08;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 13, dmg: s.dmg * p.st.dmgMul, pierce: p.st.pierceAdd,
          life: s.range / s.speed, color: this.color, shape: 'bolt', knock: 40, crit: true
        });
      }
      g.muzzle(p.x, p.y, base, this.color);
    }
  },

  // 스태틱의 검 — 잡몹 정리 최강
  statikk: {
    name: '스태틱의 검', en: 'Statikk Sword', icon: '⚡', color: '#FFE066',
    desc: '체력이 가장 높은 적 사이를 튕기는 번개를 발사합니다.',
    evo: '프룸비스의 전기도축칼', evoPerk: 'hp',
    evoDesc: '대상 적 주위로 폭풍을 일으켜 일정 시간 동안 피해를 입힙니다.',
    lv: [
      { dmg: 95, cd: 2.2, jumps: 3, range: 900 },
      { dmg: 125, cd: 2.0, jumps: 4, range: 950 },
      { dmg: 160, cd: 1.8, jumps: 5, range: 1000 },
      { dmg: 200, cd: 1.6, jumps: 7, range: 1050 },
      { dmg: 250, cd: 1.4, jumps: 9, range: 1100 }
    ],
    evoStats: { dmg: 250, cd: 1.2, jumps: 11, range: 1200, storm: 90, stormT: 2.5 },
    upText: ['연쇄 +1', '피해 160', '연쇄 +2', '피해 250'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var target = g.nearestEnemy(p.x, p.y, s.range);
      if (!target) { w.t = 0.15; return; }
      w.t = s.cd / p.st.asMul;
      var self = this;
      var hit = [], cx = p.x, cy = p.y, cur = target;
      for (var i = 0; i < s.jumps && cur; i++) {
        g.beam(cx, cy, cur.x, cur.y, 14, this.color, 0.2, true);
        g.hurtEnemy(cur, s.dmg * p.st.dmgMul, { color: this.color, crit: true });
        if (w.evolved) {
          g.spawnZone(cur.x, cur.y, 240 * p.st.areaMul, s.storm * 4 * p.st.dmgMul,
            s.stormT * p.st.durMul, '#7EC8FF', 'statikk');
        }
        hit.push(cur);
        cx = cur.x; cy = cur.y;
        cur = g.nearestEnemy(cx, cy, 520 * p.st.areaMul, hit);
      }
    }
  },

  // 얼음작렬 갑옷 — 극한 난이도 필수
  iceblast: {
    name: '얼음작렬 갑옷', en: 'Iceblast Armor', icon: '❄️', color: '#7FE0D4',
    desc: '피해를 막으면 적을 얼어붙게 만듭니다. 피해량이 방어력에 비례합니다.',
    evo: '완전 빙결', evoPerk: 'armor',
    evoDesc: '보호막을 얻습니다. 보호막은 사라질 때 적을 얼어붙게 만듭니다.',
    lv: [
      { dmg: 60, cd: 3.0, radius: 300, armorRatio: 2.0, freeze: 1.0 },
      { dmg: 80, cd: 2.8, radius: 325, armorRatio: 2.0, freeze: 1.2 },
      { dmg: 105, cd: 2.6, radius: 350, armorRatio: 2.5, freeze: 1.4 },
      { dmg: 135, cd: 2.4, radius: 375, armorRatio: 2.5, freeze: 1.6 },
      { dmg: 170, cd: 2.2, radius: 410, armorRatio: 3.0, freeze: 1.8 }
    ],
    evoStats: { dmg: 170, cd: 2.0, radius: 470, armorRatio: 3.0, freeze: 2.2, shield: 0.12 },
    upText: ['반경 증가', '피해·계수 증가', '빙결 시간 증가', '피해 170 · 계수 3.0'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.aura = s.radius * p.st.areaMul;     // render.js 가 오라를 그립니다
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var r = w.aura;
      var dmg = (s.dmg + p.st.armor * s.armorRatio) * p.st.dmgMul;
      var near = g.enemiesInCircle(p.x, p.y, r);
      for (var i = 0; i < near.length; i++) {
        g.hurtEnemy(near[i], dmg, { color: this.color, crit: true });
        near[i].freezeT = Math.max(near[i].freezeT || 0, s.freeze * p.st.durMul);
      }
      g.pulse(p.x, p.y, r, this.color);
      if (w.evolved) {
        p.shield = Math.max(p.shield, p.maxHp * s.shield);
        p.shieldT = Math.max(p.shieldT, s.cd);
      }
    }
  },

  // 메아리치는 박쥐칼날 — 벽 튕김
  batblades: {
    name: '메아리치는 박쥐칼날', en: 'Echoing Batblades', icon: '🦇', color: '#C9A6FF',
    desc: '벽에 튕기는 투사체를 발사합니다.',
    evo: '베인의 크로마칼날', evoPerk: 'proj',
    evoDesc: '벽에 튕기며 관통하는 투사체를 발사합니다. 튕길 때마다 피해량이 증가합니다.',
    lv: [
      { dmg: 70, cd: 1.5, count: 1, range: 1200, speed: 1200, bounce: 3, pierce: 0 },
      { dmg: 90, cd: 1.4, count: 2, range: 1200, speed: 1200, bounce: 3, pierce: 0 },
      { dmg: 115, cd: 1.3, count: 2, range: 1300, speed: 1250, bounce: 4, pierce: 1 },
      { dmg: 145, cd: 1.2, count: 3, range: 1300, speed: 1250, bounce: 5, pierce: 1 },
      { dmg: 180, cd: 1.1, count: 3, range: 1400, speed: 1300, bounce: 6, pierce: 2 }
    ],
    evoStats: { dmg: 180, cd: 1.0, count: 4, range: 1400, speed: 1300, bounce: 8, pierce: 99, ramp: 0.25 },
    upText: ['투사체 +1', '튕김 +1 · 관통 +1', '투사체 +1', '피해 180'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var base = g.aimAngle(p.x, p.y, s.range);
      if (base === null) { w.t = 0.12; return; }
      w.t = s.cd / p.st.asMul;
      var n = s.count + p.st.projAdd;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * 0.24;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 20, dmg: s.dmg * p.st.dmgMul, pierce: s.pierce + p.st.pierceAdd,
          life: 3.0, color: this.color, shape: 'bolt', knock: 60, crit: true,
          bounce: s.bounce, bounceRamp: s.ramp || 0
        });
      }
    }
  },

  // 전투 토끼 석궁 — 무작위 원뿔
  crossbow: {
    name: '전투 토끼 석궁', en: 'Battle Bunny Crossbow', icon: '🏹', color: '#FF8FD0',
    desc: '무작위 방향 원뿔 범위에 추가 치명타 확률이 적용된 투사체를 발사합니다. 치명타로 적중하면 관통합니다.',
    evo: '토끼 프라임 거대 석궁', evoPerk: 'crit',
    evoDesc: '투사체가 대폭 늘어나 사실상 전방위를 덮습니다.',
    lv: [
      { dmg: 55, cd: 1.8, count: 5, range: 900, speed: 1400, cone: 1.0, critBonus: 0.15 },
      { dmg: 70, cd: 1.7, count: 7, range: 900, speed: 1400, cone: 1.0, critBonus: 0.15 },
      { dmg: 85, cd: 1.6, count: 9, range: 950, speed: 1450, cone: 1.1, critBonus: 0.20 },
      { dmg: 105, cd: 1.5, count: 12, range: 950, speed: 1450, cone: 1.1, critBonus: 0.20 },
      { dmg: 125, cd: 1.4, count: 15, range: 1000, speed: 1500, cone: 1.2, critBonus: 0.25 }
    ],
    evoStats: { dmg: 125, cd: 1.4, count: 45, range: 1000, speed: 1500, cone: U.TAU, critBonus: 0.25 },
    upText: ['투사체 +2', '투사체 +2 · 치명타 +5%', '투사체 +3', '피해 125'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var base = U.rand(0, U.TAU);
      var n = s.count + p.st.projAdd * 2;
      for (var i = 0; i < n; i++) {
        var a = base + U.rand(-s.cone / 2, s.cone / 2);
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 14, dmg: s.dmg * p.st.dmgMul, pierce: p.st.pierceAdd,
          life: s.range / s.speed, color: this.color, shape: 'wave', rot: a,
          knock: 40, crit: true, critBonus: s.critBonus, pierceOnCrit: true
        });
      }
    }
  },

  // 토끼 초강력 폭발 — 궤도 폭격
  megablast: {
    name: '토끼 초강력 폭발', en: 'Bunny Mega-Blast', icon: '🚀', color: '#FF6FD8',
    desc: '무작위 적에게 추가 치명타 확률이 적용된 궤도 폭격을 발사합니다.',
    evo: '고속 토끼 속사포', evoPerk: 'crit',
    evoDesc: '궤도 폭격을 더 빠르게 퍼붓고 강력한 타격으로 마무리합니다.',
    lv: [
      { dmg: 220, cd: 2.4, count: 1, aoe: 260, critBonus: 0.15 },
      { dmg: 280, cd: 2.2, count: 2, aoe: 280, critBonus: 0.15 },
      { dmg: 350, cd: 2.0, count: 2, aoe: 300, critBonus: 0.20 },
      { dmg: 430, cd: 1.8, count: 3, aoe: 320, critBonus: 0.20 },
      { dmg: 520, cd: 1.6, count: 4, aoe: 350, critBonus: 0.25 }
    ],
    evoStats: { dmg: 520, cd: 1.0, count: 5, aoe: 380, critBonus: 0.30, finisher: 1600 },
    upText: ['폭격 +1', '피해 350', '폭격 +1', '폭격 +1 · 피해 520'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var pool = g.enemiesInCircle(p.x, p.y, 1600 * p.st.areaMul);
      if (!pool.length) { w.t = 0.2; return; }
      var n = s.count + Math.floor(p.st.projAdd / 2);
      var self = this;
      for (var i = 0; i < n; i++) {
        var e = U.pick(pool);
        (function (tx, ty, last) {
          g.ring(tx, ty, s.aoe * p.st.areaMul, self.color);
          g.delay(0.35 + i * 0.1, function () {
            var dmg = (last && s.finisher ? s.finisher : s.dmg) * p.st.dmgMul;
            g.damageCircle(tx, ty, s.aoe * p.st.areaMul, dmg, {
              color: self.color, knock: 240, crit: true, critBonus: s.critBonus
            });
            g.boom(tx, ty, s.aoe * p.st.areaMul, self.color);
          });
        })(e.x, e.y, w.evolved && i === n - 1);
      }
    }
  },

  // 상어잡이 해양 기뢰 — 적 사이를 튕기는 폭발물
  seamine: {
    name: '상어잡이 해양 기뢰', en: 'Sharkbait Sea Mine', icon: '💣', color: '#7EC8FF',
    desc: '적 사이를 튕기는 폭발물을 발사합니다.',
    evo: '무한의 괴물 퇴치기', evoPerk: 'dmg',
    evoDesc: '대상이 존재하는 한 계속해서 적 사이를 튕깁니다.',
    lv: [
      { dmg: 130, cd: 2.6, jumps: 3, aoe: 220, range: 1000 },
      { dmg: 170, cd: 2.4, jumps: 4, aoe: 240, range: 1000 },
      { dmg: 215, cd: 2.2, jumps: 5, aoe: 260, range: 1100 },
      { dmg: 270, cd: 2.0, jumps: 6, aoe: 280, range: 1100 },
      { dmg: 330, cd: 1.8, jumps: 8, aoe: 300, range: 1200 }
    ],
    evoStats: { dmg: 330, cd: 1.8, jumps: 99, aoe: 320, range: 1200 },
    upText: ['튕김 +1', '피해 215', '튕김 +1', '피해 330'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var target = g.nearestEnemy(p.x, p.y, s.range);
      if (!target) { w.t = 0.15; return; }
      w.t = s.cd / p.st.asMul;
      var self = this, hit = [], cur = target, step = 0;
      var hop = function () {
        if (!cur || step >= s.jumps) return;
        step++;
        g.damageCircle(cur.x, cur.y, s.aoe * p.st.areaMul, s.dmg * p.st.dmgMul, {
          color: self.color, knock: 180, crit: true
        });
        g.boom(cur.x, cur.y, s.aoe * p.st.areaMul, self.color);
        hit.push(cur);
        // 원작처럼 같은 대상에게 다시 튕기지 않습니다.
        cur = g.nearestEnemy(cur.x, cur.y, 700 * p.st.areaMul, hit);
        if (cur) g.delay(0.14, hop);
      };
      hop();
    }
  },

  // 최후의 도시 대중교통 — 무작위 열차
  transit: {
    unlock: 'boss3',
    name: '최후의 도시 대중교통', en: 'Last City Transit', icon: '🚇', color: '#8FA8FF',
    desc: '열차가 무작위로 적을 들이받고 지나갑니다.',
    evo: 'FC 급행열차', evoPerk: 'dmg',
    evoDesc: '열차가 지나간 자리에 폭발을 일으켜 적을 띄웁니다. 처치 시 일정 확률로 골드를 떨어뜨립니다.',
    lv: [
      { dmg: 260, cd: 4.0, width: 180, armorRatio: 2.0 },
      { dmg: 330, cd: 3.7, width: 200, armorRatio: 2.0 },
      { dmg: 420, cd: 3.4, width: 220, armorRatio: 2.5 },
      { dmg: 530, cd: 3.1, width: 240, armorRatio: 2.5 },
      { dmg: 650, cd: 2.8, width: 260, armorRatio: 3.0 }
    ],
    evoStats: { dmg: 650, cd: 2.4, width: 300, armorRatio: 3.0, blast: 400, gold: 0.25 },
    upText: ['폭 증가', '피해·계수 증가', '폭 증가', '피해 650 · 계수 3.0'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var a = U.rand(0, U.TAU);
      var d = 1600;
      var x1 = p.x - Math.cos(a) * d, y1 = p.y - Math.sin(a) * d;
      var x2 = p.x + Math.cos(a) * d, y2 = p.y + Math.sin(a) * d;
      var dmg = (s.dmg + p.st.armor * s.armorRatio) * p.st.dmgMul;
      g.beam(x1, y1, x2, y2, s.width * p.st.areaMul, this.color, 0.4, false);
      g.damageLine(x1, y1, x2, y2, s.width * p.st.areaMul / 2, dmg, {
        color: this.color, knock: 400, crit: true,
        goldChance: w.evolved ? s.gold : 0
      });
      if (w.evolved) {
        var self = this;
        g.delay(0.3, function () {
          for (var i = 0; i < 6; i++) {
            var t = (i + 0.5) / 6;
            var bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t;
            g.damageCircle(bx, by, 260 * p.st.areaMul, s.blast * p.st.dmgMul, {
              color: self.color, knock: 460
            });
            g.boom(bx, by, 260 * p.st.areaMul, self.color);
          }
        });
      }
      g.shake(6);
    }
  },

  // 칼날 부메랑
  boomerang: {
    name: '칼날 부메랑', en: 'Blade Boomerang', icon: '🪃', color: '#F3C96B',
    desc: '가장 가까운 적에게 되돌아오는 투사체를 발사합니다.',
    evo: '사중 부메랑', evoPerk: 'speed',
    evoDesc: '투사체가 작은 투사체로 폭발해 원뿔 범위에 피해를 입힙니다.',
    lv: [
      { dmg: 100, cd: 1.8, count: 1, range: 900, speed: 1000 },
      { dmg: 130, cd: 1.7, count: 1, range: 950, speed: 1000 },
      { dmg: 165, cd: 1.6, count: 2, range: 1000, speed: 1050 },
      { dmg: 205, cd: 1.5, count: 2, range: 1000, speed: 1050 },
      { dmg: 250, cd: 1.4, count: 3, range: 1100, speed: 1100 }
    ],
    evoStats: { dmg: 250, cd: 1.3, count: 3, range: 1100, speed: 1100, shards: 7, shardDmg: 110 },
    upText: ['피해 130', '부메랑 +1', '피해 205', '부메랑 +1 · 피해 250'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var target = g.nearestEnemy(p.x, p.y, s.range);
      if (!target) { w.t = 0.12; return; }
      w.t = s.cd / p.st.asMul;
      var base = U.angle(p.x, p.y, target.x, target.y);
      var n = s.count + p.st.projAdd;
      var self = this;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * 0.3;
        var b = {
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 24, dmg: s.dmg * p.st.dmgMul, pierce: 99, life: s.range / s.speed,
          color: this.color, shape: 'wave', rot: a, knock: 70, crit: true,
          boomerang: 1, spin: 14
        };
        if (w.evolved) {
          b.onEnd = function (bx, by) {
            for (var k = 0; k < s.shards; k++) {
              var sa = U.rand(0, U.TAU);
              g.spawnBullet({
                x: bx, y: by,
                vx: Math.cos(sa) * 900, vy: Math.sin(sa) * 900,
                r: 11, dmg: s.shardDmg * p.st.dmgMul, pierce: 0, life: 0.4,
                color: '#FFE066', shape: 'bolt', knock: 30, crit: true
              });
            }
          };
        }
        g.spawnBullet(b);
      }
    }
  },

  // 발자국 중독 장치 — 이동 경로 장판
  toxintrail: {
    name: '발자국 중독 장치', en: 'Footstep Poisoner', icon: '☣️', color: '#9BE86B',
    desc: '지나간 자리에 피해를 입히는 흔적을 남깁니다.',
    evo: '맨발 화학 물질 분사기', evoPerk: 'speed',
    evoDesc: '적에게 피해를 입히면 중첩되는 보호막과 이동 속도를 얻습니다.',
    lv: [
      { dps: 90, cd: 0.30, radius: 130, life: 2.5 },
      { dps: 120, cd: 0.28, radius: 145, life: 2.8 },
      { dps: 155, cd: 0.26, radius: 160, life: 3.1 },
      { dps: 195, cd: 0.24, radius: 175, life: 3.4 },
      { dps: 245, cd: 0.22, radius: 195, life: 3.8 }
    ],
    evoStats: { dps: 245, cd: 0.22, radius: 230, life: 4.2, shieldPer: 0.012, msPer: 0.02 },
    upText: ['흔적 범위 증가', '피해 155', '지속 시간 증가', '피해 245'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd;
      g.spawnZone(p.x, p.y, s.radius * p.st.areaMul, s.dps * p.st.dmgMul,
        s.life * p.st.durMul, this.color, 'toxin');
      if (w.evolved) {
        // 진화 시 이 장판이 적을 때릴 때마다 보호막·이속이 쌓입니다 (game.js 의 zone 처리).
        p.px.toxinShield = s.shieldPer;
        p.px.toxinMs = s.msPer;
      }
    }
  },

  // 사자의 비가 — 좌우 초승달
  lionelegy: {
    name: '사자의 비가', en: "Lioness's Lament", icon: '🌙', color: '#FFD98E',
    desc: '캐릭터 왼쪽과 오른쪽으로 초승달 모양 투사체를 발사합니다.',
    evo: '휘감는 빛', evoPerk: 'haste',
    evoDesc: '투사체가 화면을 가로지르는 빛의 광선이 됩니다.',
    lv: [
      { dmg: 120, cd: 1.6, range: 800, speed: 1100, size: 46 },
      { dmg: 155, cd: 1.5, range: 850, speed: 1100, size: 52 },
      { dmg: 195, cd: 1.4, range: 900, speed: 1150, size: 58 },
      { dmg: 240, cd: 1.3, range: 950, speed: 1150, size: 64 },
      { dmg: 295, cd: 1.2, range: 1000, speed: 1200, size: 72 }
    ],
    evoStats: { dmg: 420, cd: 1.1, range: 2200, speed: 0, size: 120, laser: true },
    upText: ['피해 155', '크기·사거리 증가', '피해 240', '피해 295'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var dirs = [0, Math.PI];
      for (var i = 0; i < dirs.length; i++) {
        var a = dirs[i];
        if (s.laser) {
          var ex = p.x + Math.cos(a) * s.range, ey = p.y + Math.sin(a) * s.range;
          g.beam(p.x, p.y, ex, ey, s.size * p.st.areaMul, this.color, 0.3, false);
          g.damageLine(p.x, p.y, ex, ey, s.size * p.st.areaMul / 2, s.dmg * p.st.dmgMul, {
            color: this.color, knock: 100, crit: true
          });
        } else {
          g.spawnBullet({
            x: p.x, y: p.y,
            vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
            r: s.size * p.st.areaMul, dmg: s.dmg * p.st.dmgMul,
            pierce: 99, life: s.range / s.speed,
            color: this.color, shape: 'wave', rot: a, knock: 80, crit: true
          });
        }
      }
    }
  },

  // 티.버 — 근접 소환수
  tibbers: {
    name: '티.버', en: 'T.Bear', icon: '🐻', color: '#FF8B3D',
    desc: '로봇 티버를 소환합니다. 로봇 티버는 할퀴기 공격으로 광역 피해를 입힙니다.',
    evo: '티.버 (특.대.형 에디션)', evoPerk: 'dur',
    evoDesc: '분노한 티버가 체력이 가장 높은 적에게 집중하며, 점점 커지고 빨라져 피해량이 증가합니다.',
    lv: [
      { dmg: 180, cd: 1.2, radius: 190, speed: 380, size: 50 },
      { dmg: 235, cd: 1.1, radius: 205, speed: 400, size: 54 },
      { dmg: 300, cd: 1.0, radius: 220, speed: 420, size: 58 },
      { dmg: 375, cd: 0.9, radius: 235, speed: 440, size: 62 },
      { dmg: 460, cd: 0.8, radius: 250, speed: 470, size: 68 }
    ],
    evoStats: { dmg: 460, cd: 0.7, radius: 300, speed: 520, size: 82, rage: 1 },
    upText: ['피해 235', '범위 증가', '피해 375', '피해 460'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      if (!w.pet) w.pet = { x: p.x + 120, y: p.y, t: 0, r: s.size, rage: 0 };
      var pet = w.pet;
      pet.r = s.size * p.st.areaMul * (1 + (pet.rage || 0) * 0.15);

      // 진화하면 체력이 가장 높은 적을 노리고, 시간이 갈수록 커집니다.
      var target = s.rage ? g.toughestEnemy(pet.x, pet.y, 1400) : g.nearestEnemy(pet.x, pet.y, 1000);
      if (s.rage) pet.rage = Math.min(1, (pet.rage || 0) + dt * 0.05);
      var tx, ty;
      if (target) { tx = target.x; ty = target.y; }
      else { tx = p.x - 110; ty = p.y + 70; pet.rage = 0; }
      var a = U.angle(pet.x, pet.y, tx, ty);
      var d = U.dist(pet.x, pet.y, tx, ty);
      if (d > (target ? pet.r : 100)) {
        var sp = s.speed * (1 + (pet.rage || 0) * 0.5);
        pet.x += Math.cos(a) * sp * dt;
        pet.y += Math.sin(a) * sp * dt;
      }
      if (U.dist(pet.x, pet.y, p.x, p.y) > 1600) { pet.x = p.x; pet.y = p.y; }

      pet.t -= dt;
      if (pet.t > 0 || !target) return;
      if (U.dist(pet.x, pet.y, target.x, target.y) > pet.r + target.r + 60) return;
      pet.t = s.cd / p.st.asMul;
      g.damageCircle(pet.x, pet.y, s.radius * p.st.areaMul, s.dmg * (1 + (pet.rage || 0)) * p.st.dmgMul, {
        color: this.color, knock: 240, crit: true, minion: true
      });
      g.boom(pet.x, pet.y, s.radius * p.st.areaMul * 0.7, this.color);
    }
  },

  // 개틀링 토끼 건 — 원뿔 지속 피해
  gatlingbunny: {
    name: '개틀링 토끼 건', en: 'Gatling Bunny-Gun', icon: '🔥', color: '#FF9F43',
    desc: '원뿔 범위에 광역 지속 피해를 입힙니다.',
    evo: '이중 깡충깡충 포화', evoPerk: 'dur',
    evoDesc: '피해를 받은 적은 둔화되며 결국에는 기절합니다. 기절한 적에게는 추가 피해를 입힙니다.',
    lv: [
      { dps: 260, cd: 3.4, fire: 1.4, range: 700, arc: 0.9 },
      { dps: 330, cd: 3.2, fire: 1.6, range: 740, arc: 0.95 },
      { dps: 410, cd: 3.0, fire: 1.8, range: 780, arc: 1.0 },
      { dps: 500, cd: 2.8, fire: 2.0, range: 820, arc: 1.05 },
      { dps: 610, cd: 2.6, fire: 2.2, range: 880, arc: 1.1 }
    ],
    evoStats: { dps: 610, cd: 2.4, fire: 2.8, range: 950, arc: 1.2, slow: 0.4, stunAt: 5, stunBonus: 900 },
    upText: ['사격 시간 증가', '피해 410', '사격 시간 증가', '피해 610'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      if (w.firing > 0) {
        w.firing -= dt;
        w.tick = (w.tick || 0) - dt;
        if (w.tick <= 0) {
          w.tick = 0.15;
          var r = s.range * p.st.areaMul;
          g.damageArc(p.x, p.y, r, w.ang, s.arc, s.dps * 0.15 * p.st.dmgMul, {
            color: this.color, quiet: true, crit: true,
            slow: s.slow || 0, slowT: 1.2 * p.st.durMul,
            gatling: w.evolved ? { at: s.stunAt, bonus: s.stunBonus * p.st.dmgMul, dur: 1.4 * p.st.durMul } : null
          });
          g.slash(p.x, p.y, r, w.ang, s.arc, this.color);
        }
        return;
      }
      w.t -= dt;
      if (w.t > 0) return;
      var ang = g.aimAngle(p.x, p.y, s.range * p.st.areaMul);
      if (ang === null) { w.t = 0.15; return; }
      w.t = s.cd / p.st.asMul;
      w.ang = ang;
      w.firing = s.fire * p.st.durMul;
    }
  },

  // 동물 지뢰
  animine: {
    name: '동물 지뢰', en: 'Anima Mine', icon: '🧨', color: '#FF6B6B',
    desc: '주위로 시간제한 폭발성 투사체를 떨어뜨립니다.',
    evo: '징크스의 삼중 다이너마이트', evoPerk: 'area',
    evoDesc: '폭발 시 추가로 연쇄 폭발을 일으켜 막대한 광역 피해를 입힙니다.',
    lv: [
      { dmg: 190, cd: 2.2, count: 2, aoe: 240, fuse: 1.2 },
      { dmg: 240, cd: 2.1, count: 3, aoe: 260, fuse: 1.2 },
      { dmg: 300, cd: 2.0, count: 4, aoe: 280, fuse: 1.1 },
      { dmg: 370, cd: 1.9, count: 5, aoe: 300, fuse: 1.1 },
      { dmg: 450, cd: 1.8, count: 6, aoe: 330, fuse: 1.0 }
    ],
    evoStats: { dmg: 450, cd: 1.6, count: 7, aoe: 360, fuse: 1.0, chain: 3, chainDmg: 300 },
    upText: ['지뢰 +1', '지뢰 +1 · 피해 300', '지뢰 +1', '지뢰 +1 · 피해 450'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var n = s.count + p.st.projAdd;
      for (var i = 0; i < n; i++) {
        var a = U.rand(0, U.TAU), d = U.rand(120, 520) * p.st.areaMul;
        g.spawnMine({
          x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
          t: s.fuse, r: s.aoe * p.st.areaMul, dmg: s.dmg * p.st.dmgMul, color: this.color,
          chain: w.evolved ? s.chain : 0, chainDmg: (s.chainDmg || 0) * p.st.dmgMul
        });
      }
    }
  },

  // 타오르는 단궁 — 불타는 영역
  shortbow: {
    name: '타오르는 단궁', en: 'Searing Shortbow', icon: '🏹', color: '#FF7A3D',
    desc: '불타는 영역을 남기는 투사체를 발사합니다.',
    evo: '진화한 불꽃 사격', evoPerk: 'area',
    evoDesc: '불타는 영역의 크기가 커지고 추가 지속 피해를 입힙니다. 붉은 불꽃이 푸른 불꽃으로 바뀝니다.',
    lv: [
      { dmg: 90, cd: 1.7, count: 1, range: 900, speed: 1000, zone: 200, dps: 110, life: 3 },
      { dmg: 115, cd: 1.6, count: 1, range: 950, speed: 1000, zone: 220, dps: 145, life: 3.2 },
      { dmg: 145, cd: 1.5, count: 2, range: 1000, speed: 1050, zone: 240, dps: 185, life: 3.4 },
      { dmg: 180, cd: 1.4, count: 2, range: 1000, speed: 1050, zone: 260, dps: 230, life: 3.6 },
      { dmg: 220, cd: 1.3, count: 3, range: 1100, speed: 1100, zone: 290, dps: 285, life: 4 }
    ],
    evoStats: { dmg: 220, cd: 1.2, count: 3, range: 1100, speed: 1100, zone: 420, dps: 430, life: 5, blue: true },
    upText: ['화살 +1', '영역 피해 증가', '화살 +1', '피해 220'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      var base = g.aimAngle(p.x, p.y, s.range);
      if (base === null) { w.t = 0.12; return; }
      w.t = s.cd / p.st.asMul;
      var col = s.blue ? '#6FD3FF' : this.color;
      var n = s.count + p.st.projAdd;
      for (var i = 0; i < n; i++) {
        var a = base + (i - (n - 1) / 2) * 0.18;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 15, dmg: s.dmg * p.st.dmgMul, pierce: 0, life: s.range / s.speed,
          color: col, shape: 'bolt', knock: 40, crit: true,
          onEnd: function (bx, by) {
            g.spawnZone(bx, by, s.zone * p.st.areaMul, s.dps * p.st.dmgMul,
              s.life * p.st.durMul, col, 'burn');
          }
        });
      }
    }
  },

  // 광휘 역장 — 최대 체력 비례 오라
  radiant: {
    name: '광휘 역장', en: 'Radiant Field', icon: '🌟', color: '#FFE066',
    desc: '최대 체력에 비례해 주변 적에게 피해를 입힙니다.',
    evo: '폭발의 포옹', evoPerk: 'hp',
    evoDesc: '불타는 영역 안에서 사망한 적은 폭발을 일으킵니다.',
    lv: [
      { dmg: 40, cd: 0.5, radius: 250, hpRatio: 0.02 },
      { dmg: 55, cd: 0.48, radius: 270, hpRatio: 0.025 },
      { dmg: 72, cd: 0.46, radius: 290, hpRatio: 0.03 },
      { dmg: 92, cd: 0.44, radius: 310, hpRatio: 0.035 },
      { dmg: 115, cd: 0.42, radius: 340, hpRatio: 0.04 }
    ],
    evoStats: { dmg: 115, cd: 0.4, radius: 400, hpRatio: 0.045, corpse: 500 },
    upText: ['반경·계수 증가', '피해 72', '반경 증가', '피해 115 · 계수 4%'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.aura = s.radius * p.st.areaMul;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var dmg = (s.dmg + p.maxHp * s.hpRatio) * p.st.dmgMul;
      var near = g.enemiesInCircle(p.x, p.y, w.aura);
      for (var i = 0; i < near.length; i++) {
        g.hurtEnemy(near[i], dmg, { color: this.color, quiet: true, corpse: w.evolved ? s.corpse * p.st.dmgMul : 0 });
      }
      g.pulse(p.x, p.y, w.aura, this.color);
    }
  },

  // 소용돌이 장갑 — 회전 투사체 줄기
  whirlgauntlet: {
    name: '소용돌이 장갑', en: 'Whirling Gauntlet', icon: '🌀', color: '#B6F2FF',
    desc: '지속적으로 회전하는 투사체의 줄기를 방출합니다.',
    evo: '폭풍의 건틀릿', evoPerk: 'regen',
    evoDesc: '주위에 지속적으로 회전하는 두 번째 투사체의 줄기를 방출합니다.',
    lv: [
      { dmg: 55, cd: 0.12, range: 700, speed: 1200, spin: 3.2, arms: 1 },
      { dmg: 70, cd: 0.11, range: 740, speed: 1250, spin: 3.4, arms: 1 },
      { dmg: 88, cd: 0.10, range: 780, speed: 1300, spin: 3.6, arms: 1 },
      { dmg: 110, cd: 0.095, range: 820, speed: 1350, spin: 3.8, arms: 1 },
      { dmg: 135, cd: 0.09, range: 880, speed: 1400, spin: 4.0, arms: 1 }
    ],
    evoStats: { dmg: 135, cd: 0.09, range: 880, speed: 1400, spin: 4.0, arms: 2 },
    upText: ['연사 속도 증가', '피해 88', '사거리 증가', '피해 135'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.ang = (w.ang || 0) + s.spin * dt;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var n = s.arms;
      for (var i = 0; i < n; i++) {
        var a = w.ang + (U.TAU / n) * i;
        g.spawnBullet({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          r: 12, dmg: s.dmg * p.st.dmgMul, pierce: p.st.pierceAdd,
          life: s.range / s.speed, color: this.color, shape: 'bolt', knock: 25, crit: true
        });
      }
    }
  },

  // 회오리 칼날 — 공전 투사체
  windblades: {
    name: '회오리 칼날', en: 'Cyclone Blades', icon: '🗡️', color: '#8FD8FF',
    desc: '주위를 도는 투사체가 적에게 피해를 입히고 뒤로 밀어냅니다.',
    evo: '그치지 않는 폭풍', evoPerk: 'regen',
    evoDesc: '영구적으로 주위를 도는 투사체가 적에게 피해를 입히고 뒤로 밀어냅니다.',
    lv: [
      { dmg: 110, cd: 3.0, life: 2.0, count: 2, radius: 260, spin: 3.0 },
      { dmg: 140, cd: 2.9, life: 2.3, count: 2, radius: 280, spin: 3.0 },
      { dmg: 175, cd: 2.8, life: 2.6, count: 3, radius: 300, spin: 3.2 },
      { dmg: 215, cd: 2.7, life: 3.0, count: 3, radius: 320, spin: 3.2 },
      { dmg: 265, cd: 2.6, life: 3.4, count: 4, radius: 350, spin: 3.4 }
    ],
    evoStats: { dmg: 265, cd: 0, life: Infinity, count: 5, radius: 420, spin: 3.0 },
    upText: ['지속 시간 증가', '칼날 +1', '지속 시간 증가', '칼날 +1 · 피해 265'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      if (!w.orb) w.orb = [];
      w.ang = (w.ang || 0) + s.spin * dt;
      var want = s.count + p.st.projAdd;

      if (s.life === Infinity) {
        // 진화 — 영구 공전. 궤도만 유지하면 됩니다.
        while (w.orb.length < want) w.orb.push({});
        while (w.orb.length > want) w.orb.pop();
      } else {
        w.t -= dt;
        if (w.t <= 0) {
          w.t = s.cd / p.st.asMul;
          w.until = s.life * p.st.durMul;
          w.orb = [];
          for (var k = 0; k < want; k++) w.orb.push({});
        }
        if (w.until > 0) { w.until -= dt; if (w.until <= 0) w.orb = []; }
      }

      var r = s.radius * p.st.areaMul;
      for (var i = 0; i < w.orb.length; i++) {
        var a = w.ang + (U.TAU / w.orb.length) * i;
        var ox = p.x + Math.cos(a) * r, oy = p.y + Math.sin(a) * r;
        w.orb[i].x = ox; w.orb[i].y = oy;     // render.js 가 그립니다
        var hitR = 60 * p.st.areaMul;
        var list = g.enemiesInCircle(ox, oy, hitR);
        for (var j = 0; j < list.length; j++) {
          if (!g.canHit(list[j], 'orb' + i, 0.4)) continue;
          g.hurtEnemy(list[j], s.dmg * p.st.dmgMul, { color: this.color, knock: 400 });
        }
      }
    }
  },

  // 유미봇 — 경험치를 대신 주워 오는 드론
  yuumibot: {
    unlock: 'evolve3',
    name: '유미봇', en: 'Yuumi-Bot', icon: '🛸', color: '#7EF2D8',
    desc: '유미.AI 드론을 소환합니다. 적에게 피해를 입히고 공중으로 띄우며, 경험치를 수집합니다.',
    evo: '유미봇_최종_최종', evoPerk: 'pickup',
    evoDesc: '유미.AI가 충분한 피해를 입히면 체력 아이템을 떨어뜨립니다.',
    lv: [
      { dmg: 70, cd: 0.9, count: 1, range: 800, speed: 1400, collect: 600 },
      { dmg: 90, cd: 0.85, count: 1, range: 850, speed: 1400, collect: 700 },
      { dmg: 115, cd: 0.8, count: 2, range: 900, speed: 1450, collect: 800 },
      { dmg: 145, cd: 0.75, count: 2, range: 950, speed: 1450, collect: 900 },
      { dmg: 180, cd: 0.7, count: 3, range: 1000, speed: 1500, collect: 1000 }
    ],
    evoStats: { dmg: 180, cd: 0.6, count: 4, range: 1100, speed: 1550, collect: 1300, healDrop: 12000 },
    upText: ['드론 +1', '피해 115', '드론 +1', '드론 +1 · 피해 180'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      var want = s.count + Math.floor(p.st.projAdd / 2);
      if (!w.drones) w.drones = [];
      while (w.drones.length < want) w.drones.push({ x: p.x, y: p.y, a: U.rand(0, U.TAU), t: U.rand(0, s.cd) });
      while (w.drones.length > want) w.drones.pop();
      w.collect = s.collect * p.st.areaMul;   // game.js 의 pickup 처리가 씁니다

      for (var i = 0; i < w.drones.length; i++) {
        var d = w.drones[i];
        d.a += dt * 1.1;
        var tx = p.x + Math.cos(d.a + (U.TAU / want) * i) * 170;
        var ty = p.y + Math.sin(d.a + (U.TAU / want) * i) * 170;
        d.x += (tx - d.x) * Math.min(1, dt * 6);
        d.y += (ty - d.y) * Math.min(1, dt * 6);
        d.t -= dt;
        if (d.t > 0) continue;
        var target = g.nearestEnemy(d.x, d.y, s.range * p.st.areaMul);
        if (!target) { d.t = 0.1; continue; }
        d.t = s.cd / p.st.asMul;
        var ang = U.angle(d.x, d.y, target.x, target.y);
        g.spawnBullet({
          x: d.x, y: d.y,
          vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
          r: 11, dmg: s.dmg * p.st.dmgMul, pierce: p.st.pierceAdd, life: 0.8,
          color: this.color, shape: 'bolt', knock: 320, crit: true, minion: true,
          healDrop: w.evolved ? s.healDrop : 0
        });
      }
    }
  },

  // 절멸자 — 잡몹 전멸
  annihilator: {
    unlock: 'kills5000',
    name: '절멸자', en: 'Annihilator', icon: '☢️', color: '#FF4D6D',
    desc: '모든 일반 적을 처치하고 정예에게 막대한 피해를 입힙니다. 재사용 대기시간이 깁니다.',
    evo: '동물의 종말', evoPerk: 'xp',
    evoDesc: '폭발로 사망한 적에게서 추가 경험치를 얻습니다. 또한 일정 확률로 골드를 떨어뜨립니다.',
    lv: [
      { cd: 26, radius: 1200, eliteDmg: 2600 },
      { cd: 24, radius: 1350, eliteDmg: 3400 },
      { cd: 22, radius: 1500, eliteDmg: 4400 },
      { cd: 20, radius: 1650, eliteDmg: 5600 },
      { cd: 18, radius: 1800, eliteDmg: 7000 }
    ],
    evoStats: { cd: 16, radius: 2000, eliteDmg: 9000, xpBonus: 1.5, gold: 0.35 },
    upText: ['반경 증가', '정예 피해 증가', '반경 증가', '재사용 18초'],
    update: function (g, w, dt) {
      var s = wst(this, w), p = g.p;
      w.t -= dt;
      if (w.t > 0) return;
      w.t = s.cd / p.st.asMul;
      var r = s.radius * p.st.areaMul;
      g.boom(p.x, p.y, r, this.color);
      g.ring(p.x, p.y, r, this.color);
      var list = g.enemiesInCircle(p.x, p.y, r);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        var big = e.elite || e.boss;
        g.hurtEnemy(e, big ? s.eliteDmg * p.st.dmgMul : e.hp + 1, {
          color: this.color,
          xpBonus: w.evolved ? s.xpBonus : 0,
          goldChance: w.evolved ? s.gold : 0
        });
      }
      g.shake(14);
      g.flash = 0.35;
    }
  }
};

// 습득 가능한 무기 목록 — 챔피언 전용은 빠집니다.
var WEAPON_IDS = [];
(function () {
  for (var id in WEAPONS) if (!WEAPONS[id].champOnly) WEAPON_IDS.push(id);
})();
