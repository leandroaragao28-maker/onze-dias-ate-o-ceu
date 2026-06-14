// identidade.js — modelo "reivindicar personagem" (sem login, segurança social).
// "Quem é você" fica salvo só neste aparelho (localStorage). O mestre tem uma chave
// que libera a edição de todos. A API continua aberta; o controle é na interface.
window.Identidade = (function () {
  const K_ID = 'rpg_meu_personagem';
  const K_NOME = 'rpg_autor';        // mesmo nome usado pelo rolador de dados
  const K_MESTRE = 'rpg_mestre';

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  return {
    meuId() { return get(K_ID); },
    nome() { return get(K_NOME) || ''; },
    setMeu(id, nome) { if (id) set(K_ID, id); else del(K_ID); if (nome) set(K_NOME, nome); },
    limpar() { del(K_ID); },
    ehMestre() { return get(K_MESTRE) === '1'; },
    entrarMestre(chave) {
      if (chave && window.CONFIG && chave === CONFIG.MESTRE_KEY) { set(K_MESTRE, '1'); return true; }
      return false;
    },
    sairMestre() { del(K_MESTRE); },
    podeEditar(id) { return this.ehMestre() || this.meuId() === id; }
  };
})();
