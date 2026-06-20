// ficha.js — renderiza a ficha completa de um personagem a partir do ficha_json.
const ATRIBS = [
  ['forca', 'Força'], ['destreza', 'Destreza'], ['constituicao', 'Const.'],
  ['inteligencia', 'Intel.'], ['sabedoria', 'Sab.'], ['carisma', 'Carisma']
];

let alvoEl, atual = null;
carregarFicha();

function carregarFicha() {
  alvoEl = document.getElementById('ficha');
  const id = new URLSearchParams(location.search).get('id');
  if (!DB.configurado()) { alvoEl.innerHTML = '<div class="aviso">Firebase não configurado em <code>js/config.js</code>.</div>'; return; }
  if (!id) { alvoEl.innerHTML = '<div class="aviso">Personagem não informado.</div>'; return; }
  DB.ouvirPersonagem(id, function (p) {          // tempo real: PV/dados atualizam sozinhos
    if (!p) { alvoEl.innerHTML = '<div class="aviso">Personagem não encontrado.</div>'; return; }
    atual = p;
    alvoEl.innerHTML = render(p);
  });
}

// Ajuste de PV na ficha (só aparece para quem pode editar este personagem).
window.ajPV = function (delta) {
  if (!atual) return;
  const novo = Math.max(0, Math.min(atual.pv_atual + delta, atual.pv_max));
  atual.pv_atual = novo;
  alvoEl.innerHTML = render(atual);              // otimista; o listener confirma
  DB.ajustarPV(atual.id, novo).catch(function () {});
};

function mod(v) { const m = Math.floor((v - 10) / 2); return (m >= 0 ? '+' : '') + m; }
function sec(titulo, conteudo) { return '<div class="secao-titulo">' + titulo + '</div><div class="card">' + conteudo + '</div>'; }

function render(p) {
  const f = p.ficha || {};
  let h = '';

  // Cabeçalho
  h += '<header><div class="ficha-h"><h1>' + esc(p.nome) + '</h1></div>' +
    (f.subtitulo ? '<div class="sub">' + esc(f.subtitulo) + '</div>' : '') +
    '<div class="sub">' + esc(p.classe_nivel) + ' • ' + esc(p.raca) + ' • ' + esc(p.tendencia) +
    ' • ' + esc(p.antecedente) + (p.jogador && p.jogador !== '—' ? ' • Jogador: ' + esc(p.jogador) : '') + '</div></header>';

  // Combate
  const pct = p.pv_max > 0 ? Math.round(p.pv_atual / p.pv_max * 100) : 0;
  const cor = pct <= 25 ? 'var(--red)' : (pct <= 50 ? 'var(--amber)' : 'var(--green)');
  const pvBtns = Identidade.podeEditar(p.id) ? '<div class="btns">' +
    '<button class="btn-pv menos" onclick="ajPV(-5)">−5</button>' +
    '<button class="btn-pv menos" onclick="ajPV(-1)">−1</button>' +
    '<button class="btn-pv mais" onclick="ajPV(1)">+1</button>' +
    '<button class="btn-pv mais" onclick="ajPV(5)">+5</button></div>' : '';
  h += sec('Combate',
    '<div class="pv-linha"><div class="pv-barra"><div class="pv-fill" style="width:' + pct + '%;background:' + cor + '"></div></div>' +
    '<div class="pv-txt">' + p.pv_atual + ' / ' + p.pv_max + ' PV</div></div>' + pvBtns +
    '<div class="linha-comb">' +
    mini('CA', p.ca) + mini('Inic.', (p.iniciativa >= 0 ? '+' : '') + p.iniciativa) + mini('Desl.', p.deslocamento) +
    mini('Dados Vida', p.dados_vida) + mini('Perc. Pass.', p.perc_passiva) + mini('Prof.', '+' + p.prof_bonus) +
    mini('XP', p.xp_atual + '/' + p.xp_prox) + '</div>');

  // Atributos
  h += sec('Atributos', '<div class="grade-atrib">' + ATRIBS.map(a =>
    '<div class="atrib"><div class="rotulo">' + a[1] + '</div><div class="valor">' + p[a[0]] + '</div><div class="mod">' + mod(p[a[0]]) + '</div></div>'
  ).join('') + '</div>');

  // Salvaguardas
  if (f.salvaguardas) {
    const sv = f.salvaguardas, prof = sv.proficientes || [];
    h += sec('Testes de Resistência', '<div class="lista-pericias">' + ATRIBS.map(a => {
      const b = sv.bonus[a[0]], on = prof.indexOf(a[0]) >= 0;
      return '<div class="' + (on ? 'prof-on' : 'prof-off') + '">' + (on ? '● ' : '○ ') + a[1] + ' <b>' + (b >= 0 ? '+' : '') + b + '</b></div>';
    }).join('') + '</div>');
  }

  // Perícias
  if (f.pericias && f.pericias.length) {
    h += sec('Perícias', '<div class="lista-pericias">' + f.pericias.map(pe =>
      '<div class="' + (pe.prof ? 'prof-on' : 'prof-off') + '">' + (pe.prof ? '● ' : '○ ') +
      esc(pe.nome) + ' <span class="roll-f">(' + esc(pe.atrib) + ')</span> <b>' + (pe.bonus >= 0 ? '+' : '') + pe.bonus + '</b></div>'
    ).join('') + '</div>');
  }

  // Ataques
  if (f.ataques && f.ataques.length) {
    h += sec('Ataques e Dano', f.ataques.map(a =>
      '<div class="atk"><div class="t">' + esc(a.nome) + '<div class="d">' + esc(a.tipo || '') + '</div></div>' +
      '<div class="b">' + (a.bonus == null ? '—' : (a.bonus >= 0 ? '+' : '') + a.bonus) + '</div>' +
      '<div>' + esc(a.dano || '') + '</div></div>'
    ).join('') + (f.ataques_nota ? '<div class="d" style="margin-top:8px">' + esc(f.ataques_nota) + '</div>' : ''));
  }

  // Magias
  if (f.magias) {
    const m = f.magias;
    let c = '<div class="linha-comb">' + mini('Atributo', m.atributo) + mini('CD', m.cd) + mini('Ataque', '+' + m.ataque) + '</div>';
    (m.grupos || []).forEach(g => {
      c += '<div class="secao-titulo" style="margin-left:0">' + esc(g.titulo) + '</div>';
      c += g.itens.map(it => '<div class="item"><div class="t">' + esc(it.nome) + '</div><div class="d">' + esc(it.desc) + '</div></div>').join('');
    });
    h += sec('Magias / Conjuração', c);
  }

  // Traços
  if (f.tracos && f.tracos.length) {
    h += sec('Traços e Habilidades', f.tracos.map(t =>
      '<div class="item"><div class="t">' + esc(t.nome) + '</div><div class="d">' + esc(t.desc) + '</div></div>').join(''));
  }

  // Perfil
  if (f.perfil) h += sec('Perfil', mapa(f.perfil));

  // Equipamento + Proficiências
  if (f.equipamento && f.equipamento.length)
    h += sec('Equipamento', f.equipamento.map(e => '<span class="tag">' + esc(e) + '</span>').join(' '));
  if (f.proficiencias && f.proficiencias.length)
    h += sec('Proficiências e Idiomas', f.proficiencias.map(e => '<div class="item">' + esc(e) + '</div>').join(''));

  // Personalidade
  if (f.personalidade) h += sec('Personalidade', mapa(f.personalidade));

  // História
  if (f.historia && f.historia.length)
    h += sec('História & Registros', f.historia.map(x =>
      '<div class="item"><div class="t">' + esc(x.titulo) + '</div><div class="d">' + esc(x.texto) + '</div></div>').join(''));

  // Anotações
  if (f.anotacoes) h += sec('Anotações', '<div class="d" style="white-space:pre-line">' + esc(f.anotacoes) + '</div>');

  return h;
}

function mini(rotulo, valor) { return '<div class="mini"><div class="rotulo">' + rotulo + '</div><div class="valor">' + esc(valor) + '</div></div>'; }
function mapa(obj) { return Object.keys(obj).map(k => '<div class="item"><div class="t">' + esc(k) + '</div><div class="d">' + esc(obj[k]) + '</div></div>').join(''); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
