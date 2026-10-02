/**
 * O'G YAM CREPS — Tienda Pública (store.js)
 * Solo catálogo, filtros y WhatsApp. Sin rastro de admin.
 */

const firebaseConfig = {
  apiKey: "AIzaSyC0aguCa2fPrnOfheOrZV1oQe_1wQDOr50",
  authDomain: "og-yam-creps.firebaseapp.com",
  projectId: "og-yam-creps",
  storageBucket: "og-yam-creps.firebasestorage.app",
  messagingSenderId: "427327061733",
  appId: "1:427327061733:web:a946d60638411e63831e0c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const WHATSAPP_NUMBER = '573128663161';
let products = [];

document.addEventListener('DOMContentLoaded', () => {
    initStoreConfig();
    initFirestore();
    initModals();
});

let storeConfig = { promoLimit: 8, promoRotation: 'random' };

// === FIRESTORE: Escuchar configuración ===
function initStoreConfig() {
    db.collection('config').doc('store').onSnapshot(doc => {
        if (doc.exists) {
            storeConfig = { ...storeConfig, ...doc.data() };
        }
        if (products.length > 0) renderStore();
    }, err => console.error("Error config:", err));
}

// === FIRESTORE: Escuchar productos en tiempo real ===
function initFirestore() {
    db.collection('productos').onSnapshot(snapshot => {
        products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderStore();
    }, err => console.error("Error cargando productos:", err));
}

window.nextCardImg = function(id, dir) {
    window.currentProductId = id;
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    let fotos = prod.fotos || (prod.foto ? [prod.foto] : []);
    if (fotos.length <= 1) return;
    
    let imgEl = document.getElementById('card-img-' + id);
    if (!imgEl) return;
    
    let currentSrc = imgEl.getAttribute('src');
    // For relative URLs or mismatches, we can also keep track of current index, 
    // but a direct indexOf match is usually fine for absolute URLs.
    let idx = fotos.indexOf(currentSrc);
    if (idx === -1) idx = 0;
    
    let newIdx = idx + dir;
    if (newIdx < 0) newIdx = fotos.length - 1;
    if (newIdx >= fotos.length) newIdx = 0;
    
    imgEl.src = fotos[newIdx];
};



function createCardHtml(prod) {
    const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);
    const sizesHtml = sizes.map(t => `<span class="size-badge">${t}</span>`).join('');
    
    let isPromo = prod.enPromocion || prod.fakePromo;
    let pType = prod.tipoPromocion || 'percentage';
    let desc = prod.descuento || (prod.fakePromo ? 15 : 0);
    let pVenta = prod.precioVenta || 0;
    let precioFinal = pVenta;
    
    let priceHtml = '';
    window.waMsgType = ''; // use global to share with the event listener safely

    if (isPromo) {
        if (pType === '2x1') {
            priceHtml = `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div><div class="promo-badge hot" style="display:inline-block; margin-top:0.5rem;">¡2x1! Lleva 2 Paga 1</div>`;
            window.waMsgType = '2x1 🔥';
        } else if (pType === 'freeshipping') {
            priceHtml = `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div><div class="promo-badge" style="display:inline-block; margin-top:0.5rem; background:#0099ff; color:white;">Envío Gratis 🚚</div>`;
            window.waMsgType = 'con Envío Gratis 🚚';
        } else {
            precioFinal = pVenta - (pVenta * desc / 100);
            let badgeTxt = pType === 'clearance' ? `REMATE -${desc}%` : `-${desc}%`;
            priceHtml = `<div class="price-old-wrap"><span class="price-label">Antes:</span><span class="price-old strike-anim">${formatCOP(pVenta)}</span></div>
             <div class="price-new-wrap"><span class="price-label highlight">Ahora:</span><span class="price-new">${formatCOP(precioFinal)}</span></div>
             <div class="promo-badge hot" style="display:inline-block; margin-top:0.5rem;">${badgeTxt}</div>`;
            window.waMsgType = `en Promo (${badgeTxt})`;
        }
    } else {
        priceHtml = `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div>`;
    }

    $('modal-brand').textContent = prod.marca;
    $('modal-title').textContent = prod.nombre;
    $('modal-price').innerHTML = priceHtml;
    $('modal-desc').textContent = [prod.color ? 'Color: ' + prod.color : '', prod.genero, 'Medellín, Colombia · Envíos a todo el país'].filter(Boolean).join(' · ');

    const sizesContainer = $('modal-size-selector');
    const available = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);

    sizesContainer.innerHTML = available.length > 0
        ? available.map((t, i) => `<button class="size-btn ${i === 0 ? 'selected' : ''}" data-size="${t}">${t}</button>`).join('')
        : '<p style="color:#ff3333;">Agotado</p>';

    sizesContainer.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sizesContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    const waBtn = $('modal-wa-btn');
    const newBtn = waBtn.cloneNode(true);
    waBtn.parentNode.replaceChild(newBtn, waBtn);
    newBtn.id = 'modal-wa-btn';
    newBtn.addEventListener('click', () => {
        const selectedBtn = sizesContainer?.querySelector('.size-btn.selected');
        const size = selectedBtn ? selectedBtn.dataset.size : 'N/A';
        const msg = `¡Hola! Me interesan los tenis ${window.waMsgType || ''}: *\n${prod.nombre}* (${prod.marca})\n👟 Talla: *${size}*\n💰 Precio: *${formatCOP(precioFinal)}*\n¿Están disponibles?`;
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    modal.classList.remove('hidden');
};

window.quickWhatsApp = (id, precioPromo) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0).join(', ');
    const msg = `¡Hola! Me interesan los tenis en promoción: *${prod.nombre}* (${prod.marca})\nTallas que vi: ${sizes}\nPrecio Promo: *${formatCOP(precioPromo)}*\n¿Me podrías confirmar disponibilidad?`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
};

// === HELPERS ===
function $(id) { return document.getElementById(id); }
function formatCOP(n) { return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function getTotalStock(prod) {
    if (!prod || !prod.tallas) return 0;
    return Object.values(prod.tallas).reduce((s, q) => s + (parseInt(q) || 0), 0);
}

// ==========================================
// LIGHTBOX FULLSCREEN LOGIC (CON ZOOM Y NAVEGACION ENTRE PRODUCTOS)
// ==========================================
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxCounter = document.getElementById('lightbox-counter');

let lbScale = 1;
let lbPanX = 0;
let lbPanY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;

function resetLightboxZoom() {
    lbScale = 1;
    lbPanX = 0;
    lbPanY = 0;
    if(lightboxImg) {
        lightboxImg.style.transform = `translate(0px, 0px) scale(1)`;
        lightboxImg.style.transition = 'transform 0.3s ease';
    }
}

function updateLightbox() {
    if (!currentModalPhotos || currentModalPhotos.length === 0) return;
    lightboxImg.src = currentModalPhotos[currentPhotoIndex];
    if (lightboxCounter) lightboxCounter.textContent = (currentPhotoIndex + 1) + ' / ' + currentModalPhotos.length;
    
    if (lightboxPrev) lightboxPrev.style.display = 'block';
    if (lightboxNext) lightboxNext.style.display = 'block';
}

function openLightbox() {
    if (!currentModalPhotos || currentModalPhotos.length === 0) return;
    resetLightboxZoom();
    updateLightbox();
    if (lightbox) lightbox.classList.remove('hidden');
}

function closeLightbox() {
    if (lightbox) lightbox.classList.add('hidden');
    resetLightboxZoom();
}

function lightboxNavigate(dir) {
    window.navigateGlobal(dir);
}

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); lightboxNavigate(-1); });
if (lightboxNext) lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); lightboxNavigate(1); });
if (lightbox) lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target === lightboxClose) closeLightbox();
});

const modalMainImg = document.getElementById('modal-img');
if (modalMainImg) {
    modalMainImg.style.cursor = 'zoom-in';
    modalMainImg.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox();
    });
}

if (lightboxImg) {
    let lastTap = 0;
    
    lightboxImg.addEventListener('touchend', (e) => {
        let currentTime = new Date().getTime();
        let tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            e.preventDefault();
            if (lbScale > 1) resetLightboxZoom();
            else {
                lbScale = 2.5;
                lightboxImg.style.transition = 'transform 0.3s ease';
                lightboxImg.style.transform = `translate(0px, 0px) scale(${lbScale})`;
            }
        }
        lastTap = currentTime;
    });

    lightboxImg.addEventListener('dblclick', () => {
        if (lbScale > 1) resetLightboxZoom();
        else {
            lbScale = 2.5;
            lightboxImg.style.transition = 'transform 0.3s ease';
            lightboxImg.style.transform = `translate(0px, 0px) scale(${lbScale})`;
        }
    });

    lightboxImg.addEventListener('wheel', (e) => {
        e.preventDefault();
        lightboxImg.style.transition = 'none';
        lbScale += e.deltaY * -0.005;
        lbScale = Math.min(Math.max(1, lbScale), 4);
        if (lbScale === 1) { lbPanX = 0; lbPanY = 0; }
        lightboxImg.style.transform = `translate(${lbPanX}px, ${lbPanY}px) scale(${lbScale})`;
    });

    let touchstartX = 0;
    let touchstartY = 0;
    
    const startDrag = (x, y) => {
        isDragging = true;
        startDragX = x - lbPanX;
        startDragY = y - lbPanY;
        lightboxImg.style.transition = 'none';
    };
    
    const moveDrag = (x, y) => {
        if (!isDragging) return;
        if (lbScale > 1) {
            lbPanX = x - startDragX;
            lbPanY = y - startDragY;
            lightboxImg.style.transform = `translate(${lbPanX}px, ${lbPanY}px) scale(${lbScale})`;
        }
    };
    
    const endDrag = (x, y, isTouch) => {
        isDragging = false;
        if (lbScale === 1 && isTouch) {
            let diffX = x - touchstartX;
            let diffY = y - touchstartY;
            if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX < 0) lightboxNavigate(1);
                else lightboxNavigate(-1);
            }
        }
    };

    lightboxImg.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY;
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: true});
    
    lightboxImg.addEventListener('touchmove', e => {
        if (lbScale > 1) e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: false});

    lightboxImg.addEventListener('touchend', e => {
        endDrag(e.changedTouches[0].screenX, e.changedTouches[0].screenY, true);
    });

    lightboxImg.addEventListener('mousedown', e => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
    });
    
    window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', e => endDrag(e.clientX, e.clientY, false));
}
// GESTOS DE ZOOM Y SWIPE (Mouse y Touch) COMPLETAMENTE REESCRITOS PARA 0 BUGS
if (lightboxImg) {
    let lastTap = 0;
    
    const img = lightboxImg;

    // Doble Click PC
    img.addEventListener('dblclick', () => {
        if (lbScale > 1) resetLightboxZoom();
        else {
            lbScale = 2.5;
            img.style.transition = 'transform 0.3s ease';
            img.style.transform = `translate(0px, 0px) scale(${lbScale})`;
        }
    });

    // Rueda del ratón PC
    img.addEventListener('wheel', (e) => {
        e.preventDefault();
        img.style.transition = 'none';
        lbScale += e.deltaY * -0.005;
        lbScale = Math.min(Math.max(1, lbScale), 4);
        if (lbScale === 1) { lbPanX = 0; lbPanY = 0; }
        img.style.transform = `translate(${lbPanX}px, ${lbPanY}px) scale(${lbScale})`;
    }, {passive: false});

    let touchstartX = 0;
    let touchstartY = 0;
    
    const startDrag = (x, y) => {
        isDragging = true;
        startDragX = x - lbPanX;
        startDragY = y - lbPanY;
        img.style.transition = 'none';
    };
    
    const moveDrag = (x, y) => {
        if (!isDragging) return;
        if (lbScale > 1) {
            lbPanX = x - startDragX;
            lbPanY = y - startDragY;
            
            // Limitador de paneo para evitar perder la imagen (opcional pero recomendado)
            const maxPan = 500 * (lbScale - 1); // aproximación simple
            lbPanX = Math.max(-maxPan, Math.min(maxPan, lbPanX));
            lbPanY = Math.max(-maxPan, Math.min(maxPan, lbPanY));
            
            img.style.transform = `translate(${lbPanX}px, ${lbPanY}px) scale(${lbScale})`;
        }
    };
    
    const endDrag = (x, y, isTouch) => {
        if (!isDragging) return;
        isDragging = false;
        
        let diffX = x - touchstartX;
        let diffY = y - touchstartY;
        let distance = Math.sqrt(diffX*diffX + diffY*diffY);

        if (isTouch) {
            if (distance > 30) {
                // Fue un swipe intencional
                if (lbScale === 1) {
                    if (Math.abs(diffX) > Math.abs(diffY)) {
                        if (diffX < 0) lightboxNavigate(1);
                        else lightboxNavigate(-1);
                    }
                }
            } else {
                // Fue un tap (movimiento minimo)
                let currentTime = new Date().getTime();
                let tapLength = currentTime - lastTap;
                if (tapLength < 300 && tapLength > 0) {
                    // Double tap
                    if (lbScale > 1) resetLightboxZoom();
                    else {
                        lbScale = 2.5;
                        img.style.transition = 'transform 0.3s ease';
                        img.style.transform = `translate(0px, 0px) scale(${lbScale})`;
                    }
                    lastTap = 0;
                } else {
                    lastTap = currentTime;
                }
            }
        } else {
            // Logica PC mouse swipe
            if (lbScale === 1 && Math.abs(diffX) > 50) {
                if (diffX < 0) lightboxNavigate(1);
                else lightboxNavigate(-1);
            }
        }
    };

    img.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY;
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: true});
    
    img.addEventListener('touchmove', e => {
        // MUY IMPORTANTE: Previene la navegación nativa de iOS/Android "hacia atrás"
        if (e.cancelable) e.preventDefault(); 
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: false});

    img.addEventListener('touchend', e => {
        endDrag(e.changedTouches[0].screenX, e.changedTouches[0].screenY, true);
    });

    img.addEventListener('dragstart', e => e.preventDefault());
    img.addEventListener('mousedown', e => {
        e.preventDefault();
        touchstartX = e.clientX; 
        touchstartY = e.clientY;
        startDrag(e.clientX, e.clientY);
    });
    
    window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', e => {
        if(isDragging) endDrag(e.clientX, e.clientY, false);
    });
}

// ==========================================
// NAVEGACION POR TECLADO EN PC
// ==========================================
document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (lb && !lb.classList.contains('hidden')) {
        if (e.key === 'ArrowRight') {
            lightboxNavigate(1);
        } else if (e.key === 'ArrowLeft') {
            lightboxNavigate(-1);
        } else if (e.key === 'Escape') {
            closeLightbox();
        }
    }
});
