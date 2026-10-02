const fs = require('fs');
const files = ['index.html', 'hombres.html', 'mujeres.html', 'ninos.html', 'ninas.html', 'admin.html', 'store.js', 'admin.js'];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        
        // El caracter literal  es \uFFFD
        content = content.split('Ni\uFFFDos').join('Niños');
        content = content.split('Ni\uFFFDas').join('Niñas');
        content = content.split('Medell\uFFFDn').join('Medellín');
        content = content.replace(/O'G YAM CREPS \uFFFD\?"/g, "O'G YAM CREPS -");
        content = content.split('G\uFFFDnero').join('Género');
        content = content.split('Env\uFFFDo').join('Envío');
        content = content.split('a\uFFFDa').join('aña');
        content = content.split('\uFFFDEliminar').join('¿Eliminar');
        content = content.split('Elim\uFFFDnalos').join('Elimínalos');
        content = content.split('a\uFFFDn').join('aún');
        content = content.split('\uFFFDAgrega').join('¡Agrega');
        content = content.split('A\uFFFDadir').join('Añadir');
        content = content.split('C\uFFFDd/Ref').join('Cód/Ref');
        content = content.split('Cr\uFFFDdito').join('Crédito');
        content = content.split('D\uFFFDA').join('DÍA');
        content = content.split('ENV\uFFFDO').join('ENVÍO');
        
        // Remove any loose U+FFFD that shouldn't be there, 
        // but be careful not to break emojis if they were corrupted.
        // Emojis shouldn't be U+FFFD unless they were half-written.
        content = content.replace(/\uFFFD/g, ''); 

        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed ' + file);
    }
});
