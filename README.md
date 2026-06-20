# ⚓ Onze Dias Até o Céu — Painel da Tripulação

WebApp de fichas e mesa de RPG (**D&D 5e**) para sessões online narradas pelo Discord.

**No ar:** https://onze-dias-ate-o-ceu.web.app

## Arquitetura (Firebase)

```
Navegador (celular)  ◀── tempo real (onSnapshot) ──▶  Cloud Firestore (banco)
        ▲
        └── arquivos estáticos ── Firebase Hosting (HTML/CSS/JS)
```

- **Firebase Hosting** serve `index.html`, `ficha.html`, `css/`, `js/`.
- **Cloud Firestore** é o banco em **tempo real** — os listeners (`onSnapshot`) atualizam tudo na hora, sem polling.
- Segurança pelas **regras** do Firestore (hoje abertas — modelo social entre amigos).

> A versão anterior (GitHub Pages + Apps Script + Google Sheets) fica preservada na pasta `apps-script/` como backup/histórico.

## Estrutura do repositório

```
index.html            Painel: tripulação + iniciativa + dados + feed
ficha.html            Ficha completa de um personagem (?id=...)
css/style.css         Tema naval, mobile-first
js/config.js          firebaseConfig + chave do mestre
js/db.js              Camada de dados em tempo real (Firestore)
js/app.js             Lógica do painel
js/ficha.js           Renderização da ficha completa
js/identidade.js      Modelo "reivindicar personagem"
js/pwa.js             Service worker + banners (instalar/atualizar)
firebase.json         Hosting + Firestore
firestore.rules       Regras de segurança
seed-firestore.mjs    Seed dos 4 personagens (rodado 1x)
apps-script/          [legado] backend antigo (Apps Script + Sheets)
```

## Deploy (Firebase)

```
firebase deploy            # hosting + regras do Firestore
node seed-firestore.mjs    # popular o Firestore (uma única vez)
```

Publica em `https://onze-dias-ate-o-ceu.web.app`. O `js/config.js` já vem com o `firebaseConfig`.

---

## [Legado] Backend antigo (Google Sheets + Apps Script)

### 1) Backend (Google Sheets + Apps Script)
1. Crie uma planilha em **https://sheets.new**.
2. **Extensões ▸ Apps Script**.
3. Cole `apps-script/Codigo.gs` no `Código.gs`.
4. Novo arquivo de script chamado **Seed** e cole `apps-script/Seed.gs`.
5. Rode a função **`popularBaseDeDados`** uma vez (autorize quando pedir). Cria a aba **Personagens** com os 4 personagens.
6. **Implantar ▸ Nova implantação ▸ App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Copie a URL terminada em **`/exec`**.

### 2) Frontend (GitHub Pages)
1. Em `js/config.js`, cole a URL do passo anterior em `API_URL` (mantenha o `TOKEN` igual ao do `Codigo.gs`).
2. Faça commit e push.
3. No GitHub: **Settings ▸ Pages ▸ Source: Deploy from branch ▸ `main` / root**.
4. O site fica em `https://SEU_USUARIO.github.io/onze-dias-ate-o-ceu/`.

> Ao mudar o `Codigo.gs`/`Seed.gs`: **Implantar ▸ Gerenciar implantações ▸ editar ▸ Nova versão**. A URL não muda.

## Personagens já cadastrados

| Personagem | Classe | Jogador | CA | PV | Inic. |
|---|---|---|---|---|---|
| Aragorn, o Grande | Guerreiro 2 | Leandro | 17 | 20 | +2 |
| Vorn Kael | Bárbaro 2 (Berserker) | Tales Siebra | 14 | 23 | +2 |
| Raelag Rola | Paladino 2 | — | 19 | 20 | +2 |
| Dorin Forjafogo | Clérigo 2 (Forja) | — | 18 | 21 | +0 |

Cada ficha traz atributos, salvaguardas, perícias, ataques, magias, traços, equipamento, proficiências, personalidade, história e anotações.

## PWA (app instalável)

O painel é um **PWA**: dá pra instalar na tela inicial do celular e abre em tela cheia, como um app.

- **Banner "Instalar"** — aparece no Android/Chrome/Edge (evento `beforeinstallprompt`). No iPhone/Safari, mostra a instrução manual (Compartilhar ▸ Adicionar à Tela de Início).
- **Banner "Nova versão disponível"** — aparece quando há atualização publicada; tocar em **Atualizar** ativa a nova versão e recarrega.
- Arquivos: `manifest.webmanifest`, `service-worker.js`, `js/pwa.js`, `icons/`.

### ⚠️ Regra de ouro ao publicar mudanças no front

Toda vez que mudar HTML/CSS/JS, **suba o `VERSION`** no topo de `service-worker.js`
(ex.: `'v1'` → `'v2'`) antes do `git push`. É isso que faz o navegador detectar a
atualização e mostrar o banner para os jogadores. Sem bumpar a versão, o app pode
continuar servindo os arquivos do cache antigo.

> O Service Worker **não** faz cache da API (script.google.com) — só do site. Os dados continuam ao vivo.

## Segurança (honesto)

O `TOKEN` em `js/config.js` é **público** (repositório aberto), então serve apenas para evitar acesso casual/bots à API — não é segurança real. Para controle por jogador (cada um edita só a própria ficha), o próximo passo é login por conta Google no Apps Script.

## Identidade — quem edita cada ficha

Modelo **"reivindicar personagem"** (sem login, segurança social entre amigos):

- Cada jogador escolhe seu personagem 1x na barra do topo — fica salvo **só no aparelho** (localStorage).
- Os botões de PV (no painel e na ficha) só aparecem para o **dono** do personagem.
- O **mestre** digita a chave (`MESTRE_KEY` em `js/config.js`, padrão `mestre-onze`) e passa a editar **todos**.
- A API continua aberta; o controle é na interface. Para travar de verdade no servidor seria preciso PIN por ficha ou login Google (GIS) — fica como evolução futura.

## Próximos passos

- Ordem de iniciativa e turno atual.
- Webhook do Discord (dano, level up, críticos).
- Edição dos demais campos da ficha pelo app (hoje o dono edita PV; resto é só-leitura).
