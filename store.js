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
    initFirestore();
    initModals();
});

// === FIRESTORE: Escuchar productos en tiempo real ===
function initFirestore() {
    db.collection('productos').onSnapshot(snapshot => {
        products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderStore();
    }, err => console.error("Error cargando productos:", err));
}

window.nextCardImg = function(id, dir) {
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



﻿function createCardHtml(prod) {
    const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);
    const sizesHtml = sizes.map(t => `<span class="size-badge">${t}</span>`).join('');
    
    let desc = prod.descuento || 0;
    let pVenta = prod.precioVenta || 0;
    let precioFinal = pVenta - (pVenta * desc / 100);
    let hotClass = desc >= 15 ? 'hot' : '';
    
    let fotosArray = prod.fotos || (prod.foto ? [prod.foto] : []);
    let mainPhoto = fotosArray.length > 0 ? fotosArray[0] : '';
    
    return `
    <div class="product-card" onclick="openProductModal('${prod.id}')">
        <div class="card-img-wrapper" style="position:relative;">
            ${desc > 0 ? `<div class="promo-badge ${hotClass}">-${desc}% OFF ${desc>=15?'🔥':''}</div>` : ''}
            ${fotosArray.length > 1 ? `
                <button class="card-nav-btn left-btn" onclick="event.stopPropagation(); window.nextCardImg('${prod.id}', -1)">&#10094;</button>
                <button class="card-nav-btn right-btn" onclick="event.stopPropagation(); window.nextCardImg('${prod.id}', 1)">&#10095;</button>
            ` : ''}
            ${mainPhoto 
                ? `<img id="card-img-${prod.id}" src="${mainPhoto}" alt="${prod.nombre}" loading="lazy">` 
                : `<div style="height:250px; background:linear-gradient(45deg, #111, #222); display:flex; align-items:center; justify-content:center; color:#555;">Sin foto</div>`}
        </div>
        <div class="card-info">
            <span class="brand-tag">${prod.marca || 'Otro'}</span>
            <h3>${prod.nombre}</h3>
            <div class="price-container">
                ${desc > 0 ? `<span class="price-old">${formatCOP(pVenta)}</span>` : ''}
                <span class="price-new">${formatCOP(precioFinal)}</span>
            </div>
            <div class="card-sizes">${sizesHtml}</div>
        </div>
    </div>`;
}

function shuffle(arr) {
    let array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

window.renderStore = function() {
    const grid = $('product-grid');
    if (!grid) return;

    let available = products.filter(p => getTotalStock(p) > 0);

    if (available.length === 0) {
        let msg = window.FILTER_GENDER ? `Pronto subiremos más tenis para ${window.FILTER_GENDER}.` : "Pronto subiremos más tenis.";
        grid.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:3rem; grid-column:1/-1; font-size:1.1rem;">${msg} ¡Escríbenos por WhatsApp y te conseguimos los que buscas! 👟</p>`;
        return;
    }

    if (!window.FILTER_GENDER) {
        // --- INDEX.HTML LOGIC ---
        let availableMen = available.filter(p => p.genero === 'Hombre' || p.genero === 'Unisex');
        let availableWomen = available.filter(p => p.genero === 'Mujer' || p.genero === 'Unisex');
        
        let promosMen = availableMen.filter(p => p.enPromocion);
        if (promosMen.length < 8) promosMen = shuffle(availableMen).slice(0, 8);
        
        let promosWomen = availableWomen.filter(p => p.enPromocion);
        if (promosWomen.length < 8) promosWomen = shuffle(availableWomen).slice(0, 8);
        
        let promos = shuffle([...promosMen, ...promosWomen]);
        promos = promos.map(p => ({...p, fakePromo: true, descuento: p.descuento || 15}));
        
        if (!document.getElementById('promo-banner')) {
            const banner = document.createElement('div');
            banner.id = 'promo-banner';
            banner.innerHTML = `<h1 style="text-align:center; font-family:'Bebas Neue', sans-serif; font-size:3rem; color:var(--neon-green); letter-spacing:2px; margin:2rem 0 0.5rem 0; text-shadow:0 0 10px rgba(0,255,136,0.3);">🔥 PROMOCIONES DEL DÍA 🔥</h1>
            <p style="text-align:center; color:var(--text-muted); margin-bottom:2rem;">Lleva tu estilo al siguiente nivel con ofertas divididas equitativamente.</p>`;
            grid.parentNode.insertBefore(banner, grid);
        }
        
        grid.innerHTML = promos.map(prod => createCardHtml(prod)).join('');
        
    } else {
        // --- HOMBRES / MUJERES SUBPAGES LOGIC ---
        available = available.filter(p => {
            if (window.FILTER_GENDER === 'Hombre') return p.genero === 'Hombre' || p.genero === 'Unisex';
            if (window.FILTER_GENDER === 'Mujer') return p.genero === 'Mujer' || p.genero === 'Unisex';
            return p.genero === window.FILTER_GENDER;
        });

        let promos = available.filter(p => p.enPromocion);
        if (promos.length < 8) promos = shuffle(available).slice(0, 8);
        promos = promos.map(p => ({...p, fakePromo: true, descuento: p.descuento || 15}));
        
        let promoIds = promos.map(p => p.id);
        let regular = available.filter(p => !promoIds.includes(p.id));
        if (regular.length === 0) regular = available;

        let html = `
        <div style="margin: 2rem 0;">
            <h2 style="font-family:'Bebas Neue', sans-serif; font-size:2.5rem; color:var(--neon-green); text-align:center; letter-spacing:2px; text-shadow:0 0 10px rgba(0,255,136,0.3);">🔥 PROMOCIONES EXCLUSIVAS 🔥</h2>
            <div class="horizontal-carousel">
                ${promos.map(prod => createCardHtml(prod)).join('')}
            </div>
        </div>
        <h2 style="font-family:'Bebas Neue', sans-serif; font-size:2.5rem; text-align:center; letter-spacing:2px; margin-top:4rem; margin-bottom:1rem;">NUEVA COLECCIÓN</h2>
        <div class="product-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; width: 100%;">
            ${regular.map(prod => createCardHtml(prod)).join('')}
        </div>
        `;
        
        grid.style.display = 'block'; // Quitar el grid base porque el html interior ya tiene su propio layout
        grid.innerHTML = html;
    }
}


function initModals() {
    const resetZoom = () => {
        const c = document.querySelector('.modal-image-container');
        if (c) c.classList.remove('zoomed');
    };
    
    $('modal-close')?.addEventListener('click', () => {
        $('product-modal').classList.add('hidden');
        resetZoom();
    });
    $('product-modal')?.addEventListener('click', e => {
        if (e.target === $('product-modal')) {
            $('product-modal').classList.add('hidden');
            resetZoom();
        }
    });

    const imgContainer = document.querySelector('.modal-image-container');
    const img = $('modal-img');
    if (imgContainer && img) {
        // Desktop zoom pan
        imgContainer.addEventListener('mousemove', e => {
            if (!imgContainer.classList.contains('zoomed')) return;
            const rect = imgContainer.getBoundingClientRect();
            const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
            const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
            img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        });

        // Mobile touch pan
        imgContainer.addEventListener('touchmove', e => {
            if (!imgContainer.classList.contains('zoomed')) return;
            e.preventDefault(); // Prevents page scrolling while panning
            const touch = e.touches[0];
            const rect = imgContainer.getBoundingClientRect();
            const xPercent = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
            const yPercent = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
            img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        }, { passive: false });

        // Toggle zoom
        imgContainer.addEventListener('click', e => {
            if (e.target.closest('.modal-nav-btn') || e.target.closest('.modal-thumbs-container')) return;
            
            if (imgContainer.classList.contains('zoomed')) {
                imgContainer.classList.remove('zoomed');
                img.style.transformOrigin = 'center center';
            } else {
                imgContainer.classList.add('zoomed');
                const rect = imgContainer.getBoundingClientRect();
                const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
                const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
                img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
            }
        });
    }
}

window.currentModalPhotos = [];
window.currentPhotoIndex = 0;

window.changeModalImg = function(idx) {
    if (!currentModalPhotos || currentModalPhotos.length === 0) return;
    currentPhotoIndex = idx;
    const img = $('modal-img');
    const container = document.querySelector('.modal-image-container');
    if (container) container.classList.remove('zoomed');
    if (img) {
        img.src = currentModalPhotos[idx];
        img.style.transformOrigin = 'center center';
    }

    // Resaltar la miniatura activa
    document.querySelectorAll('.modal-thumb-item').forEach((t, i) => {
        if (i === idx) {
            t.style.borderColor = 'var(--neon-green)';
            t.style.opacity = '1';
        } else {
            t.style.borderColor = 'transparent';
            t.style.opacity = '0.6';
        }
    });
};

window.nextModalImg = function(dir) {
    if (!currentModalPhotos || currentModalPhotos.length <= 1) return;
    let newIdx = currentPhotoIndex + dir;
    if (newIdx < 0) newIdx = currentModalPhotos.length - 1;
    if (newIdx >= currentModalPhotos.length) newIdx = 0;
    changeModalImg(newIdx);
};

window.openProductModal = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const modal = $('product-modal');

    const img = $('modal-img');
    currentModalPhotos = prod.fotos || (prod.foto ? [prod.foto] : []);
    currentPhotoIndex = 0;
    
    let container = img.parentElement;
    container.style.position = 'relative';
    
    // Limpiar nav previa
    container.querySelectorAll('.modal-nav-btn, .modal-thumbs-container').forEach(el => el.remove());

    // Agregar flechas si hay >1 foto
    if (currentModalPhotos.length > 1) {
        let leftBtn = document.createElement('button');
        leftBtn.className = 'modal-nav-btn left-btn';
        leftBtn.innerHTML = '&#10094;';
        leftBtn.onclick = () => nextModalImg(-1);

        let rightBtn = document.createElement('button');
        rightBtn.className = 'modal-nav-btn right-btn';
        rightBtn.innerHTML = '&#10095;';
        rightBtn.onclick = () => nextModalImg(1);

        container.appendChild(leftBtn);
        container.appendChild(rightBtn);
    }
    
    // Inject thumbnails if multiple
    let thumbHtml = '';
    if (currentModalPhotos.length > 1) {
        thumbHtml = `<div style="display:flex; gap:0.5rem; justify-content:center; padding: 0.5rem; overflow-x:auto;">` + 
            currentModalPhotos.map((url, idx) => `<img src="${url}" class="modal-thumb-item" onclick="changeModalImg(${idx})" style="width:50px; height:50px; object-fit:cover; border-radius:4px; cursor:pointer; border:2px solid transparent; opacity:0.6; transition:0.3s;">`).join('') +
            `</div>`;
    }
    
    if (currentModalPhotos.length > 0) {
        img.src = currentModalPhotos[0];
        img.style.display = 'block';
        if (thumbHtml) {
            let div = document.createElement('div');
            div.className = 'modal-thumbs-container';
            div.innerHTML = thumbHtml;
            container.appendChild(div);
        }
        changeModalImg(0); // init highlight
    } else {
        img.style.display = 'none';
    }

    let desc = prod.descuento || (prod.fakePromo ? 10 : 0);
    // If it's a fake promo (fallback), we need to ensure the modal shows the same fake discount
    // We didn't persist the fake promo globally, let's just re-check if we are in fake mode.
    // Actually simpler: just calculate based on prod.descuento. The fake promo was only on the map.
    // Let's rely on the DOM for the price if we want, or just calculate it again.
    const isFake = !products.some(p => p.enPromocion);
    if (isFake) desc = 10;
    
    let pVenta = prod.precioVenta || 0;
    let precioFinal = pVenta - (pVenta * desc / 100);

    $('modal-brand').textContent = prod.marca;
    $('modal-title').textContent = prod.nombre;
    $('modal-price').innerHTML = desc > 0 ? `<span class="old-price">${formatCOP(pVenta)}</span> ${formatCOP(precioFinal)}` : formatCOP(pVenta);
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
        const msg = `¡Hola! Me interesan los tenis en promoción: *${prod.nombre}* (${prod.marca})\n👟 Talla: *${size}*\n💵 Precio Promo: *${formatCOP(precioFinal)}*\n¿Están disponibles para envío?`;
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
// LIGHTBOX FULLSCREEN LOGIC
// ==========================================
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxCounter = document.getElementById('lightbox-counter');

function updateLightbox() {
    if (!currentModalPhotos || currentModalPhotos.length === 0) return;
    lightboxImg.src = currentModalPhotos[currentPhotoIndex];
    if (lightboxCounter) lightboxCounter.textContent = (currentPhotoIndex + 1) + ' / ' + currentModalPhotos.length;
    
    if (lightboxPrev) lightboxPrev.style.display = currentModalPhotos.length > 1 ? 'block' : 'none';
    if (lightboxNext) lightboxNext.style.display = currentModalPhotos.length > 1 ? 'block' : 'none';
}

function openLightbox() {
    if (!currentModalPhotos || currentModalPhotos.length === 0) return;
    updateLightbox();
    if (lightbox) lightbox.classList.remove('hidden');
}

function closeLightbox() {
    if (lightbox) lightbox.classList.add('hidden');
}

function lightboxNavigate(dir) {
    if (!currentModalPhotos) return;
    currentPhotoIndex += dir;
    if (currentPhotoIndex < 0) currentPhotoIndex = currentModalPhotos.length - 1;
    if (currentPhotoIndex >= currentModalPhotos.length) currentPhotoIndex = 0;
    
    updateLightbox();
    
    // Sincronizar el modal original detrás
    const img = document.getElementById('modal-img');
    if (img) img.src = currentModalPhotos[currentPhotoIndex];
    
    document.querySelectorAll('.modal-thumb-item').forEach((el, i) => {
        el.style.border = i === currentPhotoIndex ? '2px solid var(--neon-green)' : '2px solid transparent';
        el.style.opacity = i === currentPhotoIndex ? '1' : '0.6';
    });
}

// Bind Lightbox Events
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); lightboxNavigate(-1); });
if (lightboxNext) lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); lightboxNavigate(1); });
if (lightbox) lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target === lightboxClose) closeLightbox();
});

// Bind click on modal image to open lightbox (y cancelar el zoom viejo si se hace click)
const modalMainImg = document.getElementById('modal-img');
if (modalMainImg) {
    modalMainImg.style.cursor = 'zoom-in';
    modalMainImg.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que se active el zoom viejo del contenedor
        openLightbox();
    });
}

// Swipe Support para celular en el lightbox
let touchstartX = 0;
let touchendX = 0;

if (lightboxImg) {
    lightboxImg.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, {passive: true});

    lightboxImg.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        if (touchendX < touchstartX - 50) lightboxNavigate(1);
        if (touchendX > touchstartX + 50) lightboxNavigate(-1);
    }, {passive: true});
}
