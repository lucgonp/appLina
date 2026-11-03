'use strict';
/* =========================================================
   Módulo — Avisos importantes (mural para avós e cuidadores)
   note: { id, emoji, title, text, order, by, updated }
   ========================================================= */
const Notes = (() => {
  const EMOJIS = ['🍼', '😴', '🛁', '💊', '🩺', '📞', '⚠️', '💗'];
  // O emoji continua sendo o valor gravado (compatível com os avisos já salvos); a tela mostra o ícone
  const NOTE_PH = { '🍼': 'baby', '😴': 'moon', '🛁': 'bathtub', '💊': 'pill', '🩺': 'stethoscope', '📞': 'phone', '⚠️': 'warning', '💗': 'heart', '📌': 'push-pin' };
  const noteIco = (e, s) => NOTE_PH[e] ? ph(NOTE_PH[e], s) : esc(e);
  const PRESETS = [
    { emoji: '🍼', title: 'Mamadeira', ph: 'Ex.: 180 ml de água + 6 colheres de fórmula' },
    { emoji: '😴', title: 'Sono', ph: 'Ex.: soneca às 13h, de barriga para cima' },
    { emoji: '📞', title: 'Pediatra', ph: 'Ex.: Dra. Ana — (62) 99999-0000' },
    { emoji: '⚠️', title: 'Atenção', ph: 'Ex.: não dar mel nem chá sem falar com a gente' }
  ];
  const all = () => Store.all('notes').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const isNew = n => n.updated && Date.now() - n.updated < 24 * 3600000 && n.by !== me();
  const card = n => `<div class="note-c">
        <div class="note-e">${noteIco(n.emoji || '📌', 28)}</div>
        <div class="note-b">${n.title ? `<p class="note-t">${esc(n.title)}</p>` : ''}<p class="note-x">${esc(n.text)}</p>
          ${n.updated ? `<small class="note-by">Atualizado ${esc(byTxt(n.by, n.updated).replace(/^Hoje/, 'hoje').replace(/^Ontem/, 'ontem'))}</small>` : ''}</div>
        <button class="sbtn eo" data-nedit="${n.id}" aria-label="Editar aviso">${ICON.pen}</button>
      </div>`;

  function render() {
    const ns = all(), box = $('homeNotes');
    if (!ns.length) {
      box.innerHTML = Store.status === 'connecting' || !Lock.canEdit() ? '' :
        `<button class="notes-empty" data-nadd>${ph('push-pin', 18)} Avisos para os avós: toque para criar (ex.: quantidade da mamadeira)</button>`;
      return;
    }
    box.innerHTML = `<div class="hsec-h" style="--acc:var(--sun)"><b style="color:var(--sun)">${ph('push-pin', 20)} Avisos importantes</b><button class="eo" data-nadd>+ Aviso</button></div>
      <div class="notes-wrap">${ns.map(card).join('')}</div>`;
  }

  function form(n) {
    const isNew = !n;
    const newId = uid();
    n = n || { emoji: '🍼', title: '', text: '' };
    let emoji = n.emoji || '📌';
    Sheet.open(`<h2>${isNew ? 'Novo aviso' : 'Editar aviso'}</h2>
      ${isNew ? `<div class="quick">${PRESETS.map((p, i) => `<button data-np="${i}">${noteIco(p.emoji, 18)} ${p.title}</button>`).join('')}</div>` : ''}
      <div class="emojis">${EMOJIS.map(e => `<button data-ne="${e}" aria-pressed="${e === emoji}">${noteIco(e, 24)}</button>`).join('')}</div>
      <label class="field"><span>Assunto (opcional)</span><input id="nTitle" value="${esc(n.title)}" placeholder="Ex.: Mamadeira" autocomplete="off" maxlength="40"></label>
      <label class="field"><span>Aviso</span><textarea id="nText" placeholder="Ex.: 180 ml de água + 6 colheres de fórmula" maxlength="400">${esc(n.text)}</textarea></label>
      <p class="ferr" id="formErr"></p>
      <div class="actions">
        ${isNew ? '<button class="ghost" data-cancel>Cancelar</button>' : '<button class="ghost d" data-remove>Apagar</button>'}
        <button class="big" data-save style="--acc:var(--sun)">Salvar</button>
      </div>`, async e => {
      const pe = e.target.closest('[data-ne]'), pp = e.target.closest('[data-np]');
      if (pe) { emoji = pe.dataset.ne; document.querySelectorAll('[data-ne]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ne === emoji)); return; }
      if (pp) {
        const p = PRESETS[+pp.dataset.np]; emoji = p.emoji;
        $('nTitle').value = p.title; $('nText').placeholder = p.ph; $('nText').focus();
        document.querySelectorAll('[data-ne]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ne === emoji));
        return;
      }
      if (e.target.closest('[data-cancel]')) return Sheet.close();
      if (e.target.closest('[data-remove]')) {
        if (await ask(`"${n.title || n.text.slice(0, 40)}" vai sumir para todos da família.`, { title: 'Apagar aviso?', danger: true, ok: 'Apagar' })) { Store.del('notes', n.id); Sheet.close(); }
        return;
      }
      if (e.target.closest('[data-save]')) {
        const text = $('nText').value.trim(), title = $('nTitle').value.trim();
        if (!text) return formErr('Escreva o aviso.');
        const data = { emoji, title, text, by: me(), updated: Date.now() };
        if (isNew) Store.put('notes', { id: newId, order: Math.max(-1, ...all().map(x => x.order ?? 0)) + 1, ...data });
        else Store.patch('notes', n.id, data);
        Sheet.close(); toast('Aviso salvo para toda a família');
      }
    });
    if (isNew) setTimeout(() => $('nText').focus(), 250);
  }

  $('homeNotes').addEventListener('click', e => {
    if (e.target.closest('[data-nadd]')) return Lock.ask(() => form(null));
    const ed = e.target.closest('[data-nedit]');
    if (ed) { const n = Store.get('notes', ed.dataset.nedit); Lock.ask(() => form(n)); }
  });
  return { render, all };
})();
