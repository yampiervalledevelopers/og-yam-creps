const fs = require('fs');
let storeJs = fs.readFileSync('store.js', 'utf8');

// 1. Evitar "Ghost Drag" de imagenes en PC
const searchMousedown = "img.addEventListener('mousedown', e => {";
if (storeJs.includes(searchMousedown) && !storeJs.includes('dragstart')) {
    storeJs = storeJs.replace(searchMousedown, "img.addEventListener('dragstart', e => e.preventDefault());\n    " + searchMousedown);
}

// 2. Navegacion por Teclado (Flechas y Escape)
if (!storeJs.includes("e.key === 'ArrowRight'")) {
    const keyboardLogic = `
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
`;
    storeJs += keyboardLogic;
}

fs.writeFileSync('store.js', storeJs);
console.log('store.js patched for PC');
