// Servidor estático mínimo para os testes de ponta a ponta (sem dependências).
// Com E2E=1, o config.js é trocado por "sem Firebase": os testes rodam no modo deste celular.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd(), port = +process.env.PORT || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/config.js' && process.env.E2E) { res.writeHead(200, { 'content-type': types['.js'] }); return res.end('window.FIREBASE_CONFIG = null;'); }
  const file = normalize(join(root, p));
  if (!file.startsWith(root) || /node_modules|\/tests\//.test(file)) { res.writeHead(404); return res.end(); }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('não encontrado'); }
}).listen(port, () => console.log(`servindo em http://127.0.0.1:${port}`));
