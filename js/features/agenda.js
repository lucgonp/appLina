'use strict';
/* =========================================================
   Módulo — Agenda (consultas, fisioterapia, vacinas)
   appt: { id, title, date 'AAAA-MM-DD', time 'HH:MM', place, listId, by }
   ========================================================= */
const Agenda = (() => {
  let showPast = false;
  const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dt = a => new Date(a.date + 'T' + (a.time || '00:00'));
  const all = () => Store.all('appts').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const isUpcoming = a => +dt(a) >= Date.now() - 90 * 60000;   // continua visível até 1h30 depois do início
  function dayName(date) {
    const d = new Date(date + 'T00:00'), t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    if (diff === -1) return 'Ontem';
    return `${WD[d.getDay()][0].toUpperCase() + WD[d.getDay()].slice(1)}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }
  const label = a => { const n = dayName(a.date); return (n === 'Hoje' || n === 'Amanhã' ? n.toLowerCase() : n) + (a.time ? ' às ' + a.time : ''); };
  const next = () => all().find(a => isUpcoming(a) && +dt(a) - Date.now() < 36 * 3600000);

  function card(a, past) {
    const ml = a.listId && Store.get('lists', a.listId);
    const today = dayName(a.date) === 'Hoje';
    return `<article class="card appt${today && !past ? ' today' : ''}${past ? ' past' : ''}">
      <div class="atime">${esc(a.time || '—')}</div>
      <div class="abody">
        <p class="atitle">${esc(a.title)}</p>
        ${a.place ? `<p class="aplace">${esc(a.place)}</p>` : ''}
        ${ml && !past ? `<button class="chip" data-openmala="${ml.id}">Mala: ${esc(ml.name)}</button>` : ''}
      </div>
      <div class="aact">
        ${past ? '' : `<button class="sbtn" data-acal="${a.id}" aria-label="Adicionar ao Calendário">${ICON.bell}</button>`}
        <button class="sbtn eo" data-aedit="${a.id}" aria-label="Editar">${ICON.pen}</button>
      </div></article>`;
  }

  function render() {
    const up = all().filter(isUpcoming), past = all().filter(a => !isUpcoming(a)).reverse().slice(0, 20);
    let html = '', lastDay = '';
    if (!up.length) html = `<p class="empty">${Store.status === 'connecting' ? 'Sincronizando…' : 'Nenhum compromisso marcado. Toque em + Agendar para marcar fisioterapia, consultas ou vacinas.'}</p>`;
    up.forEach(a => { if (a.date !== lastDay) { html += `<h3 class="dayh">${dayName(a.date)}</h3>`; lastDay = a.date; } html += card(a, false); });
    if (past.length) {
      html += `<button class="ghost" style="margin-top:18px" data-togglepast>${showPast ? 'Ocultar anteriores' : `Ver anteriores (${past.length})`}</button>`;
      if (showPast) html += '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">' + past.map(a => `<h3 class="dayh" style="margin:6px 6px 0">${dayName(a.date)}</h3>` + card(a, true)).join('') + '</div>';
    }
    $('apptList').innerHTML = html;
    const todayN = up.filter(a => dayName(a.date) === 'Hoje').length;
    const b = $('agendaBadge'); b.hidden = !todayN; b.textContent = todayN;
  }

  function toIcs(a) {
    const st = dt(a), ml = a.listId && Store.get('lists', a.listId);
    return { uid: a.id, start: st, end: new Date(+st + 60 * 60000), title: a.title, location: a.place,
      desc: ml ? `Levar a mala: ${ml.name}` : '', alarm: '-PT1H' };
  }

  function form(a) {
    const isNew = !a;
    const seriesId = uid();   // idempotência: mesma série, mesmos IDs, mesmo com toque duplo
    const t = new Date(); t.setDate(t.getDate() + 1);
    a = a || { title: '', date: dayKey(t), time: '', place: '', listId: '' };
    const opts = '<option value="">Nenhuma</option>' + Mala.lists().map(l => `<option value="${l.id}"${l.id === a.listId ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
    Sheet.open(`<h2>${isNew ? 'Novo compromisso' : 'Editar compromisso'}</h2>
      <label class="field"><span>O que é</span><input id="aTitle" value="${esc(a.title)}" placeholder="Ex.: Fisioterapia" autocomplete="off"></label>
      ${isNew ? '<div class="quick"><button data-q="Fisioterapia">Fisioterapia</button><button data-q="Pediatra">Pediatra</button><button data-q="Vacina">Vacina</button><button data-q="Exame">Exame</button></div>' : ''}
      <div class="two">
        <label class="field"><span>Dia</span><input id="aDate" type="date" value="${esc(a.date)}"></label>
        <label class="field"><span>Horário</span><input id="aTime" type="time" value="${esc(a.time)}"></label>
      </div>
      <label class="field"><span>Local (opcional)</span><input id="aPlace" value="${esc(a.place)}" placeholder="Ex.: Clínica Crescer" autocomplete="off"></label>
      <label class="field"><span>Mala para levar</span><select id="aList">${opts}</select></label>
      ${isNew ? `<label class="field"><span>Repetir</span><select id="aRep">
        <option value="0">Não repetir</option><option value="4">Toda semana, por 4 semanas</option>
        <option value="8">Toda semana, por 8 semanas</option><option value="12">Toda semana, por 12 semanas</option></select></label>` : ''}
      <p class="ferr" id="formErr"></p>
      <div class="actions">
        ${isNew ? '<button class="ghost" data-cancel>Cancelar</button>' : '<button class="ghost d" data-remove>Apagar</button>'}
        <button class="big" data-save style="--acc:var(--sky)">Salvar</button>
      </div>`, async e => {
      const q = e.target.closest('[data-q]');
      if (q) {
        $('aTitle').value = q.dataset.q;
        const match = Mala.lists().find(l => l.name.toLowerCase().includes(q.dataset.q.toLowerCase().slice(0, 6)));
        if (match) $('aList').value = match.id;
        return;
      }
      if (e.target.closest('[data-cancel]')) return Sheet.close();
      if (e.target.closest('[data-remove]')) {
        if (await ask(`"${a.title}" de ${dayName(a.date).toLowerCase()}${a.time ? ' às ' + a.time : ''} será apagado.`, { title: 'Apagar compromisso?', danger: true, ok: 'Apagar' })) { Store.del('appts', a.id); Sheet.close(); }
        return;
      }
      if (e.target.closest('[data-save]')) {
        const title = $('aTitle').value.trim(), date = $('aDate').value, time = $('aTime').value;
        if (!title) return formErr('Informe o que é o compromisso.');
        if (!date) return formErr('Escolha o dia.');
        const data = { title: title.slice(0, 60), date, time, place: $('aPlace').value.trim().slice(0, 80), listId: $('aList').value };
        if (isNew) {
          const rep = +($('aRep')?.value || 0), docs = [];
          for (let i = 0; i < Math.max(1, rep); i++) {
            const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + 7 * i);
            docs.push({ id: `${seriesId}-${i}`, ...data, date: dayKey(d), by: me() });
          }
          Store.putMany('appts', docs);
          toast(docs.length > 1 ? `${docs.length} compromissos agendados` : 'Compromisso agendado');
        } else Store.patch('appts', a.id, data);
        Sheet.close();
      }
    });
    if (isNew) setTimeout(() => $('aTitle').focus(), 250);
  }

  $('apptAdd').onclick = () => Lock.ask(() => form(null));
  $('apptList').addEventListener('click', async e => {
    const t = k => e.target.closest(`[data-${k}]`);
    if (t('togglepast')) { showPast = !showPast; render(); }
    else if (t('aedit')) { const a = Store.get('appts', t('aedit').dataset.aedit); Lock.ask(() => form(a)); }
    else if (t('openmala')) { Mala.select(t('openmala').dataset.openmala); go('mala'); }
    else if (t('acal')) {
      const a = Store.get('appts', t('acal').dataset.acal);
      const same = all().filter(x => isUpcoming(x) && x.title === a.title && x.time === a.time);
      let which = 'one';
      if (same.length > 1) {
        which = await choose(`Há ${same.length} compromissos de "${a.title}" marcados.`, [{ label: `Adicionar todos (${same.length})`, value: 'all' }, { label: 'Só este', value: 'one' }], { title: 'Adicionar ao Calendário', icon: ph('calendar-blank') });
        if (!which) return;
      }
      openCalendar(makeIcs(which === 'all' ? same.map(toIcs) : [toIcs(a)]));
    }
  });
  const upcoming = () => all().filter(a => isUpcoming(a) && +dt(a) - Date.now() < 7 * 86400000);
  return { render, next, label, upcoming };
})();
