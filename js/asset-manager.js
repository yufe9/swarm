// 3D 에셋 관리 — GLTF/GLB 로드, 리그 복제·재활용, 애니메이션 상태 전환.
//
// 두 덩어리로 나뉩니다.
//   AssetManager        — 매니페스트(data.models.js)를 보고 모델을 비동기로 받아 두고,
//                         요청이 오면 **복제본을 빌려주고 돌려받습니다**(풀링).
//   AnimationController — 리그 하나의 AnimationMixer 를 감싸 idle ↔ run ↔ attack 을
//                         crossFade 로 부드럽게 바꿉니다. LOD 로 갱신 주기도 조절합니다.
//
// ── 성능에 대한 솔직한 전제 ───────────────────────────────────
// **SkinnedMesh 는 InstancedMesh 로 묶이지 않습니다.** 잡몹 400마리에 각자 리그를 주면
// 드로우 콜 400개 + CPU 스키닝 400회가 되어 게임이 멈춥니다.
// 그래서 이 모듈은 리그를 **빌려주는 창구**이고, 실제로 몇 개를 빌려줄지는
// render3d.js 의 RigDirector 가 RIG_BUDGET 으로 정합니다.
// 예산 밖의 적은 지금까지처럼 인스턴싱으로 그려집니다.
//
// 이 파일은 클래식 스크립트입니다. Three.js 모듈들은 index.html 이 import 해서
// init() 으로 넘겨 줍니다.

// ════════════════════════════════════════════════════════════
//  AnimationController
// ════════════════════════════════════════════════════════════
//
// 상태 이름(idle/run/attack/death)만 알면 되고, 실제 클립 이름 매핑은
// 매니페스트가 들고 있습니다. 없는 상태는 idle → 첫 클립 순으로 대체합니다.
function AnimationController(THREE, root, clips, animMap) {
  this.THREE = THREE;
  this.mixer = new THREE.AnimationMixer(root);
  this.actions = {};
  this.current = null;
  this.currentName = '';
  this.acc = 0;          // LOD 로 건너뛴 시간을 모아 뒀다가 한 번에 흘려보냅니다
  this.interval = 0;     // 0 이면 매 프레임
  this.enabled = true;

  // 상태 → 클립 연결. 매니페스트에 적힌 이름으로 먼저 찾고, 없으면 느슨하게 찾습니다.
  for (var state in animMap) {
    var clip = findClip(clips, animMap[state]);
    if (clip) this.actions[state] = this.mixer.clipAction(clip);
  }
  // 매니페스트가 비었으면 흔한 이름으로 한 번 더 시도합니다.
  if (!this.actions.idle) {
    var guess = findClip(clips, 'Idle') || findClip(clips, 'idle') || clips[0];
    if (guess) this.actions.idle = this.mixer.clipAction(guess);
  }
  if (!this.actions.run) {
    var g2 = findClip(clips, 'Run') || findClip(clips, 'Running') || findClip(clips, 'Walk');
    if (g2) this.actions.run = this.mixer.clipAction(g2);
  }

  // 사망·공격은 한 번만 재생하고 마지막 자세로 멈춥니다.
  if (this.actions.death) {
    this.actions.death.setLoop(THREE.LoopOnce, 1);
    this.actions.death.clampWhenFinished = true;
  }
  if (this.actions.attack) {
    this.actions.attack.setLoop(THREE.LoopOnce, 1);
    this.actions.attack.clampWhenFinished = true;
  }
}

function findClip(clips, name) {
  if (!name || !clips) return null;
  for (var i = 0; i < clips.length; i++) {
    if (clips[i].name === name) return clips[i];
  }
  // 대소문자·공백 차이는 눈감아 줍니다 (모델마다 표기가 제각각이라).
  var key = String(name).toLowerCase().replace(/\s+/g, '');
  for (var j = 0; j < clips.length; j++) {
    if (clips[j].name.toLowerCase().replace(/\s+/g, '') === key) return clips[j];
  }
  return null;
}

// 상태 전환. 같은 상태면 아무것도 하지 않습니다.
AnimationController.prototype.play = function (name, fade) {
  var next = this.actions[name];
  if (!next) {
    if (name === 'run' && this.actions.idle) next = this.actions.idle;
    else return;
    name = 'idle';
  }
  if (this.current === next && this.currentName === name) return;

  next.reset();
  next.enabled = true;
  next.setEffectiveWeight(1);
  next.play();
  if (this.current && this.current !== next) {
    // crossFadeFrom 이 이전 동작의 가중치를 넘겨받아 부드럽게 갈아탑니다.
    next.crossFadeFrom(this.current, fade === undefined ? 0.22 : fade, false);
  }
  this.current = next;
  this.currentName = name;
};

// 한 번만 재생하고 원래 상태로 돌아오는 동작 (공격 등).
AnimationController.prototype.trigger = function (name, backTo) {
  var a = this.actions[name];
  if (!a) return;
  this.play(name, 0.08);
  this._backTo = backTo || 'idle';
};

// **LOD** — 0: 매 프레임 / 1: 2프레임에 한 번 / 2: 4프레임 / 3: 정지(자세 고정).
// 멀리 있는 적은 갱신을 띄엄띄엄 해도 눈에 띄지 않습니다. 건너뛴 dt 를 모아
// 한 번에 넘기므로 애니메이션 속도 자체는 어긋나지 않습니다.
AnimationController.prototype.setLOD = function (level) {
  this.interval = [0, 1 / 30, 1 / 15, Infinity][level] || 0;
};

AnimationController.prototype.update = function (dt) {
  if (!this.enabled) return;
  if (this.interval === Infinity) return;      // 완전 정지
  this.acc += dt;
  if (this.acc < this.interval) return;
  this.mixer.update(this.acc);
  this.acc = 0;
};

AnimationController.prototype.dispose = function () {
  this.mixer.stopAllAction();
  this.mixer.uncacheRoot(this.mixer.getRoot());
};

// ════════════════════════════════════════════════════════════
//  AssetManager
// ════════════════════════════════════════════════════════════
var AssetManager = (function () {
  'use strict';

  var THREE = null, SkeletonUtils = null;
  var gltfLoader = null, dracoLoader = null;
  var toonGradient = null;

  var loaded = {};    // 'players:jinx' -> { scene, clips, spec }  (원본, 직접 쓰지 않음)
  var pending = {};   // 'players:jinx' -> Promise  (같은 모델을 두 번 받지 않게)
  var failed = {};    // 'players:jinx' -> true
  var freePool = {};  // 'players:jinx' -> [rig, rig, ...]  (반납된 복제본)
  var stats = { loaded: 0, failed: 0, cloned: 0, reused: 0, live: 0 };

  function specOf(kind, id) {
    var group = ASSET_MANIFEST[kind];
    return group ? group[id] : null;
  }
  function keyOf(kind, id) { return kind + ':' + id; }

  // ── 초기화 ──────────────────────────────────────────────────
  // gradient: render3d.js 가 만든 카툰 그라디언트 맵. 로드한 모델을 같은 룩으로 맞춥니다.
  function init(three, GLTFLoader, DRACOLoader, skeletonUtils, gradient) {
    THREE = three;
    SkeletonUtils = skeletonUtils;
    toonGradient = gradient || null;

    gltfLoader = new GLTFLoader();
    if (DRACOLoader) {
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(DRACO_PATH);
      gltfLoader.setDRACOLoader(dracoLoader);
    }
  }

  // GLTF 재질을 카툰으로 바꿉니다. **텍스처와 색은 그대로 살립니다.**
  // 원본이 PBR 이어도 맵만 옮겨 담으면 리그 오브 레전드 특유의 느낌이 납니다.
  function applyToonMaterial(root) {
    root.traverse(function (child) {
      if (!child.isMesh && !child.isSkinnedMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;   // 스킨드 메시는 바운딩이 부정확해 튀는 일이 있습니다

      var old = child.material;
      if (!old) return;
      var list = Array.isArray(old) ? old : [old];
      var next = [];
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.isMeshToonMaterial) { m.gradientMap = toonGradient; next.push(m); continue; }
        next.push(new THREE.MeshToonMaterial({
          map: m.map || null,
          color: m.color ? m.color.clone() : new THREE.Color(0xFFFFFF),
          emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
          emissiveMap: m.emissiveMap || null,
          normalMap: m.normalMap || null,
          alphaMap: m.alphaMap || null,
          transparent: m.transparent,
          opacity: m.opacity,
          alphaTest: m.alphaTest,
          side: m.side,
          gradientMap: toonGradient
        }));
      }
      child.material = Array.isArray(old) ? next : next[0];
    });
    return root;
  }

  // ── 비동기 로드 ─────────────────────────────────────────────
  // 같은 모델을 동시에 여러 번 요청해도 실제 네트워크 요청은 한 번뿐입니다.
  function load(kind, id) {
    var key = keyOf(kind, id);
    if (loaded[key]) return Promise.resolve(loaded[key]);
    if (failed[key]) return Promise.resolve(null);
    if (pending[key]) return pending[key];

    var spec = specOf(kind, id);
    if (!spec || !spec.modelUrl || !gltfLoader) {
      failed[key] = true;
      return Promise.resolve(null);
    }

    pending[key] = new Promise(function (resolve) {
      gltfLoader.load(
        MODEL_ROOT + spec.modelUrl,
        function (gltf) {
          applyToonMaterial(gltf.scene);
          loaded[key] = { scene: gltf.scene, clips: gltf.animations || [], spec: spec };
          delete pending[key];
          stats.loaded++;
          console.log('[AssetManager] 로드 완료:', key, '· 클립',
            (gltf.animations || []).map(function (c) { return c.name; }).join(', ') || '없음');
          resolve(loaded[key]);
        },
        undefined,
        function (err) {
          failed[key] = true;
          delete pending[key];
          stats.failed++;
          console.warn('[AssetManager] 로드 실패:', MODEL_ROOT + spec.modelUrl,
            '— 기본 도형으로 대체합니다.', err && err.message);
          resolve(null);
        }
      );
    });
    return pending[key];
  }

  // 여러 개를 한 번에. 판 시작 때 필요한 것만 미리 받아 둡니다.
  // **하나가 실패해도 나머지는 정상 진행합니다** (load 가 null 로 resolve 하므로).
  function preload(list) {
    var jobs = [];
    for (var i = 0; i < list.length; i++) jobs.push(load(list[i][0], list[i][1]));
    return Promise.all(jobs);
  }

  // 이 판에서 쓸 만한 것들을 골라 미리 받습니다.
  function preloadForRun(champId, stage) {
    var list = [['players', champId]];
    if (stage && stage.boss) list.push(['bosses', stage.boss]);
    for (var shape in ASSET_MANIFEST.enemies) {
      if (ASSET_MANIFEST.enemies[shape].modelUrl) list.push(['enemies', shape]);
    }
    return preload(list);
  }

  // ── 리그 빌려주기 / 돌려받기 ────────────────────────────────
  //
  // 복제는 **반드시 SkeletonUtils.clone** 을 씁니다. Object3D.clone() 은 뼈대와
  // SkinnedMesh 의 연결을 새 계층으로 다시 잇지 못해서, 복제본이 전부 원본의
  // 뼈대를 따라 움직이는(= 애니메이션이 꼬이는) 고전적인 사고가 납니다.
  function acquire(kind, id) {
    var key = keyOf(kind, id);
    var src = loaded[key];
    if (!src) return null;                 // 아직 안 받았거나 실패 → 호출부가 도형으로 대체

    var pool = freePool[key];
    if (pool && pool.length) {
      var reused = pool.pop();
      reused.object.visible = true;
      reused.ctrl.enabled = true;
      stats.reused++;
      stats.live++;
      return reused;
    }

    var root = SkeletonUtils ? SkeletonUtils.clone(src.scene) : src.scene.clone(true);
    var spec = src.spec;
    root.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
    root.rotation.set(spec.rotationOffset[0], spec.rotationOffset[1], spec.rotationOffset[2]);
    root.position.y = spec.yOffset || 0;

    // 회전 오프셋을 안쪽 그룹에 두면, 바깥 그룹의 rotation.y 로 방향만 돌릴 수 있습니다.
    var holder = new THREE.Group();
    holder.add(root);

    var rig = {
      key: key,
      object: holder,
      inner: root,
      ctrl: new AnimationController(THREE, root, src.clips, spec.animations || {}),
      spec: spec
    };
    rig.ctrl.play('idle', 0);
    stats.cloned++;
    stats.live++;
    return rig;
  }

  function release(rig) {
    if (!rig) return;
    rig.object.visible = false;
    rig.ctrl.enabled = false;
    if (!freePool[rig.key]) freePool[rig.key] = [];
    freePool[rig.key].push(rig);
    stats.live--;
  }

  function isReady(kind, id) { return !!loaded[keyOf(kind, id)]; }

  // 새 모델을 붙일 때 쓰는 자입니다. 원본 크기를 재서 권장 배율을 알려 줍니다.
  //   AssetManager.measure('enemies', 'minion', 26)   // 26 = ENEMY_TYPES 의 r
  // 모델마다 원본 크기가 천차만별이라(0.9 인 것도 4.8 인 것도 있습니다) 추측하면 안 됩니다.
  function measure(kind, id, entityRadius) {
    var src = loaded[keyOf(kind, id)];
    if (!src) { console.warn('[AssetManager] 아직 로드되지 않았습니다:', keyOf(kind, id)); return null; }
    var box = new THREE.Box3().setFromObject(src.scene);
    var size = box.getSize(new THREE.Vector3());
    var r = entityRadius || 55;
    var targetH = r * 0.01 * 3.2;        // 사람 체형: 키 ≈ 몸통 반지름 × 3.2
    var suggest = +(targetH / (size.y || 1)).toFixed(3);
    var info = {
      원본높이: +size.y.toFixed(3),
      원본너비: +size.x.toFixed(3),
      바닥이원점: Math.abs(box.min.y) < 0.02,
      권장scale: suggest,
      권장yOffset: +(-box.min.y * suggest).toFixed(3)
    };
    console.log('[AssetManager] ' + keyOf(kind, id) + ' 실측', info,
      '\n  → data.models.js 에 scale: [' + suggest + ', ' + suggest + ', ' + suggest + '] 를 넣으세요');
    return info;
  }

  return {
    measure: measure,
    init: init,
    load: load,
    preload: preload,
    preloadForRun: preloadForRun,
    acquire: acquire,
    release: release,
    isReady: isReady,
    specOf: specOf,
    applyToonMaterial: applyToonMaterial,
    setGradient: function (g) { toonGradient = g; },
    stats: stats
  };
})();
