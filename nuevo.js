// CONFIGURACIÓN DE NOVEDADES
const NEW_CONTENT_CONFIG = [
    { id: "s5", type: "episode" },
    { id: "s26", type: "episode" },
    { id: "s32", type: "episode" },
    { id: "s20", type: "episode" },
    { id: "p131", type: "cam" },
    { id: "p122", type: "cam" },
    { id: "134", type: "cam" },
    { id: "p111", type: "cam" },
    { id: "p121", type: "cam" },
    { id: "p126", type: "cam" },
    { id: "p138", type: "cam" },
    { id: "p139", type: "cam" },
    { id: "p131", type: "cam" }
];

// Lógica para inyectar las etiquetas
(function() {
    function applyNewBadges() {
        if (!NEW_CONTENT_CONFIG || NEW_CONTENT_CONFIG.length === 0) return;
        NEW_CONTENT_CONFIG.forEach(config => {
            if (!config.id || config.id === 'X1') return;
            let selector;
            if (config.type === 'cam') {
                selector = `.item[onclick*="'${config.id}', 'movies'"]`;
            } else {
                selector = `.item[onclick*="'${config.id}'"]`;
            }
            const items = document.querySelectorAll(selector);
            items.forEach(item => {
                if (!item.querySelector('.new-content-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'new-content-badge';
                    let labelText = '';
                    if (config.type === 'season') labelText = 'Nueva Temp.';
                    else if (config.type === 'episode') labelText = 'Nuevo Cap.';
                    else if (config.type === 'cam') labelText = 'CAM';
                    else labelText = 'Nuevo'; 
                    badge.innerText = labelText;
                    item.appendChild(badge);
                }
            });
        });
    }
    window.addEventListener('load', () => {
        setTimeout(applyNewBadges, 500); 
    });
    const observer = new MutationObserver((mutations) => {
        applyNewBadges();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
