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

    // Mostrar solo los que tienen stock y ordenarlos (ej: los más nuevos primero)
    const filtered = products
        .filter(p => getTotalStock(p) > 0)
        .sort((a, b) => (b.fechaCreacion || 0) - (a.fechaCreacion || 0));

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:3rem; grid-column:1/-1; font-size:1.1rem;">Pronto subiremos más tenis en promoción. ¡Escríbenos por WhatsApp y te conseguimos los que buscas! 👟</p>';
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);
        const sizesHtml = sizes.map(t => `<span class="size-badge">${t}</span>`).join('');
        return `
        <div class="product-card" onclick="openProductModal('${prod.id}')">
            <div class="card-img-wrapper" style="height:230px; background:#111; overflow:hidden;">
                ${prod.foto
                    ? `<img src="${prod.foto}" class="card-img" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='';">`
                    : `<div style="height:100%; display:flex; align-items:center; justify-content:center; font-size:3.5rem;">👟</div>`}
            </div>
            <div class="card-content">
                <span class="brand-tag">${prod.marca}</span>
                <p class="card-title">${prod.nombre}</p>
                <p class="price">${formatCOP(prod.precioVenta)}</p>
                <div class="sizes-badge-container">${sizesHtml}</div>
                <button class="btn-wa" onclick="event.stopPropagation(); quickWhatsApp('${prod.id}')">Pedir por WhatsApp 💬</button>
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

    $('modal-brand').textContent = prod.marca;
    $('modal-title').textContent = prod.nombre;
    $('modal-price').textContent = formatCOP(prod.precioVenta);
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
        const msg = `¡Hola! Me interesan los tenis: *${prod.nombre}* (${prod.marca})\n👟 Talla: *${size}*\n💵 Precio: *${formatCOP(prod.precioVenta)}*\n¿Están disponibles para envío?`;
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    modal.classList.remove('hidden');
};

window.quickWhatsApp = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0).join(', ');
    const msg = `¡Hola! Me interesan los tenis: *${prod.nombre}* (${prod.marca})\nTallas que vi: ${sizes}\nPrecio: *${formatCOP(prod.precioVenta)}*\n¿Me podrías confirmar disponibilidad?`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
};

// === HELPERS ===
function $(id) { return document.getElementById(id); }
function formatCOP(n) { return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function getTotalStock(prod) {
    if (!prod || !prod.tallas) return 0;
    return Object.values(prod.tallas).reduce((s, q) => s + (parseInt(q) || 0), 0);
}
