'use strict';
/* =========================================================
   Módulo 3 — Pendências
   ========================================================= */
const Tasks = (() => {
  let filter = 'todo';
  function render() {
    const all = Store.all('tasks').sort((a, b) => b.created - a.created);
    const todo = all.filter(t => !t.done), done = all.filter(t => t.done);
    $('fTodo').textContent = `A fazer (${todo.length})`;
    $('fDone').textContent = `Concluídas (${done.length})`;
    $('fTodo').setAttribute('aria-selected', filter === 'todo');
    $('fDone').setAttribute('aria-selected', filter === 'done');
    const b = $('taskBadge'); b.hidden = !todo.length; b.textContent = todo.length;
    const list = filter === 'todo' ? todo : done;
    $('taskList').innerHTML = list.length ? list.map(t => `
      <li class="task${t.done ? ' done' : ''}">
        <button class="row${t.done ? ' done' : ''}" data-tog="${t.id}" aria-pressed="${t.done}">${ICON.heart}<span class="txt"><span class="name">${esc(t.text)}</span>${t.done && t.doneAt ? `<small class="by">Concluída · ${esc(byTxt(t.doneBy, t.doneAt))}</small>` : (!t.done && t.by ? `<small class="by">Adicionada por ${esc(t.by)}</small>` : '')}</span></button>
        <button class="sbtn eo" data-ed="${t.id}" aria-label="Editar">${ICON.pen}</button>
        <button class="sbtn d eo" data-rm="${t.id}" aria-label="Excluir">${ICON.trash}</button>
      </li>`).join('')
      : `<li class="empty">${filter === 'todo' ? 'Nada pendente por aqui ♡' : 'Nenhuma pendência concluída ainda.'}</li>`;
  }
  let lastAdd = { text: '', at: 0 };
  const add = () => {
    const v = $('taskNew').value.trim().slice(0, 200); if (!v) return;
    $('taskNew').value = ''; filter = 'todo';
    if (lastAdd.text === v && Date.now() - lastAdd.at < 2000) return;   // toque duplo
    lastAdd = { text: v, at: Date.now() };
    Store.put('tasks', { id: uid(), text: v, done: false, created: Date.now(), by: me() });
  };
  $('taskAddBtn').onclick = add;
  $('taskNew').addEventListener('keydown', e => e.key === 'Enter' && add());
  $('fTodo').onclick = () => { filter = 'todo'; render(); };
  $('fDone').onclick = () => { filter = 'done'; render(); };
  $('taskList').addEventListener('click', async e => {
    const t = a => e.target.closest(`[data-${a}]`);
    if (t('tog')) { const it = Store.get('tasks', t('tog').dataset.tog); const done = !it.done; Store.patch('tasks', it.id, { done, doneBy: done ? me() : '', doneAt: done ? Date.now() : 0 }); haptic(); }
    else if (t('ed')) {
      const it = Store.get('tasks', t('ed').dataset.ed), v = await askText('Editar pendência', { value: it.text, icon: ph('star') });
      if (v && v.trim()) Store.patch('tasks', it.id, { text: v.trim().slice(0, 200) });
    } else if (t('rm')) {
      const it = Store.get('tasks', t('rm').dataset.rm);
      if (await ask(`"${it.text}"`, { title: 'Excluir pendência?', danger: true, ok: 'Excluir' })) Store.del('tasks', it.id);
    }
  });
  return { render };
})();
