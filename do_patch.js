const fs = require('fs');
let js = fs.readFileSync('store.js', 'utf8');

// Buscamos la función nextModalImg con regex
const regexNext = /window\.nextModalImg = function\(dir\) \{[\s\S]*?changeModalImg\(newIdx\);\s*\};/;
const newGlobal = `window.navigateGlobal = function(dir) {
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

window.nextModalImg = function(dir) { window.navigateGlobal(dir); };`;

if(regexNext.test(js)) {
    js = js.replace(regexNext, newGlobal);
    console.log('Replaced nextModalImg');
} else {
    console.log('regexNext not found!');
}

// 2. Fix the arrows in openProductModal
const regexArrows = /\/\/ Agregar flechas si hay >1 foto\s*if \(currentModalPhotos\.length > 1\) \{[\s\S]*?container\.appendChild\(rightBtn\);\s*\}/;
const newArrows = `// Agregar flechas SIEMPRE para navegar
    let leftBtn = document.createElement('button');
    leftBtn.className = 'modal-nav-btn left-btn';
    leftBtn.innerHTML = '&#10094;';
    leftBtn.onclick = () => window.navigateGlobal(-1);

    let rightBtn = document.createElement('button');
    rightBtn.className = 'modal-nav-btn right-btn';
    rightBtn.innerHTML = '&#10095;';
    rightBtn.onclick = () => window.navigateGlobal(1);

    container.appendChild(leftBtn);
    container.appendChild(rightBtn);`;

if(regexArrows.test(js)) {
    js = js.replace(regexArrows, newArrows);
    console.log('Replaced arrows');
} else {
    console.log('regexArrows not found!');
}

// 3. Re-route lightboxNavigate to use navigateGlobal
const regexLBNav = /function lightboxNavigate\(dir\) \{[\s\S]*?el\.style\.border = i === currentPhotoIndex \? '2px solid var\(--neon-green\)' : '2px solid transparent';\s*\}\);\s*\}/;
const newLBNav = `function lightboxNavigate(dir) {
    window.navigateGlobal(dir);
}`;

if(regexLBNav.test(js)) {
    js = js.replace(regexLBNav, newLBNav);
    console.log('Replaced lightboxNavigate');
} else {
    console.log('regexLBNav not found!');
}

fs.writeFileSync('store.js', js);
console.log('Done script');
