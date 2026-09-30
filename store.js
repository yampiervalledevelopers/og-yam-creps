/**
 * O'G YAM CREPS — Tienda Pública (store.js)
 * Solo catálogo, filtros y WhatsApp. Sin rastro de admin.
 */

const firebaseConfig = {
  apiKey: "AIzaSyC0aguCa2fPrnOfheOrZV1oQe_1wQDOr50",
  authDomain: "og-yam-creps.firebaseapp.com",
  projectId: "og-yam-creps",
  storageBucket: "og-yam-creps.firebasestorage.app",
  messagingSenderId: "427327061733",
  appId: "1:427327061733:web:a946d60638411e63831e0c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const WHATSAPP_NUMBER = '573128663161';
let products = [];

document.addEventListener('DOMContentLoaded', () => {
    initFirestore();
    initModals();
});

// === FIRESTORE: Escuchar productos en tiempo real ===
function initFirestore() {
    db.collection('productos').onSnapshot(snapshot => {
        products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderStore();
    }, err => console.error("Error cargando productos:", err));
}

// === RENDERIZAR CATÁLOGO ===
function renderStore() {
    const grid = $('product-grid');
    if (!grid) return;

    // Solo los que tienen stock
    let available = products.filter(p => getTotalStock(p) > 0);

    // Filtrar por género si estamos en una subpágina
    if (window.FILTER_GENDER) {
        available = available.filter(p => {
            if (window.FILTER_GENDER === 'Hombre') return p.genero === 'Hombre' || p.genero === 'Unisex';
            if (window.FILTER_GENDER === 'Mujer') return p.genero === 'Mujer' || p.genero === 'Unisex';
            return p.genero === window.FILTER_GENDER; // Niños, Niñas
        });
    }

    if (available.length === 0) {
        let msg = window.FILTER_GENDER ? `Pronto subiremos más tenis para ${window.FILTER_GENDER}.` : "Pronto subiremos más tenis en promoción.";
        grid.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:3rem; grid-column:1/-1; font-size:1.1rem;">${msg} ¡Escríbenos por WhatsApp y te conseguimos los que buscas! 👟</p>`;
        return;
    }

    // Filtrar promos
    let promos = available.filter(p => p.enPromocion);

    // Fallback: Si el admin no ha generado promos, mostramos 16 al azar basados en la semana actual (pseudo-random para que sean los mismos toda la semana)
    if (promos.length === 0) {
        const week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
        let shuffled = [...available].sort((a, b) => {
            const hashA = (a.id.charCodeAt(0) + week) % 100;
            const hashB = (b.id.charCodeAt(0) + week) % 100;
            return hashA - hashB;
        });
        promos = shuffled.slice(0, 16).map(p => ({...p, fakePromo: true, descuento: 10})); // Fake 10%
    } else {
        promos = promos.sort((a, b) => (b.fechaCreacion || 0) - (a.fechaCreacion || 0)).slice(0, 16);
    }

    grid.innerHTML = promos.map(prod => {
        const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);
        const sizesHtml = sizes.map(t => `<span class="size-badge">${t}</span>`).join('');
        
        let desc = prod.descuento || 0;
        let pVenta = prod.precioVenta || 0;
        let precioFinal = pVenta - (pVenta * desc / 100);
        let hotClass = desc >= 15 ? 'hot' : '';
        
        return `
        <div class="product-card" onclick="openProductModal('${prod.id}')">
            <div class="card-img-wrapper">
                ${desc > 0 ? `<div class="promo-badge ${hotClass}">-${desc}% OFF ${desc>=15?'🔥':''}</div>` : ''}
                ${prod.foto
                    ? `<img src="${prod.foto}" class="card-img" onerror="this.src='';">`
                    : `<div class="card-no-img">👟</div>`}
            </div>
            <div class="card-content">
                <span class="brand-tag">${prod.marca}</span>
                <p class="card-title">${prod.nombre}</p>
                <p class="price">
                    ${desc > 0 ? `<span class="old-price">${formatCOP(pVenta)}</span>` : ''}
                    ${formatCOP(precioFinal)}
                </p>
                <div class="sizes-badge-container">${sizesHtml}</div>
                <button class="btn-wa" onclick="event.stopPropagation(); quickWhatsApp('${prod.id}', ${precioFinal})">Pedir 💬</button>
            </div>
        </div>`;
    }).join('');
}

// === MODAL DE PRODUCTO ===
function initModals() {
    $('modal-close')?.addEventListener('click', () => $('product-modal').classList.add('hidden'));
    $('product-modal')?.addEventListener('click', e => {
        if (e.target === $('product-modal')) $('product-modal').classList.add('hidden');
    });
}

window.openProductModal = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const modal = $('product-modal');

    const img = $('modal-img');
    if (prod.foto) { img.src = prod.foto; img.style.display = 'block'; }
    else img.style.display = 'none';

    let desc = prod.descuento || (prod.fakePromo ? 10 : 0);
    // If it's a fake promo (fallback), we need to ensure the modal shows the same fake discount
    // We didn't persist the fake promo globally, let's just re-check if we are in fake mode.
    // Actually simpler: just calculate based on prod.descuento. The fake promo was only on the map.
    // Let's rely on the DOM for the price if we want, or just calculate it again.
    const isFake = !products.some(p => p.enPromocion);
    if (isFake) desc = 10;
    
    let pVenta = prod.precioVenta || 0;
    let precioFinal = pVenta - (pVenta * desc / 100);

    $('modal-brand').textContent = prod.marca;
    $('modal-title').textContent = prod.nombre;
    $('modal-price').innerHTML = desc > 0 ? `<span class="old-price">${formatCOP(pVenta)}</span> ${formatCOP(precioFinal)}` : formatCOP(pVenta);
    $('modal-desc').textContent = [prod.color ? 'Color: ' + prod.color : '', prod.genero, 'Medellín, Colombia · Envíos a todo el país'].filter(Boolean).join(' · ');

    const sizesContainer = $('modal-size-selector');
    const available = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);

    sizesContainer.innerHTML = available.length > 0
        ? available.map((t, i) => `<button class="size-btn ${i === 0 ? 'selected' : ''}" data-size="${t}">${t}</button>`).join('')
        : '<p style="color:#ff3333;">Agotado</p>';

    sizesContainer.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sizesContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    const waBtn = $('modal-wa-btn');
    const newBtn = waBtn.cloneNode(true);
    waBtn.parentNode.replaceChild(newBtn, waBtn);
    newBtn.id = 'modal-wa-btn';
    newBtn.addEventListener('click', () => {
        const selectedBtn = sizesContainer?.querySelector('.size-btn.selected');
        const size = selectedBtn ? selectedBtn.dataset.size : 'N/A';
        const msg = `¡Hola! Me interesan los tenis en promoción: *${prod.nombre}* (${prod.marca})\n👟 Talla: *${size}*\n💵 Precio Promo: *${formatCOP(precioFinal)}*\n¿Están disponibles para envío?`;
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    modal.classList.remove('hidden');
};

window.quickWhatsApp = (id, precioPromo) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0).join(', ');
    const msg = `¡Hola! Me interesan los tenis en promoción: *${prod.nombre}* (${prod.marca})\nTallas que vi: ${sizes}\nPrecio Promo: *${formatCOP(precioPromo)}*\n¿Me podrías confirmar disponibilidad?`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
};

// === HELPERS ===
function $(id) { return document.getElementById(id); }
function formatCOP(n) { return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function getTotalStock(prod) {
    if (!prod || !prod.tallas) return 0;
    return Object.values(prod.tallas).reduce((s, q) => s + (parseInt(q) || 0), 0);
}
