// 공용 유틸 — 수학, 난수, 포맷, 공간 분할 그리드.
// 외부 라이브러리 없이 순수 JS 로만 작성합니다.

var U = {
  TAU: Math.PI * 2,

  clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp: function (a, b, t) { return a + (b - a) * t; },

  rand: function (a, b) { return a + Math.random() * (b - a); },
  randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick: function (arr) { return arr[(Math.random() * arr.length) | 0]; },
  chance: function (p) { return Math.random() < p; },

  // [[값, 가중치], ...] 에서 하나를 뽑습니다.
  weighted: function (pairs) {
    var total = 0, i;
    for (i = 0; i < pairs.length; i++) total += pairs[i][1];
    var r = Math.random() * total;
    for (i = 0; i < pairs.length; i++) {
      r -= pairs[i][1];
      if (r <= 0) return pairs[i][0];
    }
    return pairs[pairs.length - 1][0];
  },

  shuffle: function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  },

  dist2: function (ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  },
  dist: function (ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); },
  angle: function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },

  // 각도 차이를 -PI~PI 로 정규화합니다.
  angDiff: function (a, b) {
    var d = (b - a) % U.TAU;
    if (d > Math.PI) d -= U.TAU;
    if (d < -Math.PI) d += U.TAU;
    return d;
  },

  // 초 -> "MM:SS"
  fmtTime: function (sec) {
    if (sec < 0) sec = 0;
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  },

  // 큰 수를 3자리마다 끊습니다.
  fmtNum: function (n) {
    return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // 배열에서 인덱스 i 를 지웁니다. 순서를 보존하지 않는 대신 O(1) 입니다.
  swapPop: function (arr, i) {
    var last = arr.length - 1;
    if (i !== last) arr[i] = arr[last];
    arr.pop();
  }
};

// 적 충돌 판정을 위한 공간 분할 그리드.
// 매 프레임 clear() 후 적을 넣고, query() 로 주변만 훑습니다.
function SpatialGrid(cell) {
  this.cell = cell;
  this.map = new Map();
}
SpatialGrid.prototype.clear = function () { this.map.clear(); };
SpatialGrid.prototype._key = function (gx, gy) { return gx * 100000 + gy; };
SpatialGrid.prototype.insert = function (o) {
  var gx = Math.floor(o.x / this.cell), gy = Math.floor(o.y / this.cell);
  var k = this._key(gx, gy);
  var bucket = this.map.get(k);
  if (!bucket) { bucket = []; this.map.set(k, bucket); }
  bucket.push(o);
};
// (x, y) 반경 r 안에 있을 가능성이 있는 대상을 out 배열에 채워 돌려줍니다.
SpatialGrid.prototype.query = function (x, y, r, out) {
  out.length = 0;
  var c = this.cell;
  var x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
  var y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
  for (var gx = x0; gx <= x1; gx++) {
    for (var gy = y0; gy <= y1; gy++) {
      var bucket = this.map.get(this._key(gx, gy));
      if (!bucket) continue;
      for (var i = 0; i < bucket.length; i++) out.push(bucket[i]);
    }
  }
  return out;
};
