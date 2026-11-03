'use strict';
/* =========================================================
   Módulo 1 — Malinha
   ========================================================= */
const Mala = (() => {
  let editing = false;
  const lists = () => Store.all('lists').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const cur = () => {
    const ls = lists(), id = lsGet('cuidados:curList', null);
    return ls.find(l => l.id === id) || ls[0];
  };
  const items = l => Store.all('items').filter(i => i.listId === l.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  function render() {
    const l = cur();
    if (!l) {
      $('malaTitle').textContent = 'Malinha'; $('malaBanner').innerHTML = '';
      $('bag').hidden = true; $('malaDock').hidden = true; $('malaAdd').hidden = true; $('malaEdit').hidden = true;
      $('malaList').innerHTML = `<li class="empty">${Store.status === 'connecting' ? 'Sincronizando…' : 'Nenhuma lista. Toque no título para criar uma.'}</li>`;
      return;
    }
    $('bag').hidden = false; $('malaEdit').hidden = false;
    const nx = Agenda.next();
    if (nx) {
      const ml = nx.listId && Store.get('lists', nx.listId);
      const sub = ml ? (ml.id === l.id ? 'Esta é a mala certa' : `Toque para abrir a mala "${ml.name}"`) : 'Confira a mala antes de sair';
      $('malaBanner').innerHTML = `<button class="banner" data-golist="${ml ? ml.id : ''}">${ICON.cal}<span>${esc(nx.title)} · ${Agenda.label(nx)}<small>${esc(sub)}</small></span></button>`;
    } else $('malaBanner').innerHTML = '';
    const its = items(l), total = its.length, done = its.filter(i => i.done).length, full = total > 0 && done === total;
    $('malaTitle').textContent = l.name;
    const pend = total - done;
    $('bagNum').textContent = !total ? '0' : full ? 'Mala Pronta para Sair!' : pend;
    $('bagLbl').textContent = !total ? 'lista vazia' : full ? '' : (pend === 1 ? 'item faltando' : 'itens faltando');
    $('bagSub').textContent = total ? `${done} de ${total} conferidos` : '';
    $('bag').classList.toggle('full', full);
    $('bagFill').style.width = total ? (done / total * 100) + '%' : '0';
    const left = its.filter(i => !i.done).map(i => i.name);
    $('bagMissing').textContent = !full && done > 0 && left.length <= 3 ? 'Falta: ' + left.join(', ') : '';
    if (editing && !Lock.open()) editing = false;
    $('malaReset').disabled = done === 0;
    $('malaDock').hidden = editing;
    $('malaEdit').textContent = editing ? 'Pronto' : 'Editar';
    $('malaAdd').hidden = !editing;
    if (editing && document.activeElement?.closest?.('#malaList')) return; // não interromper digitação
    $('malaList').innerHTML = !total && !editing
      ? '<li class="empty">Lista vazia. Toque em Editar para adicionar itens.</li>'
      : its.map(i => editing
        ? `<li class="erow"><input data-id="${i.id}" value="${esc(i.name)}" aria-label="Nome do item"><button class="ibtn d" data-del="${i.id}" aria-label="Remover ${esc(i.name)}">${ICON.trash}</button></li>`
        : `<li><button class="row${i.done ? ' done' : ''}" data-id="${i.id}" aria-pressed="${i.done}">${ICON.heart}<span class="txt"><span class="name">${esc(i.name)}</span>${i.done && i.doneAt ? `<small class="by">${esc(byTxt(i.doneBy, i.doneAt))}</small>` : ''}</span></button></li>`
      ).join('');
  }

  let lastToggle = { id: '', at: 0 };
  $('malaList').addEventListener('click', e => {
    const del = e.target.closest('[data-del]'), b = e.target.closest('.row');
    if (del) { if (Lock.ask()) Store.del('items', del.dataset.del); }
    else if (b) {
      // toque duplo acidental no mesmo item não desfaz a marcação
      if (b.dataset.id === lastToggle.id && Date.now() - lastToggle.at < 450) return;
      lastToggle = { id: b.dataset.id, at: Date.now() };
      const it = Store.get('items', b.dataset.id), l = cur();
      const wasLast = !it.done && items(l).filter(i => !i.done).length === 1;
      // estado explícito (não "inverte"): o que a pessoa viu na tela é o que vale
      const done = b.getAttribute('aria-pressed') !== 'true';
      Store.patch('items', it.id, { done, doneBy: done ? me() : '', doneAt: done ? Date.now() : 0 });
      haptic(wasLast ? 'strong' : '');
      if (wasLast) toast('Mala pronta para sair!');
    }
  });
  $('malaList').addEventListener('change', e => {
    if (!e.target.matches('input[data-id]')) return;
    const it = Store.get('items', e.target.dataset.id), v = e.target.value.trim();
    if (it && v && v !== it.name) Store.patch('items', it.id, { name: v.slice(0, 60) }); else if (it) e.target.value = it.name;
  });
  const addItem = () => {
    const v = $('malaNew').value.trim(), l = cur(); if (!v || !l) return;
    const max = Math.max(-1, ...items(l).map(i => i.order ?? 0));
    $('malaNew').value = '';
    Store.put('items', { id: uid(), listId: l.id, name: v.slice(0, 60), done: false, order: max + 1 });
    $('malaNew').focus();
  };
  $('malaAddBtn').onclick = addItem;
  $('malaNew').addEventListener('keydown', e => e.key === 'Enter' && addItem());
  $('malaEdit').onclick = () => { if (!editing && !Lock.ask(() => { editing = true; render(); })) return; document.activeElement?.blur(); editing = !editing; render(); };
  $('malaReset').onclick = async () => {
    const l = cur(); if (!(await ask(`Todos os itens de "${l.name}" voltam a ficar desmarcados para a próxima saída.`, { title: 'Resetar a mala?', icon: ph('backpack'), ok: 'Resetar mala' }))) return;
    Store.patchMany(items(l).filter(i => i.done).map(i => ['items', i.id, { done: false, doneBy: '', doneAt: 0 }]));
  };

  function listsHtml() {
    const c = cur();
    return '<h2>Listas</h2>' + lists().map(l => {
      const its = items(l), d = its.filter(i => i.done).length;
      return `<div class="lrow">
        <button class="pick${c && l.id === c.id ? ' cur' : ''}" data-pick="${l.id}"><span>${esc(l.name)}</span><span style="color:var(--muted);font-size:15px">${d}/${its.length}</span></button>
        <button class="ibtn eo" data-ren="${l.id}" aria-label="Renomear ${esc(l.name)}">${ICON.pen}</button>
        <button class="ibtn d eo" data-rm="${l.id}" aria-label="Apagar ${esc(l.name)}">${ICON.trash}</button></div>`;
    }).join('') + '<button class="new eo" data-newlist>+ Nova lista</button>';
  }
  async function onLists(e) {
    const t = a => e.target.closest(`[data-${a}]`);
    if (t('pick')) { lsSet('cuidados:curList', t('pick').dataset.pick); editing = false; render(); Sheet.close(); }
    else if (t('ren')) {
      const l = Store.get('lists', t('ren').dataset.ren), n = await askText('Renomear lista', { value: l.name, icon: ph('backpack') });
      if (n && n.trim()) { Store.put('lists', { ...l, name: n.trim() }); $('sheet').innerHTML = listsHtml(); }
    } else if (t('rm')) {
      if (lists().length === 1) return say('Mantenha pelo menos uma lista.', { title: 'Não dá para apagar', icon: ph('backpack') });
      const l = Store.get('lists', t('rm').dataset.rm);
      if (!(await ask(`A lista "${l.name}" e todos os itens dela serão apagados.`, { title: 'Apagar lista?', danger: true, ok: 'Apagar' }))) return;
      Store.delMany([['lists', l.id], ...items(l).map(i => ['items', i.id])]);
      $('sheet').innerHTML = listsHtml();
    } else if (t('newlist')) {
      const n = await askText('Nova lista', { placeholder: 'Ex.: Passeio rápido, Consulta médica', icon: ph('backpack'), ok: 'Criar', required: 'Dê um nome para a lista.' });
      if (!n || !n.trim()) return;
      const base = cur(), copy = base && (await choose(`Como quer começar a lista "${n.trim()}"?`, [{ label: `Copiar itens de "${base.name}"`, value: true }, { label: 'Começar vazia', value: false }], { title: 'Itens da lista', icon: ph('backpack') }));
      if (copy === null) return;
      const l = { id: uid(), name: n.trim(), order: Math.max(-1, ...lists().map(x => x.order ?? 0)) + 1 };
      Store.put('lists', l);
      if (copy) Store.putMany('items', items(base).map((i, k) => ({ id: uid() + k, listId: l.id, name: i.name, done: false, order: k })));
      lsSet('cuidados:curList', l.id); editing = !copy; render(); Sheet.close();
    }
  }
  $('openLists').onclick = () => Sheet.open(listsHtml(), onLists);
  $('malaBanner').addEventListener('click', e => {
    const b = e.target.closest('[data-golist]');
    if (b && b.dataset.golist) { lsSet('cuidados:curList', b.dataset.golist); editing = false; render(); }
  });
  const select = id => { lsSet('cuidados:curList', id); editing = false; render(); };
  return { render, lists, select, cur, items };
})();
