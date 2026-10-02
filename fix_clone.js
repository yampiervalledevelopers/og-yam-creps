const fs = require('fs');
let storeJs = fs.readFileSync('store.js', 'utf8');

const buggyClone = `// Clonamos para limpiar eventos previos por si acaso
    let newImg = lightboxImg.cloneNode(true);
    lightboxImg.parentNode.replaceChild(newImg, lightboxImg);
    const img = document.getElementById('lightbox-img'); // re-fetch`;

const fix = `const img = lightboxImg;`;

if (storeJs.includes(buggyClone)) {
    storeJs = storeJs.replace(buggyClone, fix);
    fs.writeFileSync('store.js', storeJs);
    console.log('Fixed cloneNode bug!');
} else {
    console.log('buggy clone not found');
}
