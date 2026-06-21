// identidade.js — identidade pelo login (Firebase Auth) + dono da ficha (owner_email).
// O vínculo é real: cada personagem tem um owner_email; o mestre é definido por e-mail.
window.Identidade = (function () {
  let user = null;          // { email, displayName } ou null
  let personagens = [];     // referência à lista atual (para achar o seu personagem)
  let papelAtual;           // 'mestre' | 'jogador' | 'visitante' | null (cache do localStorage)

  function setUser(u) { user = u; }
  function setPersonagens(lista) { personagens = lista || []; }

  // Papel escolhido na tela inicial (gate), lembrado por aparelho.
  function papel() {
    if (papelAtual === undefined) { try { papelAtual = localStorage.getItem('rpg_papel') || null; } catch (e) { papelAtual = null; } }
    return papelAtual;
  }
  function setPapel(p) {
    papelAtual = p || null;
    try { p ? localStorage.setItem('rpg_papel', p) : localStorage.removeItem('rpg_papel'); } catch (e) {}
  }
  function ehVisitante() { return papel() === 'visitante'; }
  // Atua como mestre = escolheu o papel "mestre" E a conta logada é de mestre.
  function atuaComoMestre() { return papel() === 'mestre' && ehMestre(); }

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
    papel: papel, setPapel: setPapel, ehVisitante: ehVisitante, atuaComoMestre: atuaComoMestre,
    logado: logado, email: email, nome: nome, ehMestre: ehMestre,
    meuPersonagem: meuPersonagem, meuId: meuId, podeEditar: podeEditar
  };
})();
