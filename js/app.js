// app.js — painel principal: polling do estado, cards da tripulação e rolagem de dados.
let personagens = [];
let rolagens = [];
let combate = { ativo: false, round: 0, turno: 0, ordem: [] };
let combateStr = '';
let vantDesv = 0;       // vant/desv do rolador livre
let vdFicha = 0;        // vant/desv da rolagem por ficha
let rfCharId = null;    // personagem escolhido pelo mestre para rolar
let online = false;

const ATRIBOS = [['forca', 'Força'], ['destreza', 'Destreza'], ['constituicao', 'Constituição'], ['inteligencia', 'Inteligência'], ['sabedoria', 'Sabedoria'], ['carisma', 'Carisma']];
function sinal(n) { return (n >= 0 ? '+' : '') + n; }
function modAtrib(v) { return Math.floor((v - 10) / 2); }
function nomeAtrib(k) { const a = ATRIBOS.find(x => x[0] === k); return a ? a[1] : k; }

/* ----------------------------- inicialização ----------------------------- */
(function init() {
  try {
    const autor = localStorage.getItem('rpg_autor');
    if (autor) document.getElementById('r_autor').value = autor;
  } catch (e) {}

  if (!DB.configurado()) {
    document.getElementById('aviso-config').innerHTML =
      '<div class="aviso"><b>Firebase não configurado.</b> Verifique <code>js/config.js</code>.</div>';
    setStatus(false, 'Firebase não configurado');
    return;
  }
  setStatus(true, 'tempo real');

  DB.onAuth(function (u) {
    Identidade.setUser(u ? { email: u.email, displayName: u.displayName } : null);
    if (u) {
      const a = document.getElementById('r_autor');
      if (a && !a.value) a.value = u.displayName || u.email;
    }
    forcarIdentidade();
    render(personagens);
  });

  DB.ouvirPersonagens(function (lista) {
    Identidade.setPersonagens(lista);
    render(lista);
    setStatus(true, 'ao vivo · ' + new Date().toLocaleTimeString('pt-BR'));
  });
  DB.ouvirRolagens(function (lista) { renderFeed(lista); });
  DB.ouvirCombate(function (c) { aplicarCombate(c); });
})();

function setStatus(ok, txt) {
  online = ok;
  document.getElementById('dot').className = 'dot' + (ok ? '' : ' off');
  document.getElementById('status').textContent = txt;
}

// Os dados chegam pelos listeners do Firestore (DB.ouvir*) — sem polling.

/* ------------------------------ tripulação ------------------------------ */
function render(lista) {
  personagens = lista;
  const el = document.getElementById('lista');
  el.innerHTML = lista.length ? lista.map(card).join('') :
    '<div class="carregando">Nenhum personagem. Rode popularBaseDeDados() no Apps Script.</div>';
  renderIdentidade();
  renderRolagemFicha();
}

function card(p) {
  const pct = p.pv_max > 0 ? Math.round(p.pv_atual / p.pv_max * 100) : 0;
  const cor = pct <= 25 ? 'var(--red)' : (pct <= 50 ? 'var(--amber)' : 'var(--green)');
  const badge = p.status ? '<span class="badge">' + esc(p.status) + '</span>' : '';
  const ini = (p.iniciativa >= 0 ? '+' : '') + p.iniciativa;
  const ehVoce = Identidade.meuId() === p.id;
  const editavel = Identidade.podeEditar(p);
  const voce = ehVoce ? ' <span class="badge voce">VOCÊ</span>' : '';
  const botoes = editavel ? `
      <div class="btns">
        <button class="btn-pv menos" onclick="pv('${p.id}',-5)">−5</button>
        <button class="btn-pv menos" onclick="pv('${p.id}',-1)">−1</button>
        <button class="btn-pv mais" onclick="pv('${p.id}',1)">+1</button>
        <button class="btn-pv mais" onclick="pv('${p.id}',5)">+5</button>
      </div>` : '';
  return `
    <div class="card${ehVoce ? ' meu' : ''}">
      <div class="card-top">
        <div class="pj-cab">
          ${Brasoes.avatar(p)}
          <div>
            <div class="nome"><a href="ficha.html?id=${encodeURIComponent(p.id)}">${esc(p.nome)}</a>${voce}</div>
            <div class="classe">${esc(p.classe_nivel)} • ${esc(p.raca)}${p.jogador && p.jogador !== '—' ? ' • ' + esc(p.jogador) : ''}</div>
          </div>
        </div>
        ${badge}
      </div>
      <div class="pv-linha">
        <div class="pv-barra"><div class="pv-fill" style="width:${pct}%;background:${cor}"></div></div>
        <div class="pv-txt">${p.pv_atual} / ${p.pv_max} PV</div>
      </div>
      ${botoes}
      <div class="stats">
        <div>CA<b>${p.ca}</b></div>
        <div>Inic.<b>${ini}</b></div>
        <div>Desl.<b>${esc(p.deslocamento)}</b></div>
        <div>Perc.<b>${p.perc_passiva}</b></div>
      </div>
    </div>`;
}

/* --------------------------- identidade (login Google) --------------------------- */
function renderIdentidade() {
  const el = document.getElementById('identidade');
  if (!el) return;
  const logado = Identidade.logado();
  const mestre = Identidade.ehMestre();
  const meu = Identidade.meuId();
  const estado = logado ? ((mestre ? 'M:' : '') + (meu || 'sem')) : 'fora';
  if (el.dataset.estado === estado) return;
  el.dataset.estado = estado;

  if (!logado) {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">Entre para editar a sua ficha</span>' +
      '<button class="btn-id" onclick="entrarGoogle()">Entrar com Google</button></div>';
    return;
  }
  if (mestre) {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">⚔ <b>Mestre</b> — você edita todas as fichas ' +
      '<span class="id-mail">' + esc(Identidade.email()) + '</span></span>' +
      '<button class="btn-id sec" onclick="sairGoogle()">Sair</button></div>';
    return;
  }
  const p = Identidade.meuPersonagem();
  if (p) {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">Você é <b>' + esc(p.nome) + '</b> ' +
      '<span class="id-mail">' + esc(Identidade.email()) + '</span></span>' +
      '<button class="btn-id sec" onclick="sairGoogle()">Sair</button></div>';
  } else {
    const livres = personagens.filter(x => !x.owner_email);
    const opts = livres.map(x => '<option value="' + x.id + '">' + esc(x.nome) + '</option>').join('');
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">Logado como ' + esc(Identidade.email()) + '. Qual é o seu personagem?</span></div>' +
      '<div class="id-linha"><select id="id-sel">' + (opts || '<option value="">— nenhuma ficha livre —</option>') + '</select>' +
      '<button class="btn-id" onclick="reivindicarFicha()">É meu</button>' +
      '<button class="btn-id sec" onclick="sairGoogle()">Sair</button></div>';
  }
}

function entrarGoogle() { DB.entrar().catch(e => alert('Falha no login: [' + (e.code || '?') + '] ' + e.message)); }
function sairGoogle() { DB.sair(); }
function reivindicarFicha() {
  const sel = document.getElementById('id-sel');
  if (!sel || !sel.value) return;
  DB.reivindicar(sel.value, Identidade.email()).catch(e => alert('Não foi possível reivindicar: ' + e.message));
}
function forcarIdentidade() {
  const el = document.getElementById('identidade');
  if (el) el.dataset.estado = '';
  renderIdentidade();
  combateStr = ''; renderCombate();
}

/* ------------------------------ combate / iniciativa ------------------------------ */
function combatePadrao() { return { ativo: false, round: 0, turno: 0, ordem: [] }; }

function aplicarCombate(c) {
  combate = c || combatePadrao();
  const s = JSON.stringify(combate) + '|' + Identidade.ehMestre();
  if (s === combateStr) return; // sem mudança → não redesenha
  combateStr = s;
  renderCombate();
}

function renderCombate() {
  const el = document.getElementById('iniciativa');
  if (!el) return;
  const mestre = Identidade.ehMestre();
  const ord = combate.ordem || [];

  if (!combate.ativo || !ord.length) {
    let h = '<div class="comb-vazio">Nenhum combate em andamento.</div>';
    if (mestre) h += '<div class="comb-acoes">' +
      '<button class="btn-id" onclick="rolarIniciativaHerois()">🎲 Rolar iniciativa dos heróis</button>' +
      '<button class="btn-id sec" onclick="addInimigo()">+ Inimigo</button></div>';
    el.innerHTML = h;
    return;
  }

  const linhas = ord.map((c, i) => {
    const p = c.refId ? personagens.find(x => x.id === c.refId) : null;
    const pv = p ? ' <span class="comb-pv">' + p.pv_atual + '/' + p.pv_max + '</span>' : '';
    const atual = i === combate.turno;
    const rm = mestre ? '<button class="comb-x" onclick="removerCombatente(\'' + c.id + '\')">✕</button>' : '';
    return '<div class="comb-item' + (atual ? ' atual' : '') + '">' +
      '<span class="comb-ini">' + c.valor + '</span>' +
      '<span class="comb-nome">' + (atual ? '▸ ' : '') + esc(c.nome) + pv + '</span>' + rm + '</div>';
  }).join('');

  let ctrl = '';
  if (mestre) ctrl = '<div class="comb-acoes">' +
    '<button class="btn-id" onclick="proximoTurno()">Próximo ▸</button>' +
    '<button class="btn-id sec" onclick="addInimigo()">+ Inimigo</button>' +
    '<button class="btn-id sec" onclick="limparCombate()">Limpar</button></div>';

  el.innerHTML = '<div class="comb-cab">Rodada ' + combate.round + '</div>' + linhas + ctrl;
}

function salvarCombate(novo) {
  combate = novo;
  combateStr = '';
  aplicarCombate(novo);
  if (DB.configurado()) DB.salvarCombate(novo).catch(function () {});
}

function ordenar_(ordem, idAtual) {
  ordem = ordem.slice().sort((a, b) => b.valor - a.valor);
  let turno = 0;
  if (idAtual) { const i = ordem.findIndex(c => c.id === idAtual); if (i >= 0) turno = i; }
  return { ordem: ordem, turno: turno };
}

function rolarIniciativaHerois() {
  if (!personagens.length) return;
  const ordem = personagens.map(p => ({
    id: 'pc-' + p.id, nome: p.nome, valor: rolarUm(20) + (p.iniciativa || 0), refId: p.id
  }));
  ordem.sort((a, b) => b.valor - a.valor);
  salvarCombate({ ativo: true, round: 1, turno: 0, ordem: ordem });
}

function addInimigo() {
  const nome = prompt('Nome do inimigo:');
  if (!nome || !nome.trim()) return;
  const v = prompt('Iniciativa (número, ou vazio para rolar d20):', '');
  if (v === null) return;
  let valor = v.trim() === '' ? rolarUm(20) : parseInt(v, 10);
  if (isNaN(valor)) valor = rolarUm(20);
  const idAtual = (combate.ordem[combate.turno] || {}).id;
  const r = ordenar_(combate.ordem.concat([{ id: 'npc-' + Date.now(), nome: nome.trim(), valor: valor, refId: null }]), idAtual);
  salvarCombate({ ativo: true, round: combate.round || 1, turno: r.turno, ordem: r.ordem });
}

function removerCombatente(id) {
  const idAtual = (combate.ordem[combate.turno] || {}).id;
  const ordem = combate.ordem.filter(c => c.id !== id);
  if (!ordem.length) return limparCombate();
  let turno = ordem.findIndex(c => c.id === idAtual);
  if (turno < 0) turno = Math.min(combate.turno, ordem.length - 1);
  salvarCombate({ ativo: true, round: combate.round, turno: turno, ordem: ordem });
}

function proximoTurno() {
  if (!combate.ordem.length) return;
  let turno = combate.turno + 1, round = combate.round;
  if (turno >= combate.ordem.length) { turno = 0; round++; }
  salvarCombate({ ativo: true, round: round, turno: turno, ordem: combate.ordem });
}

function limparCombate() {
  if (!confirm('Encerrar o combate?')) return;
  salvarCombate(combatePadrao());
}

function pv(id, delta) {
  const p = personagens.find(x => x.id === id);
  if (!p) return;
  const novo = Math.max(0, Math.min(p.pv_atual + delta, p.pv_max));
  p.pv_atual = novo; render(personagens);       // otimista; o listener confirma
  DB.ajustarPV(id, novo).catch(function () {});
}

/* ------------------------------ dados ------------------------------ */
function rolarUm(faces) { return Math.floor(Math.random() * faces) + 1; }
function setVD(btn) { vantDesv = parseInt(btn.dataset.vd, 10); document.querySelectorAll('.vd-btn').forEach(b => b.classList.toggle('ativo', b === btn)); }
function ajMod(d) { const i = document.getElementById('r_mod'); i.value = (parseInt(i.value, 10) || 0) + d; }
function modTxt(m) { return m ? (m > 0 ? ' +' + m : ' −' + (-m)) : ''; }

function rolarDado(faces) {
  const mod = parseInt(get('r_mod'), 10) || 0;
  let total, detalhe, formula, natural;
  if (faces === 20 && vantDesv !== 0) {
    const a = rolarUm(20), b = rolarUm(20);
    natural = vantDesv === 1 ? Math.max(a, b) : Math.min(a, b);
    total = natural + mod;
    const rot = vantDesv === 1 ? 'vant' : 'desv';
    detalhe = 'd20 [' + a + ',' + b + '] ' + rot + '→' + natural + modTxt(mod);
    formula = 'd20 (' + rot + ')' + modTxt(mod);
  } else {
    natural = rolarUm(faces);
    total = natural + mod;
    detalhe = 'd' + faces + ' [' + natural + ']' + modTxt(mod);
    formula = 'd' + faces + modTxt(mod);
  }
  const crit = faces === 20 ? (natural === 20 ? 1 : (natural === 1 ? -1 : 0)) : 0;
  mostrarResultado(total, detalhe, crit);
  registrar(formula, detalhe, total, crit);
}

function rolarFormula() {
  const txt = get('r_formula').trim();
  if (!txt) return;
  const res = parseFormula(txt);
  if (!res) return alert('Fórmula inválida. Exemplos: 2d6+3, d20-1, 1d8+1d6+2');
  mostrarResultado(res.total, res.detalhe, 0);
  registrar(res.formula, res.detalhe, res.total, 0);
}

function parseFormula(txt) {
  txt = txt.replace(/\s+/g, '').toLowerCase();
  if (!/^[0-9d+\-]+$/.test(txt)) return null;
  const termos = txt.match(/[+\-]?[^+\-]+/g);
  if (!termos) return null;
  let total = 0; const partes = [];
  for (const t of termos) {
    const sinal = t[0] === '-' ? -1 : 1;
    const corpo = t.replace(/^[+\-]/, '');
    if (corpo.includes('d')) {
      let [qtd, faces] = corpo.split('d');
      qtd = qtd === '' ? 1 : parseInt(qtd, 10); faces = parseInt(faces, 10);
      if (!faces || !qtd || qtd > 100 || faces > 1000) return null;
      const rolls = [];
      for (let i = 0; i < qtd; i++) { const v = rolarUm(faces); rolls.push(v); total += sinal * v; }
      partes.push((sinal < 0 ? '−' : '') + qtd + 'd' + faces + ' [' + rolls.join(',') + ']');
    } else {
      const n = parseInt(corpo, 10);
      if (isNaN(n)) return null;
      total += sinal * n; partes.push((sinal < 0 ? '−' : '+') + n);
    }
  }
  return { total: total, detalhe: partes.join(' '), formula: txt };
}

function mostrarResultado(total, detalhe, crit) {
  const el = document.getElementById('resultado');
  el.textContent = total;
  el.className = 'resultado' + (crit === 1 ? ' crit' : '') + (crit === -1 ? ' fumble' : '');
  let etq = crit === 1 ? '⚔️ CRÍTICO!  ' : (crit === -1 ? '💀 FALHA!  ' : '');
  document.getElementById('resultado-det').textContent = etq + detalhe;
}

// Núcleo: grava uma rolagem (otimista no feed + Firestore). dados = {autor, formula, detalhe, total, crit, tipo, rotulo}
function logar(dados) {
  rolagens.unshift({
    timestamp: Date.now(), autor: dados.autor, formula: dados.formula, detalhe: dados.detalhe,
    total: dados.total, _crit: dados.crit || 0, tipo: dados.tipo || 'livre', rotulo: dados.rotulo || ''
  });
  renderFeed(rolagens);
  if (!DB.configurado()) return;
  DB.registrarRolagem({
    autor: dados.autor, formula: dados.formula, detalhe: dados.detalhe, total: dados.total,
    crit: dados.crit || 0, tipo: dados.tipo || 'livre', rotulo: dados.rotulo || ''
  }).catch(function () {});
}

// Rolagem livre (rolador genérico)
function registrar(formula, detalhe, total, crit) {
  const autor = get('r_autor').trim() || Identidade.nome() || 'Anônimo';
  try { localStorage.setItem('rpg_autor', autor); } catch (e) {}
  logar({ autor: autor, formula: formula, detalhe: detalhe, total: total, crit: crit, tipo: 'livre', rotulo: '' });
}

function dataHora(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const dd = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  return dd + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderFeed(lista) {
  rolagens = lista;
  const el = document.getElementById('feed-rolagens');
  let h = '';
  if (Identidade.ehMestre() && lista.length) {
    h += '<div class="feed-acoes"><button class="btn-limpar" onclick="limparHistorico()">🗑 Limpar histórico</button></div>';
  }
  if (!lista.length) {
    el.innerHTML = h + '<div class="carregando">Sem rolagens ainda.</div>';
    return;
  }
  h += lista.slice(0, 14).map(r => {
    const cls = r._crit === 1 ? ' crit' : (r._crit === -1 ? ' fumble' : '');
    const rot = r.rotulo ? '<span class="roll-rotulo">' + esc(r.rotulo) + '</span>' : '<span class="roll-f">' + esc(r.formula) + '</span>';
    return '<div class="roll"><div class="roll-tot' + cls + '">' + r.total + '</div>' +
      '<div class="roll-info"><div><b>' + esc(r.autor) + '</b> ' + rot + '</div>' +
      '<div class="roll-det">' + esc(r.detalhe) + '</div></div>' +
      '<div class="roll-h">' + dataHora(r.timestamp) + '</div></div>';
  }).join('');
  el.innerHTML = h;
}

function limparHistorico() {
  if (!Identidade.ehMestre()) return;
  if (!confirm('Apagar TODO o histórico de rolagens? Isso não dá pra desfazer.')) return;
  DB.limparRolagens().catch(function (e) { alert('Não foi possível limpar: ' + e.message); });
}

/* ------------------------ rolagem pela ficha (auto-bônus) ------------------------ */
function charAtualRoll() {
  if (Identidade.ehMestre()) return rfCharId || (personagens[0] && personagens[0].id) || null;
  return Identidade.meuId();
}
function rfTrocaChar(id) { rfCharId = id; const el = document.getElementById('rolagem-ficha'); if (el) el.dataset.estado = ''; renderRolagemFicha(); }
function setVDFicha(btn) { vdFicha = parseInt(btn.dataset.vd, 10); document.querySelectorAll('#rf-vd .vd-btn').forEach(b => b.classList.toggle('ativo', b === btn)); }

function renderRolagemFicha() {
  const el = document.getElementById('rolagem-ficha');
  if (!el) return;
  const mestre = Identidade.ehMestre();
  const charId = charAtualRoll();
  const estado = (mestre ? 'M' : '') + (charId || 'x') + ':' + personagens.length + ':' + (Identidade.logado() ? '1' : '0');
  if (el.dataset.estado === estado) return;
  el.dataset.estado = estado;

  if (!Identidade.logado()) {
    el.innerHTML = '<div class="rf-hint">Entre com Google e escolha seu personagem (na barra acima) para rolar com os bônus automáticos — perícias, salvaguardas, ataques, iniciativa.</div>';
    return;
  }
  const p = personagens.find(x => x.id === charId);
  if (!p) {
    el.innerHTML = '<div class="rf-hint">' + (mestre ? 'Nenhum personagem na base.' : 'Você ainda não reivindicou um personagem — escolha o seu na barra acima.') + '</div>';
    return;
  }
  const cabecalho = mestre
    ? '<span class="rf-quem">Rolar por:</span> <select id="rf-char" onchange="rfTrocaChar(this.value)">' +
        personagens.map(x => '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select>'
    : '<span class="rf-quem">Sua ficha: <b>' + esc(p.nome) + '</b></span>';

  el.innerHTML =
    '<div class="rf-top">' + cabecalho +
    '<div class="vd" id="rf-vd">' +
      '<button class="vd-btn ativo" data-vd="0" onclick="setVDFicha(this)">Normal</button>' +
      '<button class="vd-btn" data-vd="1" onclick="setVDFicha(this)">Vant.</button>' +
      '<button class="vd-btn" data-vd="-1" onclick="setVDFicha(this)">Desv.</button></div></div>' +
    '<div class="rf-linha"><select id="rf-opcao">' + montarOpcoesFicha(p) + '</select>' +
    '<button class="btn btn-salvar" onclick="rolarFicha()">Rolar</button></div>';
  vdFicha = 0;
}

function montarOpcoesFicha(p) {
  const f = p.ficha || {};
  let h = '<optgroup label="Combate">';
  h += '<option value="init:">Iniciativa (' + sinal(p.iniciativa || 0) + ')</option>';
  (f.ataques || []).forEach((a, i) => { if (a.bonus != null) h += '<option value="atk:' + i + '">Ataque · ' + esc(a.nome) + ' (' + sinal(a.bonus) + ')</option>'; });
  (f.ataques || []).forEach((a, i) => { if (a.dano) h += '<option value="dano:' + i + '">Dano · ' + esc(a.nome) + ' (' + esc(a.dano) + ')</option>'; });
  h += '</optgroup><optgroup label="Salvaguardas">';
  const sv = (f.salvaguardas && f.salvaguardas.bonus) || {};
  ATRIBOS.forEach(a => h += '<option value="salv:' + a[0] + '">Salv. ' + a[1] + ' (' + sinal(sv[a[0]] || 0) + ')</option>');
  h += '</optgroup><optgroup label="Testes de Atributo">';
  ATRIBOS.forEach(a => h += '<option value="atrib:' + a[0] + '">' + a[1] + ' (' + sinal(modAtrib(p[a[0]])) + ')</option>');
  h += '</optgroup><optgroup label="Perícias">';
  (f.pericias || []).forEach(pe => h += '<option value="per:' + esc(pe.nome) + '">' + esc(pe.nome) + ' (' + sinal(pe.bonus) + ')</option>');
  h += '</optgroup>';
  return h;
}

// Limpa string de dano (ex.: "1d8+3 (1m) / 1d10+3 (2m)" -> "1d8+3"; "1d8 radiante" -> "1d8")
function limparDano(s) {
  return (s || '').split('/')[0].replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^0-9d+\-]/g, '');
}

function rolarFicha() {
  const p = personagens.find(x => x.id === charAtualRoll());
  if (!p) return;
  const v = document.getElementById('rf-opcao').value;
  const i = v.indexOf(':'); const tipo = v.slice(0, i); const chave = v.slice(i + 1);
  const f = p.ficha || {};
  let bonus = 0, rotulo = '', dano = null;
  if (tipo === 'init') { bonus = p.iniciativa || 0; rotulo = 'Iniciativa'; }
  else if (tipo === 'salv') { bonus = ((f.salvaguardas && f.salvaguardas.bonus) || {})[chave] || 0; rotulo = 'Salvaguarda · ' + nomeAtrib(chave); }
  else if (tipo === 'atrib') { bonus = modAtrib(p[chave]); rotulo = 'Teste · ' + nomeAtrib(chave); }
  else if (tipo === 'per') { const pe = (f.pericias || []).find(x => x.nome === chave); bonus = pe ? pe.bonus : 0; rotulo = 'Perícia · ' + chave; }
  else if (tipo === 'atk') { const a = (f.ataques || [])[parseInt(chave, 10)]; bonus = a ? a.bonus : 0; rotulo = 'Ataque · ' + (a ? a.nome : ''); }
  else if (tipo === 'dano') { const a = (f.ataques || [])[parseInt(chave, 10)]; dano = a ? a.dano : ''; rotulo = 'Dano · ' + (a ? a.nome : ''); }

  if (dano !== null) {
    const res = parseFormula(limparDano(dano));
    if (!res) { alert('Não consegui rolar o dano "' + dano + '". Use o modo livre.'); return; }
    mostrarResultado(res.total, rotulo + ' — ' + res.detalhe, 0);
    logar({ autor: p.nome, formula: rotulo, detalhe: res.detalhe, total: res.total, crit: 0, tipo: 'dano', rotulo: rotulo });
    return;
  }
  let natural, det;
  if (vdFicha !== 0) {
    const a = rolarUm(20), b = rolarUm(20);
    natural = vdFicha === 1 ? Math.max(a, b) : Math.min(a, b);
    det = 'd20 [' + a + ',' + b + '] ' + (vdFicha === 1 ? 'vant' : 'desv') + '→' + natural + modTxt(bonus);
  } else {
    natural = rolarUm(20);
    det = 'd20 [' + natural + ']' + modTxt(bonus);
  }
  const total = natural + bonus;
  const crit = natural === 20 ? 1 : (natural === 1 ? -1 : 0);
  mostrarResultado(total, rotulo + ' — ' + det, crit);
  logar({ autor: p.nome, formula: rotulo, detalhe: det, total: total, crit: crit, tipo: tipo, rotulo: rotulo });
}

/* ------------------------------ utils ------------------------------ */
function get(id) { return document.getElementById(id).value; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
