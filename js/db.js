// db.js — camada de dados em TEMPO REAL com Firestore (substitui api.js + polling).
// Usa o SDK compat (carregado por <script> no HTML), expondo o global `firebase`.
window.DB = (function () {
  let db = null, auth = null, pronto = false;

  (function init() {
    if (!window.firebase || !window.CONFIG || !CONFIG.firebase || !CONFIG.firebase.apiKey) return;
    firebase.initializeApp(CONFIG.firebase);
    db = firebase.firestore();
    auth = firebase.auth();
    pronto = true;
  })();

  function configurado() { return pronto; }

  // ----- Assinaturas em tempo real (onSnapshot) -----
  function ouvirPersonagens(cb) {
    db.collection('personagens').onSnapshot(function (snap) {
      const lista = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      lista.sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      cb(lista);
    }, function (e) { console.warn('personagens:', e); });
  }

  function ouvirPersonagem(id, cb) {
    db.collection('personagens').doc(id).onSnapshot(function (d) {
      cb(d.exists ? Object.assign({ id: d.id }, d.data()) : null);
    }, function (e) { console.warn('personagem:', e); });
  }

  function ouvirRolagens(cb) {
    db.collection('rolagens').orderBy('timestamp', 'desc').limit(30).onSnapshot(function (snap) {
      cb(snap.docs.map(function (d) {
        const r = d.data();
        return {
          autor: r.autor, formula: r.formula, detalhe: r.detalhe, total: r.total,
          _crit: r.crit || 0, tipo: r.tipo || 'livre', rotulo: r.rotulo || '',
          pedidoId: r.pedidoId || null, charId: r.charId || null,
          sucesso: (r.sucesso === undefined ? null : r.sucesso),
          timestamp: r.timestamp && r.timestamp.toMillis ? r.timestamp.toMillis() : Date.now()
        };
      }));
    }, function (e) { console.warn('rolagens:', e); });
  }

  function ouvirCombate(cb) {
    db.collection('estado').doc('combate').onSnapshot(function (d) {
      cb(d.exists ? d.data() : null);
    }, function (e) { console.warn('combate:', e); });
  }

  // Pedido de rolagem do mestre (Fase C): doc único estado/pedido, espelhado ao vivo.
  function ouvirPedido(cb) {
    db.collection('estado').doc('pedido').onSnapshot(function (d) {
      cb(d.exists ? d.data() : null);
    }, function (e) { console.warn('pedido:', e); });
  }

  // ----- Gravações -----
  function ajustarPV(id, novoValor) {
    return db.collection('personagens').doc(id).update({ pv_atual: novoValor, atualizado_em: Date.now() });
  }
  function registrarRolagem(dados) {
    return db.collection('rolagens').add(Object.assign({}, dados, {
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }));
  }
  function salvarCombate(obj) {
    return db.collection('estado').doc('combate').set(obj || { ativo: false, round: 0, turno: 0, ordem: [] });
  }
  // Grava/limpa o pedido de rolagem do mestre (estado/pedido). Só o mestre passa nas regras.
  function salvarPedido(obj) {
    return db.collection('estado').doc('pedido').set(obj || { ativo: false });
  }
  // Apaga TODO o histórico de rolagens (só o mestre passa nas regras).
  function limparRolagens() {
    return db.collection('rolagens').get().then(function (snap) {
      const batch = db.batch();
      snap.docs.forEach(function (d) { batch.delete(d.ref); });
      return batch.commit();
    });
  }
  function salvarPersonagem(p) {
    const dados = Object.assign({}, p); const id = dados.id; delete dados.id;
    return db.collection('personagens').doc(id).set(dados, { merge: true });
  }

  // ----- Autenticação (Firebase Auth + Google) -----
  function onAuth(cb) { if (auth) auth.onAuthStateChanged(cb); }
  function usuario() { return auth ? auth.currentUser : null; }
  function entrar() {
    const prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    // popup evita o problema de armazenamento entre domínios (web.app x firebaseapp.com)
    return auth.signInWithPopup(prov);
  }
  function sair() { return auth.signOut(); }
  // Amarra a ficha à conta logada (só funciona se a ficha estiver sem dono, pelas regras).
  function reivindicar(id, emailDono) {
    return db.collection('personagens').doc(id).update({ owner_email: emailDono });
  }
  // Admin (mestre): define/limpa o dono de qualquer ficha. '' = sem dono.
  function definirDono(id, email) {
    return db.collection('personagens').doc(id).update({ owner_email: email || '' });
  }

  return {
    configurado: configurado,
    ouvirPersonagens: ouvirPersonagens, ouvirPersonagem: ouvirPersonagem,
    ouvirRolagens: ouvirRolagens, ouvirCombate: ouvirCombate, ouvirPedido: ouvirPedido,
    ajustarPV: ajustarPV, registrarRolagem: registrarRolagem,
    salvarCombate: salvarCombate, salvarPedido: salvarPedido,
    salvarPersonagem: salvarPersonagem, limparRolagens: limparRolagens,
    onAuth: onAuth, usuario: usuario, entrar: entrar, sair: sair,
    reivindicar: reivindicar, definirDono: definirDono
  };
})();
