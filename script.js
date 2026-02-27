let continueWatching = JSON.parse(localStorage.getItem('continueWatching')) || [];
let myFavorites = JSON.parse(localStorage.getItem('myFavorites')) || [];
let currentUser = JSON.parse(localStorage.getItem('auraflixUser')) || null;
let savedGridSize = localStorage.getItem('auraflixGridSize') || 'normal';

// Memoria para recordar el último capítulo visto de una serie
let seriesMemory = JSON.parse(localStorage.getItem('auraflixSeriesMemory')) || {};

// Memoria permanente para guardar lo que ya se desbloqueó y no volver a pedirlo
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
let isDiagnosisRunning = false;

// Variables específicas para saber exactamente QUÉ se acaba de desbloquear por URL
window.deepLinkSeason = null;
window.deepLinkEpisode = null;
window.unlockedItemId = null;
window.unlockedSeason = null;
window.unlockedEpisode = null;

const GALLERY_BTN_ID_LOGIN = "gallery-upload-btn-id-login";
const GALLERY_BTN_ID_MODAL = "gallery-upload-btn-id-modal";

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

// ==========================================
// SISTEMA DE NOTIFICACIONES TOAST (NEGRO TRANSPARENTE)
// ==========================================
function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerText = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if(container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3000); 
}

// ==========================================
// SISTEMA DE MODAL DE CONFIRMACIÓN PERSONALIZADO
// ==========================================
window.showCustomConfirm = function(title, message, onAccept, onCancel, acceptText = "Aceptar", cancelText = "Cancelar") {
    const modal = document.getElementById('customConfirmModal');
    if(!modal) return;
    
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalMessage').innerText = message;
    
    const btnAccept = document.getElementById('acceptConfirmBtn');
    const btnCancel = document.getElementById('cancelConfirmBtn');
    
    btnAccept.innerText = acceptText;
    btnCancel.innerText = cancelText;
    
    btnAccept.onclick = () => {
        modal.style.display = 'none';
        if(onAccept) onAccept();
    };
    
    btnCancel.onclick = () => {
        modal.style.display = 'none';
        if(onCancel) onCancel();
    };
    
    modal.style.display = 'flex';
};

// BUSCADOR MEJORADO
const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD")
               .replace(/[\u0300-\u036f]/g, "") 
               .replace(/[.,:\-]/g, "")         
               .replace(/\s+/g, " ")            
               .toLowerCase()
               .trim();
};

window.addEventListener('load', () => {
    setTimeout(iniciarTodo, 10);
});

// Forzar la creación de la burbuja de navegación rápido
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(updateNavIndicator, 50);
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

    // Actualizar la burbuja de navegación al cargar todo
    setTimeout(updateNavIndicator, 200);
    window.addEventListener('resize', updateNavIndicator);
}

// ==========================================
// LÓGICA LIQUID GLASS INDICATOR (BURBUJA) - ARREGLADA
// ==========================================
function updateNavIndicator() {
    requestAnimationFrame(() => {
        const activeItem = document.querySelector('.nav-item.active');
        const indicator = document.getElementById('navIndicator');
        
        if (activeItem && indicator) {
            const itemWidth = activeItem.offsetWidth;
            const bubbleWidth = Math.min(itemWidth * 0.75, 65); 
            indicator.style.width = `${bubbleWidth}px`; 
            const centerX = activeItem.offsetLeft + (itemWidth / 2);
            indicator.style.transform = `translate(${centerX - (bubbleWidth / 2)}px, -50%)`;
        }
    });
}

function setupAutoRotation() {
    const handleRotation = async () => {
        const isFullscreen = document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement || 
                             document.msFullscreenElement;

        if (isFullscreen) {
            try {
                if (screen.orientation && screen.orientation.lock) {
                    await screen.orientation.lock('landscape');
                }
            } catch (error) {}
        } else {
            try {
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                }
            } catch (error) {}
        }
    };

    document.addEventListener('fullscreenchange', handleRotation);
    document.addEventListener('webkitfullscreenchange', handleRotation);
}

function optimizeConnections() {
    const allItems = [...window.moviesList, ...window.seriesList].slice(0, 20);
    const domains = new Set();
    allItems.forEach(item => {
        try {
            if(item.image) {
                const url = new URL(item.image);
                domains.add(url.origin);
            }
        } catch(e) {}
    });
    domains.forEach(domain => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });
}

function injectImageStyles() {
    const styleId = 'auraflix-smooth-images';
    if (document.getElementById(styleId)) return;

    const css = `
        .smooth-image { opacity: 0; transition: opacity 0.5s ease-out; will-change: opacity; }
        .smooth-image.loaded { opacity: 1; }
        .img-loader {
            background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 6px;
            width: 100%;
            height: 100%;
        }
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        .avatar-option img { opacity: 0; transition: opacity 0.4s ease-out; }
        .avatar-option img.loaded { opacity: 1; }
        #modalContentPlayer { transition: background-image 0.3s ease; background-color: #000; }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = css;
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
    if (!window.moviesList.originalOrder) {
        window.moviesList.originalOrder = [...window.moviesList];
    }
    if (!window.seriesList.originalOrder) {
        window.seriesList.originalOrder = [...window.seriesList];
    }

    shuffleArray(window.moviesList);
    shuffleArray(window.seriesList);

    renderHomeView();
    
    let newlyAdded = [];
    if (window.globalContent && window.globalContent.length > 0) {
        newlyAdded = [...window.globalContent];
    } else {
        newlyAdded = [...window.moviesList.originalOrder, ...window.seriesList.originalOrder];
    }
    
    renderList('newlyAddedRow', newlyAdded.slice(0, 20));
    
    setupHero(); 
    setupLatelyNew();
}

// ==========================================
// SEGURIDAD URL ARREGLADA (Elimina -vip siempre)
// ==========================================
function checkDeepLinks() {
    let url = window.location.href;
    let queryString = "";
    
    if (url.includes('?')) {
        queryString = url.substring(url.indexOf('?'));
    }
    
    if (!queryString) return;

    const urlParams = new URLSearchParams(queryString);
    
    if (urlParams.has('movie')) {
        const val = urlParams.get('movie');
        const parts = val.split('-');
        const id = parts[0]; 
        
        if (parts.includes('vip')) {
            const ticketTime = localStorage.getItem('auraflix_tkt_' + id);
            const now = new Date().getTime();
            
            if (ticketTime && (now - parseInt(ticketTime)) < 1800000) {
                if (!unlockedMemory.includes(String(id))) {
                    unlockedMemory.push(String(id));
                    localStorage.setItem('auraflixUnlockedMemory', JSON.stringify(unlockedMemory));
                }
                localStorage.removeItem('auraflix_tkt_' + id); 
            }
        }

        // LIMPIAR URL SIEMPRE POR SEGURIDAD (Haya funcionado el ticket o no)
        if (window.location.href.includes('-vip')) {
            window.history.replaceState({}, '', window.location.href.replace('-vip', ''));
        }

        window.unlockedItemId = id;
        openModal(id, 'movies', true); 
        
    } else if (urlParams.has('serie')) {
        const val = urlParams.get('serie');
        const parts = val.split('-');
        const id = parts[0];
        
        const seasonStr = parts.find(p => p.startsWith('t'));
        const epStr = parts.find(p => p.startsWith('e'));
        
        if (seasonStr && epStr) {
            window.deepLinkSeason = parseInt(seasonStr.replace('t', ''));
            window.deepLinkEpisode = parseInt(epStr.replace('e', ''));
            window.unlockedSeason = window.deepLinkSeason;
            window.unlockedEpisode = window.deepLinkEpisode;
        }
        
        if (parts.includes('vip')) {
            const sNum = seasonStr ? seasonStr.replace('t','') : '';
            const eNum = epStr ? epStr.replace('e','') : '';
            const ticketKey = `${id}-t${sNum}-e${eNum}`;
            const ticketTime = localStorage.getItem('auraflix_tkt_' + ticketKey);
            const now = new Date().getTime();
            
            if (ticketTime && (now - parseInt(ticketTime)) < 1800000) {
                if (!unlockedMemory.includes(ticketKey)) {
                    unlockedMemory.push(ticketKey);
                    localStorage.setItem('auraflixUnlockedMemory', JSON.stringify(unlockedMemory));
                }
                localStorage.removeItem('auraflix_tkt_' + ticketKey);
            }
        }

        // LIMPIAR URL SIEMPRE POR SEGURIDAD
        if (window.location.href.includes('-vip')) {
            window.history.replaceState({}, '', window.location.href.replace('-vip', ''));
        }

        window.unlockedItemId = id;
        openModal(id, 'series', true);
    }
}

function renderAvatarSelection(containerId, context) {
    const grid = document.getElementById(containerId);
    if(!grid) return;
    grid.innerHTML = '';
    
    if (typeof profileImages !== 'undefined' && Array.isArray(profileImages)) {
        profileImages.forEach((url) => {
            const div = document.createElement('div');
            div.className = 'avatar-option';
            div.innerHTML = `<img src="${url}" alt="Avatar" class="smooth-image" onload="this.classList.add('loaded')">`;
            div.onclick = () => {
                grid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedAvatarTemp = url;
            };
            grid.appendChild(div);
        });
    }
    
    const addBtn = document.createElement('div');
    addBtn.className = 'avatar-option';
    addBtn.id = context === 'login' ? GALLERY_BTN_ID_LOGIN : GALLERY_BTN_ID_MODAL;
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
        let activeGridId = null;
        let activeBtnId = null;
        if (document.getElementById('loginScreen').style.display === 'flex') {
            activeGridId = 'avatarGrid';
            activeBtnId = GALLERY_BTN_ID_LOGIN;
        } else if (document.getElementById('changeAvatarModal').style.display === 'flex') {
            activeGridId = 'changeAvatarGrid';
            activeBtnId = GALLERY_BTN_ID_MODAL;
        }
        if (activeGridId && activeBtnId) {
            const grid = document.getElementById(activeGridId);
            const btn = document.getElementById(activeBtnId);
            grid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            if(btn) {
                btn.innerHTML = `<img src="${selectedAvatarTemp}" class="smooth-image" onload="this.classList.add('loaded')" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                btn.classList.add('selected');
            }
        }
    };
    reader.readAsDataURL(file);
}

function updateUserProfile(newUrl) {
    if(currentUser) {
        currentUser.avatar = newUrl;
        localStorage.setItem('auraflixUser', JSON.stringify(currentUser));
        loadUserDataInUI();
    }
}

function loadUserDataInUI() {
    if (!currentUser) return;
    const navImg = document.getElementById('navProfileImg');
    if(navImg) navImg.src = currentUser.avatar;
    const pageImg = document.getElementById('profilePageImg');
    const pageName = document.getElementById('profilePageName');
    if(pageImg) pageImg.src = currentUser.avatar;
    if(pageName) pageName.innerText = currentUser.name;
    
    checkAdminPrivileges();
    if (typeof checkVipTimerUI === 'function') checkVipTimerUI();
    renderMyList(); 
}

function checkAdminPrivileges() {
    const adminPanel = document.getElementById('adminTools');
    if (!adminPanel || !currentUser) return;
    const allowedUsers = ['Naho-ad', 'L-ad'];
    if (allowedUsers.includes(currentUser.name)) {
        adminPanel.style.display = 'block';
    } else {
        adminPanel.style.display = 'none';
    }
}

function setupHero() {
    const sourceMovies = window.moviesList.originalOrder || window.moviesList;
    const sourceSeries = window.seriesList.originalOrder || window.seriesList;
    const allContent = [...sourceMovies, ...sourceSeries];
    
    featuredList = [];

    if (window.HERO_IDS && Array.isArray(window.HERO_IDS) && window.HERO_IDS.length > 0) {
        window.HERO_IDS.forEach(config => {
            let targetId = config;
            let customImg = null;
            if (typeof config === 'object' && config !== null) {
                targetId = config.id;
                customImg = config.img;
            }
            const foundItem = allContent.find(item => String(item.id) === String(targetId));
            if (foundItem) {
                const heroItem = { ...foundItem };
                if (customImg) heroItem.image = customImg;
                featuredList.push(heroItem);
            }
        });
    } else {
        featuredList = allContent.filter(i => i.featured);
        if (featuredList.length === 0 && allContent.length > 0) {
            featuredList = allContent.slice(0, 5);
        }
    }
    renderHero();
    startAutoSlide();
}

function renderHero() {
    const container = document.querySelector('.carousel-container');
    const dots = document.getElementById('heroDots');
    if (!container) return;
    
    if (featuredList.length === 0) {
        container.innerHTML = '';
        if(dots) dots.innerHTML = '';
        return;
    }
    
    container.innerHTML = featuredList.map((item, i) => `
        <div class="carousel-slide ${i === 0 ? 'active' : ''} img-loader">
            <img src="${item.image}" 
                 alt="Hero Image" 
                 class="smooth-image" 
                 onload="this.parentElement.classList.remove('img-loader'); this.classList.add('loaded')"
                 ${i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} 
                 decoding="async">
        </div>
    `).join('');
    
    dots.innerHTML = featuredList.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');
}

function nextHeroSlide() { updateHeroVisuals((currentHeroIndex + 1) % featuredList.length); }
function prevHeroSlide() { updateHeroVisuals((currentHeroIndex - 1 + featuredList.length) % featuredList.length); }

function updateHeroVisuals(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    if(slides.length === 0) return;
    slides[currentHeroIndex].style.display = 'none';
    if(dots[currentHeroIndex]) dots[currentHeroIndex].classList.remove('active');
    currentHeroIndex = index;
    slides[currentHeroIndex].style.display = 'block';
    if(dots[currentHeroIndex]) dots[currentHeroIndex].classList.add('active');
}

function startAutoSlide() { 
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(nextHeroSlide, 5000); 
}

function setupLatelyNew() {
    const container = document.getElementById('latelyNewGrid');
    if (!container) return;
    let targetIds = window.LATELY_IDS || [];
    if (!Array.isArray(targetIds) || targetIds.length === 0) return;

    const sourceMovies = window.moviesList.originalOrder || window.moviesList;
    const sourceSeries = window.seriesList.originalOrder || window.seriesList;
    const allContent = [...sourceMovies, ...sourceSeries];
    
    let displayList = [];
    targetIds.forEach(id => {
         const item = allContent.find(i => String(i.id) === String(id));
         if (item) displayList.push(item);
    });

    container.innerHTML = displayList.map((item, index) => createItemHTML(item, index)).join('');
}

function renderHomeView() {
    renderMultiRow('homeMoviesRow', window.moviesList.slice(0, 30));
    renderMultiRow('homeSeriesRow', window.seriesList.slice(0, 30));
}

function renderList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = list.map((item, i) => createItemHTML(item, i)).join('');
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
        rowDiv.innerHTML = chunk.map((item, j) => createItemHTML(item, j)).join('');
        container.appendChild(rowDiv);
    }
}

function createItemHTML(item, index = 100) {
    const type = item.seasons ? 'series' : 'movies';
    const safeId = String(item.id).replace(/'/g, "\\'");
    const loadMode = index < 6 ? 'eager' : 'lazy';

    return `
        <div class="item img-loader" onclick="openModal('${safeId}', '${type}')">
            <img src="${item.image}" 
                 class="smooth-image" 
                 onload="this.parentElement.classList.remove('img-loader'); this.classList.add('loaded')" 
                 loading="${loadMode}" 
                 decoding="async" 
                 alt="${item.title}">
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
function openModal(id, typeHint, fromDeepLink = false) {
    document.getElementById('searchOverlay').style.display = 'none';
    document.getElementById('historyOverlay').style.display = 'none';

    // Para evitar agregar múltiples entradas al historial al recargar
    if (!document.body.classList.contains('modal-open') && !fromDeepLink) {
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
                showToast("Enlace copiado al portapapeles");
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
            
            if (!fromDeepLink) {
                const cleanUrl = `${window.location.origin}${window.location.pathname}?serie=${item.id}-t${item.seasons[currentSeasonIndex].season}-e${item.seasons[currentSeasonIndex].episodes[startEpIdx].episode}`;
                window.history.replaceState({ view: currentView, modal: true }, '', cleanUrl);
            }

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
        
        // Verificamos si está desbloqueada
        const isUnlockedViaMemory = unlockedMemory.includes(String(item.id));
        const isUnlockedViaLink = (window.unlockedItemId === String(item.id));
        const hasAccess = isVipGlobal || isUnlockedViaLink || isUnlockedViaMemory;
        
        // CORRECCIÓN: Mostrar botón de compartir y agregar a historial SOLO si está desbloqueada
        if (shareBtn) shareBtn.style.display = hasAccess ? 'flex' : 'none';
        if (hasAccess) {
            addToContinueWatching(item, 'movies');
        }

        if (!fromDeepLink) {
            const cleanUrl = `${window.location.origin}${window.location.pathname}?movie=${item.id}-${item.year || '2025'}`;
            window.history.replaceState({ view: currentView, modal: true }, '', cleanUrl);
        }

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
            renderEpisodes(seasonObj, currentModalItem, 0); 
            seasonModal.style.display = 'none';
        };
        container.appendChild(itemBtn);
    });
    seasonModal.style.display = 'flex';
}

function renderEpisodes(season, serieItem, autoPlayIndex = -1) {
    const container = document.getElementById('modalEpisodesContainer');
    container.innerHTML = ''; 
    if(!season || !season.episodes) return;
    
    const countLabel = document.getElementById('episodesCountLabel');
    if (countLabel) countLabel.innerText = `${season.episodes.length} Capítulos`;
    
    container.innerHTML = season.episodes.map((ep, idx) => `
        <button class="episode-button ${idx === autoPlayIndex ? 'active' : ''}" data-idx="${idx}">${ep.episode}</button>
    `).join('');
    
    const isVipGlobal = typeof isUserVip === 'function' ? isUserVip() : false;
    const shareBtn = document.getElementById('modalShareItemBtn');

    const checkAccess = (ep) => {
        if (isVipGlobal) return true;
        const ticketKey = `${serieItem.id}-t${season.season}-e${ep.episode}`;
        const inMemory = unlockedMemory.includes(ticketKey);
        const justUnlocked = (window.unlockedItemId === String(serieItem.id) && window.unlockedSeason === parseInt(season.season) && window.unlockedEpisode === parseInt(ep.episode));
        return inMemory || justUnlocked;
    }

    if (autoPlayIndex >= 0 && season.episodes[autoPlayIndex]) {
        const ep = season.episodes[autoPlayIndex];
        const hasAccess = checkAccess(ep);
        
        // CORRECCIÓN: Botón compartir y agregar historial SOLO si está desbloqueado
        if (shareBtn) shareBtn.style.display = hasAccess ? 'flex' : 'none';
        if (hasAccess) {
            addToContinueWatching(serieItem, 'series');
        }

        setPlayerVideo(ep.video, `T${season.season}: Cap ${ep.episode}`, !hasAccess);
        
        seriesMemory[serieItem.id] = { season: season.season, episode: ep.episode };
        localStorage.setItem('auraflixSeriesMemory', JSON.stringify(seriesMemory));
        const cleanUrl = `${window.location.origin}${window.location.pathname}?serie=${serieItem.id}-t${season.season}-e${ep.episode}`;
        window.history.replaceState({ view: currentView, modal: true }, '', cleanUrl);
    }
    
    const buttons = container.querySelectorAll('.episode-button');
    buttons.forEach((btn, index) => {
        btn.onclick = () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const ep = season.episodes[index];
            const hasAccess = checkAccess(ep);

            // CORRECCIÓN: Botón compartir y agregar historial SOLO si está desbloqueado
            if (shareBtn) shareBtn.style.display = hasAccess ? 'flex' : 'none';
            if (hasAccess) {
                addToContinueWatching(serieItem, 'series');
            }

            setPlayerVideo(ep.video, `T${season.season}: Cap ${ep.episode}`, !hasAccess);
            
            seriesMemory[serieItem.id] = { season: season.season, episode: ep.episode };
            localStorage.setItem('auraflixSeriesMemory', JSON.stringify(seriesMemory));
            const cleanUrl = `${window.location.origin}${window.location.pathname}?serie=${serieItem.id}-t${season.season}-e${ep.episode}`;
            window.history.replaceState({ view: currentView, modal: true }, '', cleanUrl);
        };
    });
}

window.redirectToVipProfile = function() {
    closeModalInternal();
    switchView('profile');
    window.scrollTo({top: 0, behavior: 'smooth'});
};

window.executeUnlock = function() {
    if (currentModalItem) {
        let shortLink = null;
        let ticketKey = String(currentModalItem.id);
        
        if (!currentModalItem.seasons) {
            shortLink = currentModalItem.unlockLink;
        } 
        else {
            const seasonObj = currentModalItem.seasons[currentSeasonIndex];
            const activeEpBtn = document.querySelector('.episode-button.active');
            let epNumber = 1;
            
            if (activeEpBtn) {
                const idx = parseInt(activeEpBtn.getAttribute('data-idx'));
                if(!isNaN(idx) && seasonObj.episodes[idx]) {
                    epNumber = seasonObj.episodes[idx].episode;
                    shortLink = seasonObj.episodes[idx].unlockLink;
                }
            } else if (seasonObj.episodes.length > 0) {
                epNumber = seasonObj.episodes[0].episode;
                shortLink = seasonObj.episodes[0].unlockLink;
            }
            ticketKey = `${currentModalItem.id}-t${seasonObj.season}-e${epNumber}`;
        }
        
        if (shortLink) {
            localStorage.setItem('auraflix_tkt_' + ticketKey, new Date().getTime());
            window.open(shortLink, '_self');
        } else {
            showToast("No hay enlace de desbloqueo configurado para este contenido aún.");
        }
    }
};

window.showUnlockWarning = function() {
    const skipUntil = localStorage.getItem('auraflixSkipUnlockWarning');
    const now = new Date().getTime();

    if (skipUntil && now < parseInt(skipUntil)) {
        executeUnlock();
        return;
    }

    const modal = document.getElementById('unlockWarningModal');
    const videoContainer = document.getElementById('unlockTutorialContainer');

    const tutUrl = (typeof window.VIP_CONFIG !== 'undefined' && window.VIP_CONFIG.tutorialVideo) 
                   ? window.VIP_CONFIG.tutorialVideo 
                   : "https://dropload.pro/e/289c0csjj3bd";
    
    videoContainer.innerHTML = `
        <iframe 
            src="${tutUrl}" 
            allowfullscreen 
            frameborder="0" 
            sandbox="allow-scripts allow-same-origin allow-presentation"
            style="width:100%; height:100%; position:absolute; top:0; left:0;">
        </iframe>`;

    document.getElementById('dontShowUnlockWarning').checked = false;
    modal.style.display = 'flex';
};

function setPlayerVideo(url, overlayText = null, isBlocked = false) {
    const playerDiv = document.getElementById('modalContentPlayer');
    playerDiv.innerHTML = ''; 
    if (!url) {
        playerDiv.innerHTML = '<div class="video-container" style="display:flex;align-items:center;justify-content:center;color:gray;">Video no disponible</div>';
        return;
    }
    const container = document.createElement('div');
    container.className = 'video-container';

    const extension = url.split('.').pop().toLowerCase();
    const isDirectFile = ['mkv', 'mp4', 'webm', 'ogg', 'mov'].includes(extension);

    if (isDirectFile) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = !isBlocked; 
        video.autoplay = false;
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.setAttribute('playsinline', '');
        
        video.onerror = () => {
            playerDiv.innerHTML = `
                <div style="position:relative; width:100%; padding-top:56.25%; background:#000; display:flex; align-items:center; justify-content:center;">
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; width:90%;">
                        <p style="margin-bottom:15px; font-size:0.9rem;">Formato no compatible</p>
                    </div>
                </div>
            `;
        };
        container.appendChild(video);
    } else {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture; screen-wake-lock');
        iframe.setAttribute('allowfullscreen', 'true');
        
        if(isBlocked) {
             iframe.style.pointerEvents = 'none';
        } else {
            iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-presentation allow-orientation-lock');
        }
        
        container.appendChild(iframe);
    }
    
    if (isBlocked) {
        const blockerDiv = document.createElement('div');
        blockerDiv.className = 'vip-player-overlay';
        
        let buttonsHtml = '';
        
        if (window.UNLOCK_LINK_STATUS === 'on' || typeof window.UNLOCK_LINK_STATUS === 'undefined') {
            buttonsHtml += `<button onclick="showUnlockWarning()" class="vip-redirect-btn" style="background: linear-gradient(45deg, #8A2BE2, #A66BFF); margin-bottom: 12px; width: 100%; box-shadow: 0 0 10px rgba(138, 43, 226, 0.5);"><i class="fas fa-unlock"></i> Desbloquear Contenido</button>`;
        }
        
        if (window.VIP_SYSTEM_STATUS === 'on' || typeof window.VIP_SYSTEM_STATUS === 'undefined') {
            buttonsHtml += `<button onclick="redirectToVipProfile()" class="vip-redirect-btn" style="width: 100%;"><i class="fas fa-crown"></i> Ser miembro VIP</button>`;
        }
        
        if(buttonsHtml === '') {
             buttonsHtml = `<p style="color:#aaa; font-size:0.9rem;">Contenido restringido.</p>`;
        }

        blockerDiv.innerHTML = `
            <i class="fas fa-lock vip-lock-icon"></i>
            <p class="vip-overlay-text" style="margin-bottom: 25px;">Contenido Bloqueado</p>
            <div style="display: flex; flex-direction: column; width: 85%; max-width: 250px;">
                ${buttonsHtml}
            </div>
        `;
        container.appendChild(blockerDiv);
    }
    
    if (overlayText && !isBlocked) {
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay-label';
        overlay.style.pointerEvents = 'none'; 
        overlay.innerText = overlayText;
        container.appendChild(overlay);
    }
    playerDiv.appendChild(container);
}

function renderRealRecommendations(currentId) {
    const container = document.getElementById('modalRecommendations');
    if (!container || !currentModalItem) return;

    let allContent = [...window.moviesList, ...window.seriesList];
    const currentGenres = getItemGenres(currentModalItem).map(g => normalizeText(g));
    let candidates = allContent.filter(i => String(i.id) !== String(currentId));

    let related = [];
    let others = [];

    candidates.forEach(item => {
        const itemGenres = getItemGenres(item).map(g => normalizeText(g));
        const hasMatch = itemGenres.some(g => currentGenres.includes(g));
        if (hasMatch) related.push(item);
        else others.push(item);
    });

    shuffleArray(related);
    shuffleArray(others);

    let finalSelection = [...related];
    if (finalSelection.length < 6) {
        const needed = 6 - finalSelection.length;
        finalSelection = finalSelection.concat(others.slice(0, needed));
    } else {
        finalSelection = finalSelection.slice(0, 6);
    }

    container.innerHTML = finalSelection.map(item => createItemHTML(item)).join('');
}

function closeModalInternal() {
    const modal = document.getElementById('videoModal');
    modal.style.display = 'none';
    document.getElementById('modalContentPlayer').innerHTML = ''; 
    document.body.classList.remove('modal-open');
    document.getElementById('seasonSelectorModal').style.display = 'none';
    
    window.unlockedItemId = null;
    window.unlockedSeason = null;
    window.unlockedEpisode = null;
    
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    window.history.replaceState({ view: currentView, modal: false }, '', baseUrl);
}

function addToContinueWatching(item, type) {
    continueWatching = continueWatching.filter(i => String(i.id) !== String(item.id));
    continueWatching.unshift({ ...item, type });
    if (continueWatching.length > 20) continueWatching.pop();
    localStorage.setItem('continueWatching', JSON.stringify(continueWatching));
}

function toggleFavorite() {
    if(!currentModalItem) return;
    const index = myFavorites.findIndex(i => String(i.id) === String(currentModalItem.id));
    const btn = document.getElementById('modalFavBtn');
    if (index === -1) {
        myFavorites.unshift(currentModalItem);
        btn.classList.add('active');
        showToast("Agregado a Favoritos");
    } else {
        myFavorites.splice(index, 1);
        btn.classList.remove('active');
        showToast("Eliminado de Favoritos");
    }
    localStorage.setItem('myFavorites', JSON.stringify(myFavorites));
    renderMyList();
}

function renderMyList() {
    const container = document.getElementById('myListRow');
    if(!container) return;
    if(myFavorites.length === 0) {
        container.innerHTML = '<p style="padding:20px; color:#555;">No tienes favoritos aún.</p>';
        return;
    }
    container.innerHTML = myFavorites.map(item => createItemHTML(item)).join('');
}

function renderHistoryOverlayContent() {
    const container = document.getElementById('historyResults');
    if (!container) return;
    if (continueWatching.length === 0) { 
        container.innerHTML = '<p style="padding:20px; color:#aaa;">No has visto nada recientemente.</p>'; 
        return; 
    }
    container.innerHTML = continueWatching.map(item => createItemHTML(item)).join('');
}

function renderPopularSearches() {
    const container = document.getElementById('popularTags');
    const input = document.getElementById('searchInput');
    if (!container || !window.busquedasPopulares) return;

    container.innerHTML = window.busquedasPopulares.map(term => `
        <span class="pop-tag">${term}</span>
    `).join('');

    container.querySelectorAll('.pop-tag').forEach(tag => {
        tag.onclick = () => {
            input.value = tag.innerText;
            input.dispatchEvent(new Event('input'));
        };
    });
}

function switchView(viewName, pushToHistory = true) {
    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-movies').classList.add('hidden');
    document.getElementById('view-series').classList.add('hidden');
    document.getElementById('view-profile').classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    window.scrollTo({top: 0, behavior: 'auto'});
    currentView = viewName;

    const headerIcons = document.getElementById('headerRightIcons');
    if (viewName === 'profile') headerIcons.classList.add('hidden-header-icons');
    else headerIcons.classList.remove('hidden-header-icons');

    if (viewName === 'home') {
        document.getElementById('view-home').classList.remove('hidden');
        document.getElementById('nav-home').classList.add('active');
    } else if (viewName === 'movies') {
        document.getElementById('view-movies').classList.remove('hidden');
        document.getElementById('nav-movies').classList.add('active');
        renderFilteredMovies();
    } else if (viewName === 'series') {
        document.getElementById('view-series').classList.remove('hidden');
        document.getElementById('nav-series').classList.add('active');
        renderFilteredSeries();
    } else if (viewName === 'profile') {
        document.getElementById('view-profile').classList.remove('hidden');
        document.getElementById('nav-profile').classList.add('active');
        renderMyList(); 
    }
    
    setTimeout(updateNavIndicator, 50);

    if (pushToHistory) window.history.pushState({ view: viewName, modal: false }, '');
}

function setupEventListeners() {
    const hero = document.getElementById('hero');
    hero.onclick = (e) => {
        if (Math.abs(touchStartX - touchEndX) < 10 && featuredList[currentHeroIndex]) {
            const current = featuredList[currentHeroIndex];
            openModal(current.id, current.seasons ? 'series' : 'movies');
        }
    };
    hero.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, {passive: true});
    hero.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) nextHeroSlide();
        if (touchEndX - touchStartX > 50) prevHeroSlide();
    }, {passive: true});

    document.getElementById('nav-home').onclick = (e) => { e.preventDefault(); switchView('home'); };
    document.getElementById('nav-movies').onclick = (e) => { e.preventDefault(); switchView('movies'); };
    document.getElementById('nav-series').onclick = (e) => { e.preventDefault(); switchView('series'); };
    document.getElementById('nav-profile').onclick = (e) => { e.preventDefault(); switchView('profile'); };
    
    document.getElementById('btnFilterMovies').onclick = () => openFilterModal('movies');
    document.getElementById('btnFilterSeries').onclick = () => openFilterModal('series');
    document.getElementById('applyFiltersBtn').onclick = applyFilters;
    document.getElementById('clearFiltersBtn').onclick = clearFilters;
    document.getElementById('closeFilterModal').onclick = () => document.getElementById('filterModal').style.display = 'none';

    document.getElementById('topSearchBtn').onclick = (e) => {
        e.preventDefault();
        document.getElementById('searchOverlay').style.display = 'block';
        
        // Limpiamos el buscador y mostramos las sugerencias al abrir
        const input = document.getElementById('searchInput');
        input.value = ''; 
        input.focus();
        document.getElementById('searchResults').innerHTML = '';
        const popContainer = document.getElementById('popularSearchContainer');
        if (popContainer) popContainer.style.display = 'block';
        
        renderPopularSearches();
        window.history.pushState({ view: currentView, modal: false, search: true }, '');
    };
    document.getElementById('topHistoryBtn').onclick = (e) => {
        e.preventDefault();
        renderHistoryOverlayContent(); 
        document.getElementById('historyOverlay').style.display = 'block';
        window.history.pushState({ view: currentView, modal: false, history: true }, '');
    };
    
    // CORRECCIÓN BUSCADOR: Ocultar sugerencias al escribir
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const val = normalizeText(e.target.value);
        const container = document.getElementById('searchResults');
        const popContainer = document.getElementById('popularSearchContainer');
        
        container.innerHTML = '';
        
        if (val.length > 0) {
            if (popContainer) popContainer.style.display = 'none';
        } else {
            if (popContainer) popContainer.style.display = 'block';
            return;
        }

        if (val.length < 2) return;
        
        const all = [...window.moviesList, ...window.seriesList];
        
        const filtered = all.filter(item => {
            const titleMatch = normalizeText(item.title).includes(val);
            let tagsMatch = false;
            if (item.tags && Array.isArray(item.tags)) {
                tagsMatch = item.tags.some(tag => normalizeText(tag).includes(val));
            }
            return titleMatch || tagsMatch;
        });
        
        renderList('searchResults', filtered);
    });

    document.getElementById('closeSearch').onclick = () => window.history.back();
    document.getElementById('closeHistory').onclick = () => window.history.back();
    document.getElementById('closeModal').addEventListener('click', () => { closeModalInternal(); window.history.back(); });
    
    document.getElementById('closeSeasonSelector').onclick = () => document.getElementById('seasonSelectorModal').style.display = 'none';

    document.getElementById('saveProfileBtn').addEventListener('click', () => {
        const nameInput = document.getElementById('usernameInput');
        const name = nameInput.value.trim();
        if (name.length < 2) { showToast("Escribe un nombre válido."); return; }
        if (!selectedAvatarTemp) { showToast("Por favor, elige un avatar."); return; }
        currentUser = { name: name, avatar: selectedAvatarTemp };
        localStorage.setItem('auraflixUser', JSON.stringify(currentUser));
        document.getElementById('loginScreen').style.display = 'none';
        loadUserDataInUI();
        initApp();
    });
    
    document.getElementById('profilePageImg').addEventListener('click', () => {
        document.getElementById('changeAvatarModal').style.display = 'flex';
        renderAvatarSelection('changeAvatarGrid', 'modal');
    });
    document.getElementById('closeAvatarModal').addEventListener('click', () => document.getElementById('changeAvatarModal').style.display = 'none');
    document.getElementById('confirmAvatarChange').addEventListener('click', () => {
        if(!selectedAvatarTemp) { showToast("Selecciona una imagen."); return; }
        updateUserProfile(selectedAvatarTemp);
        document.getElementById('changeAvatarModal').style.display = 'none';
        showToast("Avatar actualizado");
    });
    
    document.getElementById('btnSupport').onclick = () => document.getElementById('supportModal').style.display = 'flex';
    document.getElementById('closeSupportBtn').onclick = () => document.getElementById('supportModal').style.display = 'none';
    
    // RESTAURADOS BOTONES DE ACTUALIZACIÓN
    const btnUpdate = document.getElementById('btnUpdateApp');
    if (btnUpdate) {
        btnUpdate.onclick = () => {
            const modal = document.getElementById('updateModal');
            if(modal) modal.style.display = 'flex';
        };
    }
    const closeUpdate = document.getElementById('closeUpdateModal');
    if (closeUpdate) {
        closeUpdate.onclick = () => {
            const modal = document.getElementById('updateModal');
            if(modal) modal.style.display = 'none';
        };
    }
    const btnInstall = document.getElementById('btnInstallUpdate');
    if (btnInstall) {
        btnInstall.onclick = () => {
            if(typeof AURA_LINKS !== 'undefined' && AURA_LINKS.appDownload) {
                window.open(AURA_LINKS.appDownload, '_blank');
            } else {
                showToast("Enlace no disponible.");
            }
        };
    }
    
    document.getElementById('btnBroadcast').onclick = () => {
        if(typeof AURA_LINKS !== 'undefined' && AURA_LINKS.telegram) {
            window.open(AURA_LINKS.telegram, '_blank');
        } else {
            console.log("Falta links.js o la propiedad telegram");
        }
    };
    
    document.getElementById('btnTerms').onclick = () => document.getElementById('termsModal').style.display = 'flex';
    document.getElementById('closeTermsBtn').onclick = () => document.getElementById('termsModal').style.display = 'none';
    
    document.getElementById('btnSettings').onclick = () => document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('closeSettingsBtn').onclick = () => document.getElementById('settingsModal').style.display = 'none';

    // EVENTOS NUEVOS: Canjear Código VIP
    const btnRedeemCode = document.getElementById('btnRedeemCode');
    if (btnRedeemCode) {
        btnRedeemCode.onclick = () => document.getElementById('redeemModal').style.display = 'flex';
    }
    const closeRedeemModal = document.getElementById('closeRedeemModal');
    if (closeRedeemModal) {
        closeRedeemModal.onclick = () => document.getElementById('redeemModal').style.display = 'none';
    }

    const gridSelect = document.getElementById('gridSizeSelect');
    if(gridSelect) {
        gridSelect.value = savedGridSize;
        gridSelect.addEventListener('change', (e) => {
            savedGridSize = e.target.value;
            localStorage.setItem('auraflixGridSize', savedGridSize);
            
            showCustomConfirm(
                "Tamaño de Portadas",
                "El tamaño se ha cambiado correctamente. ¿Deseas recargar la app para aplicar los cambios en todas partes?",
                () => { location.reload(); },
                () => {
                    if(savedGridSize === 'small') {
                        document.body.classList.add('grid-small');
                    } else {
                        document.body.classList.remove('grid-small');
                    }
                },
                "Recargar",
                "Más tarde"
            );
        });
    }

    // MODAL PERSONALIZADO BORRAR CACHÉ
    document.getElementById('btnCache').onclick = () => {
        showCustomConfirm(
            "Borrar Caché",
            "¿Estás seguro de borrar tu historial y favoritos?",
            () => {
                localStorage.removeItem('continueWatching');
                localStorage.removeItem('myFavorites');
                localStorage.removeItem('auraflixSeriesMemory');
                localStorage.removeItem('auraflixUnlockedMemory');
                localStorage.removeItem('auraflixSkipUnlockWarning');
                continueWatching = []; myFavorites = []; seriesMemory = {}; unlockedMemory = [];
                renderMyList();
                showToast("Caché y memoria borradas correctamente.");
                document.getElementById('settingsModal').style.display = 'none';
            },
            null,
            "Sí, borrar"
        );
    };
    
    // RESTAURADOS EVENTOS DE COMPARTIR LA APP/WEB
    document.getElementById('btnShare').onclick = () => {
        document.getElementById('shareModal').style.display = 'flex';
    };
    document.getElementById('closeShareModal').onclick = () => {
        document.getElementById('shareModal').style.display = 'none';
    };
    
    const shareContent = async (title, text, url) => {
        if (navigator.share) {
            try { await navigator.share({ title, text, url }); } catch (error) {}
        } else {
            const tempInput = document.createElement("input");
            tempInput.value = url;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
            showToast("Enlace copiado al portapapeles");
        }
        document.getElementById('shareModal').style.display = 'none';
    };
    
    document.getElementById('btnShareAppVersion').onclick = () => {
        const link = (typeof AURA_LINKS !== 'undefined' && AURA_LINKS.appDownload) ? AURA_LINKS.appDownload : 'https://auraflix.app';
        shareContent('Auraflix App', 'Descarga Auraflix aquí:', link);
    };
    document.getElementById('btnShareWebVersion').onclick = () => {
        const link = (typeof AURA_LINKS !== 'undefined' && AURA_LINKS.webPage) ? AURA_LINKS.webPage : 'https://auraflix.com';
        shareContent('Auraflix Web', 'Mira películas en Auraflix:', link);
    };

    // MODAL PERSONALIZADO CERRAR SESIÓN
    document.getElementById('logoutBtn').addEventListener('click', () => {
        showCustomConfirm(
            "Cerrar Sesión",
            "¿Deseas salir de tu cuenta de Auraflix?",
            () => {
                localStorage.clear(); 
                location.reload();
            },
            null,
            "Salir de la App"
        );
    });

    document.getElementById('btnRequestContent').onclick = () => {
        document.getElementById('requestModal').style.display = 'flex';
    };
    document.getElementById('closeRequestModal').onclick = () => {
        document.getElementById('requestModal').style.display = 'none';
    };

    document.getElementById('modalReportBtn').onclick = () => {
        if (!currentModalItem) return;
        
        let reportTitle = currentModalItem.title;
        if (currentModalItem.seasons) {
            const season = currentModalItem.seasons[currentSeasonIndex];
            if (season) {
                reportTitle += ` (Temporada ${season.season}`;
                const activeEpBtn = document.querySelector('.episode-button.active');
                if (activeEpBtn) {
                    reportTitle += ` - Episodio ${activeEpBtn.innerText})`;
                } else {
                    reportTitle += `)`;
                }
            }
        }
        
        document.getElementById('reportContentTitle').innerText = reportTitle;
        document.getElementById('hiddenReportName').value = reportTitle;
        document.getElementById('reportModal').style.display = 'flex';
    };

    document.getElementById('closeReportModal').onclick = () => {
        document.getElementById('reportModal').style.display = 'none';
    };
    
    const closeUnlockBtn = document.getElementById('closeUnlockWarningBtn');
    if (closeUnlockBtn) {
        closeUnlockBtn.onclick = () => {
            document.getElementById('unlockWarningModal').style.display = 'none';
            document.getElementById('unlockTutorialContainer').innerHTML = '';
        };
    }
    
    const proceedUnlockBtn = document.getElementById('proceedToUnlockBtn');
    if (proceedUnlockBtn) {
        proceedUnlockBtn.onclick = () => {
            const isChecked = document.getElementById('dontShowUnlockWarning').checked;
            if (isChecked) {
                const expiry = new Date().getTime() + (7 * 24 * 60 * 60 * 1000); 
                localStorage.setItem('auraflixSkipUnlockWarning', expiry);
            }
            document.getElementById('unlockWarningModal').style.display = 'none';
            document.getElementById('unlockTutorialContainer').innerHTML = '';
            executeUnlock();
        };
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

window.addEventListener('popstate', (event) => {
    const modal = document.getElementById('videoModal');
    if (!event.state || !event.state.modal) {
        if (modal.style.display === 'flex') closeModalInternal(); 
        document.getElementById('termsModal').style.display = 'none';
        document.getElementById('settingsModal').style.display = 'none';
        document.getElementById('supportModal').style.display = 'none';
        document.getElementById('filterModal').style.display = 'none';
        document.getElementById('changeAvatarModal').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('seasonSelectorModal').style.display = 'none'; 
        document.getElementById('requestModal').style.display = 'none';
        document.getElementById('reportModal').style.display = 'none';
        
        // Modal de canjeo
        const redeemModal = document.getElementById('redeemModal');
        if(redeemModal) redeemModal.style.display = 'none';

        const unlockModal = document.getElementById('unlockWarningModal');
        if(unlockModal) unlockModal.style.display = 'none';
        
        const vipModal = document.getElementById('vipModal');
        if(vipModal) vipModal.style.display = 'none';
        const tutModal = document.getElementById('tutorialModal');
        if(tutModal) tutModal.style.display = 'none';
        
        const updateModal = document.getElementById('updateModal');
        if(updateModal) updateModal.style.display = 'none';
        
        const unlockContainer = document.getElementById('unlockTutorialContainer');
        if(unlockContainer) unlockContainer.innerHTML = '';
    }
    if (!event.state || !event.state.search) document.getElementById('searchOverlay').style.display = 'none';
    if (!event.state || !event.state.history) document.getElementById('historyOverlay').style.display = 'none';
    if (event.state && event.state.view) switchView(event.state.view, false);
});
