// 적·보스·웨이브·난이도·영구 강화 정의.
//
// 원작 집중포화의 적은 **태고족(Primordians)** 입니다. 대부분 해양 생물 모티브이고,
// 각 유닛은 리그 오브 레전드의 실제 챔피언·몬스터를 베이스로 합니다.
//
// 좌표·크기는 리그 오브 레전드 단위, 체력은 챔피언 1000 기준입니다.
//
// elite: true  — **정예병.** 처치하면 접근 카드를 확정 드랍합니다 (원작과 동일).
//                미니 보스도 같은 취급입니다.
// kind         — chase / ranged / bomber / charger
//   charger    : 한 방향으로 가속하며 돌진. 충돌하면 잠시 기절했다 다시 달립니다 (해마·딱정벌레).

var ENEMY_TYPES = {
  // ── 미니언 (잡몹) ────────────────────────────────────────────
  minion: {
    name: '태고족 병사', en: 'Primordian Grunt',
    hp: 45, speed: 128, dmg: 44, r: 26, color: '#8BE3A8',
    xp: 1, gold: 0.5, kind: 'chase', shape: 'minion'
  },
  swarmer: {
    name: '태고족 유충', en: 'Primordian Swarmer',
    hp: 22, speed: 190, dmg: 30, r: 18, color: '#A56BFF',
    xp: 0.6, gold: 0.25, kind: 'chase', shape: 'voidling'
  },
  spitter: {
    name: '태고족 사수', en: 'Primordian Spitter',
    hp: 70, speed: 104, dmg: 62, r: 28, color: '#9BB8FF',
    xp: 2, gold: 1.1, kind: 'ranged', shape: 'caster',
    range: 760, fireCd: 2.3, bulletSpeed: 620
  },
  bruiser: {
    name: '태고족 파쇄자', en: 'Primordian Bruiser',
    hp: 210, speed: 92, dmg: 88, r: 40, color: '#C2856B',
    xp: 3.5, gold: 1.6, kind: 'chase', shape: 'krug', knockRes: 0.5
  },
  darter: {
    name: '태고족 질주자', en: 'Primordian Darter',
    hp: 130, speed: 276, dmg: 70, r: 26, color: '#FF5C7A',
    xp: 3, gold: 1.4, kind: 'chase', shape: 'raptor'
  },

  // ── 미니 보스 (원작 명칭) ────────────────────────────────────
  // 위키상 '상어사수'·'독두꺼비'는 실제로는 무더기로 나오는 잡몹입니다.
  sharkgunner: {
    name: '상어사수', en: 'Sharkgunner',
    hp: 240, speed: 84, dmg: 76, r: 36, color: '#7FA8E8',
    xp: 3, gold: 1.5, kind: 'ranged', shape: 'cannon',
    // 아펠리오스 반월검 파수탑 포탑 베이스 — 느린 투사체를 연속으로 뿜습니다.
    range: 900, fireCd: 2.4, bulletSpeed: 380, spread: 3
  },
  poisontoad: {
    name: '독두꺼비', en: 'Poison Toad',
    hp: 150, speed: 120, dmg: 66, r: 32, color: '#A8E06B',
    xp: 3, gold: 1.5, kind: 'bomber', shape: 'gromp',
    // 협곡의 심술두꺼비 베이스 — 죽으면 독 웅덩이를 남깁니다. 원작 최악의 잡몹.
    fuse: 0.7, blast: 260, poolDmg: 70
  },
  cornucopia: {
    name: '화수분', en: 'Cornucopia',
    hp: 420, speed: 320, dmg: 0, r: 34, color: '#F3C96B',
    xp: 6, gold: 120, kind: 'flee', shape: 'cornucopia', elite: false,
    // 패턴 없이 도망만 칩니다. 잡으면 대량 골드.
    flees: true
  },
  spiderling: {
    name: '거미탄', en: 'Spiderling',
    hp: 1400, speed: 70, dmg: 92, r: 62, color: '#FF8B6B',
    xp: 16, gold: 14, kind: 'ranged', shape: 'spider', elite: true,
    knockRes: 0.7, dr: 0.10,
    // 우르곳 베이스 — 상어사수의 투사체를 사방으로 발사합니다.
    range: 1100, fireCd: 2.0, bulletSpeed: 460, spread: 9, radial: true
  },
  beetle: {
    name: '딱정벌레', en: 'Beetle',
    hp: 1100, speed: 150, dmg: 150, r: 54, color: '#6B5CFF',
    xp: 14, gold: 12, kind: 'charger', shape: 'beetle', elite: true,
    knockRes: 0.8, chargeTime: 2.6
    // 녹턴 베이스 — 직선 돌진. 선딜이 길고 방향을 예고합니다.
  },
  crusher: {
    name: '분쇄자', en: 'Crusher',
    hp: 2200, speed: 76, dmg: 175, r: 78, color: '#6FD3FF',
    xp: 22, gold: 20, kind: 'chase', shape: 'crusher', elite: true,
    knockRes: 0.95, dr: 0.18
    // 푸른 파수꾼(골렘) 베이스 — 강력한 광역 근접. 두세 마리 겹치면 즉사합니다.
  },
  belcher: {
    name: '용트림', en: 'Belcher',
    hp: 1300, speed: 66, dmg: 110, r: 58, color: '#FFB86B',
    xp: 15, gold: 13, kind: 'ranged', shape: 'belcher', elite: true,
    knockRes: 0.7,
    // 코그모 베이스 — 궁극기 같은 곡사포를 날립니다.
    range: 1500, fireCd: 2.6, bulletSpeed: 340, spread: 1, lob: true
  },
  seahorse: {
    name: '해마', en: 'Seahorse',
    hp: 2600, speed: 130, dmg: 230, r: 74, color: '#FF4D6D',
    xp: 26, gold: 24, kind: 'charger', shape: 'seahorse', elite: true,
    knockRes: 1, dr: 0.12, chargeTime: 6
    // 오른 궁의 거대 산양 베이스 — 충돌할 때까지 가속하며 돌진. 솔플 최악의 미니 보스.
  },

  // ── 정예병 ───────────────────────────────────────────────────
  // 크기가 매우 크고 알록달록한 미니언. 처치 시 접근 카드 확정 드랍.
  elite: {
    name: '태고족 정예병', en: 'Primordian Elite',
    hp: 1800, speed: 88, dmg: 130, r: 68, color: '#FF6FD8',
    xp: 20, gold: 18, kind: 'ranged', shape: 'elite', elite: true,
    knockRes: 0.85, dr: 0.12,
    range: 1000, fireCd: 2.2, bulletSpeed: 520, spread: 3
  }
};

// ── 최종 보스 ──────────────────────────────────────────────────
// 원작은 맵마다 최종 보스가 하나이고 15분에 등장합니다 (data.stages.js).
// patterns 는 각자의 실제 스킬입니다.
var BOSSES = {
  reksai: {
    name: '렉사이', en: "Rek'Sai", title: '공허의 굴착자',
    hp: 55000, speed: 130, dmg: 190, r: 130, color: '#FF9F43',
    xp: 400, gold: 260, shape: 'boss', knockRes: 1, dr: 0.1, final: true,
    // 땅굴을 파고 무적으로 이동 → 솟구쳐 딜타임. 상어 투사체와 충격파.
    patterns: ['burrow', 'charge', 'spray', 'summon'],
    summons: ['swarmer', 'swarmer', 'minion']
  },
  briarboss: {
    name: '브라이어', en: 'Briar', title: '억제된 굶주림',
    hp: 70000, speed: 190, dmg: 210, r: 120, color: '#E85C8A',
    xp: 500, gold: 300, shape: 'boss', knockRes: 1, dr: 0.12, final: true,
    // 상시 딜타임. 광분 돌진 + 360도 비명(넉백) + 맵 탄막.
    patterns: ['charge', 'spray', 'spikes', 'summon'],
    summons: ['swarmer', 'darter']
  },
  belveth: {
    name: '벨베스', en: "Bel'Veth", title: '공허의 여제',
    hp: 95000, speed: 150, dmg: 240, r: 145, color: '#C08BFF',
    xp: 650, gold: 380, shape: 'boss', knockRes: 1, dr: 0.18, final: true,
    // 저편으로(Q) 돌진 · 소용돌이 · 왕실 위엄(E) 회전 광선 · 저 너머의 존재(R) 소환
    patterns: ['charge', 'charge', 'rupture', 'laser', 'spray', 'summon'],
    summons: ['swarmer', 'swarmer', 'minion', 'darter']
  },
  aatrox: {
    name: '아트록스', en: 'Aatrox', title: '다르킨의 검',
    hp: 120000, speed: 140, dmg: 280, r: 160, color: '#D94E3A',
    xp: 900, gold: 500, shape: 'boss', knockRes: 1, dr: 0.2, final: true,
    // 다르킨의 검 3타 · 일직선 내려찍기 · 지옥사슬 · 해변 탄막
    patterns: ['spikes', 'rupture', 'charge', 'laser', 'spray', 'summon'],
    summons: ['minion', 'darter', 'bruiser']
  }
};

// 시간대별 등장 적 구성. from(초) 이후부터 해당 풀을 씁니다.
var WAVES = [
  { from: 0, pool: [['minion', 1]] },
  { from: 40, pool: [['minion', 1], ['swarmer', 0.55]] },
  { from: 100, pool: [['minion', 1], ['swarmer', 0.7], ['spitter', 0.3]] },
  { from: 170, pool: [['minion', 0.9], ['swarmer', 0.8], ['spitter', 0.4], ['poisontoad', 0.3]] },
  { from: 250, pool: [['minion', 0.7], ['swarmer', 0.8], ['spitter', 0.4], ['poisontoad', 0.4], ['bruiser', 0.3]] },
  { from: 340, pool: [['swarmer', 1.2], ['spitter', 0.45], ['poisontoad', 0.4], ['bruiser', 0.5], ['sharkgunner', 0.35]] },
  { from: 430, pool: [['swarmer', 1.0], ['spitter', 0.4], ['poisontoad', 0.4], ['bruiser', 0.6], ['darter', 0.6], ['sharkgunner', 0.45]] },
  { from: 540, pool: [['swarmer', 1.2], ['sharkgunner', 0.6], ['poisontoad', 0.5], ['bruiser', 0.7], ['darter', 0.8]] },
  { from: 660, pool: [['swarmer', 1.4], ['sharkgunner', 0.6], ['poisontoad', 0.6], ['bruiser', 0.8], ['darter', 1.0]] },
  { from: 780, pool: [['swarmer', 1.6], ['sharkgunner', 0.7], ['poisontoad', 0.7], ['bruiser', 0.9], ['darter', 1.2]] }
];

// 판 공통 이벤트. **최종 보스는 스테이지가 정합니다** (data.stages.js).
// 정예병·미니 보스는 접근 카드 공급원이라 규칙적으로 등장해야 합니다.
// 정예·미니 보스는 한 판에 14체 정도만 나옵니다. 무기 5칸을 전부 진화시키려면
// 5장이 필요하니, 놓쳐도 만회할 여지를 남기되 남아돌지는 않는 양입니다.
var EVENTS = [
  { t: 80, type: 'elite', enemy: 'beetle', n: 1, label: '딱정벌레 출현!' },
  { t: 110, type: 'elite', enemy: 'cornucopia', n: 1, label: '화수분 발견! 잡으면 대량 골드' },
  { t: 120, type: 'shop' },
  { t: 170, type: 'elite', enemy: 'elite', n: 1, label: '정예병 출현!' },
  { t: 240, type: 'elite', enemy: 'spiderling', n: 1, label: '거미탄 출현!' },
  { t: 310, type: 'elite', enemy: 'crusher', n: 1, label: '분쇄자 출현!' },
  { t: 330, type: 'shop' },
  { t: 380, type: 'elite', enemy: 'belcher', n: 1, label: '용트림 출현!' },
  { t: 430, type: 'elite', enemy: 'seahorse', n: 1, label: '해마 돌격!' },
  { t: 450, type: 'elite', enemy: 'cornucopia', n: 1, label: '화수분 발견!' },
  { t: 470, type: 'swarm', enemy: 'swarmer', n: 70, label: '태고족이 몰려옵니다!' },
  { t: 510, type: 'elite', enemy: 'beetle', n: 2, label: '딱정벌레 무리!' },
  { t: 540, type: 'shop' },
  { t: 600, type: 'elite', enemy: 'elite', n: 2, label: '정예병 출현!' },
  { t: 660, type: 'elite', enemy: 'seahorse', n: 1, label: '해마 돌격!' },
  { t: 720, type: 'elite', enemy: 'spiderling', n: 1, label: '거미탄 출현!' },
  { t: 750, type: 'shop' },
  { t: 790, type: 'elite', enemy: 'crusher', n: 2, label: '분쇄자 출현!' },
  { t: 820, type: 'swarm', enemy: 'swarmer', n: 110, label: '태고족이 몰려옵니다!' },
  { t: 860, type: 'elite', enemy: 'elite', n: 1, label: '정예병 출현!' }
];

var RUN_LENGTH = 900; // 15분. 이때 최종 보스가 등장합니다.

// 원작의 세 난이도.
var DIFFICULTIES = [
  { id: 'story', name: '스토리', hp: 0.7, dmg: 0.6, rate: 0.75, reward: 0.8, desc: '기본 난이도. 처음이라면 여기서.' },
  { id: 'hard', name: '어려움', hp: 1.0, dmg: 1.0, rate: 1.0, reward: 1.0, desc: '몬스터의 능력이 올라갑니다.' },
  { id: 'brutal', name: '전문가', hp: 1.5, dmg: 1.45, rate: 1.25, reward: 1.6, desc: '극한. 한 방 한 방이 치명적입니다.' }
];

// 판을 넘어 유지되는 영구 강화. 결정(💎)으로 구매합니다.
// 원작의 '업그레이드 구매' 화면을 옮긴 것이라 능력치·상한이 원작을 따르고,
// **일부 항목은 목표를 달성해야 열립니다**(원작도 잠금 카드가 회색으로 보입니다).
//
//   unlock(t)  — meta.totals 를 받아 해금 여부를 돌려줍니다. 없으면 처음부터 열려 있습니다.
//   need       — 잠겨 있을 때 화면에 보여 줄 조건 설명.
var META_UPGRADES = [
  { id: 'dmg', name: '피해량', icon: '🔥', max: 8, cost: [3, 5, 8, 12, 17, 23, 30, 40],
    desc: '적에게 입히는 피해 배율', step: '+0.1배', capText: '최대 1.8배',
    value: function (lv) { return '×' + (1 + lv * 0.1).toFixed(2); },
    apply: function (st, lv) { st.dmgMul *= 1 + lv * 0.1; } },

  { id: 'armor', name: '방어력', icon: '🛡️', max: 5, cost: [4, 7, 11, 16, 24],
    desc: '적에게 받는 피해 감소', step: '+5', capText: '최대 +25',
    value: function (lv) { return '+' + lv * 5; },
    apply: function (st, lv) { st.armor += lv * 5; } },

  { id: 'hp', name: '최대 체력', icon: '❤️', max: 5, cost: [4, 7, 11, 16, 24],
    desc: '최대 체력 배율', step: '+0.1배', capText: '최대 1.5배',
    unlock: function (t) { return t.kills >= 300; }, need: '누적 300처치',
    value: function (lv) { return '×' + (1 + lv * 0.1).toFixed(2); },
    apply: function (st, lv) { st.hpMul *= 1 + lv * 0.1; } },

  { id: 'speed', name: '이동 속도', icon: '👟', max: 4, cost: [3, 6, 10, 16],
    desc: '이동 속도 비율', step: '+5%', capText: '최대 +20%',
    value: function (lv) { return '+' + lv * 5 + '%'; },
    apply: function (st, lv) { st.speedMul *= 1 + lv * 0.05; } },

  { id: 'crit', name: '치명타 확률', icon: '⚔️', max: 4, cost: [5, 9, 14, 21],
    desc: '치명타가 발생할 확률', step: '+5%', capText: '최대 +20%',
    unlock: function (t) { return t.bossKills >= 1; }, need: '최종 보스 1체 처치',
    value: function (lv) { return '+' + lv * 5 + '%'; },
    apply: function (st, lv) { st.crit += lv * 0.05; } },

  { id: 'haste', name: '스킬 가속', icon: '⏱️', max: 4, cost: [6, 11, 17, 25],
    desc: '무기·스킬의 재사용 대기시간 감소', step: '+5', capText: '최대 +20',
    unlock: function (t) { return t.evolutions >= 1; }, need: '무기 1회 진화',
    value: function (lv) { return '+' + lv * 5; },
    apply: function (st, lv) { st.haste += lv * 5; } },

  { id: 'xp', name: '경험치', icon: '💠', max: 5, cost: [3, 6, 10, 15, 22],
    desc: '경험치 구슬 획득량', step: '+5%', capText: '최대 +25%',
    unlock: function (t) { return t.bestTime >= 600; }, need: '한 판에서 10분 생존',
    value: function (lv) { return '+' + lv * 5 + '%'; },
    apply: function (st, lv) { st.xpMul += lv * 0.05; } },

  { id: 'gold', name: '골드', icon: '💰', max: 3, cost: [4, 9, 16],
    desc: '골드 획득량', step: '+15%', capText: '최대 +45%',
    unlock: function (t) { return t.kills >= 2000; }, need: '누적 2,000처치',
    value: function (lv) { return '+' + lv * 15 + '%'; },
    apply: function (st, lv) { st.goldMul *= 1 + lv * 0.15; } },

  { id: 'start', name: '선봉', icon: '🚩', max: 3, cost: [6, 14, 26],
    desc: '판 시작 시 들고 있는 골드', step: '+120', capText: '최대 +360',
    unlock: function (t) { return t.wins >= 1; }, need: '한 판 승리',
    value: function (lv) { return '+' + lv * 120; },
    apply: function (st, lv) { st.startGold += lv * 120; } }
];

// 그 강화가 열렸는지.
function metaUnlocked(u, totals) {
  return !u.unlock || u.unlock(totals);
}
