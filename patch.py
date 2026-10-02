import os

with open('store.js', 'r', encoding='utf-8') as f:
    store = f.read()

# 1. Update Card Price HTML
old_price = """<div class="price-container">
                ${desc > 0 ? `<span class="price-old">${formatCOP(pVenta)}</span>` : ''}
                <span class="price-new">${formatCOP(precioFinal)}</span>
            </div>"""

new_price = """<div class="price-container">
                ${desc > 0 ? `<div class="price-old-wrap"><span class="price-label">Antes:</span><span class="price-old strike-anim">${formatCOP(pVenta)}</span></div>` : ''}
                <div class="price-new-wrap">
                    ${desc > 0 ? `<span class="price-label highlight">Ahora:</span>` : ''}
                    <span class="price-new">${formatCOP(precioFinal)}</span>
                </div>
            </div>"""

store = store.replace(old_price, new_price)

# 2. Update Modal Price
old_modal_price = "$('modal-price').innerHTML = desc > 0 ? `<span class=\"old-price\">${formatCOP(pVenta)}</span> ${formatCOP(precioFinal)}` : formatCOP(pVenta);"

new_modal_price = """$('modal-price').innerHTML = desc > 0 
        ? `<div class="price-old-wrap"><span class="price-label">Antes:</span><span class="price-old strike-anim">${formatCOP(pVenta)}</span></div>
           <div class="price-new-wrap"><span class="price-label highlight">Ahora:</span><span class="price-new">${formatCOP(precioFinal)}</span></div>` 
        : `<div class="price-new-wrap"><span class="price-new">${formatCOP(pVenta)}</span></div>`;"""

store = store.replace(old_modal_price, new_modal_price)

# 3. Track Rendered Products Index
store = store.replace("grid.innerHTML = promos.map(prod => createCardHtml(prod)).join('');",
    "window.currentRenderedProducts = promos.map(p => p.id);\n        grid.innerHTML = promos.map(prod => createCardHtml(prod)).join('');")

# 4. Track Rendered Products Subpages
old_subpage = """grid.style.display = 'block'; // Quitar el grid base porque el html interior ya tiene su propio layout
        grid.innerHTML = html;"""
new_subpage = """window.currentRenderedProducts = [...promos.map(p => p.id), ...regular.map(p => p.id)];
        grid.style.display = 'block';
        grid.innerHTML = html;"""
store = store.replace(old_subpage, new_subpage)

# 5. Track current product ID in modal
store = store.replace("const prod = products.find(p => p.id === id);",
    "window.currentProductId = id;\n    const prod = products.find(p => p.id === id);")

# 6. Lightbox logic replace
lb_idx = store.find('// ==========================================\n// LIGHTBOX FULLSCREEN LOGIC')
if lb_idx != -1:
    store = store[:lb_idx]

lb_logic = """// ==========================================
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
    
    // Siempre mostramos flechas para navegar entre productos
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
        // Cambiar al producto anterior/siguiente
        if (window.currentRenderedProducts && window.currentRenderedProducts.length > 0) {
            let currIdx = window.currentRenderedProducts.indexOf(window.currentProductId);
            if (currIdx === -1) currIdx = 0;
            
            let nextIdx = currIdx + (currentPhotoIndex < 0 ? -1 : 1);
            if (nextIdx < 0) nextIdx = window.currentRenderedProducts.length - 1;
            if (nextIdx >= window.currentRenderedProducts.length) nextIdx = 0;
            
            let nextProdId = window.currentRenderedProducts[nextIdx];
            
            // Cargar el nuevo producto completo en el modal que está por debajo
            openProductModal(nextProdId);
            
            // Si íbamos hacia atrás, mostrar la última foto de ese nuevo producto
            if (dir < 0) {
                currentPhotoIndex = currentModalPhotos.length - 1;
                changeModalImg(currentPhotoIndex);
            }
        } else {
            // Fallback: Si no hay lista de productos, solo ciclar las fotos del mismo
            if (currentPhotoIndex < 0) currentPhotoIndex = currentModalPhotos.length - 1;
            if (currentPhotoIndex >= currentModalPhotos.length) currentPhotoIndex = 0;
        }
    }
    
    resetLightboxZoom();
    updateLightbox();
    
    // Sincronizar imagen en el modal que está debajo
    const img = document.getElementById('modal-img');
    if (img) img.src = currentModalPhotos[currentPhotoIndex];
    
    // Seleccionar miniatura
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
    
    // Doble tap (Celulares)
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

    // Doble Click (PC)
    lightboxImg.addEventListener('dblclick', () => {
        if (lbScale > 1) resetLightboxZoom();
        else {
            lbScale = 2.5;
            lightboxImg.style.transition = 'transform 0.3s ease';
            lightboxImg.style.transform = `translate(0px, 0px) scale(${lbScale})`;
        }
    });

    // Rueda del ratón (PC)
    lightboxImg.addEventListener('wheel', (e) => {
        e.preventDefault();
        lightboxImg.style.transition = 'none';
        lbScale += e.deltaY * -0.005;
        lbScale = Math.min(Math.max(1, lbScale), 4);
        if (lbScale === 1) { lbPanX = 0; lbPanY = 0; }
        lightboxImg.style.transform = `translate(${lbPanX}px, ${lbPanY}px) scale(${lbScale})`;
    });

    // Drag / Swipe
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
            // Si el movimiento es horizontal y mayor a 50px
            if (abs(diffX) > 50 && abs(diffX) > abs(diffY)) {
                if (diffX < 0) lightboxNavigate(1); // Swipe Izquierda = Siguiente
                else lightboxNavigate(-1); // Swipe Derecha = Anterior
            }
        }
    };

    function abs(val) { return val < 0 ? -val : val; }

    lightboxImg.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY;
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: true});
    
    lightboxImg.addEventListener('touchmove', e => {
        if (lbScale > 1) e.preventDefault(); // Previene el scroll del navegador al hacer panning
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
"""

store += lb_logic
with open('store.js', 'w', encoding='utf-8') as f:
    f.write(store)
    
print("store.js modified successfully with Python")
