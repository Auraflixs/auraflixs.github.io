// ==========================================
// CONFIGURACIÓN GENERAL DE SISTEMAS VIP
// ==========================================
window.VIP_SYSTEM_STATUS = 'on';    
window.UNLOCK_LINK_STATUS = 'off';   

// IMPORTANTE: En tu acortador, la URL de destino final debe ser: https://auraflixs.github.io/?vip=active
const VIP_SHORTENER_LINK = "https://dropload.pro/tu-enlace-vip"; 
const VIP_DURATION = 12 * 60 * 60 * 1000; // 12 horas

window.startVipProcess = function() {
    if (window.VIP_SYSTEM_STATUS !== 'on') {
        if (typeof showToast === 'function') showToast("El sistema VIP Global está desactivado.");
        return;
    }
    localStorage.setItem('auraflix_vip_tkt', new Date().getTime());
    window.location.assign(VIP_SHORTENER_LINK);
};

window.isUserVip = function() {
    if (window.VIP_SYSTEM_STATUS !== 'on') return false; 
    const vipUntil = localStorage.getItem('auraflix_vip_until');
    if (!vipUntil) return false;
    return new Date().getTime() < parseInt(vipUntil);
};

function checkVipDeepLink() {
    const url = window.location.href;
    
    if (url.includes('vip=active')) {
        if (window.VIP_SYSTEM_STATUS === 'on') {
            const ticketTime = localStorage.getItem('auraflix_vip_tkt');
            const now = new Date().getTime();
            
            if (ticketTime && (now - parseInt(ticketTime)) < 1800000) {
                localStorage.setItem('auraflix_vip_until', now + VIP_DURATION); 
                localStorage.removeItem('auraflix_vip_tkt'); 
                if (typeof showToast === 'function') showToast("¡Felicidades! Eres VIP por 12 horas.");
            }
        }

        window.history.replaceState({}, '', url.split('?')[0]);
        
        // Cerrar modal si estaba abierto
        const modalVip = document.getElementById('vipModal');
        if (modalVip) modalVip.style.display = 'none';

        if (typeof switchView === 'function') switchView('profile');
        if (typeof checkVipTimerUI === 'function') checkVipTimerUI();
    }
}

window.checkVipTimerUI = function() {
    const badge = document.getElementById('profileBadge'); // CORREGIDO PARA QUE COINCIDA CON TU HTML
    const actionContainer = document.getElementById('vipActionContainer');
    const timerContainer = document.getElementById('vipTimerContainer');
    const timerText = document.getElementById('vipTimerText');
    
    if (window.VIP_SYSTEM_STATUS !== 'on') {
        if (actionContainer) actionContainer.style.display = 'none';
        if (timerContainer) timerContainer.style.display = 'none';
        if (badge) {
            badge.innerText = "Usuario Estándar";
            badge.classList.remove('vip-active');
        }
        return;
    }

    if (!badge) return; 

    if (isUserVip()) {
        badge.innerText = "Miembro VIP";
        badge.classList.add('vip-active');
        if(actionContainer) actionContainer.style.display = 'none';
        if(timerContainer) timerContainer.style.display = 'flex';
        updateTimerDisplay(timerText);
    } else {
        badge.innerText = "Usuario Estándar";
        badge.classList.remove('vip-active');
        if(actionContainer) actionContainer.style.display = 'flex';
        if(timerContainer) timerContainer.style.display = 'none';
    }
};

let vipInterval;
function updateTimerDisplay(element) {
    if (!element) return;
    const vipUntil = localStorage.getItem('auraflix_vip_until');
    if (!vipUntil) return;

    clearInterval(vipInterval); 
    vipInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = parseInt(vipUntil) - now;

        if (distance < 0) {
            clearInterval(vipInterval);
            checkVipTimerUI(); 
            return;
        }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        element.innerText = `${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}

// CORRECCIÓN: Conectamos el botón apenas carga la página de forma segura
window.addEventListener('load', () => {
    const btnActivate = document.getElementById('btnActivateVip');
    if(btnActivate) {
        btnActivate.onclick = window.startVipProcess; 
    }

    setTimeout(() => {
        checkVipDeepLink();
        checkVipTimerUI();
    }, 100);
});
