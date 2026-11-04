// Testes de ponta a ponta: o app de verdade, num celular simulado.
// Rodar: npm run test:e2e   (local: npx playwright test --project=android)
const { test, expect } = require('@playwright/test');

const count = (page, col) => page.evaluate(c => Object.keys(JSON.parse(localStorage.getItem('cuidados:v3'))[c]).length, col);
// dois cliques no mesmo instante (toque duplo)
const doubleTap = (page, sel) => page.evaluate(s => { const b = document.querySelector(s); b.click(); b.click(); }, sel);

async function start(page, role = 'papai') {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.locator(`[data-role=${role}]`).click();
  await page.locator('[data-rolesave]').click();
  await expect(page.locator('#homeTitle')).toContainText('Olá');
}
async function unlock(page, view = '#v-home') {
  await page.locator(`${view} [data-lock]`).click();
  await page.locator('#lkOk').check();
  await page.locator('[data-lkyes]').click();
}
async function addMed(page, { name = 'Paracetamol', drops = '5', perDay = '4', minH = '6' } = {}) {
  await page.locator('[data-tab=farm]').click();
  await page.locator('#medAdd').click();
  await page.locator('#fName').fill(name);
  await page.locator('#fDrops').fill(drops);
  await page.locator('#fPer').fill(perDay);
  await page.locator('#fMin').fill(minH);
  await page.locator('[data-save]').click();
}

test.beforeEach(async ({ page }) => {
  // nenhum teste pode depender de rede externa
  await page.route(/gstatic\.com|googleapis\.com/, r => r.abort());
});

test('primeira abertura: escolhe o papel e cai no Início', async ({ page }) => {
  await start(page);
  await expect(page.locator('#homeTitle')).toHaveText('Olá, Papai!');
  await expect(page.locator('nav.tabs [data-tab=home]')).toHaveAttribute('aria-selected', 'true');
});

test('malinha: contagem regressiva e "Mala Pronta para Sair!"', async ({ page }) => {
  await start(page);
  await page.locator('[data-tab=mala]').click();
  const rows = page.locator('#malaList .row');
  const total = await rows.count();
  await expect(page.locator('#bagNum')).toHaveText(String(total));
  for (let i = 0; i < total; i++) {
    await page.locator('#malaList .row:not(.done)').first().click();
    await page.waitForTimeout(460);   // a proteção de toque duplo ignora < 450ms no mesmo item
  }
  await expect(page.locator('#bagNum')).toContainText('Mala Pronta para Sair');
});

test('dose: toque duplo registra uma dose só', async ({ page }) => {
  await start(page); await unlock(page); await addMed(page);
  await doubleTap(page, '[data-dose]');
  expect(await count(page, 'doses')).toBe(1);
});

test('dose: trava de segurança mostra quem deu e há quanto tempo', async ({ page }) => {
  await start(page); await unlock(page); await addMed(page);
  await page.locator('[data-dose]').click();
  // outra pessoa pega o celular (mesmos dados, outro cuidador)
  await page.evaluate(() => localStorage.setItem('cuidados:me', JSON.stringify('Vovó Cida')));
  await page.reload();
  await page.locator('[data-tab=farm]').click();
  await page.locator('[data-dose]').click();
  await expect(page.locator('.alertbox.stop')).toBeVisible();
  await expect(page.locator('.alertbox.stop')).toContainText('Papai deu Paracetamol');
  await expect(page.locator('.alertbox.stop')).toContainText('há');
  await page.locator('[data-stop]').click();
  expect(await count(page, 'doses')).toBe(1);
});

test('dose corrigida fica guardada mas não conta', async ({ page }) => {
  await start(page); await unlock(page); await addMed(page);
  await page.locator('[data-dose]').click();
  await page.locator('.hist summary').click();
  await page.locator('[data-undo]').click();
  await page.locator('#dbox .big').click();
  await expect(page.locator('.today')).toContainText('0/4');
  expect(await count(page, 'doses')).toBe(1);
});

test('idempotência: salvar remédio duas vezes cria um só', async ({ page }) => {
  await start(page); await unlock(page);
  await page.locator('[data-tab=farm]').click();
  await page.locator('#medAdd').click();
  await page.locator('#fName').fill('Vitamina D');
  await page.locator('#fDrops').fill('2');
  await page.locator('#fPer').fill('1');
  await doubleTap(page, '[data-save]');
  expect(await count(page, 'meds')).toBe(1);
});

test('idempotência: série semanal salva duas vezes continua com 4 compromissos', async ({ page }) => {
  await start(page); await unlock(page);
  await page.locator('[data-tab=agenda]').click();
  await page.locator('#apptAdd').click();
  await page.locator('[data-q=Fisioterapia]').click();
  const d = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.locator('#aDate').fill(d);
  await page.locator('#aTime').fill('14:00');
  await page.locator('#aRep').selectOption('4');
  await doubleTap(page, '[data-save]');
  expect(await count(page, 'appts')).toBe(4);
});

test('trava de edição: bloqueado, "+ Remédio" não aparece', async ({ page }) => {
  await start(page);
  await page.locator('[data-tab=farm]').click();
  await expect(page.locator('#medAdd')).toBeHidden();
});

test('avisos aparecem no Início', async ({ page }) => {
  await start(page); await unlock(page);
  await page.locator('#homeNotes [data-nadd]').click();
  await page.locator('[data-np="0"]').click();
  await page.locator('#nText').fill('180 ml + 6 colheres');
  await page.locator('[data-save]').click();
  await expect(page.locator('#homeNotes')).toContainText('180 ml + 6 colheres');
});

test('sem conexão com a família: mostra o motivo e "Tentar de novo" (nunca tela em branco)', async ({ page }) => {
  await page.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FIREBASE_CONFIG={apiKey:"x",projectId:"demo",appId:"x",authDomain:"x"};' }));
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cuidados:family', JSON.stringify('ABCDEFGHJKMN')); localStorage.setItem('cuidados:me', JSON.stringify('Mamãe')); });
  await page.reload();
  await expect(page.locator('.statuscard')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-retry]')).toBeVisible();
});

test('gesto de voltar do celular volta para a aba anterior', async ({ page }) => {
  await start(page);
  await page.locator('[data-tab=farm]').click();
  await page.locator('[data-tab=agenda]').click();
  await page.goBack();
  await expect(page.locator('#v-farm')).toBeVisible();
});

test('diretriz de UX: botões visíveis têm pelo menos 44×44 px', async ({ page }) => {
  await start(page); await unlock(page); await addMed(page);
  const small = [];
  for (const tab of ['home', 'mala', 'farm', 'agenda', 'task']) {
    await page.locator(`[data-tab=${tab}]`).click();
    small.push(...await page.evaluate(() => [...document.querySelectorAll('main:not([hidden]) button, nav.tabs button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 43.5 || r.height < 43.5))
      .map(({ b, r }) => `${b.className || b.tagName}[${b.textContent.trim().slice(0, 20)}] ${Math.round(r.width)}×${Math.round(r.height)}`)));
  }
  expect(small, small.join('\n')).toEqual([]);
});

// ---------------- instalar o app (Android e iPhone) ----------------
test('Início tem o botão "Criar ícone no celular" quando aberto no navegador', async ({ page }) => {
  await start(page);
  await expect(page.locator('#homeInstall [data-install]')).toBeVisible();
});

test('Android: o botão abre a instalação do próprio Chrome', async ({ page }, info) => {
  test.skip(info.project.name !== 'android', 'só no Android');
  await start(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  // simula o Chrome oferecendo a instalação
  await page.evaluate(() => {
    window.__prompted = 0;
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => { window.__prompted++; };
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(ev);
  });
  await page.locator('[data-install]').click();
  expect(await page.evaluate(() => window.__prompted)).toBe(1);
});

test('Android sem oferta do navegador: mostra o passo a passo do menu ⋮', async ({ page }, info) => {
  test.skip(info.project.name !== 'android', 'só no Android');
  await start(page);
  await page.locator('[data-install]').click();
  await expect(page.locator('.steps')).toContainText('Instalar app');
});

test('iPhone: sem manifest (evita o ícone com letra) e com passo a passo do Safari', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'só no iPhone');
  await start(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await page.locator('[data-install]').click();
  await expect(page.locator('.steps')).toContainText('Adicionar à Tela de Início');
});

test('manifest válido para o Android instalar', async ({ request }) => {
  const r = await request.get('/manifest.webmanifest');
  expect(r.ok()).toBeTruthy();
  const m = await r.json();
  expect(m.display).toBe('standalone');
  const sizes = m.icons.map(i => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  for (const i of m.icons) expect((await request.get('/' + i.src)).ok()).toBeTruthy();
});

// Celular que ainda não entrou em família nenhuma: antes, a trava liberava
// edição para qualquer papel, então a Vovó abria o link e editava remédio.
test('Vovó sem família: só leitura, sem botão de editar', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.locator('[data-role=vovo_f]').click();
  await page.locator('#roleName').fill('Cida');
  await page.locator('[data-rolesave]').click();
  await expect(page.locator('#homeTitle')).toContainText('Olá');

  expect(await page.evaluate(() => Lock.canEdit())).toBe(false);
  await expect(page.locator('body')).toHaveClass(/viewer/);
  await expect(page.locator('#v-home [data-lock]')).toBeHidden();

  // recusa explícita ao tentar editar remédio, em vez de abrir o formulário
  await page.locator('[data-tab=farm]').click();
  expect(await page.evaluate(() => Lock.ask())).toBe(false);
  await expect(page.locator('.dbox')).toContainText('Só a Mamãe e o Papai');
});

test('Vovó sem família: continua marcando item da mala', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.locator('[data-role=vovo_f]').click();
  await page.locator('#roleName').fill('Cida');
  await page.locator('[data-rolesave]').click();

  await page.locator('[data-tab=mala]').click();
  const antes = await count(page, 'items');
  await page.locator('#v-mala li').first().click();
  await expect(page.locator('#malaReset')).toBeEnabled();
  expect(await count(page, 'items')).toBe(antes); // marcar não apaga nem cria item
});

// "Cuidados da ${nome}" assumia bebê menina: com nome masculino saía
// "Cuidados da Pedro". O "de" serve para qualquer nome.
test('nome do bebê no cabeçalho não assume o sexo', async ({ page }) => {
  await start(page, 'mamae');
  await page.locator('[data-tab=fam], [data-gofam]').first().click();
  await unlock(page, '#v-fam');
  await page.locator('#babyName').fill('Pedro');
  await page.locator('#babyName').blur();
  await expect(page.locator('[data-hello]').first()).toHaveText('Cuidados de Pedro ♡');
  await page.locator('#babyName').fill('');
  await page.locator('#babyName').blur();
  await expect(page.locator('[data-hello]').first()).toHaveText('Cuidados do bebê ♡');
});
