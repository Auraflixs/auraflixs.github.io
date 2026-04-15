// cargador.js (versión robusta - reemplaza completamente tu cargador.js)
(function(){
    const basePath = window.SCRIPTS_BASE || './';
    const maxMovies = 200;
    const maxSeries = 120;
    const batchSize = 12;
    const fetchTimeoutMs = 12000;
    const retryAttempts = 1;
    const mainScriptToAppend = 'script.js?v=21';
    const supportedExtraFiles = [];

    function log(...args){ console.debug('[cargador]', ...args); }
    function warn(...args){ console.warn('[cargador]', ...args); }

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
                if (txt.trim().length < 20 && /<html|404|Not Found/i.test(txt)) throw new Error('contenido inválido o 404');
                return txt;
            } catch (e) {
                lastErr = e;
                await new Promise(r => setTimeout(r, 200 + attempt * 150));
            }
        }
        throw lastErr;
    }

    function injectScriptText(code, urlHint) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        if (urlHint) script.setAttribute('data-src-hint', urlHint);
        try { script.appendChild(document.createTextNode(code)); }
        catch (err) { script.text = code; }
        document.body.appendChild(script);
    }

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
            settled.forEach(r => { results[r.idx] = r; });
            for (let j = i; j < i + chunk.length; j++) {
                const r = results[j];
                if (!r) continue;
                if (r.ok && r.txt) {
                    try { injectScriptText(r.txt, r.url); log(`Inyectado: ${r.url}`); }
                    catch (e) { warn('Fallo inyectando', r.url, e); }
                } else {
                    warn('Omitido (no cargó):', r.url, r.err || '');
                }
            }
            await new Promise(res => setTimeout(res, 60));
        }

        const succeeded = results.filter(r => r && r.ok).map(r => r.url);
        const failed = results.filter(r => !r || (r && !r.ok)).map(r => (r && r.url) || 'unknown');
        log(`${groupName} - cargados: ${succeeded.length}, fallidos: ${failed.length}`);
        return { succeeded, failed };
    }

    function buildUrls(prefixFolder, namePrefix, maxCount) {
        const arr = [];
        for (let i = 1; i <= maxCount; i++) {
            const sep = basePath.endsWith('/') ? '' : '/';
            arr.push(`${basePath}${sep}${prefixFolder}/${namePrefix}${i}.js`);
        }
        return arr;
    }

    async function loadExtraFiles(files = []) {
        for (const f of files) {
            try {
                const url = (basePath.endsWith('/') ? basePath : basePath + '/') + f;
                const txt = await fetchTextWithRetry(url).catch(()=>null);
                if (txt) { injectScriptText(txt, url); log(`Extra inyectado: ${url}`); }
                else log(`Extra no encontrado (omitido): ${f}`);
            } catch (e) { warn('Extra omitido', f, e); }
        }
    }

    // Intenta inyectar main script por fetch con múltiples candidatos, si no, usa tag src fallback
    async function injectMainScriptWithFallback() {
        const candidates = [];
        // candidatos directos
        candidates.push(mainScriptToAppend);
        // con basePath
        const bp = basePath.endsWith('/') ? basePath : basePath + '/';
        candidates.push(bp + mainScriptToAppend);
        // sin query
        const withoutQuery = mainScriptToAppend.split('?')[0];
        candidates.push(bp + withoutQuery);
        candidates.push(withoutQuery);
        candidates.push('/' + withoutQuery.replace(/^\//,'')); // /script.js
        // ruta absoluta tentativa
        try {
            const abs = window.location.origin + window.location.pathname;
            candidates.push(abs + withoutQuery);
        } catch(e){}

        for (const c of candidates) {
            try {
                log('Intentando fetch main:', c);
                const txt = await fetchTextWithRetry(c).catch(()=>null);
                if (txt) {
                    injectScriptText(txt, c);
                    log('Main script inyectado desde', c);
                    return true;
                }
            } catch (e) {
                warn('Intento main falló:', c, e && e.message ? e.message : e);
            }
        }

        // fallback: agregar tag <script src="..."> con candidate principal (dejar que navegador intente)
        try {
            const s = document.createElement('script');
            s.src = mainScriptToAppend;
            s.async = false;
            document.body.appendChild(s);
            log('Main script añadido mediante tag src (fallback):', mainScriptToAppend);
            return true;
        } catch (e) {
            warn('No se pudo añadir main script con tag src', e);
            return false;
        }
    }

    async function runLoader() {
        try {
            const movieUrls = buildUrls('p', 'peli', maxMovies);
            const seriesUrls = buildUrls('s', 'serie', maxSeries);

            const [moviesRes, seriesRes] = await Promise.all([
                loadUrlsInOrder(movieUrls, 'peliculas'),
                loadUrlsInOrder(seriesUrls, 'series')
            ]);

            if (supportedExtraFiles.length > 0) await loadExtraFiles(supportedExtraFiles);

            const mainInjected = await injectMainScriptWithFallback();

            window.dispatchEvent(new CustomEvent('auraflix-scripts-loaded', {
                detail: {
                    moviesLoaded: moviesRes.succeeded.length,
                    moviesFailed: moviesRes.failed.length,
                    seriesLoaded: seriesRes.succeeded.length,
                    seriesFailed: seriesRes.failed.length,
                    mainInjected
                }
            }));

            log('Carga completa ✅');
        } catch (err) {
            console.error('Error en cargador principal', err);
            try {
                const s = document.createElement('script');
                s.src = mainScriptToAppend;
                s.async = false;
                document.body.appendChild(s);
            } catch(e){ console.error('Fallback main script también falló', e); }
            if (typeof showToast === 'function') showToast('Error cargando recursos. Revisa la consola.');
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runLoader);
    else setTimeout(runLoader, 10);

    window.__auraflix_loader = {
        config: { basePath, maxMovies, maxSeries, batchSize, fetchTimeoutMs, retryAttempts, mainScriptToAppend },
        run: runLoader
    };
})();
