// cargador.js
(function(){
    const owner = 'Auraflixs';
    const repo = 'auraflixs.github.io';
    // opcional: fija commit/branch; si quieres usar rama por defecto deja ''.
    const commitRef = '5944f2f1c4f0e8724c3588b82b538a6c342d5e29'; // o '' para default branch

    const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/`;
    const pageBase = `https://${owner}.github.io/`;

    async function listDir(path){
        const refQuery = commitRef ? `?ref=${commitRef}` : '';
        const url = `${apiBase}${path}${refQuery}`;
        const res = await fetch(url);
        if(!res.ok) throw new Error('GitHub API error: ' + res.status);
        const json = await res.json();
        return json
            .filter(f => f.type === 'file' && f.name.endsWith('.js'))
            .map(f => path + '/' + f.name);
    }

    function injectScript(src){
        return new Promise(resolve => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false; // preserva orden
            s.onload = () => { resolve(true); };
            s.onerror = () => { console.warn('No se cargó:', src); resolve(false); };
            document.body.appendChild(s);
        });
    }

    async function fallbackAttemptRange(prefix, pattern, max){
        for(let i=1;i<=max;i++){
            const path = `${prefix}${pattern.replace('{n}', i)}`;
            try {
                await injectScript(path);
            } catch(e){ /* ignore */ }
        }
    }

    (async function main(){
        try {
            // 1) intenta listar p/ y s/ usando la API
            const pFiles = await listDir('p');
            const sFiles = await listDir('s');

            // carga p primero luego s (si quieres otro orden cámbialo)
            const files = [...pFiles.sort(), ...sFiles.sort()];

            for(const f of files){
                // preferimos cargar desde GitHub Pages (dominio del site),
                // así las rutas relativas y assets funcionan correctamente.
                const url = pageBase + f;
                await injectScript(url);
            }
        } catch (err) {
            console.warn('No se pudo listar desde GitHub API, intentando fallback por patrón.', err);
            // fallback: intentar nombres comunes (no ideal, pero útil si no hay API)
            // intenta p/peli1..peli200 y s/serie1..serie120
            await fallbackAttemptRange('p/', 'peli{n}.js', 200);
            await fallbackAttemptRange('s/', 'serie{n}.js', 120);
        } finally {
            // asegúrate de que script.js se cargue (si no lo cargaste manual antes)
            if(!document.querySelector('script[src*="script.js"]')) {
                await injectScript('script.js?v=21');
            }
            // opcional: disparar un evento para indicar que cargado todo
            window.dispatchEvent(new Event('auraflix-scripts-loaded'));
        }
    })();
})();
