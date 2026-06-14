// app.js — painel principal: polling do estado, cards da tripulação e rolagem de dados.
let personagens = [];
let rolagens = [];
let vantDesv = 0;
let online = false;

/* ----------------------------- inicialização ----------------------------- */
(function init() {
  try {
    const autor = localStorage.getItem('rpg_autor');
    if (autor) document.getElementById('r_autor').value = autor;
  } catch (e) {}

  if (!API.configurado()) {
    document.getElementById('aviso-config').innerHTML =
      '<div class="aviso"><b>Falta configurar a API.</b> Abra <code>js/config.js</code> e cole a URL do Apps Script (termina em <code>/exec</code>). ' +
      'A rolagem de dados funciona offline, mas a tripulação e o feed só aparecem após configurar.</div>';
    setStatus(false, 'API não configurada');
    return;
  }
  carregar();
  setInterval(carregar, CONFIG.INTERVALO_POLL);
})();

function setStatus(ok, txt) {
  online = ok;
  document.getElementById('dot').className = 'dot' + (ok ? '' : ' off');
  document.getElementById('status').textContent = txt;
}

async function carregar() {
  try {
    const e = await API.estado();
    if (e.erro) return setStatus(false, 'erro: ' + e.erro);
    render(e.personagens || []);
    renderFeed(e.rolagens || []);
    setStatus(true, 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR'));
  } catch (err) {
    setStatus(false, 'sem conexão');
  }
}

/* ------------------------------ tripulação ------------------------------ */
function render(lista) {
  personagens = lista;
  const el = document.getElementById('lista');
  el.innerHTML = lista.length ? lista.map(card).join('') :
    '<div class="carregando">Nenhum personagem. Rode popularBaseDeDados() no Apps Script.</div>';
}

function card(p) {
  const pct = p.pv_max > 0 ? Math.round(p.pv_atual / p.pv_max * 100) : 0;
  const cor = pct <= 25 ? 'var(--red)' : (pct <= 50 ? 'var(--amber)' : 'var(--green)');
  const badge = p.status ? '<span class="badge">' + esc(p.status) + '</span>' : '';
  const ini = (p.iniciativa >= 0 ? '+' : '') + p.iniciativa;
  return `
    <div class="card">
      <div class="card-top">
        <div>
          <div class="nome"><a href="ficha.html?id=${encodeURIComponent(p.id)}">${esc(p.nome)}</a></div>
          <div class="classe">${esc(p.classe_nivel)} • ${esc(p.raca)}${p.jogador && p.jogador !== '—' ? ' • ' + esc(p.jogador) : ''}</div>
        </div>
        ${badge}
      </div>
      <div class="pv-linha">
        <div class="pv-barra"><div class="pv-fill" style="width:${pct}%;background:${cor}"></div></div>
        <div class="pv-txt">${p.pv_atual} / ${p.pv_max} PV</div>
      </div>
      <div class="btns">
        <button class="btn-pv menos" onclick="pv('${p.id}',-5)">−5</button>
        <button class="btn-pv menos" onclick="pv('${p.id}',-1)">−1</button>
        <button class="btn-pv mais" onclick="pv('${p.id}',1)">+1</button>
        <button class="btn-pv mais" onclick="pv('${p.id}',5)">+5</button>
      </div>
      <div class="stats">
        <div>CA<b>${p.ca}</b></div>
        <div>Inic.<b>${ini}</b></div>
        <div>Desl.<b>${esc(p.deslocamento)}</b></div>
        <div>Perc.<b>${p.perc_passiva}</b></div>
      </div>
    </div>`;
}

async function pv(id, delta) {
  const p = personagens.find(x => x.id === id);
  if (p) { p.pv_atual = Math.max(0, Math.min(p.pv_atual + delta, p.pv_max)); render(personagens); }
  try { const lista = await API.ajustarPV(id, delta); render(lista); } catch (e) { carregar(); }
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
  if (!API.configurado()) return;
  try { const lista = await API.registrarRolagem({ autor, formula, detalhe, total }); renderFeed(lista); } catch (e) {}
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
