'use strict';
/* =========================================================
   Utilidades
   ========================================================= */
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ago = ms => {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'agora há pouco';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 48) return `há ${h}h${r ? ' ' + pad(r) + 'min' : ''}`;
  return `há ${Math.floor(h / 24)} dias`;
};
const when = ts => {
  const d = new Date(ts), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return 'Hoje, ' + hhmm(d);
  if (dayKey(d) === dayKey(y)) return 'Ontem, ' + hhmm(d);
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ', ' + hhmm(d);
};
const lsGet = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const toast = msg => {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
};
const me = () => lsGet('cuidados:me', '') || '';
