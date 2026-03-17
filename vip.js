// ==========================================
// CONFIGURACIÓN GENERAL DE SISTEMAS VIP
// ==========================================

// INTERRUPTORES: Cambia a 'off' para desactivar cualquiera de las dos funciones.
window.VIP_SYSTEM_STATUS = 'on';    // Controla el VIP Global de 12 horas (Perfil)
window.UNLOCK_LINK_STATUS = 'off';   // Controla el desbloqueo individual por película/serie

// ==========================================
// CONFIGURACIÓN DEL VIP GLOBAL (12 HORAS)
// ==========================================

// IMPORTANTE: En tu acortador, la URL de destino final debe ser: https://auraflixs.github.io/?vip=active
const VIP_SHORTENER_LINK = "https://dropload.pro/tu-enlace-vip"; 
const VIP_DURATION = 12 * 60 * 60 * 1000; // 12 horas en milisegundos

// Función del botón: Guarda el ticket de seguridad y te manda al enlace
window.startVipProcess = function() {
    if (window.VIP_SYSTEM_STATUS !== 'on') {
        if (typeof showToast === 'function') showToast("El sistema VIP Global está desactivado actualmente.");
        return;
    }
    localStorage.setItem('auraflix_vip_tkt', new Date().getTime());
    window.location.assign(VIP_SHORTENER_LINK);
};

// Comprueba si el usuario tiene el VIP activo en este momento
window.isUserVip = function() {
    if (window.VIP_SYSTEM_STATUS !== 'on') return false; // Si está apagado, nadie es detectado como VIP
    const vipUntil = localStorage.getItem('auraflix_vip_until');
    if (!vipUntil) return false;
    return new Date().getTime() < parseInt(vipUntil);
};

// EL DETECTOR: Esta función revisa si el usuario viene regresando del acortador
function checkVipDeepLink() {
    const url = window.location.href;
    
    // Si en el link de arriba dice "?vip=active" (lo que envía tu acortador)
    if (url.includes('vip=active')) {
        // Solo damos el VIP si el sistema global está encendido
        if (window.VIP_SYSTEM_STATUS === 'on') {
            const ticketTime = localStorage.getItem('auraflix_vip_tkt');
            const now = new Date().getTime();
            
            // Verifica si salió de la app hace menos de 30 minutos (para evitar trampas)
            if (ticketTime && (now - parseInt(ticketTime)) < 1800000) {
                localStorage.setItem('auraflix_vip_until', now + VIP_DURATION); // Otorga las 12 horas
                localStorage.removeItem('auraflix_vip_tkt'); // Borra la evidencia
                if (typeof showToast === 'function') showToast("¡Felicidades! Eres VIP por 12 horas.");
            }
        }

        // LIMPIEZA: Borra el "?vip=active" de la barra del navegador para que no lo copien
        window.history.replaceState({}, '', url.split('?')[0]);
        
        // Redirige al perfil para que vea su temporizador
        if (typeof switchView === 'function') switchView('profile');
        if (typeof checkVipTimerUI === 'function') checkVipTimerUI();
    }
}

// Función para actualizar los botones y el temporizador en el perfil
window.checkVipTimerUI = function() {
    const badge = document.getElementById('profileVipBadge');
    const actionContainer = document.getElementById('vipActionContainer');
    const timerContainer = document.getElementById('vipTimerContainer');
    const timerText = document.getElementById('vipTimerText');
    
    // Si el sistema VIP está desactivado ('off'), ocultamos toda la sección VIP del perfil
    if (window.VIP_SYSTEM_STATUS !== 'on') {
        if (actionContainer) actionContainer.style.display = 'none';
        if (timerContainer) timerContainer.style.display = 'none';
        // Si hay una insignia (badge) existente en el HTML, la forzamos a ser Usuario normal
        if (badge) {
            badge.innerText = "Usuario Estándar";
            badge.classList.remove('vip-active');
        }
        return;
    }

    if (!badge) return; 

    if (isUserVip()) {
        // SI ES VIP: Muestra el temporizador y oculta el botón
        badge.innerText = "Miembro VIP";
        badge.classList.add('vip-active');
        if(actionContainer) actionContainer.style.display = 'none';
        if(timerContainer) timerContainer.style.display = 'flex';
        updateTimerDisplay(timerText);
    } else {
        // SI NO ES VIP: Muestra el botón de Activar
        badge.innerText = "Usuario Estándar";
        badge.classList.remove('vip-active');
        if(actionContainer) actionContainer.style.display = 'flex';
        if(timerContainer) timerContainer.style.display = 'none';
        
        const btnActivate = document.getElementById('btnActivateVip');
        if(btnActivate) {
            btnActivate.onclick = window.startVipProcess; 
        }
    }
};

// Lógica matemática del Temporizador (Cuenta regresiva)
let vipInterval;
function updateTimerDisplay(element) {
    if (!element) return;
    const vipUntil = localStorage.getItem('auraflix_vip_until');
    if (!vipUntil) return;

    clearInterval(vipInterval); 
    vipInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = parseInt(vipUntil) - now;

        // Si el tiempo se acabó
        if (distance < 0) {
            clearInterval(vipInterval);
            checkVipTimerUI(); // Refresca la pantalla (vuelve a mostrar el botón)
            return;
        }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        element.innerText = `${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}

// Arranca el detector automáticamente al abrir la página
window.addEventListener('load', () => {
    setTimeout(() => {
        checkVipDeepLink();
        checkVipTimerUI();
    }, 100);
});
