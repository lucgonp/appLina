'use strict';
/* ---------- Vibração sutil ----------
   Android: navigator.vibrate. iPhone: o Safari não tem vibrate, mas tocar num
   <input switch> nativo (iOS 18+) gera o feedback tátil do sistema. */
function haptic(kind) {
  try {
    if (navigator.vibrate) { navigator.vibrate(kind === 'strong' ? [20, 60, 20] : 12); return; }
    const l = document.getElementById('haptic');
    if (l) { l.click(); if (kind === 'strong') setTimeout(() => l.click(), 120); }
  } catch {}
}
