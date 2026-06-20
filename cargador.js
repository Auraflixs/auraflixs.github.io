// --- CONFIGURACIÓN DE TU CATÁLOGO ---
// Actualiza estos números cada vez que agregues un nuevo archivo .js a tus carpetas
const TOTAL_PELIS = 200;  // Llegará hasta p/peli10.js
const TOTAL_SERIES = 50;  // Llegará hasta s/serie5.js

function cargarCatalogos() {
    const head = document.head;
    let scriptsCargados = 0;
    const totalEsperado = TOTAL_PELIS + TOTAL_SERIES;

    // Función que verifica si ya se cargaron todos los archivos
    const verificarCarga = () => {
        scriptsCargados++;
        if (scriptsCargados === totalEsperado) {
            console.log("🎬 Auraflix+: Todos los catálogos cargados correctamente.");
            // Como en tu script principal tienes la función checkDataReady() 
            // iterando hasta que window.moviesList tenga datos, 
            // la app arrancará sola en cuanto estos scripts terminen.
        }
    };

    // 1. Cargar Películas (Carpeta "p")
    for (let i = 1; i <= TOTAL_PELIS; i++) {
        const script = document.createElement('script');
        script.src = `p/peli${i}.js`;
        script.async = false; // Falso para asegurar que se ejecuten en orden
        
        script.onload = verificarCarga;
        script.onerror = () => {
            console.error(`⚠️ No se encontró el archivo: p/peli${i}.js`);
            verificarCarga(); // Se suma igual para no bloquear el inicio de la app
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
            verificarCarga(); // Se suma igual para no bloquear el inicio de la app
        };
        
        head.appendChild(script);
    }
}

// Ejecutar la función apenas se lea este archivo
cargarCatalogos();
