'use strict';
/* =========================================================
   Módulo — Início (avisos + resumo de hoje)
   ========================================================= */
const Home = (() => {
  const arrow = ph('caret-right', 18);
  const statusCard = (kind, icon, title, msg, retry) => `<div class="statuscard ${kind}">
      <span class="si">${icon}</span><div class="sb"><b>${esc(title)}</b><p>${esc(msg)}</p>
      ${retry ? '<button class="big" data-retry>Tentar de novo</button>' : ''}
      ${Store.errorDetail && kind === 'err' && retry ? `<details><summary>Detalhes técnicos</summary><code>${esc(Store.errorDetail)}</code></details>` : ''}</div></div>`;

  function render() {
    const who = me(), name = ((Store.get('meta', 'settings') || {}).babyName || '').trim();
    $('homeTitle').textContent = who ? `Olá, ${who}!` : 'Olá!';
    const parts = [];

    // 1) estado da conexão: nunca deixar a tela em branco sem explicação
    if (Store.family) {
      if (Store.status === 'error') parts.push(statusCard('err', ph('warning', 22), 'Não conseguimos sincronizar', Store.error, true));
      else if (Store.status === 'connecting' && Store.slow) parts.push(statusCard('wait', ph('clock', 22), 'Está demorando para conectar', 'Confira a internet. Se o app estiver aberto em outra aba do Safari, feche-a.', true));
      else if (Store.status === 'connecting') parts.push(`<div class="sync-chip">${ph('arrows-clockwise', 16)} Conectando à família…</div>`);
      else if (!navigator.onLine) parts.push(`<div class="sync-chip off">${ph('wifi-slash', 16)} Sem internet: o que você fizer fica salvo e é enviado depois</div>`);
    }
    // 2) falha ao desenhar alguma parte (não esconder: dizer o quê e como resolver)
    if (renderErrors.size) parts.push(statusCard('err', ph('warning', 22), 'Parte do app não abriu', `Não foi possível mostrar: ${[...renderErrors.keys()].join(', ')}. Feche e abra o app. Se continuar, envie um print desta tela.`, false));
    // 3) botão de instalar no topo (Android: instala direto; iPhone: passo a passo)
    $('homeInstall').innerHTML = Install.card();

    // remédios
    const meds = Farm.meds();
    if (meds.length) {
      parts.push(`<div class="hsec-h"><b>${ph('pill', 20)} Remédios de hoje</b></div>`);
      meds.forEach(m => {
        const st = Farm.status(m), last = Farm.doses(m)[0], n = Farm.todayCount(m);
        const tag = st.cls === 'early' ? `<span class="tag wait">Aguarde ${hhmm(new Date(st.until))}</span>`
          : st.cls === 'complete' ? '<span class="tag ok">Completo ✓</span>' : '<span class="tag go">Pode dar</span>';
        parts.push(`<button class="hcard" data-goto="farm">
          <span class="hi" style="background:var(--lilac-soft);color:var(--lilac)">${ph('pill', 22)}</span>
          <span class="hb"><b>${esc(m.name)} · ${n}/${m.perDay}</b><small>${last ? 'Última dose ' + ago(Date.now() - last.ts) + (last.by ? ' · ' + esc(last.by) : '') : 'Nenhuma dose ainda'}</small></span>
          ${tag}</button>`);
      });
    }

    // agenda
    const up = Agenda.upcoming().slice(0, 2);
    if (up.length) {
      parts.push(`<div class="hsec-h" style="margin-top:18px"><b>${ph('calendar-blank', 20)} Próximos compromissos</b></div>`);
      up.forEach(a => parts.push(`<button class="hcard" data-goto="agenda">
        <span class="hi" style="background:var(--sky-soft);color:var(--sky)">${ph('calendar-blank', 22)}</span>
        <span class="hb"><b>${esc(a.title)}</b><small>${esc(Agenda.label(a))}${a.place ? ' · ' + esc(a.place) : ''}</small></span>${arrow}</button>`));
    }

    // mala
    const l = Mala.cur();
    if (l) {
      const its = Mala.items(l), done = its.filter(i => i.done).length, left = its.length - done;
      const full = its.length && !left;
      parts.push(`<div class="hsec-h" style="margin-top:18px"><b>${ph('backpack', 20)} Malinha</b></div>
        <button class="hcard" data-goto="mala">
          <span class="hi" style="background:${full ? 'var(--mint-soft);color:var(--mint)' : 'var(--accent-soft);color:var(--accent)'}">${ph('backpack', 22)}</span>
          <span class="hb"><b>${esc(l.name)}</b><small>${!its.length ? 'Lista vazia' : full ? 'Pronta para sair!' : `${left} ${left === 1 ? 'item faltando' : 'itens faltando'} · ${done} de ${its.length}`}</small></span>
          ${full ? '<span class="tag ok">Pronta ✓</span>' : arrow}</button>`);
    }
    $('homeToday').innerHTML = parts.join('');
  }
  $('homeToday').addEventListener('click', e => {
    if (e.target.closest('[data-retry]')) { Cloud.retry(); return; }
    const b = e.target.closest('[data-goto]'); if (b) go(b.dataset.goto);
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-gofam]')) go('fam');
    else if (e.target.closest('[data-gohome]')) go('home');
  });
  return { render };
})();
