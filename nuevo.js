// CONFIGURACIÓN DE NOVEDADES
// Instrucciones:
// Reemplaza 'X1' con el ID de la película o serie.
// Reemplaza 'X2' con 'season' (para Nueva Temp.), 'episode' (para Nuevo Cap.) o 'cam' (para pelis CAM).

const NEW_CONTENT_CONFIG = [
    { id: 's5', type: 'episode' },
    { id: 'p82', type: 'cam' },
    // ejemplo película marcada como CAM:
    { id: 'p77', type: 'cam' },
    // usa tus entradas...
    { id: 'p92', type: 'cam' },
    { id: 'p83', type: 'cam' },
    { id: 'p84', type: 'cam' }
];

// Lógica para inyectar las etiquetas
(function() {
    function applyNewBadges() {
        if (!NEW_CONTENT_CONFIG || NEW_CONTENT_CONFIG.length === 0) return;

        NEW_CONTENT_CONFIG.forEach(config => {
            // Ignorar los placeholders X1 si no se han editado
            if (!config.id || config.id === 'X1') return;

            // Si es CAM: queremos aplicarlo solo a elementos de tipo "movies"
            // (el onclick generado por createItemHTML es: onclick="openModal('id', 'movies')" o 'series')
            let selector;
            if (config.type === 'cam') {
                // buscar solo items cuyo onclick contiene "'ID', 'movies'"
                selector = `.item[onclick*="'${config.id}', 'movies'"]`;
            } else {
                // selector genérico (vale para series o películas)
                selector = `.item[onclick*="'${config.id}'"]`;
            }

            const items = document.querySelectorAll(selector);

            items.forEach(item => {
                // Verificar si ya tiene el badge para no repetir
                if (!item.querySelector('.new-content-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'new-content-badge';
                    
                    // Definir texto corto según tipo
                    let labelText = '';
                    if (config.type === 'season') labelText = 'Nueva Temp.'; // Texto abreviado
                    else if (config.type === 'episode') labelText = 'Nuevo Cap.'; // Texto abreviado
                    else if (config.type === 'cam') labelText = 'CAM';
                    else labelText = 'Nuevo'; 

                    badge.innerText = labelText;
                    item.appendChild(badge);
                }
            });
        });
    }

    // Ejecutar al cargar
    window.addEventListener('load', () => {
        setTimeout(applyNewBadges, 500); 
    });

    // Observador para cambios dinámicos
    const observer = new MutationObserver((mutations) => {
        applyNewBadges();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
