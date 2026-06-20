// identidade.js — identidade pelo login (Firebase Auth) + dono da ficha (owner_email).
// O vínculo é real: cada personagem tem um owner_email; o mestre é definido por e-mail.
window.Identidade = (function () {
  let user = null;          // { email, displayName } ou null
  let personagens = [];     // referência à lista atual (para achar o seu personagem)

  function setUser(u) { user = u; }
  function setPersonagens(lista) { personagens = lista || []; }

  function logado() { return !!user; }
  function email() { return user ? user.email : null; }
  function nome() { return user ? (user.displayName || user.email) : ''; }
  function ehMestre() {
    return !!user && (CONFIG.MESTRE_EMAILS || []).indexOf(user.email) >= 0;
  }
  function meuPersonagem() {
    if (!user) return null;
    return personagens.find(function (p) { return p.owner_email && p.owner_email === user.email; }) || null;
  }
  function meuId() { const p = meuPersonagem(); return p ? p.id : null; }
  // Pode editar a ficha p? Mestre edita todas; jogador edita só a sua.
  function podeEditar(p) {
    if (!user || !p) return false;
    return ehMestre() || p.owner_email === user.email;
  }

  return {
    setUser: setUser, setPersonagens: setPersonagens,
    logado: logado, email: email, nome: nome, ehMestre: ehMestre,
    meuPersonagem: meuPersonagem, meuId: meuId, podeEditar: podeEditar
  };
})();
