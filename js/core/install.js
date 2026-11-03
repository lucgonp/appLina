'use strict';
/* =========================================================
   Instalar o app na tela do celular (Android e iPhone)

   Android (Chrome/Edge): o navegador oferece a instalação de verdade
   (evento beforeinstallprompt). Um toque no botão abre a janela "Instalar app".
   Se o navegador não oferecer, mostramos o passo a passo do menu.
   iPhone: a Apple não deixa um site instalar sozinho; mostramos o passo a passo
   do Safari (Compartilhar → Adicionar à Tela de Início).

   O manifest só é ligado fora do iPhone: no iOS ele fazia o ícone virar uma letra.
   ========================================================= */
const Install = (() => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const iosNotSafari = isIOS && /CriOS|FxiOS|EdgiOS|GSA\//.test(ua);
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let deferred = null;   // pedido de instalação guardado pelo Android

  if (!isIOS && !document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.webmanifest';
    document.head.appendChild(l);
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; render(); });
  window.addEventListener('appinstalled', () => { deferred = null; lsSet('cuidados:installed', true); toast('App instalado! Procure o ícone na tela do celular.'); render(); });

  // o botão aparece sempre que o app está aberto no navegador (não pelo ícone)
  const shouldOffer = () => !standalone();

  function card() {
    if (!shouldOffer()) return '';
    return `<div class="install-card">
      <div class="ic-top"><span class="hi">${ph('device-mobile', 24)}</span>
        <span><b>Coloque o app na tela do celular</b><small>Abre com um toque, como os outros aplicativos, e funciona sem internet.</small></span></div>
      <button class="big" data-install>${ph('download-simple', 20)} Criar ícone no celular</button>
    </div>`;
  }

  const steps = list => `<ol class="steps">${list.map(s => `<li>${s}</li>`).join('')}</ol>`;
  function guide() {
    let title = 'Criar ícone no celular', body;
    if (iosNotSafari) {
      body = `<p>No iPhone, o ícone só pode ser criado pelo <b>Safari</b>.</p>
        ${steps(['Toque em <b>Copiar endereço</b> aqui embaixo.', 'Abra o <b>Safari</b> (a bússola azul) e cole o endereço.', 'Toque em <b>Compartilhar</b> ' + ph('export', 18) + ' e depois em <b>Adicionar à Tela de Início</b>.'])}
        <button class="big" data-copylink>Copiar endereço</button>`;
    } else if (isIOS) {
      body = steps([
        'Toque em <b>Compartilhar</b> ' + ph('export', 18) + ' na barra do Safari (embaixo ou em cima).',
        'Role a lista e toque em <b>Adicionar à Tela de Início</b>.',
        'Deixe <b>Abrir como App Web</b> ligado e toque em <b>Adicionar</b>.'
      ]);
    } else if (isSamsung) {
      body = steps(['Toque no menu <b>☰</b> (embaixo, à direita).', 'Toque em <b>Adicionar página a</b> → <b>Tela inicial</b>.', 'Confirme em <b>Adicionar</b>.']);
    } else if (isFirefox) {
      body = steps(['Toque no menu <b>⋮</b>.', 'Toque em <b>Instalar</b> ou <b>Adicionar à tela inicial</b>.', 'Confirme.']);
    } else {
      body = steps(['Toque no menu <b>⋮</b> do Chrome (no canto de cima).', 'Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).', 'Confirme em <b>Instalar</b>.']);
    }
    Sheet.open(`<h2>${title}</h2>${body}
      <p class="steps-note">Depois, abra sempre pelo ícone novo. No navegador os dados ficam separados.</p>
      <button class="ghost" data-closeguide style="margin-top:8px">Entendi</button>`, async e => {
      if (e.target.closest('[data-closeguide]')) return Sheet.close();
      if (e.target.closest('[data-copylink]')) {
        try { await navigator.clipboard.writeText(location.origin + location.pathname); toast('Endereço copiado'); }
        catch { say(location.origin + location.pathname, { title: 'Toque e segure para copiar', icon: ph('device-mobile') }); }
      }
    });
  }

  async function install() {
    if (deferred) {
      const ev = deferred; deferred = null;   // o pedido só pode ser usado uma vez
      ev.prompt();
      const { outcome } = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }));
      if (outcome !== 'accepted') toast('Tudo bem! O botão continua aqui quando quiser.');
      render();
      return;
    }
    guide();
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-install]')) install(); });

  return { card, isIOS, isAndroid, standalone, hasPrompt: () => !!deferred };
})();
