// Solmar City — a tiny static server for game/ (Node 22, stdlib only).
// Development convenience so the game can be played locally without a build:
//   node serve.ts            serves game/ on http://localhost:8080
//   node serve.ts --port 8901
// It sends the MIME types a browser game needs and refuses any path that
// climbs outside game/. Nothing else: this is not a server for the open
// internet. The submitted game itself never needs this file — any static
// server will do — but playtesting and screenshot runs use it to check the
// game over HTTP, and curl against it to verify status codes and MIME types.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));

function pickPort(argv) {
  const i = argv.indexOf('--port');
  if (i === -1) return 8080;
  const n = Number(argv[i + 1]);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

const PORT = pickPort(process.argv.slice(2));

// Every MIME type a Solmar City asset can need: HTML, scripts, styles, data,
// images, fonts, 3D assets, WebAssembly and audio. Unknown extensions fall
// back to application/octet-stream below.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

// Resolve a request path to a file, returning null when it would escape
// game/ (the path-traversal guard: a request for ../.. must never serve
// files outside the game directory).
function resolveInside(root, pathname) {
  const cleaned = normalize(pathname);
  const file = resolve(join(root, cleaned));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return file;
}

const server = createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const file = resolveInside(gameRoot, pathname);
  if (file === null) {
    res.writeHead(403).end('forbidden');
    return;
  }

  let size;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }

  res.writeHead(200, {
    'content-type': MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Solmar City game/ is on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — try another with --port.`);
    process.exit(1);
  }
  throw err;
});
