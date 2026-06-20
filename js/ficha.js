// ficha.js — ficha completa no layout da ficha oficial do Livro do Jogador (responsivo).
let alvoEl, atual = null;
carregarFicha();

function carregarFicha() {
  alvoEl = document.getElementById('ficha');
  const id = new URLSearchParams(location.search).get('id');
  if (!DB.configurado()) { alvoEl.innerHTML = '<div class="aviso">Firebase não configurado em <code>js/config.js</code>.</div>'; return; }
  if (!id) { alvoEl.innerHTML = '<div class="aviso">Personagem não informado.</div>'; return; }
  DB.onAuth(function (u) {
    Identidade.setUser(u ? { email: u.email, displayName: u.displayName } : null);
    if (atual) alvoEl.innerHTML = render(atual);
  });
  DB.ouvirPersonagem(id, function (p) {
    if (!p) { alvoEl.innerHTML = '<div class="aviso">Personagem não encontrado.</div>'; return; }
    atual = p;
    alvoEl.innerHTML = render(p);
  });
}

window.ajPV = function (delta) {
  if (!atual) return;
  const novo = Math.max(0, Math.min(atual.pv_atual + delta, atual.pv_max));
  atual.pv_atual = novo;
  alvoEl.innerHTML = render(atual);
  DB.ajustarPV(atual.id, novo).catch(function () {});
};

const ATR = [
  ['forca', 'Força'], ['destreza', 'Destreza'], ['constituicao', 'Constituição'],
  ['inteligencia', 'Inteligência'], ['sabedoria', 'Sabedoria'], ['carisma', 'Carisma']
];

function mod(v) { const m = Math.floor((v - 10) / 2); return (m >= 0 ? '+' : '') + m; }
function sinal(n) { return (n >= 0 ? '+' : '') + n; }
function box(conteudo, rotulo) { return '<div class="box">' + conteudo + '<div class="box-rotulo">' + rotulo + '</div></div>'; }
function mini(rotulo, valor) { return '<div class="mini-of"><div class="v">' + esc(valor) + '</div><div class="r">' + rotulo + '</div></div>'; }

function render(p) {
  const f = p.ficha || {};
  const ed = Identidade.podeEditar(p);
  let h = '';

  /* ---------- Cabeçalho ---------- */
  const campo = (r, v) => '<div class="cab-campo"><div class="cab-v">' + esc(v || '—') + '</div><div class="cab-r">' + r + '</div></div>';
  h += '<div class="ficha-cab">' +
    '<div class="ficha-cab-id">' + Brasoes.avatar(p, 'grande') +
    '<div><div class="ficha-nome">' + esc(p.nome) + '</div>' +
    (f.subtitulo ? '<div class="ficha-sub">' + esc(f.subtitulo) + '</div>' : '') + '</div></div>' +
    '<div class="cab-grade">' +
    campo('Classe &amp; Nível', p.classe_nivel) + campo('Antecedente', p.antecedente) +
    campo('Jogador', p.jogador) + campo('Raça', p.raca) + campo('Tendência', p.tendencia) +
    campo('Experiência', p.xp_atual + ' / ' + p.xp_prox) + '</div></div>';

  /* ---------- Folha em 3 colunas ---------- */
  h += '<div class="folha"><div class="col">' + colEsquerda(p, f) + '</div>' +
    '<div class="col">' + colMeio(p, f, ed) + '</div>' +
    '<div class="col">' + colDireita(p, f) + '</div></div>';

  /* ---------- Extras (largura cheia) ---------- */
  h += extras(p, f);
  return h;
}

function colEsquerda(p, f) {
  let h = '';
  // Atributos
  h += '<div class="atributos-of">' + ATR.map(a =>
    '<div class="attr-of"><div class="a-nome">' + a[1] + '</div><div class="a-mod">' + mod(p[a[0]]) + '</div><div class="a-valor">' + p[a[0]] + '</div></div>'
  ).join('') + '</div>';

  // Prof + Passiva
  h += '<div class="mini-grid">' + mini('Bônus de Proficiência', sinal(p.prof_bonus)) + mini('Percepção Passiva', p.perc_passiva) + '</div>';

  // Salvaguardas
  const sv = f.salvaguardas || { bonus: {}, proficientes: [] };
  const prof = sv.proficientes || [];
  h += box('<div class="lista-of">' + ATR.map(a => {
    const b = (sv.bonus || {})[a[0]]; const on = prof.indexOf(a[0]) >= 0;
    return '<div class="ln"><span class="' + (on ? 'ponto' : 'ponto-off') + '">' + (on ? '●' : '○') + '</span> ' + a[1] +
      '<span class="b">' + (b == null ? '—' : sinal(b)) + '</span></div>';
  }).join('') + '</div>', 'Testes de Resistência');

  // Perícias
  h += box('<div class="lista-of">' + (f.pericias || []).map(pe =>
    '<div class="ln"><span class="' + (pe.prof ? 'ponto' : 'ponto-off') + '">' + (pe.prof ? '●' : '○') + '</span> ' +
    esc(pe.nome) + ' <span class="ka">(' + esc(pe.atrib) + ')</span><span class="b">' + sinal(pe.bonus) + '</span></div>'
  ).join('') + '</div>', 'Perícias');

  // Proficiências e idiomas
  if (f.proficiencias && f.proficiencias.length) {
    h += box((f.proficiencias).map(e => '<div class="ln-prof">' + esc(e) + '</div>').join(''), 'Outras Proficiências e Idiomas');
  }
  return h;
}

function colMeio(p, f, ed) {
  let h = '';
  // CA / Iniciativa / Deslocamento
  h += '<div class="mini-grid-3">' + mini('Classe de Armadura', p.ca) + mini('Iniciativa', sinal(p.iniciativa)) + mini('Deslocamento', p.deslocamento) + '</div>';

  // Pontos de Vida
  const pct = p.pv_max > 0 ? Math.round(p.pv_atual / p.pv_max * 100) : 0;
  const cor = pct <= 25 ? 'var(--red)' : (pct <= 50 ? 'var(--amber)' : 'var(--green)');
  const pvBtns = ed ? '<div class="btns"><button class="btn-pv menos" onclick="ajPV(-5)">−5</button>' +
    '<button class="btn-pv menos" onclick="ajPV(-1)">−1</button><button class="btn-pv mais" onclick="ajPV(1)">+1</button>' +
    '<button class="btn-pv mais" onclick="ajPV(5)">+5</button></div>' : '';
  h += box('<div class="hp-of"><div class="hp-num">' + p.pv_atual + ' <span>/ ' + p.pv_max + '</span></div>' +
    '<div class="pv-barra"><div class="pv-fill" style="width:' + pct + '%;background:' + cor + '"></div></div></div>' + pvBtns +
    '<div class="mini-grid" style="margin-top:8px">' + mini('PV Temporários', p.pv_temp || 0) + mini('Dado de Vida', p.dados_vida) + '</div>',
    'Pontos de Vida');

  // Ataques & Conjuração
  const linhas = (f.ataques || []).map(a =>
    '<tr><td><b>' + esc(a.nome) + '</b><div class="sub">' + esc(a.tipo || '') + '</div></td>' +
    '<td class="b">' + (a.bonus == null ? '—' : sinal(a.bonus)) + '</td><td>' + esc(a.dano || '') + '</td></tr>'
  ).join('');
  h += box('<table class="atk-of"><thead><tr><th>Arma</th><th>Bônus</th><th>Dano / Tipo</th></tr></thead><tbody>' + linhas + '</tbody></table>' +
    (f.ataques_nota ? '<div class="atk-nota">' + esc(f.ataques_nota) + '</div>' : ''), 'Ataques &amp; Conjuração');

  // Equipamento
  if (f.equipamento && f.equipamento.length) {
    h += box(f.equipamento.map(e => '<span class="tag">' + esc(e) + '</span>').join(' '), 'Equipamento');
  }
  return h;
}

function colDireita(p, f) {
  const per = f.personalidade || {};
  const usados = ['Ideal', 'Ideais', 'Vínculo', 'Vinculo', 'Defeito', 'Defeitos'];
  const tracos = Object.keys(per).filter(k => usados.indexOf(k) < 0)
    .map(k => '<b>' + esc(k) + ':</b> ' + esc(per[k])).join('<br><br>');
  let h = '';
  h += box('<div class="texto-of">' + (tracos || '—') + '</div>', 'Traços de Personalidade');
  h += box('<div class="texto-of">' + esc(per['Ideal'] || per['Ideais'] || '—') + '</div>', 'Ideais');
  h += box('<div class="texto-of">' + esc(per['Vínculo'] || per['Vinculo'] || '—') + '</div>', 'Vínculos');
  h += box('<div class="texto-of">' + esc(per['Defeito'] || per['Defeitos'] || '—') + '</div>', 'Defeitos');
  if (f.tracos && f.tracos.length) {
    h += box(f.tracos.map(t => '<div class="item"><div class="t">' + esc(t.nome) + '</div><div class="d">' + esc(t.desc) + '</div></div>').join(''), 'Características &amp; Traços');
  }
  return h;
}

function extras(p, f) {
  let h = '';
  if (f.magias) {
    const m = f.magias;
    let c = '<div class="mini-grid-3">' + mini('Atributo', m.atributo) + mini('CD das Magias', m.cd) + mini('Ataque de Magia', sinal(m.ataque)) + '</div>';
    (m.grupos || []).forEach(g => {
      c += '<div class="grupo-magia">' + esc(g.titulo) + '</div>';
      c += g.itens.map(it => '<div class="item"><div class="t">' + esc(it.nome) + '</div><div class="d">' + esc(it.desc) + '</div></div>').join('');
    });
    h += '<div class="secao-titulo">Magias &amp; Conjuração</div>' + box(c, 'Conjuração');
  }
  if (f.perfil) {
    const c = Object.keys(f.perfil).map(k => '<div class="ln"><span>' + esc(k) + '</span><span class="b">' + esc(f.perfil[k]) + '</span></div>').join('');
    h += '<div class="secao-titulo">Perfil</div>' + box('<div class="lista-of">' + c + '</div>', 'Perfil');
  }
  if (f.historia && f.historia.length) {
    h += '<div class="secao-titulo">História &amp; Registros</div>' +
      box(f.historia.map(x => '<div class="item"><div class="t">' + esc(x.titulo) + '</div><div class="d">' + esc(x.texto) + '</div></div>').join(''), 'História do Personagem');
  }
  if (f.anotacoes) {
    h += '<div class="secao-titulo">Anotações</div>' + box('<div class="texto-of" style="white-space:pre-line">' + esc(f.anotacoes) + '</div>', 'Anotações');
  }
  return h;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
