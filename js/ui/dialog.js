'use strict';
/* ---------- Diálogos no visual do app ----------
   ask()     → confirmação (true/false)
   askText() → texto digitado (ou null)
   say()     → aviso simples
   choose()  → várias opções (retorna o valor escolhido ou null) */
const Dialog = {
  open({ icon = ph('heart'), title = '', msg = '', input = null, buttons = [], danger = false }) {
    return new Promise(resolve => {
      const dlg = document.getElementById('dlg'), box = document.getElementById('dbox');
      box.className = 'dbox' + (danger ? ' danger' : '');
      box.innerHTML = `<div class="dico">${icon}</div>${title ? `<h3>${esc(title)}</h3>` : ''}${msg ? `<p>${esc(msg)}</p>` : ''}
        ${input ? `<label class="field"><input id="dlgIn" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}" autocomplete="off" maxlength="60"></label><p class="ferr" id="dlgErr"></p>` : ''}
        <div class="dbtns">${buttons.map((b, i) => `<button class="${b.primary ? 'big' : 'ghost'}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`;
      let settled = false;   // idempotência: um toque duplo não responde duas vezes
      const done = v => { if (settled) return; settled = true; dlg.classList.remove('open'); dlg.onclick = null; resolve(v); };
      dlg.onclick = e => {
        if (e.target === dlg) { const c = buttons.find(b => b.cancel); if (c) done(c.value); return; }
        const b = e.target.closest('[data-i]'); if (!b) return;
        const btn = buttons[+b.dataset.i];
        if (input && btn.primary) {
          const v = document.getElementById('dlgIn').value.trim();
          if (!v) { document.getElementById('dlgErr').textContent = input.required || 'Escreva algo para continuar.'; haptic(); return; }
          return done(v);
        }
        done(btn.value);
      };
      dlg.classList.add('open');
      if (input) setTimeout(() => { const i = document.getElementById('dlgIn'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
        i.onkeydown = ev => { if (ev.key === 'Enter') box.querySelector('.big').click(); }; }, 80);
    });
  }
};
const ask = (msg, o = {}) => Dialog.open({ icon: o.icon || (o.danger ? ph('warning') : ph('heart')), title: o.title || 'Confirmar', msg, danger: o.danger,
  buttons: [{ label: o.ok || 'Confirmar', value: true, primary: true }, { label: o.cancel || 'Cancelar', value: false, cancel: true }] });
const askText = (title, o = {}) => Dialog.open({ icon: o.icon || ph('pencil-simple'), title, msg: o.msg || '', input: { value: o.value, placeholder: o.placeholder, required: o.required },
  buttons: [{ label: o.ok || 'Salvar', primary: true }, { label: 'Cancelar', value: null, cancel: true }] });
const say = (msg, o = {}) => Dialog.open({ icon: o.icon || ph('info'), title: o.title || '', msg, buttons: [{ label: o.ok || 'Entendi', value: true, primary: true, cancel: true }] });
const choose = (msg, options, o = {}) => Dialog.open({ icon: o.icon || ph('heart'), title: o.title || '', msg,
  buttons: [...options.map((x, i) => ({ label: x.label, value: x.value, primary: i === 0 })), { label: 'Cancelar', value: null, cancel: true }] });
const formErr = msg => { const el = document.getElementById('formErr'); if (el) { el.textContent = msg; haptic(); } };
