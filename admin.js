/**
 * O'G YAM CREPS — Panel de Administración (admin.js)
 * Firebase Auth + Firestore. Completamente separado de la tienda pública.
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
const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence().catch(() => {});

let products = [];
let providers = [];
let ventas = [];
let editingProductId = null;
let currentSoldProduct = null;

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTabs();
    initProductForm();
    initProviderForm();
    initSizeGrid();
    initPhotoUpload();
    initSellModal();
});

// ==========================================
// AUTENTICACIÓN
// ==========================================
function initAuth() {
    auth.onAuthStateChanged(user => {
        if (user) {
            $('login-screen').style.display = 'none';
            $('admin-panel').style.display = 'block';
            $('admin-nav-links').style.display = 'flex';
            $('sync-status').innerHTML = `☁️ Conectado como <strong>${user.email}</strong>`;
            listenData();
        } else {
            $('login-screen').style.display = 'flex';
            $('admin-panel').style.display = 'none';
            $('admin-nav-links').style.display = 'none';
        }
    });

    $('form-login').addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('login-email').value.trim();
        const password = $('login-password').value;
        const errorEl = $('login-error');
        const btn = $('login-submit-btn');

        errorEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Ingresando...';

        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err) {
            errorEl.style.display = 'block';
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                errorEl.textContent = 'Contraseña incorrecta.';
            } else if (err.code === 'auth/user-not-found') {
                errorEl.textContent = 'No existe un usuario con este correo.';
            } else if (err.code === 'auth/invalid-email') {
                errorEl.textContent = 'El correo no es válido.';
            } else {
                errorEl.textContent = 'Error: ' + err.message;
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Ingresar';
        }
    });

    $('nav-logout-btn').addEventListener('click', async () => {
        if (confirm('¿Cerrar sesión del panel?')) await auth.signOut();
    });
}

// ==========================================
// FIRESTORE: Escuchar datos en tiempo real
// ==========================================
function listenData() {
    db.collection('productos').onSnapshot(snap => {
        products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderAdminProducts();
        renderAdminPromos();
        renderDashboard();
    });

    db.collection('proveedores').onSnapshot(snap => {
        providers = [];
        snap.forEach(doc => providers.push({ id: doc.id, ...doc.data() }));
        renderProviders();
        populateProviderDropdown();
        renderAdminProducts();
        renderAdminPromos();
        renderDashboard();
    });

    db.collection('ventas').orderBy('fecha', 'desc').onSnapshot(snap => {
        ventas = [];
        snap.forEach(doc => ventas.push({ id: doc.id, ...doc.data() }));
        renderSales();
        renderDashboard();
    });
}

// ==========================================
// TABS
// ==========================================
function initTabs() {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.id.replace('tab-', '');
            document.querySelectorAll('.admin-section').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            const section = $(`admin-${name}`);
            if (section) { section.classList.add('active'); section.classList.remove('hidden'); }
            btn.classList.add('active');
        });
    });
}

// ==========================================
// FOTO: Subir desde celular / galería
// ==========================================
function initPhotoUpload() {
    const fileInput = $('prod-foto-file');
    const urlInput = $('prod-foto');
    const preview = $('prod-foto-preview');
    const wrapper = $('preview-wrapper');
    const btnRemove = $('btn-remove-foto');

    if (fileInput) {
        fileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const compressed = await compressImage(file, 800, 0.75);
                urlInput.value = compressed;
                preview.src = compressed;
                wrapper.classList.remove('hidden');
            } catch (err) {
                alert("No se pudo procesar la imagen.");
            }
        });
    }

    if (urlInput) {
        urlInput.addEventListener('input', () => {
            const val = urlInput.value.trim();
            if (val) { preview.src = val; wrapper.classList.remove('hidden'); }
            else wrapper.classList.add('hidden');
        });
    }

    if (btnRemove) {
        btnRemove.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (urlInput) urlInput.value = '';
            preview.src = '';
            wrapper.classList.add('hidden');
        });
    }
}

function compressImage(file, maxWidth = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ==========================================
// PRODUCTOS: CRUD
// ==========================================
function initProductForm() {
    ['prod-costo-prov', 'prod-costo-envio', 'prod-precio-venta'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', calcLive);
    });

    $('btn-cancel-edit')?.addEventListener('click', resetProductForm);

    $('form-producto').addEventListener('submit', async e => {
        e.preventDefault();

        const tallas = {};
        document.querySelectorAll('.size-stock-item.active').forEach(item => {
            const size = item.dataset.size;
            const qty = parseInt(item.querySelector('.size-input')?.value) || 1;
            if (qty > 0) tallas[size] = qty;
        });

        if (Object.keys(tallas).length === 0) { alert('Activa al menos una talla.'); return; }
        if (!$('prod-proveedor').value) { alert('Selecciona el proveedor.'); return; }

        const btn = $('btn-save-prod');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const data = {
            proveedorId: $('prod-proveedor').value,
            nombre: $('prod-nombre').value.trim(),
            marca: $('prod-marca').value,
            genero: $('prod-genero').value,
            color: $('prod-color')?.value.trim() || '',
            foto: $('prod-foto')?.value.trim() || '',
            tallas,
            costoProveedor: parseFloat($('prod-costo-prov').value) || 0,
            costoEnvio: parseFloat($('prod-costo-envio').value) || 0,
            precioVenta: parseFloat($('prod-precio-venta').value) || 0,
            vendidos: 0,
            fechaCreacion: Date.now()
        };

        try {
            if (editingProductId) {
                const existing = products.find(p => p.id === editingProductId);
                if (existing) data.vendidos = existing.vendidos || 0;
                await db.collection('productos').doc(editingProductId).update(data);
            } else {
                await db.collection('productos').add(data);
            }
            resetProductForm();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            btn.disabled = false; btn.textContent = 'Guardar Producto';
        }
    });
}

function calcLive() {
    const costo = parseFloat($('prod-costo-prov')?.value) || 0;
    const envio = parseFloat($('prod-costo-envio')?.value) || 0;
    const precio = parseFloat($('prod-precio-venta')?.value) || 0;
    const total = costo + envio;
    const ganancia = precio - total;
    const margen = precio > 0 ? (ganancia / precio * 100) : 0;

    const el = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    el('calc-costo-total', formatCOP(total));
    const gEl = $('calc-ganancia');
    if (gEl) { gEl.textContent = formatCOP(ganancia); gEl.style.color = ganancia >= 0 ? 'var(--neon-green)' : '#ff3333'; }
    const mEl = $('calc-margen');
    if (mEl) { mEl.textContent = margen.toFixed(1) + '%'; mEl.style.color = margen >= 0 ? 'var(--neon-green)' : '#ff3333'; }
}

function initSizeGrid() {
    const grid = $('size-stock-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let s = 35; s <= 45; s++) {
        const item = document.createElement('div');
        item.className = 'size-stock-item';
        item.dataset.size = s;
        item.innerHTML = `<span class="size-label">${s}</span><input type="number" class="size-input" min="1" value="1" disabled>`;
        item.addEventListener('click', e => {
            if (e.target.classList.contains('size-input')) return;
            item.classList.toggle('active');
            const input = item.querySelector('.size-input');
            input.disabled = !item.classList.contains('active');
            if (!item.classList.contains('active')) input.value = 1;
        });
        grid.appendChild(item);
    }
}

function resetProductForm() {
    $('form-producto')?.reset();
    editingProductId = null;
    $('form-product-title').textContent = 'Agregar Tenis (Carga Rápida)';
    $('btn-save-prod').textContent = 'Guardar Producto';
    $('btn-cancel-edit').classList.add('hidden');
    $('preview-wrapper').classList.add('hidden');
    $('prod-foto-preview').src = '';
    document.querySelectorAll('.size-stock-item').forEach(item => {
        item.classList.remove('active');
        const input = item.querySelector('.size-input');
        if (input) { input.disabled = true; input.value = 1; }
    });
    ['calc-costo-total', 'calc-ganancia', 'calc-margen'].forEach(id => {
        const el = $(id); if (el) { el.textContent = id.includes('margen') ? '0%' : '$0'; el.style.color = ''; }
    });
}

function renderAdminProducts() {
    const list = $('productos-list');
    const countEl = $('admin-prod-count');
    if (!list) return;

    if (products.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Sin productos aún. ¡Agrega tu primer par! 👟</p>';
        if (countEl) countEl.textContent = '0 pares';
        return;
    }

    let totalPairs = 0;
    products.forEach(p => totalPairs += getTotalStock(p));
    if (countEl) countEl.textContent = `${totalPairs} pares`;

    const sorted = [...products].sort((a, b) => (b.fechaCreacion || 0) - (a.fechaCreacion || 0));
    list.innerHTML = sorted.map(prod => {
        const prov = providers.find(p => p.id === prod.proveedorId);
        const provName = prov ? prov.nombre : 'Sin asignar';
        const stock = getTotalStock(prod);
        const isSoldOut = stock === 0;
        const tallasHtml = Object.entries(prod.tallas || {}).filter(([, q]) => q > 0)
            .map(([t, q]) => `<span class="size-badge">${t} (${q})</span>`).join(' ');

        return `<div class="list-item" style="flex-wrap:wrap; gap:0.8rem;">
            <div style="display:flex; gap:0.8rem; align-items:center; flex:1; min-width:180px;">
                ${prod.foto ? `<img src="${prod.foto}" style="width:50px;height:50px;object-fit:cover;border-radius:var(--radius-sm);" onerror="this.alt='👟';">` : `<div style="width:50px;height:50px;background:#222;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">👟</div>`}
                <div class="list-item-info">
                    <strong>${prod.nombre} ${isSoldOut ? '<span style="color:#ff3333;font-size:0.8em;">[AGOTADO]</span>' : ''}</strong>
                    <span>${prod.marca} · ${provName} · PVP: ${formatCOP(prod.precioVenta)}</span>
                    <div style="margin-top:4px;" class="sizes-badge-container">${tallasHtml || '<span style="color:#999;font-size:0.75rem;">Sin tallas</span>'}</div>
                </div>
            </div>
            <div class="list-actions">
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
    $('form-product-title').textContent = 'Editar: ' + prod.nombre;
    $('btn-save-prod').textContent = 'Actualizar';
    $('btn-cancel-edit').classList.remove('hidden');
    $('prod-proveedor').value = prod.proveedorId || '';
    $('prod-nombre').value = prod.nombre || '';
    $('prod-marca').value = prod.marca || 'Nike';
    $('prod-genero').value = prod.genero || 'Unisex';
    $('prod-color').value = prod.color || '';
    $('prod-foto').value = prod.foto || '';
    $('prod-costo-prov').value = prod.costoProveedor || 0;
    $('prod-costo-envio').value = prod.costoEnvio || 0;
    $('prod-precio-venta').value = prod.precioVenta || 0;
    if (prod.foto) { $('prod-foto-preview').src = prod.foto; $('preview-wrapper').classList.remove('hidden'); }
    document.querySelectorAll('.size-stock-item').forEach(item => {
        const size = item.dataset.size, input = item.querySelector('.size-input');
        if (prod.tallas?.[size] > 0) { item.classList.add('active'); input.disabled = false; input.value = prod.tallas[size]; }
        else { item.classList.remove('active'); input.disabled = true; input.value = 1; }
    });
    calcLive();
    window.scrollTo({ top: $('form-producto').offsetTop - 80, behavior: 'smooth' });
};

window.deleteProduct = async id => {
    if (confirm('¿Eliminar este modelo?')) {
        try { await db.collection('productos').doc(id).delete(); } catch (e) { alert("Error: " + e.message); }
    }
};

// ==========================================
// VENTAS
// ==========================================
function initSellModal() {
    $('sell-modal-close')?.addEventListener('click', () => $('sell-modal').classList.add('hidden'));
    $('sell-modal')?.addEventListener('click', e => { if (e.target === $('sell-modal')) $('sell-modal').classList.add('hidden'); });
    $('confirm-sell-btn')?.addEventListener('click', confirmSale);
}

window.promptSell = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    currentSoldProduct = prod;
    $('sell-product-name').textContent = `${prod.nombre} (${prod.marca})`;
    const select = $('sell-size-select');
    select.innerHTML = '<option value="">Selecciona talla...</option>' +
        Object.entries(prod.tallas || {}).filter(([, q]) => q > 0)
            .map(([t, q]) => `<option value="${t}">Talla ${t} (${q} en stock)</option>`).join('');
    $('sell-modal').classList.remove('hidden');
};

async function confirmSale() {
    const select = $('sell-size-select');
    if (!select?.value || !currentSoldProduct) { alert('Selecciona la talla vendida.'); return; }
    const size = select.value, prod = currentSoldProduct;
    if (!prod.tallas[size] || prod.tallas[size] <= 0) { alert('Sin stock de esa talla.'); return; }

    prod.tallas[size] -= 1;
    if (prod.tallas[size] === 0) delete prod.tallas[size];

    const prov = providers.find(p => p.id === prod.proveedorId);
    const costoTotal = (prod.costoProveedor || 0) + (prod.costoEnvio || 0);
    const ganancia = (prod.precioVenta || 0) - costoTotal;

    try {
        await db.collection('ventas').add({
            productoId: prod.id, nombreProducto: prod.nombre, marca: prod.marca,
            talla: size, precioVenta: prod.precioVenta, costoTotal, ganancia,
            proveedor: prov ? prov.nombre : 'Local', fecha: Date.now()
        });
        await db.collection('productos').doc(prod.id).update({ tallas: prod.tallas, vendidos: (prod.vendidos || 0) + 1 });
        $('sell-modal').classList.add('hidden');
        currentSoldProduct = null;
        alert(`¡Venta registrada! Ganancia: ${formatCOP(ganancia)} 🎉`);
    } catch (e) { alert("Error: " + e.message); }
}

// ==========================================
// PROVEEDORES
// ==========================================
function initProviderForm() {
    $('form-proveedor').addEventListener('submit', async e => {
        e.preventDefault();
        const nombre = $('prov-nombre').value.trim();
        if (!nombre) return;
        try {
            await db.collection('proveedores').add({
                nombre, telefono: $('prov-telefono').value.trim(),
                notas: $('prov-notas').value.trim(), fechaCreacion: Date.now()
            });
            $('form-proveedor').reset();
        } catch (e) { alert("Error: " + e.message); }
    });
}

function renderProviders() {
    const list = $('proveedores-list');
    if (!list) return;
    if (providers.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Sin proveedores aún. 📦</p>';
        return;
    }
    list.innerHTML = providers.map(p => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${p.nombre}</strong>
                <span>Tel: ${p.telefono || '-'} ${p.notas ? ' · ' + p.notas : ''}</span>
            </div>
            <div class="list-actions">
                <button class="btn-action delete" onclick="deleteProvider('${p.id}')">Eliminar</button>
            </div>
        </div>`).join('');
}

window.deleteProvider = async id => {
    if (products.some(p => p.proveedorId === id)) { alert('Tiene tenis asociados. Elimínalos primero.'); return; }
    if (confirm('¿Eliminar proveedor?')) {
        try { await db.collection('proveedores').doc(id).delete(); } catch (e) { alert("Error: " + e.message); }
    }
};

function populateProviderDropdown() {
    const sel = $('prod-proveedor');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Selecciona proveedor...</option>' +
        providers.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    if (current && providers.some(p => p.id === current)) sel.value = current;
}

// ==========================================
// KPIs
// ==========================================
function renderDashboard() {
    let totalInvertido = 0, valorVenta = 0, enStock = 0;
    const provStats = {};

    products.forEach(p => {
        const stock = getTotalStock(p);
        if (stock > 0) {
            enStock += stock;
            const inv = ((p.costoProveedor || 0) + (p.costoEnvio || 0)) * stock;
            const ven = (p.precioVenta || 0) * stock;
            totalInvertido += inv; valorVenta += ven;
            const pid = p.proveedorId || 'x';
            if (!provStats[pid]) provStats[pid] = { invertido: 0, venta: 0, pares: 0 };
            provStats[pid].invertido += inv; provStats[pid].venta += ven; provStats[pid].pares += stock;
        }
    });

    const gananciaReal = ventas.reduce((s, v) => s + (v.ganancia || 0), 0);
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('kpi-invertido', formatCOP(totalInvertido));
    set('kpi-venta-potencial', formatCOP(valorVenta));
    set('kpi-ganancia-potencial', formatCOP(valorVenta - totalInvertido));
    set('kpi-ganancia-realizada', formatCOP(gananciaReal));
    set('kpi-stock', enStock);
    set('kpi-ventas-total', formatCOP(gananciaReal));

    const bd = $('kpi-proveedores-breakdown');
    if (bd) {
        const keys = Object.keys(provStats);
        bd.innerHTML = keys.length === 0 ? '<p style="color:var(--text-muted);">Sin inventario.</p>'
            : keys.map(pid => {
                const prov = providers.find(p => p.id === pid);
                const s = provStats[pid];
                return `<p><strong>${prov ? prov.nombre : 'Sin asignar'}:</strong> ${s.pares} pares · Inv. ${formatCOP(s.invertido)} · Venta ${formatCOP(s.venta)}</p>`;
            }).join('');
    }
}

// ==========================================
// VENTAS LOG
// ==========================================
function renderSales() {
    const list = $('ventas-list');
    if (!list) return;
    if (ventas.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Sin ventas aún. 📊</p>';
        return;
    }
    let html = `<table style="width:100%;border-collapse:collapse;min-width:550px;">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--border-color);">
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Fecha</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Tenis</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Talla</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Proveedor</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Venta</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Ganancia</th>
        </tr></thead><tbody>`;
    ventas.forEach(v => {
        html += `<tr style="border-bottom:1px solid #222;">
            <td style="padding:0.7rem;font-size:0.8rem;color:var(--text-muted);">${formatDate(v.fecha)}</td>
            <td style="padding:0.7rem;font-weight:600;">${v.nombreProducto} <small style="color:var(--neon-green);">(${v.marca})</small></td>
            <td style="padding:0.7rem;"><span class="size-badge">${v.talla}</span></td>
            <td style="padding:0.7rem;font-size:0.85rem;">${v.proveedor}</td>
            <td style="padding:0.7rem;">${formatCOP(v.precioVenta)}</td>
            <td style="padding:0.7rem;color:${v.ganancia >= 0 ? 'var(--neon-green)' : '#ff3333'};font-weight:bold;">${formatCOP(v.ganancia)}</td>
        </tr>`;
    });
    list.innerHTML = html + '</tbody></table>';
}

// ==========================================
// PROMOCIONES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    $('btn-generate-promos')?.addEventListener('click', generateRandomPromos);
});

async function generateRandomPromos() {
    if (!confirm('¿Seguro? Esto reemplazará las promociones actuales con 16 tenis al azar.')) return;
    const btn = $('btn-generate-promos');
    btn.disabled = true; btn.textContent = 'Generando...';
    
    try {
        const batch = db.batch();
        // Quitar promos actuales
        products.filter(p => p.enPromocion).forEach(p => {
            batch.update(db.collection('productos').doc(p.id), { enPromocion: false, descuento: 0 });
        });
        
        // Seleccionar 16 con stock al azar
        let available = products.filter(p => getTotalStock(p) > 0);
        let shuffled = available.sort(() => 0.5 - Math.random());
        let selected = shuffled.slice(0, 16);
        
        selected.forEach(p => {
            const r = Math.random();
            let desc = 10;
            if (r > 0.9) desc = 20;
            else if (r > 0.7) desc = 15;
            
            batch.update(db.collection('productos').doc(p.id), { enPromocion: true, descuento: desc });
        });
        
        await batch.commit();
        alert('¡Nuevas promociones generadas! 🔥');
    } catch(e) { alert('Error: ' + e.message); }
    
    btn.disabled = false; btn.textContent = '🎲 Generar 16 Promos al Azar Ahora';
}

function renderAdminPromos() {
    const list = $('promos-list');
    if (!list) return;
    
    const promos = products.filter(p => p.enPromocion);
    if (promos.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay promociones fijadas. La tienda mostrará 16 al azar automáticamente.</p>';
        return;
    }
    
    list.innerHTML = promos.map(p => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${p.nombre} (${p.marca})</strong>
                <span>PVP: ${formatCOP(p.precioVenta)} | <span style="color:var(--neon-green)">-${p.descuento}% OFF</span> = ${formatCOP(p.precioVenta - (p.precioVenta * p.descuento / 100))}</span>
            </div>
            <div class="list-actions">
                <button class="btn-action delete" onclick="removePromo('${p.id}')">Quitar Promo</button>
            </div>
        </div>
    `).join('');
}

window.removePromo = async id => {
    try { await db.collection('productos').doc(id).update({ enPromocion: false, descuento: 0 }); }
    catch(e) { alert('Error: ' + e.message); }
};

// ==========================================
// HELPERS
// ==========================================
function $(id) { return document.getElementById(id); }
function formatCOP(n) { return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts), pad = v => String(v).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function getTotalStock(prod) {
    if (!prod?.tallas) return 0;
    return Object.values(prod.tallas).reduce((s, q) => s + (parseInt(q) || 0), 0);
}
