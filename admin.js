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
let creditos = [];
let transacciones = [];
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

    db.collection('creditos').onSnapshot(snap => {
        creditos = [];
        snap.forEach(doc => creditos.push({ id: doc.id, ...doc.data() }));
        creditos.sort((a, b) => (b.fechaVenta || 0) - (a.fechaVenta || 0));
        if (typeof renderCreditos === 'function') renderCreditos();
        if (typeof updateClientDatalist === 'function') updateClientDatalist();
        renderDashboard();
    }, err => { console.error('Error cargando creditos:', err); });
    db.collection('transacciones').orderBy('fecha', 'desc').onSnapshot(snap => {
        transacciones = [];
        snap.forEach(doc => transacciones.push({ id: doc.id, ...doc.data() }));
        if (typeof renderCaja === 'function') renderCaja();
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
window.currentPhotos = [];

window.renderPhotosGrid = function() {
    const grid = $('fotos-preview-grid');
    if (!grid) return;
    grid.innerHTML = currentPhotos.map((url, idx) => `
        <div style="position:relative; display:inline-block;">
            <img src="${url}" style="width:70px; height:70px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid #333;">
            <button type="button" onclick="removePhoto(${idx})" style="position:absolute; top:-5px; right:-5px; background:red; color:#fff; border-radius:50%; width:20px; height:20px; border:none; cursor:pointer; font-size:12px; font-weight:bold;">X</button>
        </div>
    `).join('');
};

window.removePhoto = function(idx) {
    currentPhotos.splice(idx, 1);
    renderPhotosGrid();
};

function initPhotoUpload() {
    const fileInput = $('prod-foto-file');
    const linkInput = $('prod-foto-link');
    const btnAddLink = $('btn-add-link');

    if (fileInput) {
        fileInput.addEventListener('change', async e => {
            const files = Array.from(e.target.files);
            const label = document.querySelector('label[for="prod-foto-file"]');
            const oldLabel = label ? label.innerHTML : '';
            
            if (label) label.innerHTML = '⏳ Subiendo fotos a Storage...';

            for (let file of files) {
                try {
                    // Seguimos comprimiendo para cuidar los 5GB del plan gratis
                    const compressedBase64 = await compressImage(file, 800, 0.75);
                    
                    // Subir a Firebase Storage
                    const ext = file.name.split('.').pop() || 'jpg';
                    const fileName = Date.now() + '_' + Math.random().toString(36).substring(7) + '.' + ext;
                    const storageRef = firebase.storage().ref('productos/' + fileName);
                    
                    const snapshot = await storageRef.putString(compressedBase64, 'data_url');
                    const downloadUrl = await snapshot.ref.getDownloadURL();
                    
                    currentPhotos.push(downloadUrl);
                } catch (err) {
                    console.error("Error subiendo a Storage:", err);
                    alert("Error al subir imagen a Storage.\n\n" + err.message + "\n\nNOTA: Asegúrate de haber entrado a Firebase Console > Storage > Comenzar (en Modo Prueba) para habilitar el servicio.");
                }
            }
            
            if (label) label.innerHTML = oldLabel || '📸 Elegir fotos (celular/galería)';
            renderPhotosGrid();
            fileInput.value = ''; // reset
        });
    }

    if (btnAddLink && linkInput) {
        btnAddLink.addEventListener('click', () => {
            const val = linkInput.value.trim();
            if (val) {
                currentPhotos.push(val);
                renderPhotosGrid();
                linkInput.value = '';
            }
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

        const tallasBodega = {};
        const tallasProveedor = {};
        const tallas = {}; // Combined for public store

        document.querySelectorAll('#size-stock-grid-bodega .size-stock-item.active').forEach(item => {
            const size = item.dataset.size;
            const qty = parseInt(item.querySelector('.size-input')?.value) || 1;
            if (qty > 0) { tallasBodega[size] = qty; tallas[size] = (tallas[size] || 0) + qty; }
        });

        document.querySelectorAll('#size-stock-grid-proveedor .size-stock-item.active').forEach(item => {
            const size = item.dataset.size;
            const qty = parseInt(item.querySelector('.size-input')?.value) || 1;
            if (qty > 0) { tallasProveedor[size] = qty; tallas[size] = (tallas[size] || 0) + qty; }
        });

        if (Object.keys(tallas).length === 0) { alert('Activa al menos una talla en bodega o proveedor.'); return; }
        if (!$('prod-proveedor').value) { alert('Selecciona el proveedor.'); return; }

        const btn = $('btn-save-prod');
        btn.disabled = true; btn.textContent = 'Guardando...';

        const data = {
            proveedorId: $('prod-proveedor').value,
            codigo: $('prod-ref') ? $('prod-ref').value.trim() : '',
            nombre: $('prod-nombre').value.trim(),
            marca: $('prod-marca').value,
            genero: $('prod-genero').value,
            color: $('prod-color')?.value.trim() || '',
            fotos: currentPhotos.slice(),
            foto: currentPhotos.length > 0 ? currentPhotos[0] : '',
            tallasBodega,
            tallasProveedor,
            tallas,
            costoProveedor: parseFloat($('prod-costo-prov').value) || 0,
            costoEnvio: parseFloat($('prod-costo-envio').value) || 0,
            precioVenta: parseFloat($('prod-precio-venta').value) || 0
        };

        if (!editingProductId) {
            data.vendidos = 0;
            data.fechaCreacion = Date.now();
        }

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

function createSizeGrid(gridId) {
    const grid = $(gridId);
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

function initSizeGrid() {
    createSizeGrid('size-stock-grid-bodega');
    createSizeGrid('size-stock-grid-proveedor');
}

function resetProductForm() {
    $('form-producto')?.reset();
    editingProductId = null;
    $('form-product-title').textContent = 'Agregar Tenis (Carga Rápida)';
    $('btn-save-prod').textContent = 'Guardar Producto';
    $('btn-cancel-edit').classList.add('hidden');
    
    currentPhotos = [];
    renderPhotosGrid();
    
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
        
        const formatSizes = (dict, icon) => Object.entries(dict || {}).filter(([, q]) => q > 0)
            .map(([t, q]) => `<span class="size-badge">${t} (${q})</span>`).join(' ') || '-';
            
        const retroStock = (!prod.tallasBodega && !prod.tallasProveedor) ? prod.tallas : null;
        
        let tallasHtml = '';
        if (retroStock) {
            tallasHtml = `<span>🚚 Prov:</span> ${formatSizes(retroStock, '')}`;
        } else {
            const hasBod = Object.values(prod.tallasBodega || {}).some(q => q>0);
            const hasProv = Object.values(prod.tallasProveedor || {}).some(q => q>0);
            if (hasBod) tallasHtml += `<span style="color:var(--neon-green)">📦 Bod:</span> ${formatSizes(prod.tallasBodega)} `;
            if (hasProv) tallasHtml += `<span style="color:#aaa">🚚 Prov:</span> ${formatSizes(prod.tallasProveedor)}`;
            if (!hasBod && !hasProv) tallasHtml = 'Sin tallas';
        }
            
        let mainPhoto = (prod.fotos && prod.fotos.length > 0) ? prod.fotos[0] : (prod.foto || '');

        return `<div class="list-item" style="flex-wrap:wrap; gap:0.8rem;">
            <div style="display:flex; gap:0.8rem; align-items:center; flex:1; min-width:180px;">
                ${mainPhoto ? `<img src="${mainPhoto}" style="width:50px;height:50px;object-fit:cover;border-radius:var(--radius-sm);" onerror="this.alt='👟';">` : `<div style="width:50px;height:50px;background:#222;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">👟</div>`}
                <div class="list-item-info">
                    <strong>${prod.codigo ? `<span style="color:var(--neon-green)">[${prod.codigo}]</span> ` : ''}${prod.nombre} ${isSoldOut ? '<span style="color:#ff3333;font-size:0.8em;">[AGOTADO]</span>' : ''}</strong>
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
    if($('prod-ref')) $('prod-ref').value = prod.codigo || '';
    $('prod-nombre').value = prod.nombre || '';
    $('prod-marca').value = prod.marca || 'Nike';
    $('prod-genero').value = prod.genero || 'Unisex';
    $('prod-color').value = prod.color || '';
    $('prod-costo-prov').value = prod.costoProveedor || 0;
    $('prod-costo-envio').value = prod.costoEnvio || 0;
    $('prod-precio-venta').value = prod.precioVenta || 0;
    
    currentPhotos = prod.fotos || (prod.foto ? [prod.foto] : []);
    renderPhotosGrid();
    
    document.querySelectorAll('#size-stock-grid-bodega .size-stock-item').forEach(item => {
        const size = item.dataset.size, input = item.querySelector('.size-input');
        if (prod.tallasBodega?.[size] > 0) { item.classList.add('active'); input.disabled = false; input.value = prod.tallasBodega[size]; }
        else { item.classList.remove('active'); input.disabled = true; input.value = 1; }
    });

    document.querySelectorAll('#size-stock-grid-proveedor .size-stock-item').forEach(item => {
        const size = item.dataset.size, input = item.querySelector('.size-input');
        // Retro-compatibilidad: si no existe tallasProveedor ni tallasBodega, se asume que las tallas antiguas están en Proveedor
        const retroQty = (!prod.tallasBodega && !prod.tallasProveedor && prod.tallas?.[size]) ? prod.tallas[size] : 0;
        const finalQty = prod.tallasProveedor?.[size] || retroQty;
        
        if (finalQty > 0) { item.classList.add('active'); input.disabled = false; input.value = finalQty; }
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
    $('sell-metodo-select')?.addEventListener('change', e => {
        const isCredito = e.target.value === 'credito';
        const fields = $('sell-credito-fields');
        if (fields) {
            if (isCredito) fields.classList.remove('hidden');
            else fields.classList.add('hidden');
        }
    });
}

window.promptSell = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    currentSoldProduct = prod;
    $('sell-product-name').textContent = `${prod.nombre} (${prod.marca})`;
    
    // Convert legacy tallas to Proveedor if missing
    if (!prod.tallasBodega && !prod.tallasProveedor && prod.tallas) {
        prod.tallasProveedor = prod.tallas;
        prod.tallasBodega = {};
    }
    prod.tallasBodega = prod.tallasBodega || {};
    prod.tallasProveedor = prod.tallasProveedor || {};

    const origenSelect = $('sell-origen-select');
    const sizeSelect = $('sell-size-select');
    
    const updateSizeOptions = () => {
        const origen = origenSelect.value;
        const sourceDict = origen === 'bodega' ? prod.tallasBodega : prod.tallasProveedor;
        sizeSelect.innerHTML = '<option value="">Selecciona talla...</option>' +
            Object.entries(sourceDict).filter(([, q]) => q > 0)
                .map(([t, q]) => `<option value="${t}">Talla ${t} (${q} en stock)</option>`).join('');
    };
    
    origenSelect.onchange = updateSizeOptions;
    // Default to Bodega if it has any stock, otherwise Proveedor
    const hasBodega = Object.values(prod.tallasBodega).some(q => q > 0);
    origenSelect.value = hasBodega ? 'bodega' : 'proveedor';
    updateSizeOptions();

    $('sell-modal').classList.remove('hidden');
};

async function confirmSale() {
    const select = $('sell-size-select');
    const origen = $('sell-origen-select').value;
    const metodo = $('sell-metodo-select')?.value || 'contado';
    if (!select?.value || !currentSoldProduct) { alert('Selecciona la talla vendida.'); return; }
    
    let clienteNombre = '', clienteTelefono = '', cuotasCount = 1, frecuenciaDias = 15, abonoInicial = 0;
    if (metodo === 'credito') {
        clienteNombre = $('sell-cliente-nombre').value.trim();
        clienteTelefono = $('sell-cliente-telefono').value.trim();
        cuotasCount = parseInt($('sell-credito-cuotas').value) || 1;
        frecuenciaDias = parseInt($('sell-credito-frecuencia').value) || 15;
        abonoInicial = parseFloat($('sell-credito-abono').value) || 0;
        
        if (!clienteNombre || !clienteTelefono) {
            alert('Debes ingresar el nombre y teléfono del cliente.');
            return;
        }
    }

    const size = select.value, prod = currentSoldProduct;
    const sourceDict = origen === 'bodega' ? prod.tallasBodega : prod.tallasProveedor;
    
    if (!sourceDict[size] || sourceDict[size] <= 0) { alert('Sin stock en ' + origen); return; }

    sourceDict[size] -= 1;
    if (sourceDict[size] === 0) delete sourceDict[size];
    
    prod.tallas = prod.tallas || {};
    if (prod.tallas[size] && prod.tallas[size] > 0) {
        prod.tallas[size] -= 1;
        if (prod.tallas[size] === 0) delete prod.tallas[size];
    }

    const prov = providers.find(p => p.id === prod.proveedorId);
    const costoTotal = (prod.costoProveedor || 0) + (prod.costoEnvio || 0);
    const ganancia = (prod.precioVenta || 0) - costoTotal;
    const now = Date.now();

    try {
        const batch = db.batch();
        
        const ventaRef = db.collection('ventas').doc();
        batch.set(ventaRef, {
            productoId: prod.id, nombreProducto: prod.nombre, marca: prod.marca,
            talla: size, precioVenta: prod.precioVenta, costoTotal, ganancia,
            proveedor: prov ? prov.nombre : 'Local', 
            origen: origen,
            metodo: metodo,
            fecha: now
        });
        
        const prodRef = db.collection('productos').doc(prod.id);
        batch.update(prodRef, { 
            tallasBodega: prod.tallasBodega,
            tallasProveedor: prod.tallasProveedor,
            tallas: prod.tallas, 
            vendidos: (prod.vendidos || 0) + 1 
        });

        if (metodo === 'credito') {
            const saldoRestante = prod.precioVenta - abonoInicial;
            const montoPorCuota = Math.round(saldoRestante / cuotasCount);
            
            const cuotasArray = [];
            for (let i = 1; i <= cuotasCount; i++) {
                cuotasArray.push({
                    numero: i,
                    fechaVencimiento: now + (frecuenciaDias * 24 * 60 * 60 * 1000 * i),
                    monto: montoPorCuota,
                    pagado: false,
                    fechaPago: null
                });
            }

            const creditoRef = db.collection('creditos').doc();
            batch.set(creditoRef, {
                clienteNombre,
                clienteTelefono,
                productoId: prod.id,
                nombreProducto: prod.nombre,
                precioTotal: prod.precioVenta,
                costoTotal: costoCalc,
                abonoInicial,
                saldoPendiente: saldoRestante,
                cuotas: cuotasArray,
                fechaVenta: now,
                estado: 'activo'
            });
        }
        
        // Generar transacciones automáticas
        if (metodo === 'contado') {
            batch.set(db.collection('transacciones').doc(), {
                tipo: 'ingreso', concepto: 'Venta Contado: ' + prod.nombre, monto: Number(precioVendido), fecha: now, refId: ventaRef.id
            });
        } else if (metodo === 'credito' && abonoInicial > 0) {
            batch.set(db.collection('transacciones').doc(), {
                tipo: 'ingreso', concepto: 'Abono Inicial Crédito: ' + prod.nombre, monto: Number(abonoInicial), fecha: now, refId: ventaRef.id
            });
        }
        
        if (origen === 'proveedor') {
            batch.set(db.collection('transacciones').doc(), {
                tipo: 'egreso', concepto: 'Costo Proveedor (Sobre pedido): ' + prod.nombre, monto: Number(costoCalc), fecha: now, refId: ventaRef.id
            });
        }
        await batch.commit();
        
        $('sell-modal').classList.add('hidden');
        currentSoldProduct = null;
        
        if (metodo === 'credito') {
            $('sell-cliente-nombre').value = '';
            $('sell-cliente-telefono').value = '';
            $('sell-credito-abono').value = '0';
        }
        
        alert(`¡Venta registrada (${metodo})! 🎉`);
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
    let invertidoBodega = 0, ventaBodega = 0, stockBodegaTotal = 0, stockProvTotal = 0;
    const provStats = {};

    products.forEach(p => {
        const stockBodega = Object.values(p.tallasBodega || {}).reduce((s, c) => s + c, 0);
        // Retro-compat: if missing both, treat 'tallas' as Proveedor
        const retroStock = (!p.tallasBodega && !p.tallasProveedor) ? getTotalStock(p) : 0;
        const stockProv = Object.values(p.tallasProveedor || {}).reduce((s, c) => s + c, 0) + retroStock;
        
        stockBodegaTotal += stockBodega;
        stockProvTotal += stockProv;

        if (stockBodega > 0) {
            const inv = ((p.costoProveedor || 0) + (p.costoEnvio || 0)) * stockBodega;
            const ven = (p.precioVenta || 0) * stockBodega;
            invertidoBodega += inv; 
            ventaBodega += ven;
        }

        const totalPares = stockBodega + stockProv;
        if (totalPares > 0) {
            const pid = p.proveedorId || 'x';
            if (!provStats[pid]) provStats[pid] = { invertido: 0, venta: 0, pares: 0 };
            const invTotal = ((p.costoProveedor || 0) + (p.costoEnvio || 0)) * totalPares;
            const venTotal = (p.precioVenta || 0) * totalPares;
            provStats[pid].invertido += invTotal; 
            provStats[pid].venta += venTotal; 
            provStats[pid].pares += totalPares;
        }
    });

    let gananciaReal = 0;
    let gananciaFlotante = 0;

    ventas.forEach(v => {
        if (v.metodo === 'credito') {
            const cred = (typeof creditos !== 'undefined' ? creditos : []).find(c => c.fechaVenta === v.fecha);
            if (cred && cred.estado === 'pagado') {
                gananciaReal += (v.ganancia || 0);
            } else {
                gananciaFlotante += (v.ganancia || 0);
            }
        } else {
            gananciaReal += (v.ganancia || 0);
        }
    });

    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('kpi-invertido', formatCOP(invertidoBodega));
    set('kpi-venta-potencial', formatCOP(ventaBodega));
    set('kpi-ganancia-potencial', formatCOP(ventaBodega - invertidoBodega));
    set('kpi-ganancia-realizada', formatCOP(gananciaReal));
    set('kpi-ganancia-flotante', formatCOP(gananciaFlotante));
    set('kpi-stock-bodega', stockBodegaTotal);
    set('kpi-stock-prov', stockProvTotal);
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
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Origen</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Proveedor</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Venta</th>
            <th style="padding:0.7rem;color:var(--text-muted);font-size:0.8rem;">Ganancia</th><th style="padding:0.7rem;"></th>
        </tr></thead><tbody>`;
    ventas.forEach(v => {
        const origenBadge = v.origen === 'bodega' ? '📦 Bodega' : (v.origen === 'proveedor' ? '🚚 Prov' : '📦 Bodega');
        html += `<tr style="border-bottom:1px solid #222;">
            <td style="padding:0.7rem;font-size:0.8rem;color:var(--text-muted);">${formatDate(v.fecha)}</td>
            <td style="padding:0.7rem;font-weight:600;">${v.nombreProducto} <small style="color:var(--neon-green);">(${v.marca})</small></td>
            <td style="padding:0.7rem;"><span class="size-badge">${v.talla}</span></td>
            <td style="padding:0.7rem;font-size:0.85rem;color:var(--neon-green)">${origenBadge}</td>
            <td style="padding:0.7rem;font-size:0.85rem;">${v.proveedor}</td>
            <td style="padding:0.7rem;">${formatCOP(v.precioVenta)}</td>
            <td style="padding:0.7rem;color:${v.ganancia >= 0 ? 'var(--neon-green)' : '#ff3333'};font-weight:bold;">${formatCOP(v.ganancia)}</td>            <td style="padding:0.7rem;text-align:center;"><button onclick="deleteVenta('${v.id}')" style="background:none;border:none;color:#ff3333;cursor:pointer;font-size:1.1rem;" title="Eliminar Venta">❌</button></td>
        </tr>`;
    });
    list.innerHTML = html + '</tbody></table>';
}

// ==========================================
// PROMOCIONES
// ==========================================
let storeConfig = { promoLimit: 8, promoRotation: 'random' };

async function loadPromoConfig() {
    try {
        const doc = await db.collection('config').doc('store').get();
        if (doc.exists) {
            storeConfig = { ...storeConfig, ...doc.data() };
        }
        const limitEl = document.getElementById('promo-limit');
        const rotEl = document.getElementById('promo-rotation');
        if (limitEl) limitEl.value = storeConfig.promoLimit || 8;
        if (rotEl) rotEl.value = storeConfig.promoRotation || 'random';
    } catch(e) { console.error("Error loading config", e); }
}

setTimeout(loadPromoConfig, 1500);

document.addEventListener('click', async (e) => {
    if (e.target.id === 'btn-save-promo-config') {
        const limit = parseInt(document.getElementById('promo-limit').value) || 8;
        const rot = document.getElementById('promo-rotation').value;
        try {
            await db.collection('config').doc('store').set({ promoLimit: limit, promoRotation: rot }, { merge: true });
            alert('Ajustes guardados correctamente.');
        } catch(err) {
            alert('Error al guardar ajustes.');
            console.error(err);
        }
    }
    
    if (e.target.id === 'btn-add-promo') {
        const id = document.getElementById('bulk-promo-select').value;
        const desc = parseInt(document.getElementById('bulk-promo-desc').value) || 0;
        const tipo = document.getElementById('bulk-promo-tipo').value || 'percentage';
        if (!id) return alert('Selecciona un producto');
        try {
            await db.collection('productos').doc(id).update({ enPromocion: true, descuento: desc, tipoPromocion: tipo });
        } catch(err) { alert('Error: ' + err.message); }
    }
});

function renderAdminPromos() {
    const select = document.getElementById('bulk-promo-select');
    if (select) {
        const noPromos = products.filter(p => !p.enPromocion);
        select.innerHTML = noPromos.map(p => `<option value="${p.id}">${p.nombre} (${p.marca || 'Otro'})</option>`).join('');
    }

    const list = document.getElementById('active-promos-list');
    const empty = document.getElementById('active-promos-empty');
    if (!list || !empty) return;

    const activePromos = products.filter(p => p.enPromocion);
    
    if (activePromos.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        list.innerHTML = activePromos.map(p => {
            let pType = p.tipoPromocion || 'percentage';
            let desc = p.descuento || 0;
            return `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;">
                <div style="position:relative; width: 100%; aspect-ratio: 1/1;">
                    <img src="${p.foto || (p.fotos ? p.fotos[0] : '')}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div>
                        <span style="font-size:0.8rem; background:var(--neon-green); color:#000; padding:2px 6px; border-radius:4px; font-weight:bold;">${p.marca}</span>
                        ${p.codigo ? `<span style="font-size:0.8rem; background:#333; color:#fff; padding:2px 6px; border-radius:4px; margin-left:5px;">${p.codigo}</span>` : ''}
                    </div>
                    <strong style="font-size:1.1rem; line-height:1.2;">${p.nombre}</strong>
                    
                    <div style="margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem;">
                        <select class="form-input" onchange="updatePromoInline('${p.id}', 'tipoPromocion', this.value)" style="padding:0.4rem; font-size:0.9rem;">
                            <option value="percentage" ${pType === 'percentage' ? 'selected' : ''}>% Descuento</option>
                            <option value="2x1" ${pType === '2x1' ? 'selected' : ''}>2x1</option>
                            <option value="freeshipping" ${pType === 'freeshipping' ? 'selected' : ''}>Envío Gratis</option>
                            <option value="clearance" ${pType === 'clearance' ? 'selected' : ''}>Remate</option>
                        </select>
                        
                        <input type="number" class="form-input" onchange="updatePromoInline('${p.id}', 'descuento', parseInt(this.value) || 0)" value="${desc}" style="padding:0.4rem; font-size:0.9rem; display:${pType === 'percentage' || pType === 'clearance' ? 'block' : 'none'};" placeholder="% Descuento">
                        
                        <button class="btn-primary" style="background:#ff3333; padding:0.4rem; margin-top:0.2rem;" onclick="removePromo('${p.id}')">Quitar Promo</button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }
}

window.updatePromoInline = async (id, field, value) => {
    try {
        await db.collection('productos').doc(id).update({ [field]: value });
    } catch(e) {
        alert('Error: ' + e.message);
    }
};

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

// ==========================================
// CREDITOS
// ==========================================
// creditos ya declarado arriba
let currentAbonoCredito = null;

window.renderCreditos = function() {
    const list = $('creditos-list');
    const totalEl = $('kpi-creditos-total');
    const activosEl = $('kpi-creditos-activos');
    const moraEl = $('kpi-creditos-mora');
    
    if (!list) return;

    let totalPorCobrar = 0;
    let activos = 0;
    let totalMora = 0;
    const now = Date.now();

    const activosList = creditos.filter(c => c.estado === 'activo');
    activosList.forEach(c => {
        totalPorCobrar += (c.saldoPendiente || 0);
        activos++;
        const nextCuota = c.cuotas.find(q => !q.pagado);
        if (nextCuota && nextCuota.fechaVencimiento < now) {
            totalMora += nextCuota.monto;
        }
    });

    if (totalEl) totalEl.textContent = formatCOP(totalPorCobrar);
    if (activosEl) activosEl.textContent = activos;
    if (moraEl) moraEl.textContent = formatCOP(totalMora);

    if (activosList.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay créditos activos. 🎉</p>';
        return;
    }

    list.innerHTML = activosList.map(c => {
        const nextCuota = c.cuotas.find(q => !q.pagado);
        const totalPagado = (c.precioTotal || 0) - (c.saldoPendiente || 0);
        let statusHtml = '';
        let statusMsg = '';
        
        if (nextCuota) {
            const daysDiff = Math.floor((nextCuota.fechaVencimiento - now) / (1000 * 60 * 60 * 24));
            if (daysDiff < 0) {
                statusHtml = `<span style="color:#ff3333; font-weight:bold;">Vencido (Mora de ${Math.abs(daysDiff)} días)</span>`;
                statusMsg = `Hola ${c.clienteNombre}, tu cuota de ${formatCOP(nextCuota.monto)} por tus ${c.nombreProducto} venció hace ${Math.abs(daysDiff)} días. Por favor realiza el pago lo antes posible para evitar recargos por mora.`;
            } else if (daysDiff <= 3) {
                statusHtml = `<span style="color:#ffaa00;">Próximo a vencer (${daysDiff} días)</span>`;
                statusMsg = `Hola ${c.clienteNombre}, te recordamos que tu próxima cuota de ${formatCOP(nextCuota.monto)} por tus ${c.nombreProducto} vence el ${formatDate(nextCuota.fechaVencimiento).split(' ')[0]}. ¡Gracias por tu puntualidad!`;
            } else if (nextCuota.numero === 1) {
                statusHtml = `<span style="color:#00e5ff;">Inicio de Crédito</span>`;
                statusMsg = `Hola ${c.clienteNombre}, gracias por tu compra. Te recordamos que tu primera cuota de ${formatCOP(nextCuota.monto)} vence el ${formatDate(nextCuota.fechaVencimiento).split(' ')[0]}.`;
            } else {
                statusHtml = `<span style="color:var(--neon-green);">Cuotas al día</span>`;
                statusMsg = `Hola ${c.clienteNombre}, un saludo. Solo para tenerlo en el radar, tu próxima cuota de ${formatCOP(nextCuota.monto)} vence el ${formatDate(nextCuota.fechaVencimiento).split(' ')[0]}.`;
            }
        }

        const encodedMsg = encodeURIComponent(statusMsg);
        
        const costo = c.costoTotal || 0;
        let roiHtml = '';
        if (costo > 0) {
            if (totalPagado < costo) {
                roiHtml = `<span style="background:#ff333333;color:#ff3333;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;" title="Aún no recuperas la inversión">🔴 Déficit (Falta ${formatCOP(costo - totalPagado)} para empatar)</span>`;
            } else if (totalPagado === costo) {
                roiHtml = `<span style="background:#ffaa0033;color:#ffaa00;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;" title="Inversión recuperada">🟡 Equilibrio Alcanzado</span>`;
            } else {
                roiHtml = `<span style="background:#00ff8833;color:var(--neon-green);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;" title="Todo lo nuevo es ganancia">🟢 Ganancia (+${formatCOP(totalPagado - costo)})</span>`;
            }
        }

        return `<div class="list-item" style="flex-wrap:wrap; gap:0.8rem; align-items:flex-start;">
            <div style="flex:1; min-width:200px;">
                <h4 style="margin:0; color:var(--neon-green);">${c.clienteNombre}</h4>
                <p style="margin:0.2rem 0; font-size:0.85rem;">📞 ${c.clienteTelefono}</p>
                <p style="margin:0; font-size:0.9rem;"><strong>Tenis:</strong> ${c.nombreProducto}</p>
                <p style="margin:0; font-size:0.9rem;"><strong>Deuda Restante:</strong> ${formatCOP(c.saldoPendiente)} de ${formatCOP(c.precioTotal)}</p>
                <p style="margin:0.2rem 0 0 0; font-size:0.85rem;">Estado: ${statusHtml}</p>
                <div style="margin-top:0.5rem;">${roiHtml}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
                <button class="btn-action sell" onclick="promptAbono('${c.id}')">💰 Registrar Abono</button>                <button class="btn-action" style="background:#ff3333; color:white; border:none;" onclick="deleteCredito('${c.id}')">🗑️ Anular Crédito</button>
                <a href="https://wa.me/57${c.clienteTelefono}?text=${encodedMsg}" target="_blank" class="btn-action" style="background:#25D366; color:#000; text-decoration:none; text-align:center; padding:0.4rem 1rem;">💬 Enviar WhatsApp</a>
            </div>
        </div>`;
    }).join('');
};

window.promptAbono = function(creditoId) {
    const cred = creditos.find(c => c.id === creditoId);
    if (!cred) return;
    currentAbonoCredito = cred;
    
    $('abono-cliente-nombre').textContent = cred.clienteNombre + " - " + cred.nombreProducto;
    
    const list = $('abono-cuotas-list');
    list.innerHTML = cred.cuotas.map((q, idx) => {
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; border-bottom:1px solid #333;">
            <div>
                <strong>Cuota ${q.numero}</strong> <br>
                <small>${formatDate(q.fechaVencimiento).split(' ')[0]} - ${formatCOP(q.monto)}</small>
            </div>
            <div>
                ${q.pagado ? 
                    '<span style="color:var(--neon-green)">Pagado</span>' : 
                    `<button class="btn-action sell" style="padding:0.3rem 0.8rem;" onclick="confirmAbono(${idx})">Pagar</button>`
                }
            </div>
        </div>`;
    }).join('');
    
    $('abono-modal').classList.remove('hidden');
};

$('abono-modal-close')?.addEventListener('click', () => $('abono-modal').classList.add('hidden'));

window.confirmAbono = async function(cuotaIndex) {
    if (!currentAbonoCredito) return;
    const cred = currentAbonoCredito;
    const cuota = cred.cuotas[cuotaIndex];
    
    if (cuota.pagado) return;
    
    cuota.pagado = true;
    cuota.fechaPago = Date.now();
    
    cred.saldoPendiente -= cuota.monto;
    if (cred.saldoPendiente <= 0) {
        cred.saldoPendiente = 0;
        cred.estado = 'pagado';
    }
    
    try {
        const batch = db.batch();
        batch.update(db.collection('creditos').doc(cred.id), {
            cuotas: cred.cuotas,
            saldoPendiente: cred.saldoPendiente,
            estado: cred.estado
        });
        batch.set(db.collection('transacciones').doc(), {
            tipo: 'ingreso',
            concepto: 'Pago Cuota Crédito: ' + cred.nombreProducto + ' (' + cred.clienteNombre + ')',
            monto: cuota.monto,
            fecha: Date.now(),
            refId: cred.id
        });
        await batch.commit();
        alert('Pago registrado correctamente. ✅');
        $('abono-modal').classList.add('hidden');
    } catch(e) {
        alert('Error: ' + e.message);
    }
};

window.updateClientDatalist = function() {
    const dlNombres = $('dl-clientes-nombres');
    const dlTelefonos = $('dl-clientes-telefonos');
    if (!dlNombres || !dlTelefonos) return;

    // Get unique names and phones from creditos
    const nombres = new Set();
    const telefonos = new Set();
    // Also we can keep track of pairs so when they type name, we auto-fill phone!
    window.clientesDirectorio = {};

    creditos.forEach(c => {
        if (c.clienteNombre) nombres.add(c.clienteNombre);
        if (c.clienteTelefono) telefonos.add(c.clienteTelefono);
        if (c.clienteNombre && c.clienteTelefono) {
            window.clientesDirectorio[c.clienteNombre] = c.clienteTelefono;
            window.clientesDirectorio[c.clienteTelefono] = c.clienteNombre;
        }
    });

    dlNombres.innerHTML = Array.from(nombres).map(n => `<option value="${n}">`).join('');
    dlTelefonos.innerHTML = Array.from(telefonos).map(t => `<option value="${t}">`).join('');
};

// Auto-fill logic
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const inputNombre = $('sell-cliente-nombre');
        const inputTelefono = $('sell-cliente-telefono');
        
        if (inputNombre && inputTelefono) {
            inputNombre.addEventListener('change', (e) => {
                const val = e.target.value.trim();
                if (window.clientesDirectorio && window.clientesDirectorio[val]) {
                    inputTelefono.value = window.clientesDirectorio[val];
                }
            });
            inputTelefono.addEventListener('change', (e) => {
                const val = e.target.value.trim();
                if (window.clientesDirectorio && window.clientesDirectorio[val]) {
                    inputNombre.value = window.clientesDirectorio[val];
                }
            });
        }
    }, 1000);
});
window.deleteVenta = async id => {
    if (confirm('¿Estás seguro de eliminar este registro de venta? (Nota: el stock no se devolverá automáticamente, debes sumarlo manual en el producto)')) {
        try { await db.collection('ventas').doc(id).delete(); }
        catch (e) { alert('Error: ' + e.message); }
    }
};
window.deleteCredito = async id => {
    if (confirm('¿Estás seguro de anular y borrar este crédito por completo?')) {
        try { await db.collection('creditos').doc(id).delete(); }
        catch (e) { alert('Error: ' + e.message); }
    }
};


// ==========================================
// CAJA (FINANZAS)
// ==========================================
window.renderCaja = function() {
    const list = $('caja-list');
    const saldoEl = $('kpi-caja-saldo');
    const ingresosEl = $('kpi-caja-ingresos');
    const egresosEl = $('kpi-caja-egresos');
    
    if (!list) return;

    let saldo = 0, ingresos = 0, egresos = 0;
    
    // transacciones is already sorted descending by 'fecha' from Firestore listener
    let html = '';
    
    transacciones.forEach(t => {
        const monto = t.monto || 0;
        if (t.tipo === 'ingreso') {
            ingresos += monto;
            saldo += monto;
        } else {
            egresos += monto;
            saldo -= monto;
        }
        
        const color = t.tipo === 'ingreso' ? 'var(--neon-green)' : '#ff3333';
        const signo = t.tipo === 'ingreso' ? '+' : '-';
        
        html += `<tr style="border-bottom:1px solid #222;">
            <td style="padding:0.7rem;font-size:0.8rem;color:var(--text-muted);">${formatDate(t.fecha)}</td>
            <td style="padding:0.7rem;font-weight:600;">${t.concepto}</td>
            <td style="padding:0.7rem;color:${color};"><span class="badge" style="background:${color}22;color:${color}">${t.tipo.toUpperCase()}</span></td>
            <td style="padding:0.7rem;color:${color};font-weight:bold;">${signo}${formatCOP(monto)}</td>
            <td style="padding:0.7rem;text-align:center;">
                <button onclick="deleteTransaccion('${t.id}')" style="background:none;border:none;color:#ff3333;cursor:pointer;font-size:1.1rem;" title="Eliminar Movimiento">❌</button>
            </td>
        </tr>`;
    });

    if (transacciones.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay movimientos registrados.</td></tr>';
    } else {
        list.innerHTML = html;
    }

    if (saldoEl) saldoEl.textContent = formatCOP(saldo);
    if (ingresosEl) ingresosEl.textContent = formatCOP(ingresos);
    if (egresosEl) egresosEl.textContent = formatCOP(egresos);
};

window.deleteTransaccion = async function(id) {
    if (confirm('¿Estás seguro de eliminar este movimiento manual de caja?')) {
        try { await db.collection('transacciones').doc(id).delete(); }
        catch (e) { alert('Error: ' + e.message); }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    $('transaccion-modal-close')?.addEventListener('click', () => $('transaccion-modal').classList.add('hidden'));
    
    $('form-transaccion')?.addEventListener('submit', async e => {
        e.preventDefault();
        const tipo = $('trans-tipo').value;
        const concepto = $('trans-concepto').value.trim();
        const monto = parseInt($('trans-monto').value);
        
        try {
            await db.collection('transacciones').add({
                tipo,
                concepto,
                monto,
                fecha: Date.now(),
                manual: true
            });
            $('transaccion-modal').classList.add('hidden');
            $('form-transaccion').reset();
        } catch (err) {
            alert('Error guardando transacción: ' + err.message);
        }
    });
});
