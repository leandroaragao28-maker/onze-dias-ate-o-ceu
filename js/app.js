// app.js — painel principal: polling do estado, cards da tripulação e rolagem de dados.
let personagens = [];
let rolagens = [];
let combate = { ativo: false, round: 0, turno: 0, ordem: [] };
let combateStr = '';
let vantDesv = 0;       // vant/desv do rolador (compartilhado)
let vdPed = 0;          // vant/desv ao responder pedido do mestre
let rfCharId = null;    // personagem escolhido pelo mestre para rolar
let rfPend = null;      // opção da ficha pré-carregada no rolador: {rotulo, tipo, modo:'d20'|'formula'}
let dadoSel = 20;       // dado selecionado na faixa (faces); o botão Rolar usa este
let pedido = null;      // pedido de rolagem do mestre (estado/pedido) ou null
let papelPretendido = null; // papel aguardando o login terminar (gate: 'mestre'|'jogador')
let abaAtual = 'tripulacao'; // aba ativa da navbar inferior (ver js/navbar.js)
let online = false;

// Perícias padrão D&D 5e → atributo regente (fallback quando a ficha não traz a perícia).
const PERICIAS_PADRAO = [
  ['Acrobacia', 'destreza'], ['Adestrar Animais', 'sabedoria'], ['Arcanismo', 'inteligencia'],
  ['Atletismo', 'forca'], ['Atuação', 'carisma'], ['Enganação', 'carisma'], ['Furtividade', 'destreza'],
  ['História', 'inteligencia'], ['Intimidação', 'carisma'], ['Intuição', 'sabedoria'],
  ['Investigação', 'inteligencia'], ['Medicina', 'sabedoria'], ['Natureza', 'inteligencia'],
  ['Percepção', 'sabedoria'], ['Persuasão', 'carisma'], ['Prestidigitação', 'destreza'],
  ['Religião', 'inteligencia'], ['Sobrevivência', 'sabedoria']
];
function periciaAtributo(nome) { const x = PERICIAS_PADRAO.find(function (p) { return p[0] === nome; }); return x ? x[1] : null; }

const ATRIBOS = [['forca', 'Força'], ['destreza', 'Destreza'], ['constituicao', 'Constituição'], ['inteligencia', 'Inteligência'], ['sabedoria', 'Sabedoria'], ['carisma', 'Carisma']];
function sinal(n) { return (n >= 0 ? '+' : '') + n; }
function modAtrib(v) { return Math.floor((v - 10) / 2); }
function nomeAtrib(k) { const a = ATRIBOS.find(x => x[0] === k); return a ? a[1] : k; }

/* ----------------------------- inicialização ----------------------------- */
(function init() {
  if (!DB.configurado()) {
    document.getElementById('aviso-config').innerHTML =
      '<div class="aviso"><b>Firebase não configurado.</b> Verifique <code>js/config.js</code>.</div>';
    setStatus(false, 'Firebase não configurado');
    return;
  }
  setStatus(true, 'tempo real');

  // Aba inicial vinda da ficha (ex.: index.html#rolar) — validada depois em sincronizarAbas.
  const hsh = (location.hash || '').replace(/^#/, '');
  if (hsh) abaAtual = hsh;

  DB.onAuth(function (u) {
    Identidade.setUser(u ? { email: u.email, displayName: u.displayName } : null);
    if (u) {
      const a = document.getElementById('r_autor');
      if (a && !a.value) a.value = u.displayName || u.email;
    }
    // Resolve o papel que disparou o login (vindo do gate).
    if (u && papelPretendido) {
      const pp = papelPretendido; papelPretendido = null;
      if (pp === 'mestre' && !Identidade.ehMestre()) {
        gateMsg('A conta <b>' + esc(u.email) + '</b> não é mestre. Entre como Jogador ou Visitante.');
      } else {
        Identidade.setPapel(pp);
      }
    } else if (!u) {
      papelPretendido = null;
    }
    forcarIdentidade();
    aplicarPapel();
    render(personagens);
  });

  DB.ouvirPersonagens(function (lista) {
    Identidade.setPersonagens(lista);
    render(lista);
    setStatus(true, 'ao vivo · ' + new Date().toLocaleTimeString('pt-BR'));
  });
  DB.ouvirRolagens(function (lista) { renderFeed(lista); renderPedido(); });
  DB.ouvirCombate(function (c) { aplicarCombate(c); });
  DB.ouvirPedido(function (pd) { aplicarPedido(pd); });
  aplicarPapel();
})();

function setStatus(ok, txt) {
  online = ok;
  document.getElementById('dot').className = 'dot' + (ok ? '' : ' off');
  document.getElementById('status').textContent = txt;
}

// Os dados chegam pelos listeners do Firestore (DB.ouvir*) — sem polling.

/* ------------------------- tela inicial: escolha de papel ------------------------- */
// Mostra o gate (sem papel escolhido) ou o painel no modo do papel atual.
function aplicarPapel() {
  const temPapel = !!Identidade.papel();
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = temPapel;
  document.body.classList.toggle('gate-aberto', !temPapel);
  if (!temPapel) { renderGate(); renderEscolha(); renderNav(); return; }
  // entrou no painel → re-renderiza tudo conforme o papel
  forcarIdentidade();                          // identidade + combate + pedido + rolador + abas
  renderFeed(rolagens);
  renderEscolha();
  sincronizarAbas();
}

function renderGate() {
  const cont = document.getElementById('gate-opcoes');
  if (!cont) return;
  const logado = Identidade.logado();
  const email = logado ? esc(Identidade.email()) : '';
  const ehM = Identidade.ehMestre();
  cont.innerHTML =
    gateOpt('mestre', '⚔', 'Sou o Mestre', logado ? (ehM ? 'Conduzir a sessão · ' + email : 'Requer uma conta de mestre') : 'Conduzir a sessão (entrar com Google)') +
    gateOpt('jogador', '🛡', 'Sou Jogador', logado ? ('Usar a sua ficha · ' + email) : 'Escolher seu personagem (entrar com Google)') +
    gateOpt('visitante', '👁', 'Sou Visitante', 'Só observar e rolar dados livres');
  const foot = document.getElementById('gate-foot');
  if (foot) foot.innerHTML = logado
    ? 'Logado como <b>' + email + '</b> · <button class="gate-link" onclick="sairGoogle()">trocar conta</button>'
    : '';
}
function gateOpt(p, ic, tit, sub) {
  return '<button class="gate-opt" onclick="escolherPapel(\'' + p + '\')">' +
    '<span class="gate-ic">' + ic + '</span>' +
    '<span class="gate-txt"><span class="gate-t">' + esc(tit) + '</span>' +
    '<span class="gate-s">' + esc(sub) + '</span></span></button>';
}
function gateMsg(html) { const m = document.getElementById('gate-msg'); if (m) m.innerHTML = html || ''; }

function escolherPapel(p) {
  gateMsg('');
  if (p === 'visitante') { definirPapel('visitante'); return; }
  if (!Identidade.logado()) {                 // mestre/jogador exigem login Google
    papelPretendido = p;
    gateMsg('Abrindo o login do Google…');
    DB.entrar().catch(function (e) {
      papelPretendido = null;
      gateMsg('Falha no login: [' + (e.code || '?') + '] ' + esc(e.message));
    });
    return;
  }
  if (p === 'mestre' && !Identidade.ehMestre()) {
    gateMsg('A conta <b>' + esc(Identidade.email()) + '</b> não é mestre. Entre como Jogador ou Visitante.');
    return;
  }
  definirPapel(p);
}
function definirPapel(p) { Identidade.setPapel(p); gateMsg(''); aplicarPapel(); }
function abrirGate() { Identidade.setPapel(null); papelPretendido = null; aplicarPapel(); }

/* ------------------------- navbar inferior (abas por papel) ------------------------- */
// As abas e a montagem da barra ficam em js/navbar.js (Navbar.*), compartilhado com a ficha.

// Há um pedido que merece o selo vermelho no item "Pedido"?
function pedidoPendente() {
  if (!pedido || !pedido.ativo) return false;
  if (Identidade.atuaComoMestre()) return true;                 // mestre: lembra que está aberto
  const meuId = Identidade.meuId();
  if (!meuId || alvosDoPedido(pedido).indexOf(meuId) < 0) return false;
  return !respostasDoPedido(pedido.pedidoId)[meuId];            // jogador-alvo que ainda não rolou
}

// Mostra só a seção da aba ativa; valida a aba contra o papel.
function sincronizarAbas() {
  const abas = Navbar.abasDoPapel();
  if (!abas.some(a => a.id === abaAtual)) abaAtual = 'tripulacao';
  document.querySelectorAll('.aba').forEach(function (s) { s.hidden = s.dataset.aba !== abaAtual; });
  renderNav();
}
function mostrarAba(aba) {
  abaAtual = aba;
  sincronizarAbas();
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
}

function renderNav() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  // A barra só aparece no painel (some no gate de papéis e na escolha de personagem).
  if (!Identidade.papel() || precisaEscolherPj()) {
    nav.hidden = true; document.body.classList.remove('com-nav');
    return;
  }
  nav.hidden = false; document.body.classList.add('com-nav');
  if (!Navbar.abasDoPapel().some(a => a.id === abaAtual)) abaAtual = 'tripulacao';
  nav.innerHTML = Navbar.montar({ abaAtiva: abaAtual, modo: 'painel', badge: pedidoPendente() });
}

/* ------------------------------ tripulação ------------------------------ */
function render(lista) {
  personagens = lista;
  const el = document.getElementById('lista');
  el.innerHTML = lista.length ? lista.map(card).join('') :
    '<div class="carregando">Nenhum personagem. Rode popularBaseDeDados() no Apps Script.</div>';
  renderIdentidade();
  renderRolador();
  renderPedido();
  renderAdmin();
  renderEscolha();
  renderNav();
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
  const papel = Identidade.papel();
  const logado = Identidade.logado();
  const mestre = Identidade.atuaComoMestre();
  const meu = Identidade.meuId();
  const estado = (papel || '-') + '|' + (logado ? ((mestre ? 'M:' : '') + (meu || 'sem')) : 'fora');
  if (el.dataset.estado === estado) return;
  el.dataset.estado = estado;

  // "Trocar papel" foi movido para os rodapés das telas cheias (gate de papéis e escolha
  // de personagem). No card fica só "Sair", que leva todos de volta à tela inicial.
  const sair = '<button class="btn-id sec" onclick="sairGoogle()">Sair</button>';

  if (papel === 'visitante') {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">👁 Você está como <b>Visitante</b> — observando a mesa.</span>' +
      sair + '</div>';
    return;
  }
  if (!logado) {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">Entre para ' + (papel === 'mestre' ? 'conduzir a sessão' : 'usar a sua ficha') + '</span>' +
      '<button class="btn-id" onclick="entrarGoogle()">Entrar com Google</button>' + sair + '</div>';
    return;
  }
  if (mestre) {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">⚔ <b>Mestre</b> — você edita todas as fichas ' +
      '<span class="id-mail">' + esc(Identidade.email()) + '</span></span>' + sair + '</div>';
    return;
  }
  const p = Identidade.meuPersonagem();
  if (p) {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">Você é <b>' + esc(p.nome) + '</b> ' +
      '<span class="id-mail">' + esc(Identidade.email()) + '</span></span>' + sair + '</div>';
  } else {
    el.innerHTML =
      '<div class="id-linha"><span class="id-q">Logado como ' + esc(Identidade.email()) + ' — escolha o seu personagem.</span></div>' +
      '<div class="id-linha"><button class="btn-id" onclick="renderEscolha()">Escolher personagem</button>' + sair + '</div>';
  }
}

function entrarGoogle() { DB.entrar().catch(e => alert('Falha no login: [' + (e.code || '?') + '] ' + e.message)); }
// "Sair" = volta à tela de escolha de papel (limpa o papel salvo). Logado: desloga e o
// onAuth (usuário nulo) chama aplicarPapel; visitante (sem login): mostra o gate na hora.
function sairGoogle() {
  papelPretendido = null;
  Identidade.setPapel(null);
  if (Identidade.logado()) DB.sair().catch(function () {});
  else aplicarPapel();
}

/* ------------------ tela de escolha de personagem (jogador sem ficha) ------------------ */
// Jogador logado que ainda não tem ficha vinculada precisa escolher uma.
function precisaEscolherPj() {
  return Identidade.papel() === 'jogador' && Identidade.logado() && personagens.length > 0 && !Identidade.meuPersonagem();
}

function renderEscolha() {
  const ov = document.getElementById('escolha');
  if (!ov) return;
  if (!precisaEscolherPj()) { ov.hidden = true; document.body.classList.remove('escolha-aberta'); return; }
  ov.hidden = false;
  document.body.classList.add('escolha-aberta');

  const livres = personagens.filter(x => !x.owner_email);
  const ocupadas = personagens.filter(x => x.owner_email);
  let h = livres.length
    ? livres.map(function (p) {
        return '<button class="gate-opt" onclick="escolherPersonagem(\'' + p.id + '\')">' + Brasoes.avatar(p) +
          '<span class="gate-txt"><span class="gate-t">' + esc(p.nome) + '</span>' +
          '<span class="gate-s">' + esc(p.classe_nivel) + (p.raca ? ' · ' + esc(p.raca) : '') + '</span></span></button>';
      }).join('')
    : '<div class="esc-vazio">Nenhuma ficha livre no momento. Peça ao mestre para liberar a sua, ou troque de papel.</div>';
  if (ocupadas.length) {
    h += '<div class="esc-ocup-tit">Já escolhidas</div>' + ocupadas.map(function (p) {
      return '<div class="gate-opt esc-ocupada">' + Brasoes.avatar(p) +
        '<span class="gate-txt"><span class="gate-t">' + esc(p.nome) + '</span>' +
        '<span class="gate-s">já tem dono</span></span></div>';
    }).join('');
  }
  document.getElementById('escolha-opcoes').innerHTML = h;
  const foot = document.getElementById('escolha-foot');
  if (foot) foot.innerHTML = 'Logado como <b>' + esc(Identidade.email()) + '</b><br>' +
    '<button class="gate-link" onclick="abrirGate()">trocar papel</button> · ' +
    '<button class="gate-link" onclick="sairGoogle()">sair</button>';
}

function escolherPersonagem(id) {
  const email = Identidade.email();
  if (!email) return;
  const p = personagens.find(function (x) { return x.id === id; });
  if (!p || p.owner_email) return;
  p.owner_email = email;              // otimista: some a tela na hora; o snapshot confirma
  render(personagens);
  DB.reivindicar(id, email).catch(function (e) {
    p.owner_email = '';               // reverte se as regras recusarem
    render(personagens);
    alert('Não foi possível escolher: ' + e.message);
  });
}
function forcarIdentidade() {
  const el = document.getElementById('identidade');
  if (el) el.dataset.estado = '';
  renderIdentidade();
  combateStr = ''; renderCombate();
  const pe = document.getElementById('pedido'); if (pe) pe.dataset.sig = ''; renderPedido();
  const ro = document.getElementById('rolador'); if (ro) ro.dataset.sig = ''; renderRolador();
  const ad = document.getElementById('admin'); if (ad) ad.dataset.sig = ''; renderAdmin();
  sincronizarAbas();
}

/* ------------------------ administração: vínculos personagem ↔ e-mail (só mestre) ------------------------ */
function renderAdmin() {
  const el = document.getElementById('admin');
  if (!el) return;
  // A seção Admin é uma aba só do mestre; para os demais, fica vazia (a aba nem aparece).
  if (!Identidade.atuaComoMestre()) {
    if (el.dataset.sig !== 'off') { el.dataset.sig = 'off'; el.innerHTML = ''; }
    return;
  }
  const sig = 'on|' + personagens.map(p => p.id + ':' + (p.owner_email || '')).join(',');
  if (el.dataset.sig === sig) return;     // não redesenha enquanto o mestre digita
  el.dataset.sig = sig;

  // e-mails já usados (donos atuais) + mestres → sugestões no datalist
  const emails = Array.from(new Set(
    personagens.map(p => p.owner_email).filter(Boolean).concat(CONFIG.MESTRE_EMAILS || [])
  ));
  const dl = '<datalist id="admin-emails">' + emails.map(e => '<option value="' + esc(e) + '"></option>').join('') + '</datalist>';

  const linhas = personagens.map(function (p) {
    const dono = p.owner_email || '';
    const badge = dono
      ? '<span class="adm-dono">' + esc(dono) + '</span>'
      : '<span class="adm-dono adm-livre">sem dono</span>';
    return '<div class="adm-row">' +
      '<div class="adm-nome">' + esc(p.nome) + ' <span class="adm-sub">— ' + badge + '</span></div>' +
      '<div class="adm-ctrl">' +
        '<input class="adm-input" id="adm-' + p.id + '" list="admin-emails" placeholder="e-mail do dono" value="' + esc(dono) + '" autocapitalize="off" autocomplete="off">' +
        '<button class="btn-id" onclick="salvarVinculo(\'' + p.id + '\')">Salvar</button>' +
        '<button class="btn-id sec" onclick="limparVinculo(\'' + p.id + '\')">Limpar</button>' +
      '</div></div>';
  }).join('');

  el.innerHTML =
    '<div class="adm-hint">Defina qual e-mail controla cada personagem — o dono edita a própria ficha. Você (mestre) edita todas.</div>' +
    dl + linhas;
}

function salvarVinculo(id) {
  if (!Identidade.atuaComoMestre()) return;
  const inp = document.getElementById('adm-' + id);
  if (!inp) return;
  const email = inp.value.trim().toLowerCase();
  if (email && email.indexOf('@') < 0) { alert('E-mail inválido (faltou o @). Deixe em branco para remover o vínculo.'); return; }
  const p = personagens.find(x => x.id === id);
  if (email && p) {
    const outro = personagens.find(x => x.id !== id && (x.owner_email || '').toLowerCase() === email);
    if (outro && !confirm(esc(email) + ' já controla ' + outro.nome + '. Mover o vínculo para ' + p.nome + '?')) return;
  }
  DB.definirDono(id, email).catch(function (e) { alert('Não foi possível salvar: ' + e.message); });
}

function limparVinculo(id) {
  if (!Identidade.atuaComoMestre()) return;
  const p = personagens.find(x => x.id === id);
  if (p && p.owner_email && !confirm('Remover o vínculo de ' + p.nome + ' (' + p.owner_email + ')? A ficha fica livre para ser reivindicada.')) return;
  DB.definirDono(id, '').catch(function (e) { alert('Não foi possível limpar: ' + e.message); });
}

/* ------------------------------ combate / iniciativa ------------------------------ */
function combatePadrao() { return { ativo: false, round: 0, turno: 0, ordem: [] }; }

function aplicarCombate(c) {
  combate = c || combatePadrao();
  const s = JSON.stringify(combate) + '|' + Identidade.atuaComoMestre();
  if (s === combateStr) return; // sem mudança → não redesenha
  combateStr = s;
  renderCombate();
}

function renderCombate() {
  const el = document.getElementById('iniciativa');
  if (!el) return;
  const mestre = Identidade.atuaComoMestre();
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
function setVD(btn) { vantDesv = parseInt(btn.dataset.vd, 10); btn.parentElement.querySelectorAll('.vd-btn').forEach(b => b.classList.toggle('ativo', b === btn)); }
function ajMod(d) { const i = document.getElementById('r_mod'); i.value = (parseInt(i.value, 10) || 0) + d; }

// Faixa de dados: escolher um dado (não rola; o botão Rolar executa).
function marcarDado(faces) { document.querySelectorAll('#dado-row .dado2').forEach(b => b.classList.toggle('ativo', parseInt(b.dataset.faces, 10) === faces)); }
function selecionarDado(faces) {
  dadoSel = faces; marcarDado(faces);
  const f = document.getElementById('r_formula'); if (f) f.value = '';   // dado = modo manual
  rfPend = null;
  const s = document.getElementById('rf-opcao'); if (s) s.value = 'livre:';
}
// Digitar uma fórmula manual descarta o contexto da ficha.
function aoDigitarFormula() { rfPend = null; const s = document.getElementById('rf-opcao'); if (s) s.value = 'livre:'; }
// Botão único Rolar: fórmula livre tem prioridade; senão rola o dado selecionado + modificador.
function rolar() {
  const txt = (document.getElementById('r_formula').value || '').trim();
  if (txt) { rolarFormula(); return; }
  rolarDado(dadoSel);
}
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
  // Opção da ficha pré-carregada (d20)? Então rotula a rolagem com perícia/teste/etc.
  const usaPend = rfPend && rfPend.modo === 'd20' && faces === 20;
  const tipo = usaPend ? rfPend.tipo : 'livre';
  const rotulo = usaPend ? rfPend.rotulo : '';
  mostrarResultado(total, (rotulo ? rotulo + ' — ' : '') + detalhe, crit);
  registrarRoll({ formula: rotulo || formula, detalhe: detalhe, total: total, crit: crit, tipo: tipo, rotulo: rotulo });
}

function rolarFormula() {
  const txt = get('r_formula').trim();
  if (!txt) return;
  const res = parseFormula(txt);
  if (!res) return alert('Fórmula inválida. Exemplos: 2d6+3, d20-1, 1d8+1d6+2');
  const usaPend = rfPend && rfPend.modo === 'formula';
  const tipo = usaPend ? rfPend.tipo : 'livre';
  const rotulo = usaPend ? rfPend.rotulo : '';
  mostrarResultado(res.total, (rotulo ? rotulo + ' — ' : '') + res.detalhe, 0);
  registrarRoll({ formula: rotulo || res.formula, detalhe: res.detalhe, total: res.total, crit: 0, tipo: tipo, rotulo: rotulo });
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

// Núcleo: grava uma rolagem (otimista no feed + Firestore).
// dados = {autor, formula, detalhe, total, crit, tipo, rotulo, [pedidoId, charId, sucesso]}
function logar(dados) {
  const ehPedido = !!dados.pedidoId;
  const extra = ehPedido
    ? { pedidoId: dados.pedidoId, charId: dados.charId || null, sucesso: (dados.sucesso === undefined ? null : dados.sucesso) }
    : {};
  rolagens.unshift(Object.assign({
    timestamp: Date.now(), autor: dados.autor, formula: dados.formula, detalhe: dados.detalhe,
    total: dados.total, _crit: dados.crit || 0, tipo: dados.tipo || 'livre', rotulo: dados.rotulo || ''
  }, extra));
  renderFeed(rolagens);
  if (ehPedido) renderPedido();
  if (!DB.configurado()) return;
  DB.registrarRolagem(Object.assign({
    autor: dados.autor, formula: dados.formula, detalhe: dados.detalhe, total: dados.total,
    crit: dados.crit || 0, tipo: dados.tipo || 'livre', rotulo: dados.rotulo || ''
  }, extra)).catch(function () {});
}

// Autor da rolagem conforme o papel: visitante usa o campo de nome; jogador/mestre vêm da identidade.
function autorRoll() {
  if (Identidade.atuaComoMestre()) {
    const p = personagens.find(x => x.id === charAtualRoll());
    return p ? p.nome : 'Mestre';
  }
  if (!Identidade.ehVisitante()) {
    const p = Identidade.meuPersonagem();
    if (p) return p.nome;
    if (Identidade.logado()) return Identidade.nome();
  }
  const el = document.getElementById('r_autor');
  const nome = el ? el.value.trim() : '';
  return nome || 'Visitante';
}

// Grava uma rolagem do rolador (resolve o autor e guarda o nome do visitante).
function registrarRoll(d) {
  const el = document.getElementById('r_autor');
  if (el) { try { localStorage.setItem('rpg_autor', el.value.trim()); } catch (e) {} }
  logar({ autor: autorRoll(), formula: d.formula, detalhe: d.detalhe, total: d.total, crit: d.crit || 0, tipo: d.tipo || 'livre', rotulo: d.rotulo || '' });
}

function dataHora(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const dd = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  return dd + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const DADO_FEED = '<svg class="rr-die feed-die" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 L29 9.5 L29 22.5 L16 30 L3 22.5 L3 9.5 Z"/><path d="M16 2 L16 11 M3 9.5 L16 11 L29 9.5 M16 11 L8 22.5 M16 11 L24 22.5 M3 22.5 L8 22.5 L16 30 L24 22.5 L29 22.5 M8 22.5 L16 16 L24 22.5"/></svg>';

function renderFeed(lista) {
  rolagens = lista;
  const el = document.getElementById('feed-rolagens');
  let h = '';
  if (Identidade.atuaComoMestre() && lista.length) {
    h += '<div class="feed-acoes"><button class="btn-limpar" onclick="limparHistorico()">🗑 Limpar histórico</button></div>';
  }
  if (!lista.length) {
    el.innerHTML = h + '<div class="carregando">Sem rolagens ainda.</div>';
    return;
  }
  h += lista.slice(0, 14).map(r => {
    const cls = r._crit === 1 ? ' crit' : (r._crit === -1 ? ' fumble' : '');
    const badge = r.rotulo ? '<span class="roll2-badge">' + esc(r.rotulo) + '</span>' : '';
    const det = esc(r.detalhe || r.formula || '');
    return '<div class="roll2">' +
      '<span class="roll2-die">' + DADO_FEED + '</span>' +
      '<span class="roll2-num' + cls + '">' + r.total + '</span>' +
      '<span class="roll2-mid"><span class="roll2-top"><b>' + esc(r.autor) + '</b>' + badge + '</span>' +
      '<span class="roll2-det">' + det + '</span></span>' +
      '<span class="roll2-h">' + dataHora(r.timestamp) + '</span></div>';
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
  if (Identidade.atuaComoMestre()) return rfCharId || (personagens[0] && personagens[0].id) || null;
  return Identidade.meuId();
}
function rfTrocaChar(id) { rfCharId = id; rfPend = null; const el = document.getElementById('rolador'); if (el) el.dataset.sig = ''; renderRolador(); }

// Barra "Rolar por" (contexto por papel) e o seletor "Da ficha". O vant/desv e a faixa
// de dados são estáticos no HTML do card.
function renderRolador() {
  const host = document.getElementById('rolador');
  const topo = document.getElementById('roll-topo');
  if (!host || !topo) return;
  const mestre = Identidade.atuaComoMestre();
  const visitante = Identidade.ehVisitante();
  const logado = Identidade.logado();
  const charId = charAtualRoll();
  const sig = [Identidade.papel(), mestre, visitante, logado, charId, personagens.length].join('|');
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  rfPend = null;

  // Barra "Rolar por": mestre escolhe; jogador é fixo; visitante digita o nome.
  if (mestre) {
    topo.innerHTML = '<span class="roll-ctx-l">Rolar por</span>' +
      '<select id="rf-char" class="roll-ctx-sel" onchange="rfTrocaChar(this.value)">' +
      personagens.map(x => '<option value="' + x.id + '"' + (x.id === charId ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select>';
  } else if (!visitante && logado) {
    const pj = personagens.find(x => x.id === charId);
    topo.innerHTML = '<span class="roll-ctx-l">Você rola como</span><span class="roll-ctx-nome">' + esc(pj ? pj.nome : Identidade.nome()) + '</span>';
  } else {
    topo.innerHTML = '<span class="roll-ctx-l">Quem rola</span><input id="r_autor" class="roll-ctx-input" placeholder="seu nome">';
    const inAutor = document.getElementById('r_autor');
    if (inAutor) { try { const a = localStorage.getItem('rpg_autor'); if (a) inAutor.value = a; } catch (e) {} }
  }

  // Seletor "Da ficha" (jogador com personagem / mestre): pré-carrega o rolador ao escolher.
  const fichaEl = document.getElementById('roll-ficha');
  if (fichaEl) {
    const p = personagens.find(x => x.id === charId);
    if (logado && !visitante && p) {
      fichaEl.style.display = '';
      fichaEl.innerHTML = '<div class="rr-lbl"><span class="dia"></span>Da ficha<span class="dia"></span></div>' +
        '<select id="rf-opcao" class="rr-fichasel" onchange="aplicarOpcaoFicha()">' +
        '<option value="livre:">— rolagem livre —</option>' + montarOpcoesFicha(p) + '</select>';
    } else {
      fichaEl.style.display = 'none';
      fichaEl.innerHTML = '';
    }
  }
}

// Ao escolher uma opção da ficha, pré-carrega o modificador (ou a fórmula, p/ dano) no rolador.
function aplicarOpcaoFicha() {
  const p = personagens.find(x => x.id === charAtualRoll());
  const sel = document.getElementById('rf-opcao');
  const modEl = document.getElementById('r_mod');
  const formEl = document.getElementById('r_formula');
  if (!p || !sel) return;
  const v = sel.value;
  const i = v.indexOf(':'); const tipo = v.slice(0, i); const chave = v.slice(i + 1);
  if (tipo === 'livre') {
    rfPend = null;
    if (modEl) modEl.value = 0;
    if (formEl) formEl.value = '';
    return;
  }
  const d = dadosRolagem(p, tipo, chave);
  if (tipo === 'dano') {
    if (formEl) formEl.value = limparDano(d.dano);
    if (modEl) modEl.value = 0;
    rfPend = { rotulo: d.rotulo, tipo: 'dano', modo: 'formula' };
  } else {
    if (formEl) formEl.value = '';
    if (modEl) modEl.value = d.bonus;
    dadoSel = 20; marcarDado(20);
    rfPend = { rotulo: d.rotulo, tipo: tipo, modo: 'd20' };
  }
}

function montarOpcoesFicha(p) {
  const f = p.ficha || {};
  let h = '<optgroup label="Combate">';
  h += '<option value="init:">Iniciativa (' + sinal(p.iniciativa || 0) + ')</option>';
  (f.ataques || []).forEach((a, i) => { if (a.bonus != null) h += '<option value="atk:' + i + '">Ataque · ' + esc(a.nome) + ' (' + sinal(a.bonus) + ')</option>'; });
  (f.ataques || []).forEach((a, i) => { if (a.dano) h += '<option value="dano:' + i + '">Dano · ' + esc(a.nome) + ' (' + esc(a.dano) + ')</option>'; });
  h += '</optgroup><optgroup label="Testes de Resistência">';
  const sv = (f.salvaguardas && f.salvaguardas.bonus) || {};
  ATRIBOS.forEach(a => h += '<option value="salv:' + a[0] + '">Resist. ' + a[1] + ' (' + sinal(sv[a[0]] || 0) + ')</option>');
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

// Bônus/rótulo de uma rolagem por tipo+chave, a partir da ficha do personagem.
// Reusado pela "Rolagem da Ficha" e pela resposta ao pedido do mestre.
function dadosRolagem(p, tipo, chave) {
  const f = p.ficha || {};
  if (tipo === 'init') return { bonus: p.iniciativa || 0, rotulo: 'Iniciativa' };
  if (tipo === 'salv') return { bonus: ((f.salvaguardas && f.salvaguardas.bonus) || {})[chave] || 0, rotulo: 'Resist. · ' + nomeAtrib(chave) };
  if (tipo === 'atrib') return { bonus: modAtrib(p[chave]), rotulo: 'Teste · ' + nomeAtrib(chave) };
  if (tipo === 'per') {
    const pe = (f.pericias || []).find(function (x) { return x.nome === chave; });
    const at = periciaAtributo(chave);
    return { bonus: pe ? pe.bonus : (at ? modAtrib(p[at]) : 0), rotulo: 'Perícia · ' + chave };
  }
  if (tipo === 'atk') { const a = (f.ataques || [])[parseInt(chave, 10)]; return { bonus: a ? a.bonus : 0, rotulo: 'Ataque · ' + (a ? a.nome : '') }; }
  if (tipo === 'dano') { const a = (f.ataques || [])[parseInt(chave, 10)]; return { bonus: 0, dano: a ? a.dano : '', rotulo: 'Dano · ' + (a ? a.nome : '') }; }
  return { bonus: 0, rotulo: '' };
}

// Rola 1d20 + bônus, respeitando vant/desv (vd: 0 normal, 1 vant, -1 desv).
function rolarD20(bonus, vd) {
  let natural, det;
  if (vd !== 0) {
    const a = rolarUm(20), b = rolarUm(20);
    natural = vd === 1 ? Math.max(a, b) : Math.min(a, b);
    det = 'd20 [' + a + ',' + b + '] ' + (vd === 1 ? 'vant' : 'desv') + '→' + natural + modTxt(bonus);
  } else {
    natural = rolarUm(20);
    det = 'd20 [' + natural + ']' + modTxt(bonus);
  }
  const total = natural + bonus;
  const crit = natural === 20 ? 1 : (natural === 1 ? -1 : 0);
  return { natural: natural, det: det, total: total, crit: crit };
}

/* ------------------------ pedido de rolagem do mestre (Fase C) ------------------------ */
function aplicarPedido(pd) { pedido = pd; renderPedido(); }
function setVDPed(btn) { vdPed = parseInt(btn.dataset.vd, 10); document.querySelectorAll('#ped-vd .vd-btn').forEach(b => b.classList.toggle('ativo', b === btn)); }
function pedTodos(cb) { const box = document.getElementById('ped-alvos-box'); if (box) box.style.display = cb.checked ? 'none' : ''; }

// Quais ids de personagem o pedido abrange ('todos' = toda a tripulação).
function alvosDoPedido(pd) {
  if (!pd || !pd.alvos) return [];
  if (pd.alvos.indexOf('todos') >= 0) return personagens.map(p => p.id);
  return pd.alvos.slice();
}
// Mapa charId -> rolagem mais recente que respondeu este pedido.
function respostasDoPedido(pedidoId) {
  const m = {};
  (rolagens || []).forEach(function (r) {
    if (r.pedidoId === pedidoId && r.charId && !(r.charId in m)) m[r.charId] = r;
  });
  return m;
}
function rotuloDoPedido(tipo, chave) {
  if (tipo === 'init') return 'Iniciativa';
  if (tipo === 'salv') return 'Resist. · ' + nomeAtrib(chave);
  if (tipo === 'atrib') return 'Teste · ' + nomeAtrib(chave);
  if (tipo === 'per') return 'Perícia · ' + chave;
  return chave;
}
function selSucesso(s) {
  if (s === true) return ' <span class="ped-ok">passou</span>';
  if (s === false) return ' <span class="ped-fail">falhou</span>';
  return '';
}

function renderPedido() {
  const el = document.getElementById('pedido');
  if (!el) return;
  const mestre = Identidade.atuaComoMestre();
  const ativo = !!(pedido && pedido.ativo);
  const meuId = Identidade.meuId();
  const resp = ativo ? respostasDoPedido(pedido.pedidoId) : {};
  const respKey = Object.keys(resp).sort().map(k => k + '=' + resp[k].total + '/' + resp[k].sucesso).join(',');
  const sig = JSON.stringify(pedido) + '|' + mestre + '|' + (meuId || '') + '|' + personagens.length + '|' + respKey;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;

  // A seção "Pedido" é uma aba (do jogador/mestre); sempre tem conteúdo (ou um aviso de vazio).
  let html;
  if (mestre) {
    html = ativo ? renderPedidoMestre(resp) : renderFormPedido();
  } else if (ativo && meuId && alvosDoPedido(pedido).indexOf(meuId) >= 0) {
    html = renderPedidoJogador(meuId, resp);
    vdPed = 0;
  } else {
    html = '<div class="ped-vazio">Nenhum pedido de rolagem no momento.</div>';
  }
  el.innerHTML = html;
  renderNav();   // atualiza o selo vermelho do item "Pedido"
}

// Mestre, sem pedido ativo: formulário para pedir uma rolagem.
function renderFormPedido() {
  const alvos = personagens.map(p =>
    '<label class="ped-alvo"><input type="checkbox" class="ped-alvo-cb" value="' + p.id + '"> ' + esc(p.nome) + '</label>'
  ).join('');
  return '' +
    '<div class="ped-cab">Pedir uma rolagem à tripulação</div>' +
    '<div class="rf-linha"><select id="ped-opcao">' + montarOpcoesPedido() + '</select></div>' +
    '<div class="ped-linha2">' +
      '<label class="ped-cd">CD <input id="ped-cd" type="number" min="1" inputmode="numeric" placeholder="—"></label>' +
      '<label class="ped-alvo ped-todos"><input type="checkbox" id="ped-todos" checked onchange="pedTodos(this)"> Todos</label>' +
    '</div>' +
    '<div class="ped-alvos" id="ped-alvos-box" style="display:none">' + alvos + '</div>' +
    '<div class="comb-acoes"><button class="btn-id" onclick="criarPedido()">🎲 Pedir rolagem</button></div>';
}

function montarOpcoesPedido() {
  let h = '<optgroup label="Testes de Resistência">';
  ATRIBOS.forEach(a => h += '<option value="salv:' + a[0] + '">Resist. ' + a[1] + '</option>');
  h += '</optgroup><optgroup label="Testes de Atributo">';
  ATRIBOS.forEach(a => h += '<option value="atrib:' + a[0] + '">' + a[1] + '</option>');
  h += '</optgroup><optgroup label="Perícias">';
  PERICIAS_PADRAO.forEach(pe => h += '<option value="per:' + esc(pe[0]) + '">' + esc(pe[0]) + '</option>');
  h += '</optgroup><optgroup label="Combate"><option value="init:">Iniciativa</option></optgroup>';
  return h;
}

function criarPedido() {
  if (!Identidade.ehMestre()) return;
  const v = document.getElementById('ped-opcao').value;
  const i = v.indexOf(':'); const tipo = v.slice(0, i); const chave = v.slice(i + 1);
  const cdRaw = (document.getElementById('ped-cd').value || '').trim();
  const cd = cdRaw === '' ? null : parseInt(cdRaw, 10);
  if (cd !== null && (isNaN(cd) || cd < 1)) { alert('CD inválido — deixe em branco ou use um número ≥ 1.'); return; }
  let alvos;
  if (document.getElementById('ped-todos').checked) {
    alvos = ['todos'];
  } else {
    alvos = Array.from(document.querySelectorAll('.ped-alvo-cb:checked')).map(c => c.value);
    if (!alvos.length) { alert('Escolha pelo menos um personagem (ou marque "Todos").'); return; }
  }
  const obj = {
    ativo: true, pedidoId: Date.now(), tipo: tipo, chave: chave,
    rotulo: rotuloDoPedido(tipo, chave), cd: cd, alvos: alvos, criadoEm: Date.now()
  };
  DB.salvarPedido(obj).catch(function (e) { alert('Não foi possível enviar o pedido: ' + e.message); });
}

function encerrarPedido() {
  if (!Identidade.ehMestre()) return;
  DB.salvarPedido({ ativo: false }).catch(function () {});
}

// Mestre, com pedido ativo: acompanhamento de quem já respondeu.
function renderPedidoMestre(resp) {
  const alvos = alvosDoPedido(pedido);
  const cdTxt = pedido.cd != null ? ' · CD ' + pedido.cd : '';
  let h = '<div class="ped-cab">🎲 Você pediu: <b>' + esc(pedido.rotulo) + '</b>' + cdTxt + '</div>';
  h += '<div class="ped-track">' + alvos.map(function (id) {
    const p = personagens.find(x => x.id === id);
    const nome = esc(p ? p.nome : id);
    const r = resp[id];
    if (r) {
      return '<div class="ped-row feito"><span class="ped-ic">✅</span><span class="ped-nome">' + nome + '</span>' +
        '<span class="ped-res">' + r.total + selSucesso(r.sucesso) + '</span></div>';
    }
    return '<div class="ped-row"><span class="ped-ic">⏳</span><span class="ped-nome">' + nome + '</span>' +
      '<span class="ped-res ped-aguard">aguardando…</span></div>';
  }).join('') + '</div>';
  const feitos = alvos.filter(id => resp[id]).length;
  h += '<div class="ped-prog">' + feitos + ' de ' + alvos.length + ' responderam</div>';
  const acaoIni = pedido.tipo === 'init'
    ? '<button class="btn-id" onclick="montarIniciativaDoPedido()">⚔️ Montar ordem de iniciativa</button>'
    : '';
  h += '<div class="comb-acoes">' + acaoIni +
    '<button class="btn-id sec" onclick="encerrarPedido()">Encerrar pedido</button></div>';
  return h;
}

// Integração Pedido → Combate: monta/atualiza a Ordem de Iniciativa com as rolagens
// dos jogadores (preserva inimigos e o turno atual; reusa o id 'pc-<charId>').
function montarIniciativaDoPedido() {
  if (!Identidade.atuaComoMestre() || !pedido || pedido.tipo !== 'init') return;
  const resp = respostasDoPedido(pedido.pedidoId);
  const ids = Object.keys(resp);
  if (!ids.length) { alert('Ninguém respondeu a iniciativa ainda.'); return; }
  // mantém o que não são os heróis que responderam (inimigos + quem ainda não rolou)
  const base = (combate.ordem || []).filter(c => !(c.refId && resp[c.refId]));
  const herois = ids.map(function (cid) {
    const p = personagens.find(x => x.id === cid);
    return { id: 'pc-' + cid, nome: p ? p.nome : cid, valor: resp[cid].total, refId: cid };
  });
  const idAtual = combate.ativo ? (combate.ordem[combate.turno] || {}).id : null;
  const r = ordenar_(base.concat(herois), idAtual);
  salvarCombate({ ativo: true, round: combate.round || 1, turno: r.turno, ordem: r.ordem });
}

// Jogador alvo: bloco destacado com o botão Rolar (ou o resultado já rolado).
function renderPedidoJogador(meuId, resp) {
  const cdTxt = pedido.cd != null ? ' <span class="ped-cd-tag">CD ' + pedido.cd + '</span>' : '';
  let h = '<div class="ped-cab">🎲 O mestre pediu: <b>' + esc(pedido.rotulo) + '</b>' + cdTxt + '</div>';
  const r = resp[meuId];
  if (r) {
    h += '<div class="ped-jog-res">Você rolou <b>' + r.total + '</b>' + selSucesso(r.sucesso) +
      '<div class="ped-jog-det">' + esc(r.detalhe) + '</div></div>' +
      '<div class="comb-acoes"><button class="btn-id sec" onclick="responderPedido()">Rolar de novo</button></div>';
  } else {
    h += '<div class="vd" id="ped-vd">' +
      '<button class="vd-btn ativo" data-vd="0" onclick="setVDPed(this)">Normal</button>' +
      '<button class="vd-btn" data-vd="1" onclick="setVDPed(this)">Vant.</button>' +
      '<button class="vd-btn" data-vd="-1" onclick="setVDPed(this)">Desv.</button></div>' +
      '<div class="comb-acoes"><button class="btn-id" onclick="responderPedido()">🎲 Rolar</button></div>';
  }
  return h;
}

function responderPedido() {
  if (!pedido || !pedido.ativo) return;
  const meuId = Identidade.meuId();
  const p = personagens.find(x => x.id === meuId);
  if (!p) return;
  const d = dadosRolagem(p, pedido.tipo, pedido.chave);
  const r = rolarD20(d.bonus, vdPed);
  const cd = pedido.cd;
  const sucesso = (cd != null) ? (r.total >= cd) : null;
  const cdTxt = cd != null ? ' vs CD ' + cd + (sucesso ? ': passou' : ': falhou') : '';
  const rot = pedido.rotulo + cdTxt;
  mostrarResultado(r.total, rot + ' — ' + r.det, r.crit);
  logar({
    autor: p.nome, formula: rot, detalhe: r.det, total: r.total, crit: r.crit,
    tipo: pedido.tipo, rotulo: rot, pedidoId: pedido.pedidoId, charId: meuId, sucesso: sucesso
  });
}

/* ------------------------------ utils ------------------------------ */
function get(id) { return document.getElementById(id).value; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
