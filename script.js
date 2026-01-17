// script.js - completo y corregido

let continueWatching = JSON.parse(localStorage.getItem('continueWatching')) || [];
let featuredList = [];
let currentHeroIndex = 0;
let autoSlideInterval;
let moviesListInternal = window.moviesList || [];
let seriesListInternal = window.seriesList || [];
let touchStartX = 0;
let touchEndX = 0;
let currentModalItem = null;
let currentModalType = null;
let isPlayingTrailer = false; 
let currentView = 'home'; 

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar estado de historial para poder manejar back correctamente
    window.history.replaceState({ view: 'home', modal: false }, '');
    setTimeout(() => { initApp(); }, 200);
});

function initApp() {
    // Asegurarse de tener las referencias internas actualizadas (por si los scripts añadieron items posteriormente)
    moviesListInternal = window.moviesList || [];
    seriesListInternal = window.seriesList || [];

    renderHomeView();
    
    // Recién agregadas (limite 20), usando la secuencia exacta de carga
    if (window.allContentSequence && window.allContentSequence.length > 0) {
        const strictOrderList = [...window.allContentSequence].reverse();
        renderList('newlyAddedRow', strictOrderList.slice(0, 20));
    } else {
        const allContent = [...moviesListInternal, ...seriesListInternal];
        renderList('newlyAddedRow', allContent.reverse().slice(0, 20));
    }

    renderContinueWatching();
    setupHero(); // Configura el Hero basado en id.js
    setupEventListeners();
    switchView('home', false);
}

// --- HERO (lee window.HERO_IDS) ---
function setupHero() {
    // Actualizar listas por si cambiaron
    moviesListInternal = window.moviesList || [];
    seriesListInternal = window.seriesList || [];
    const allContent = [...moviesListInternal, ...seriesListInternal];

    featuredList = [];

    if (window.HERO_IDS && Array.isArray(window.HERO_IDS) && window.HERO_IDS.length > 0) {
        // Si los elementos son objetos (referencias), úsalos en orden
        // Si los elementos son strings/números, búscalos en allContent por .id o por variableName
        featuredList = window.HERO_IDS.map(entry => {
            if (!entry && entry !== 0) return null;
            // Si ya es objeto con propiedades (title o id), úsalo tal cual
            if (typeof entry === 'object') return entry;
            // Si es string/number (por ejemplo "p12" o 123), buscar en allContent por id igual
            const str = String(entry);
            return allContent.find(i => String(i.id) === str) || null;
        }).filter(Boolean);
    }

    // Fallback: si no hay ninguno, tomar los marcados featured
    if (featuredList.length === 0) {
        const allFeatured = allContent.filter(i => i.featured);
        featuredList = allFeatured.slice(0, 5);
    }

    renderHero();
    startAutoSlide();
}

function renderHero() {
    const container = document.querySelector('.carousel-container');
    const dots = document.getElementById('heroDots');
    if (!container || featuredList.length === 0) {
        container.innerHTML = '';
        dots.innerHTML = '';
        return;
    }
    
    container.innerHTML = featuredList.map((item, i) => `
        <div class="carousel-slide" data-index="${i}" style="display:${i===0 ? 'block' : 'none'}">
            <img src="${item.image}" alt="Hero Image">
        </div>
    `).join('');
    
    dots.innerHTML = featuredList.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('');

    // Añadir listeners a dots para saltar a slide
    Array.from(dots.querySelectorAll('.dot')).forEach(dot => {
        dot.onclick = (e) => {
            const idx = Number(e.currentTarget.getAttribute('data-index'));
            updateHeroVisuals(idx);
            startAutoSlide(); // reiniciar temporizador
        };
    });

    currentHeroIndex = 0;
}

// Cambia la visualización para que solo la slide actual sea visible
function updateHeroVisuals(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    if (slides.length === 0) return;
    slides.forEach(s => s.style.display = 'none');
    dots.forEach(d => d.classList.remove('active'));

    currentHeroIndex = ((index % slides.length) + slides.length) % slides.length;
    slides[currentHeroIndex].style.display = 'block';
    if (dots[currentHeroIndex]) dots[currentHeroIndex].classList.add('active');
}

function nextHeroSlide() {
    if (featuredList.length === 0) return;
    updateHeroVisuals(currentHeroIndex + 1);
}

function prevHeroSlide() {
    if (featuredList.length === 0) return;
    updateHeroVisuals(currentHeroIndex - 1);
}

function startAutoSlide() { 
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(nextHeroSlide, 5000);
}

// --- Vistas / Renderizados ---
function renderHomeView() {
    const moviesShuffled = [...moviesListInternal];
    const seriesShuffled = [...seriesListInternal];
    shuffleArray(moviesShuffled);
    shuffleArray(seriesShuffled);

    renderMultiRow('homeMoviesRow', moviesShuffled.slice(0, 30));
    renderMultiRow('homeSeriesRow', seriesShuffled.slice(0, 30));
}

function switchView(viewName, pushToHistory = true) {
    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-movies').classList.add('hidden');
    document.getElementById('view-series').classList.add('hidden');
    document.getElementById('searchOverlay').style.display = 'none';
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    window.scrollTo({top: 0, behavior: 'auto'});
    currentView = viewName;

    if (viewName === 'home') {
        document.getElementById('view-home').classList.remove('hidden');
        document.getElementById('nav-home').classList.add('active');
        renderHomeView(); 
    } else if (viewName === 'movies') {
        document.getElementById('view-movies').classList.remove('hidden');
        document.getElementById('nav-movies').classList.add('active');
        
        const moviesShuffled = [...moviesListInternal];
        shuffleArray(moviesShuffled);
        renderList('allMoviesGrid', moviesShuffled);

    } else if (viewName === 'series') {
        document.getElementById('view-series').classList.remove('hidden');
        document.getElementById('nav-series').classList.add('active');
        
        const seriesShuffled = [...seriesListInternal];
        shuffleArray(seriesShuffled);
        renderList('allSeriesGrid', seriesShuffled);
    }

    if (pushToHistory) window.history.pushState({ view: viewName, modal: false }, '');
}

function renderMultiRow(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        const start = i * 10;
        const end = start + 10;
        const chunk = list.slice(start, end);
        if (chunk.length === 0) break;

        const rowDiv = document.createElement('div');
        rowDiv.className = 'row horizontal-scroll';
        rowDiv.innerHTML = chunk.map(item => createItemHTML(item)).join('');
        container.appendChild(rowDiv);
    }
}

function renderList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = list.map(item => createItemHTML(item)).join('');
}

function createItemHTML(item) {
    // item puede venir con item.type (continueWatching) o deducirlo por seasons
    const type = item.type || (item.seasons ? 'series' : 'movies');
    // Asegurarse que item.id exista como valor serializable
    const idVal = item.id === undefined ? '' : String(item.id);
    return `
        <div class="item" onclick="openModal('${escapeHtml(idVal)}', '${type}')">
            <img src="${escapeHtml(item.image || '')}" loading="lazy" alt="${escapeHtml(item.title || '')}">
            <div class="item-title">${escapeHtml(item.title || '')}</div>
        </div>
    `;
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
              .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- MODAL Y REPRODUCCIÓN ---
function openModal(id, type) {
    // Cerrar overlay de búsqueda si está abierto
    const searchOverlay = document.getElementById('searchOverlay');
    if(searchOverlay && searchOverlay.style.display === 'block') {
        searchOverlay.style.display = 'none';
    }

    // Buscar item por id dentro de las listas
    const idStr = String(id);
    // Primero buscar en la lista del tipo indicado
    let list = (type === 'movies' ? moviesListInternal : (type === 'series' ? seriesListInternal : []));
    let item = list.find(i => String(i.id) === idStr);

    if (!item) {
        // Buscar en todas
        item = [...moviesListInternal, ...seriesListInternal].find(i => String(i.id) === idStr);
    }

    // Si no existe el objeto, intentar si window.HERO_IDS contiene esa referencia (caso variable directa)
    if (!item && window.HERO_IDS && Array.isArray(window.HERO_IDS)) {
        const match = window.HERO_IDS.find(e => {
            if (!e) return false;
            if (typeof e === 'object' && String(e.id) === idStr) return true;
            return false;
        });
        if (match) item = match;
    }

    if (!item) {
        console.warn('openModal: no se encontró item con id=', idStr);
        return;
    }

    currentModalItem = item;
    currentModalType = type;

    // Push state para que el botón atrás cierre el modal
    window.history.pushState({ view: currentView, modal: true, id: item.id }, '');

    const modal = document.getElementById('videoModal');
    const titleEl = document.getElementById('modalTitle');
    const descEl = document.getElementById('modalDesc');
    const actionBtn = document.getElementById('modalActionBtn');
    const episodesDiv = document.getElementById('seriesEpisodeSelector');
    const modalIdEl = document.getElementById('modalId');

    document.body.classList.add('modal-open');

    titleEl.innerText = item.title || '';
    modalIdEl.innerText = item.id !== undefined ? `ID: ${item.id}` : '';
    document.getElementById('modalYear').innerText = item.year || '';
    document.getElementById('modalType').innerText = (item.seasons ? 'Serie' : 'Película');
    descEl.innerText = item.info || '';
    
    if (item.seasons) {
        episodesDiv.classList.remove('hidden');
        const select = document.getElementById('modalSeasonSelect');
        select.innerHTML = item.seasons.map(s => `<option value="${s.season}">Temporada ${s.season}</option>`).join('');
        renderEpisodes(item.seasons[0], item, 0); 

        actionBtn.innerHTML = '<i class="fas fa-film"></i> Ver Tráiler';
        actionBtn.onclick = () => {
             setPlayerVideo(item.trailer, "Tráiler");
             document.querySelectorAll('.episode-button').forEach(b => b.classList.remove('active'));
        };

        select.onchange = (e) => {
            const val = e.target.value;
            const season = item.seasons.find(s => String(s.season) === String(val));
            if(season) renderEpisodes(season, item, -1);
        };
    } else {
        episodesDiv.classList.add('hidden');
        setPlayerVideo(item.video); 
        addToContinueWatching(item, 'movies');
        isPlayingTrailer = false;
        actionBtn.innerHTML = '<i class="fas fa-film"></i> Ver Tráiler';
        
        actionBtn.onclick = () => {
            if (isPlayingTrailer) {
                setPlayerVideo(item.video);
                actionBtn.innerHTML = '<i class="fas fa-film"></i> Ver Tráiler';
                isPlayingTrailer = false;
            } else {
                setPlayerVideo(item.trailer, "Tráiler");
                actionBtn.innerHTML = '<i class="fas fa-play"></i> Ver Película';
                isPlayingTrailer = true;
            }
        };
    }

    renderRealRecommendations(item.id);
    modal.style.display = 'flex';
}

function renderEpisodes(season, serieItem, autoPlayIndex = -1) {
    const container = document.getElementById('modalEpisodesContainer');
    container.innerHTML = ''; 
    if(!season || !season.episodes) return;
    container.innerHTML = season.episodes.map((ep, idx) => `
        <button class="episode-button ${idx === autoPlayIndex ? 'active' : ''}" data-idx="${idx}">${ep.episode}</button>
    `).join('');

    if (autoPlayIndex >= 0 && season.episodes[autoPlayIndex]) {
        const ep = season.episodes[autoPlayIndex];
        setPlayerVideo(ep.video, `T${season.season}: Cap ${ep.episode}`);
        addToContinueWatching(serieItem, 'series');
    }

    const buttons = container.querySelectorAll('.episode-button');
    buttons.forEach((btn, index) => {
        btn.onclick = () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const ep = season.episodes[index];
            setPlayerVideo(ep.video, `T${season.season}: Cap ${ep.episode}`);
            addToContinueWatching(serieItem, 'series');
        };
    });
}

function setPlayerVideo(url, overlayText = null) {
    const playerDiv = document.getElementById('modalContentPlayer');
    playerDiv.innerHTML = ''; 
    if (!url) {
        playerDiv.innerHTML = '<div class="video-container" style="display:flex;align-items:center;justify-content:center;color:gray;">Video no disponible</div>';
        return;
    }
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.style.width = '100%';
    iframe.style.height = '360px';
    const container = document.createElement('div');
    container.className = 'video-container';
    container.appendChild(iframe);
    if (overlayText) {
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay-label';
        overlay.innerText = overlayText;
        container.appendChild(overlay);
    }
    playerDiv.appendChild(container);
}

function renderRealRecommendations(currentId) {
    const container = document.getElementById('modalRecommendations');
    let allContent = [...moviesListInternal, ...seriesListInternal].filter(i => String(i.id) !== String(currentId));
    shuffleArray(allContent);
    const selection = allContent.slice(0, 6);
    container.innerHTML = selection.map(item => `
        <div class="item" onclick="openModal('${item.id}', '${item.seasons ? 'series' : 'movies'}')">
            <img src="${item.image || ''}">
            <div class="item-title">${item.title || ''}</div>
        </div>
    `).join('');
}

// --- Continue watching ---
function addToContinueWatching(item, type) {
    continueWatching = continueWatching.filter(i => String(i.id) !== String(item.id));
    continueWatching.unshift({ ...item, type });
    if (continueWatching.length > 10) continueWatching.pop();
    localStorage.setItem('continueWatching', JSON.stringify(continueWatching));
    renderContinueWatching();
}

function renderContinueWatching() {
    const row = document.getElementById('continueWatching');
    const container = document.getElementById('continueWatchingContainer');
    if (!row) return;
    if (continueWatching.length === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    row.innerHTML = continueWatching.map(item => createItemHTML(item)).join('');
}

// --- Eventos y navegación ---
function setupEventListeners() {
    // Hero click: abre modal del elemento actualmente visible
    const hero = document.getElementById('hero');
    if (hero) {
        hero.onclick = (e) => {
            // Evitar abrir si hubo un swipe
            if (Math.abs(touchStartX - touchEndX) < 10) {
                const current = featuredList[currentHeroIndex];
                if (current) openModal(current.id, current.seasons ? 'series' : 'movies');
            }
        };
        hero.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, {passive: true});
        hero.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            const dist = touchEndX - touchStartX;
            if (Math.abs(dist) > 30) {
                if (dist < 0) nextHeroSlide(); else prevHeroSlide();
                startAutoSlide();
            }
        }, {passive: true});
    }

    // Botón cerrar modal: usar history.back() si tenemos state modal
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            // Si el estado actual en history indica modal = true, hacer back para activar popstate y cerrar correctamente
            const state = window.history.state;
            if (state && state.modal) {
                window.history.back();
            } else {
                // fallback si no hay state
                hideModal();
                window.history.replaceState({ view: currentView, modal: false }, '');
            }
        };
    }

    // Manejo popstate: cerrar modal al navegar atrás
    window.addEventListener('popstate', (e) => {
        const state = e.state || { view: 'home', modal: false };
        if (state.modal) {
            // Si por alguna razón recibimos un estado modal=true, abrir el modal correspondiente (si existe id)
            if (state.id) {
                // Intentar abrir modal del id sin push extra
                openModal(state.id, 'movies');
            }
        } else {
            // Cerrar modal si estaba abierto
            hideModal();
            if (state.view) {
                switchView(state.view, false);
            } else {
                // Si no hay view en state, volver a home
                switchView('home', false);
            }
        }
    });

    // Navegación inferior
    const navHome = document.getElementById('nav-home');
    const navMovies = document.getElementById('nav-movies');
    const navSeries = document.getElementById('nav-series');
    const navSearch = document.getElementById('nav-search');

    if (navHome) navHome.onclick = (e) => { e.preventDefault(); switchView('home'); };
    if (navMovies) navMovies.onclick = (e) => { e.preventDefault(); switchView('movies'); };
    if (navSeries) navSeries.onclick = (e) => { e.preventDefault(); switchView('series'); };
    if (navSearch) navSearch.onclick = (e) => { e.preventDefault(); openSearch(); };

    // Search overlay
    const closeSearch = document.getElementById('closeSearch');
    if (closeSearch) closeSearch.onclick = () => { document.getElementById('searchOverlay').style.display = 'none'; };

    // Cerrar modal al click en fondo (opcional)
    const modal = document.getElementById('videoModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // similar a presionar back
                const state = window.history.state;
                if (state && state.modal) window.history.back();
                else hideModal();
            }
        });
    }
}

function openSearch() {
    document.getElementById('searchOverlay').style.display = 'block';
    // No se hace pushState para búsqueda; ajustar si se desea
}

function hideModal() {
    const modal = document.getElementById('videoModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    // Parar el iframe (limpiar)
    const playerDiv = document.getElementById('modalContentPlayer');
    if (playerDiv) playerDiv.innerHTML = '';
    currentModalItem = null;
    currentModalType = null;
    isPlayingTrailer = false;
}

// --- Ayudas ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
              .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}