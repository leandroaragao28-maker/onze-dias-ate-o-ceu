// brasoes.js — brasões/ícones de classe (SVG) e o avatar (retrato ou brasão).
window.Brasoes = (function () {
  function chave(classeNivel) {
    const s = (classeNivel || '').toLowerCase();
    if (s.indexOf('guerreiro') >= 0) return 'guerreiro';
    if (s.indexOf('bárbaro') >= 0 || s.indexOf('barbaro') >= 0) return 'barbaro';
    if (s.indexOf('paladino') >= 0) return 'paladino';
    if (s.indexOf('clérigo') >= 0 || s.indexOf('clerigo') >= 0) return 'clerigo';
    if (s.indexOf('mago') >= 0 || s.indexOf('maga') >= 0 || s.indexOf('feiticeir') >= 0 || s.indexOf('bruxo') >= 0) return 'mago';
    if (s.indexOf('bardo') >= 0) return 'bardo';
    return 'generico';
  }

  const ICONES = {
    // Espada (Guerreiro)
    guerreiro: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L13.2 5 V13 H10.8 V5 Z"/><path d="M8 13 H16 V14.7 H8 Z"/><path d="M11 14.7 H13 V18.6 H11 Z"/><circle cx="12" cy="19.9" r="1.6"/></svg>',
    // Machado de duas lâminas (Bárbaro)
    barbaro: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.2 3 H12.8 V21 H11.2 Z"/><path d="M12.8 4 C 17 3.5 19.6 6.5 18.6 10.6 C 16 9.5 14 9 12.8 9 Z"/><path d="M11.2 4 C 7 3.5 4.4 6.5 5.4 10.6 C 8 9.5 10 9 11.2 9 Z"/></svg>',
    // Escudo com cruz (Paladino)
    paladino: '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="M12 2 L20 5 V11 C20 16.5 16.2 20 12 22 C7.8 20 4 16.5 4 11 V5 Z M11.2 7 H12.8 V9.2 H15 V10.8 H12.8 V14 H11.2 V10.8 H9 V9.2 H11.2 Z"/></svg>',
    // Martelo de guerra (Clérigo da Forja)
    clerigo: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="4" width="10" height="4.4" rx="1.1"/><path d="M11.2 8 H12.8 V21 H11.2 Z"/></svg>',
    // Alaúde (Bardo)
    bardo: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9.5" cy="15" r="5.2"/><path d="M13 12 L18 4 H19.6 V5.6 L12 11 Z"/></svg>',
    // Cajado com orbe (Mago/Maga)
    mago: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="16.5" cy="5.6" r="2.9"/><path d="M15 7.2 L6.4 20.6 H8.6 L16.3 8.3 Z"/></svg>',
    // d20 (genérico)
    generico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z"/><path d="M12 2.5 L20 7 L12 12 L4 7 Z"/><path d="M4 17 L12 12 L20 17"/><path d="M12 12 V21.5"/></svg>'
  };

  function crest(classeNivel) { return ICONES[chave(classeNivel)] || ICONES.generico; }

  // Avatar: usa o retrato (avatar_url) se houver; senão o brasão da classe.
  function avatar(p, extraClasse) {
    const inner = p.avatar_url
      ? '<img src="' + p.avatar_url + '" alt="">'
      : crest(p.classe_nivel);
    return '<div class="avatar ' + (extraClasse || '') + '">' + inner + '</div>';
  }

  return { crest: crest, avatar: avatar, chave: chave };
})();
