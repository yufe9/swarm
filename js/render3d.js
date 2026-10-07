// 3D 렌더러 (Three.js) — **리그 오브 레전드 / 집중포화 스타일**.
//
// render.js(2D) 와 완전히 같은 자리에 꽂히는 교체품입니다. 게임 로직은 하나뿐이고
// (game.js), 이 파일은 그 상태를 읽어 3D 로 그리기만 합니다. 2D·3D 둘 다
// `draw(g)` / `resize(w,h,dpr)` / `screenToWorld(g,sx,sy)` 세 함수만 맞추면 갈아끼워집니다.
//
// ── LoL 룩을 만드는 세 가지 ───────────────────────────────────
//  1) 고정 쿼터뷰 : FOV 45 로 좁혀 원근 왜곡을 줄이고, 카메라는 **절대 회전하지 않고**
//                   평행 이동만 합니다. 회전 사원수는 시작할 때 한 번만 정해집니다.
//  2) 카툰 셰이딩 : MeshToonMaterial + 계단식 그라디언트 맵. PBR 의 부드러운 명암 대신
//                   면이 뚝뚝 끊기는 반실사 느낌을 냅니다. GLTF 도 로드 시 자동 변환합니다.
//  3) 선명한 그림자: DirectionalLight 한 방을 비스듬히 강하게. 그림자 카메라가 플레이어를
//                   따라다녀야 넓은 맵에서도 해상도를 유지합니다.
//
// ── 좌표 규약 ─────────────────────────────────────────────────
//   2D (x, y)  →  3D (x * UNIT, 높이, y * UNIT)
//   **y축은 높이 전용**입니다. 게임 로직의 y 는 3D 의 z 로 갑니다.
//   UNIT = 0.01 이므로 씬 1.0 = 리그 오브 레전드 100 단위입니다.
//
// ── 최적화 ────────────────────────────────────────────────────
//   적·투사체·전리품·장애물은 전부 InstancedMesh + 슬롯 재사용(풀링)으로 그립니다.
//   드로우 콜은 개체 수와 무관하게 '쓰는 모델 종류 수' 로 고정됩니다.
//
// 이 파일은 클래식 스크립트입니다. Three.js 는 ES 모듈이라 index.html 의
// <script type="module"> 이 import 한 뒤 init() 으로 넘겨 줍니다.

var Render3D = (function () {
  'use strict';

  // 1 리그 오브 레전드 단위 = 0.01 씬 단위.
  var UNIT = 0.01;

  // ── LoL 스타일 튜닝값 (여기만 만지면 분위기가 바뀝니다) ───────
  var LOOK = {
    fov: 45,                       // 좁을수록 아이소메트릭에 가까워집니다
    offset: [0, 25, 18],           // 플레이어 기준 카메라 위치 → 약 54° 부감
    follow: 10,                    // 카메라 추적 속도 (클수록 빠릿)
    ambient: 0x202545,             // 차갑고 어두운 밤 — 집중포화의 전장
    ambientPower: 1.5,
    sun: 0xFFEEDD,                 // 따뜻한 주광
    sunPower: 2.0,
    sunDir: [20, 40, 20],          // 비스듬히 내리쬐게
    rim: 0x5C7BFF,                 // 실루엣을 띄우는 차가운 역광
    rimPower: 0.55,
    shadowSize: 2048,
    shadowSpan: 26,                // 그림자 카메라가 덮는 반경(씬 단위)
    toonSteps: [66, 138, 205, 255] // 카툰 명암 계단. 그림자가 완전히 검어지지 않게 합니다
  };

  var THREE = null, GLTFLoader = null, gltfLoader = null;
  var renderer, scene, camera, clock;
  var sun = null, sunTarget = null;
  var vw = 1280, vh = 720;

  var pools = {};        // 이름 -> InstPool
  var geos = {};         // 이름 -> BufferGeometry
  var mats = {};         // 이름 -> Material
  var gradientMap = null;
  var colorCache = {};   // '#RRGGBB' -> THREE.Color
  var dummy = null;
  var tmpV = null, tmpV2 = null, groundPlane = null, raycaster = null;

  var floorMesh = null, floorTex = null, walls = [];
  var playerRig = null, playerChampId = null, playerMixer = null;
  var bossRig = null, bossTypeId = null, bossMixer = null;

  var lastObstacleRef = null;
  var camOffset = null;
  var viewRadius = 3200;

  // ════════════════════════════════════════════════════════════
  //  InstancedMesh 풀
  // ════════════════════════════════════════════════════════════
  // 슬롯을 매 프레임 앞에서부터 다시 채웁니다. 죽은 개체 자리는 자연히 재활용되고
  // count 만 줄이면 되므로 생성·삭제가 아예 없습니다.
  function InstPool(name, geo, mat, max, opt) {
    opt = opt || {};
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;   // 우리가 직접 컬링합니다
    this.mesh.count = 0;
    this.mesh.name = name;
    this.mesh.castShadow = !!opt.cast;
    this.mesh.receiveShadow = !!opt.receive;
    this.mesh.renderOrder = opt.order || 0;
    this.max = max;
    this.n = 0;
    this.prev = 0;
    // 인스턴스별 색을 쓰려면 한 번 setColorAt 해서 버퍼를 만들어 둬야 합니다.
    this.mesh.setColorAt(0, col('#FFFFFF'));
    scene.add(this.mesh);
  }
  InstPool.prototype.begin = function () { this.n = 0; };

  // x, z 는 **게임 좌표(2D의 x, y)** 를 그대로 넘깁니다. 변환은 여기서 합니다.
  InstPool.prototype.push = function (x, z, h, sx, sy, sz, rotY, color) {
    if (this.n >= this.max) return;
    dummy.position.set(x * UNIT, h, z * UNIT);
    dummy.rotation.set(0, rotY || 0, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(this.n, dummy.matrix);
    if (color) this.mesh.setColorAt(this.n, col(color));
    this.n++;
  };

  // 두 점을 잇는 막대(광선·바람 장막). 기하는 +Z 를 향하도록 만들어 둡니다.
  InstPool.prototype.pushSpan = function (x1, z1, x2, z2, h, thick, color, height) {
    if (this.n >= this.max) return;
    var mx = (x1 + x2) / 2 * UNIT, mz = (z1 + z2) / 2 * UNIT;
    var dx = (x2 - x1) * UNIT, dz = (z2 - z1) * UNIT;
    var len = Math.sqrt(dx * dx + dz * dz) || 0.001;
    dummy.position.set(mx, h, mz);
    dummy.rotation.set(0, Math.atan2(dx, dz), 0);
    dummy.scale.set(thick, height === undefined ? thick : height, len);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(this.n, dummy.matrix);
    if (color) this.mesh.setColorAt(this.n, col(color));
    this.n++;
  };

  // needsUpdate 만 켜면 three 는 **할당된 최대치 전체**를 GPU 로 다시 올립니다.
  // 풀은 넉넉히 잡아 두므로 실제로 쓴 구간만 올리고, 이번에도 지난번에도
  // 비어 있었으면 업로드 자체를 건너뜁니다.
  InstPool.prototype.end = function () {
    var n = this.n;
    this.mesh.count = n;
    if (n === 0 && this.prev === 0) return;
    var im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, n * 16);
    im.needsUpdate = true;
    var ic = this.mesh.instanceColor;
    if (ic) {
      ic.clearUpdateRanges();
      ic.addUpdateRange(0, n * 3);
      ic.needsUpdate = true;
    }
    this.prev = n;
  };

  function col(hex) {
    var c = colorCache[hex];
    if (!c) { c = colorCache[hex] = new THREE.Color(hex); }
    return c;
  }

  // 게임 각도(2D, +x 가 0) → Three.js Y축 회전.
  // 2D 방향 (cos a, sin a) 는 3D 에서 (cos a, 0, sin a) 이고,
  // 기본이 +Z 를 보는 물체는 rotation.y = θ 일 때 (sin θ, 0, cos θ) 를 봅니다.
  function yawOf(a) { return Math.PI / 2 - a; }

  // ════════════════════════════════════════════════════════════
  //  카툰 셰이딩
  // ════════════════════════════════════════════════════════════
  //
  // MeshToonMaterial 은 빛의 세기를 이 1차원 텍스처로 '계단'처럼 끊어 읽습니다.
  // NearestFilter 라야 단이 뭉개지지 않고 딱 떨어집니다.
  function makeGradientMap(steps) {
    var data = new Uint8Array(steps.length);
    for (var i = 0; i < steps.length; i++) data[i] = steps[i];
    var tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  function toonMat(opt) {
    opt = opt || {};
    opt.gradientMap = gradientMap;
    return new THREE.MeshToonMaterial(opt);
  }

  // GLTF 재질의 카툰 변환은 asset-manager.js 가 맡습니다
  // (모델 로드 시점에 한 번만 하면 되고, 복제본끼리 재질을 공유하므로).

  // ════════════════════════════════════════════════════════════
  //  기본 도형 (모델 파일이 없을 때 쓰는 대체물)
  // ════════════════════════════════════════════════════════════
  // 전부 XZ 반지름 0.5, 높이 약 1.2 를 기준으로 만듭니다.
  // 실제 크기는 인스턴스 스케일(e.r * UNIT / 0.5)로 맞춥니다.
  function buildShapes() {
    var T = THREE;
    function tag(g, yLift) { if (yLift) g.translate(0, yLift, 0); return g; }

    geos.humanoid = tag(new T.CapsuleGeometry(0.34, 0.75, 4, 10), 0.72);
    geos.grunt = tag(new T.ConeGeometry(0.5, 1.15, 5), 0.58);
    geos.blobby = tag(new T.IcosahedronGeometry(0.5, 0), 0.5);
    geos.hooded = tag(new T.ConeGeometry(0.5, 1.3, 4), 0.65);
    geos.turret = tag(new T.CylinderGeometry(0.42, 0.58, 0.9, 6), 0.45);
    geos.boulder = tag(new T.DodecahedronGeometry(0.55, 0), 0.5);
    geos.toad = tag(new T.SphereGeometry(0.55, 10, 7), 0.42);
    geos.spiderPod = tag(new T.IcosahedronGeometry(0.62, 0), 0.6);
    geos.golem = tag(new T.BoxGeometry(0.95, 1.25, 0.85), 0.63);
    geos.crowned = tag(new T.CylinderGeometry(0.45, 0.62, 1.35, 6), 0.68);
    geos.chest = tag(new T.BoxGeometry(0.85, 0.65, 0.65), 0.33);
    geos.bossHulk = tag(new T.CapsuleGeometry(0.5, 0.9, 5, 12), 0.95);
    // 돌진형은 코가 +Z 를 향하도록 눕혀 둡니다 (rotY 로 방향을 줍니다).
    geos.dart = tag(new T.ConeGeometry(0.42, 1.3, 4).rotateX(Math.PI / 2), 0.4);
    geos.charger = tag(new T.ConeGeometry(0.55, 1.6, 6).rotateX(Math.PI / 2), 0.55);

    geos.rock = tag(new T.DodecahedronGeometry(1, 0), 0.62);
    geos.pillar = tag(new T.CylinderGeometry(0.78, 0.92, 2.6, 8), 1.3);
    geos.crate = tag(new T.BoxGeometry(1.3, 1.3, 1.3), 0.65);

    // 투사체
    geos.bolt = new T.CapsuleGeometry(0.35, 1.5, 3, 6).rotateX(Math.PI / 2);
    geos.wave = new T.SphereGeometry(1, 8, 6).scale(0.45, 0.45, 1.1);
    geos.rocket = new T.ConeGeometry(0.6, 2.0, 6).rotateX(Math.PI / 2);
    geos.spike = new T.OctahedronGeometry(1, 0);

    // 전리품
    geos.gem = new T.OctahedronGeometry(1, 0);
    geos.coin = new T.CylinderGeometry(1, 1, 0.28, 12).rotateX(Math.PI / 2);
    geos.card = new T.BoxGeometry(1.1, 1.6, 0.12);
    geos.orbItem = new T.SphereGeometry(1, 12, 9);

    // 바닥 데칼·연출
    geos.disc = new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
    geos.ring = new T.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
    geos.arcNarrow = new T.RingGeometry(0.7, 1, 18, 1, -0.5, 1.0).rotateX(-Math.PI / 2);
    geos.arcWide = new T.RingGeometry(0.7, 1, 24, 1, -1.1, 2.2).rotateX(-Math.PI / 2);
    geos.sphere = new T.SphereGeometry(1, 12, 9);
    geos.span = new T.CylinderGeometry(1, 1, 1, 6).rotateX(Math.PI / 2);
    geos.slab = new T.BoxGeometry(1, 1, 1);
    geos.tentacle = tag(new T.CylinderGeometry(0.16, 0.34, 1, 7), 0.5);
    geos.feather = tag(new T.ConeGeometry(0.16, 0.6, 4), 0.3);
  }

  function buildMaterials() {
    var T = THREE;
    gradientMap = makeGradientMap(LOOK.toonSteps);

    // 유닛·지형은 카툰 셰이딩. 투사체·연출은 불 켜진 느낌(unlit)으로 또렷하게.
    mats.unit = toonMat({});
    mats.prop = toonMat({});
    mats.glow = new T.MeshBasicMaterial({});
    mats.glowSoft = new T.MeshBasicMaterial({ transparent: true, opacity: 0.85 });
    mats.decal = new T.MeshBasicMaterial({ transparent: true, opacity: 0.4, depthWrite: false });
    mats.zone = new T.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
    mats.fx = new T.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide });
    mats.beam = new T.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false });
    mats.wall = new T.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide });
    // 보호막 거품 — 안쪽 면만 그려서 플레이어를 가리지 않게 합니다.
    mats.shield = new T.MeshBasicMaterial({ transparent: true, opacity: 0.2, depthWrite: false, side: T.BackSide });
  }

  // ════════════════════════════════════════════════════════════
  //  초기화
  // ════════════════════════════════════════════════════════════
  function init(glCanvas, three, Loader) {
    THREE = three;
    GLTFLoader = Loader;

    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // LoL 은 그림자가 또렷합니다. 부드럽게 깔되 경계는 살아 있도록 PCFSoft 를 씁니다.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;   // 카툰 룩은 톤매핑을 안 거는 편이 선명합니다

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090C16);
    scene.fog = new THREE.Fog(0x090C16, 34, 62);

    // ── MOBA 고정 쿼터뷰 ──
    // FOV 를 좁혀 원근 왜곡을 줄이면 아이소메트릭에 가까운 그림이 나옵니다.
    camera = new THREE.PerspectiveCamera(LOOK.fov, window.innerWidth / window.innerHeight, 0.5, 300);
    camOffset = new THREE.Vector3(LOOK.offset[0], LOOK.offset[1], LOOK.offset[2]);
    // **회전은 여기서 딱 한 번만 정합니다.** 이후로는 위치만 옮기므로
    // 카메라가 절대 돌지 않고, 화면이 흔들려도 평행 이동만 일어납니다.
    camera.position.copy(camOffset);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    clock = new THREE.Clock();
    dummy = new THREE.Object3D();
    tmpV = new THREE.Vector3();
    tmpV2 = new THREE.Vector2();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    raycaster = new THREE.Raycaster();

    buildMaterials();
    // 로드한 GLTF 도 같은 카툰 룩으로 맞추도록 그라디언트 맵을 넘겨 줍니다.
    AssetManager.setGradient(gradientMap);
    initLights();
    buildShapes();
    initFloor();
    buildPools();

    Render3D.ready = true;
    return Promise.resolve();
  }

  function initLights() {
    // 차갑고 어두운 앰비언트 — 집중포화의 밤 전장.
    scene.add(new THREE.AmbientLight(LOOK.ambient, LOOK.ambientPower));

    // 주광 하나를 비스듬히 강하게. 그림자는 이 빛만 만듭니다(방향이 하나여야 선명합니다).
    sun = new THREE.DirectionalLight(LOOK.sun, LOOK.sunPower);
    sun.position.set(LOOK.sunDir[0], LOOK.sunDir[1], LOOK.sunDir[2]);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LOOK.shadowSize, LOOK.shadowSize);
    var s = LOOK.shadowSpan;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    // 그림자 여드름(acne) 방지. 카툰 재질은 단이 뚜렷해서 티가 잘 나므로 조금 넉넉히.
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    // 그림자 카메라는 이 타깃을 향합니다. 매 프레임 플레이어 쪽으로 옮깁니다 —
    // 안 그러면 맵(130 단위)이 그림자 상자(±26)를 벗어나 그림자가 사라집니다.
    sunTarget = new THREE.Object3D();
    scene.add(sunTarget);
    sun.target = sunTarget;

    // 실루엣을 띄우는 차가운 역광. 그림자는 만들지 않습니다.
    var rim = new THREE.DirectionalLight(LOOK.rim, LOOK.rimPower);
    rim.position.set(-18, 12, -16);
    scene.add(rim);
  }

  // 바닥 격자는 캔버스 텍스처를 반복해 만듭니다 (이미지 에셋 없이).
  function initFloor() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var x = c.getContext('2d');
    x.fillStyle = '#FFFFFF';
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(0,0,0,0.28)';
    x.lineWidth = 2;
    x.strokeRect(1, 1, 126, 126);
    x.strokeStyle = 'rgba(0,0,0,0.11)';
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
    floorTex = new THREE.CanvasTexture(c);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.colorSpace = THREE.SRGBColorSpace;

    floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      toonMat({ map: floorTex })
    );
    floorMesh.position.y = -0.01;
    floorMesh.receiveShadow = true;   // 그림자가 떨어지는 곳
    scene.add(floorMesh);

    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x3A5C8C, transparent: true, opacity: 0.35 })
      );
      walls.push(w);
      scene.add(w);
    }
  }

  // 맵 크기가 스테이지마다 다르므로 판이 바뀌면 바닥을 다시 맞춥니다.
  function layoutFloor(g) {
    var W = WORLD.w * UNIT, H = WORLD.h * UNIT;
    floorMesh.scale.set(W, 1, H);
    floorMesh.position.set(W / 2, -0.01, H / 2);
    floorTex.repeat.set(WORLD.w / 220, WORLD.h / 220);
    // 카툰 재질은 명암 단이 적어 바닥이 너무 어두우면 그림자가 안 보입니다.
    // 스테이지 색을 조금 들어 올려 그림자가 읽히게 합니다.
    floorMesh.material.color.set((g.stage && g.stage.floor) || '#12182A').multiplyScalar(2.1);

    var t = 0.4, h = 2.4;
    walls[0].scale.set(W, h, t); walls[0].position.set(W / 2, h / 2, 0);
    walls[1].scale.set(W, h, t); walls[1].position.set(W / 2, h / 2, H);
    walls[2].scale.set(t, h, H); walls[2].position.set(0, h / 2, H / 2);
    walls[3].scale.set(t, h, H); walls[3].position.set(W, h / 2, H / 2);
  }

  // ── 풀 만들기 ─────────────────────────────────────────────────
  //
  // cast/receive 배분이 성능을 좌우합니다. 잡몹은 **그림자를 드리우되 받지는 않습니다**
  // (작아서 받아도 안 보이는데 셰이더만 무거워집니다). 투사체·전리품·연출은 둘 다 끕니다.
  function buildPools() {
    for (var key in ASSET_MANIFEST.enemies) {
      var spec = ASSET_MANIFEST.enemies[key];
      pools['mob:' + key] = new InstPool('mob:' + key, geos[spec.fallback] || geos.grunt,
        mats.unit.clone(), 460, { cast: true });
    }
    for (var pk in ASSET_MANIFEST.props) {
      var ps = ASSET_MANIFEST.props[pk];
      pools['prop:' + pk] = new InstPool('prop:' + pk, geos[ps.fallback] || geos.rock,
        mats.prop.clone(), 700, { cast: true, receive: true });
    }
    pools.minion = new InstPool('minion', geos.blobby, mats.unit.clone(), 60, { cast: true });
    pools.tent = new InstPool('tent', geos.tentacle, mats.unit.clone(), 200, { cast: true });

    pools.bolt = new InstPool('bolt', geos.bolt, mats.glow.clone(), 1400);
    pools.wave = new InstPool('wave', geos.wave, mats.glow.clone(), 900);
    pools.rocket = new InstPool('rocket', geos.rocket, mats.glow.clone(), 400);
    pools.ebullet = new InstPool('ebullet', geos.spike, mats.glow.clone(), 1600);
    pools.gem = new InstPool('gem', geos.gem, mats.glow.clone(), 1400);
    pools.coin = new InstPool('coin', geos.coin, mats.glow.clone(), 1400);
    pools.card = new InstPool('card', geos.card, mats.glow.clone(), 60);
    pools.item = new InstPool('item', geos.orbItem, mats.glow.clone(), 200);
    pools.feather = new InstPool('feather', geos.feather, mats.glow.clone(), 400);
    pools.mine = new InstPool('mine', geos.sphere, mats.glow.clone(), 200);

    pools.zone = new InstPool('zone', geos.disc, mats.zone.clone(), 300, { order: 1 });
    pools.ring = new InstPool('ring', geos.ring, mats.fx.clone(), 400, { order: 2 });
    pools.arcN = new InstPool('arcN', geos.arcNarrow, mats.fx.clone(), 200, { order: 2 });
    pools.arcW = new InstPool('arcW', geos.arcWide, mats.fx.clone(), 200, { order: 2 });
    pools.puff = new InstPool('puff', geos.sphere, mats.fx.clone(), 700);
    pools.boom = new InstPool('boom', geos.sphere, mats.fx.clone(), 300);
    pools.beam = new InstPool('beam', geos.span, mats.beam.clone(), 200);
    pools.wall = new InstPool('wall', geos.slab, mats.wall.clone(), 30);
    pools.aura = new InstPool('aura', geos.ring, mats.decal.clone(), 40, { order: 2 });
    pools.shield = new InstPool('shield', geos.sphere, mats.shield, 8);
    pools.selfRing = new InstPool('selfRing', geos.ring, mats.glowSoft.clone(), 8, { order: 3 });
  }

  function beginAll() { for (var k in pools) pools[k].begin(); }
  function endAll() { for (var k in pools) pools[k].end(); }

  // ════════════════════════════════════════════════════════════
  //  리그 (스킨 애니메이션 모델)
  // ════════════════════════════════════════════════════════════
  //
  // 실제 로드·복제·풀링은 asset-manager.js 가 합니다. 여기서는 **누구에게
  // 리그를 붙일지**만 정합니다. 모델이 아직 없으면 도형 리그로 대신 그리고,
  // 로드가 끝나면 다음 프레임에 조용히 갈아끼웁니다.

  // 챔피언별 실루엣 — .glb 가 없어도 9인이 서로 달라 보이게 합니다.
  //   body [반지름, 몸통길이] · head 머리 크기 · arm 들고 있는 것
  // 실제 챔피언의 체형과 무기를 대충이라도 따라가면, 난전에서 누가 누군지 구분됩니다.
  var CHAMP_BUILD = {
    jinx:      { body: [0.23, 0.95], head: 0.19, arm: 'gun' },
    seraphine: { body: [0.27, 0.78], head: 0.21, arm: 'orb' },
    leona:     { body: [0.40, 0.60], head: 0.22, arm: 'shield' },
    illaoi:    { body: [0.44, 0.70], head: 0.23, arm: 'idol' },
    briar:     { body: [0.27, 0.80], head: 0.20, arm: 'claw' },
    yasuo:     { body: [0.28, 0.84], head: 0.20, arm: 'sword' },
    riven:     { body: [0.31, 0.78], head: 0.21, arm: 'sword' },
    aurora:    { body: [0.25, 0.88], head: 0.21, arm: 'orb' },
    xayah:     { body: [0.25, 0.88], head: 0.20, arm: 'blade' }
  };

  // 손에 드는 것. 전부 원점이 손 위치이고 +Z(정면)를 향합니다.
  function makeArmProp(kind, mat) {
    var T = THREE, g;
    if (kind === 'gun') g = new T.BoxGeometry(0.13, 0.13, 0.62).translate(0, 0, 0.22);
    else if (kind === 'sword') g = new T.BoxGeometry(0.07, 0.62, 0.11).translate(0, 0.24, 0.10);
    else if (kind === 'blade') g = new T.ConeGeometry(0.11, 0.5, 4).rotateX(Math.PI / 2).translate(0, 0, 0.2);
    else if (kind === 'shield') g = new T.CylinderGeometry(0.30, 0.30, 0.07, 10).rotateX(Math.PI / 2).translate(0, 0, 0.12);
    else if (kind === 'idol') g = new T.CylinderGeometry(0.10, 0.14, 0.75, 6).translate(0, 0.30, 0.06);
    else if (kind === 'claw') g = new T.ConeGeometry(0.10, 0.34, 4).rotateX(Math.PI / 2).translate(0, 0, 0.14);
    else g = new T.SphereGeometry(0.15, 10, 8).translate(0, 0.06, 0.14);   // orb
    var m = new T.Mesh(g, mat);
    m.castShadow = true;
    return m;
  }

  // 모델이 없을 때 쓰는 도형 리그. 인터페이스를 진짜 리그와 맞춰 둡니다.
  function makeShapeRig(spec, kind, id) {
    var grp = new THREE.Group();
    var mainMat = toonMat({ color: 0xCCCCCC });
    var mesh;

    var build = (kind === 'players') ? CHAMP_BUILD[id] : null;
    if (build) {
      // 몸통 + 머리 + 손에 든 것. 몸통 재질만 tintRig 가 물들입니다.
      var accentMat = toonMat({ color: 0xFFFFFF });
      mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(build.body[0], build.body[1], 4, 10)
          .translate(0, build.body[0] + build.body[1] / 2, 0), mainMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      grp.add(mesh);

      // 캡슐 전체 높이는 (길이 + 반지름×2) 입니다. 이걸 빼먹으면 머리가 몸통에 묻힙니다.
      var bodyTop = build.body[1] + build.body[0] * 2;
      var head = new THREE.Mesh(new THREE.SphereGeometry(build.head, 12, 10), accentMat);
      head.position.y = bodyTop + build.head * 0.55;
      head.castShadow = true;
      grp.add(head);

      var prop = makeArmProp(build.arm, accentMat);
      prop.position.set(build.body[0] + 0.12, bodyTop * 0.55, 0.05);
      grp.add(prop);

      grp.userData.accentMat = accentMat;
    } else {
      mesh = new THREE.Mesh(geos[spec.fallback] || geos.humanoid, mainMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      grp.add(mesh);
    }

    return {
      object: grp, mesh: mesh, shapeOnly: true,
      ctrl: { play: function () {}, trigger: function () {}, update: function () {}, setLOD: function () {} }
    };
  }

  // 몸통은 챔피언 색, 머리·무기는 보조색으로 물들입니다.
  function tintRig(rig, hex, accent) {
    if (!rig || !rig.mesh) return;
    rig.mesh.material.color.set(hex);
    if (accent && rig.object.userData.accentMat) rig.object.userData.accentMat.color.set(accent);
  }

  // 진짜 모델이 준비됐으면 그걸, 아니면 도형 리그를 돌려줍니다.
  function takeRig(kind, id) {
    var real = AssetManager.acquire(kind, id);
    if (real) return real;
    var spec = AssetManager.specOf(kind, id);
    if (!spec) return null;
    AssetManager.load(kind, id);        // 아직이면 받아 두기 (중복 요청은 알아서 합쳐집니다)
    return makeShapeRig(spec, kind, id);
  }

  function dropRig(rig) {
    if (!rig) return;
    scene.remove(rig.object);
    if (!rig.shapeOnly) AssetManager.release(rig);
  }

  // 게임 상태에서 애니메이션 상태 이름을 뽑아냅니다.
  function playerAnimState(p) {
    if (p.dead) return 'death';
    if (p.dashT > 0) return 'run';
    return (Math.abs(p.moveX) + Math.abs(p.moveY) > 0.1) ? 'run' : 'idle';
  }
  function enemyAnimState(e) {
    if (e.hp <= 0) return 'death';
    if (e.stun > 0 || e.freezeT > 0) return 'idle';
    return 'run';
  }

  // ════════════════════════════════════════════════════════════
  //  메인 그리기
  // ════════════════════════════════════════════════════════════
  function draw(g) {
    if (!Render3D.ready) return;
    var dt = clock.getDelta();
    var p = g.p;

    // 메뉴 화면: 빈 씬만 잠깐 비춥니다 (카메라는 여전히 안 돌립니다).
    if (!p) {
      renderer.render(scene, camera);
      clearOverlay(g);
      return;
    }

    // 새 판이 시작되면 바닥을 다시 맞추고, 이 판에 쓸 모델을 미리 받아 둡니다.
    if (g.obstacles !== lastObstacleRef) {
      lastObstacleRef = g.obstacles;
      layoutFloor(g);
      AssetManager.preloadForRun(g.p.champ.id, g.stage);
    }

    beginAll();
    updateCamera(g, dt);
    updateMobRigs(g, dt);
    drawGimmicks(g);
    drawZones(g);
    drawObstacles(g);
    drawPickups(g);
    drawTentacles(g);
    drawFeathers(g);
    drawMines(g);
    drawEnemies(g);
    drawBoss(g, dt);
    drawPlayer(g, dt);
    drawWeaponVisuals(g);
    drawBullets(g);
    drawEnemyBullets(g);
    drawBeams(g);
    drawWindwalls(g);
    drawFx(g);
    drawShop(g);
    endAll();

    renderer.render(scene, camera);
    drawOverlay(g);
  }

  // 화면 안에 있는지. 인스턴스에 올릴 개체를 미리 걸러 냅니다.
  function vis(g, x, y, pad) {
    var dx = x - g.cam.x, dy = y - g.cam.y;
    var r = viewRadius + (pad || 0);
    return dx * dx + dy * dy < r * r;
  }

  // ── MOBA 카메라 ───────────────────────────────────────────────
  // **평행 이동만 합니다.** lookAt 을 매 프레임 부르지 않으므로 회전이 고정되고,
  // 화면 흔들림도 회전이 아닌 평행 이동이라 어지럽지 않습니다.
  function updateCamera(g, dt) {
    var sx = 0, sz = 0;
    if (g.cam.shake > 0) {
      sx = U.rand(-g.cam.shake, g.cam.shake) * UNIT * 3;
      sz = U.rand(-g.cam.shake, g.cam.shake) * UNIT * 3;
    }
    // game.js 가 관리하는 2D 카메라를 그대로 따라갑니다 — 2D 와 시야가 어긋나지 않습니다.
    tmpV.set(g.cam.x * UNIT + camOffset.x + sx, camOffset.y, g.cam.y * UNIT + camOffset.z + sz);
    camera.position.lerp(tmpV, Math.min(1, dt * LOOK.follow));

    // 그림자 상자를 플레이어 쪽으로 끌고 다닙니다. 고정해 두면 넓은 맵에서
    // 상자 밖으로 나가는 순간 그림자가 통째로 사라집니다.
    var cx = g.cam.x * UNIT, cz = g.cam.y * UNIT;
    sunTarget.position.set(cx, 0, cz);
    sunTarget.updateMatrixWorld();
    sun.position.set(cx + LOOK.sunDir[0], LOOK.sunDir[1], cz + LOOK.sunDir[2]);

    // 카메라가 실제로 덮는 반경 (컬링용).
    viewRadius = (camera.position.y / UNIT) * 1.25 + 900;
  }

  // ── 지형 ──────────────────────────────────────────────────────
  // 지형지물 색. InstancedMesh 의 instanceColor 는 기본이 흰색이라
  // 색을 안 주면 전부 하얗게 떠 버립니다. 2D 렌더러와 같은 톤으로 맞춥니다.
  var PROP_COLOR = { rock: '#5A6784', pillar: '#78869F', crate: '#A9763F' };

  function drawObstacles(g) {
    if (!g.obstacles) return;
    for (var i = 0; i < g.obstacles.length; i++) {
      var o = g.obstacles[i];
      if (o.dead || !vis(g, o.x, o.y, 400)) continue;
      var pool = pools['prop:' + o.kind];
      if (!pool) continue;
      var s = o.r * UNIT;
      // 바위는 seed 로 회전을 흩어 같은 모양이 반복돼 보이지 않게 합니다.
      var c = o.flash > 0 ? '#FFFFFF' : (PROP_COLOR[o.kind] || '#5A6784');
      pool.push(o.x, o.y, 0, s, s * (o.kind === 'pillar' ? 1 : 0.9), s, o.seed, c);
      if (o.flash > 0) o.flash -= 0.016;
    }
  }

  function drawGimmicks(g) {
    if (!g.gimmicks) return;
    for (var i = 0; i < g.gimmicks.length; i++) {
      var gm = g.gimmicks[i];
      var c = gm.kind === 'heal' ? '#8BE3A8' : (gm.kind === 'freeze' ? '#7FE0D4' : '#FFD98E');
      var r = gm.r * UNIT * (1 + 0.02 * Math.sin(gm.pulse * 1.6));
      pools.zone.push(gm.x, gm.y, 0.015, r, 1, r, 0, c);
      pools.ring.push(gm.x, gm.y, 0.02, r, 1, r, 0, c);
    }
  }

  function drawZones(g) {
    for (var i = 0; i < g.zones.length; i++) {
      var z = g.zones[i];
      if (!vis(g, z.x, z.y, z.r)) continue;
      var r = z.r * UNIT;
      pools.zone.push(z.x, z.y, 0.03 + (i % 6) * 0.004, r, 1, r, 0, z.color);
      pools.ring.push(z.x, z.y, 0.05, r, 1, r, 0, z.color);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  리그 예산 — 잡몹 애니메이션을 감당 가능한 수로 묶습니다
  // ════════════════════════════════════════════════════════════
  //
  // SkinnedMesh 는 인스턴싱이 안 되므로, 400마리에 전부 리그를 주면
  // 드로우 콜 400개 + CPU 스키닝 400회가 됩니다. 그래서
  //   · 플레이어에게 가깝고 · 등급이 높은(정예·미니 보스) 순으로
  // RIG_BUDGET 마리만 골라 리그를 빌려주고, 나머지는 인스턴싱으로 그립니다.
  // 화면 중앙은 움직이고 외곽은 정적이라 실제로 보면 거의 티가 나지 않습니다.
  var mobRigs = [];        // [{ owner, rig }]
  var frameId = 0;

  // ── 적응형 예산 ──────────────────────────────────────────────
  // 리그 하나는 공짜가 아닙니다(드로우 콜 + CPU 스키닝 + 그림자 패스에서 한 번 더).
  // 그래서 **프레임 시간을 보고 예산을 스스로 늘였다 줄입니다.**
  // 사양이 낮은 기기에서는 애니메이션 수가 줄어들 뿐 게임은 그대로 돌아갑니다.
  var budgetNow = RIG_BUDGET;
  var frameAvg = 1 / 60;

  function tuneBudget(dt) {
    if (dt > 0 && dt < 0.5) frameAvg += (dt - frameAvg) * 0.05;   // 완만한 이동 평균
    if (frameAvg > 1 / 48 && budgetNow > 6) budgetNow--;          // 버거우면 줄이고
    else if (frameAvg < 1 / 90 && budgetNow < RIG_BUDGET) budgetNow++;  // 여유 있으면 늘립니다
  }

  function updateMobRigs(g, dt) {
    frameId++;
    tuneBudget(dt);
    var i, e, n = g.enemies.length;

    // ① 후보를 점수순으로 상위 RIG_BUDGET 개만 추립니다 (정렬 없이 삽입).
    //    점수 = 등급 가중치 − 거리². 정예가 멀리 있어도 잡몹보다 먼저입니다.
    var top = [], topScore = [];
    for (i = 0; i < n; i++) {
      e = g.enemies[i];
      if (e.boss || e.hp <= 0) continue;
      var shape = e.def.shape;
      var spec = ASSET_MANIFEST.enemies[shape];
      if (!spec || !spec.animated) continue;
      if (!AssetManager.isReady('enemies', shape)) continue;
      if (!vis(g, e.x, e.y, e.r * 2)) continue;

      var d2 = U.dist2(e.x, e.y, g.p.x, g.p.y);
      var score = (spec.priority || 0) * 1e10 - d2;
      if (top.length < budgetNow) {
        top.push(e); topScore.push(score);
      } else {
        // 가장 낮은 점수를 찾아 교체
        var worst = 0;
        for (var w = 1; w < top.length; w++) if (topScore[w] < topScore[worst]) worst = w;
        if (score > topScore[worst]) { top[worst] = e; topScore[worst] = score; }
      }
    }
    for (i = 0; i < top.length; i++) top[i].__rigWant = frameId;

    // ② 이번에 뽑히지 않았거나 죽은 주인의 리그는 회수합니다.
    for (i = mobRigs.length - 1; i >= 0; i--) {
      var slot = mobRigs[i];
      var o = slot.owner;
      if (!o || o.hp <= 0 || o.__rigWant !== frameId) {
        if (o) o.__rig = null;
        dropRig(slot.rig);
        U.swapPop(mobRigs, i);
      }
    }

    // ③ 리그가 없는 당첨자에게 새로 빌려줍니다.
    for (i = 0; i < top.length; i++) {
      e = top[i];
      if (e.__rig) continue;
      var rig = AssetManager.acquire('enemies', e.def.shape);
      if (!rig) continue;
      scene.add(rig.object);
      e.__rig = rig;
      mobRigs.push({ owner: e, rig: rig });
    }

    // ④ 자세·위치 갱신. 멀수록 애니메이션 갱신 주기를 늦춥니다(LOD).
    for (i = 0; i < mobRigs.length; i++) {
      var s = mobRigs[i], en = s.owner, r = s.rig;
      var sc = en.r * UNIT / 0.5;
      r.object.position.set(en.x * UNIT, 0, en.y * UNIT);
      r.object.rotation.y = (en.def.kind === 'charger' && en.chargeAng)
        ? yawOf(en.chargeAng) : yawOf(U.angle(en.x, en.y, g.p.x, g.p.y));
      r.object.scale.setScalar(sc);
      r.ctrl.play(enemyAnimState(en));
      var dist = U.dist(en.x, en.y, g.p.x, g.p.y);
      r.ctrl.setLOD(dist < 900 ? 0 : (dist < 1600 ? 1 : 2));
      r.ctrl.update(dt);
    }
  }

  // ── 유닛 ──────────────────────────────────────────────────────
  function drawEnemies(g) {
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (e.boss) continue;                       // 보스는 개별 모델로 그립니다
      if (e.__rig) continue;                      // 리그를 받은 적은 인스턴싱에서 뺍니다
      if (!vis(g, e.x, e.y, e.r * 2)) continue;

      var pool = pools['mob:' + e.def.shape] || pools['mob:minion'];
      var s = e.r * UNIT / 0.5;                   // 기본 도형 반지름 0.5 기준
      if (e.spawnT > 0) s *= Math.max(0.05, 1 - e.spawnT * 1.2);

      var color = e.flash > 0 ? '#FFFFFF'
        : (e.freezeT > 0 ? '#9FE8FF' : (e.sunT > 0 ? '#FFD98E' : e.def.color));

      var yaw;
      if (e.def.kind === 'charger' && e.chargeAng) yaw = yawOf(e.chargeAng);
      else yaw = yawOf(U.angle(e.x, e.y, g.p.x, g.p.y));

      var bob = Math.sin(e.wob * 3) * e.r * UNIT * 0.08;
      pool.push(e.x, e.y, bob, s, s, s, yaw, color);

      if (e.curseT > 0) {
        var cr = e.r * UNIT * 1.5;
        pools.ring.push(e.x, e.y, 0.06, cr, 1, cr, 0, '#C46BFF');
      }
    }
  }

  function drawBoss(g, dt) {
    var b = g.boss;
    if (!b || b.hp <= 0) {
      if (bossRig) bossRig.object.visible = false;
      return;
    }
    // 보스가 바뀌었거나, 도형으로 버티던 중에 진짜 모델이 도착했으면 갈아끼웁니다.
    if (bossTypeId !== b.type || (bossRig && bossRig.shapeOnly && AssetManager.isReady('bosses', b.type))) {
      bossTypeId = b.type;
      dropRig(bossRig);
      bossRig = takeRig('bosses', b.type);
      if (bossRig) {
        tintRig(bossRig, b.def.color);
        scene.add(bossRig.object);
      }
    }
    if (!bossRig) return;

    // 렉사이 땅 파기 — 몸은 숨고 흙더미만 남깁니다.
    if (b.hidden) {
      bossRig.object.visible = false;
      var mr = b.r * UNIT;
      pools.zone.push(b.x, b.y, 0.02, mr, 1, mr, 0, b.def.color);
      return;
    }
    bossRig.object.visible = true;
    bossRig.object.position.set(b.x * UNIT, 0, b.y * UNIT);
    bossRig.object.rotation.y = yawOf(U.angle(b.x, b.y, g.p.x, g.p.y));
    if (bossRig.shapeOnly) {
      bossRig.object.scale.setScalar(b.r * UNIT / 0.5);
      bossRig.mesh.material.color.set(b.flash > 0 ? '#FFFFFF' : b.def.color);
    }
    // 돌진 중에는 달리는 자세로.
    bossRig.ctrl.play(b.pattern === 'charge' ? 'run' : 'idle');
    bossRig.ctrl.setLOD(0);              // 보스는 항상 최고 품질
    bossRig.ctrl.update(dt);

    // 돌진 예고선
    if (b.pattern === 'charge' && b.patPhase > 0.7) {
      pools.beam.pushSpan(b.x, b.y, b.x + Math.cos(b.chargeAng) * 1600, b.y + Math.sin(b.chargeAng) * 1600,
        0.08, 0.35, '#FFFFFF');
    }
  }

  function drawPlayer(g, dt) {
    var p = g.p;
    // 챔피언이 바뀌었거나, 도형으로 버티던 중에 진짜 모델이 도착했으면 갈아끼웁니다.
    if (playerChampId !== p.champ.id ||
        (playerRig && playerRig.shapeOnly && AssetManager.isReady('players', p.champ.id))) {
      playerChampId = p.champ.id;
      dropRig(playerRig);
      playerRig = takeRig('players', p.champ.id);
      if (playerRig) {
        tintRig(playerRig, p.champ.color, p.champ.accent);
        scene.add(playerRig.object);
      }
    }
    if (!playerRig) return;

    playerRig.object.position.set(p.x * UNIT, 0, p.y * UNIT);
    playerRig.object.rotation.y = yawOf(p.face);
    if (playerRig.shapeOnly) playerRig.object.scale.setScalar(p.r * UNIT / 0.5 * 0.85);
    playerRig.object.visible = !(p.iframe > 0 && Math.floor(p.iframe * 18) % 2 === 0);
    playerRig.ctrl.play(playerAnimState(p));
    playerRig.ctrl.setLOD(0);            // 플레이어는 항상 최고 품질
    playerRig.ctrl.update(dt);

    // 내 위치 표시 링. 부감 시점에서는 난전에 섞이면 자기 캐릭터를 놓치기 쉬워
    // 실제 MOBA 들처럼 발밑에 챔피언 색 링을 항상 깔아 둡니다.
    var rr = p.r * UNIT * 1.35;
    pools.selfRing.push(p.x, p.y, 0.035, rr, 1, rr, 0, p.champ.color);

    if (p.shield > 0) {
      var sr = p.r * UNIT * 1.6;
      pools.shield.push(p.x, p.y, sr * 0.75, sr, sr, sr, 0, '#6FD3FF');
    }
    if (!g.autoAim) {
      pools.ring.push(g.mouse.wx, g.mouse.wy, 0.07, 0.45, 1, 0.45, 0, '#FFFFFF');
      pools.beam.pushSpan(p.x, p.y, g.mouse.wx, g.mouse.wy, 0.04, 0.05, '#FFFFFF');
    }
  }

  // 무기가 들고 있는 시각 요소 — 오라, 소환수, 드론, 공전 칼날.
  function drawWeaponVisuals(g) {
    var p = g.p, i, j;
    for (i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      var wc = WEAPONS[w.id].color;
      if (w.aura) {
        var ar = w.aura * UNIT;
        pools.aura.push(p.x, p.y, 0.04, ar, 1, ar, 0, wc);
        pools.zone.push(p.x, p.y, 0.025, ar, 1, ar, 0, wc);
      }
      if (w.pet) {
        var pr = w.pet.r * UNIT / 0.5;
        pools.minion.push(w.pet.x, w.pet.y, 0, pr, pr, pr,
          yawOf(U.angle(w.pet.x, w.pet.y, p.x, p.y)), wc);
      }
      if (w.drones) {
        for (j = 0; j < w.drones.length; j++) {
          var d = w.drones[j];
          pools.gem.push(d.x, d.y, 0.9, 0.22, 0.22, 0.22, performance.now() / 300, wc);
        }
      }
      if (w.orb) {
        for (j = 0; j < w.orb.length; j++) {
          var o = w.orb[j];
          if (o.x === undefined) continue;
          pools.wave.push(o.x, o.y, 0.5, 0.5, 0.5, 0.5, performance.now() / 200 + j, wc);
        }
      }
    }
  }

  // ── 투사체 ────────────────────────────────────────────────────
  function drawBullets(g) {
    for (var i = 0; i < g.bullets.length; i++) {
      var b = g.bullets[i];
      if (!vis(g, b.x, b.y, 200)) continue;
      var yaw = yawOf(Math.atan2(b.vy, b.vx));
      var s = b.r * UNIT;
      var pool = b.shape === 'rocket' ? pools.rocket : (b.shape === 'wave' ? pools.wave : pools.bolt);
      pool.push(b.x, b.y, 0.55, s, s, s, yaw, b.color);
    }
  }

  // 적 탄환은 2D 와 같은 규칙 — 무조건 붉고 뾰족하게, 회전시켜 눈에 띄게.
  function drawEnemyBullets(g) {
    var spin = performance.now() / 160;
    for (var i = 0; i < g.ebullets.length; i++) {
      var b = g.ebullets[i];
      if (!vis(g, b.x, b.y, 200)) continue;
      var s = b.r * UNIT;
      pools.ebullet.push(b.x, b.y, 0.5, s, s, s, spin + i, ENEMY_SHOT_COLOR);
    }
  }

  function drawPickups(g) {
    for (var i = 0; i < g.pickups.length; i++) {
      var u = g.pickups[i];
      if (!vis(g, u.x, u.y, 120)) continue;
      var s = u.r * UNIT;
      var bob = 0.18 + Math.sin(u.t * 3 + u.x * 0.01) * 0.04;
      if (u.kind === 'xp') {
        pools.gem.push(u.x, u.y, bob + s, s, s * 1.3, s, u.t * 2, u.color);
      } else if (u.kind === 'gold') {
        pools.coin.push(u.x, u.y, bob + s * 0.5, s, s, s, u.t * 3, u.color);
      } else if (u.kind === 'card') {
        // 접근 카드는 진화의 열쇠 — 크게, 세워서, 계속 돌려 눈에 띄게 합니다.
        pools.card.push(u.x, u.y, s * 1.4, s, s, s, u.t * 2.2, '#C46BFF');
        pools.ring.push(u.x, u.y, 0.05, s * 2, 1, s * 2, 0, '#C46BFF');
      } else {
        pools.item.push(u.x, u.y, bob + s, s, s, s, 0, u.color);
      }
    }
  }

  function drawTentacles(g) {
    for (var i = 0; i < g.tentacles.length; i++) {
      var tc = g.tentacles[i];
      if (!vis(g, tc.x, tc.y, 300)) continue;
      var swing = tc.anim > 0 ? tc.anim / 0.3 : 0;
      var sc = tc.giant ? 2 : 1;
      var h = (1.1 + swing * 0.9) * sc;
      pools.tent.push(tc.x, tc.y, 0, 0.8 * sc, h, 0.8 * sc,
        (tc.ang !== undefined ? yawOf(tc.ang) : 0), tc.giant ? '#2FA383' : '#4FC3A1');
    }
  }

  function drawFeathers(g) {
    for (var i = 0; i < g.feathers.length; i++) {
      var f = g.feathers[i];
      if (!vis(g, f.x, f.y, 100)) continue;
      pools.feather.push(f.x, f.y, 0, 1, 1, 1, f.wob * 0.3, '#FF5C7A');
    }
  }

  function drawMines(g) {
    for (var i = 0; i < g.mines.length; i++) {
      var m = g.mines[i];
      if (!vis(g, m.x, m.y, m.aoe)) continue;
      var blink = 0.7 + 0.3 * Math.sin(m.blink * 7);
      var s = m.r * UNIT * blink;
      pools.mine.push(m.x, m.y, s, s, s, s, 0, m.color);
      var tr = m.trigger * UNIT;
      pools.ring.push(m.x, m.y, 0.03, tr, 1, tr, 0, m.color);
    }
  }

  function drawBeams(g) {
    for (var i = 0; i < g.beams.length; i++) {
      var b = g.beams[i];
      var k = 1 - b.t / b.life;
      pools.beam.pushSpan(b.x1, b.y1, b.x2, b.y2, 0.35, b.w * UNIT * k, b.color);
    }
  }

  function drawWindwalls(g) {
    for (var i = 0; i < g.windwalls.length; i++) {
      var w = g.windwalls[i];
      var hx = Math.cos(w.ang) * w.len / 2, hy = Math.sin(w.ang) * w.len / 2;
      var k = U.clamp(w.life / w.maxLife, 0, 1);
      pools.wall.pushSpan(w.x - hx, w.y - hy, w.x + hx, w.y + hy, 1.1 * k, 0.25, '#B6F2FF', 2.2 * k);
    }
  }

  function drawFx(g) {
    for (var i = 0; i < g.fx.length; i++) {
      var f = g.fx[i];
      var k = 1 - f.t / f.life;          // 1 → 0
      if (!vis(g, f.x, f.y, (f.r || 0) + 200)) continue;

      if (f.kind === 'ring' || f.kind === 'pulse') {
        var rr = (f.kind === 'ring' ? f.r * (0.4 + 0.6 * (1 - k)) : f.r * (1 - k * 0.15)) * UNIT;
        pools.ring.push(f.x, f.y, 0.06, rr, 1, rr, 0, f.color);

      } else if (f.kind === 'boom') {
        var br = f.r * (1 - k * 0.5) * UNIT;
        pools.boom.push(f.x, f.y, br * 0.7, br, br * 0.7, br, 0, f.color);

      } else if (f.kind === 'slash') {
        // 원뿔 범위 참격 — 각도 폭에 맞춰 두 가지 부채꼴 중 하나를 씁니다.
        var sr = f.r * (0.7 + 0.3 * (1 - k)) * UNIT;
        var pool = f.arc > 1.6 ? pools.arcW : pools.arcN;
        pool.push(f.x, f.y, 0.09, sr, 1, sr, yawOf(f.ang) + Math.PI / 2, f.color);

      } else if (f.kind === 'puff' || f.kind === 'trail' || f.kind === 'spark') {
        var pr = f.r * k * UNIT * 1.6;
        pools.puff.push(f.x, f.y, 0.3, pr, pr, pr, 0, f.color);

      } else if (f.kind === 'muzzle') {
        var mr = f.r * k * UNIT;
        pools.puff.push(f.x + Math.cos(f.ang) * 40, f.y + Math.sin(f.ang) * 40, 0.55, mr, mr, mr, 0, '#FFFFFF');
      }
    }
  }

  function drawShop(g) {
    var s = g.shopObj;
    if (!s) return;
    var pulse = 0.5 + 0.5 * Math.sin(s.pulse * 3);
    var r = s.r * UNIT;
    pools.zone.push(s.x, s.y, 0.03, r * 2.2, 1, r * 2.2, 0, '#F3C96B');
    pools.ring.push(s.x, s.y, 0.05, r * (1.4 + pulse * 0.2), 1, r * (1.4 + pulse * 0.2), 0, '#F3C96B');
    pools.item.push(s.x, s.y, r, r * 0.7, r * 0.7, r * 0.7, 0, '#F3C96B');
  }

  // ════════════════════════════════════════════════════════════
  //  2D 오버레이
  // ════════════════════════════════════════════════════════════
  // 피해 숫자·공지·미니맵은 3D 메시로 만들 이유가 없습니다. 위에 얹은 2D 캔버스에
  // 그리되, 월드 좌표를 카메라로 투영해 정확히 머리 위에 오도록 합니다.
  function clearOverlay(g) {
    if (!g.ctx) return;
    g.ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    g.ctx.clearRect(0, 0, g.vw, g.vh);
  }

  function project(x, y, h) {
    tmpV.set(x * UNIT, h, y * UNIT).project(camera);
    return {
      x: (tmpV.x * 0.5 + 0.5) * vw,
      y: (-tmpV.y * 0.5 + 0.5) * vh,
      ok: tmpV.z < 1
    };
  }

  function drawOverlay(g) {
    var ctx = g.ctx;
    if (!ctx) return;
    clearOverlay(g);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < g.texts.length; i++) {
      var t = g.texts[i];
      var s = project(t.x, t.y, 1.1);
      if (!s.ok) continue;
      var k = 1 - t.t / t.life;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = 'bold ' + (t.size * 0.42).toFixed(1) + 'px system-ui, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(t.v, s.x, s.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.v, s.x, s.y);
    }
    ctx.globalAlpha = 1;

    // 정예·보스 체력바는 머리 위에 (3D 에서는 이게 훨씬 잘 읽힙니다)
    for (var j = 0; j < g.enemies.length; j++) {
      var e = g.enemies[j];
      if (!e.elite && !e.boss) continue;
      if (e.hp >= e.maxHp || e.hp <= 0) continue;
      var ps = project(e.x, e.y, e.r * UNIT * 2.6);
      if (!ps.ok) continue;
      var bw = e.boss ? 90 : 54;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(ps.x - bw / 2, ps.y, bw, 6);
      ctx.fillStyle = e.boss ? '#FF5C7A' : '#FFD36B';
      ctx.fillRect(ps.x - bw / 2, ps.y, bw * (e.hp / e.maxHp), 6);
    }

    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (g.flash * 0.9) + ')';
      ctx.fillRect(0, 0, g.vw, g.vh);
    }
    if (g.p.hitFlash > 0) {
      var a = g.p.hitFlash * 0.7;
      var grd = ctx.createRadialGradient(g.vw / 2, g.vh / 2, Math.min(g.vw, g.vh) * 0.25,
        g.vw / 2, g.vh / 2, Math.max(g.vw, g.vh) * 0.62);
      grd.addColorStop(0, 'rgba(255,40,70,0)');
      grd.addColorStop(1, 'rgba(255,40,70,' + a + ')');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, g.vw, g.vh);
    }
    if (g.announceT > 0) Render.drawAnnounce(g, ctx, g.vw, g.vh);
    Render.drawMinimap(g, ctx, g.vw, g.vh);
  }

  // ── 바깥에서 쓰는 것 ──────────────────────────────────────────
  function resize(w, h, dpr) {
    vw = w; vh = h;
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(dpr || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // 화면 좌표 → 월드 좌표. 바닥 평면(y=0)에 레이를 쏴서 구합니다.
  // 2D 는 단순 나눗셈이지만 3D 는 원근이 있어 반드시 레이캐스트여야 합니다.
  function screenToWorld(g, sx, sy) {
    if (!Render3D.ready) return { x: g.cam.x, y: g.cam.y };
    tmpV2.set((sx / vw) * 2 - 1, -(sy / vh) * 2 + 1);
    raycaster.setFromCamera(tmpV2, camera);
    var hit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (!hit) return { x: g.cam.x, y: g.cam.y };
    return { x: hit.x / UNIT, y: hit.z / UNIT };
  }

  return {
    ready: false,
    is3D: true,
    init: init,
    draw: draw,
    resize: resize,
    screenToWorld: screenToWorld,
    // 디버그·룩 튜닝용으로 열어 둡니다. 콘솔에서 Render3D.LOOK 을 만지고
    // Render3D.applyLook() 을 부르면 즉시 반영됩니다.
    LOOK: LOOK,
    // 지금 몇 마리가 스킨 애니메이션을 받고 있는지 (적응형 예산의 현재값).
    get rigBudget() { return budgetNow; },
    get frameAvgMs() { return frameAvg * 1000; },
    applyLook: function () {
      if (!Render3D.ready) return;
      camera.fov = LOOK.fov;
      camera.updateProjectionMatrix();
      camOffset.set(LOOK.offset[0], LOOK.offset[1], LOOK.offset[2]);
      camera.position.copy(camOffset);
      camera.lookAt(0, 0, 0);          // 회전을 새 오프셋에 맞춰 한 번만 다시 잡습니다
      camera.updateMatrixWorld();
      sun.color.set(LOOK.sun);
      sun.intensity = LOOK.sunPower;
      gradientMap.image.data.set(LOOK.toonSteps);
      gradientMap.needsUpdate = true;
    },
    get camera() { return camera; },
    get scene() { return scene; },
    get renderer() { return renderer; },
    get sun() { return sun; },
    UNIT: UNIT
  };
})();
