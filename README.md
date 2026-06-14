# ⚓ Onze Dias Até o Céu — Painel da Tripulação

WebApp de fichas e mesa de RPG (**D&D 5e**) para sessões online narradas pelo Discord.
Frontend estático no **GitHub Pages**, backend e banco no **Google Apps Script + Google Sheets**.

## Arquitetura

```
Navegador (celular)  ──HTTP──▶  GitHub Pages (HTML/CSS/JS estático)
        │
        └──fetch JSON──▶  Apps Script /exec (API)  ──▶  Google Sheets (banco)
```

- **GitHub Pages** serve `index.html`, `ficha.html`, `css/`, `js/`.
- **Apps Script** expõe uma API JSON (`doGet`/`doPost`) e lê/grava na planilha.
- O front busca o estado a cada 5s (polling) → sincronização "ao vivo".

## Estrutura do repositório

```
index.html            Painel: tripulação + rolador de dados + feed
ficha.html            Ficha completa de um personagem (?id=...)
css/style.css         Tema naval, mobile-first
js/config.js          URL da API + token  (PREENCHER após implantar)
js/api.js             Camada de acesso à API
js/app.js             Lógica do painel e dos dados
js/ficha.js           Renderização da ficha completa
apps-script/Codigo.gs Backend da API (cole no editor do Apps Script)
apps-script/Seed.gs   Os 4 personagens oficiais (rode 1x)
documentacao/modelo-de-dados.md  Esquema das abas
```

## Como colocar no ar

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

## Segurança (honesto)

O `TOKEN` em `js/config.js` é **público** (repositório aberto), então serve apenas para evitar acesso casual/bots à API — não é segurança real. Para controle por jogador (cada um edita só a própria ficha), o próximo passo é login por conta Google no Apps Script.

## Próximos passos

- Login por e-mail Google (permissão por jogador).
- Ordem de iniciativa e turno atual.
- Webhook do Discord (dano, level up, críticos).
- Edição da ficha completa pelo app (hoje a ficha é só-leitura; PV é editável).
