function createCardHtml(prod) {
    const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);
    const sizesHtml = sizes.map(t => `<span class="size-badge">${t}</span>`).join('');
    
    let desc = prod.descuento || 0;
    let pVenta = prod.precioVenta || 0;
    let precioFinal = pVenta - (pVenta * desc / 100);
    let hotClass = desc >= 15 ? 'hot' : '';
    
    let fotosArray = prod.fotos || (prod.foto ? [prod.foto] : []);
    let mainPhoto = fotosArray.length > 0 ? fotosArray[0] : '';
    
    return `
    <div class="product-card" onclick="openProductModal('${prod.id}')">
        <div class="card-img-wrapper" style="position:relative;">
            ${desc > 0 ? `<div class="promo-badge ${hotClass}">-${desc}% OFF ${desc>=15?'🔥':''}</div>` : ''}
            ${fotosArray.length > 1 ? `
                <button class="card-nav-btn left-btn" onclick="event.stopPropagation(); window.nextCardImg('${prod.id}', -1)">&#10094;</button>
                <button class="card-nav-btn right-btn" onclick="event.stopPropagation(); window.nextCardImg('${prod.id}', 1)">&#10095;</button>
            ` : ''}
            ${mainPhoto 
                ? `<img id="card-img-${prod.id}" src="${mainPhoto}" alt="${prod.nombre}" loading="lazy">` 
                : `<div style="height:250px; background:linear-gradient(45deg, #111, #222); display:flex; align-items:center; justify-content:center; color:#555;">Sin foto</div>`}
        </div>
        <div class="card-info">
            <span class="brand-tag">${prod.marca || 'Otro'}</span>
            <h3>${prod.nombre}</h3>
            <div class="price-container">
                ${desc > 0 ? `<span class="price-old">${formatCOP(pVenta)}</span>` : ''}
                <span class="price-new">${formatCOP(precioFinal)}</span>
            </div>
            <div class="card-sizes">${sizesHtml}</div>
        </div>
    </div>`;
}

function shuffle(arr) {
    let array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

window.renderStore = function() {
    const grid = $('product-grid');
    if (!grid) return;

    let available = products.filter(p => getTotalStock(p) > 0);

    if (available.length === 0) {
        let msg = window.FILTER_GENDER ? `Pronto subiremos más tenis para ${window.FILTER_GENDER}.` : "Pronto subiremos más tenis.";
        grid.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:3rem; grid-column:1/-1; font-size:1.1rem;">${msg} ¡Escríbenos por WhatsApp y te conseguimos los que buscas! 👟</p>`;
        return;
    }

    if (!window.FILTER_GENDER) {
        // --- INDEX.HTML LOGIC ---
        let availableMen = available.filter(p => p.genero === 'Hombre' || p.genero === 'Unisex');
        let availableWomen = available.filter(p => p.genero === 'Mujer' || p.genero === 'Unisex');
        
        let promosMen = availableMen.filter(p => p.enPromocion);
        if (promosMen.length < 8) promosMen = shuffle(availableMen).slice(0, 8);
        
        let promosWomen = availableWomen.filter(p => p.enPromocion);
        if (promosWomen.length < 8) promosWomen = shuffle(availableWomen).slice(0, 8);
        
        let promos = shuffle([...promosMen, ...promosWomen]);
        promos = promos.map(p => ({...p, fakePromo: true, descuento: p.descuento || 15}));
        
        if (!document.getElementById('promo-banner')) {
            const banner = document.createElement('div');
            banner.id = 'promo-banner';
            banner.innerHTML = `<h1 style="text-align:center; font-family:'Bebas Neue', sans-serif; font-size:3rem; color:var(--neon-green); letter-spacing:2px; margin:2rem 0 0.5rem 0; text-shadow:0 0 10px rgba(0,255,136,0.3);">🔥 PROMOCIONES DEL DÍA 🔥</h1>
            <p style="text-align:center; color:var(--text-muted); margin-bottom:2rem;">Lleva tu estilo al siguiente nivel con ofertas divididas equitativamente.</p>`;
            grid.parentNode.insertBefore(banner, grid);
        }
        
        grid.innerHTML = promos.map(prod => createCardHtml(prod)).join('');
        
    } else {
        // --- HOMBRES / MUJERES SUBPAGES LOGIC ---
        available = available.filter(p => {
            if (window.FILTER_GENDER === 'Hombre') return p.genero === 'Hombre' || p.genero === 'Unisex';
            if (window.FILTER_GENDER === 'Mujer') return p.genero === 'Mujer' || p.genero === 'Unisex';
            return p.genero === window.FILTER_GENDER;
        });

        let promos = available.filter(p => p.enPromocion);
        if (promos.length < 8) promos = shuffle(available).slice(0, 8);
        promos = promos.map(p => ({...p, fakePromo: true, descuento: p.descuento || 15}));
        
        let promoIds = promos.map(p => p.id);
        let regular = available.filter(p => !promoIds.includes(p.id));
        if (regular.length === 0) regular = available;

        let html = `
        <div style="margin: 2rem 0;">
            <h2 style="font-family:'Bebas Neue', sans-serif; font-size:2.5rem; color:var(--neon-green); text-align:center; letter-spacing:2px; text-shadow:0 0 10px rgba(0,255,136,0.3);">🔥 PROMOCIONES EXCLUSIVAS 🔥</h2>
            <div class="horizontal-carousel">
                ${promos.map(prod => createCardHtml(prod)).join('')}
            </div>
        </div>
        <h2 style="font-family:'Bebas Neue', sans-serif; font-size:2.5rem; text-align:center; letter-spacing:2px; margin-top:4rem; margin-bottom:1rem;">NUEVA COLECCIÓN</h2>
        <div class="product-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; width: 100%;">
            ${regular.map(prod => createCardHtml(prod)).join('')}
        </div>
        `;
        
        grid.style.display = 'block'; // Quitar el grid base porque el html interior ya tiene su propio layout
        grid.innerHTML = html;
    }
}
