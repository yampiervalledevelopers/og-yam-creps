const fs = require('fs');
let adminJs = fs.readFileSync('admin.js', 'utf8');

// 1. Save logic
const saveLogicOld = `proveedorId: $('prod-proveedor').value,
            nombre: $('prod-nombre').value.trim(),`;
const saveLogicNew = `proveedorId: $('prod-proveedor').value,
            codigo: $('prod-ref') ? $('prod-ref').value.trim() : '',
            nombre: $('prod-nombre').value.trim(),`;
if(adminJs.includes(saveLogicOld)) {
    adminJs = adminJs.replace(saveLogicOld, saveLogicNew);
    console.log("save logic updated");
}

// 2. Edit logic
const editLogicOld = `$('prod-proveedor').value = prod.proveedorId || '';
    $('prod-nombre').value = prod.nombre || '';`;
const editLogicNew = `$('prod-proveedor').value = prod.proveedorId || '';
    if($('prod-ref')) $('prod-ref').value = prod.codigo || '';
    $('prod-nombre').value = prod.nombre || '';`;
if(adminJs.includes(editLogicOld)) {
    adminJs = adminJs.replace(editLogicOld, editLogicNew);
    console.log("edit logic updated");
}

// 3. Render logic
const renderLogicOld = `<strong>\${prod.nombre} \${isSoldOut ? '<span style="color:#ff3333;font-size:0.8em;">[AGOTADO]</span>' : ''}</strong>
                    <span>\${prod.marca} · \${provName} · PVP: \${formatCOP(prod.precioVenta)}</span>`;
const renderLogicNew = `<strong>\${prod.codigo ? \`[\${prod.codigo}] \` : ''}\${prod.nombre} \${isSoldOut ? '<span style="color:#ff3333;font-size:0.8em;">[AGOTADO]</span>' : ''}</strong>
                    <span>\${prod.marca} · \${provName} · PVP: \${formatCOP(prod.precioVenta)}</span>`;
// Handling special chars like · (middle dot)
const rOld1 = "<strong>${prod.nombre} ${isSoldOut ? '<span style=\"color:#ff3333;font-size:0.8em;\">[AGOTADO]</span>' : ''}</strong>";
const rNew1 = "<strong>${prod.codigo ? `<span style=\"color:var(--neon-green)\">[${prod.codigo}]</span> ` : ''}${prod.nombre} ${isSoldOut ? '<span style=\"color:#ff3333;font-size:0.8em;\">[AGOTADO]</span>' : ''}</strong>";

if(adminJs.includes(rOld1)) {
    adminJs = adminJs.replace(rOld1, rNew1);
    console.log("render logic updated");
} else {
    // try splitting
    adminJs = adminJs.split("<strong>${prod.nombre} ${isSoldOut ? '<span style=\"color:#ff3333;font-size:0.8em;\">[AGOTADO]</span>' : ''}</strong>").join("<strong>${prod.codigo ? `<span style=\"color:var(--neon-green)\">[${prod.codigo}]</span> ` : ''}${prod.nombre} ${isSoldOut ? '<span style=\"color:#ff3333;font-size:0.8em;\">[AGOTADO]</span>' : ''}</strong>");
    console.log("render logic split replaced");
}

fs.writeFileSync('admin.js', adminJs);
console.log("Done");
