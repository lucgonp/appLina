'use strict';
/* =========================================================
   Navegação e inicialização
   ========================================================= */
// cada parte da tela desenha de forma independente: se uma falhar, as outras continuam
// e o erro aparece no Início (em vez de uma tela em branco)
const renderErrors = new Map();
function safe(name, fn) {
  try { fn(); renderErrors.delete(name); }
  catch (e) { renderErrors.set(name, e); console.error('[cuidados] falha ao desenhar ' + name, e); }
}
function render() {
  safe('trava', () => Lock.apply()); safe('membros', () => Members.render()); safe('avisos', () => Notes.render());
  safe('malinha', () => Mala.render()); safe('remédios', () => Farm.render()); safe('agenda', () => Agenda.render());
  safe('pendências', () => Tasks.render()); safe('família', () => Fam.render());
  safe('início', () => Home.render());   // por último: mostra o estado da conexão e eventuais falhas acima
}
Store.on(render);
Store.on(() => Members.sync());

const VIEWS = { home: 'v-home', mala: 'v-mala', farm: 'v-farm', agenda: 'v-agenda', task: 'v-task', fam: 'v-fam' };
// cada aba entra no histórico: o gesto/botão de voltar do celular funciona como esperado
function go(tab, { replace = false } = {}) {
  if (!VIEWS[tab]) tab = 'home';
  try { const h = '#' + tab; if (location.hash !== h) history[replace ? 'replaceState' : 'pushState']({ tab }, '', h); } catch {}
  show(tab);
}
window.addEventListener('popstate', () => show((location.hash || '#home').slice(1)));
function show(tab) {
  if (!VIEWS[tab]) tab = 'home';
  Object.entries(VIEWS).forEach(([k, v]) => { $(v).hidden = k !== tab; });
  const navTab = tab === 'fam' ? 'home' : tab;
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === navTab));
  try { sessionStorage.setItem('tab', tab); } catch {}
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));

// carregar dados
if (Store.family && Cloud.configured()) {
  Store.data = lsGet(MIRROR_KEY, empty());
  render();
  Cloud.connect(Store.family);
} else {
  if (Store.family) { Store.family = null; } // família salva mas sem config: volta ao local
  let d = lsGet(LOCAL_KEY, null);
  if (!d) { d = migrateLegacy() || seedData(); lsSet(LOCAL_KEY, d); }
  Store.data = { ...empty(), ...d };
  render();
}
let start = (location.hash || '').slice(1);
if (!VIEWS[start]) { try { start = sessionStorage.getItem('tab') || 'home'; } catch { start = 'home'; } }
go(start, { replace: true });
// internet caiu/voltou: atualiza o aviso de sincronização
window.addEventListener('online', () => { if (Store.family && Store.status === 'error') Cloud.retry(); else render(); });
window.addEventListener('offline', render);

setInterval(render, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

// pergunta uma vez quem usa este celular (na família, Members.sync confere as vagas)
if (!me() && !lsGet('cuidados:askedMe', false) && !Store.family) {
  lsSet('cuidados:askedMe', true);
  setTimeout(() => Members.pick(), 400);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
