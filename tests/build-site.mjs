// Monta a pasta _site só com os arquivos do app (o que vai para o GitHub Pages).
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const out = '_site';
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
for (const f of ['index.html', 'config.js', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'apple-touch-icon.png', 'icone-180.png', 'icone-192.png', 'icone-512.png', 'icone-maskable-512.png'])
  cpSync(f, `${out}/${f}`, { recursive: true });
console.log('site pronto em _site/');
