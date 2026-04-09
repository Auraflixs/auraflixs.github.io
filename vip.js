// ==========================================
// CONFIGURACIÓN GENERAL DE SISTEMAS VIP
// ==========================================
window.VIP_SYSTEM_STATUS = 'on';    
window.UNLOCK_LINK_STATUS = 'off';   

const VIP_DURATION = 24 * 60 * 60 * 1000; // 12 horas

window.startVipProcess = function() {
    if (window.VIP_SYSTEM_STATUS !== 'on') {
        if (typeof showToast === 'function') showToast("El sistema VIP Global está desactivado.");
        return;
    }

    let linkToUse = "";

    // Verificamos si existe la lista del archivo linkvip.js
    if (typeof window.vipLinksList !== 'undefined' && Array.isArray(window.vipLinksList) && window.vipLinksList.length > 0) {
        
        // Obtenemos el índice actual (por defecto 0)
        let currentIndex = parseInt(localStorage.getItem('auraflix_vip_global_index')) || 0;
        
        // Si el índice sobrepasa la lista, se queda en el último enlace disponible
        if (currentIndex >= window.vipLinksList.length) {
            currentIndex = window.vipLinksList.length - 1;
        }
        
        linkToUse = window.vipLinksList[currentIndex];
        
        // Preparamos el índice para el siguiente usuario/clic (si no hemos llegado al final)
        if (currentIndex < window.vipLinksList.length - 1) {
            localStorage.setItem('auraflix_vip_global_index', currentIndex + 1);
        }
    } else {
        if (typeof showToast === 'function') showToast("Error: No se encontró el archivo linkvip.js o está vacío.");
        return;
    }

    // Guardamos el ticket de seguridad y redirigimos
    localStorage.setItem('auraflix_vip_tkt', new Date().getTime());
    window.location.assign(linkToUse);
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
        
        const modalVip = document.getElementById('vipModal');
        if (modalVip) modalVip.style.display = 'none';

        if (typeof switchView === 'function') switchView('profile');
        if (typeof checkVipTimerUI === 'function') checkVipTimerUI();
    }
}

window.checkVipTimerUI = function() {
    const badge = document.getElementById('profileBadge');
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
