'use strict';
/* =========================================================
   Cloud — Firebase Firestore (plano gratuito)
   ========================================================= */
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const Cloud = {
  fs: null, db: null, uid: null, unsubs: [], ready: null, _resolve: null,
  configured: () => !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId),
  async init() {
    if (this.db) return;
    const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
      import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')
    ]);
    const app = initializeApp(window.FIREBASE_CONFIG);
    const cred = await signInAnonymously(getAuth(app));
    this.uid = cred.user.uid;   // identidade do celular para o servidor (as regras usam isto)
    let db;
    // várias abas abertas (ex.: duas abas do Safari) não podem travar o app
    try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
    catch { try { db = fs.initializeFirestore(app, { localCache: fs.memoryLocalCache() }); } catch { db = fs.getFirestore(app); } }
    this.fs = fs; this.db = db;
  },
  ref(fid, c, id) { return this.fs.doc(this.db, 'families', fid, c, id); },
  async exists(fid) {
    await this.init();
    const snap = await this.fs.getDoc(this.ref(fid, 'meta', 'settings'));
    return snap.exists();
  },
  connect(fid) {
    this.ready = new Promise(r => (this._resolve = r));
    Store.status = 'connecting'; Store.error = ''; Store.slow = false; render();
    clearTimeout(this._slowTimer);
    // se demorar, a tela explica e oferece "Tentar de novo" (em vez de ficar em branco)
    this._slowTimer = setTimeout(() => { if (Store.status === 'connecting') { Store.slow = true; render(); } }, 12000);
    return this.init().then(() => {
      this.unsubs.forEach(u => u()); this.unsubs = [];
      const loaded = new Set();
      COLS.forEach(c => this.unsubs.push(this.fs.onSnapshot(this.fs.collection(this.db, 'families', fid, c), snap => {
        const o = {}; snap.forEach(d => { o[d.id] = this.plain(d.data({ serverTimestamps: 'estimate' })); });
        Store.data[c] = o; loaded.add(c);
        if (loaded.size === COLS.length) { Store.status = 'ok'; Store.slow = false; Store.offline = snap.metadata.fromCache && !navigator.onLine; this._resolve(); }
        Store.emit();
      }, err => this.fail(err))));
    }).catch(err => this.fail(err));
  },
  retry() { if (Store.family) { this.disconnect(); this.connect(Store.family); } },
  // traduz erros técnicos em: o que houve + o que fazer
  explain(e) {
    const c = e && e.code, m = String(e?.message || e || '');
    if (c === 'permission-denied') return 'Sem permissão para esta ação. Confira seu papel na aba Família.';
    if (c === 'unavailable' || /network|offline|Failed to fetch/i.test(m)) return 'Sem internet. O que você fizer fica salvo no celular e é enviado quando a conexão voltar.';
    if (c === 'failed-precondition' || /exclusive access|persistence/i.test(m)) return 'O app está aberto em mais de uma aba. Feche as outras abas e toque em "Tentar de novo".';
    if (/auth|identitytoolkit|api-key/i.test(m)) return 'Não foi possível identificar este celular no servidor. Verifique a internet e tente de novo.';
    if (/import|Failed to load|dynamically imported/i.test(m)) return 'Não foi possível baixar os componentes do app. Verifique a internet e tente de novo.';
    return 'Não foi possível sincronizar agora. Toque em "Tentar de novo".';
  },
  // horários do servidor viram milissegundos, para o resto do app lidar só com números
  plain(o) {
    const r = {};
    Object.entries(o).forEach(([k, v]) => { r[k] = v && typeof v.toMillis === 'function' ? v.toMillis() : v; });
    return r;
  },
  // troca os marcadores do Store pelos valores do Firestore
  value(v) {
    if (v === SERVER_TIME) return this.fs.serverTimestamp();
    if (v && typeof v === 'object' && '__ts' in v) return this.fs.Timestamp.fromMillis(v.__ts);
    return v;
  },
  fields(d) { const r = {}; Object.entries(d).forEach(([k, v]) => { r[k] = this.value(v); }); return r; },
  fail(e) {
    Store.status = 'error'; Store.slow = false;
    Store.error = this.explain(e); Store.errorDetail = (e?.code ? e.code + ': ' : '') + (e?.message || String(e));
    console.error('[cuidados]', e);
    render();
  },
  /* Grava em lotes. Cada lote é atômico: ou tudo entra, ou nada.
     opts.onError recebe o erro do lote (padrão: mostra na aba Família).
     opts.sequential espera um lote terminar antes do próximo (precisa de internet). */
  async write(ops, opts = {}) {
    const onError = opts.onError || (e => this.fail(e));
    try {
      await this.ready;
      for (let i = 0; i < ops.length; i += 400) {
        const b = this.fs.writeBatch(this.db);
        ops.slice(i, i + 400).forEach(o => {
          if (o.type === 'set') {
            const d = o.c === 'meds' ? stripDoseFields(o.d) : o.d;
            b.set(this.ref(Store.family, o.c, d.id), this.fields(d));
          } else if (o.type === 'update') b.update(this.ref(Store.family, o.c, o.id), this.fields(o.d));
          else b.delete(this.ref(Store.family, o.c, o.id));
        });
        const commit = b.commit();
        if (opts.sequential) await commit; else commit.catch(onError);
      }
    } catch (e) { onError(e); if (opts.sequential) throw e; }
  },
  disconnect() { this.unsubs.forEach(u => u()); this.unsubs = []; }
};

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { const a = new Uint32Array(12); crypto.getRandomValues(a); return [...a].map(n => CODE_CHARS[n % CODE_CHARS.length]).join(''); };
const fmtCode = c => c.replace(/(.{4})(?=.)/g, '$1-');
const normCode = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

let creatingFamily = false;   // idempotência: toque duplo não cria duas famílias
async function createFamily() {
  if (creatingFamily) return;
  let role = Members.myRole();
  if (role !== 'mamae' && role !== 'papai') {
    role = await choose('Quem cria a família fica com as permissões de edição. Você é:', [{ label: 'Mamãe', value: 'mamae' }, { label: 'Papai', value: 'papai' }], { title: 'Criar família', icon: ph('users-three') });
    if (!role) return;
    lsSet('cuidados:role', role); lsSet('cuidados:me', ROLES[role].label);
  }
  creatingFamily = true;
  const code = newCode();
  try {
    Store.status = 'connecting'; render();
    await Cloud.init();
    const snapshot = Store.data;
    Store.family = code; lsSet(FAM_KEY, code);
    const slot = role + '_1', uidv = Cloud.uid;
    // 1º lote: vaga + membro + configurações (sem isso o servidor recusa o resto)
    const ops = [
      { type: 'set', c: 'slots', d: { id: slot, uid: uidv, role } },
      { type: 'set', c: 'members', d: { id: uidv, slot, role, name: ROLES[role].label, seen: Date.now() } },
      { type: 'set', c: 'meta', d: { ...(snapshot.meta.settings || {}), id: 'settings', created: Date.now() } }
    ];
    COLS.filter(c => !['members', 'slots', 'meta'].includes(c)).forEach(c => Object.values(snapshot[c]).forEach(d => ops.push({ type: 'set', c, d })));
    Cloud.ready = Promise.resolve();
    await Cloud.write(ops, { sequential: true });   // envia os dados atuais antes de começar a escutar
    Cloud.connect(code);
    toast('Família criada');
  } catch (e) {
    Store.family = null; lsSet(FAM_KEY, null); Store.status = 'error'; Store.error = e.message || String(e); render();
  } finally { creatingFamily = false; }
}
async function joinFamily(raw) {
  const code = normCode(raw);
  if (code.length !== 12) return say('O código tem 12 letras e números, por exemplo ABCD-EFGH-JK23.', { title: 'Código incompleto', icon: ph('key') });
  try {
    Store.status = 'connecting'; render();
    if (!(await Cloud.exists(code))) { Store.status = 'local'; render(); return say('Confira as letras e os números e tente de novo.', { title: 'Código não encontrado', icon: ph('magnifying-glass') }); }
    if (!(await ask('Os dados deste celular serão trocados pelos da família.', { title: 'Entrar na família?', icon: ph('users-three'), ok: 'Entrar' }))) { Store.status = 'local'; render(); return; }
    lsSet(LOCAL_KEY, Store.data);
    Store.family = code; lsSet(FAM_KEY, code);
    Store.data = empty();
    Members.resetPrompt();
    Cloud.connect(code);
    toast('Você entrou na família');
  } catch (e) { Store.status = 'error'; Store.error = e.message || String(e); render(); }
}
async function leaveFamily() {
  if (!(await ask('Este celular fica com uma cópia dos dados atuais, mas para de receber as atualizações dos outros.', { title: 'Sair da família?', danger: true, ok: 'Sair da família' }))) return;
  // libera a vaga deste celular
  const mine = Cloud.uid && Store.get('members', Cloud.uid);
  if (mine) Cloud.write([{ type: 'del', c: 'members', id: mine.id }, { type: 'del', c: 'slots', id: mine.slot }], { onError: () => {} });
  Cloud.disconnect();
  lsSet(LOCAL_KEY, Store.data);
  Store.family = null; lsSet(FAM_KEY, null); Store.status = 'local';
  Store.emit();
}
