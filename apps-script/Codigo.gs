/**
 * Onze Dias Até o Céu — API (Google Apps Script + Google Sheets)
 * Backend JSON consumido pelo front no GitHub Pages.
 *
 * Implantação: Implantar ▸ Nova implantação ▸ App da Web
 *   - Executar como: Eu
 *   - Quem pode acessar: Qualquer pessoa
 * Copie a URL /exec e coloque em js/config.js (API_URL).
 */

/* ------------------------------ CONFIG ------------------------------ */
// Token compartilhado (segurança simples — fica visível no JS público).
// Troque pela mesma string que estiver em js/config.js. Use '' para desativar.
const TOKEN = 'onze-dias';

const ABA_PERSONAGENS = 'Personagens';
const ABA_ROLAGENS = 'Rolagens';
const MAX_ROLAGENS = 60;

const COLUNAS = [
  'id', 'ordem', 'nome', 'jogador', 'classe_nivel', 'raca', 'tendencia', 'antecedente',
  'xp_atual', 'xp_prox', 'prof_bonus', 'ca', 'iniciativa', 'deslocamento',
  'pv_max', 'pv_atual', 'pv_temp', 'dados_vida', 'perc_passiva',
  'forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma',
  'status', 'avatar_url', 'atualizado_em', 'ficha_json'
];
const COLUNAS_ROLAGENS = ['timestamp', 'autor', 'formula', 'detalhe', 'total'];

/* ------------------------------ ROTEADOR ------------------------------ */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (!autorizado_(p.token)) return resposta_({ erro: 'token inválido' });
    switch (p.acao) {
      case 'estado': return resposta_(getEstado());
      case 'personagens': return resposta_(getPersonagens());
      case 'rolagens': return resposta_(getRolagens());
      default: return resposta_({ ok: true, app: 'Onze Dias Até o Céu', versao: 1 });
    }
  } catch (err) {
    return resposta_({ erro: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!autorizado_(body.token)) return resposta_({ erro: 'token inválido' });
    switch (body.acao) {
      case 'salvarPersonagem': return resposta_(salvarPersonagem(body.dados));
      case 'ajustarPV': return resposta_(ajustarPV(body.id, Number(body.delta)));
      case 'excluirPersonagem': return resposta_(excluirPersonagem(body.id));
      case 'registrarRolagem': return resposta_(registrarRolagem(body.dados));
      default: return resposta_({ erro: 'ação desconhecida: ' + body.acao });
    }
  } catch (err) {
    return resposta_({ erro: String(err) });
  }
}

function autorizado_(token) { return TOKEN === '' || token === TOKEN; }

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------ HELPERS ------------------------------ */
function num_(x) { const n = Number(x); return isNaN(n) ? 0 : n; }

function abaPersonagens_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PERSONAGENS);
  if (!aba) throw new Error('Rode popularBaseDeDados() primeiro (aba Personagens não existe).');
  return aba;
}

function abaRolagens_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(ABA_ROLAGENS);
  if (!aba) {
    aba = ss.insertSheet(ABA_ROLAGENS);
    aba.getRange(1, 1, 1, COLUNAS_ROLAGENS.length).setValues([COLUNAS_ROLAGENS]).setFontWeight('bold');
  }
  return aba;
}

/** Converte um objeto de personagem (com sub-objeto .ficha) numa linha da planilha. */
function montarLinha_(p) {
  return [
    p.id || Utilities.getUuid(), num_(p.ordem), p.nome || '', p.jogador || '',
    p.classe_nivel || '', p.raca || '', p.tendencia || '', p.antecedente || '',
    num_(p.xp_atual), num_(p.xp_prox), num_(p.prof_bonus),
    num_(p.ca), num_(p.iniciativa), p.deslocamento || '',
    num_(p.pv_max), num_(p.pv_atual), num_(p.pv_temp), p.dados_vida || '', num_(p.perc_passiva),
    num_(p.forca), num_(p.destreza), num_(p.constituicao),
    num_(p.inteligencia), num_(p.sabedoria), num_(p.carisma),
    p.status || '', p.avatar_url || '', new Date(),
    typeof p.ficha === 'string' ? p.ficha : JSON.stringify(p.ficha || {})
  ];
}

/* ------------------------------ PERSONAGENS ------------------------------ */
function getPersonagens() {
  const aba = abaPersonagens_();
  const dados = aba.getDataRange().getValues();
  const cab = dados.shift();
  return dados.filter(l => l[0] !== '').map(l => {
    const o = {};
    cab.forEach((c, i) => o[c] = l[i]);
    o.atualizado_em = o.atualizado_em ? new Date(o.atualizado_em).getTime() : null;
    try { o.ficha = JSON.parse(o.ficha_json || '{}'); } catch (e) { o.ficha = {}; }
    delete o.ficha_json;
    return o;
  }).sort((a, b) => num_(a.ordem) - num_(b.ordem));
}

function getEstado() {
  return { personagens: getPersonagens(), rolagens: getRolagens(), servidor: Date.now() };
}

/** Cria/atualiza um personagem (upsert por id). Preserva a ficha existente se não vier nova. */
function salvarPersonagem(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaPersonagens_();
    const valores = aba.getDataRange().getValues();
    const ids = valores.map(l => l[0]);
    const idx = p.id ? ids.indexOf(p.id) : -1;
    if (idx > 0 && (p.ficha === undefined || p.ficha === null)) {
      const colFicha = COLUNAS.indexOf('ficha_json');
      p.ficha = valores[idx][colFicha]; // mantém a ficha atual
    }
    const linha = montarLinha_(p);
    if (idx > 0) aba.getRange(idx + 1, 1, 1, COLUNAS.length).setValues([linha]);
    else aba.appendRow(linha);
    return getPersonagens();
  } finally {
    lock.releaseLock();
  }
}

/** Ajuste rápido de PV (+/-), entre 0 e pv_max. */
function ajustarPV(id, delta) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaPersonagens_();
    const dados = aba.getDataRange().getValues();
    const cPv = COLUNAS.indexOf('pv_atual'), cMax = COLUNAS.indexOf('pv_max'), cAt = COLUNAS.indexOf('atualizado_em');
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][0] === id) {
        let novo = Math.max(0, Math.min(num_(dados[i][cPv]) + delta, num_(dados[i][cMax])));
        aba.getRange(i + 1, cPv + 1).setValue(novo);
        aba.getRange(i + 1, cAt + 1).setValue(new Date());
        break;
      }
    }
    return getPersonagens();
  } finally {
    lock.releaseLock();
  }
}

function excluirPersonagem(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaPersonagens_();
    const dados = aba.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][0] === id) { aba.deleteRow(i + 1); break; }
    }
    return getPersonagens();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------ ROLAGENS ------------------------------ */
function getRolagens() {
  const aba = abaRolagens_();
  const dados = aba.getDataRange().getValues();
  dados.shift();
  return dados.filter(l => l[0] !== '').map(l => ({
    timestamp: l[0] ? new Date(l[0]).getTime() : null,
    autor: l[1], formula: l[2], detalhe: l[3], total: l[4]
  })).slice(-30).reverse();
}

function registrarRolagem(r) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const aba = abaRolagens_();
    aba.appendRow([new Date(), r.autor || 'Anônimo', r.formula, r.detalhe, r.total]);
    const total = aba.getLastRow() - 1;
    if (total > MAX_ROLAGENS) aba.deleteRows(2, total - MAX_ROLAGENS);
    return getRolagens();
  } finally {
    lock.releaseLock();
  }
}
