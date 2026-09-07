// navbar.js — barra de navegação inferior, compartilhada pelo painel (index.html) e pela
// ficha (ficha.html). No painel as abas trocam de seção (mostrarAba); na ficha os itens
// navegam de volta pro painel na aba certa (index.html#aba). Usa window.Identidade.
window.Navbar = (function () {
  // Ícones (SVG inline) — herdam a cor via currentColor.
  const ICN = {
    tripulacao: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-3.2 2.5-5 5.5-5s5.5 1.8 5.5 5z"/><circle cx="16.6" cy="8.8" r="2.4"/><path d="M14.6 13.9c.6-.1 1.2-.2 1.9-.2 2.7 0 4.9 1.6 4.9 4.6h-4.6"/></svg>',
    combate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4 L20 20 M20 4 L4 20"/><path d="M15.5 6.5 L17.5 8.5 M6.5 15.5 L8.5 17.5"/></svg>',
    rolar: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M16 2 L29 9.5 L29 22.5 L16 30 L3 22.5 L3 9.5 Z"/><path d="M16 2 L16 11 M3 9.5 L16 11 L29 9.5 M16 11 L8 22.5 M16 11 L24 22.5 M3 22.5 L8 22.5 L16 30 L24 22.5 L29 22.5 M8 22.5 L16 16 L24 22.5"/></svg>',
    pedido: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c-2.8 0-5 2.2-5 5 0 4-1.2 5.2-2 6.2-.3.4 0 1 .5 1h13c.5 0 .8-.6.5-1-.8-1-2-2.2-2-6.2 0-2.8-2.2-5-5-5z"/><circle cx="12" cy="20" r="1.7"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h8M17 7h3M4 17h3M12 17h8"/><circle cx="14.5" cy="7" r="2.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="17" r="2.3" fill="currentColor" stroke="none"/></svg>',
    ficha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>'
  };

  // Abas conforme o papel: base p/ todos + Ficha/Pedido (jogador) + Pedido/Admin (mestre).
  function abasDoPapel() {
    const abas = [
      { id: 'tripulacao', lbl: 'Tripulação' },
      { id: 'combate', lbl: 'Combate' },
      { id: 'rolar', lbl: 'Rolar' }
    ];
    if (Identidade.atuaComoMestre()) {
      abas.push({ id: 'pedido', lbl: 'Pedido' });
      abas.push({ id: 'admin', lbl: 'Admin' });
    } else if (Identidade.papel() === 'jogador') {
      const meu = Identidade.meuId();
      if (meu) abas.push({ id: 'ficha', lbl: 'Ficha', href: 'ficha.html?id=' + encodeURIComponent(meu) });
      abas.push({ id: 'pedido', lbl: 'Pedido' });
    }
    return abas;
  }

  // opts: { abaAtiva, modo:'painel'|'ficha', badge }
  function montar(opts) {
    const abas = abasDoPapel();
    let ativa = opts.abaAtiva;
    if (opts.modo === 'painel' && !abas.some(a => a.id === ativa)) ativa = 'tripulacao';
    const badge = !!opts.badge;
    return abas.map(function (a) {
      const ativo = a.id === ativa ? ' ativo' : '';
      const dot = (a.id === 'pedido' && badge) ? '<span class="nav-dot"></span>' : '';
      let onclick;
      if (a.href) onclick = "location.href='" + a.href + "'";              // item de navegação (Ficha)
      else if (opts.modo === 'painel') onclick = "mostrarAba('" + a.id + "')";  // troca de aba no painel
      else onclick = "location.href='index.html#" + a.id + "'";            // da ficha → volta ao painel
      return '<button class="nav-item' + ativo + '" onclick="' + onclick + '">' + dot + ICN[a.id] +
        '<span>' + a.lbl + '</span></button>';
    }).join('');
  }

  return { ICN: ICN, abasDoPapel: abasDoPapel, montar: montar };
})();
