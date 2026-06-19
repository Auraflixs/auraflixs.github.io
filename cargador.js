// --- CONFIGURACIÓN DE TU CATÁLOGO ---
const TOTAL_PELIS = 200;  
const TOTAL_SERIES = 50;  

function cargarCatalogos() {
    const head = document.head;
    let scriptsCargados = 0;
    const totalEsperado = TOTAL_PELIS + TOTAL_SERIES;

    // Función que verifica si ya se cargaron todos los archivos o respuestas
    const verificarCarga = () => {
        scriptsCargados++;
        if (scriptsCargados === totalEsperado) {
            console.log("🎬 Auraflix+: Todos los catálogos procesados (Locales + Firebase).");
        }
    };

    // 1. Cargar Películas (Carpeta "p")
    for (let i = 1; i <= TOTAL_PELIS; i++) {
        // 🚀 CAMBIO CLAVE: peli1 ya no existe localmente, viene de Firebase
        if (i === 1) {
            console.log("📡 peli1 se omitió localmente porque se maneja desde Firebase.");
            verificarCarga(); // Sumamos al contador para que no se congele la carga
            continue; // Saltamos a la peli2
        }

        const script = document.createElement('script');
        script.src = `p/peli${i}.js`;
        script.async = false; 
        
        script.onload = verificarCarga;
        script.onerror = () => {
            console.error(`⚠️ No se encontró el archivo: p/peli${i}.js`);
            verificarCarga(); 
        };
        
        head.appendChild(script);
    }

    // 2. Cargar Series (Carpeta "s")
    for (let i = 1; i <= TOTAL_SERIES; i++) {
        const script = document.createElement('script');
        script.src = `s/serie${i}.js`;
        script.async = false;
        
        script.onload = verificarCarga;
        script.onerror = () => {
            console.error(`⚠️ No se encontró el archivo: s/serie${i}.js`);
            verificarCarga(); 
        };
        
        head.appendChild(script);
    }
}

// Ejecutar la función apenas se lea este archivo
cargarCatalogos();
