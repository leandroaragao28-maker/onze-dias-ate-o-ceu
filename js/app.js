// app.js — painel principal: polling do estado, cards da tripulação e rolagem de dados.
let personagens = [];
let rolagens = [];
let combate = { ativo: false, round: 0, turno: 0, ordem: [] };
let combateStr = '';
let vantDesv = 0;
let online = false;

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

function entrarGoogle() { DB.entrar().catch(e => alert('Falha no login: ' + e.message)); }
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

async function registrar(formula, detalhe, total, crit) {
  const autor = get('r_autor').trim() || 'Anônimo';
  try { localStorage.setItem('rpg_autor', autor); } catch (e) {}
  rolagens.unshift({ timestamp: Date.now(), autor, formula, detalhe, total, _crit: crit });
  renderFeed(rolagens);
  if (!DB.configurado()) return;
  DB.registrarRolagem({ autor: autor, formula: formula, detalhe: detalhe, total: total, crit: crit }).catch(function () {});
}

function renderFeed(lista) {
  rolagens = lista;
  const el = document.getElementById('feed-rolagens');
  if (!lista.length) { el.innerHTML = '<div class="carregando">Sem rolagens ainda.</div>'; return; }
  el.innerHTML = lista.slice(0, 12).map(r => {
    const h = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const cls = r._crit === 1 ? ' crit' : (r._crit === -1 ? ' fumble' : '');
    return '<div class="roll"><div class="roll-tot' + cls + '">' + r.total + '</div>' +
      '<div class="roll-info"><div><b>' + esc(r.autor) + '</b> <span class="roll-f">' + esc(r.formula) + '</span></div>' +
      '<div class="roll-det">' + esc(r.detalhe) + '</div></div>' +
      '<div class="roll-h">' + h + '</div></div>';
  }).join('');
}

/* ------------------------------ utils ------------------------------ */
function get(id) { return document.getElementById(id).value; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
