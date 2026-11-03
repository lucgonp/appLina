'use strict';
/* =========================================================
   Membros da família — papéis com vagas limitadas
   Mamãe 1 · Papai 1 · Vovó 2 · Vovô 2 · Outro cuidador (babá, tia…) sem limite

   Cada vaga é um documento fixo: slots/mamae_1, slots/vovo_f_1, slots/vovo_f_2…
   O servidor só deixa CRIAR uma vaga que ainda não existe. Se duas avós tocarem
   em "Vovó" no mesmo segundo, só uma consegue; a outra recebe "vaga ocupada".
   slot:   { id, uid, role, takeover? }
   member: { id (= uid do celular), slot, role, name, seen }
   ========================================================= */
const ROLES = {
  mamae:  { label: 'Mamãe', max: 1, needName: false, parent: true },
  papai:  { label: 'Papai', max: 1, needName: false, parent: true },
  vovo_f: { label: 'Vovó',  max: 2, needName: true, ph: 'Ex.: Cida' },
  vovo_m: { label: 'Vovô',  max: 2, needName: true, ph: 'Ex.: João' },
  outro:  { label: 'Outro cuidador', max: 99, needName: true, ph: 'Ex.: Tia Ana, Babá Rose' }
};
const ROLE_ORDER = ['mamae', 'papai', 'vovo_f', 'vovo_m', 'outro'];

const Members = (() => {
  const myUid = () => Cloud.uid;
  const guess = n => /^mam/i.test(n) ? 'mamae' : /^pap/i.test(n) ? 'papai' : /^vovó/i.test(n) ? 'vovo_f' : /^vovô/i.test(n) ? 'vovo_m' : n ? 'outro' : '';
  const myRole = () => lsGet('cuidados:role', '') || guess(me());
  // membros válidos: têm vaga e a vaga aponta de volta para eles
  const valid = () => Store.all('members').filter(m => m.slot && Store.get('slots', m.slot)?.uid === m.id);
  const others = () => valid().filter(m => m.id !== myUid());
  const holders = role => others().filter(m => m.role === role);
  const mine = () => { const m = Store.get('members', myUid()); return m && Store.get('slots', m.slot)?.uid === myUid() ? m : null; };
  const isParent = () => { const m = mine(); return !!(m && ROLES[m.role]?.parent); };
  const slotIdsFor = role => role === 'outro' ? ['outro_' + myUid()] : Array.from({ length: ROLES[role].max }, (_, i) => `${role}_${i + 1}`);
  const freeSlot = role => slotIdsFor(role).find(id => { const s = Store.get('slots', id); return !s || s.uid === myUid(); });

  const display = (role, name) => {
    const R = ROLES[role]; if (!R) return name;
    if (!R.needName) return R.label;
    if (role === 'outro') return name;
    return `${R.label} ${name.replace(new RegExp('^' + R.label + '\\s*', 'i'), '')}`.trim();
  };
  const bareName = (role, full) => role === 'vovo_f' || role === 'vovo_m' ? full.replace(/^vov[óô]\s*/i, '') : role === 'outro' ? full : '';
  let prompted = false, seenDone = false, claiming = false, cleaned = false;
  const resetPrompt = () => { prompted = false; seenDone = false; cleaned = false; };

  function saveLocal(role, full) { lsSet('cuidados:role', role); lsSet('cuidados:me', full); }

  /* Ocupa uma vaga num lote atômico: vaga + membro (+ libera a vaga antiga).
     takeoverFrom: membro antigo quando a pessoa trocou de celular ("Sou eu"). */
  function claim(role, full, { slotId, takeoverFrom } = {}) {
    saveLocal(role, full);
    // Store.emit redesenha o app inteiro (o "render" deste módulo só desenha o cartão da Família)
    if (!Store.family) { Store.emit(); return; }
    if (claiming) return;
    const uidv = myUid(), sid = slotId || freeSlot(role);
    if (!uidv || !sid) return;
    claiming = true;
    const old = Store.get('members', uidv);
    const ops = [
      { type: 'set', c: 'slots', d: takeoverFrom ? { id: sid, uid: uidv, role, takeover: true } : { id: sid, uid: uidv, role } },
      { type: 'set', c: 'members', d: { id: uidv, slot: sid, role, name: full, seen: Date.now() } }
    ];
    if (old && old.slot && old.slot !== sid && Store.get('slots', old.slot)?.uid === uidv) ops.push({ type: 'del', c: 'slots', id: old.slot });
    if (takeoverFrom) ops.push({ type: 'del', c: 'members', id: takeoverFrom.id });
    // atualização otimista na tela
    Store.data.slots[sid] = ops[0].d; Store.data.members[uidv] = ops[1].d;
    if (takeoverFrom) delete Store.data.members[takeoverFrom.id];
    Store.emit();
    Cloud.write(ops, {
      onError: e => {
        claiming = false;
        if (e && e.code === 'permission-denied') {
          // race condition: outra pessoa pegou a vaga um instante antes
          haptic('strong');
          say(`Alguém acabou de ocupar a vaga de ${ROLES[role].label}. Escolha de novo.`, { title: 'Vaga ocupada', icon: ph('users-three') }).then(() => pick());
        } else Cloud.fail(e);
      }
    }).then(() => { setTimeout(() => { claiming = false; }, 1500); });
  }

  function pick(reason = '') {
    let role = myRole() || '';
    const inFam = !!Store.family;
    const btn = k => {
      const R = ROLES[k], used = holders(k).length, full = inFam && used >= R.max;
      const sub = !inFam || R.max > 2 ? '' : full ? 'ocupado' : R.max === 1 ? 'disponível' : `${R.max - used} de ${R.max} vaga${R.max - used > 1 ? 's' : ''}`;
      return `<button data-role="${k}" class="${full ? 'full' : ''}${k === 'outro' ? ' wide' : ''}" aria-pressed="${k === role}">${R.label}${sub ? `<small>${sub}</small>` : ''}</button>`;
    };
    const body = () => {
      const R = ROLES[role], hs = role ? holders(role) : [], full = inFam && R && hs.length >= R.max;
      const holderBtns = hs.map(h => R.parent
        ? `<button disabled><b>${esc(h.name)}</b><span>só ${role === 'mamae' ? 'o Papai' : 'a Mamãe'} pode liberar</span></button>`
        : `<button data-takeover="${h.id}"><b>${esc(h.name)}</b><span>Sou eu (troquei de celular)</span></button>`).join('');
      return `${full ? `<div class="holders"><p>${R.max === 1 ? `${R.label} já está cadastrada neste grupo` : `As ${R.max} vagas de ${R.label} já estão ocupadas`}:</p>
          ${holderBtns}
          <p style="margin:10px 0 0;font-weight:600;color:var(--muted);font-size:14px">${R.parent ? `Se você trocou de celular, peça para ${role === 'mamae' ? 'o Papai' : 'a Mamãe'} remover o celular antigo na aba Família.` : 'Se não for você, escolha outro papel.'}</p></div>` : ''}
        ${R && R.needName && !full ? `<label class="field"><span>${role === 'outro' ? 'Nome' : 'Seu nome'}</span><input id="roleName" value="${esc(role === myRole() ? bareName(role, me()) : '')}" placeholder="${R.ph}" autocomplete="off" maxlength="20"></label>` : ''}`;
    };
    const html = () => `<h2>Quem usa este celular?</h2>
      <p style="margin:-6px 0 14px;color:var(--muted);font-weight:600">${esc(reason || 'Assim todo mundo vê quem deu cada dose e quem conferiu a mala.')}</p>
      <div class="roles">${ROLE_ORDER.map(btn).join('')}</div>
      <div id="roleBody">${body()}</div>
      <p class="ferr" id="formErr"></p>
      <div class="actions" style="margin-top:0"><button class="ghost" data-skip>Agora não</button><button class="big" data-rolesave>Salvar</button></div>`;
    Sheet.open(html(), async e => {
      const rb = e.target.closest('[data-role]');
      if (rb) {
        role = rb.dataset.role;
        document.querySelectorAll('[data-role]').forEach(b => b.setAttribute('aria-pressed', b.dataset.role === role));
        $('roleBody').innerHTML = body(); $('formErr').textContent = '';
        const i = $('roleName'); if (i) setTimeout(() => i.focus(), 50);
        return;
      }
      const tk = e.target.closest('[data-takeover]');
      if (tk) {
        const h = Store.get('members', tk.dataset.takeover);
        if (!(await ask(`Este celular passa a ser "${h.name}". O celular antigo deixa de aparecer na família.`, { title: `Você é ${h.name}?`, icon: ph('user'), ok: `Sim, sou ${h.name}` }))) return;
        claim(h.role, h.name, { slotId: h.slot, takeoverFrom: h }); Sheet.close(); toast(`Bem-vindo de volta, ${h.name}!`); return;
      }
      if (e.target.closest('[data-skip]')) return Sheet.close();
      if (e.target.closest('[data-rolesave]')) {
        if (!role) return formErr('Escolha quem você é.');
        const R = ROLES[role];
        if (inFam && holders(role).length >= R.max) return formErr(R.parent ? `A vaga de ${R.label} está ocupada.` : `Não há vaga de ${R.label}. Se for você em outro celular, toque em "Sou eu".`);
        let full = R.label;
        if (R.needName) {
          const n = ($('roleName')?.value || '').trim();
          if (!n) return formErr(role === 'outro' ? 'Escreva o nome.' : `Escreva seu nome para diferenciar as ${role === 'vovo_f' ? 'avós' : 'pessoas'}.`);
          if (n.length > 20) return formErr('Nome muito longo (máximo 20 letras).');
          full = display(role, n);
        }
        if (inFam && others().some(m => m.name.toLowerCase() === full.toLowerCase())) return formErr(`Já existe "${full}" na família. Use outro nome.`);
        claim(role, full); Sheet.close(); toast(`Este celular é de: ${full}`);
      }
    });
  }

  // garante que este celular tem uma vaga (roda a cada atualização da família)
  function sync() {
    if (!Store.family || Store.status !== 'ok' || !myUid() || claiming) return;
    const m = mine();
    if (m) {
      if (m.name !== me() || m.role !== myRole()) saveLocal(m.role, m.name);
      if (!seenDone) { seenDone = true; Store.patch('members', m.id, { seen: Date.now() }); }
      if (isParent() && !cleaned) {
        cleaned = true;
        // limpa membros do formato antigo (sem vaga) e grava o intervalo mínimo que o servidor confere
        const legacy = Store.all('members').filter(x => !x.slot || Store.get('slots', x.slot)?.uid !== x.id);
        if (legacy.length) Store.delMany(legacy.map(x => ['members', x.id]));
        const meds = Store.all('meds').filter(x => x.minGapMin == null);
        if (meds.length) Store.patchMany(meds.map(x => ['meds', x.id, { minGapMin: DoseSafety.minGapMinutes(x) }]));
      }
      return;
    }
    const role = myRole(), name = me(), R = ROLES[role];
    const ok = R && name && holders(role).length < R.max && !others().some(x => x.name.toLowerCase() === name.toLowerCase());
    if (ok) claim(role, name);
    else if (!prompted) {
      prompted = true;
      const why = !name ? '' : !R ? 'Escolha seu papel na família.'
        : holders(role).length >= R.max ? `Já existe ${R.max === 1 ? R.label : `${R.max} pessoas como ${R.label}`} nesta família.`
        : `Já existe "${name}" na família. Use outro nome.`;
      setTimeout(() => pick(why), 300);
    }
  }

  function render() {
    const box = $('meCard'); if (!box) return;
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const name = me();
    const ms = valid().sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
    box.innerHTML = `<div class="me-row"><span class="av">${ph('user', 24)}</span>
        <span class="nm"><small>Este celular é de</small><b>${name ? esc(name) : 'Ninguém escolhido'}</b></span>
        <button class="pill" data-pickrole>${name ? 'Trocar' : 'Escolher'}</button></div>
      ${Store.family && ms.length ? `<ul class="mlist">${ms.map(m => `<li>
          <span class="rl">${esc((ROLES[m.role] || ROLES.outro).label.split(' ')[0])}</span>
          <span class="mn">${esc(m.name)}${m.id === myUid() ? ' (este celular)' : ''}<small>${m.seen ? 'Usou o app ' + ago(Date.now() - m.seen) : ''}</small></span>
          ${m.id === myUid() ? '' : `<button class="sbtn d eo" data-rmmember="${m.id}" aria-label="Remover ${esc(m.name)}">${ICON.trash}</button>`}
        </li>`).join('')}</ul>
        <p style="margin:10px 0 0">Vagas: 1 Mamãe, 1 Papai, 2 Vovós e 2 Vovôs. Remova quem trocou de celular para liberar a vaga.</p>` : ''}`;
  }
  document.addEventListener('click', async e => {
    if (e.target.closest('[data-pickrole]')) return pick();
    const rm = e.target.closest('[data-rmmember]');
    if (rm) {
      const m = Store.get('members', rm.dataset.rmmember);
      if (m && Lock.ask() && (await ask(`A vaga de ${(ROLES[m.role] || ROLES.outro).label} fica livre. Se ${m.name} abrir o app de novo, vai precisar escolher o papel outra vez.`, { title: `Remover ${m.name}?`, danger: true, ok: 'Remover' })))
        Store.delMany([['members', m.id], ['slots', m.slot]]);
    }
  });
  return { pick, sync, render, myRole, isParent, resetPrompt, claim };
})();
