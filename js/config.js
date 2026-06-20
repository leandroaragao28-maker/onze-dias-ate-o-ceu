// config.js — configuração do Firebase (gerada pelo Firebase CLI).
// A apiKey aqui é pública por design; a segurança fica nas REGRAS do Firestore + login.
window.CONFIG = {
  firebase: {
    apiKey: "AIzaSyCvDK1OWoC7nB8j9KDi1axkJ5lgqHDacn4",
    authDomain: "onze-dias-ate-o-ceu.web.app", // mesmo domínio do app: evita partição de storage no login
    projectId: "onze-dias-ate-o-ceu",
    storageBucket: "onze-dias-ate-o-ceu.firebasestorage.app",
    messagingSenderId: "664538033951",
    appId: "1:664538033951:web:1b6f91a8d3803b13760a2a"
  },
  // E-mails do(s) mestre(s): editam TODAS as fichas. (Também travado nas regras do Firestore.)
  MESTRE_EMAILS: ['leandroaragao28@gmail.com']
};
