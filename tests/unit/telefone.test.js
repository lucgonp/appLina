// Reconhecimento de telefone no texto dos Avisos (sem tela, sem banco).
// Rodar: npm run test:unit
const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../js/rules/telefone.js');

const linka = s => /<a class="tel"/.test(T.linkify(s));
const href = s => (T.linkify(s).match(/href="([^"]+)"/) || [])[1];

test('formatos brasileiros usuais viram link', () => {
  for (const n of ['(62) 99999-0000', '(11) 3456-7890', '62 99999-0000',
                   '99999-0000', '3456-7890', '0800 722 6001', '0800-721-1234']) {
    assert.ok(linka(`Pediatra: ${n}`), `não reconheceu ${n}`);
  }
});

test('celular com DDD sai com +55; 0800 sai sem DDI', () => {
  assert.equal(href('(62) 99999-0000'), 'tel:+5562999990000');
  assert.equal(href('62 99999-0000'), 'tel:+5562999990000');
  assert.equal(href('(11) 3456-7890'), 'tel:+551134567890');
  assert.equal(href('0800 722 6001'), 'tel:08007226001');
  assert.equal(href('3456-7890'), 'tel:34567890');       // sem DDD: disca local
});

test('o que NÃO é telefone continua texto', () => {
  for (const s of ['180 ml de água + 6 colheres de fórmula',
                   'dar a dose às 20:00',
                   '6-8 gotas se a febre passar de 38',
                   'consulta em 2026-11-04',
                   '12 gotas às 20h',
                   'pesou 7,250 kg',
                   'mamadeira de 150 ml a cada 3h']) {
    assert.ok(!linka(s), `linkou errado: ${s}`);
  }
});

test('não deixa marcação do usuário chegar na tela', () => {
  // entra sempre escapado; a saída não pode ganhar tag nova além do <a> nosso
  const escapado = '&lt;script&gt;alerta&lt;/script&gt; (62) 99999-0000';
  const saida = T.linkify(escapado);
  assert.ok(!/<script/i.test(saida));
  assert.equal((saida.match(/<a /g) || []).length, 1);
});

test('vários números no mesmo aviso, cada um com seu link', () => {
  const saida = T.linkify('Pediatra (62) 3333-4444 · Plantão (62) 98888-7777');
  assert.equal((saida.match(/<a class="tel"/g) || []).length, 2);
  assert.ok(saida.includes('tel:+5562333344444') === false); // não gruda os dois
  assert.ok(saida.includes('tel:+556233334444'));
  assert.ok(saida.includes('tel:+5562988887777'));
});

test('texto vazio ou nulo não quebra', () => {
  assert.equal(T.linkify(''), '');
  assert.equal(T.linkify(null), '');
  assert.equal(T.linkify(undefined), '');
});
