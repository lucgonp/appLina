'use strict';
/* ---------- Trava de edição (por aparelho) ----------
   Bloqueado por padrão: só ações do dia a dia (dar dose, marcar mala).
   Desbloqueio dura 10 minutos.
   Importante: isto é só conforto visual. Quem garante que avós não editam
   remédios são as regras do servidor (firestore.rules). */
const Lock = {
  KEY: 'cuidados:unlockUntil', MIN: 10,
  // na família, só Mamãe e Papai podem editar; fora dela (só este celular), qualquer um
  canEdit() { return !Store.family || Members.isParent(); },
  open() { return this.canEdit() && Date.now() < (lsGet(this.KEY, 0) || 0); },
  apply() {
    const open = this.open();
    document.body.classList.toggle('locked', !open);
    document.body.classList.toggle('viewer', !this.canEdit());
    const left = Math.max(0, Math.ceil(((lsGet(this.KEY, 0) || 0) - Date.now()) / 60000));
    document.querySelectorAll('[data-lock]').forEach(b => {
      b.innerHTML = open ? ph('lock-simple-open', 20) : ph('lock-simple', 18) + 'Editar';
      b.classList.toggle('icon', open);
      b.title = open ? `Edição liberada por mais ${left} min. Toque para travar.` : 'Desbloquear edição';
      b.setAttribute('aria-label', open ? `Edição liberada por mais ${left} minutos. Toque para travar agora.` : 'Desbloquear edição');
    });
    const bn = document.getElementById('babyName'); if (bn) bn.disabled = !open;
  },
  lock() { lsSet(this.KEY, 0); this.apply(); render(); toast('Edição travada'); },
  ask(onOk) {
    if (this.open()) { onOk && onOk(); return true; }
    if (!this.canEdit()) { say('Só a Mamãe e o Papai podem alterar remédios, listas e avisos. Dar dose e marcar a mala continuam liberados.', { title: 'Somente leitura', icon: ph('lock-simple') }); return false; }
    Sheet.open(`<h2>Desbloquear edição</h2>
      <p style="margin:-6px 0 14px;color:var(--muted);font-weight:600">Para evitar mudanças sem querer, nomes de remédios, gotas, listas e compromissos ficam travados. Dar dose e marcar a mala continuam liberados.</p>
      <label class="switch"><input type="checkbox" id="lkOk"><span>Sei que vou alterar remédios, doses ou listas</span></label>
      <div class="actions" style="margin-top:0"><button class="ghost" data-lkno>Cancelar</button><button class="big" data-lkyes disabled>Desbloquear por ${this.MIN} min</button></div>`, e => {
      if (e.target.id === 'lkOk') { document.querySelector('[data-lkyes]').disabled = !e.target.checked; haptic(); return; }
      if (e.target.closest('[data-lkno]')) return Sheet.close();
      if (e.target.closest('[data-lkyes]') && $('lkOk').checked) {
        lsSet(this.KEY, Date.now() + this.MIN * 60000);
        Sheet.close(); this.apply(); render(); toast(`Edição liberada por ${this.MIN} min`);
        onOk && onOk();
      }
    });
    return false;
  },
  guard(fn) { return (...a) => this.ask(() => fn(...a)); }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lock]'); if (!b) return;
  if (Lock.open()) Lock.lock(); else Lock.ask();
});
const byTxt = (who, ts) => [when(ts), who].filter(Boolean).join(' · ');
