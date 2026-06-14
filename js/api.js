// api.js — camada de acesso à API do Apps Script.
// Usa GET e POST text/plain para evitar preflight de CORS (limitação do Apps Script).
window.API = (function () {
  function url(acao, params) {
    const q = new URLSearchParams(Object.assign({ acao: acao, token: CONFIG.TOKEN }, params || {}));
    return CONFIG.API_URL + '?' + q.toString();
  }

  async function get(acao, params) {
    const r = await fetch(url(acao, params), { method: 'GET' });
    return r.json();
  }

  async function post(acao, dados) {
    const corpo = Object.assign({ acao: acao, token: CONFIG.TOKEN }, dados);
    const r = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request → sem preflight
      body: JSON.stringify(corpo)
    });
    return r.json();
  }

  return {
    estado: () => get('estado'),
    personagens: () => get('personagens'),
    rolagens: () => get('rolagens'),
    ajustarPV: (id, delta) => post('ajustarPV', { id: id, delta: delta }),
    salvarPersonagem: (dados) => post('salvarPersonagem', { dados: dados }),
    excluirPersonagem: (id) => post('excluirPersonagem', { id: id }),
    registrarRolagem: (dados) => post('registrarRolagem', { dados: dados }),
    configurado: () => CONFIG.API_URL.indexOf('COLE_AQUI') === -1
  };
})();
