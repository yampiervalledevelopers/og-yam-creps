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

window.nextCardImg = function(id, dir, btn) {
    window.currentProductId = id;
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    let fotos = prod.fotos || (prod.foto ? [prod.foto] : []);
    if (fotos.length <= 1) return;
    
    let imgEl = (btn && btn.closest) ? btn.closest('.card-img-wrapper')?.querySelector('.card-img') : document.getElementById('card-img-' + id);
    if (!imgEl) imgEl = document.getElementById('card-img-' + id);
    if (!imgEl) return;
    
    let currentSrc = imgEl.getAttribute('src');
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
    
    let desc = prod.descuento || 0;
    let pVenta = prod.precioVenta || 0;
    let isPromo = prod.enPromocion || prod.fakePromo;
    let pType = prod.tipoPromocion || 'percentage';
    
    let precioFinal = pVenta;
    let badgeHtml = '';
    let priceHtml = '';

    if (isPromo) {
        if (pType === '2x1') {
            badgeHtml = `<div class="promo-badge hot">¡2x1! 🔥</div>`;
            priceHtml = `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div>`;
        } else if (pType === 'freeshipping') {
            badgeHtml = `<div class="promo-badge" style="background:#0099ff; color:white;">Envío Gratis 🚚</div>`;
            priceHtml = `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div>`;
        } else {
            precioFinal = pVenta - (pVenta * desc / 100);
            let hotClass = desc >= 15 ? 'hot' : '';
            let text = pType === 'clearance' ? `REMATE -${desc}%` : `-${desc}% OFF`;
            badgeHtml = `<div class="promo-badge ${hotClass}">${text} ${desc>=15?'🔥':''}</div>`;
            priceHtml = `
                <div class="price-old-wrap"><span class="price-label">Antes:</span><span class="price-old strike-anim">${formatCOP(pVenta)}</span></div>
                <div class="price-new-wrap"><span class="price-label highlight">Ahora:</span><span class="price-new">${formatCOP(precioFinal)}</span></div>
            `;
        }
    } else if (prod.isNovedad) {
        badgeHtml = `<div class="promo-badge" style="background:var(--neon-green); color:#000; font-weight:800; box-shadow:0 0 10px rgba(57,255,20,0.4);">⚡ NUEVO</div>`;
        priceHtml = `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div>`;
    } else {
        priceHtml = `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div>`;
    }
    
    let fotosArray = prod.fotos || (prod.foto ? [prod.foto] : []);
    let mainPhoto = fotosArray.length > 0 ? fotosArray[0] : '';
    
    return `
    <div class="product-card" onclick="openProductModal('${prod.id}')">
        <div class="card-img-wrapper" style="position:relative;">
            ${badgeHtml}
            ${fotosArray.length > 1 ? `
                <button class="card-nav-btn left-btn" onclick="event.stopPropagation(); window.nextCardImg('${prod.id}', -1, this)">&#10094;</button>
                <button class="card-nav-btn right-btn" onclick="event.stopPropagation(); window.nextCardImg('${prod.id}', 1, this)">&#10095;</button>
            ` : ''}
            ${mainPhoto 
                ? `<img id="card-img-${prod.id}" class="card-img" src="${mainPhoto}" alt="${prod.nombre}" loading="lazy">` 
                : `<div style="height:250px; background:linear-gradient(45deg, #111, #222); display:flex; align-items:center; justify-content:center; color:#555;">Sin foto</div>`}
        </div>
        <div class="card-info">
            <span class="brand-tag">${prod.marca || 'Otro'}</span>
            <h3>${prod.nombre}</h3>
            <div class="price-container">
                ${priceHtml}
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
    const loader = document.getElementById('initial-loader');
    if (loader) loader.style.display = 'none';

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
        
        let limit = (typeof storeConfig !== 'undefined') ? (storeConfig.promoLimit || 8) : 8;
        let availableMenRot = (typeof storeConfig !== 'undefined' && storeConfig.promoRotation === 'fixed') ? availableMen : shuffle(availableMen);
        let availableWomenRot = (typeof storeConfig !== 'undefined' && storeConfig.promoRotation === 'fixed') ? availableWomen : shuffle(availableWomen);

        let promosMen = availableMenRot.filter(p => p.enPromocion);
        if (promosMen.length < limit) promosMen = [...promosMen, ...availableMenRot.filter(p => !p.enPromocion)].slice(0, limit);
        
        let promosWomen = availableWomenRot.filter(p => p.enPromocion);
        if (promosWomen.length < limit) promosWomen = [...promosWomen, ...availableWomenRot.filter(p => !p.enPromocion)].slice(0, limit);
        
        let promos = [...promosMen, ...promosWomen];
        if (typeof storeConfig === 'undefined' || storeConfig.promoRotation !== 'fixed') promos = shuffle(promos);
        
        promos = promos.map(p => p.enPromocion ? p : ({...p, fakePromo: true, descuento: p.descuento || 15, tipoPromocion: p.tipoPromocion || 'percentage'}));
        
        if (!document.getElementById('promo-banner')) {
            const banner = document.createElement('div');
            banner.id = 'promo-banner';
            banner.innerHTML = `<div class="promo-marquee-container"><div class="promo-marquee-track"><span>🔥 PROMOCIONES DEL DÍA 🔥</span><span>ENVÍO A TODA COLOMBIA 🚀</span><span>🔥 PROMOCIONES DEL DÍA 🔥</span><span>ENVÍO A TODA COLOMBIA 🚀</span><span>🔥 PROMOCIONES DEL DÍA 🔥</span><span>ENVÍO A TODA COLOMBIA 🚀</span><span>🔥 PROMOCIONES DEL DÍA 🔥</span><span>ENVÍO A TODA COLOMBIA 🚀</span></div></div>`;
            grid.parentNode.insertBefore(banner, grid);
        }
        
        grid.innerHTML = promos.map(prod => createCardHtml(prod)).join('');

        // --- BLOQUE NOVEDADES (ÚLTIMOS 7 DÍAS) ---
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        let novedades = available.filter(p => {
            const fecha = Number(p.fechaCreacion) || 0;
            const diff = now - fecha;
            return fecha > 0 && diff <= sevenDaysMs && diff >= -86400000;
        });
        novedades.sort((a, b) => (Number(b.fechaCreacion) || 0) - (Number(a.fechaCreacion) || 0));

        let novSection = $('novedades-section');
        if (!novSection) {
            novSection = document.createElement('div');
            novSection.id = 'novedades-section';
            grid.parentNode.appendChild(novSection);
        }

        if (novedades.length > 0) {
            novSection.style.display = 'block';
            novSection.innerHTML = `
                <div class="promo-marquee-container" style="background:#0a0a0a; color:var(--neon-green); border-top:2px solid var(--neon-green); border-bottom:2px solid var(--neon-green); box-shadow:0 0 20px rgba(57, 255, 20, 0.25); margin-top:4rem; margin-bottom:1.5rem;">
                    <div class="promo-marquee-track">
                        <span>⚡ NOVEDADES DE LA SEMANA ⚡</span>
                        <span>LO MÁS NUEVO EN TIENDA 👟</span>
                        <span>⚡ RECIÉN LLEGADOS 🔥</span>
                        <span>ÚLTIMOS LANZAMIENTOS 🚀</span>
                        <span>⚡ NOVEDADES DE LA SEMANA ⚡</span>
                        <span>LO MÁS NUEVO EN TIENDA 👟</span>
                        <span>⚡ RECIÉN LLEGADOS 🔥</span>
                        <span>ÚLTIMOS LANZAMIENTOS 🚀</span>
                    </div>
                </div>
                <div style="text-align:center; margin-bottom:1.8rem;">
                    <h2 style="font-family:'Bebas Neue', sans-serif; font-size:2.8rem; letter-spacing:2px; margin:0; color:#fff;">NOVEDADES</h2>
                    <p style="color:var(--neon-green); font-size:0.95rem; margin:0.3rem 0 0; font-weight:600; letter-spacing:1px; text-transform:uppercase;">🔥 Recién subidos en los últimos 7 días</p>
                </div>
                <div class="product-grid">
                    ${novedades.map(prod => createCardHtml(prod.enPromocion ? prod : {...prod, isNovedad: true})).join('')}
                </div>
            `;
        } else {
            novSection.innerHTML = '';
            novSection.style.display = 'none';
        }

        window.currentRenderedProducts = [...new Set([
            ...promos.map(p => p.id),
            ...novedades.map(p => p.id)
        ])];
        
    } else {
        // --- HOMBRES / MUJERES SUBPAGES LOGIC ---
        available = available.filter(p => {
            if (window.FILTER_GENDER === 'Hombre') return p.genero === 'Hombre' || p.genero === 'Unisex';
            if (window.FILTER_GENDER === 'Mujer') return p.genero === 'Mujer' || p.genero === 'Unisex';
            return p.genero === window.FILTER_GENDER;
        });

        let limit = (typeof storeConfig !== 'undefined') ? (storeConfig.promoLimit || 8) : 8;
        let availableRot = (typeof storeConfig !== 'undefined' && storeConfig.promoRotation === 'fixed') ? available : shuffle(available);
        
        let promos = availableRot.filter(p => p.enPromocion);
        if (promos.length < limit) promos = [...promos, ...availableRot.filter(p => !p.enPromocion)].slice(0, limit);
        
        promos = promos.map(p => p.enPromocion ? p : ({...p, fakePromo: true, descuento: p.descuento || 15, tipoPromocion: p.tipoPromocion || 'percentage'}));
        
        let promoIds = promos.map(p => p.id);
        let regular = available.filter(p => !promoIds.includes(p.id));
        if (regular.length === 0) regular = available;

        let html = `
        <div style="margin: 2rem 0;">
            <div class="promo-marquee-container" style="margin-top:0; box-shadow:none;"><div class="promo-marquee-track"><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span></div></div>
            <div class="horizontal-carousel">
                ${promos.map(prod => createCardHtml(prod)).join('')}
            </div>
        </div>
        <h2 style="font-family:'Bebas Neue', sans-serif; font-size:2.5rem; text-align:center; letter-spacing:2px; margin-top:4rem; margin-bottom:1rem;">NUEVA COLECCIÓN</h2>
        <div class="product-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; width: 100%;">
            ${regular.map(prod => createCardHtml(prod)).join('')}
        </div>
        `;
        
        window.currentRenderedProducts = [...new Set([...promos.map(p => p.id), ...regular.map(p => p.id)])];
        grid.style.display = 'block';
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

window.navigateGlobal = function(dir) {
    if (!currentModalPhotos) return;
    
    let newIdx = currentPhotoIndex + dir;
    let shouldChangeProduct = false;
    let prodDir = dir;

    if (newIdx < 0 || newIdx >= currentModalPhotos.length) {
        shouldChangeProduct = true;
    }

    if (shouldChangeProduct) {
        if (window.currentRenderedProducts && window.currentRenderedProducts.length > 0) {
            let currIdx = window.currentRenderedProducts.indexOf(window.currentProductId);
            if (currIdx === -1) currIdx = 0;
            
            let nextIdx = currIdx + prodDir;
            if (nextIdx < 0) nextIdx = window.currentRenderedProducts.length - 1;
            if (nextIdx >= window.currentRenderedProducts.length) nextIdx = 0;
            
            let nextProdId = window.currentRenderedProducts[nextIdx];
            
            openProductModal(nextProdId);
            
            if (prodDir < 0) {
                currentPhotoIndex = currentModalPhotos.length - 1;
            } else {
                currentPhotoIndex = 0;
            }
        } else {
            if (newIdx < 0) currentPhotoIndex = currentModalPhotos.length - 1;
            else currentPhotoIndex = 0;
        }
    } else {
        currentPhotoIndex = newIdx;
    }

    changeModalImg(currentPhotoIndex);
    
    const lb = document.getElementById('lightbox');
    if (lb && !lb.classList.contains('hidden')) {
        resetLightboxZoom();
        updateLightbox();
    }
};

window.nextModalImg = function(dir) { window.navigateGlobal(dir); };

window.openProductModal = id => {
    window.currentProductId = id;
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

    // Agregar flechas SIEMPRE para navegar
    let leftBtn = document.createElement('button');
    leftBtn.className = 'modal-nav-btn left-btn';
    leftBtn.innerHTML = '&#10094;';
    leftBtn.onclick = () => window.navigateGlobal(-1);

    let rightBtn = document.createElement('button');
    rightBtn.className = 'modal-nav-btn right-btn';
    rightBtn.innerHTML = '&#10095;';
    rightBtn.onclick = () => window.navigateGlobal(1);

    container.appendChild(leftBtn);
    container.appendChild(rightBtn);
    
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

    let isPromo = prod.enPromocion || prod.fakePromo;
    let pType = prod.tipoPromocion || 'percentage';
    let desc = prod.descuento || (prod.fakePromo ? 15 : 0);
    let pVenta = prod.precioVenta || 0;
    let precioFinal = pVenta;
    
    let priceHtml = '';
    window.waMsgType = '';

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
            const eqEl = $('modal-size-equivalence');
            if (eqEl) {
                const eq = getSizeEquivalence(btn.dataset.size, prod.genero);
                eqEl.textContent = eq ? 'Equivalencia aprox: ' + eq : '';
            }
        });
    });
    // Trigger primer click
    const firstBtn = sizesContainer.querySelector('.size-btn.selected');
    if (firstBtn) firstBtn.click();
    else if ($('modal-size-equivalence')) $('modal-size-equivalence').textContent = '';

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

function getSizeEquivalence(talla, genero) {
    talla = parseInt(talla);
    if (!talla) return '';
    if (genero === 'Mujer') {
        switch(talla) {
            case 35: return "US 5/5.5 | EUR 36 | 22.5 cm";
            case 36: return "US 6/6.5 | EUR 37 | 23.5 cm";
            case 37: return "US 7/7.5 | EUR 38 | 24 cm";
            case 38: return "US 8 | EUR 39 | 25 cm";
            case 39: return "US 8.5/9 | EUR 40 | 26 cm";
            default: return "";
        }
    } else {
        switch(talla) {
            case 37: return "US 7 | EUR 40 | 25 cm";
            case 38: return "US 8 | EUR 41 | 26 cm";
            case 39: return "US 8.5/9 | EUR 42 | 26.5 cm";
            case 40: return "US 9.5 | EUR 43 | 27 cm";
            case 41: return "US 10/10.5 | EUR 44 | 28 cm";
            case 42: return "US 10/10.5 | EUR 44 | 28 cm";
            case 43: return "US 11 | EUR 45 | 29 cm";
            case 44: return "US 12 | EUR 46 | 30 cm";
            default: return "";
        }
    }
}
