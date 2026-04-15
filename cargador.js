// Reemplaza tu lista manual por esta:
const FIJOS = [
    "link.js",
    "bqdp.js",
    "perfil.js",
    // ... cualquier otro archivo que no siga el patrón p/peli#.js o s/serie#.js
    "id.js"
];

// Configuración para descubrimiento automático
const P_PREFIX = "p/peli";      // plantilla: p/peli{n}.js
const S_PREFIX = "s/serie";     // plantilla: s/serie{n}.js
const EXT = ".js";

const MAX_CHECK = 500;                // número máximo a comprobar por seguridad
const CONSECUTIVE_FAILS_TO_STOP = 10; // se detiene cuando haya 10 fallos seguidos (ajusta si quieres)

function loadScriptTag(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false; // preservar orden
        script.onload = () => resolve(src);
        script.onerror = () => reject(src);
        document.body.appendChild(script);
    });
}

async function loadSequentialPattern(prefix, start = 1, max = MAX_CHECK, stopAfterConsecutiveFails = CONSECUTIVE_FAILS_TO_STOP) {
    let consecutiveFails = 0;
    for (let i = start; i <= max; i++) {
        const path = `${prefix}${i}${EXT}`;
        try {
            // Intentar cargar el archivo
            await loadScriptTag(path);
            consecutiveFails = 0; // éxito -> resetear contadores
            // console.log('Cargado', path);
        } catch (err) {
            consecutiveFails++;
            // console.warn('No existe', path);
            if (consecutiveFails >= stopAfterConsecutiveFails) {
                // demasiados fallos consecutivos, asumimos que ya no hay más archivos contiguos
                // console.log(`Deteniendo búsqueda para ${prefix} luego de ${consecutiveFails} fallos consecutivos.`);
                break;
            }
        }
    }
}

// función principal: carga fijos -> p/peli# -> s/serie# -> script.js
async function cargarScriptsDinamico() {
    try {
        // 1) cargar scripts fijos en el mismo orden que listaste (serial)
        for (const f of FIJOS) {
            try {
                await loadScriptTag(f);
            } catch (e) {
                console.warn(`No se pudo cargar ${f}`, e);
                // no romper todo; sigue con los demás
            }
        }

        // 2) cargar p/peli1..N (en orden). Ajusta start/max si lo deseas.
        await loadSequentialPattern(P_PREFIX, 1, MAX_CHECK, CONSECUTIVE_FAILS_TO_STOP);

        // 3) cargar s/serie1..N (en orden).
        await loadSequentialPattern(S_PREFIX, 1, MAX_CHECK, CONSECUTIVE_FAILS_TO_STOP);

        // 4) finalmente carga tu script principal y cualquier otro que dependa de los anteriores.
        // Cambia la versión si quieres (v=21)
        await loadScriptTag("script.js?v=21");

        // opcional: callback o evento
        // console.log('Todos los scripts cargados (o intentados).');
    } catch (e) {
        console.error('Error en carga dinámica', e);
    }
}

// Ejecutar la carga
cargarScriptsDinamico();
