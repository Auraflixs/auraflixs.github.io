// cargador.js (versión mejorada) - copia/pega este archivo como cargador.js
(function(){
    // ====== CONFIG ======
    const basePath = window.SCRIPTS_BASE || './'; // deja './' si tus carpetas p/ y s/ son relativas a la web
    const maxMovies = 200;   // cambiar si quieres más
    const maxSeries = 120;   // cambiar si quieres más
    const batchSize = 12;    // cuántos archivos intentar descargar en paralelo por batch (ajusta si quieres más/menos)
    const fetchTimeoutMs = 12_000; // timeout por fetch
    const retryAttempts = 1; // reintentos extra por archivo
    const mainScriptToAppend = 'script.js?v=21'; // el script principal que debe ejecutarse *después* de cargar los archivos p/ y s/
    const supportedExtraFiles = []; // si quieres agregar paths adicionales para cargar antes de mainScript (p ej: 'id.js'), agrégalos aquí.

    // ====== helpers ======
    function log(...args){ console.debug('[cargador]', ...args); }

    function timeoutPromise(promise, ms) {
        return new Promise((resolve, reject) => {
            const id = setTimeout(() => reject(new Error('timeout')), ms);
            promise.then(v => { clearTimeout(id); resolve(v); }).catch(err => { clearTimeout(id); reject(err); });
        });
    }

    async function fetchTextWithRetry(url, retries = retryAttempts) {
        let lastErr = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const resp = await timeoutPromise(fetch(url, { cache: 'no-store' }), fetchTimeoutMs);
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const txt = await resp.text();
                // Quick heuristic: if file is very short and contains "404" or typical github html, skip
                if (txt.trim().length < 20 && /<html|404|Not Found/i.test(txt)) {
                    throw new Error('contenido inválido o 404');
                }
                return txt;
            } catch (e) {
                lastErr = e;
                // si queda reintentos, esperamos un poco
                await new Promise(r => setTimeout(r, 250 + attempt * 150));
            }
        }
        throw lastErr;
    }

    // crea y inyecta un script con código (preserva orden si llamas secuencialmente)
    function injectScriptText(code, urlHint) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        // poner un data-attr para debugging
        if (urlHint) script.setAttribute('data-src-hint', urlHint);
        try {
            script.appendChild(document.createTextNode(code));
        } catch (err) {
            // fallback para entornos antiguos
            script.text = code;
        }
        document.body.appendChild(script);
    }

    // carga un array de URLs por batches, y los inyecta manteniendo orden
    async function loadUrlsInOrder(urls = [], groupName = 'group') {
        log(`Cargando ${urls.length} archivos (${groupName}) en batches de ${batchSize}`);
        const results = new Array(urls.length).fill(null);

        for (let i = 0; i < urls.length; i += batchSize) {
            const chunk = urls.slice(i, i + batchSize);
            const promises = chunk.map((u, idx) => {
                const globalIdx = i + idx;
                return fetchTextWithRetry(u).then(txt => ({ ok: true, txt, idx: globalIdx, url: u }))
                                          .catch(err => ({ ok: false, err, idx: globalIdx, url: u }));
            });
            const settled = await Promise.all(promises);
            // almacenar resultados
            settled.forEach(r => {
                results[r.idx] = r;
            });
            // inyectar los scripts del chunk **en orden de índice**
            for (let j = i; j < i + chunk.length; j++) {
                const r = results[j];
                if (!r) continue;
                if (r.ok && r.txt) {
                    try {
                        injectScriptText(r.txt, r.url);
                        log(`Inyectado: ${r.url}`);
                    } catch (e) {
                        console.warn('Fallo inyectando', r.url, e);
                    }
                } else {
                    console.warn('Omitido (no cargó):', r.url, r.err || '');
                }
            }
            // pequeña pausa para evitar saturar el navegador si hay muchos archivos
            await new Promise(res => setTimeout(res, 80));
        }

        // devolver un resumen
        const succeeded = results.filter(r => r && r.ok).map(r => r.url);
        const failed = results.filter(r => !r || (r && !r.ok)).map(r => (r && r.url) || 'unknown');
        log(`${groupName} - cargados: ${succeeded.length}, fallidos: ${failed.length}`);
        return { succeeded, failed };
    }

    // construye lista de URLs relativas para p/peli#.js y s/serie#.js
    function buildUrls(prefixFolder, namePrefix, maxCount) {
        const arr = [];
        for (let i = 1; i <= maxCount; i++) {
            // ej: './p/peli1.js' (basePath puede terminar en / o no)
            const sep = basePath.endsWith('/') ? '' : '/';
            arr.push(`${basePath}${sep}${prefixFolder}/${namePrefix}${i}.js`);
        }
        return arr;
    }

    // Intenta cargar un archivo adicional si existe (por ejemplo archivos sueltos en raiz o id.js)
    async function loadExtraFiles(files = []) {
        for (const f of files) {
            try {
                const url = (basePath.endsWith('/') ? basePath : basePath + '/') + f;
                const txt = await fetchTextWithRetry(url).catch(()=>null);
                if (txt) {
                    injectScriptText(txt, url);
                    log(`Extra inyectado: ${url}`);
                } else {
                    log(`Extra no encontrado (omitido): ${f}`);
                }
            } catch (e) {
                console.warn('Extra omitido', f, e);
            }
        }
    }

    // ====== main runner ======
    async function runLoader() {
        try {
            const movieUrls = buildUrls('p', 'peli', maxMovies);
            const seriesUrls = buildUrls('s', 'serie', maxSeries);

            // Primero intentamos cargar peliculas y series (ambos grupos en paralelo, cada uno con su orden interno)
            const [moviesRes, seriesRes] = await Promise.all([
                loadUrlsInOrder(movieUrls, 'peliculas'),
                loadUrlsInOrder(seriesUrls, 'series')
            ]);

            // luego archivos extras si los definiste
            if (supportedExtraFiles.length > 0) {
                await loadExtraFiles(supportedExtraFiles);
            }

            // FIN: inyectamos el script principal (script.js) para que inicie la app con datos ya cargados.
            const mainScriptUrl = (basePath.endsWith('/') ? basePath : basePath + '/') + mainScriptToAppend;
            try {
                const mainTxt = await fetchTextWithRetry(mainScriptUrl).catch(()=>null);
                if (mainTxt) {
                    injectScriptText(mainTxt, mainScriptUrl);
                    log('Main script inyectado desde', mainScriptUrl);
                } else {
                    // fallback: inyectar tag <script src="..."> si fetch falla (aun así se cargará por navegador)
                    const s = document.createElement('script');
                    s.src = mainScriptToAppend;
                    s.async = false;
                    document.body.appendChild(s);
                    log('Main script añadido mediante tag src (fallback):', mainScriptToAppend);
                }
            } catch (e) {
                console.warn('No se pudo inyectar main script por fetch, se agrega tag src', e);
                const s = document.createElement('script');
                s.src = mainScriptToAppend;
                s.async = false;
                document.body.appendChild(s);
            }

            // evento público para saber que terminó
            try {
                window.dispatchEvent(new CustomEvent('auraflix-scripts-loaded', {
                    detail: {
                        moviesLoaded: moviesRes.succeeded.length,
                        moviesFailed: moviesRes.failed.length,
                        seriesLoaded: seriesRes.succeeded.length,
                        seriesFailed: seriesRes.failed.length
                    }
                }));
            } catch(e){}

            log('Carga completa ✅');
        } catch (err) {
            console.error('Error en cargador principal', err);
            // aún así insertamos mainScript para no dejar la app muerta
            const s = document.createElement('script');
            s.src = mainScriptToAppend;
            s.async = false;
            document.body.appendChild(s);
        }
    }

    // si el DOM ya está listo arrancamos, si no esperamos DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runLoader);
    } else {
        setTimeout(runLoader, 10);
    }

    // Exponer configuración para debug desde consola
    window.__auraflix_loader = {
        config: { basePath, maxMovies, maxSeries, batchSize, fetchTimeoutMs, retryAttempts, mainScriptToAppend },
        run: runLoader
    };
})();
