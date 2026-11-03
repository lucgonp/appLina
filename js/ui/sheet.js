'use strict';
/* =========================================================
   Sheet genérico
   ========================================================= */
const Sheet = {
  onClick: null,
  open(html, onClick) { $('sheet').innerHTML = html; this.onClick = onClick; $('scrim').classList.add('open'); },
  close() { $('scrim').classList.remove('open'); this.onClick = null; }
};
// idempotência: enquanto uma ação da folha está rodando, novos toques são ignorados
let sheetBusy = false;
$('scrim').addEventListener('click', async e => {
  if (e.target === $('scrim')) return Sheet.close();
  if (!Sheet.onClick || sheetBusy) return;
  sheetBusy = true;
  try { await Sheet.onClick(e); } finally { sheetBusy = false; }
});
