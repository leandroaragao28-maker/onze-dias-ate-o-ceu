# Rolagens — plano das Fases C e D (a implementar)

Contexto: Fases A+B já feitas (seção "Rolagem da Ficha" com auto-bônus, tipo/rótulo no
histórico, data/hora, botão limpar do mestre). Stack: Firebase Hosting + Firestore
(tempo real), login Google + `owner_email`. Mestre = `CONFIG.MESTRE_EMAILS` e função
`mestre()` em `firestore.rules`. Termo padronizado: **Teste de Resistência** (não "salvaguarda").

Arquivos-chave: `js/app.js` (render/roll/identidade/combate), `js/db.js` (Firestore),
`js/ficha.js`, `firestore.rules`. **Sempre bumpar `VERSION` no `service-worker.js`** a cada deploy.

---

## FASE C — Pedido de rolagem do mestre

Fluxo: mestre narra e pede uma rolagem (tipo + atributo/perícia + CD + alvos) → chega ao
vivo nos jogadores-alvo → cada um toca "Rolar" → o app usa o bônus do personagem dele →
resultado + passou/falhou (vs CD) → entra no histórico; o mestre vê quem já respondeu.

### Modelo de dados (sem complicar as regras)
- **Doc `estado/pedido`** (igual ao `estado/combate`), escrito SÓ pelo mestre:
  ```
  { ativo, pedidoId, tipo, chave, rotulo, cd (num|null),
    alvos: ['todos'] | [charId...], criadoEm }
  ```
  - `tipo`: 'pericia' | 'salv' | 'atrib' | 'iniciativa' | 'ataque' (reusa a lógica de `rolarFicha`).
  - `chave`: nome da perícia, ou atributo ('destreza'), ou índice do ataque.
  - `pedidoId`: id único do pedido (ex.: timestamp em ms, passado via args — `Date.now()` é proibido em workflow JS, mas no app normal pode).
- **Respostas vão para a coleção `rolagens`** (create já é aberto) com campos extras:
  `{ ...rolagem normal, pedidoId, charId, sucesso (bool|null) }`.
  → Assim NÃO precisa de regra nova nem de update parcial de map (que é chato no Firestore).

### Regras (firestore.rules)
- `estado/{id}` write já é só `mestre()` → cobre `estado/pedido`. OK, nada a mudar.
- `rolagens` create já é aberto → respostas dos jogadores entram sem regra nova. OK.

### db.js (novas funções)
- `salvarPedido(obj)` → `db.collection('estado').doc('pedido').set(obj)`.
- `ouvirPedido(cb)` → `onSnapshot('estado/pedido')`.
- (respostas usam o `registrarRolagem` já existente, passando pedidoId/charId/sucesso.)
- `ouvirRolagens` já existe; para o painel do mestre, filtrar no cliente por `pedidoId`.

### app.js (UI)
- **Mestre — criar pedido** (form, só aparece p/ `Identidade.ehMestre()`): selects de
  tipo + atributo/perícia (pode reusar `montarOpcoesFicha` adaptado ou um select genérico de
  atributos/perícias), campo CD opcional, alvos (checkbox "todos" + lista de personagens),
  botão "Pedir rolagem". Gera `pedidoId` (Date.now), grava `estado/pedido` (ativo:true).
- **Jogador — responder**: se `pedido.ativo` e o personagem dele está em `alvos` (ou 'todos'),
  mostrar bloco destacado "🎲 O mestre pediu: {rotulo} {CD X}" + botão **Rolar**. Ao tocar:
  computar `d20 + bônus` do personagem (mesma lógica de `rolarFicha`), `sucesso = cd!=null ? total>=cd : null`,
  e gravar via `registrarRolagem({..., pedidoId, charId, sucesso, tipo, rotulo})`. Depois mostrar
  "você rolou: X — passou/falhou".
- **Mestre — acompanhamento**: lista de `alvos` com ✅ quem já respondeu (cruzar `rolagens`
  por `pedidoId`+`charId`) e ⏳ pendentes, mostrando os totais. Botão **Encerrar** → `ativo:false`.
- Render reativo: `ouvirPedido` → `renderPedido()` (com guarda de estado anti-flicker, igual aos outros).
- O feed pode marcar respostas de pedido com um selo (ex.: rótulo já traz "Resist. · Destreza" + "vs CD 15: passou").

### O que pode dar errado / pré-requisitos
- Auto-bônus exige jogador **logado + ficha reivindicada** (login Google). Quem não logou:
  o mestre rola por ele (seletor do mestre) ou ele usa o modo livre.
- 1 pedido ativo por vez (como o combate) pra simplificar.
- Sucesso/falha só quando CD definido; senão "rolagem às cegas" (só o número; o mestre julga).

---

## FASE D — refinamentos (do mais fácil ao mais difícil)

1. **Crítico no dano (fácil-médio):** no item de dano da Rolagem da Ficha, um toggle
   "crítico" que **dobra os dados** da fórmula (ex.: `2d6+3` → `4d6+3`). Implementar dobrando a
   quantidade de cada termo de dado em `limparDano`/`parseFormula`.
2. **Dano versátil (fácil):** quando `dano` tem `/` (ex.: "1d8+3 (1m) / 1d10+3 (2m)"), oferecer
   as duas opções (uma mão / duas mãos) em vez de pegar só a primeira (hoje `limparDano` pega a 1ª).
3. **Resistência à Morte (médio):** controle d20 puro (sem mod): ≥10 sucesso, <10 falha,
   nat 20 = recupera 1 PV, nat 1 = 2 falhas. Rastrear 3 sucessos/3 falhas — virar estado por
   personagem (parecido com combate) ou um contador na ficha. Começar simples: só logar
   "Resistência à Morte · sucesso/falha" sem o tracking dos 3/3.
4. **Vant./desv. fixas como dica (médio):** algumas são fixas (Cota de Malha → desvantagem em
   Furtividade; Sentido de Perigo do Vorn → vantagem em Resist. de Des). Estão em TEXTO nas fichas,
   não estruturadas. Dá pra mostrar um LEMBRETE, não automatizar de verdade sem estruturar.
5. **Dano de magia (difícil):** está em texto livre nas magias. Para auto-rolar, ou estruturar um
   campo de dano nas magias-chave, ou um parser que extrai dados do texto (frágil). Recomendado:
   deixar manual por enquanto, ou estruturar só as magias de dano mais usadas.
6. **Bônus temporários (Bênção +1d4, Fúria, Inspiração):** não estruturados → entram como
   modificador/dado extra manual no rolador.

---

## Decisões já tomadas (defaults)
- Login obrigatório p/ auto-bônus; mestre rola por qualquer um; sem login = modo livre.
- Dano: parser tolerante dos textos atuais (1ª opção de versátil, ignora notas).
- Fase C e D ainda não definiram: começar pela C (pedido do mestre); CD opcional (mostra passou/falhou).
