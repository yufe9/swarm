// 로컬 실행용 정적 서버. 빌드 도구 없이 node 만으로 돕니다.
//   node serve.js        → http://localhost:8080
//   node serve.js 9000   → 포트 지정
// file:// 로 직접 열어도 대부분 동작하지만, 브라우저에 따라 localStorage(기록 저장)가
// 막히는 경우가 있어 이 서버로 여는 쪽을 권장합니다.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
  '.svg': 'image/svg+xml',
  // 3D 에셋 — GLTFLoader 가 .gltf 를 읽고 그 안에서 .bin/텍스처를 이어서 받습니다.
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.fbx': 'application/octet-stream',
  '.hdr': 'image/vnd.radiance'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  // 상위 경로 탈출 차단
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('파일을 찾을 수 없습니다: ' + rel); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('집중포화 실행 중 → http://localhost:' + PORT);
  console.log('종료하려면 Ctrl+C');
});
