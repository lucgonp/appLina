'use strict';
/* ---------- Telefone dentro de texto livre ----------
   Transforma número escrito num Aviso em link de ligar.

   Reconhecimento DE PROPÓSITO conservador: exige (DD), hífen ou 0800.
   Número sem link é chateação; "180 ml" ou "6-8 gotas" virando telefone é
   defeito. Na dúvida, não linka.

   Entra texto JÁ escapado (esc()) e sai HTML. Nunca receber texto cru:
   o que o usuário digita não pode chegar na tela como marcação.          */
const Telefone = (() => {
  // ordem importa: do mais específico para o mais genérico
  const padroes = [
    String.raw`\b0800[-.\s]?\d{3}[-.\s]?\d{4}\b`,       // 0800 722 6001
    String.raw`\(\d{2}\)\s?\d{4,5}[-.\s]?\d{4}\b`,      // (62) 99999-0000
    String.raw`\b\d{2}\s?\d{4,5}-\d{4}\b`,              // 62 99999-0000
    String.raw`\b\d{4,5}-\d{4}\b`,                      // 99999-0000
  ].join('|');

  const so = s => s.replace(/\D/g, '');

  function href(trecho) {
    const d = so(trecho);
    // 0800 e afins são nacionais e não levam DDI
    if (d.startsWith('0800') || d.startsWith('0300')) return 'tel:' + d;
    // com DDD: manda completo, para funcionar com o celular em roaming
    if (d.length === 10 || d.length === 11) return 'tel:+55' + d;
    return 'tel:' + d;
  }

  // texto escapado -> HTML com os telefones viráveis em link
  function linkify(escapado) {
    return String(escapado ?? '').replace(new RegExp(padroes, 'g'),
      m => `<a class="tel" href="${href(m)}">${m}</a>`);
  }

  return { linkify, href };
})();

if (typeof module !== 'undefined') module.exports = Telefone;
