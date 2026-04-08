(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const main = $('#main');
  const fileInput = $('#fileInput');

  /* ── State ── */
  let collection = [];
  let confirmDeleteId = null;

  /* ── Helpers ── */
  function difficultyColor(d) {
    if (d === 'Easy') return '#0BBE68';
    if (d === 'Medium') return '#f59e0b';
    if (d === 'Hard') return '#ef4444';
    return '#0BBE68';
  }

  function badgesHTML(game) {
    let h = '';
    if (game.players) h += `<span class="badge">\u{1F465} ${game.players} players</span>`;
    if (game.duration) h += `<span class="badge">\u23F1 ${game.duration}</span>`;
    if (game.difficulty) h += `<span class="badge badge-difficulty" style="background-color:${difficultyColor(game.difficulty)}">${game.difficulty}</span>`;
    if (game.genre) h += `<span class="badge badge-genre">\u{1F3B2} ${game.genre}</span>`;
    return h;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── API helpers ── */
  async function apiGet(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function apiDelete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function loadCollection() {
    try {
      const data = await fetch('/api/collection').then(r => r.json());
      collection = Array.isArray(data) ? data : [];
    } catch { collection = []; }
  }

  /* ── Image compression ── */
  function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1024;
    quality = quality || 0.82;
    return new Promise(function (resolve) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      img.src = url;
    });
  }

  /* ── Router ── */
  function getRoute() {
    const hash = location.hash || '#/';
    if (hash.startsWith('#/collection')) return 'collection';
    return 'home';
  }

  function updateNavLinks() {
    const route = getRoute();
    document.querySelectorAll('.nav-link[data-nav]').forEach(function (link) {
      link.classList.toggle('active', link.dataset.nav === route);
    });
  }

  function navigate() {
    updateNavLinks();
    confirmDeleteId = null;
    const route = getRoute();
    if (route === 'collection') renderCollection();
    else renderHome();
  }

  window.addEventListener('hashchange', navigate);

  /* ── Footer year ── */
  $('.footer-copy').textContent = '\u00A9 ' + new Date().getFullYear() + ' GameShelf. All rights reserved.';

  /* ══════════════════════════════
     HOME PAGE
     ══════════════════════════════ */
  function renderHome() {
    const count = collection.length;
    const subtitleContent = count === 0
      ? 'Your collection is empty. <a href="#/collection" class="hero-link">Add some games</a> to get started.'
      : `Picks from your collection of ${count} game${count !== 1 ? 's' : ''}.`;

    main.innerHTML = `
      <section class="hero">
        <div class="hero-inner">
          <p class="hero-eyebrow">Your personal game night assistant</p>
          <h1 class="hero-headline">What Should We<br>Play Tonight?</h1>
          <p class="hero-subtitle">${subtitleContent}</p>
          <button class="cta-button" id="pickBtn" ${count === 0 ? 'disabled' : ''}>Pick a Game \u2192</button>
          <p class="error-message" id="homeError" style="display:none"></p>
        </div>
      </section>
      <div id="resultContainer"></div>
    `;

    $('#pickBtn').addEventListener('click', pickRandomGame);
  }

  async function pickRandomGame() {
    const btn = $('#pickBtn');
    const errEl = $('#homeError');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Picking...';

    try {
      const game = await apiGet('/api/random-game');
      renderGameCard(game);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = '';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Pick a Game \u2192';
    }
  }

  function renderGameCard(game) {
    const container = $('#resultContainer');
    container.innerHTML = `
      <section class="result-section">
        <div class="result-inner">
          <div class="game-card">
            <div class="card-header">
              <h2 class="game-name">${escapeHTML(game.name)}</h2>
              <div class="badges">${badgesHTML(game)}</div>
            </div>
            <p class="game-description">${escapeHTML(game.description || '')}</p>
            <button class="cta-button" id="pickAnotherBtn">Pick Another \u2192</button>
          </div>
        </div>
      </section>
    `;
    $('#pickAnotherBtn').addEventListener('click', pickRandomGame);
  }

  /* ══════════════════════════════
     COLLECTION PAGE
     ══════════════════════════════ */
  function renderCollection() {
    const count = collection.length;

    let gridHTML = '';
    if (count === 0) {
      gridHTML = `
        <div class="collection-empty">
          <div class="empty-icon">\u{1F3B2}</div>
          <p class="empty-title">No games yet</p>
          <p class="empty-subtitle">Click "Add New" to scan a box with your camera or add a game manually.</p>
        </div>`;
    } else {
      gridHTML = '<div class="collection-tile-grid">' + collection.map(function (g) {
        if (confirmDeleteId === g.id) {
          return `<div class="grid-tile">
            <div class="grid-tile-confirm">
              <span class="grid-tile-confirm-msg">Remove \u201C${escapeHTML(g.name)}\u201D?</span>
              <div class="grid-tile-confirm-actions">
                <button class="secondary-button" data-cancel-delete="${g.id}">Cancel</button>
                <button class="danger-button" data-confirm-delete="${g.id}">Remove</button>
              </div>
            </div>
          </div>`;
        }
        return `<div class="grid-tile">
          <button class="grid-tile-name" data-detail="${g.id}">${escapeHTML(g.name)}</button>
          <button class="grid-tile-delete" title="Remove from collection" data-delete="${g.id}">\u2715</button>
        </div>`;
      }).join('') + '</div>';
    }

    main.innerHTML = `
      <div class="collection-page">
        <div class="collection-inner">
          <div class="collection-page-header">
            <h1 class="collection-heading">
              MY COLLECTION
              ${count > 0 ? `<span class="collection-count">${count}</span>` : ''}
            </h1>
            <button class="add-game-button" id="addNewBtn">+ Add New</button>
          </div>
          ${gridHTML}
        </div>
      </div>
    `;

    // Event delegation
    $('#addNewBtn').addEventListener('click', openAddModal);

    main.addEventListener('click', function handler(e) {
      const detailBtn = e.target.closest('[data-detail]');
      if (detailBtn) {
        const game = collection.find(function (g) { return g.id === detailBtn.dataset.detail; });
        if (game) openDetailModal(game);
        return;
      }
      const deleteBtn = e.target.closest('[data-delete]');
      if (deleteBtn) {
        confirmDeleteId = deleteBtn.dataset.delete;
        renderCollection();
        return;
      }
      const cancelBtn = e.target.closest('[data-cancel-delete]');
      if (cancelBtn) {
        confirmDeleteId = null;
        renderCollection();
        return;
      }
      const confirmBtn = e.target.closest('[data-confirm-delete]');
      if (confirmBtn) {
        removeGame(confirmBtn.dataset.confirmDelete);
        return;
      }
    });
  }

  async function removeGame(id) {
    try {
      await apiDelete('/api/collection/' + id);
      collection = collection.filter(function (g) { return g.id !== id; });
      confirmDeleteId = null;
      renderCollection();
    } catch {}
  }

  /* ── Detail Modal ── */
  function openDetailModal(game) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Game Details</h2>
          <button class="modal-close">\u2715</button>
        </div>
        <h3 class="detail-modal-game-name">${escapeHTML(game.name)}</h3>
        <div class="badges" style="margin-top:12px;margin-bottom:16px">${badgesHTML(game)}</div>
        ${game.description ? `<p class="detail-game-description">${escapeHTML(game.description)}</p>` : ''}
        <div class="modal-actions" style="margin-top:24px">
          <button class="danger-button" id="modalRemoveBtn">Remove from Collection</button>
          <button class="secondary-button modal-close-btn">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    function close() { overlay.remove(); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.querySelector('#modalRemoveBtn').addEventListener('click', async function () {
      await removeGame(game.id);
      close();
    });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    });
  }

  /* ── Add Game Modal ── */
  function openAddModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    function close() { overlay.remove(); }

    function showChooseScreen() {
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Add a Game</h2>
            <button class="modal-close">\u2715</button>
          </div>
          <div class="add-choose-options">
            <button class="add-choose-btn" id="chooseCameraBtn">
              <span class="add-choose-icon">\u{1F4F7}</span>
              <span class="add-choose-label">Scan with Camera</span>
              <span class="add-choose-sub">Take a photo of the box to identify the game</span>
            </button>
            <button class="add-choose-btn" id="chooseManualBtn">
              <span class="add-choose-icon">\u270F\uFE0F</span>
              <span class="add-choose-label">Add Manually</span>
              <span class="add-choose-sub">Enter the game details yourself</span>
            </button>
          </div>
        </div>
      `;
      overlay.querySelector('.modal-close').addEventListener('click', close);
      overlay.querySelector('#chooseCameraBtn').addEventListener('click', function () {
        showCameraScreen();
        setTimeout(function () { fileInput.click(); }, 50);
      });
      overlay.querySelector('#chooseManualBtn').addEventListener('click', showManualScreen);
    }

    function showCameraScreen() {
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Scan with Camera</h2>
            <button class="modal-close">\u2715</button>
          </div>
          <button class="back-button" id="cameraBackBtn">\u2190 Back</button>
          <p class="camera-hint">Select a photo of the board game box to identify it automatically.</p>
        </div>
      `;
      overlay.querySelector('.modal-close').addEventListener('click', close);
      overlay.querySelector('#cameraBackBtn').addEventListener('click', showChooseScreen);

      fileInput.onchange = async function (e) {
        const file = e.target.files[0];
        if (!file) return;
        fileInput.value = '';

        // Show spinner
        const modal = overlay.querySelector('.modal');
        const hint = modal.querySelector('.camera-hint');
        if (hint) hint.remove();

        const spinnerDiv = document.createElement('div');
        spinnerDiv.className = 'identifying-state';
        spinnerDiv.innerHTML = '<div class="identifying-spinner"></div><p>Identifying game...</p>';
        modal.appendChild(spinnerDiv);

        try {
          const compressed = await compressImage(file);
          const formData = new FormData();
          formData.append('photo', compressed, 'photo.jpg');
          const res = await fetch('/api/collection/identify', { method: 'POST', body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Could not identify the game.');
          showPendingGame(data);
        } catch (err) {
          spinnerDiv.remove();
          const errDiv = document.createElement('div');
          errDiv.innerHTML = `
            <p class="identify-error">${escapeHTML(err.message)}</p>
            <div class="modal-actions">
              <button class="secondary-button" id="retryBtn">Try Again</button>
              <button class="secondary-button" id="cancelBtn">Cancel</button>
            </div>
          `;
          modal.appendChild(errDiv);
          errDiv.querySelector('#retryBtn').addEventListener('click', function () {
            errDiv.remove();
            const newHint = document.createElement('p');
            newHint.className = 'camera-hint';
            newHint.textContent = 'Select a photo of the board game box to identify it automatically.';
            modal.appendChild(newHint);
            setTimeout(function () { fileInput.click(); }, 50);
          });
          errDiv.querySelector('#cancelBtn').addEventListener('click', close);
        }
      };
    }

    function showPendingGame(game) {
      const modal = overlay.querySelector('.modal');
      // Clear everything after header
      while (modal.children.length > 1) modal.removeChild(modal.lastChild);

      const header = modal.querySelector('.modal-header');
      header.querySelector('.modal-title').textContent = 'Scan with Camera';

      const preview = document.createElement('div');
      preview.className = 'pending-preview';
      preview.innerHTML = `
        <p class="pending-label">Found it! Add this to your collection?</p>
        <h3 class="detail-modal-game-name">${escapeHTML(game.name)}</h3>
        <div class="badges" style="margin-top:12px">${badgesHTML(game)}</div>
        ${game.description ? `<p class="detail-game-description" style="margin-top:12px">${escapeHTML(game.description)}</p>` : ''}
        <div class="modal-actions">
          <button class="cta-button" id="addPendingBtn">Add to Collection</button>
          <button class="secondary-button" id="tryAgainBtn">Try Again</button>
          <button class="secondary-button" id="cancelPendingBtn">Cancel</button>
        </div>
      `;
      modal.appendChild(preview);

      preview.querySelector('#addPendingBtn').addEventListener('click', async function () {
        try {
          await apiPost('/api/collection/add', game);
          await loadCollection();
          close();
          renderCollection();
        } catch {}
      });
      preview.querySelector('#tryAgainBtn').addEventListener('click', function () {
        showCameraScreen();
        setTimeout(function () { fileInput.click(); }, 50);
      });
      preview.querySelector('#cancelPendingBtn').addEventListener('click', close);
    }

    function showManualScreen() {
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Add Manually</h2>
            <button class="modal-close">\u2715</button>
          </div>
          <button class="back-button" id="manualBackBtn">\u2190 Back</button>
          <form id="manualForm">
            <div class="form-group">
              <label class="form-label">Game Name *</label>
              <input class="form-input" type="text" name="name" placeholder="e.g. Catan" />
              <p class="form-error" id="formError" style="display:none"></p>
            </div>
            <div class="form-group">
              <label class="form-label">Players</label>
              <input class="form-input" type="text" name="players" placeholder="e.g. 2-4" />
            </div>
            <div class="form-group">
              <label class="form-label">Duration</label>
              <input class="form-input" type="text" name="duration" placeholder="e.g. 60-90 min" />
            </div>
            <div class="form-group">
              <label class="form-label">Difficulty</label>
              <select class="form-select" name="difficulty">
                <option value="Easy">Easy</option>
                <option value="Medium" selected>Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Genre</label>
              <input class="form-input" type="text" name="genre" placeholder="e.g. Strategy, Party" />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-textarea" name="description" rows="3" placeholder="Brief description of the game..."></textarea>
            </div>
            <div class="modal-actions">
              <button type="submit" class="cta-button">Add Game</button>
              <button type="button" class="secondary-button" id="cancelManualBtn">Cancel</button>
            </div>
          </form>
        </div>
      `;

      overlay.querySelector('.modal-close').addEventListener('click', close);
      overlay.querySelector('#manualBackBtn').addEventListener('click', showChooseScreen);
      overlay.querySelector('#cancelManualBtn').addEventListener('click', close);

      overlay.querySelector('#manualForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = fd.get('name').trim();
        const errEl = overlay.querySelector('#formError');
        if (!name) {
          errEl.textContent = 'Game name is required.';
          errEl.style.display = '';
          return;
        }
        errEl.style.display = 'none';
        try {
          await apiPost('/api/collection/add', {
            name: name,
            players: fd.get('players'),
            duration: fd.get('duration'),
            difficulty: fd.get('difficulty'),
            genre: fd.get('genre'),
            description: fd.get('description'),
          });
          await loadCollection();
          close();
          renderCollection();
        } catch {}
      });
    }

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    });
    showChooseScreen();
  }

  /* ── PIN Screen ── */
  function renderPinScreen() {
    document.querySelector('.navbar').style.display = 'none';
    document.querySelector('.footer').style.display = 'none';
    main.innerHTML = `
      <section class="hero" style="flex:1;display:flex;align-items:center;justify-content:center">
        <div class="hero-inner">
          <img src="/logo.svg" width="60" height="60" alt="" />
          <h1 class="hero-headline" style="font-size:32px;margin-top:16px">GAMESHELF</h1>
          <p class="hero-subtitle">Enter PIN to continue</p>
          <form id="pinForm" style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:8px">
            <input
              id="pinInput"
              class="form-input"
              type="password"
              inputmode="numeric"
              placeholder="PIN"
              autocomplete="off"
              style="text-align:center;font-size:24px;letter-spacing:8px;max-width:200px"
            />
            <button type="submit" class="cta-button" style="margin-top:0">Enter</button>
            <p class="error-message" id="pinError" style="display:none"></p>
          </form>
        </div>
      </section>
    `;
    $('#pinInput').focus();
    $('#pinForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const pin = $('#pinInput').value;
      const errEl = $('#pinError');
      errEl.style.display = 'none';
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Wrong PIN.');
        document.querySelector('.navbar').style.display = '';
        document.querySelector('.footer').style.display = '';
        await loadCollection();
        navigate();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = '';
        $('#pinInput').value = '';
        $('#pinInput').focus();
      }
    });
  }

  /* ── Service Worker Registration ── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(function () {});
  }

  /* ── Boot ── */
  async function boot() {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (!data.authenticated) {
        renderPinScreen();
        return;
      }
    } catch {}
    await loadCollection();
    navigate();
  }
  boot();
})();
