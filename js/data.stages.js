// 스테이지(맵) — 원작 집중포화의 '최후의 도시' 네 지역입니다.
//
// 원작은 맵마다 최종 보스가 하나이고, 15분에 보스전이 시작됩니다.
// 맵마다 고유한 기믹이 하나씩 있습니다.
//
//   size    : 맵 한 변의 길이 (리그 오브 레전드 단위)
//   boss    : data.enemies.js 의 BOSSES id
//   unlock  : 이 스테이지를 열기 위해 클리어해야 하는 이전 스테이지 id (null 이면 처음부터)
//   gimmick : 'heal' 중앙 회복 지대 · 'freeze' 적을 얼리는 지대 · 'cannon' 지원 포격 · null
//   zones   : 기믹 지점의 상대 좌표(0~1). 맵 크기에 비례해 배치합니다.

var STAGES = [
  {
    id: 'warehouse',
    name: '물류 창고 지구', en: 'Warehouse District',
    boss: 'reksai', unlock: null,
    size: 13000, obstacles: 420,
    floor: '#12182A', accent: '#FF9F43',
    gimmick: 'heal', zones: [[0.5, 0.5]],
    blurb: '남쪽 방벽에서 침입자가 감지됐습니다. 맵 중앙에 강력한 회복 지대가 있습니다.',
    boss_blurb: '렉사이는 땅굴 속에서 무적입니다. 솟구칠 때가 딜타임입니다.'
  },
  {
    id: 'outskirts',
    name: '외곽 지대', en: 'The Outskirts',
    boss: 'briarboss', unlock: 'warehouse',
    size: 14000, obstacles: 460,
    floor: '#1A1622', accent: '#E85C8A',
    gimmick: 'cannon', zones: [[0.18, 0.18]],
    blurb: '버려진 인간 전초기지. 좌측 상단의 대포가 주기적으로 주변을 포격합니다.',
    boss_blurb: '브라이어는 상시 딜타임입니다. 360도 비명은 시전 방향으로 돌아 피하세요.'
  },
  {
    id: 'lab',
    name: '지하 세계 실험실', en: 'Underground Lab',
    boss: 'belveth', unlock: 'outskirts',
    size: 10000, obstacles: 520,
    floor: '#0C1620', accent: '#C08BFF',
    gimmick: 'freeze', zones: [[0.18, 0.18], [0.82, 0.82]],
    blurb: '좁고 답답한 지하 시설. 양 끝의 냉각 장치가 다가온 적을 얼립니다.',
    boss_blurb: '벨베스는 직선 돌진을 반복합니다. 체력이 낮아지면 공허 산호를 흡수해 강화됩니다.'
  },
  {
    id: 'landing',
    name: '상륙지', en: 'The Landing',
    boss: 'aatrox', unlock: 'lab',
    size: 16000, obstacles: 380,
    floor: '#151D24', accent: '#D94E3A',
    gimmick: 'cannon', zones: [[0.5, 0.12], [0.5, 0.88]],
    blurb: '성벽 안쪽과 해변가로 이뤄진 가장 넓은 맵. 성벽에서 포격 지원을 받습니다.',
    boss_blurb: '아트록스는 몸통에 충돌 판정이 없습니다. 오히려 붙어 있는 편이 내려찍기를 피하기 쉽습니다.'
  }
];

var STAGE_BY_ID = {};
(function () {
  for (var i = 0; i < STAGES.length; i++) STAGE_BY_ID[STAGES[i].id] = STAGES[i];
})();

// 그 스테이지를 열 수 있는지. 이전 스테이지를 클리어했으면 열립니다.
function stageUnlocked(meta, id) {
  var s = STAGE_BY_ID[id];
  if (!s || !s.unlock) return true;
  return !!(meta.stages && meta.stages[s.unlock]);
}
