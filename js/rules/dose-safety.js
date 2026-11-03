'use strict';
/* =========================================================
   Regra de segurança de dose — funções puras, sem tela e sem banco.
   É a mesma regra que o servidor confere (firestore.rules), e é testada
   isoladamente em tests/unit/dose-safety.test.js.
   ========================================================= */
const DoseSafety = (() => {
  const HOUR = 3600000;
  const dayKeyOf = ts => { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  // padrão quando o cadastro não informa: 24h ÷ doses por dia, limitado entre 4h e 8h
  const defaultMinHours = perDay => Math.min(8, Math.max(4, Math.round(24 / Math.max(1, perDay || 1))));
  const minHours = med => (med.minH > 0 ? med.minH : defaultMinHours(med.perDay));
  const minGapMs = med => minHours(med) * HOUR;
  // valor gravado no remédio para o servidor conferir o intervalo (em minutos)
  const minGapMinutes = med => Math.round(minHours(med) * 60);

  // doses válidas (ignora as marcadas como corrigidas), da mais recente para a mais antiga
  const validDoses = (med, doses) => doses
    .filter(d => d.medId === med.id && !d.voided)
    .sort((a, b) => b.ts - a.ts);

  const todayCount = (med, doses, now = Date.now()) => {
    const k = dayKeyOf(now);
    return validDoses(med, doses).filter(d => dayKeyOf(d.ts) === k).length;
  };

  /* Diz se pode dar uma dose agora.
     { ok: true } ou { ok: false, reason: 'early' | 'complete', last, until } */
  function check(med, doses, now = Date.now()) {
    const ds = validDoses(med, doses), last = ds[0];
    if (last && now - last.ts < minGapMs(med))
      return { ok: false, reason: 'early', last, until: last.ts + minGapMs(med) };
    if (todayCount(med, doses, now) >= med.perDay)
      return { ok: false, reason: 'complete', last };
    return { ok: true, last };
  }

  return { defaultMinHours, minHours, minGapMs, minGapMinutes, validDoses, todayCount, check };
})();

if (typeof module !== 'undefined') module.exports = DoseSafety;
