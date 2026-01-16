// ================== VARIABLES ==================
let continueWatching = JSON.parse(localStorage.getItem('continueWatching')) || [];
let featuredList = [];
let currentHeroIndex = 0;
let autoSlideInterval;
let moviesListInternal = window.moviesList || [];
let seriesListInternal = window.seriesList || [];
let currentModalItem = null;
let currentModalType = null;
let currentView = 'home';

// ================== INIT ==================
document.addEventListener('DOMContentLoaded', () => {
    window.history.replaceState({ view: 'home', modal: false }, '');
    setTimeout(initApp, 200);
});

function initApp() {
    renderHomeView();
    renderNewlyAdded();
    renderContinueWatching();
    setupHero();
    setupEventListeners();
    switchView('home', false);
}

// ================== HERO ==================
function setupHero() {
    const allFeatured = [...moviesListInternal, ...seriesListInternal].filter(i => i.featured);
    shuffleArray(allFeatured);
    featuredList = allFeatured.slice(0, 5);
    renderHero();
    startAutoSlide();
}

function renderHero() {
    const container = document.querySelector('.carousel-container');
    const dots = document.getElementById('heroDots');

    container.innerHTML = '';
    dots.innerHTML = '';

    featuredList.forEach((item, index) => {
        const slide = document.createElement('div');
        slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
        slide.innerHTML = `<img src="${item.image}">`;
        slide.onclick = () => openModal(item.id, item.seasons ? 'series' : 'movies');
        container.appendChild(slide);

        const dot = document.createElement('div');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => goToHero(index);
        dots.appendChild(dot);
    });
}

function startAutoSlide() {
    autoSlideInterval = setInterval(() => {
        currentHeroIndex = (currentHeroIndex + 1) % featuredList.length;
        goToHero(currentHeroIndex);
    }, 5000);
}

function goToHero(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    slides[index].classList.add('active');
    dots[index].classList.add('active');
    currentHeroIndex = index;
}

// ================== HOME ==================
function renderHomeView() {
    const movies = [...moviesListInternal];
    const series = [...seriesListInternal];
    shuffleArray(movies);
    shuffleArray(series);

    renderTripleRow('homeMoviesRow', movies.slice(0, 30));
    renderTripleRow('homeSeriesRow', series.slice(0, 30));
}

function renderTripleRow(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        const rowItems = items.slice(i * 10, (i + 1) * 10);
        if (!rowItems.length) continue;

        const row = document.createElement('div');
        row.className = 'sub-row-10';
        row.innerHTML = rowItems.map(createItemHTML).join('');
        container.appendChild(row);
    }
}

// ================== LISTAS ==================
function renderList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = list.map(createItemHTML).join('');
}

function renderNewlyAdded() {
    if (window.allContentSequence?.length) {
        const strict = [...window.allContentSequence].reverse();
        renderList('newlyAddedRow', strict.slice(0, 15));
    }
}

function renderContinueWatching() {
    const container = document.getElementById('continueWatching');
    const parent = document.getElementById('continueWatchingContainer');

    if (!continueWatching.length) {
        parent.classList.add('hidden');
        return;
    }

    parent.classList.remove('hidden');
    container.innerHTML = continueWatching.map(createItemHTML).join('');
}

// ================== ITEM ==================
function createItemHTML(item) {
    const type = item.seasons ? 'series' : 'movies';
    return `
        <div class="item" onclick="openModal('${item.id}','${type}')">
            <img src="${item.image}" loading="lazy">
            <div class="item-title">${item.title}</div>
        </div>
    `;
}

// ================== MODAL ==================
function openModal(id, type) {
    window.history.pushState({ view: currentView, modal: true }, '');
    const item = [...moviesListInternal, ...seriesListInternal]
        .find(i => String(i.id) === String(id));
    if (!item) return;

    currentModalItem = item;
    currentModalType = type;

    document.body.classList.add('modal-open');
    document.getElementById('videoModal').style.display = 'flex';
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalYear').innerText = item.year || '';
    document.getElementById('modalType').innerText = type === 'movies' ? 'Película' : 'Serie';
    document.getElementById('modalDesc').innerText = item.description || '';

    loadPlayer(item);
}

function loadPlayer(item) {
    const container = document.getElementById('modalContentPlayer');
    container.innerHTML = `
        <div class="video-container">
            <iframe src="${item.video}" allowfullscreen></iframe>
        </div>
    `;
}

document.getElementById('closeModal').onclick = closeModal;

function closeModal() {
    document.body.classList.remove('modal-open');
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('modalContentPlayer').innerHTML = '';
    history.back();
}

// ================== SEARCH ==================
function setupEventListeners() {
    document.getElementById('nav-search').onclick = openSearch;
    document.getElementById('closeSearch').onclick = closeSearch;
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    document.getElementById('nav-home').onclick = () => switchView('home');
    document.getElementById('nav-movies').onclick = () => switchView('movies');
    document.getElementById('nav-series').onclick = () => switchView('series');
}

function openSearch() {
    document.getElementById('searchOverlay').style.display = 'block';
    document.body.classList.add('modal-open');
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    document.getElementById('searchOverlay').style.display = 'none';
    document.body.classList.remove('modal-open');
    document.getElementById('searchResults').innerHTML = '';
}

function handleSearch(e) {
    const q = e.target.value.toLowerCase();
    if (!q) {
        document.getElementById('searchResults').innerHTML = '';
        return;
    }

    const results = [...moviesListInternal, ...seriesListInternal]
        .filter(i => i.title.toLowerCase().includes(q));

    renderList('searchResults', results);
}

// ================== VISTAS ==================
function switchView(view, push = true) {
    currentView = view;
    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-movies').classList.add('hidden');
    document.getElementById('view-series').classList.add('hidden');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    if (view === 'home') {
        document.getElementById('view-home').classList.remove('hidden');
        nav('nav-home');
        renderHomeView();
    }

    if (view === 'movies') {
        document.getElementById('view-movies').classList.remove('hidden');
        nav('nav-movies');
        renderList('allMoviesGrid', moviesListInternal);
    }

    if (view === 'series') {
        document.getElementById('view-series').classList.remove('hidden');
        nav('nav-series');
        renderList('allSeriesGrid', seriesListInternal);
    }

    if (push) history.pushState({ view, modal: false }, '');
}

function nav(id) {
    document.getElementById(id).classList.add('active');
    window.scrollTo({ top: 0 });
}

// ================== UTIL ==================
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}