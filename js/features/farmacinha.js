'use strict';
/* =========================================================
   Módulo 2 — Farmacinha
   ========================================================= */
const Farm = (() => {
  const meds = () => Store.all('meds').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  // a regra de segurança mora em js/rules/dose-safety.js (testada separadamente)
  const doses = m => DoseSafety.validDoses(m, Store.all('doses'));
  const todayCount = m => DoseSafety.todayCount(m, Store.all('doses'));
  const defMin = DoseSafety.defaultMinHours;
  const minGap = DoseSafety.minGapMs;

  function status(m) {
    const c = DoseSafety.check(m, Store.all('doses'));
    if (c.reason === 'early') return { cls: 'early', note: `Aguarde: próxima dose liberada às ${hhmm(new Date(c.until))}`, until: c.until };
    if (c.reason === 'complete') return { cls: 'complete', note: 'Meta de hoje completa ♡' };
    const left = m.perDay - todayCount(m);
    return { cls: '', note: `Falta${left > 1 ? 'm' : ''} ${left} dose${left > 1 ? 's' : ''} hoje` };
  }

  function render() {
    const box = $('medList');
    const openIds = [...box.querySelectorAll('details[open]')].map(d => d.dataset.med);
    let pending = 0;
    const ms = meds();
    box.innerHTML = !ms.length
      ? `<p class="empty">${Store.status === 'connecting' ? 'Sincronizando…' : 'Nenhum remédio cadastrado. Toque em + Remédio para começar.'}</p>`
      : ms.map(m => {
        const st = status(m), n = todayCount(m), ds = doses(m), lt = ds[0]?.ts;
        if (st.cls !== 'complete') pending++;
        const pips = Array.from({ length: m.perDay }, (_, i) => ICON.pip(i < n)).join('');
        return `<article class="card med ${st.cls}">
          <div class="mhead">
            <div><p class="mname">${esc(m.name)}</p>
              <span class="drops">${m.drops} gota${m.drops > 1 ? 's' : ''}</span>
              <p class="mdesc">${m.perDay}x ao dia · intervalo mín. ${(m.minH > 0 ? m.minH : defMin(m.perDay))}h${m.times ? ' · ' + esc(m.times) : ''}</p></div>
            <div style="display:flex"><button class="sbtn" data-cal="${m.id}" aria-label="Lembrete no Calendário">${ICON.bell}</button>
            <button class="sbtn eo" data-edit="${m.id}" aria-label="Editar ${esc(m.name)}">${ICON.pen}</button></div>
          </div>
          <div class="mstat">
            <div class="since">${lt ? ago(Date.now() - lt) : 'Sem registro'}<small>${lt ? 'última dose · ' + esc(byTxt(ds[0].by, lt)) : 'nenhuma dose registrada'}</small></div>
            <div class="today"><span class="pips">${pips}</span>${n}/${m.perDay}</div>
          </div>
          <p class="note">${st.note}</p>
          <button class="dose${st.cls === 'early' ? ' wait' : ''}" data-dose="${m.id}">${st.cls === 'early' ? `Aguarde até ${hhmm(new Date(st.until))}` : 'Dar dose'}</button>
          ${ds.length ? `<details class="hist" data-med="${m.id}"${openIds.includes(m.id) ? ' open' : ''}><summary>Histórico</summary><ul>${ds.slice(0, 15).map(d =>
            `<li><span>${esc(byTxt(d.by, d.ts))}${d.forced ? ' · dose extra' : ''}</span><button class="eo" data-undo="${d.id}">Corrigir</button></li>`).join('')}</ul></details>` : ''}
        </article>`;
      }).join('');
    const b = $('farmBadge'); b.hidden = !pending; b.textContent = pending;
  }

  $('medList').addEventListener('click', async e => {
    const t = a => e.target.closest(`[data-${a}]`);
    if (t('dose')) {
      const m = Store.get('meds', t('dose').dataset.dose), st = status(m), last = doses(m)[0];
      if (st.cls === 'early') return safetyStop(m, last, st);
      if (st.cls === 'complete') return safetyStop(m, last, st);
      giveDose(m);
    } else if (t('undo')) {
      if (!Lock.ask()) return;
      const d = Store.get('doses', t('undo').dataset.undo);
      if (!d || !(await ask(`O registro de ${byTxt(d.by, d.ts)} deixa de contar. Ele fica guardado como "corrigido" para ninguém perder o histórico.`, { title: 'Corrigir esta dose?', danger: true, ok: 'Marcar como corrigida' }))) return;
      const m = Store.get('meds', d.medId), rest = doses(m).filter(x => x.id !== d.id);
      Store.voidDose(d, m, rest[0] || null);
    } else if (t('edit')) { const m = Store.get('meds', t('edit').dataset.edit); Lock.ask(() => form(m)); }
    else if (t('cal')) reminder(Store.get('meds', t('cal').dataset.cal));
  });

  // idempotência: o mesmo toque (ou toque duplo) não registra duas doses
  const lastTap = {};
  function giveDose(m, forced = false) {
    if (Date.now() - (lastTap[m.id] || 0) < 3000) return;
    lastTap[m.id] = Date.now();
    Store.giveDose(m, { id: uid(), medId: m.id, ts: Date.now(), by: me(), forced }, {
      // race condition: outra pessoa registrou uma dose antes de este celular saber
      onConflict: () => {
        haptic('strong');
        say(`Outra pessoa registrou uma dose de ${m.name} antes. Esta dose NÃO foi registrada. Confira o histórico antes de dar de novo.`, { title: 'Dose não registrada', icon: ph('warning') });
      }
    });
    haptic('strong'); toast(`Dose de ${m.name} registrada`);
  }
  // Trava de segurança: tela em destaque antes de uma dose fora do intervalo
  function safetyStop(m, last, st) {
    haptic('strong');
    const mins = Math.max(1, Math.round((Date.now() - last.ts) / 60000));
    const who = last.by ? (last.by === me() ? 'Você' : last.by) : 'Alguém';
    const early = st.cls === 'early';
    const head = early
      ? `<div class="alertbox stop"><b>Atenção: dose recente!</b>
          <p>${esc(who)} deu <b style="display:inline;font-size:inherit">${esc(m.name)}</b> (${m.drops} gota${m.drops > 1 ? 's' : ''})</p>
          <div class="big-ago">há ${mins} min</div>
          <p>às ${hhmm(new Date(last.ts))}. Intervalo seguro: ${(minGap(m) / 3600000)}h. Próxima dose liberada às <b style="display:inline;font-size:inherit">${hhmm(new Date(st.until))}</b>.</p></div>`
      : `<div class="alertbox"><b>Meta de hoje já completa</b>
          <p>${esc(m.name)} já foi dado ${m.perDay}x hoje. A última foi há ${mins} min, por ${esc(who)}.</p></div>`;
    Sheet.open(`${head}
      <p style="margin:0 0 14px;color:var(--muted);font-weight:600">Antes de dar outra dose, confirme com quem deu a anterior ou com o pediatra.</p>
      <button class="big" data-stop style="--acc:var(--mint)">Não dar agora</button>
      <button class="danger-link" data-force>Já confirmei, registrar mesmo assim</button>`, async e => {
      if (e.target.closest('[data-stop]')) return Sheet.close();
      if (e.target.closest('[data-force]')) {
        if (!(await ask(`Vai ser registrada uma dose extra de ${m.name} agora.`, { title: 'Confirmar dose extra?', danger: true, ok: 'Registrar dose extra' }))) return;
        Sheet.close(); giveDose(m, true);
      }
    });
  }

  async function reminder(m) {
    const times = [...String(m.times || '').matchAll(/(\d{1,2})\s*[:h]\s*(\d{2})?/g)]
      .map(x => [+x[1], +(x[2] || 0)]).filter(([h, mi]) => h < 24 && mi < 60);
    if (!times.length) return say('Cadastre os horários previstos (ex.: 08:00, 20:00) no remédio para criar os lembretes.', { title: 'Sem horários', icon: ph('alarm') });
    if (!(await ask(`${times.length} lembrete${times.length > 1 ? 's' : ''} diário${times.length > 1 ? 's' : ''} de ${m.name}: ${times.map(([h, mi]) => pad(h) + ':' + pad(mi)).join(', ')}.`, { title: 'Criar lembretes no Calendário?', icon: ph('alarm'), ok: 'Criar lembretes' }))) return;
    const base = new Date();
    openCalendar(makeIcs(times.map(([h, mi], i) => {
      const st = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, mi);
      return { uid: m.id + '-' + i, start: st, end: new Date(+st + 10 * 60000), rrule: 'FREQ=DAILY',
        title: `${m.name} · ${m.drops} gota${m.drops > 1 ? 's' : ''}`, desc: 'Registre a dose no app Cuidados.', alarm: 'PT0M' };
    })));
  }

  function form(m) {
    const isNew = !m;
    const newId = uid();   // gerado ao abrir: salvar duas vezes grava o mesmo remédio
    m = m || { name: '', drops: '', perDay: 1, times: '' };
    Sheet.open(`<h2>${isNew ? 'Novo remédio' : 'Editar remédio'}</h2>
      <label class="field"><span>Nome</span><input id="fName" value="${esc(m.name)}" placeholder="Ex.: Vitamina D" autocomplete="off"></label>
      <div class="two">
        <label class="field"><span>Gotas por dose</span><input id="fDrops" type="number" inputmode="numeric" min="1" value="${esc(m.drops)}"></label>
        <label class="field"><span>Doses por dia</span><input id="fPer" type="number" inputmode="numeric" min="1" max="12" value="${esc(m.perDay)}"></label>
      </div>
      <label class="field"><span>Intervalo mínimo entre doses (horas)</span><input id="fMin" type="number" inputmode="decimal" min="1" max="24" step="0.5" value="${esc(m.minH || '')}" placeholder="Padrão: ${defMin(m.perDay || 1)}h"></label>
      <label class="field"><span>Horários previstos (opcional)</span><input id="fTimes" value="${esc(m.times)}" placeholder="Ex.: 08:00, 20:00" autocomplete="off"></label>
      <p class="ferr" id="formErr"></p>
      <div class="actions">
        ${isNew ? '<button class="ghost" data-cancel>Cancelar</button>' : '<button class="ghost d" data-remove>Apagar</button>'}
        <button class="big" data-save style="--acc:var(--lilac)">Salvar</button>
      </div>`, async e => {
      if (e.target.closest('[data-cancel]')) return Sheet.close();
      if (e.target.closest('[data-remove]')) {
        if (!(await ask(`${m.name} e todo o histórico de doses serão apagados.`, { title: 'Apagar remédio?', danger: true, ok: 'Apagar' }))) return;
        Store.delMany([['meds', m.id], ...Store.all('doses').filter(d => d.medId === m.id).map(d => ['doses', d.id])]);
        return Sheet.close();
      }
      if (e.target.closest('[data-save]')) {
        const name = $('fName').value.trim(), drops = parseInt($('fDrops').value, 10), per = parseInt($('fPer').value, 10);
        if (!name) return formErr('Informe o nome do remédio.');
        if (name.length > 40) return formErr('Nome muito longo (máximo 40 letras).');
        if (!(drops > 0 && drops <= 60)) return formErr('Gotas por dose: de 1 a 60.');
        if (!(per > 0 && per <= 12)) return formErr('Doses por dia: de 1 a 12.');
        const minH = parseFloat(String($('fMin').value).replace(',', '.'));
        if ($('fMin').value && !(minH >= 1 && minH <= 24)) return formErr('Intervalo mínimo: de 1 a 24 horas.');
        const times = $('fTimes').value.trim().slice(0, 60);
        const data = { name, drops, perDay: per, times, minH: minH > 0 ? minH : 0 };
        data.minGapMin = DoseSafety.minGapMinutes(data);   // o servidor usa para conferir o intervalo
        if (isNew) Store.put('meds', { id: newId, order: Math.max(-1, ...meds().map(x => x.order ?? 0)) + 1, ...data });
        else Store.patch('meds', m.id, data);
        Sheet.close();
      }
    });
    if (isNew) setTimeout(() => $('fName').focus(), 250);
  }
  $('medAdd').onclick = () => Lock.ask(() => form(null));
  return { render, meds, doses, todayCount, status };
})();
