const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

const oldRow = `<div class="form-row">
                            <div class="form-group flex-1">
                                <label>Proveedor Local *</label>
                                <select id="prod-proveedor" required><option value="">Selecciona...</option></select>
                            </div>
                            <div class="form-group flex-2">
                                <label>Modelo / Nombre *</label>
                                <input type="text" id="prod-nombre" required placeholder="Ej: Nike Dunk Low Panda">
                            </div>
                        </div>`;

const newRow = `<div class="form-row">
                            <div class="form-group flex-1">
                                <label>Proveedor Local *</label>
                                <select id="prod-proveedor" required><option value="">Selecciona...</option></select>
                            </div>
                            <div class="form-group flex-1">
                                <label>Cod / Referencia</label>
                                <input type="text" id="prod-ref" placeholder="Ej: REF-001">
                            </div>
                            <div class="form-group flex-2">
                                <label>Modelo / Nombre *</label>
                                <input type="text" id="prod-nombre" required placeholder="Ej: Nike Dunk Low Panda">
                            </div>
                        </div>`;

if(html.includes(oldRow)) {
    html = html.replace(oldRow, newRow);
    fs.writeFileSync('admin.html', html);
    console.log('admin.html form modified');
} else {
    console.log('admin.html form not matched exactly.');
}
