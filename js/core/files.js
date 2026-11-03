'use strict';
/* ---------- arquivos: calendário (.ics) e backup ---------- */
const icsEsc = s => String(s ?? '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
const icsDT = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
function makeIcs(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cuidados do Bebe//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  events.forEach(e => {
    L.push('BEGIN:VEVENT', 'UID:' + e.uid + '@cuidados', 'DTSTAMP:' + stamp,
      'DTSTART:' + icsDT(e.start), 'DTEND:' + icsDT(e.end), 'SUMMARY:' + icsEsc(e.title));
    if (e.rrule) L.push('RRULE:' + e.rrule);
    if (e.location) L.push('LOCATION:' + icsEsc(e.location));
    if (e.desc) L.push('DESCRIPTION:' + icsEsc(e.desc));
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:' + e.alarm, 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}
function openCalendar(ics) {
  // No iPhone, abrir um arquivo .ics mostra a tela "Adicionar ao Calendário"
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
async function shareFile(name, mime, text) {
  const file = new File([text], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
