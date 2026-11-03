// Testes da regra de segurança de dose (sem tela, sem banco).
// Rodar: npm run test:unit
const { test } = require('node:test');
const assert = require('node:assert/strict');
const DS = require('../../js/rules/dose-safety.js');

const H = 3600000;
const NOW = new Date(2026, 10, 3, 15, 0).getTime();   // 03/11/2026 15:00
const med = (o = {}) => ({ id: 'm1', name: 'Paracetamol', drops: 5, perDay: 4, ...o });
const dose = (minsAgo, o = {}) => ({ id: 'd' + minsAgo, medId: 'm1', ts: NOW - minsAgo * 60000, by: 'Mamãe', ...o });

test('intervalo padrão = 24h ÷ doses, limitado entre 4h e 8h', () => {
  assert.equal(DS.defaultMinHours(1), 8);
  assert.equal(DS.defaultMinHours(3), 8);
  assert.equal(DS.defaultMinHours(4), 6);
  assert.equal(DS.defaultMinHours(6), 4);
  assert.equal(DS.defaultMinHours(12), 4);
});

test('intervalo informado no cadastro tem prioridade', () => {
  assert.equal(DS.minHours(med({ minH: 5 })), 5);
  assert.equal(DS.minGapMinutes(med({ minH: 5.5 })), 330);
});

test('sem doses: pode dar', () => {
  assert.equal(DS.check(med(), [], NOW).ok, true);
});

test('dose recente bloqueia e informa quando libera', () => {
  const r = DS.check(med({ minH: 6 }), [dose(45)], NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'early');
  assert.equal(r.last.by, 'Mamãe');
  assert.equal(r.until, NOW - 45 * 60000 + 6 * H);
});

test('exatamente no limite do intervalo já libera', () => {
  assert.equal(DS.check(med({ minH: 6 }), [dose(360)], NOW).ok, true);
});

test('meta do dia completa bloqueia mesmo fora do intervalo', () => {
  const r = DS.check(med({ perDay: 2, minH: 1 }), [dose(120, { id: 'a' }), dose(300, { id: 'b' })], NOW);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'complete');
});

test('dose corrigida (voided) não conta', () => {
  const r = DS.check(med({ minH: 6 }), [dose(30, { voided: true })], NOW);
  assert.equal(r.ok, true);
});

test('doses de outro remédio não interferem', () => {
  const r = DS.check(med({ minH: 6 }), [dose(10, { medId: 'outro' })], NOW);
  assert.equal(r.ok, true);
});

test('doses de ontem não contam para a meta de hoje', () => {
  const ontem = { id: 'y', medId: 'm1', ts: new Date(2026, 10, 2, 22, 0).getTime() };
  assert.equal(DS.todayCount(med(), [ontem], NOW), 0);
});

test('validDoses ordena da mais recente para a mais antiga', () => {
  const ds = DS.validDoses(med(), [dose(300), dose(10), dose(100)]);
  assert.deepEqual(ds.map(d => d.id), ['d10', 'd100', 'd300']);
});
