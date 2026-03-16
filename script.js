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
