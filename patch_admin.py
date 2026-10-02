import os

with open('admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

marker = '<label>Modelo / Nombre *</label>'
new_field = """                            </div>
                            <div class="form-group flex-1">
                                <label>Cod / Referencia</label>
                                <input type="text" id="prod-ref" placeholder="Ej: REF-001">"""
html = html.replace('                            </div>\n                            <div class="form-group flex-2">\n                                <label>Modelo / Nombre *</label>', new_field + '\n                            </div>\n                            <div class="form-group flex-2">\n                                <label>Modelo / Nombre *</label>')

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("admin.html modified with Python")
