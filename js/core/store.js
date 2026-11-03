'use strict';
/* =========================================================
   Store — mesma API para modo local e modo família (Firestore)
   Coleções: lists, items, meds, doses, tasks, appts, notes, members, slots, meta
   ========================================================= */
const COLS = ['lists', 'items', 'meds', 'doses', 'tasks', 'appts', 'notes', 'members', 'slots', 'meta'];
// marcadores que o Cloud troca por valores do servidor na hora de gravar
const SERVER_TIME = '__server_time__';
const atMillis = ms => (ms == null ? null : { __ts: ms });
// campos que só o fluxo de dose pode gravar (o servidor confere)
const DOSE_FIELDS = ['lastDoseAt', 'prevDoseId', 'lastDoseBy', 'forced'];
const stripDoseFields = d => { const o = { ...d }; DOSE_FIELDS.forEach(k => delete o[k]); return o; };
const LOCAL_KEY = 'cuidados:v3', MIRROR_KEY = 'cuidados:mirror', FAM_KEY = 'cuidados:family';
const empty = () => Object.fromEntries(COLS.map(c => [c, {}]));

const Store = {
  data: empty(),
  family: lsGet(FAM_KEY, null),
  status: 'local',      // local | connecting | ok | error
  error: '',
  subs: [],
  on(fn) { this.subs.push(fn); },
  emit() {
    lsSet(this.family ? MIRROR_KEY : LOCAL_KEY, this.data);
    this.subs.forEach(f => f());
  },
  all(c) { return Object.values(this.data[c]); },
  get(c, id) { return this.data[c][id]; },
  put(c, doc) { this.putMany(c, [doc]); },
  putMany(c, docs) {
    docs.forEach(d => { this.data[c][d.id] = d; });
    this.emit();
    if (this.family) Cloud.write(docs.map(d => ({ type: 'set', c, d })));
  },
  delMany(ops) { // ops: [[col, id], ...]
    ops.forEach(([c, id]) => delete this.data[c][id]);
    this.emit();
    if (this.family) Cloud.write(ops.map(([c, id]) => ({ type: 'del', c, id })));
  },
  del(c, id) { this.delMany([[c, id]]); },

  // altera só alguns campos (não sobrescreve o que outra pessoa mudou ao mesmo tempo)
  patch(c, id, fields) { this.patchMany([[c, id, fields]]); },
  patchMany(list, opts) {
    list.forEach(([c, id, f]) => { if (this.data[c][id]) this.data[c][id] = { ...this.data[c][id], ...f }; });
    this.emit();
    if (this.family) return Cloud.write(list.map(([c, id, d]) => ({ type: 'update', c, id, d })), opts);
  },

  /* Dose atômica: grava a dose e "carimba" o remédio no mesmo lote.
     O servidor só aceita se prevDoseId for a última dose que ele conhece
     (compare-and-swap). Se outra pessoa deu dose antes, o lote inteiro é recusado. */
  giveDose(med, dose, { onConflict } = {}) {
    const prev = med.lastDoseId ?? null;
    this.data.doses[dose.id] = dose;
    this.data.meds[med.id] = { ...med, lastDoseId: dose.id };
    this.emit();
    if (!this.family) return;
    Cloud.write([
      { type: 'update', c: 'meds', id: med.id, d: { lastDoseId: dose.id, prevDoseId: prev, lastDoseAt: SERVER_TIME, lastDoseBy: dose.by || '', forced: !!dose.forced } },
      { type: 'set', c: 'doses', d: dose }
    ], { onError: e => (e && e.code === 'permission-denied' && onConflict ? onConflict(e) : Cloud.fail(e)) });
  },
  // doses nunca são apagadas: ficam marcadas como corrigidas
  voidDose(dose, med, prevValid) {
    const ops = [['doses', dose.id, { voided: true, voidedBy: me(), voidedAt: Date.now() }]];
    if (med && med.lastDoseId === dose.id)
      ops.push(['meds', med.id, { lastDoseId: prevValid ? prevValid.id : null, lastDoseAt: prevValid ? atMillis(prevValid.ts) : null }]);
    this.patchMany(ops);
  },
  // restaura um backup. Vagas e membros não vêm do backup: pertencem aos celulares atuais.
  replaceAll(nd) {
    const KEEP = ['members', 'slots'], ops = [];
    COLS.filter(c => !KEEP.includes(c)).forEach(c => {
      const next = { ...(nd[c] || {}) };
      if (c === 'meds') Object.keys(next).forEach(id => { next[id] = stripDoseFields(next[id]); });
      Object.keys(this.data[c]).forEach(id => { if (!next[id]) ops.push({ type: 'del', c, id }); });
      Object.values(next).forEach(d => ops.push({ type: 'set', c, d }));
      this.data[c] = next;
    });
    this.emit();
    if (this.family) Cloud.write(ops);
  }
};

/* ---------- dados iniciais / migração da versão anterior ---------- */
const PRESET = ['Fraldas descartáveis', 'Lenços umedecidos', 'Pomada', 'Trocador portátil', 'Mamadeira',
  'Leite / fórmula', 'Água', 'Troca de roupa completa', 'Paninho de boca', 'Brinquedo favorito',
  'Carteira de vacinação / plano', 'Saquinho para roupa suja'];

function seedData() {
  const d = empty(), lid = uid();
  d.lists[lid] = { id: lid, name: 'Fisioterapia', order: 0 };
  PRESET.forEach((n, i) => { const id = uid() + i; d.items[id] = { id, listId: lid, name: n, done: false, order: i }; });
  [['Agendar retorno pediátrico'], ['Comprar fralda tamanho M']].forEach(([t], i) => {
    const id = uid() + 't' + i; d.tasks[id] = { id, text: t, done: false, created: Date.now() - i };
  });
  return d;
}
function migrateLegacy() {
  const mala = lsGet('mala:v1', null), farm = lsGet('farmacia:v1', null), tar = lsGet('tarefas:v1', null);
  if (!mala && !farm && !tar) return null;
  const d = mala ? empty() : seedData();
  if (mala) (mala.lists || []).forEach((l, li) => {
    d.lists[l.id] = { id: l.id, name: l.name, order: li };
    l.items.forEach((it, i) => { d.items[it.id] = { id: it.id, listId: l.id, name: it.name, done: !!it.done, order: i }; });
  });
  if (farm) (farm.meds || []).forEach((m, mi) => {
    d.meds[m.id] = { id: m.id, name: m.name, drops: m.drops, perDay: m.perDay, times: m.times || '', order: mi };
    (m.log || []).forEach((ts, i) => { const id = m.id + '-' + ts + '-' + i; d.doses[id] = { id, medId: m.id, ts }; });
  });
  if (tar) { d.tasks = {}; (tar.items || []).forEach((t, i) => { d.tasks[t.id] = { id: t.id, text: t.text, done: !!t.done, created: Date.now() - i }; }); }
  return d;
}
