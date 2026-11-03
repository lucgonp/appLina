# Cuidados do Bebê

PWA para a família cuidar da bebê: **Início** (avisos e resumo do dia), **Malinha**, **Remédios** (com trava de superdosagem), **Agenda**, **Pendências** e **Família** (sincronizada entre os celulares via Firebase, plano gratuito).

## Gavetas (organização do código)

```
index.html              marcação das telas
css/app.css             visual
config.js               configuração do Firebase (pública por natureza)
sw.js                   funciona offline
js/core/                utils · files (calendário/backup) · store (dados) · cloud (Firebase)
js/ui/                  icons · dialog · haptic · sheet · lock
js/rules/dose-safety.js regra de dose — pura e testável, espelha o servidor
js/features/            inicio · mala · farmacinha · agenda · pendencias · membros · familia · avisos · resumo
js/app.js               navegação e inicialização
firestore.rules         regras do servidor
tests/unit/             regra de dose (node:test)
tests/rules/            regras do servidor no Firestore Emulator, com cenários de corrida
tests/e2e/              app inteiro num iPhone (WebKit) e Android (Chromium) simulados
```

Os scripts são carregados em ordem (`defer`) e compartilham o escopo global, sem etapa de build.

## Garantias

| Tema | Como está resolvido | Testado em |
|---|---|---|
| Race condition na dose | lote atômico + compare-and-swap (`prevDoseId`) no servidor | `tests/rules` |
| Race condition nas vagas | cada vaga é um documento que só pode ser **criado** uma vez | `tests/rules` |
| Idempotência | IDs gerados ao abrir o formulário, folha/diálogo ignoram toque duplo, dose com trava de 3 s | `tests/e2e` |
| Não confiar no usuário | papéis, formatos, tamanhos, relógio do servidor e intervalo mínimo conferidos em `firestore.rules`; dose nunca é apagada | `tests/rules` |
| UX mobile | alvos ≥ 44 px, abas com texto, voltar do celular funciona, erros dizem o que fazer, estado de sincronização visível | `tests/e2e` |

## Android e iPhone

- **Android (Chrome, Edge, Samsung Internet):** o `manifest.webmanifest` torna o app instalável. O botão **Criar ícone no celular** do Início abre a janela de instalação do próprio navegador; se ela não estiver disponível, mostra o passo a passo do menu.
- **iPhone:** o manifest não é ligado (no iOS ele fazia o ícone virar uma letra); o mesmo botão mostra o passo a passo do Safari.
- Lógica em `js/core/install.js`, testada em `tests/e2e`.

## Rodar localmente

```bash
npm ci
npm run test:unit                                  # regra de dose
npm run test:rules                                 # precisa de Java 11+
npx playwright install webkit chromium && npm run test:e2e
npm run serve                                      # abre em http://127.0.0.1:4173
```

## Publicação

O GitHub Actions (`.github/workflows/ci.yml`) roda os três níveis de teste e **só publica se tudo passar**.
Em *Settings → Pages*, a origem precisa estar em **GitHub Actions**.

As regras do servidor são publicadas à parte, no console do Firebase (*Firestore → Regras*), copiando `firestore.rules` — depois que o CI estiver verde.
