// 에셋 매니페스트 — 어떤 대상에 어떤 3D 모델과 애니메이션을 붙일지 여기서만 정합니다.
//
// **파일이 없어도 게임은 그대로 돌아갑니다.** modelUrl 이 비었거나 로드에 실패하면
// asset-manager.js 가 `fallback` 에 적힌 기본 도형으로 대신 그립니다.
// 그래서 에셋을 하나씩 구해 올 때마다 modelUrl 한 줄만 추가하면 됩니다.
//
// ── 공통 필드 ─────────────────────────────────────────────────
//   modelUrl        models/ 아래 경로. 비우면 처음부터 도형으로 그립니다.
//   scale           [x, y, z]. **모델마다 원본 크기가 제각각이라 추측하면 안 됩니다.**
//                   브라우저 콘솔에서 아래를 실행하면 실측값과 권장 배율이 나옵니다.
//                       AssetManager.measure('enemies', 'minion', 26)   // 26 = 그 적의 r
//                   대충 계산하려면: scale ≈ (r × 0.01 × 3.2) ÷ 모델 원본 높이
//                   (사람 체형은 키가 몸통 반지름의 약 3.2배입니다)
//   rotationOffset  [x, y, z] 라디안. 모델이 +Z 를 안 볼 때 돌려 줍니다.
//                   대부분 [0, Math.PI, 0] (모델이 -Z 를 보는 경우) 또는 [0,0,0].
//   yOffset         발이 바닥에 닿도록 올리는 높이(씬 단위). 원점이 발바닥이면 0.
//   animations      { 상태이름: 'GLTF 안의 클립 이름' }.
//                   쓰는 상태: idle · run · attack · death
//                   없는 상태는 자동으로 idle → 첫 클립 순서로 대체됩니다.
//   fallback        모델이 없을 때 쓸 도형 (render3d.js 의 geos 키).
//   animated        true 면 스킨 애니메이션 리그를 받습니다.
//                   **잡몹은 이게 켜져 있어도 '리그 예산' 안에 든 개체만** 받고,
//                   나머지는 InstancedMesh 로 그립니다 (아래 설명 참고).
//
// ── 왜 잡몹은 전부 애니메이션이 안 되나 ───────────────────────
//   SkinnedMesh 는 InstancedMesh 로 묶이지 않습니다. 400마리에 각자 리그를 주면
//   드로우 콜 400개 + CPU 스키닝 400회가 되어 게임이 멈춥니다.
//   그래서 **플레이어 가까운 N마리에게만 리그를 빌려주고**(RIG_BUDGET),
//   나머지는 지금처럼 인스턴싱합니다. 화면 중앙은 움직이고 외곽은 정적이라
//   실제로 보면 거의 티가 나지 않습니다.

var RIG_BUDGET = 28;      // 동시에 스킨 애니메이션을 받을 잡몹 수

var ASSET_MANIFEST = {

  // ── 챔피언 ───────────────────────────────────────────────────
  // 키는 CHAMPIONS 의 id. 항상 리그를 받습니다(한 명뿐이니까).
  players: {
    // 임시 플레이스홀더. RobotExpressive 원본 높이 4.79 → 목표 1.7 이라 배율 0.355.
    jinx: {
      modelUrl: 'RobotExpressive.glb',
      scale: [0.355, 0.355, 0.355], rotationOffset: [0, Math.PI, 0], yOffset: 0,
      animated: true, fallback: 'humanoid',
      animations: { idle: 'Idle', run: 'Running', attack: 'Punch', death: 'Death' }
    },
    seraphine: { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} },
    leona:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} },
    illaoi:    { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} },
    briar:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} },
    yasuo:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} },
    riven:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} },
    aurora:    { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} },
    xayah:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'humanoid', animations: {} }
  },

  // ── 최종 보스 ────────────────────────────────────────────────
  // 한 체뿐이라 항상 리그를 받습니다.
  bosses: {
    reksai:    { modelUrl: '', scale: [2.6, 2.6, 2.6], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'bossHulk', animations: {} },
    briarboss: { modelUrl: '', scale: [2.4, 2.4, 2.4], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'bossHulk', animations: {} },
    belveth:   { modelUrl: '', scale: [2.9, 2.9, 2.9], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'bossHulk', animations: {} },
    aatrox:    { modelUrl: '', scale: [3.2, 3.2, 3.2], rotationOffset: [0, 0, 0], yOffset: 0, animated: true, fallback: 'bossHulk', animations: {} }
  },

  // ── 잡몹·정예 ────────────────────────────────────────────────
  // **키는 ENEMY_TYPES 의 shape 값입니다.** 같은 shape 를 쓰는 적끼리
  // InstancedMesh 를 공유하므로 적이 400마리여도 드로우 콜이 늘지 않습니다.
  //
  // animated: true 인 shape 는 RIG_BUDGET 안에 들면 스킨 애니메이션을 받습니다.
  // 정예·미니 보스는 수가 적고 눈에 띄므로 우선순위를 높게 줍니다(priority).
  enemies: {
    // 임시 플레이스홀더. Soldier 원본 높이는 이미 0.90 이라 배율이 1에 가깝습니다
    // (원본 크기는 모델마다 천차만별입니다 — 반드시 AssetManager.measure 로 확인하세요).
    // Soldier.glb 에는 Death 클립이 없어서 death 는 자동으로 무시됩니다.
    minion:     { modelUrl: 'Soldier.glb', scale: [0.95, 0.95, 0.95], rotationOffset: [0, Math.PI, 0], yOffset: 0,
                  animated: true, priority: 0, fallback: 'grunt', animations: { idle: 'Idle', run: 'Run', death: 'Death' } },
    voidling:   { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'blobby', animations: {} },
    caster:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'hooded', animations: {} },
    cannon:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'turret', animations: {} },
    krug:       { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'boulder', animations: {} },
    raptor:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'dart', animations: {} },
    gromp:      { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'toad', animations: {} },
    spider:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, priority: 2, fallback: 'spiderPod', animations: {} },
    beetle:     { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, priority: 2, fallback: 'dart', animations: {} },
    crusher:    { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, priority: 2, fallback: 'golem', animations: {} },
    belcher:    { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, priority: 2, fallback: 'toad', animations: {} },
    seahorse:   { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, priority: 2, fallback: 'charger', animations: {} },
    elite:      { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, priority: 3, fallback: 'crowned', animations: {} },
    cornucopia: { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, priority: 1, fallback: 'chest', animations: {} }
  },

  // ── 지형지물 ─────────────────────────────────────────────────
  // 전부 인스턴싱 대상이라 애니메이션은 없습니다.
  props: {
    rock:   { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'rock', animations: {} },
    pillar: { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'pillar', animations: {} },
    crate:  { modelUrl: '', scale: [1, 1, 1], rotationOffset: [0, 0, 0], yOffset: 0, animated: false, fallback: 'crate', animations: {} }
  }
};

// 모델 파일을 찾는 기준 폴더.
var MODEL_ROOT = 'models/';

// DRACO 로 압축된 .glb 를 읽기 위한 디코더 위치.
var DRACO_PATH = 'vendor/three/jsm/libs/draco/gltf/';
