const fs = require('fs');
let storeJs = fs.readFileSync('store.js', 'utf8');

// 1. Fix the duplicate regular array bug
const buggyLine = "if (regular.length === 0) regular = available;";
storeJs = storeJs.split(buggyLine).join("// removed fallback to prevent duplication");

// 2. Replace the Gestures block completely
const idx = storeJs.indexOf('// GESTOS DE ZOOM Y SWIPE (Mouse y Touch)');
if (idx !== -1) {
    storeJs = storeJs.substring(0, idx);
}

const newGestures = `// GESTOS DE ZOOM Y SWIPE (Mouse y Touch) COMPLETAMENTE REESCRITOS PARA 0 BUGS
if (lightboxImg) {
    let lastTap = 0;
    
    // Clonamos para limpiar eventos previos por si acaso
    let newImg = lightboxImg.cloneNode(true);
    lightboxImg.parentNode.replaceChild(newImg, lightboxImg);
    const img = document.getElementById('lightbox-img'); // re-fetch

    // Doble Click PC
    img.addEventListener('dblclick', () => {
        if (lbScale > 1) resetLightboxZoom();
        else {
            lbScale = 2.5;
            img.style.transition = 'transform 0.3s ease';
            img.style.transform = \`translate(0px, 0px) scale(\${lbScale})\`;
        }
    });

    // Rueda del ratón PC
    img.addEventListener('wheel', (e) => {
        e.preventDefault();
        img.style.transition = 'none';
        lbScale += e.deltaY * -0.005;
        lbScale = Math.min(Math.max(1, lbScale), 4);
        if (lbScale === 1) { lbPanX = 0; lbPanY = 0; }
        img.style.transform = \`translate(\${lbPanX}px, \${lbPanY}px) scale(\${lbScale})\`;
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
            
            img.style.transform = \`translate(\${lbPanX}px, \${lbPanY}px) scale(\${lbScale})\`;
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
                        img.style.transform = \`translate(0px, 0px) scale(\${lbScale})\`;
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
`;

storeJs += newGestures;
fs.writeFileSync('store.js', storeJs);
console.log('store.js fixed completely');

// Add touch-action none to lightbox in CSS just to be safe
let stylesCss = fs.readFileSync('styles.css', 'utf8');
if (!stylesCss.includes('touch-action: none;')) {
    stylesCss = stylesCss.replace('#lightbox {', '#lightbox {\n    touch-action: none; /* EVITA SWIPE NATIVO */');
    fs.writeFileSync('styles.css', stylesCss);
    console.log('styles.css touch-action added');
}

