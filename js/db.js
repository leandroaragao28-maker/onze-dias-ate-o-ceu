// db.js — camada de dados em TEMPO REAL com Firestore (substitui api.js + polling).
// Usa o SDK compat (carregado por <script> no HTML), expondo o global `firebase`.
window.DB = (function () {
  let db = null, pronto = false;

  (function init() {
    if (!window.firebase || !window.CONFIG || !CONFIG.firebase || !CONFIG.firebase.apiKey) return;
    firebase.initializeApp(CONFIG.firebase);
    db = firebase.firestore();
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
          _crit: r.crit || 0,
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
  function salvarPersonagem(p) {
    const dados = Object.assign({}, p); const id = dados.id; delete dados.id;
    return db.collection('personagens').doc(id).set(dados, { merge: true });
  }

  return {
    configurado: configurado,
    ouvirPersonagens: ouvirPersonagens, ouvirPersonagem: ouvirPersonagem,
    ouvirRolagens: ouvirRolagens, ouvirCombate: ouvirCombate,
    ajustarPV: ajustarPV, registrarRolagem: registrarRolagem,
    salvarCombate: salvarCombate, salvarPersonagem: salvarPersonagem
  };
})();
