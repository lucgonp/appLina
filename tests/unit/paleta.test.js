// Lê os tokens de cor do css/app.css e confere contraste AA nos pares que o CSS
// realmente usa. Pega regressão de paleta antes de chegar no celular de alguém.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '../../css/app.css'), 'utf8');

// :root{...} = claro; o bloco dentro de prefers-color-scheme:dark = escuro
function tokens(trecho) {
  const t = {};
  for (const m of trecho.matchAll(/--([a-z-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) t[m[1]] = m[2];
  return t;
}
const iDark = CSS.indexOf('prefers-color-scheme: dark');
const CLARO = tokens(CSS.slice(0, iDark));
const ESCURO = tokens(CSS.slice(iDark));

function luminancia(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA = 4.5;                                      // texto normal
const CORES = ['accent', 'lilac', 'mint', 'sun', 'sky', 'danger'];

for (const [modo, p] of [['claro', CLARO], ['escuro', ESCURO]]) {
  test(`paleta ${modo}: tokens presentes`, () => {
    for (const k of ['bg', 'surface', 'ink', 'muted', 'on-acc', ...CORES]) {
      assert.match(p[k] || '', /^#[0-9A-Fa-f]{6}$/, `token --${k} ausente no modo ${modo}`);
    }
  });

  test(`paleta ${modo}: texto principal e secundario em AA`, () => {
    for (const fundo of ['bg', 'surface']) {
      for (const texto of ['ink', 'muted']) {
        const v = contraste(p[texto], p[fundo]);
        assert.ok(v >= AA, `--${texto} sobre --${fundo} (${modo}): ${v.toFixed(2)}:1, precisa ${AA}`);
      }
    }
  });

  test(`paleta ${modo}: cores de status em AA como texto e como botao`, () => {
    for (const c of CORES) {
      for (const fundo of ['bg', 'surface']) {
        const v = contraste(p[c], p[fundo]);
        assert.ok(v >= AA, `--${c} como texto sobre --${fundo} (${modo}): ${v.toFixed(2)}:1`);
      }
      const soft = p[`${c}-soft`];
      if (soft) {
        const v = contraste(p[c], soft);
        assert.ok(v >= AA, `--${c} sobre --${c}-soft (${modo}): ${v.toFixed(2)}:1`);
      }
      const vb = contraste(p['on-acc'], p[c]);
      assert.ok(vb >= AA, `--on-acc sobre botao --${c} (${modo}): ${vb.toFixed(2)}:1`);
    }
  });
}

// A cortina de diálogo ficou com o ameixa da paleta antiga escrito na mão
// (rgba(74,35,64)) e tingia a tela inteira ao abrir a escolha de papel.
// Cor fora dos tokens não acompanha troca de paleta: trava isso.
test('paleta: nenhuma cor fixa fora dos tokens', () => {
  assert.ok(!/rgba?\(\s*74\s*,\s*35\s*,\s*64/.test(CSS),
    'ameixa #4A2340 da paleta antiga ainda escrito na mão no CSS');
  for (const [regra, trecho] of [['.dlg', /\.dlg\{[^}]*\}/], ['.scrim', /\.scrim\{[^}]*\}/]]) {
    const m = CSS.match(trecho);
    assert.ok(m, `regra ${regra} não encontrada`);
    assert.match(m[0], /background:var\(--veil\)/,
      `${regra} precisa usar var(--veil); cor fixa ali tinge a tela toda`);
  }
  // o veil tem que ser escuro nos dois modos: clarear a cortina inverte o efeito
  for (const [modo, trecho] of [['claro', CSS.slice(0, iDark)], ['escuro', CSS.slice(iDark)]]) {
    const m = trecho.match(/--veil:\s*rgba\((\d+),(\d+),(\d+)/);
    assert.ok(m, `--veil ausente no modo ${modo}`);
    const media = (+m[1] + +m[2] + +m[3]) / 3;
    assert.ok(media < 90, `--veil do modo ${modo} está claro demais (média ${media})`);
  }
});

// O token de borda nao atende 1.4.11 (3:1) nem antes nem depois da troca de paleta.
// ponytail: congelado no valor medido para a regressao aparecer; subir para 3:1
// engrossa divisoria e borda de card em todo o app, o que e decisao de visual.
test('paleta: --line segue abaixo de 3:1 (pre-existente, nao regredir)', () => {
  const medidos = { claro: 1.27, escuro: 1.48 };
  for (const [modo, p] of [['claro', CLARO], ['escuro', ESCURO]]) {
    const v = contraste(p.line, p.bg);
    assert.ok(v >= medidos[modo] - 0.01,
      `--line sobre --bg (${modo}) caiu para ${v.toFixed(2)}:1, era ${medidos[modo]}:1`);
  }
});
