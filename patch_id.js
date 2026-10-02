const fs = require('fs');
let storeJs = fs.readFileSync('store.js', 'utf8');

// Fix the incorrect placement
storeJs = storeJs.replace(`window.nextCardImg = function(id, dir) {
    window.currentProductId = id;
    const prod = products.find(p => p.id === id);`, 
`window.nextCardImg = function(id, dir) {
    const prod = products.find(p => p.id === id);`);

// Add to openProductModal
storeJs = storeJs.replace(`window.openProductModal = id => {
    const prod = products.find(p => p.id === id);`, 
`window.openProductModal = id => {
    window.currentProductId = id;
    const prod = products.find(p => p.id === id);`);

fs.writeFileSync('store.js', storeJs);
console.log('Fixed currentProductId assignment location');
