const fs = require('fs');
let storeJs = fs.readFileSync('store.js', 'utf8');

// Ensure currentRenderedProducts only contains unique IDs across the file
storeJs = storeJs.replace(
    'window.currentRenderedProducts = promos.map(p => p.id);', 
    'window.currentRenderedProducts = [...new Set(promos.map(p => p.id))];'
);
storeJs = storeJs.replace(
    'window.currentRenderedProducts = [...promos.map(p => p.id), ...regular.map(p => p.id)];', 
    'window.currentRenderedProducts = [...new Set([...promos.map(p => p.id), ...regular.map(p => p.id)])];'
);

fs.writeFileSync('store.js', storeJs);
console.log('Fixed currentRenderedProducts uniqueness');
