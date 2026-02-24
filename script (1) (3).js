let continueWatching = JSON.parse(localStorage.getItem('continueWatching')) || [];
let myFavorites = JSON.parse(localStorage.getItem('myFavorites')) || [];
let currentUser = JSON.parse(localStorage.getItem('auraflixUser')) || null;
let savedGridSize = localStorage.getItem('auraflixGridSize') || 'normal';
let seriesMemory = JSON.parse(localStorage.getItem('auraflixSeriesMemory')) || {};

// NUEVA MEMORIA: Guarda permanentemente lo que el usuario ya desbloqueó
let unlockedMemory = JSON.parse(localStorage.getItem('auraflixUnlockedMemory')) || [];

let moviesListInternal = [];
let seriesListInternal = [];
let featuredList = [];

let currentHeroIndex = 0;
let autoSlideInterval;
let currentModalItem = null;
let currentSeasonIndex = 0;
let isPlayingTrailer = false; 
let currentView = 'home';
let selectedAvatarTemp = null; 
let touchStartX = 0;
let touchEndX = 0;

window.deepLinkSeason = null;
window.deepLinkEpisode = null;

const ALL_GENRES = [
    "Acción", "Aventura", "Animación", "Comedia", "Crimen", "Documental", 
    "Drama", "Familia", "Fantasía", "Historia", "Terror", "Música", 
    "Misterio", "Romance", "Ciencia ficción", "Película de TV", 
    "Suspenso", "Bélica", "Western"
];
let movieFilters = [];
let seriesFilters = [];
let tempFilters = [];
let currentFilterContext = '';

const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

window.addEventListener('load', () => {
    setTimeout(iniciarTodo, 10);
});

function iniciarTodo() {
    injectImageStyles();
    optimizeConnections();

    window.moviesList = window.moviesList || [];
    window.seriesList = window.seriesList || [];
    
    if (savedGridSize === 'small') {
        document.body.classList.add('grid-small');
    } else {
        document.body.classList.remove('grid-small');
    }

    checkLoginStatus();
    
    try {
        window.history.replaceState({ view: 'home', modal: false, search: false, history: false }, '');
    } catch (e) {}
    
    const avatarInput = document.getElementById('customAvatarInput');
    if(avatarInput) {
        avatarInput.addEventListener('change', handleImageUpload);
    }
    
    setupEventListeners();
    setupAutoRotation();
}

function setupAutoRotation() {
    const handleRotation = async () => {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        if (isFullscreen && screen.orientation && screen.orientation.lock) {
            try { await screen.orientation.lock('landscape'); } catch (e) {}
        }
    };
    document.addEventListener('fullscreenchange', handleRotation);
    document.addEventListener('webkitfullscreenchange', handleRotation);
}

function optimizeConnections() {
    const allItems = [...window.moviesList, ...window.seriesList].slice(0, 20);
    const domains = new Set();
    allItems.forEach(item => {
        try { if(item.image) domains.add(new URL(item.image).origin); } catch(e) {}
    });
    domains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'preconnect'; link.href = domain;
        document.head.appendChild(link);
    });
}

function injectImageStyles() {
    const styleId = 'auraflix-smooth-images';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .smooth-image { opacity: 0; transition: opacity 0.4s ease-out; }
        .smooth-image.loaded { opacity: 1; }
        #modalContentPlayer { background-color: #000; }
    `;
    document.head.appendChild(style);
}

function checkLoginStatus() {
    if (!currentUser) {
        document.getElementById('loginScreen').style.display = 'flex';
        renderAvatarSelection('avatarGrid', 'login');
    } else {
        document.getElementById('loginScreen').style.display = 'none';
        loadUserDataInUI();
        checkDataReady();
    }
}

function checkDataReady() {
    if (window.moviesList.length > 0 || window.seriesList.length > 0) {
        initApp();
        setTimeout(checkDeepLinks, 300);
    } else {
        setTimeout(checkDataReady, 100);
    }
}

function initApp() {
    window.moviesList.originalOrder = window.moviesList.originalOrder || [...window.moviesList];
    window.seriesList.originalOrder = window.seriesList.originalOrder || [...window.seriesList];
    shuffleArray(window.moviesList);
    shuffleArray(window.seriesList);
    renderHomeView();
    renderList('newlyAddedRow', (window.globalContent && window.globalContent.length > 0 ? window.globalContent : [...window.moviesList.originalOrder, ...window.seriesList.originalOrder]).slice(0, 20));
    setupHero(); 
    setupLatelyNew();
}

// SEGURIDAD CON MEMORIA PERMANENTE
function checkDeepLinks() {
    let url = window.location.href;
    if (!url.includes('?')) return;
    const urlParams = new URLSearchParams(url.substring(url.indexOf('?')));
    
    if (urlParams.has('movie')) {
        const val = urlParams.get('movie');
        const parts = val.split('-');
        const id = parts[0]; 
        
        if (parts.includes('vip')) {
            const ticketTime = localStorage.getItem('auraflix_tkt_' + id);
            const now = new Date().getTime();
            
            // Si el ticket es válido y no han pasado 30 minutos
            if (ticketTime && (now - parseInt(ticketTime)) < 1800000) {
                if (!unlockedMemory.includes(String(id))) {
                    unlockedMemory.push(String(id));
                    localStorage.setItem('auraflixUnlockedMemory', JSON.stringify(unlockedMemory));
                }
                localStorage.removeItem('auraflix_tkt_' + id); // Se consume el ticket
                // Limpia el -vip de la URL
                window.history.replaceState({}, '', window.location.href.replace('-vip', ''));
            } else if (!unlockedMemory.includes(String(id))) {
                // Si no tiene memoria y no hay ticket válido
                alert("El desbloqueo expiró o el enlace no es válido. Debes desbloquear el contenido nuevamente.");
                window.history.replaceState({}, '', window.location.href.replace('-vip', ''));
            }
        }
        openModal(id, 'movies');
        
    } else if (urlParams.has('serie')) {
        const val = urlParams.get('serie');
        const parts = val.split('-');
        const id = parts[0];
        const sStr = parts.find(p => p.startsWith('t'));
        const eStr = parts.find(p => p.startsWith('e'));
        
        if (sStr && eStr) {
            window.deepLinkSeason = parseInt(sStr.replace('t', ''));
            window.deepLinkEpisode = parseInt(eStr.replace('e', ''));
        }
        
        if (parts.includes('vip')) {
            const sNum = sStr ? sStr.replace('t','') : '';
            const eNum = eStr ? eStr.replace('e','') : '';
            const ticketKey = `${id}-t${sNum}-e${eNum}`;
            const ticketTime = localStorage.getItem('auraflix_tkt_' + ticketKey);
            const now = new Date().getTime();
            
            if (ticketTime && (now - parseInt(ticketTime)) < 1800000) {
                if (!unlockedMemory.includes(ticketKey)) {
                    unlockedMemory.push(ticketKey);
                    localStorage.setItem('auraflixUnlockedMemory', JSON.stringify(unlockedMemory));
                }
                localStorage.removeItem('auraflix_tkt_' + ticketKey);
                window.history.replaceState({}, '', window.location.href.replace('-vip', ''));
            } else if (!unlockedMemory.includes(ticketKey)) {
                alert("El desbloqueo expiró o el enlace no es válido. Debes desbloquear el contenido nuevamente.");
                window.history.replaceState({}, '', window.location.href.replace('-vip', ''));
            }
        }
        openModal(id, 'series');
    }
}

function renderAvatarSelection(containerId, context) {
    const grid = document.getElementById(containerId);
    if(!grid) return; grid.innerHTML = '';
    if (typeof profileImages !== 'undefined') {
        profileImages.forEach((url) => {
            const div = document.createElement('div');
            div.className = 'avatar-option';
            div.innerHTML = `<img src="${url}" class="smooth-image" onload="this.classList.add('loaded')">`;
            div.onclick = () => {
                grid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected'); selectedAvatarTemp = url;
            };
            grid.appendChild(div);
        });
    }
    const addBtn = document.createElement('div');
    addBtn.className = 'avatar-option';
    addBtn.innerHTML = `<div class="upload-btn"><i class="fas fa-plus"></i></div>`;
    addBtn.onclick = () => document.getElementById('customAvatarInput').click();
    grid.appendChild(addBtn);
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        selectedAvatarTemp = event.target.result;
        const gridId = document.getElementById('loginScreen').style.display === 'flex' ? 'avatarGrid' : 'changeAvatarGrid';
        const grid = document.getElementById(gridId);
        grid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        alert("Imagen cargada. Presiona Guardar para aplicar.");
    };
    reader.readAsDataURL(file);
}

function loadUserDataInUI() {
    if (!currentUser) return;
    document.getElementById('navProfileImg').src = currentUser.avatar;
    document.getElementById('profilePageImg').src = currentUser.avatar;
    document.getElementById('profilePageName').innerText = currentUser.name;
    if (typeof checkVipTimerUI === 'function') checkVipTimerUI();
    renderMyList(); 
}

function setupHero() {
    const all = [...(window.moviesList.originalOrder || []), ...(window.seriesList.originalOrder || [])];
    featuredList = [];
    if (window.HERO_IDS && window.HERO_IDS.length > 0) {
        window.HERO_IDS.forEach(config => {
            let tid = typeof config === 'object' ? config.id : config;
            let item = all.find(i => String(i.id) === String(tid));
            if (item) {
                let copy = {...item};
                if (config.img) copy.image = config.img;
                featuredList.push(copy);
            }
        });
    } else { featuredList = all.slice(0, 5); }
    renderHero(); startAutoSlide();
}

function renderHero() {
    const container = document.querySelector('.carousel-container');
    const dots = document.getElementById('heroDots');
    if (!container || featuredList.length === 0) return;
    container.innerHTML = featuredList.map((item, i) => `
        <div class="carousel-slide ${i === 0 ? 'active' : ''}"><img src="${item.image}" class="smooth-image" onload="this.classList.add('loaded')"></div>
    `).join('');
    dots.innerHTML = featuredList.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');
}

function nextHeroSlide() { updateHeroVisuals((currentHeroIndex + 1) % featuredList.length); }
function prevHeroSlide() { updateHeroVisuals((currentHeroIndex - 1 + featuredList.length) % featuredList.length); }

function updateHeroVisuals(index) {
    const slides = document.querySelectorAll('.carousel-slide'), dots = document.querySelectorAll('.dot');
    if(!slides.length) return;
    slides[currentHeroIndex].classList.remove('active'); dots[currentHeroIndex].classList.remove('active');
    currentHeroIndex = index;
    slides[currentHeroIndex].classList.add('active'); dots[currentHeroIndex].classList.add('active');
}

function startAutoSlide() { clearInterval(autoSlideInterval); autoSlideInterval = setInterval(nextHeroSlide, 5000); }

function setupLatelyNew() {
    const container = document.getElementById('latelyNewGrid');
    if (!container || !window.LATELY_IDS) return;
    const all = [...(window.moviesList.originalOrder || []), ...(window.seriesList.originalOrder || [])];
    let list = [];
    window.LATELY_IDS.forEach(id => { let it = all.find(i => String(i.id) === String(id)); if(it) list.push(it); });
    container.innerHTML = list.map((item, i) => createItemHTML(item, i)).join('');
}

function renderHomeView() {
    renderMultiRow('homeMoviesRow', window.moviesList.slice(0, 30));
    renderMultiRow('homeSeriesRow', window.seriesList.slice(0, 30));
}

function renderList(id, list) {
    const c = document.getElementById(id);
    if (c) c.innerHTML = list.map((item, i) => createItemHTML(item, i)).join('');
}

function renderMultiRow(id, list) {
    const c = document.getElementById(id);
    if (!c) return; c.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const chunk = list.slice(i * 10, (i + 1) * 10);
        if (!chunk.length) break;
        const row = document.createElement('div'); row.className = 'row horizontal-scroll';
        row.innerHTML = chunk.map((item, j) => createItemHTML(item, j)).join('');
        c.appendChild(row);
    }
}

function createItemHTML(item, index = 100) {
    const type = item.seasons ? 'series' : 'movies';
    return `
        <div class="item" onclick="openModal('${String(item.id).replace(/'/g, "\\'")}', '${type}')">
            <img src="${item.image}" class="smooth-image" onload="this.classList.add('loaded')" loading="${index < 6 ? 'eager' : 'lazy'}">
            <div class="item-title">${item.title}</div>
        </div>
    `;
}
function openFilterModal(context) {
    currentFilterContext = context;
    const modal = document.getElementById('filterModal');
    if (context === 'movies') tempFilters = [...movieFilters];
    else tempFilters = [...seriesFilters];
    renderFilterChips();
    modal.style.display = 'flex';
}

function renderFilterChips() {
    const container = document.getElementById('genresContainer');
    container.innerHTML = '';
    ALL_GENRES.forEach(genre => {
        const btn = document.createElement('button');
        const isSelected = tempFilters.some(f => normalizeText(f) === normalizeText(genre));
        btn.className = `genre-tag ${isSelected ? 'selected' : ''}`;
        btn.innerText = genre;
        btn.onclick = () => {
            const existsIndex = tempFilters.findIndex(f => normalizeText(f) === normalizeText(genre));
            if (existsIndex !== -1) {
                tempFilters.splice(existsIndex, 1);
                btn.classList.remove('selected');
            } else {
                tempFilters.push(genre);
                btn.classList.add('selected');
            }
        };
        container.appendChild(btn);
    });
}

function applyFilters() {
    if (currentFilterContext === 'movies') {
        movieFilters = [...tempFilters];
        renderFilteredMovies();
    } else {
        seriesFilters = [...tempFilters];
        renderFilteredSeries();
    }
    document.getElementById('filterModal').style.display = 'none';
}

function clearFilters() {
    tempFilters = [];
    if (currentFilterContext === 'movies') { movieFilters = []; renderFilteredMovies(); } 
    else { seriesFilters = []; renderFilteredSeries(); }
    document.getElementById('filterModal').style.display = 'none';
}

function getItemGenres(item) {
    if (Array.isArray(item.genres)) return item.genres;
    if (typeof item.genre === 'string') return item.genre.split(',').map(g => g.trim());
    if (Array.isArray(item.genre)) return item.genre;
    return [];
}

function renderFilteredMovies() {
    const container = document.getElementById('allMoviesGrid');
    const displayFilterText = document.getElementById('activeFiltersMovies');
    
    let listToShow = [...window.moviesList]; 
    
    if (movieFilters.length > 0) {
        displayFilterText.innerText = "Filtros: " + movieFilters.join(", ");
        displayFilterText.style.display = 'block';
        listToShow = listToShow.filter(item => {
            const itemGenres = getItemGenres(item);
            return movieFilters.some(filter => 
                itemGenres.some(ig => normalizeText(ig) === normalizeText(filter))
            );
        });
    } else {
        displayFilterText.style.display = 'none';
    }
    
    if (listToShow.length === 0) container.innerHTML = '<p style="padding:20px; color:#666; width:100%; text-align:center;">No hay resultados.</p>';
    else renderList('allMoviesGrid', listToShow);
}

function renderFilteredSeries() {
    const container = document.getElementById('allSeriesGrid');
    const displayFilterText = document.getElementById('activeFiltersSeries');
    
    let listToShow = [...window.seriesList];
    
    if (seriesFilters.length > 0) {
        displayFilterText.innerText = "Filtros: " + seriesFilters.join(", ");
        displayFilterText.style.display = 'block';
        listToShow = listToShow.filter(item => {
            const itemGenres = getItemGenres(item);
            return seriesFilters.some(filter => 
                itemGenres.some(ig => normalizeText(ig) === normalizeText(filter))
            );
        });
    } else {
        displayFilterText.style.display = 'none';
    }
    
    if (listToShow.length === 0) container.innerHTML = '<p style="padding:20px; color:#666; width:100%; text-align:center;">No hay resultados.</p>';
    else renderList('allSeriesGrid', listToShow);
}

function openModal(id, typeHint) {
    document.getElementById('searchOverlay').style.display = 'none';
    document.getElementById('historyOverlay').style.display = 'none';

    if (!document.body.classList.contains('modal-open')) {
        window.history.pushState({ view: currentView, modal: true }, '');
    }

    const idStr = String(id);
    const allContent = [...window.moviesList, ...window.seriesList];
    const item = allContent.find(i => String(i.id) === idStr);
    
    if (!item) return;

    currentModalItem = item;
    const isSeries = (item.seasons && item.seasons.length > 0) || typeHint === 'series';

    const modal = document.getElementById('videoModal');
    const titleEl = document.getElementById('modalTitle');
    const descEl = document.getElementById('modalDesc');
    const actionBtn = document.getElementById('modalActionBtn');
    const episodesDiv = document.getElementById('seriesEpisodeSelector');
    const favBtn = document.getElementById('modalFavBtn');
    const shareBtn = document.getElementById('modalShareItemBtn');
    const yearEl = document.getElementById('modalYear');
    const sepEl = document.getElementById('modalSeparator');
    const genresEl = document.getElementById('modalGenres');

    document.body.classList.add('modal-open');
    document.querySelector('.modal-content').scrollTop = 0;

    titleEl.innerText = item.title;
    yearEl.innerText = item.year || '';
    descEl.innerText = item.info || '';

    const g = getItemGenres(item);
    let genreDisplay = "";
    if (g.length > 0) {
        const slice = g.slice(0, 3);
        genreDisplay = slice.join(' / ');
        if (g.length > 3) { genreDisplay += "..."; }
    }
    
    if (genreDisplay) {
        genresEl.innerText = genreDisplay;
        sepEl.style.display = 'inline';
        genresEl.style.display = 'inline';
    } else {
        sepEl.style.display = 'none';
        genresEl.style.display = 'none';
    }

    const isFav = myFavorites.some(i => String(i.id) === String(item.id));
    if(isFav) favBtn.classList.add('active'); else favBtn.classList.remove('active');
    favBtn.onclick = toggleFavorite;
    
    // COMPARTIR NORMAL SIEMPRE (SIN VIP)
    if (shareBtn) {
        shareBtn.onclick = () => {
            const baseUrl = window.location.origin + window.location.pathname;
            let shareUrl = baseUrl;
            const currentYear = new Date().getFullYear();
            
            if (!isSeries) {
                shareUrl += `?movie=${item.id}-${item.year || currentYear}`;
            } else {
                const seasonObj = item.seasons[currentSeasonIndex];
                const activeEpBtn = document.querySelector('.episode-button.active');
                let epNumber = 1;
                
                if (activeEpBtn) {
                    const idx = parseInt(activeEpBtn.getAttribute('data-idx'));
                    if(!isNaN(idx) && seasonObj.episodes[idx]) {
                        epNumber = seasonObj.episodes[idx].episode;
                    }
                }
                shareUrl += `?serie=${item.id}-t${seasonObj.season}-e${epNumber}`;
            }
            
            if (navigator.share) {
                navigator.share({ 
                    title: `Ver ${item.title} en Auraflix`, 
                    text: `Mira ${item.title} aquí:`,
                    url: shareUrl 
                }).catch(()=>{});
            } else {
                const tempInput = document.createElement("input");
                tempInput.value = shareUrl;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand("copy");
                document.body.removeChild(tempInput);
                alert("Enlace copiado al portapapeles:\n" + shareUrl);
            }
        };
    }

    const isVipGlobal = typeof isUserVip === 'function' ? isUserVip() : false;

    if (isSeries) {
        episodesDiv.classList.remove('hidden');
        if (item.seasons && item.seasons.length > 0) {
            let startSeasonIdx = 0;
            let startEpIdx = 0;

            if (window.deepLinkSeason && window.deepLinkEpisode) {
                const sIdx = item.seasons.findIndex(s => parseInt(s.season) === window.deepLinkSeason);
                if (sIdx !== -1) {
                    startSeasonIdx = sIdx;
                    const eIdx = item.seasons[sIdx].episodes.findIndex(e => parseInt(e.episode) === window.deepLinkEpisode);
                    if (eIdx !== -1) startEpIdx = eIdx;
                }
                window.deepLinkSeason = null;
                window.deepLinkEpisode = null;
            } else {
                // Leer memoria de capítulos
                const mem = seriesMemory[item.id];
                if (mem) {
                    const sIdx = item.seasons.findIndex(s => String(s.season) === String(mem.season));
                    if (sIdx !== -1) {
                        startSeasonIdx = sIdx;
                        const eIdx = item.seasons[sIdx].episodes.findIndex(e => String(e.episode) === String(mem.episode));
                        if (eIdx !== -1) startEpIdx = eIdx;
                    }
                }
            }

            currentSeasonIndex = startSeasonIdx;
            document.getElementById('currentSeasonText').innerText = `Temporada ${item.seasons[currentSeasonIndex].season}`;
            renderEpisodes(item.seasons[currentSeasonIndex], item, startEpIdx); 
            const btnSeason = document.getElementById('btnOpenSeasonModal');
            if(btnSeason) btnSeason.onclick = openSeasonSelectorModal;
        }
        actionBtn.innerHTML = '<i class="fas fa-film"></i> Ver Tráiler';
        actionBtn.onclick = () => {
             setPlayerVideo(item.trailer, "Tráiler", false);
             document.querySelectorAll('.episode-button').forEach(b => b.classList.remove('active'));
        };

    } else {
        episodesDiv.classList.add('hidden');
        
        // Verificamos la memoria permanente o si se acaba de desbloquear
        const isUnlockedViaMemory = unlockedMemory.includes(String(item.id));
        const isUnlockedViaLink = (window.unlockedItemId === String(item.id));
        const hasAccess = isVipGlobal || isUnlockedViaLink || isUnlockedViaMemory;
        
        // MOSTRAR/OCULTAR BOTÓN DE COMPARTIR PARA PELÍCULAS
        if (shareBtn) shareBtn.style.display = hasAccess ? 'flex' : 'none';

        setPlayerVideo(item.video, null, !hasAccess);
        
        isPlayingTrailer = false;
        
        actionBtn.innerHTML = '<i class="fas fa-film"></i> Ver Tráiler';
        actionBtn.onclick = () => {
            if (isPlayingTrailer) {
                setPlayerVideo(item.video, null, !hasAccess); 
                actionBtn.innerHTML = '<i class="fas fa-film"></i> Ver Tráiler';
                isPlayingTrailer = false;
            } else {
                setPlayerVideo(item.trailer, "Tráiler", false);
                actionBtn.innerHTML = '<i class="fas fa-play"></i> Ver Película';
                isPlayingTrailer = true;
            }
        };
    }
    renderRealRecommendations(item.id);
    modal.style.display = 'flex';
}

function openSeasonSelectorModal() {
    if (!currentModalItem || !currentModalItem.seasons) return;
    const seasonModal = document.getElementById('seasonSelectorModal');
    const container = document.getElementById('seasonListContainer');
    container.innerHTML = '';
    currentModalItem.seasons.forEach((seasonObj, index) => {
        const itemBtn = document.createElement('button');
        itemBtn.className = `season-modal-item ${index === currentSeasonIndex ? 'active' : ''}`;
        itemBtn.innerHTML = `<span>Temporada ${seasonObj.season}</span><div class="season-radio-circle"></div>`;
        itemBtn.onclick = () => {
            currentSeasonIndex = index;
            document.getElementById('currentSeasonText').innerText = `Temporada ${seasonObj.season}`;
            
            // Renderizamos la nueva temporada desde el ep 0
            renderEpisodes(seasonObj, currentModalItem, 0); 
            seasonModal.style.display = 'none';
        };
        container.appendChild(itemBtn);
    });
    seasonModal.style.display = 'flex';
}

function renderEpisodes(season, serieItem, autoIdx = -1) {
    const container = document.getElementById('modalEpisodesContainer');
    document.getElementById('episodesCountLabel').innerText = `${season.episodes.length} Capítulos`;
    container.innerHTML = season.episodes.map((ep, i) => `<button class="episode-button ${i === autoIdx ? 'active' : ''}" data-idx="${i}">${ep.episode}</button>`).join('');
    
    const shareBtn = document.getElementById('modalShareItemBtn');

    const checkAccess = (ep) => {
        if (typeof isUserVip === 'function' && isUserVip()) return true;
        const ticketKey = `${serieItem.id}-t${season.season}-e${ep.episode}`;
        
        // Verifica si está en la memoria permanente O si se acaba de desbloquear por enlace
        const inMemory = unlockedMemory.includes(ticketKey);
        const justUnlocked = (window.unlockedItemId === String(serieItem.id) && window.unlockedSeason === parseInt(season.season) && window.unlockedEpisode === parseInt(ep.episode));
        
        return inMemory || justUnlocked;
    };

    if (autoIdx >= 0) {
        const ep = season.episodes[autoIdx];
        const hasAccess = checkAccess(ep);
        
        // MOSTRAR/OCULTAR BOTÓN DE COMPARTIR AL CARGAR
        if (shareBtn) shareBtn.style.display = hasAccess ? 'flex' : 'none';
        
        setPlayerVideo(ep.video, `T${season.season}: Cap ${ep.episode}`, !hasAccess);
        seriesMemory[serieItem.id] = { season: season.season, episode: ep.episode };
        localStorage.setItem('auraflixSeriesMemory', JSON.stringify(seriesMemory));
    }
    
    container.querySelectorAll('.episode-button').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.episode-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const ep = season.episodes[btn.dataset.idx];
            const hasAccess = checkAccess(ep);
            
            // MOSTRAR/OCULTAR BOTÓN DE COMPARTIR AL CAMBIAR DE CAPÍTULO
            if (shareBtn) shareBtn.style.display = hasAccess ? 'flex' : 'none';

            setPlayerVideo(ep.video, `T${season.season}: Cap ${ep.episode}`, !hasAccess);
            seriesMemory[serieItem.id] = { season: season.season, episode: ep.episode };
            localStorage.setItem('auraflixSeriesMemory', JSON.stringify(seriesMemory));
        };
    });
}

function openSeasonSelectorModal() {
    const m = document.getElementById('seasonSelectorModal'), c = document.getElementById('seasonListContainer');
    c.innerHTML = currentModalItem.seasons.map((s, i) => `
        <button class="season-modal-item ${i === currentSeasonIndex ? 'active' : ''}" onclick="selectSeason(${i})">
            <span>Temporada ${s.season}</span><div class="season-radio-circle"></div>
        </button>
    `).join('');
    m.style.display = 'flex';
}

window.selectSeason = (idx) => {
    currentSeasonIndex = idx;
    const s = currentModalItem.seasons[idx];
    document.getElementById('currentSeasonText').innerText = `Temporada ${s.season}`;
    renderEpisodes(s, currentModalItem, 0);
    document.getElementById('seasonSelectorModal').style.display = 'none';
};

// SEGURIDAD: GENERACIÓN DE TICKET AL SALIR AL ACORTADOR
window.executeUnlock = () => {
    if (!currentModalItem) return;
    let link = null, key = String(currentModalItem.id);
    if (!currentModalItem.seasons) {
        link = currentModalItem.unlockLink;
    } else {
        const s = currentModalItem.seasons[currentSeasonIndex];
        const btn = document.querySelector('.episode-button.active');
        const ep = s.episodes[btn ? btn.dataset.idx : 0];
        link = ep.unlockLink;
        key = `${currentModalItem.id}-t${s.season}-e${ep.episode}`;
    }
    
    if (link) {
        // CREA EL TICKET QUE EXPIRA EN 30 MINUTOS
        localStorage.setItem('auraflix_tkt_' + key, new Date().getTime());
        window.open(link, '_self');
    } else { 
        alert("Enlace de desbloqueo no disponible."); 
    }
};

window.showUnlockWarning = () => {
    const skip = localStorage.getItem('auraflixSkipUnlockWarning');
    if (skip && new Date().getTime() < parseInt(skip)) { executeUnlock(); return; }
    const m = document.getElementById('unlockWarningModal'), v = document.getElementById('unlockTutorialContainer');
    const tut = (window.VIP_CONFIG && window.VIP_CONFIG.tutorialVideo) || "https://dropload.pro/e/289c0csjj3bd";
    v.innerHTML = `<iframe src="${tut}" allowfullscreen frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" style="width:100%; height:100%; position:absolute;"></iframe>`;
    document.getElementById('dontShowUnlockWarning').checked = false;
    m.style.display = 'flex';
};

window.redirectToVipProfile = function() {
    closeModalInternal();
    switchView('profile');
    window.scrollTo({top: 0, behavior: 'smooth'});
};

function setPlayerVideo(url, label = null, isBlocked = false) {
    const p = document.getElementById('modalContentPlayer'); p.innerHTML = '';
    if (!url) { p.innerHTML = '<div class="video-container" style="display:flex;align-items:center;justify-content:center;color:gray;">Video no disponible</div>'; return; }
    const c = document.createElement('div'); c.className = 'video-container';
    const ext = url.split('.').pop().toLowerCase();
    if (['mp4','mkv','webm'].includes(ext)) {
        const v = document.createElement('video'); v.src = url; v.controls = !isBlocked; v.style.width = '100%'; v.style.height = '100%'; v.style.position = 'absolute';
        c.appendChild(v);
    } else {
        const f = document.createElement('iframe'); f.src = url; f.setAttribute('allowfullscreen','true');
        if (isBlocked) f.style.pointerEvents = 'none';
        else f.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-presentation allow-orientation-lock');
        c.appendChild(f);
    }
    if (isBlocked) {
        const b = document.createElement('div'); b.className = 'vip-player-overlay';
        let h = '';
        if (window.UNLOCK_LINK_STATUS === 'on') h += `<button onclick="showUnlockWarning()" class="vip-redirect-btn" style="background: linear-gradient(45deg, #8A2BE2, #A66BFF); margin-bottom: 12px; width: 100%; font-weight: 800;"><i class="fas fa-unlock"></i> Desbloquear Contenido</button>`;
        if (window.VIP_SYSTEM_STATUS === 'on') h += `<button onclick="redirectToVipProfile()" class="vip-redirect-btn" style="width: 100%;"><i class="fas fa-crown"></i> Ser miembro VIP</button>`;
        b.innerHTML = `<i class="fas fa-lock vip-lock-icon"></i><p class="vip-overlay-text">Contenido Bloqueado</p><div style="display:flex; flex-direction:column; width:85%; max-width:250px;">${h}</div>`;
        c.appendChild(b);
    }
    if (label && !isBlocked) {
        const l = document.createElement('div'); l.className = 'video-overlay-label'; l.innerText = label; c.appendChild(l);
    }
    p.appendChild(c);
}

function renderRealRecommendations(id) {
    const c = document.getElementById('modalRecommendations'); if (!c) return;
    const all = [...window.moviesList, ...window.seriesList];
    const genres = getItemGenres(currentModalItem).map(g => normalizeText(g));
    let related = all.filter(i => String(i.id) !== String(id) && getItemGenres(i).some(g => genres.includes(normalizeText(g))));
    shuffleArray(related);
    c.innerHTML = related.slice(0, 6).map(item => createItemHTML(item)).join('');
}

function closeModalInternal() {
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('modalContentPlayer').innerHTML = '';
    document.body.classList.remove('modal-open');
    
    // Al salir, limpiamos los permisos temporales
    window.unlockedItemId = null;
    window.unlockedSeason = null;
    window.unlockedEpisode = null;
    
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    window.history.replaceState({ view: currentView, modal: false }, '', baseUrl);
}

function toggleFavorite() {
    if(!currentModalItem) return;
    const idx = myFavorites.findIndex(i => String(i.id) === String(currentModalItem.id));
    if (idx === -1) { myFavorites.unshift(currentModalItem); document.getElementById('modalFavBtn').classList.add('active'); }
    else { myFavorites.splice(idx, 1); document.getElementById('modalFavBtn').classList.remove('active'); }
    localStorage.setItem('myFavorites', JSON.stringify(myFavorites)); renderMyList();
}

function renderMyList() {
    const c = document.getElementById('myListRow'); if(!c) return;
    if(!myFavorites.length) { c.innerHTML = '<p style="padding:20px; color:#555;">No tienes favoritos aún.</p>'; return; }
    c.innerHTML = myFavorites.map(item => createItemHTML(item)).join('');
}

function switchView(name, push = true) {
    ['home','movies','series','profile'].forEach(v => document.getElementById('view-'+v).classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-'+name).classList.remove('hidden');
    document.getElementById('nav-'+name).classList.add('active');
    currentView = name; window.scrollTo(0,0);
    if(push) window.history.pushState({ view: name, modal: false }, '');
}

function setupEventListeners() {
    document.getElementById('nav-home').onclick = () => switchView('home');
    document.getElementById('nav-movies').onclick = () => switchView('movies');
    document.getElementById('nav-series').onclick = () => switchView('series');
    document.getElementById('nav-profile').onclick = () => switchView('profile');
    document.getElementById('topSearchBtn').onclick = () => { document.getElementById('searchOverlay').style.display = 'block'; };
    document.getElementById('closeSearch').onclick = () => { document.getElementById('searchOverlay').style.display = 'none'; };
    document.getElementById('closeModal').onclick = () => { closeModalInternal(); window.history.back(); };
    document.getElementById('closeUnlockWarningBtn').onclick = () => { document.getElementById('unlockWarningModal').style.display = 'none'; };
    document.getElementById('proceedToUnlockBtn').onclick = () => {
        if(document.getElementById('dontShowUnlockWarning').checked) localStorage.setItem('auraflixSkipUnlockWarning', new Date().getTime() + 604800000);
        document.getElementById('unlockWarningModal').style.display = 'none'; executeUnlock();
    };
    document.getElementById('saveProfileBtn').onclick = () => {
        let n = document.getElementById('usernameInput').value.trim();
        if(n.length < 2 || !selectedAvatarTemp) return alert("Nombre y Avatar requeridos");
        currentUser = { name: n, avatar: selectedAvatarTemp };
        localStorage.setItem('auraflixUser', JSON.stringify(currentUser));
        location.reload();
    };
    document.getElementById('logoutBtn').onclick = () => { if(confirm("¿Cerrar Sesión?")) { localStorage.clear(); location.reload(); } };
}

function shuffleArray(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

window.addEventListener('popstate', (e) => {
    if (!e.state || !e.state.modal) closeModalInternal();
    if (e.state && e.state.view) switchView(e.state.view, false);
});
