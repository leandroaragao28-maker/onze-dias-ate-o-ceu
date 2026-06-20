/* pwa.js — registra o Service Worker e controla os dois banners:
 *  • "Nova versão disponível" (atualização)
 *  • "Instale o painel no seu celular" (instalação / A2HS)
 */
(function () {
  /* ----------------------- Service Worker + atualização ----------------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').then(function (reg) {
        // Atualização AUTOMÁTICA: aplica a versão nova sozinho e recarrega (sem banner, sem toque).
        if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage({ type: 'SKIP_WAITING' });
          });
        });
        // Checa por atualização a cada 60s (e ao voltar ao app).
        setInterval(function () { reg.update().catch(function () {}); }, 60000);
      }).catch(function () {});

      // Reverifica atualização ao reabrir/voltar ao app.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update(); });
        }
      });

      var recarregando = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (recarregando) return;
        recarregando = true;
        location.reload();
      });

      mostrarVersao();
    });
  }

  // Mostra no rodapé a versão que o Service Worker está realmente servindo. Tocar = checar atualização.
  function mostrarVersao() {
    var el = document.getElementById('versao');
    if (!el) return;
    function consultar() {
      var ctrl = navigator.serviceWorker.controller;
      if (!ctrl) { el.textContent = 'versão —'; return; }
      var mc = new MessageChannel();
      mc.port1.onmessage = function (e) { el.textContent = 'versão ' + e.data + ' · toque para checar'; };
      try { ctrl.postMessage({ type: 'GET_VERSION' }, [mc.port2]); } catch (err) {}
    }
    el.onclick = function () {
      el.textContent = 'checando…';
      navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update(); });
      setTimeout(consultar, 2500);
    };
    navigator.serviceWorker.ready.then(consultar);
  }

  function mostrarUpdate(reg) {
    var b = document.getElementById('banner-update');
    if (!b) return;
    b.classList.add('show');
    b.querySelector('.banner-btn').onclick = function () {
      b.classList.remove('show');
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    };
  }

  /* ----------------------------- Instalação (A2HS) ---------------------------- */
  var deferred = null;
  function bInstall() { return document.getElementById('banner-install'); }
  function jaInstalado() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function dispensado() { try { return localStorage.getItem('pwa_install_dismiss') === '1'; } catch (e) { return false; } }
  function ehIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }

  // Android / Chrome / Edge: evento nativo de instalação.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (jaInstalado() || dispensado()) return;
    var b = bInstall();
    if (!b) return;
    b.classList.add('show');
    b.querySelector('.banner-btn').onclick = function () {
      b.classList.remove('show');
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; });
    };
  });

  window.addEventListener('appinstalled', function () {
    var b = bInstall();
    if (b) b.classList.remove('show');
    try { localStorage.setItem('pwa_install_dismiss', '1'); } catch (e) {}
  });

  document.addEventListener('DOMContentLoaded', function () {
    var b = bInstall();
    if (!b) return;
    var x = b.querySelector('.banner-x');
    if (x) x.onclick = function () {
      b.classList.remove('show');
      try { localStorage.setItem('pwa_install_dismiss', '1'); } catch (e) {}
    };
    // iOS/Safari não dispara beforeinstallprompt → instrução manual.
    if (ehIOS() && !jaInstalado() && !dispensado()) {
      b.querySelector('.banner-btn').style.display = 'none';
      b.querySelector('.banner-txt').textContent = 'Instalar: toque em Compartilhar e em “Adicionar à Tela de Início”.';
      b.classList.add('show');
    }
  });
})();
