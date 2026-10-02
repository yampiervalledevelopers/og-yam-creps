const fs = require('fs');
let adminJs = fs.readFileSync('admin.js', 'utf8');

adminJs = adminJs.replace(
    /proveedorId: \$\('prod-proveedor'\)\.value,\s*nombre: \$\('prod-nombre'\)\.value\.trim\(\),/g,
    `proveedorId: $('prod-proveedor').value,\n            codigo: $('prod-ref') ? $('prod-ref').value.trim() : '',\n            nombre: $('prod-nombre').value.trim(),`
);

adminJs = adminJs.replace(
    /\$\('prod-proveedor'\)\.value = prod\.proveedorId \|\| '';\s*\$\('prod-nombre'\)\.value = prod\.nombre \|\| '';/g,
    `$('prod-proveedor').value = prod.proveedorId || '';\n    if($('prod-ref')) $('prod-ref').value = prod.codigo || '';\n    $('prod-nombre').value = prod.nombre || '';`
);

fs.writeFileSync('admin.js', adminJs);
console.log("save and edit logic updated with regex");
