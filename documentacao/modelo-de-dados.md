# Modelo de dados

A planilha tem duas abas. O Apps Script lê/grava nelas e expõe via API JSON.

## Aba `Personagens` (1 linha por personagem)

Colunas estruturadas (busca/edição direta na planilha) + um campo `ficha_json` com o resto.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | texto | identificador estável (ex.: `aragorn`) |
| `ordem` | número | ordem de exibição |
| `nome` | texto | nome do personagem |
| `jogador` | texto | nome do jogador (ou `—`) |
| `classe_nivel` | texto | ex.: `Guerreiro 2` |
| `raca` | texto | |
| `tendencia` | texto | alinhamento |
| `antecedente` | texto | |
| `xp_atual` / `xp_prox` | número | experiência |
| `prof_bonus` | número | bônus de proficiência |
| `ca` | número | classe de armadura |
| `iniciativa` | número | modificador de iniciativa |
| `deslocamento` | texto | ex.: `9 m` |
| `pv_max` / `pv_atual` / `pv_temp` | número | pontos de vida |
| `dados_vida` | texto | ex.: `2d10` |
| `perc_passiva` | número | percepção passiva |
| `forca`…`carisma` | número | os 6 atributos (mod. é calculado no front) |
| `status` | texto | selo curto (ex.: `Fúria 2/2`) |
| `avatar_url` | texto | imagem (opcional) |
| `atualizado_em` | data | última alteração (feed "há Xs") |
| `ficha_json` | JSON | detalhe completo (abaixo) |

### Conteúdo de `ficha_json`

```jsonc
{
  "subtitulo": "…",
  "perfil": { "Chave": "valor" },              // opcional
  "salvaguardas": {
    "proficientes": ["forca", "constituicao"],
    "bonus": { "forca": 5, "destreza": 2, ... }
  },
  "pericias": [ { "nome": "Atletismo", "atrib": "For", "bonus": 5, "prof": true }, ... ],
  "ataques": [ { "nome": "Espada Grande", "bonus": 5, "dano": "2d6+3", "tipo": "cortante · …" } ],
  "ataques_nota": "…",
  "magias": {                                   // ou null
    "atributo": "Carisma", "cd": 12, "ataque": 4,
    "grupos": [ { "titulo": "1º Círculo", "itens": [ { "nome": "…", "desc": "…" } ] } ]
  },
  "tracos": [ { "nome": "…", "desc": "…" } ],
  "equipamento": [ "…" ],
  "proficiencias": [ "…" ],
  "personalidade": { "Ideal": "…", "Defeito": "…" },
  "historia": [ { "titulo": "…", "texto": "…" } ],
  "anotacoes": "…"
}
```

A estrutura "colunas + blob JSON" mantém a planilha legível e editável à mão para os
dados do dia a dia (PV, status, XP), enquanto preserva toda a riqueza da ficha sem
explodir o número de colunas.

## Aba `Rolagens` (log do feed)

| Coluna | Descrição |
|---|---|
| `timestamp` | data/hora da rolagem |
| `autor` | quem rolou |
| `formula` | ex.: `d20 (vant) +3` |
| `detalhe` | ex.: `d20 [17,4] vant→17 +3` |
| `total` | resultado final |

Mantém no máximo ~60 linhas (poda as mais antigas).

## API (Apps Script `/exec`)

- `GET ?acao=estado` → `{ personagens, rolagens, servidor }`
- `GET ?acao=personagens` · `GET ?acao=rolagens`
- `POST { acao: "ajustarPV", id, delta }`
- `POST { acao: "registrarRolagem", dados }`
- `POST { acao: "salvarPersonagem", dados }` · `POST { acao: "excluirPersonagem", id }`

Todas exigem `token` (igual em `config.js` e `Codigo.gs`). POST usa `Content-Type: text/plain` para evitar preflight de CORS.
