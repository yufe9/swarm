// 미션 — 조건을 채우면 챔피언과 무기가 해금됩니다.
// 원작에서도 일부 무기·능력치가 '목표' 달성으로 열립니다.
//
// check(m) 는 저장된 누적 기록(meta.totals)을 보고 달성 여부를 돌려줍니다.
// progress(m) 는 "1,240 / 2,000" 처럼 화면에 보여줄 진행도 문자열입니다.
// 판이 끝날 때 game.js 의 finish() 가 기록을 갱신하고 새로 달성된 미션을 알려줍니다.

var MISSIONS = [
  {
    id: 'kills500', name: '첫 소탕', reward: '일라오이 해금', rewardType: 'champion',
    desc: '누적 500처치',
    check: function (t) { return t.kills >= 500; },
    progress: function (t) { return U.fmtNum(Math.min(t.kills, 500)) + ' / 500'; }
  },
  {
    id: 'survive5', name: '오래 버티기', reward: '브라이어 해금', rewardType: 'champion',
    desc: '한 판에서 5분 이상 생존',
    check: function (t) { return t.bestTime >= 300; },
    progress: function (t) { return U.fmtTime(Math.min(t.bestTime, 300)) + ' / 05:00'; }
  },
  {
    id: 'boss1', name: '첫 사냥', reward: '야스오 해금', rewardType: 'champion',
    desc: '최종 보스를 1체 처치',
    check: function (t) { return t.bossKills >= 1; },
    progress: function (t) { return Math.min(t.bossKills, 1) + ' / 1'; }
  },
  {
    id: 'kills2000', name: '학살자', reward: '리븐 해금', rewardType: 'champion',
    desc: '누적 2,000처치',
    check: function (t) { return t.kills >= 2000; },
    progress: function (t) { return U.fmtNum(Math.min(t.kills, 2000)) + ' / 2,000'; }
  },
  {
    id: 'evolve1', name: '각성', reward: '오로라 해금', rewardType: 'champion',
    desc: '무기를 1번 진화 (접근 카드 사용)',
    check: function (t) { return t.evolutions >= 1; },
    progress: function (t) { return Math.min(t.evolutions, 1) + ' / 1'; }
  },
  {
    id: 'win1', name: '태고족 격퇴', reward: '자야 해금', rewardType: 'champion',
    desc: '한 판 승리 (최종 보스 처치)',
    check: function (t) { return t.wins >= 1; },
    progress: function (t) { return Math.min(t.wins, 1) + ' / 1'; }
  },
  {
    id: 'kills5000', name: '군단 파쇄자', reward: '절멸자 해금', rewardType: 'weapon',
    desc: '누적 5,000처치',
    check: function (t) { return t.kills >= 5000; },
    progress: function (t) { return U.fmtNum(Math.min(t.kills, 5000)) + ' / 5,000'; }
  },
  {
    id: 'boss3', name: '보스 사냥꾼', reward: '최후의 도시 대중교통 해금', rewardType: 'weapon',
    desc: '누적 최종 보스 3체 처치',
    check: function (t) { return t.bossKills >= 3; },
    progress: function (t) { return Math.min(t.bossKills, 3) + ' / 3'; }
  },
  {
    id: 'evolve3', name: '병기창', reward: '유미봇 해금', rewardType: 'weapon',
    desc: '무기를 누적 3번 진화',
    check: function (t) { return t.evolutions >= 3; },
    progress: function (t) { return Math.min(t.evolutions, 3) + ' / 3'; }
  },
  {
    id: 'cards30', name: '수집가', reward: '결정 20개', rewardType: 'crystal', amount: 20,
    desc: '접근 카드를 누적 30장 획득',
    check: function (t) { return t.cards >= 30; },
    progress: function (t) { return Math.min(t.cards, 30) + ' / 30'; }
  },
  {
    id: 'survive10', name: '불굴', reward: '결정 25개', rewardType: 'crystal', amount: 25,
    desc: '한 판에서 10분 이상 생존',
    check: function (t) { return t.bestTime >= 600; },
    progress: function (t) { return U.fmtTime(Math.min(t.bestTime, 600)) + ' / 10:00'; }
  },
  {
    id: 'brutalwin', name: '전문가', reward: '결정 60개', rewardType: 'crystal', amount: 60,
    desc: '전문가(극한) 난이도에서 승리',
    check: function (t) { return t.brutalWins >= 1; },
    progress: function (t) { return Math.min(t.brutalWins, 1) + ' / 1'; }
  }
];

var MISSION_BY_ID = {};
(function () {
  for (var i = 0; i < MISSIONS.length; i++) MISSION_BY_ID[MISSIONS[i].id] = MISSIONS[i];
})();

// 해당 미션이 끝났는지 (저장된 기록 기준)
function missionDone(meta, id) {
  if (!id) return true;
  return !!(meta.missions && meta.missions[id]);
}
