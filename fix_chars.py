import os

files_to_fix = [
    'index.html',
    'hombres.html',
    'mujeres.html',
    'ninos.html',
    'ninas.html',
    'admin.html'
]

for file in files_to_fix:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        # Replace common corruptions.
        # "Nios" is usually 'Ni\ufffdos'
        content = content.replace('Ni\ufffdos', 'Niños')
        content = content.replace('Ni\ufffdas', 'Niñas')
        content = content.replace('Medell\ufffdn', 'Medellín')
        content = content.replace('O\'G YAM CREPS \ufffd?"', 'O\'G YAM CREPS -')
        content = content.replace('Selecci\ufffdn', 'Selección')
        content = content.replace('G\ufffdero', 'Género')
        content = content.replace('Env\ufffdo', 'Envío')
        content = content.replace('a\ufffdn', 'aún')
        content = content.replace('\ufffdAgrega', '¡Agrega')
        content = content.replace('Elim\ufffdnalos', 'Elimínalos')
        content = content.replace('\ufffdEliminar', '¿Eliminar')
        content = content.replace('\ufffd', '') # Remove any remaining  just in case it breaks tags

        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed {file}')
