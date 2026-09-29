/**
 * O'G YAM CREPS — Lógica de la aplicación
 * Almacenamiento en localStorage · Vanilla JS
 */

// ==========================================
// ESTADO DE LA APLICACIÓN
// ==========================================
let providers = [];
let products = [];
let ventas = [];
let currentSoldProduct = null;
let editingProductId = null;
let editingProviderId = null;

const WHATSAPP_NUMBER = '573128663161';

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initNavigation();
    initProviderForm();
    initProductForm();
    initSizeGrid();
    initStoreFilters();
    initModals();
    initExportImport();

    // Renderizado inicial
    renderProviders();
    populateProviderDropdown();
    renderAdminProducts();
    renderStoreProducts();
    renderDashboard();
    renderSales();
});

// ==========================================
// ALMACENAMIENTO
// ==========================================
function loadData() {
    try {
        const p = localStorage.getItem('og_providers');
        const pr = localStorage.getItem('og_products');
        const v = localStorage.getItem('og_ventas');
        if (p) providers = JSON.parse(p);
        if (pr) products = JSON.parse(pr);
        if (v) ventas = JSON.parse(v);
    } catch (e) {
        console.error('Error cargando datos:', e);
    }
}

function saveData() {
    localStorage.setItem('og_providers', JSON.stringify(providers));
    localStorage.setItem('og_products', JSON.stringify(products));
    localStorage.setItem('og_ventas', JSON.stringify(ventas));
}

// ==========================================
// UTILIDADES
// ==========================================
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function formatCOP(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(ts) {
    const d = new Date(ts);
    const pad = v => String(v).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function $(id) { return document.getElementById(id); }

function getTotalStock(prod) {
    return Object.values(prod.tallas || {}).reduce((s, q) => s + q, 0);
}

// ==========================================
// NAVEGACIÓN PRINCIPAL
// ==========================================
function initNavigation() {
    // Botones Tienda / Panel en navbar
    const btnTienda = $('nav-tienda');
    const btnAdmin = $('nav-admin');

    if (btnTienda) btnTienda.addEventListener('click', () => switchView('tienda'));
    if (btnAdmin) btnAdmin.addEventListener('click', () => switchView('admin'));

    // Logo vuelve a tienda
    const brand = document.querySelector('.brand');
    if (brand) {
        brand.style.cursor = 'pointer';
        brand.addEventListener('click', () => switchView('tienda'));
    }

    // Pestañas del admin
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.id.replace('tab-', '');
            switchAdminTab(tabId);
        });
    });
}

function switchView(name) {
    const viewTienda = $('view-tienda');
    const viewAdmin = $('view-admin');
    const btnTienda = $('nav-tienda');
    const btnAdmin = $('nav-admin');

    if (name === 'tienda') {
        viewTienda.classList.remove('hidden');
        viewAdmin.classList.add('hidden');
        btnTienda.classList.add('active');
        btnAdmin.classList.remove('active');
        renderStoreProducts();
    } else {
        viewTienda.classList.add('hidden');
        viewAdmin.classList.remove('hidden');
        btnTienda.classList.remove('active');
        btnAdmin.classList.add('active');
        populateProviderDropdown();
        renderDashboard();
    }
}

function switchAdminTab(name) {
    // Ocultar secciones
    document.querySelectorAll('.admin-section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    // Desactivar botones
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));

    // Activar la seleccionada
    const section = $(`admin-${name}`);
    const btn = $(`tab-${name}`);
    if (section) { section.classList.add('active'); section.classList.remove('hidden'); }
    if (btn) btn.classList.add('active');

    // Refrescar datos
    if (name === 'productos') { populateProviderDropdown(); renderAdminProducts(); renderDashboard(); }
    if (name === 'proveedores') renderProviders();
    if (name === 'ventas') renderSales();
}

// ==========================================
// PROVEEDORES — CRUD
// ==========================================
function initProviderForm() {
    const form = $('form-proveedor');
    if (!form) return;

    form.addEventListener('submit', e => {
        e.preventDefault();
        const nombre = $('prov-nombre').value.trim();
        const telefono = $('prov-telefono').value.trim();
        const notas = $('prov-notas').value.trim();

        if (!nombre) return;

        if (editingProviderId) {
            const idx = providers.findIndex(p => p.id === editingProviderId);
            if (idx !== -1) providers[idx] = { ...providers[idx], nombre, telefono, notas };
            editingProviderId = null;
        } else {
            providers.push({ id: uid(), nombre, telefono, notas });
        }

        saveData();
        form.reset();
        renderProviders();
        populateProviderDropdown();
    });
}

function renderProviders() {
    const list = $('proveedores-list');
    if (!list) return;

    if (providers.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay proveedores. Agrega uno arriba. ☝️</p>';
        return;
    }

    list.innerHTML = providers.map(p => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${p.nombre}</strong>
                <span>Tel: ${p.telefono || 'N/A'} ${p.notas ? ' · ' + p.notas : ''}</span>
            </div>
            <div class="list-actions">
                <button class="btn-action" onclick="editProvider('${p.id}')">Editar</button>
                <button class="btn-action delete" onclick="deleteProvider('${p.id}')">Eliminar</button>
            </div>
        </div>
    `).join('');
}

window.editProvider = id => {
    const p = providers.find(x => x.id === id);
    if (!p) return;
    editingProviderId = id;
    $('prov-nombre').value = p.nombre;
    $('prov-telefono').value = p.telefono;
    $('prov-notas').value = p.notas || '';
    $('prov-nombre').focus();
};

window.deleteProvider = id => {
    const linked = products.some(p => p.proveedorId === id);
    if (linked) {
        alert('Este proveedor tiene productos asociados. Elimina o reasigna esos productos primero.');
        return;
    }
    if (confirm('¿Eliminar este proveedor?')) {
        providers = providers.filter(p => p.id !== id);
        saveData();
        renderProviders();
        populateProviderDropdown();
    }
};

function populateProviderDropdown() {
    const sel = $('prod-proveedor');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Seleccionar proveedor…</option>' +
        providers.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    if (current && providers.some(p => p.id === current)) sel.value = current;
}

// ==========================================
// PRODUCTOS — FORMULARIO Y CRUD
// ==========================================
function initProductForm() {
    const form = $('form-producto');
    if (!form) return;

    // Live cost calc
    ['prod-costo-prov', 'prod-costo-envio', 'prod-precio-venta'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', calcLive);
    });

    // Photo preview
    const fotoInput = $('prod-foto');
    if (fotoInput) {
        fotoInput.addEventListener('input', () => {
            const preview = $('prod-foto-preview');
            if (preview) {
                if (fotoInput.value.trim()) {
                    preview.src = fotoInput.value.trim();
                    preview.classList.remove('hidden');
                    preview.onerror = () => preview.classList.add('hidden');
                } else {
                    preview.classList.add('hidden');
                }
            }
        });
    }

    // Submit
    form.addEventListener('submit', e => {
        e.preventDefault();

        // Recoger tallas
        const tallas = {};
        document.querySelectorAll('.size-stock-item.active').forEach(item => {
            const size = item.dataset.size;
            const input = item.querySelector('.size-input');
            const qty = parseInt(input?.value) || 1;
            if (qty > 0) tallas[size] = qty;
        });

        if (Object.keys(tallas).length === 0) {
            alert('Selecciona al menos una talla con stock.');
            return;
        }

        const provId = $('prod-proveedor').value;
        if (!provId) { alert('Selecciona un proveedor.'); return; }

        const producto = {
            id: editingProductId || uid(),
            proveedorId: provId,
            nombre: $('prod-nombre').value.trim(),
            marca: $('prod-marca').value,
            genero: $('prod-genero').value,
            descripcion: $('prod-descripcion')?.value.trim() || '',
            color: $('prod-color')?.value.trim() || '',
            foto: $('prod-foto')?.value.trim() || '',
            tallas,
            costoProveedor: parseFloat($('prod-costo-prov').value) || 0,
            costoEnvio: parseFloat($('prod-costo-envio').value) || 0,
            precioVenta: parseFloat($('prod-precio-venta').value) || 0,
            vendidos: 0,
            fechaCreacion: Date.now()
        };

        if (editingProductId) {
            const idx = products.findIndex(p => p.id === editingProductId);
            if (idx !== -1) {
                producto.vendidos = products[idx].vendidos;
                producto.fechaCreacion = products[idx].fechaCreacion;
                products[idx] = producto;
            }
            editingProductId = null;
        } else {
            products.push(producto);
        }

        saveData();
        resetProductForm();
        renderAdminProducts();
        renderDashboard();
    });
}

function calcLive() {
    const costo = parseFloat($('prod-costo-prov')?.value) || 0;
    const envio = parseFloat($('prod-costo-envio')?.value) || 0;
    const precio = parseFloat($('prod-precio-venta')?.value) || 0;
    const total = costo + envio;
    const ganancia = precio - total;
    const margen = precio > 0 ? (ganancia / precio * 100) : 0;

    const elTotal = $('calc-costo-total');
    const elGanancia = $('calc-ganancia');
    const elMargen = $('calc-margen');

    if (elTotal) elTotal.textContent = formatCOP(total);
    if (elGanancia) {
        elGanancia.textContent = formatCOP(ganancia);
        elGanancia.style.color = ganancia >= 0 ? 'var(--neon-green)' : '#ff3333';
    }
    if (elMargen) {
        elMargen.textContent = margen.toFixed(1) + '%';
        elMargen.style.color = margen >= 0 ? 'var(--neon-green)' : '#ff3333';
    }
}

// ==========================================
// GRID DE TALLAS (35-45) — Fast Entry
// ==========================================
function initSizeGrid() {
    const grid = $('size-stock-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let s = 35; s <= 45; s++) {
        const item = document.createElement('div');
        item.className = 'size-stock-item';
        item.dataset.size = s;
        item.innerHTML = `
            <span class="size-label">${s}</span>
            <input type="number" class="size-input" min="1" value="1" disabled data-size="${s}">
        `;

        // Toggle al hacer clic
        item.addEventListener('click', e => {
            if (e.target.classList.contains('size-input')) return;
            item.classList.toggle('active');
            const input = item.querySelector('.size-input');
            if (item.classList.contains('active')) {
                input.disabled = false;
                input.value = input.value || 1;
            } else {
                input.disabled = true;
                input.value = 1;
            }
        });

        grid.appendChild(item);
    }
}

function resetProductForm() {
    const form = $('form-producto');
    if (form) form.reset();
    editingProductId = null;

    // Reset foto preview
    const preview = $('prod-foto-preview');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }

    // Reset tallas
    document.querySelectorAll('.size-stock-item').forEach(item => {
        item.classList.remove('active');
        const input = item.querySelector('.size-input');
        if (input) { input.disabled = true; input.value = 1; }
    });

    // Reset calc
    const elTotal = $('calc-costo-total');
    const elGanancia = $('calc-ganancia');
    const elMargen = $('calc-margen');
    if (elTotal) elTotal.textContent = '$0';
    if (elGanancia) { elGanancia.textContent = '$0'; elGanancia.style.color = ''; }
    if (elMargen) { elMargen.textContent = '0%'; elMargen.style.color = ''; }
}

function restoreSizeGrid(tallas) {
    document.querySelectorAll('.size-stock-item').forEach(item => {
        const size = item.dataset.size;
        const input = item.querySelector('.size-input');
        if (tallas[size] && tallas[size] > 0) {
            item.classList.add('active');
            if (input) { input.disabled = false; input.value = tallas[size]; }
        } else {
            item.classList.remove('active');
            if (input) { input.disabled = true; input.value = 1; }
        }
    });
}

// ==========================================
// LISTA DE PRODUCTOS EN ADMIN
// ==========================================
function renderAdminProducts() {
    const list = $('productos-list');
    if (!list) return;

    if (products.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Sin productos. Agrega uno con el formulario. 👟</p>';
        return;
    }

    const sorted = [...products].sort((a, b) => b.fechaCreacion - a.fechaCreacion);

    list.innerHTML = sorted.map(prod => {
        const prov = providers.find(p => p.id === prod.proveedorId);
        const provName = prov ? prov.nombre : 'Desconocido';
        const stock = getTotalStock(prod);
        const isSoldOut = stock === 0;
        const tallasHtml = Object.entries(prod.tallas)
            .filter(([, q]) => q > 0)
            .map(([t, q]) => `<span class="size-badge">${t} (${q})</span>`)
            .join(' ');

        return `
        <div class="list-item" style="flex-wrap:wrap;gap:1rem;">
            <div style="display:flex;gap:1rem;align-items:center;flex:1;min-width:200px;">
                ${prod.foto
                    ? `<img src="${prod.foto}" style="width:55px;height:55px;object-fit:cover;border-radius:var(--radius-sm);" onerror="this.style.display='none'">`
                    : `<div style="width:55px;height:55px;background:#222;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;">👟</div>`}
                <div class="list-item-info">
                    <strong>${prod.nombre} ${isSoldOut ? '<span style="color:#ff3333;font-size:0.8em;">AGOTADO</span>' : ''}</strong>
                    <span>${prod.marca} · ${provName} · PVP: ${formatCOP(prod.precioVenta)}</span>
                    <div style="margin-top:4px;" class="sizes-badge-container">${tallasHtml}</div>
                </div>
            </div>
            <div class="list-actions" style="flex-shrink:0;">
                ${!isSoldOut ? `<button class="btn-action sell" onclick="promptSell('${prod.id}')">Vendido</button>` : ''}
                <button class="btn-action" onclick="editProduct('${prod.id}')">Editar</button>
                <button class="btn-action delete" onclick="deleteProduct('${prod.id}')">Eliminar</button>
            </div>
        </div>`;
    }).join('');
}

window.editProduct = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    editingProductId = id;

    $('prod-proveedor').value = prod.proveedorId;
    $('prod-nombre').value = prod.nombre;
    $('prod-marca').value = prod.marca;
    $('prod-genero').value = prod.genero;
    if ($('prod-descripcion')) $('prod-descripcion').value = prod.descripcion;
    if ($('prod-color')) $('prod-color').value = prod.color;
    if ($('prod-foto')) $('prod-foto').value = prod.foto;
    $('prod-costo-prov').value = prod.costoProveedor;
    $('prod-costo-envio').value = prod.costoEnvio;
    $('prod-precio-venta').value = prod.precioVenta;

    // Preview foto
    const preview = $('prod-foto-preview');
    if (preview && prod.foto) { preview.src = prod.foto; preview.classList.remove('hidden'); }

    // Tallas
    restoreSizeGrid(prod.tallas);

    // Calc
    calcLive();

    $('prod-nombre').focus();
    window.scrollTo({ top: document.querySelector('.form-card').offsetTop - 80, behavior: 'smooth' });
};

window.deleteProduct = id => {
    if (confirm('¿Eliminar este producto?')) {
        products = products.filter(p => p.id !== id);
        saveData();
        renderAdminProducts();
        renderStoreProducts();
        renderDashboard();
    }
};

// ==========================================
// MARCAR COMO VENDIDO
// ==========================================
window.promptSell = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    currentSoldProduct = prod;

    const modal = $('sell-modal');
    const nameEl = $('sell-product-name');
    const select = $('sell-size-select');
    if (!modal || !select) return;

    if (nameEl) nameEl.textContent = prod.nombre;
    select.innerHTML = '<option value="">Seleccionar talla…</option>' +
        Object.entries(prod.tallas)
            .filter(([, q]) => q > 0)
            .map(([t, q]) => `<option value="${t}">Talla ${t} (stock: ${q})</option>`)
            .join('');

    modal.classList.remove('hidden');
};

function initModals() {
    // Modal de venta
    const sellModal = $('sell-modal');
    const sellClose = $('sell-modal-close');
    const sellConfirm = $('confirm-sell-btn');

    if (sellClose) sellClose.addEventListener('click', () => sellModal.classList.add('hidden'));
    if (sellConfirm) sellConfirm.addEventListener('click', confirmSale);

    // Modal de producto (tienda)
    const prodModal = $('product-modal');
    const modalClose = $('modal-close');
    if (modalClose) modalClose.addEventListener('click', () => prodModal.classList.add('hidden'));

    // Cerrar modales al hacer clic fuera
    [sellModal, prodModal].forEach(m => {
        if (m) m.addEventListener('click', e => {
            if (e.target === m) m.classList.add('hidden');
        });
    });
}

function confirmSale() {
    const select = $('sell-size-select');
    if (!select || !select.value || !currentSoldProduct) {
        alert('Selecciona una talla.');
        return;
    }

    const size = select.value;
    const prod = currentSoldProduct;

    if (!prod.tallas[size] || prod.tallas[size] <= 0) {
        alert('No hay stock de esa talla.');
        return;
    }

    // Descontar stock
    prod.tallas[size] -= 1;
    if (prod.tallas[size] === 0) delete prod.tallas[size];
    prod.vendidos = (prod.vendidos || 0) + 1;

    // Crear registro de venta
    const prov = providers.find(p => p.id === prod.proveedorId);
    const costoTotal = prod.costoProveedor + prod.costoEnvio;

    ventas.push({
        id: uid(),
        productoId: prod.id,
        nombreProducto: prod.nombre,
        marca: prod.marca,
        talla: size,
        precioVenta: prod.precioVenta,
        costoTotal,
        ganancia: prod.precioVenta - costoTotal,
        proveedor: prov ? prov.nombre : 'Desconocido',
        fecha: Date.now()
    });

    // Actualizar producto en el array
    const idx = products.findIndex(p => p.id === prod.id);
    if (idx !== -1) products[idx] = prod;

    saveData();
    currentSoldProduct = null;
    $('sell-modal').classList.add('hidden');

    renderAdminProducts();
    renderDashboard();
    renderSales();
    renderStoreProducts();
}

// ==========================================
// TIENDA PÚBLICA
// ==========================================
function initStoreFilters() {
    ['search-input', 'filter-marca', 'filter-genero'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', renderStoreProducts);
    });
}

function renderStoreProducts() {
    const grid = $('product-grid');
    if (!grid) return;

    const term = ($('search-input')?.value || '').toLowerCase();
    const marcaF = $('filter-marca')?.value || '';
    const generoF = $('filter-genero')?.value || '';

    const filtered = products.filter(p => {
        if (getTotalStock(p) === 0) return false;
        const matchText = p.nombre.toLowerCase().includes(term) ||
            p.marca.toLowerCase().includes(term) ||
            (p.color && p.color.toLowerCase().includes(term));
        const matchMarca = marcaF ? p.marca === marcaF : true;
        const matchGenero = generoF ? p.genero === generoF : true;
        return matchText && matchMarca && matchGenero;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem;grid-column:1/-1;">No hay productos disponibles. 👟</p>';
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const sizes = Object.keys(prod.tallas).filter(t => prod.tallas[t] > 0);
        const sizesHtml = sizes.map(t => `<span class="size-badge">${t}</span>`).join('');

        return `
        <div class="product-card" onclick="openProductModal('${prod.id}')">
            <div class="card-img-wrapper" style="height:250px;background:#111;overflow:hidden;">
                ${prod.foto
                    ? `<img src="${prod.foto}" class="card-img" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;\\'>👟</div>'">`
                    : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;">👟</div>`}
            </div>
            <div class="card-content">
                <span class="brand-tag">${prod.marca}</span>
                <p class="card-title">${prod.nombre}</p>
                <p class="price">${formatCOP(prod.precioVenta)}</p>
                <div class="sizes-badge-container">${sizesHtml}</div>
                <button class="btn-wa" onclick="event.stopPropagation(); quickWhatsApp('${prod.id}')">Comprar por WhatsApp 💬</button>
            </div>
        </div>`;
    }).join('');
}

// Modal de detalle de producto
window.openProductModal = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    const modal = $('product-modal');
    if (!modal) return;

    // Imagen
    const img = $('modal-img');
    if (img) {
        if (prod.foto) { img.src = prod.foto; img.style.display = 'block'; }
        else img.style.display = 'none';
    }

    // Info
    const elBrand = $('modal-brand');
    const elTitle = $('modal-title');
    const elPrice = $('modal-price');
    const elDesc = $('modal-desc');

    if (elBrand) elBrand.textContent = prod.marca;
    if (elTitle) elTitle.textContent = prod.nombre;
    if (elPrice) elPrice.textContent = formatCOP(prod.precioVenta);
    if (elDesc) elDesc.textContent = [prod.descripcion, prod.color ? 'Color: ' + prod.color : '', prod.genero].filter(Boolean).join(' · ');

    // Tallas como botones
    const sizesContainer = $('modal-size-selector');
    if (sizesContainer) {
        const available = Object.keys(prod.tallas).filter(t => prod.tallas[t] > 0);
        if (available.length > 0) {
            sizesContainer.innerHTML = available.map((t, i) =>
                `<button class="size-btn ${i === 0 ? 'selected' : ''}" data-size="${t}">${t}</button>`
            ).join('');

            sizesContainer.querySelectorAll('.size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    sizesContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
            });
        } else {
            sizesContainer.innerHTML = '<p style="color:#ff3333;">Agotado</p>';
        }
    }

    // WhatsApp button
    const waBtn = $('modal-wa-btn');
    if (waBtn) {
        const newBtn = waBtn.cloneNode(true);
        waBtn.parentNode.replaceChild(newBtn, waBtn);
        newBtn.id = 'modal-wa-btn';
        newBtn.addEventListener('click', () => {
            const selectedBtn = sizesContainer?.querySelector('.size-btn.selected');
            const size = selectedBtn ? selectedBtn.dataset.size : 'N/A';
            const msg = `Hola! Me interesa: ${prod.nombre} - Talla: ${size} - Precio: ${formatCOP(prod.precioVenta)}. ¿Está disponible?`;
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }

    modal.classList.remove('hidden');
};

// WhatsApp rápido desde tarjeta (sin abrir modal)
window.quickWhatsApp = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const sizes = Object.keys(prod.tallas).filter(t => prod.tallas[t] > 0);
    const tallasText = sizes.join(', ');
    const msg = `Hola! Me interesa: ${prod.nombre} (${prod.marca}) - Tallas disponibles: ${tallasText} - Precio: ${formatCOP(prod.precioVenta)}. ¿Está disponible?`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ==========================================
// KPI DASHBOARD
// ==========================================
function renderDashboard() {
    let totalInvertido = 0;
    let valorVenta = 0;
    let enStock = 0;
    const provStats = {};

    products.forEach(p => {
        const stock = getTotalStock(p);
        if (stock > 0) {
            enStock++;
            const invertido = (p.costoProveedor + p.costoEnvio) * stock;
            const venta = p.precioVenta * stock;
            totalInvertido += invertido;
            valorVenta += venta;

            if (!provStats[p.proveedorId]) provStats[p.proveedorId] = { invertido: 0, venta: 0 };
            provStats[p.proveedorId].invertido += invertido;
            provStats[p.proveedorId].venta += venta;
        }
    });

    const gananciaPotencial = valorVenta - totalInvertido;
    const gananciaRealizada = ventas.reduce((s, v) => s + v.ganancia, 0);

    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    set('kpi-invertido', formatCOP(totalInvertido));
    set('kpi-venta-potencial', formatCOP(valorVenta));
    set('kpi-ganancia-potencial', formatCOP(gananciaPotencial));
    set('kpi-ganancia-realizada', formatCOP(gananciaRealizada));
    set('kpi-stock', enStock);

    // Desglose por proveedor
    const breakdown = $('kpi-proveedores-breakdown');
    if (breakdown) {
        const keys = Object.keys(provStats);
        if (keys.length === 0) {
            breakdown.innerHTML = '<p style="color:var(--text-muted);">Sin datos de inventario.</p>';
        } else {
            breakdown.innerHTML = keys.map(pid => {
                const prov = providers.find(p => p.id === pid);
                const name = prov ? prov.nombre : 'Desconocido';
                const s = provStats[pid];
                return `<p><strong>${name}:</strong> Invertido ${formatCOP(s.invertido)} · Potencial ${formatCOP(s.venta)}</p>`;
            }).join('');
        }
    }

    // También actualizar KPI de ventas
    set('kpi-ventas-total', formatCOP(gananciaRealizada));
}

// ==========================================
// REGISTRO DE VENTAS
// ==========================================
function renderSales() {
    const list = $('ventas-list');
    if (!list) return;

    renderDashboard(); // refresh totals

    if (ventas.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Aún no hay ventas registradas. 📊</p>';
        return;
    }

    const sorted = [...ventas].sort((a, b) => b.fecha - a.fecha);

    let html = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--border-color);">
            <th style="padding:0.8rem;color:var(--text-muted);font-size:0.85rem;">Fecha</th>
            <th style="padding:0.8rem;color:var(--text-muted);font-size:0.85rem;">Producto</th>
            <th style="padding:0.8rem;color:var(--text-muted);font-size:0.85rem;">Talla</th>
            <th style="padding:0.8rem;color:var(--text-muted);font-size:0.85rem;">Proveedor</th>
            <th style="padding:0.8rem;color:var(--text-muted);font-size:0.85rem;">Venta</th>
            <th style="padding:0.8rem;color:var(--text-muted);font-size:0.85rem;">Ganancia</th>
        </tr></thead><tbody>`;

    sorted.forEach(v => {
        html += `<tr style="border-bottom:1px solid #222;">
            <td style="padding:0.8rem;font-size:0.9rem;">${formatDate(v.fecha)}</td>
            <td style="padding:0.8rem;">${v.nombreProducto} <small style="color:var(--text-muted);">(${v.marca})</small></td>
            <td style="padding:0.8rem;">${v.talla}</td>
            <td style="padding:0.8rem;font-size:0.9rem;">${v.proveedor}</td>
            <td style="padding:0.8rem;">${formatCOP(v.precioVenta)}</td>
            <td style="padding:0.8rem;color:${v.ganancia >= 0 ? 'var(--neon-green)' : '#ff3333'};font-weight:600;">${formatCOP(v.ganancia)}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    list.innerHTML = html;
}

// ==========================================
// EXPORTAR / IMPORTAR
// ==========================================
function initExportImport() {
    // Agregar botones de export/import al admin si no existen
    const adminHeader = document.querySelector('.admin-header');
    if (adminHeader && !$('btn-export')) {
        const toolsDiv = document.createElement('div');
        toolsDiv.style.cssText = 'display:flex;gap:0.5rem;margin-top:1rem;';
        toolsDiv.innerHTML = `
            <button id="btn-export" class="btn-action" style="border-color:var(--neon-green);color:var(--neon-green);">📥 Exportar datos</button>
            <button id="btn-import" class="btn-action" style="border-color:var(--neon-green);color:var(--neon-green);">📤 Importar datos</button>
            <input type="file" id="import-file" accept=".json" style="display:none;">
        `;
        adminHeader.appendChild(toolsDiv);
    }

    // Exportar
    const btnExport = $('btn-export');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const data = { providers, products, ventas, exportDate: Date.now() };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `og_yam_creps_backup_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Importar
    const btnImport = $('btn-import');
    const importFile = $('import-file');
    if (btnImport && importFile) {
        btnImport.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (!confirm('¿Reemplazar TODOS los datos con este archivo? Esta acción no se puede deshacer.')) return;

            const reader = new FileReader();
            reader.onload = evt => {
                try {
                    const data = JSON.parse(evt.target.result);
                    if (data.providers && data.products && data.ventas) {
                        providers = data.providers;
                        products = data.products;
                        ventas = data.ventas;
                        saveData();
                        alert('Datos importados correctamente. La página se recargará.');
                        location.reload();
                    } else {
                        alert('El archivo no tiene el formato correcto.');
                    }
                } catch (err) {
                    alert('Error leyendo el archivo JSON.');
                    console.error(err);
                }
            };
            reader.readAsText(file);
            importFile.value = '';
        });
    }
}
