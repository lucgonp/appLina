'use strict';
/* =========================================================
   Resumo do dia para WhatsApp
   ========================================================= */
function buildSummary() {
  const now = new Date(), k = dayKey(now);
  const isToday = ts => ts && dayKey(new Date(ts)) === k;
  const name = ((Store.get('meta', 'settings') || {}).babyName || '').trim();
  const L = [`*Resumo de hoje${name ? ' — ' + name : ''}* (${pad(now.getDate())}/${pad(now.getMonth() + 1)}, ${hhmm(now)})`];

  const meds = Farm.meds();
  L.push('', '💧 *Remédios*');
  if (!meds.length) L.push('Nenhum remédio cadastrado.');
  meds.forEach(m => {
    const ds = Farm.doses(m).filter(d => isToday(d.ts)).sort((a, b) => a.ts - b.ts);
    const ok = ds.length >= m.perDay ? ' ✅' : '';
    L.push(`• ${m.name} (${m.drops} gota${m.drops > 1 ? 's' : ''}) — ${ds.length}/${m.perDay}${ok}`);
    if (ds.length) L.push('   ' + ds.map(d => hhmm(new Date(d.ts)) + (d.by ? ` (${d.by})` : '')).join(', '));
    else L.push('   nenhuma dose hoje');
  });

  const lists = Store.all('lists').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const its = Store.all('items');
  const touched = lists.filter(l => its.some(i => i.listId === l.id && i.done && isToday(i.doneAt)));
  if (touched.length) {
    touched.forEach(l => {
      const li = its.filter(i => i.listId === l.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const done = li.filter(i => i.done), left = li.filter(i => !i.done);
      L.push('', `🎒 *Mala: ${l.name}* — ${done.length}/${li.length}${left.length ? '' : ' (pronta ✅)'}`);
      done.forEach(i => L.push(`✔ ${i.name}${i.doneBy ? ` (${i.doneBy}${i.doneAt ? ', ' + hhmm(new Date(i.doneAt)) : ''})` : ''}`));
      if (left.length) L.push(`⏳ Falta: ${left.map(i => i.name).join(', ')}`);
    });
  } else L.push('', '🎒 *Mala*: nenhum item conferido hoje.');

  const appts = Store.all('appts').filter(a => a.date === k).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (appts.length) { L.push('', '📅 *Compromissos de hoje*'); appts.forEach(a => L.push(`• ${a.time || '—'} ${a.title}${a.place ? ' — ' + a.place : ''}`)); }
  return L.join('\n');
}
function openSummary() {
  const txt = buildSummary();
  Sheet.open(`<h2>Resumo de hoje</h2>
    <pre class="preview">${esc(txt)}</pre>
    <div class="actions" style="margin-top:0"><button class="ghost" data-copy>Copiar</button><button class="big wa" data-wa>Enviar no WhatsApp</button></div>`, e => {
    if (e.target.closest('[data-copy]')) {
      (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => { haptic(); toast('Resumo copiado'); }, () => say('Toque e segure no texto do resumo para selecionar e copiar.', { title: 'Não deu para copiar', icon: ph('clipboard-text') }));
    } else if (e.target.closest('[data-wa]')) {
      window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
    }
  });
}
document.addEventListener('click', e => { if (e.target.closest('[data-summary]')) openSummary(); });
