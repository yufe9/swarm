// 기본 지속 효과 (Passive Perks) — 원작 집중포화의 '기본 지속 효과' 12종 그대로입니다.
//
// 성장의 두 축 중 하나입니다. 다른 하나는 무기(data.weapons.js).
//   · 동시에 최대 6종까지 보유 (PERK_SLOTS)
//   · 각 1~5레벨 (PERK_MAX_LV)
//   · **무기 진화의 열쇠**: 무기를 5단계까지 올린 뒤 그 무기의 evoPerk 를
//     1레벨이라도 갖고 있으면, 접근 카드를 주웠을 때 진화할 수 있습니다.
//     (원작과 같습니다. 만렙일 필요는 없고 '보유'만 하면 됩니다.)
//
// apply(p, lv, g) 는 **그 레벨에서 추가로 적용할 몫만** 반영합니다. 누적값이 아닙니다.
// 수치는 나무위키 '집중포화' 기본 지속 효과 표를 그대로 옮긴 것입니다.
//   (최대 체력만 예외 — 원작은 +150 고정이지만 챔피언 기본 체력이 1000이므로 +15%로 환산)

var PERK_SLOTS = 6;
var PERK_MAX_LV = 5;

var PERKS = {
  dmg: {
    name: '피해량', en: 'Damage', icon: '🔥', color: '#FF8B6B',
    desc: function (lv) { return '피해량 +' + lv * 10 + '%'; },
    apply: function (p) { p.st.dmgMul *= 1.10; }
  },
  crit: {
    name: '치명타 확률', en: 'Crit Chance', icon: '⚔️', color: '#F3C96B',
    desc: function (lv) { return '치명타 확률 +' + lv * 8 + '%'; },
    apply: function (p) { p.st.crit += 0.08; }
  },
  haste: {
    name: '스킬 가속', en: 'Ability Haste', icon: '⏱️', color: '#B6F2FF',
    // 본 모드에선 기본 공격도 무기 판정이라, 스킬 가속이 곧 공격 속도입니다.
    desc: function (lv) {
      var h = lv * 10;
      return '스킬 가속 +' + h + ' (재사용 대기시간 -' + Math.round(h / (100 + h) * 100) + '%)';
    },
    apply: function (p) { p.st.haste += 10; }
  },
  proj: {
    name: '투사체', en: 'Projectiles', icon: '🎯', color: '#7EC8FF',
    // 원작: 1레벨 +1, 3레벨 +2, 5레벨 +3 (누적 총량). 그래서 증분은 2·4레벨에 0입니다.
    desc: function (lv) { return '투사체 +' + [1, 1, 2, 2, 3][lv - 1]; },
    apply: function (p, lv) { if (lv === 1 || lv === 3 || lv === 5) p.st.projAdd += 1; }
  },
  speed: {
    name: '이동 속도', en: 'Move Speed', icon: '👟', color: '#8FD8FF',
    desc: function (lv) { return '이동 속도 +' + lv * 8 + '%'; },
    apply: function (p) { p.st.speedMul *= 1.08; }
  },
  hp: {
    name: '최대 체력', en: 'Max Health', icon: '❤️', color: '#FF5C7A',
    desc: function (lv) { return '최대 체력 +' + lv * 15 + '%'; },
    apply: function (p, lv, g) {
      var add = Math.round(p.baseMaxHp * 0.15);
      p.maxHp += add;
      g.healPlayer(add, true);
    }
  },
  armor: {
    name: '방어력', en: 'Armor', icon: '🛡️', color: '#B18BFF',
    desc: function (lv) {
      var a = lv * 8;
      return '방어력 +' + a + ' (받는 피해 -' + Math.round(a / (100 + a) * 100) + '%)';
    },
    apply: function (p) { p.st.armor += 8; }
  },
  regen: {
    name: '체력 재생', en: 'Health Regen', icon: '💚', color: '#8BE3A8',
    // 원작은 초당 +4 (기본 체력 1000 기준 0.4%). 최대 체력에 비례시켜 후반에도 의미가 남게 했습니다.
    desc: function (lv) { return '초당 최대 체력의 ' + (lv * 0.4).toFixed(1) + '% 회복'; },
    apply: function (p) { p.st.regenPct += 0.004; }
  },
  area: {
    name: '범위 크기', en: 'Area Size', icon: '🌐', color: '#C9A6FF',
    desc: function (lv) { return '범위 크기 +' + lv * 11 + '%'; },
    apply: function (p) { p.st.areaMul *= 1.11; }
  },
  dur: {
    name: '지속시간', en: 'Duration', icon: '⏳', color: '#FFD98E',
    desc: function (lv) { return '지속시간 +' + lv * 12 + '%'; },
    apply: function (p) { p.st.durMul *= 1.12; }
  },
  pickup: {
    name: '획득 반경', en: 'Pickup Radius', icon: '🧲', color: '#9BE86B',
    desc: function (lv) { return '획득 반경 +' + lv * 35 + '%'; },
    apply: function (p) { p.st.pickupMul += 0.35; }
  },
  xp: {
    name: '경험치', en: 'Experience', icon: '💠', color: '#6FD3FF',
    desc: function (lv) { return '경험치 획득 +' + lv * 10 + '%'; },
    apply: function (p) { p.st.xpMul += 0.10; }
  }
};

var PERK_IDS = Object.keys(PERKS);
