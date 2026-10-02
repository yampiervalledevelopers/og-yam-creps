const fs = require('fs');
let storeJs = fs.readFileSync('store.js', 'utf8');

// 1. Update Card HTML Price
const oldCardPrice = `<div class="price-container">
                ${desc > 0 ? \`<span class="price-old">\${formatCOP(pVenta)}</span>\` : ''}
                <span class="price-new">\${formatCOP(precioFinal)}</span>
            </div>`;
const newCardPrice = `<div class="price-container">
                ${desc > 0 ? \`<div class="price-old-wrap"><span class="price-label">Antes:</span><span class="price-old strike-anim">\${formatCOP(pVenta)}</span></div>\` : ''}
                <div class="price-new-wrap">
                    ${desc > 0 ? \`<span class="price-label highlight">Ahora:</span>\` : ''}
                    <span class="price-new">\${formatCOP(precioFinal)}</span>
                </div>
            </div>`;
storeJs = storeJs.replace(oldCardPrice.replace(/\$/g, '$$$$'), newCardPrice); 
// Note: manual string replacement in JS without regex is simpler
storeJs = storeJs.split(oldCardPrice).join(newCardPrice);

// 2. Update Modal Price
const oldModalPrice = `$('modal-price').innerHTML = desc > 0 ? \`<span class="old-price">\${formatCOP(pVenta)}</span> \${formatCOP(precioFinal)}\` : formatCOP(pVenta);`;
const newModalPrice = `$('modal-price').innerHTML = desc > 0 
        ? \`<div class="price-old-wrap"><span class="price-label">Antes:</span><span class="price-old strike-anim">\${formatCOP(pVenta)}</span></div>
           <div class="price-new-wrap"><span class="price-label highlight">Ahora:</span><span class="price-new">\${formatCOP(precioFinal)}</span></div>\` 
        : \`<div class="price-new-wrap"><span class="price-new">\${formatCOP(pVenta)}</span></div>\`;`;
storeJs = storeJs.split(oldModalPrice).join(newModalPrice);

// 3. Track rendered products (Index)
storeJs = storeJs.split(`grid.innerHTML = promos.map(prod => createCardHtml(prod)).join('');`).join(`window.currentRenderedProducts = promos.map(p => p.id);
        grid.innerHTML = promos.map(prod => createCardHtml(prod)).join('');`);

// 4. Track rendered products (Subpages)
storeJs = storeJs.split(`grid.style.display = 'block'; // Quitar el grid base porque el html interior ya tiene su propio layout
        grid.innerHTML = html;`).join(`window.currentRenderedProducts = [...promos.map(p => p.id), ...regular.map(p => p.id)];
        grid.style.display = 'block';
        grid.innerHTML = html;`);

// 5. Track current product ID in modal
storeJs = storeJs.split(`const prod = products.find(p => p.id === id);`).join(`window.currentProductId = id;
    const prod = products.find(p => p.id === id);`);

// 6. Rewrite Lightbox logic
const lbStartIdx = storeJs.indexOf('// ==========================================\n// LIGHTBOX FULLSCREEN LOGIC');
if (lbStartIdx !== -1) {
    storeJs = storeJs.substring(0, lbStartIdx);
}

const newLightboxLogic = `// ==========================================
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
        lightboxImg.style.transform = \`translate(0px, 0px) scale(1)\`;
        lightboxImg.style.transition = 'transform 0.3s ease';
    }
}

function updateLightbox() {
    if (!currentModalPhotos || currentModalPhotos.length === 0) return;
    lightboxImg.src = currentModalPhotos[currentPhotoIndex];
    if (lightboxCounter) lightboxCounter.textContent = (currentPhotoIndex + 1) + ' / ' + currentModalPhotos.length;
    
    // Siempre mostramos flechas para navegar entre productos enteros
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
    if (!currentModalPhotos) return;
    currentPhotoIndex += dir;
    
    if (currentPhotoIndex < 0 || currentPhotoIndex >= currentModalPhotos.length) {
        // Cambiar al producto anterior/siguiente en la cuadrícula
        if (window.currentRenderedProducts && window.currentRenderedProducts.length > 0) {
            let currIdx = window.currentRenderedProducts.indexOf(window.currentProductId);
            if (currIdx === -1) currIdx = 0;
            
            let nextIdx = currIdx + (currentPhotoIndex < 0 ? -1 : 1);
            if (nextIdx < 0) nextIdx = window.currentRenderedProducts.length - 1;
            if (nextIdx >= window.currentRenderedProducts.length) nextIdx = 0;
            
            let nextProdId = window.currentRenderedProducts[nextIdx];
            
            // Cargar el producto completo al fondo
            openProductModal(nextProdId);
            
            // Si íbamos hacia atrás, mostrar su última foto en vez de la primera
            if (dir < 0) {
                currentPhotoIndex = currentModalPhotos.length - 1;
                changeModalImg(currentPhotoIndex);
            }
        } else {
            // Fallback (solo cicla las fotos del zapato actual si no hay lista)
            if (currentPhotoIndex < 0) currentPhotoIndex = currentModalPhotos.length - 1;
            if (currentPhotoIndex >= currentModalPhotos.length) currentPhotoIndex = 0;
        }
    }
    
    resetLightboxZoom();
    updateLightbox();
    
    // Sincronizar modal trasero
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

const modalMainImg = document.getElementById('modal-img');
if (modalMainImg) {
    modalMainImg.style.cursor = 'zoom-in';
    modalMainImg.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox();
    });
}

// GESTOS DE ZOOM Y SWIPE (Mouse y Touch)
if (lightboxImg) {
    let lastTap = 0;
    
    // Doble tap para hacer zoom en celular
    lightboxImg.addEventListener('touchend', (e) => {
        let currentTime = new Date().getTime();
        let tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            e.preventDefault();
            if (lbScale > 1) resetLightboxZoom();
            else {
                lbScale = 2.5;
                lightboxImg.style.transition = 'transform 0.3s ease';
                lightboxImg.style.transform = \`translate(0px, 0px) scale(\${lbScale})\`;
            }
        }
        lastTap = currentTime;
    });

    // Doble click PC
    lightboxImg.addEventListener('dblclick', () => {
        if (lbScale > 1) resetLightboxZoom();
        else {
            lbScale = 2.5;
            lightboxImg.style.transition = 'transform 0.3s ease';
            lightboxImg.style.transform = \`translate(0px, 0px) scale(\${lbScale})\`;
        }
    });

    // Wheel zoom PC
    lightboxImg.addEventListener('wheel', (e) => {
        e.preventDefault();
        lightboxImg.style.transition = 'none';
        lbScale += e.deltaY * -0.005;
        lbScale = Math.min(Math.max(1, lbScale), 4);
        if (lbScale === 1) { lbPanX = 0; lbPanY = 0; }
        lightboxImg.style.transform = \`translate(\${lbPanX}px, \${lbPanY}px) scale(\${lbScale})\`;
    });

    // Drag/Swipe Logic
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
            lightboxImg.style.transform = \`translate(\${lbPanX}px, \${lbPanY}px) scale(\${lbScale})\`;
        }
    };
    const endDrag = (x, y, isTouch) => {
        isDragging = false;
        if (lbScale === 1 && isTouch) {
            let diffX = x - touchstartX;
            let diffY = y - touchstartY;
            if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX < 0) lightboxNavigate(1); // swipe left = next
                else lightboxNavigate(-1); // swipe right = prev
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
`;

storeJs += newLightboxLogic;
fs.writeFileSync('store.js', storeJs);
console.log('store.js patched');

// CSS Patch
let stylesCss = fs.readFileSync('styles.css', 'utf8');
if (!stylesCss.includes('.price-label')) {
    stylesCss += `
/* PRICE ANIMATIONS & LABELS */
.price-container { display: flex; flex-direction: column; gap: 0.1rem; }
.price-old-wrap, .price-new-wrap { display: flex; align-items: center; gap: 0.4rem; }
.price-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
.price-label.highlight { color: var(--neon-green); }

.strike-anim {
    position: relative;
    display: inline-block;
    color: #888;
    text-decoration: none;
}
.strike-anim::after {
    content: '';
    position: absolute;
    top: 50%;
    left: -5%;
    width: 110%;
    height: 2px;
    background: #ff3333;
    transform: scaleX(0);
    transform-origin: left;
    animation: strike 0.4s ease-out forwards 0.3s;
}
@keyframes strike {
    to { transform: scaleX(1); }
}

#modal-price .price-container { margin-bottom: 1rem; }
#modal-price .price-old-wrap { margin-bottom: 0.3rem; }
#modal-price .price-new { font-size: 1.8rem; color: var(--neon-green); }
`;
    fs.writeFileSync('styles.css', stylesCss);
    console.log('styles.css patched');
}
