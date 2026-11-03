// Testes de integração das regras do servidor (Firestore Emulator).
// Rodar: npm run test:rules   (precisa de Java; o CI já faz isso)
import { test, before, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';

const F = 'families/ABCDEFGHJKMN';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cuidados',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});
after(async () => { await env.cleanup(); });

const db = uid => env.authenticatedContext(uid).firestore();
const ref = (fs, c, id) => doc(fs, `${F}/${c}/${id}`);

// família de teste: Papai, Mamãe, Vovó Cida e um remédio com intervalo de 6h
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const fs = ctx.firestore();
    const put = (c, d) => setDoc(ref(fs, c, d.id), d);
    await put('slots', { id: 'papai_1', uid: 'papai', role: 'papai' });
    await put('members', { id: 'papai', slot: 'papai_1', role: 'papai', name: 'Papai', seen: 1 });
    await put('slots', { id: 'mamae_1', uid: 'mamae', role: 'mamae' });
    await put('members', { id: 'mamae', slot: 'mamae_1', role: 'mamae', name: 'Mamãe', seen: 1 });
    await put('slots', { id: 'vovo_f_1', uid: 'vovo1', role: 'vovo_f' });
    await put('members', { id: 'vovo1', slot: 'vovo_f_1', role: 'vovo_f', name: 'Vovó Cida', seen: 1 });
    await put('meds', { id: 'm1', name: 'Paracetamol', drops: 5, perDay: 4, times: '', minH: 6, minGapMin: 360, order: 0, lastDoseId: null });
    await put('lists', { id: 'l1', name: 'Fisioterapia', order: 0 });
    await put('items', { id: 'i1', listId: 'l1', name: 'Fraldas', done: false, order: 0 });
  });
});

// dose como o app faz: carimbo no remédio (CAS) + dose, no mesmo lote
function giveDose(fs, { id, prev = null, forced = false, by = 'Vovó Cida', ts = Date.now() }) {
  const b = writeBatch(fs);
  b.update(ref(fs, 'meds', 'm1'), { lastDoseId: id, prevDoseId: prev, lastDoseAt: serverTimestamp(), lastDoseBy: by, forced });
  b.set(ref(fs, 'doses', id), { id, medId: 'm1', ts, by, forced });
  return b.commit();
}

// ---------------- race condition / idempotência da dose ----------------
test('cuidador registra dose pelo fluxo atômico', async () => {
  await assertSucceeds(giveDose(db('vovo1'), { id: 'd1' }));
});

test('duas doses "ao mesmo tempo": a segunda, baseada no estado antigo, é recusada', async () => {
  // os dois celulares viram lastDoseId = null
  await assertSucceeds(giveDose(db('vovo1'), { id: 'd1', prev: null }));
  await assertFails(giveDose(db('mamae'), { id: 'd2', prev: null, forced: true }));
});

test('dentro do intervalo mínimo, sem "dose extra", o servidor recusa', async () => {
  await assertSucceeds(giveDose(db('vovo1'), { id: 'd1' }));
  await assertFails(giveDose(db('mamae'), { id: 'd2', prev: 'd1' }));
});

test('dose extra explícita (forced) passa e fica registrada como extra', async () => {
  await assertSucceeds(giveDose(db('vovo1'), { id: 'd1' }));
  await assertSucceeds(giveDose(db('mamae'), { id: 'd2', prev: 'd1', forced: true }));
  const snap = await getDoc(ref(db('papai'), 'doses', 'd2'));
  if (snap.data().forced !== true) throw new Error('dose extra não marcada');
});

test('dose avulsa sem carimbar o remédio é recusada (não dá para pular a trava)', async () => {
  await assertFails(setDoc(ref(db('vovo1'), 'doses', 'dx'), { id: 'dx', medId: 'm1', ts: Date.now(), by: 'Vovó Cida' }));
});

test('ninguém consegue mentir a hora do carimbo do remédio', async () => {
  const fs = db('vovo1'), b = writeBatch(fs);
  b.update(ref(fs, 'meds', 'm1'), { lastDoseId: 'd1', prevDoseId: null, lastDoseAt: Timestamp.fromMillis(0), lastDoseBy: 'x', forced: false });
  b.set(ref(fs, 'doses', 'd1'), { id: 'd1', medId: 'm1', ts: Date.now(), by: 'x' });
  await assertFails(b.commit());
});

test('dose com hora absurda (futuro distante) é recusada', async () => {
  await assertFails(giveDose(db('vovo1'), { id: 'd1', ts: Date.now() + 86400000 }));
});

// ---------------- não confiar no usuário: papéis ----------------
test('vovó não edita remédio (nome/gotas)', async () => {
  await assertFails(updateDoc(ref(db('vovo1'), 'meds', 'm1'), { drops: 50 }));
});

test('papai edita remédio', async () => {
  await assertSucceeds(updateDoc(ref(db('papai'), 'meds', 'm1'), { drops: 6 }));
});

test('nem papai consegue carimbar dose sem o fluxo atômico', async () => {
  await assertFails(updateDoc(ref(db('papai'), 'meds', 'm1'), { lastDoseAt: serverTimestamp() }));
});

test('dose não pode ser apagada; papai pode marcar como corrigida', async () => {
  await assertSucceeds(giveDose(db('vovo1'), { id: 'd1' }));
  await assertFails(deleteDoc(ref(db('papai'), 'doses', 'd1')));
  await assertFails(updateDoc(ref(db('vovo1'), 'doses', 'd1'), { voided: true }));
  await assertSucceeds(updateDoc(ref(db('papai'), 'doses', 'd1'), { voided: true, voidedBy: 'Papai', voidedAt: Date.now() }));
});

test('vovó marca item da mala, mas não renomeia nem apaga', async () => {
  const fs = db('vovo1');
  await assertSucceeds(updateDoc(ref(fs, 'items', 'i1'), { done: true, doneBy: 'Vovó Cida', doneAt: Date.now() }));
  await assertFails(updateDoc(ref(fs, 'items', 'i1'), { name: 'Outra coisa' }));
  await assertFails(deleteDoc(ref(fs, 'items', 'i1')));
});

test('quem não é membro não grava nada', async () => {
  await assertFails(updateDoc(ref(db('estranho'), 'items', 'i1'), { done: true }));
  await assertFails(setDoc(ref(db('estranho'), 'tasks', 't1'), { id: 't1', text: 'x', done: false }));
});

test('dados inválidos são recusados mesmo vindo do papai', async () => {
  await assertFails(updateDoc(ref(db('papai'), 'meds', 'm1'), { drops: 'abc' }));
  await assertFails(updateDoc(ref(db('papai'), 'meds', 'm1'), { drops: 500 }));
  await assertFails(setDoc(ref(db('papai'), 'notes', 'n1'), { id: 'n1', text: 'x'.repeat(401) }));
  await assertFails(setDoc(ref(db('papai'), 'appts', 'a1'), { id: 'a1', title: 'Fisio', date: 'amanhã' }));
  await assertFails(setDoc(ref(db('papai'), 'lists', 'l2'), { id: 'outro-id', name: 'x' }));
  await assertFails(setDoc(ref(db('papai'), 'lists', 'l3'), { id: 'l3', name: 'x', campoExtra: true }));
});

// ---------------- vagas (race condition) ----------------
function claim(uid, slot, role, name, extra = {}) {
  const fs = db(uid), b = writeBatch(fs);
  b.set(ref(fs, 'slots', slot), { id: slot, uid, role, ...extra });
  b.set(ref(fs, 'members', uid), { id: uid, slot, role, name, seen: Date.now() });
  return b.commit();
}

test('segunda vaga de vovó está livre', async () => {
  await assertSucceeds(claim('vovo2', 'vovo_f_2', 'vovo_f', 'Vovó Maria'));
});

test('duas pessoas disputando a última vaga de vovó: só uma entra', async () => {
  await assertSucceeds(claim('vovo2', 'vovo_f_2', 'vovo_f', 'Vovó Maria'));
  await assertFails(claim('vovo3', 'vovo_f_2', 'vovo_f', 'Vovó Rosa'));
});

test('não existe terceira vaga de vovó', async () => {
  await assertFails(claim('vovo3', 'vovo_f_3', 'vovo_f', 'Vovó Rosa'));
});

test('ninguém pega a vaga de Mamãe ocupada, nem com "troquei de celular"', async () => {
  await assertFails(claim('intruso', 'mamae_1', 'mamae', 'Mamãe'));
  await assertFails(claim('intruso', 'mamae_1', 'mamae', 'Mamãe', { takeover: true }));
});

test('papel declarado precisa bater com a vaga', async () => {
  await assertFails(claim('esperto', 'vovo_f_2', 'mamae', 'Mamãe'));
});

test('vovó que trocou de celular assume a própria vaga ("Sou eu")', async () => {
  const fs = db('vovo1-novo'), b = writeBatch(fs);
  b.set(ref(fs, 'slots', 'vovo_f_1'), { id: 'vovo_f_1', uid: 'vovo1-novo', role: 'vovo_f', takeover: true });
  b.set(ref(fs, 'members', 'vovo1-novo'), { id: 'vovo1-novo', slot: 'vovo_f_1', role: 'vovo_f', name: 'Vovó Cida', seen: Date.now() });
  b.delete(ref(fs, 'members', 'vovo1'));
  await assertSucceeds(b.commit());
});

test('papai remove um celular antigo e libera a vaga', async () => {
  const fs = db('papai'), b = writeBatch(fs);
  b.delete(ref(fs, 'members', 'vovo1'));
  b.delete(ref(fs, 'slots', 'vovo_f_1'));
  await assertSucceeds(b.commit());
});

test('vovó não remove outras pessoas', async () => {
  await assertFails(deleteDoc(ref(db('vovo1'), 'slots', 'mamae_1')));
  await assertFails(deleteDoc(ref(db('vovo1'), 'members', 'mamae')));
});
