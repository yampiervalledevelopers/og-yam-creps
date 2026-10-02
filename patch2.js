const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

// Buscamos el label "Modelo / Nombre *"
html = html.replace(
    /<div class="form-group flex-2">\s*<label>Modelo \/ Nombre \*<\/label>/g,
    `<div class="form-group flex-1">
                                <label>Cód/Ref</label>
                                <input type="text" id="prod-ref" placeholder="Ej: REF-001">
                            </div>
                            <div class="form-group flex-2">
                                <label>Modelo / Nombre *</label>`
);

fs.writeFileSync('admin.html', html);
console.log('patched');
