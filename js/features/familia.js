'use strict';
/* =========================================================
   Módulo 4 — Família (nome do bebê + compartilhamento)
   ========================================================= */
const Fam = (() => {
  const settings = () => Store.get('meta', 'settings') || { id: 'settings' };
  function render() {
    const name = (settings().babyName || '').trim();
    document.querySelectorAll('[data-hello]').forEach(el => { el.textContent = name ? `Cuidados de ${name} ♡` : 'Cuidados do bebê ♡'; });
    if (document.activeElement !== $('babyName')) $('babyName').value = name;
    $('syncDot').hidden = !(Store.family && Store.status === 'ok');

    const st = Store.status;
    const stHtml = st === 'ok' ? '<div class="status ok"><i></i>Sincronizado</div>'
      : st === 'connecting' ? '<div class="status"><i></i>Conectando…</div>'
      : st === 'error' ? `<div class="status err"><i></i>Erro: ${esc(Store.error)}</div>` : '';
    let html;
    if (!Cloud.configured()) {
      html = `<section class="card fcard"><h2>Compartilhar com a família</h2>
        <p>A sincronização ainda não foi configurada. Siga o guia do Firebase (gratuito) e cole a configuração no arquivo <b>config.js</b>. Até lá, tudo fica salvo só neste aparelho.</p></section>`;
    } else if (Store.family) {
      html = `<section class="card fcard"><h2>Família conectada</h2>
        <p>Envie este código para quem vai usar o app junto com você. A pessoa digita o código na aba Família do app dela.</p>
        <div class="code">${fmtCode(Store.family)}</div>${stHtml}
        <button class="big" data-copy>Copiar código</button>
        <div style="height:10px"></div>
        <button class="ghost d eo" data-leave>Sair da família</button></section>`;
    } else {
      html = `<section class="card fcard"><h2>Compartilhar com a família</h2>
        <p>Crie uma família para que tudo o que um adicionar apareça no celular do outro, em tempo real.</p>${stHtml}
        <button class="big" data-create ${st === 'connecting' ? 'disabled' : ''}>Criar família</button>
        <div class="or">ou</div>
        <label class="field"><span>Já tem um código?</span><input id="joinCode" placeholder="ABCD-EFGH-JK23" autocapitalize="characters" autocomplete="off"></label>
        <button class="ghost" data-join ${st === 'connecting' ? 'disabled' : ''}>Entrar na família</button></section>`;
    }
    const box = $('famBox');
    const typing = document.activeElement?.tagName === 'INPUT' && box.contains(document.activeElement);
    if (box.dataset.html !== html && !typing) { box.innerHTML = html; box.dataset.html = html; }
  }
  $('famBox').addEventListener('click', e => {
    const t = a => e.target.closest(`[data-${a}]`);
    if (t('create')) createFamily();
    else if (t('join')) joinFamily($('joinCode').value);
    else if (t('leave')) leaveFamily();
    else if (t('copy')) {
      const txt = fmtCode(Store.family);
      (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast('Código copiado'), () => say(txt, { title: 'Toque e segure para copiar', icon: ph('key') }));
    }
  });
  $('babyName').addEventListener('change', e => Store.put('meta', { ...settings(), id: 'settings', babyName: e.target.value.trim().slice(0, 30) }));

  $('bkExport').onclick = () => {
    const payload = { app: 'cuidados', version: 4, exported: new Date().toISOString(), data: Store.data };
    shareFile(`cuidados-backup-${dayKey(new Date())}.json`, 'application/json', JSON.stringify(payload, null, 1));
  };
  $('bkImport').onclick = () => { if (Lock.ask()) $('bkFile').click(); };
  $('bkFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.app !== 'cuidados' || !j.data || !j.data.lists) throw new Error();
      const n = Object.keys(j.data.lists).length, d = j.exported ? new Date(j.exported).toLocaleDateString('pt-BR') : '?';
      if (!(await ask(`Backup de ${d} com ${n} lista(s). Todos os dados atuais${Store.family ? ', em todos os celulares da família,' : ''} serão substituídos.`, { title: 'Restaurar backup?', danger: true, ok: 'Restaurar' }))) return;
      Store.replaceAll(j.data); toast('Backup restaurado');
    } catch { say('Escolha um arquivo exportado pelo próprio app.', { title: 'Arquivo inválido', icon: ph('folder') }); }
  });
  return { render };
})();
