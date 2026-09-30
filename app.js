/**
 * O'G YAM CREPS — Lógica con Firebase Firestore & Auth
 * 100% Gratis · Sincronización en tiempo real · Carga de fotos desde celular
 */

// ==========================================
// 1. CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyC0aguCa2fPrnOfheOrZV1oQe_1wQDOr50",
  authDomain: "og-yam-creps.firebaseapp.com",
  projectId: "og-yam-creps",
  storageBucket: "og-yam-creps.firebasestorage.app",
  messagingSenderId: "427327061733",
  appId: "1:427327061733:web:a946d60638411e63831e0c"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Habilitar persistencia offline si está disponible
db.enablePersistence().catch(err => {
    console.log("Persistencia offline no habilitada (múltiples pestañas o no soportado):", err.code);
});

// Constantes
const WHATSAPP_NUMBER = '573128663161';

// Estado de la app
let products = [];
let providers = [];
let ventas = [];
let currentUser = null;
let editingProductId = null;
let currentSoldProduct = null;

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initFirestoreListeners();
    initProductForm();
    initProviderForm();
    initSizeGrid();
    initStoreFilters();
    initModals();
    initPhotoUpload();
});

// ==========================================
// 3. AUTENTICACIÓN (ADMIN LOGIN / LOGOUT)
// ==========================================
function initAuth() {
    // Escuchar estado de sesión
    auth.onAuthStateChanged(user => {
        currentUser = user;
        const btnAdmin = $('nav-admin');
        const btnLogin = $('nav-login-btn');
        const btnLogout = $('nav-logout-btn');
        const syncStatus = $('sync-status');

        if (user) {
            // Usuario es Administrador
            if (btnAdmin) btnAdmin.classList.remove('hidden');
            if (btnLogout) btnLogout.classList.remove('hidden');
            if (btnLogin) btnLogin.classList.add('hidden');
            if (syncStatus) syncStatus.textContent = `● Admin activo (${user.email})`;
            
            // Cargar datos privados de Firestore
            listenPrivateData();
        } else {
            // Visitante / Cliente común
            if (btnAdmin) btnAdmin.classList.add('hidden');
            if (btnLogout) btnLogout.classList.add('hidden');
            if (btnLogin) btnLogin.classList.remove('hidden');
            if (syncStatus) syncStatus.textContent = '● Modo catálogo';
            
            // Si estaba en la vista admin, devolver a tienda
            const viewAdmin = $('view-admin');
            if (viewAdmin && !viewAdmin.classList.contains('hidden')) {
                switchView('tienda');
            }
        }
    });

    // Formulario de login
    const formLogin = $('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async e => {
            e.preventDefault();
            const email = $('login-email').value.trim();
            const password = $('login-password').value;
            const errorEl = $('login-error');
            const submitBtn = $('login-submit-btn');

            errorEl.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Ingresando...';

            try {
                await auth.signInWithEmailAndPassword(email, password);
                $('login-modal').classList.add('hidden');
                formLogin.reset();
                switchView('admin');
            } catch (err) {
                console.error("Error al iniciar sesión:", err);
                errorEl.style.display = 'block';
                if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    errorEl.textContent = 'Contraseña incorrecta.';
                } else if (err.code === 'auth/user-not-found') {
                    errorEl.textContent = 'No existe un usuario con este correo.';
                } else if (err.code === 'auth/invalid-email') {
                    errorEl.textContent = 'El correo electrónico no es válido.';
                } else {
                    errorEl.textContent = 'Error: ' + err.message;
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Ingresar al Panel';
            }
        });
    }

    // Botón de Cerrar Sesión
    const btnLogout = $('nav-logout-btn');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (confirm('¿Deseas cerrar la sesión del panel de administración?')) {
                await auth.signOut();
                switchView('tienda');
            }
        });
    }

    // Abrir modal de Login
    const openLogin = () => {
        $('login-modal').classList.remove('hidden');
        $('login-email').focus();
    };
    if ($('nav-login-btn')) $('nav-login-btn').addEventListener('click', openLogin);
    if ($('footer-admin-btn')) $('footer-admin-btn').addEventListener('click', openLogin);
}

// ==========================================
// 4. SINCRONIZACIÓN CON FIRESTORE
// ==========================================
function initFirestoreListeners() {
    // Escuchar colección pública 'productos' en tiempo real
    db.collection('productos').onSnapshot(snapshot => {
        products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        // Renderizar tienda y panel
        renderStoreProducts();
        if (currentUser) {
            renderAdminProducts();
            renderDashboard();
        }
    }, err => {
        console.error("Error al escuchar productos:", err);
    });
}

function listenPrivateData() {
    // Escuchar proveedores
    db.collection('proveedores').onSnapshot(snapshot => {
        providers = [];
        snapshot.forEach(doc => {
            providers.push({ id: doc.id, ...doc.data() });
        });
        renderProviders();
        populateProviderDropdown();
        renderAdminProducts();
        renderDashboard();
    }, err => console.error("Error proveedores:", err));

    // Escuchar ventas
    db.collection('ventas').orderBy('fecha', 'desc').onSnapshot(snapshot => {
        ventas = [];
        snapshot.forEach(doc => {
            ventas.push({ id: doc.id, ...doc.data() });
        });
        renderSales();
        renderDashboard();
    }, err => console.error("Error ventas:", err));
}

// ==========================================
// 5. NAVEGACIÓN Y VISTAS
// ==========================================
function initNavigation() {
    const btnTienda = $('nav-tienda');
    const btnAdmin = $('nav-admin');

    if (btnTienda) btnTienda.addEventListener('click', () => switchView('tienda'));
    if (btnAdmin) btnAdmin.addEventListener('click', () => {
        if (!currentUser) {
            $('login-modal').classList.remove('hidden');
        } else {
            switchView('admin');
        }
    });

    const brand = $('brand-logo');
    if (brand) {
        brand.style.cursor = 'pointer';
        brand.addEventListener('click', () => switchView('tienda'));
    }

    // Pestañas del admin
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
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
        if (btnAdmin) btnAdmin.classList.remove('active');
        renderStoreProducts();
    } else {
        if (!currentUser) {
            $('login-modal').classList.remove('hidden');
            return;
        }
        viewTienda.classList.add('hidden');
        viewAdmin.classList.remove('hidden');
        btnTienda.classList.remove('active');
        if (btnAdmin) btnAdmin.classList.add('active');
        populateProviderDropdown();
        renderAdminProducts();
        renderDashboard();
    }
}

function switchAdminTab(name) {
    document.querySelectorAll('.admin-section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));

    const section = $(`admin-${name}`);
    const btn = $(`tab-${name}`);
    if (section) { section.classList.add('active'); section.classList.remove('hidden'); }
    if (btn) btn.classList.add('active');

    if (name === 'productos') { renderAdminProducts(); renderDashboard(); }
    if (name === 'proveedores') renderProviders();
    if (name === 'ventas') renderSales();
}

// ==========================================
// 6. SUBIDA Y COMPRESIÓN DE FOTOS (100% GRATIS)
// ==========================================
function initPhotoUpload() {
    const fileInput = $('prod-foto-file');
    const urlInput = $('prod-foto');
    const preview = $('prod-foto-preview');
    const previewWrapper = $('preview-wrapper');
    const btnRemove = $('btn-remove-foto');

    // Al seleccionar imagen desde celular o PC
    if (fileInput) {
        fileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // Comprimir imagen a JPEG ultra liviano (~40-60KB)
                const compressedBase64 = await compressImage(file, 800, 0.75);
                urlInput.value = compressedBase64;
                preview.src = compressedBase64;
                previewWrapper.classList.remove('hidden');
            } catch (err) {
                console.error("Error comprimiendo imagen:", err);
                alert("No se pudo procesar la imagen seleccionada.");
            }
        });
    }

    // Al pegar una URL externa
    if (urlInput) {
        urlInput.addEventListener('input', () => {
            const val = urlInput.value.trim();
            if (val) {
                preview.src = val;
                previewWrapper.classList.remove('hidden');
            } else {
                previewWrapper.classList.add('hidden');
            }
        });
    }

    // Botón para quitar foto
    if (btnRemove) {
        btnRemove.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (urlInput) urlInput.value = '';
            if (preview) preview.src = '';
            previewWrapper.classList.add('hidden');
        });
    }
}

// Función para comprimir fotos del celular antes de guardar
function compressImage(file, maxWidth = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a JPEG optimizado
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ==========================================
// 7. GESTIÓN DE PRODUCTOS (CRUD EN FIRESTORE)
// ==========================================
function initProductForm() {
    const form = $('form-producto');
    if (!form) return;

    // Cálculo en vivo
    ['prod-costo-prov', 'prod-costo-envio', 'prod-precio-venta'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', calcLive);
    });

    // Cancelar edición
    const btnCancel = $('btn-cancel-edit');
    if (btnCancel) {
        btnCancel.addEventListener('click', resetProductForm);
    }

    // Guardar / Editar en Firestore
    form.addEventListener('submit', async e => {
        e.preventDefault();

        // Recoger tallas seleccionadas
        const tallas = {};
        document.querySelectorAll('.size-stock-item.active').forEach(item => {
            const size = item.dataset.size;
            const input = item.querySelector('.size-input');
            const qty = parseInt(input?.value) || 1;
            if (qty > 0) tallas[size] = qty;
        });

        if (Object.keys(tallas).length === 0) {
            alert('Debes activar al menos una talla con stock.');
            return;
        }

        const provId = $('prod-proveedor').value;
        if (!provId) {
            alert('Por favor selecciona el proveedor local.');
            return;
        }

        const btnSave = $('btn-save-prod');
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando en la nube...';

        const productoData = {
            proveedorId: provId,
            nombre: $('prod-nombre').value.trim(),
            marca: $('prod-marca').value,
            genero: $('prod-genero').value,
            color: $('prod-color')?.value.trim() || '',
            foto: $('prod-foto')?.value.trim() || '',
            tallas: tallas,
            costoProveedor: parseFloat($('prod-costo-prov').value) || 0,
            costoEnvio: parseFloat($('prod-costo-envio').value) || 0,
            precioVenta: parseFloat($('prod-precio-venta').value) || 0,
            vendidos: 0,
            fechaCreacion: Date.now()
        };

        try {
            if (editingProductId) {
                // Actualizar en Firestore
                const existing = products.find(p => p.id === editingProductId);
                if (existing) productoData.vendidos = existing.vendidos || 0;
                await db.collection('productos').doc(editingProductId).update(productoData);
                alert("¡Tenis actualizados correctamente!");
            } else {
                // Crear en Firestore
                await db.collection('productos').add(productoData);
                alert("¡Tenis publicados en la tienda con éxito!");
            }
            resetProductForm();
        } catch (err) {
            console.error("Error al guardar producto:", err);
            alert("Error al guardar: " + err.message);
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Guardar Producto en la Nube';
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

    $('form-product-title').textContent = 'Agregar Tenis (Carga Rápida)';
    $('btn-save-prod').textContent = 'Guardar Producto en la Nube';
    $('btn-cancel-edit').classList.add('hidden');

    // Reset preview
    $('preview-wrapper').classList.add('hidden');
    $('prod-foto-preview').src = '';

    // Reset tallas
    document.querySelectorAll('.size-stock-item').forEach(item => {
        item.classList.remove('active');
        const input = item.querySelector('.size-input');
        if (input) { input.disabled = true; input.value = 1; }
    });

    // Reset calc
    $('calc-costo-total').textContent = '$0';
    $('calc-ganancia').textContent = '$0';
    $('calc-ganancia').style.color = '';
    $('calc-margen').textContent = '0%';
    $('calc-margen').style.color = '';
}

function renderAdminProducts() {
    const list = $('productos-list');
    const countEl = $('admin-prod-count');
    if (!list) return;

    if (products.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Aún no tienes tenis agregados. ¡Agrega tu primer par arriba! 👟</p>';
        if (countEl) countEl.textContent = '0 pares';
        return;
    }

    let totalPairs = 0;
    products.forEach(p => totalPairs += getTotalStock(p));
    if (countEl) countEl.textContent = `${totalPairs} pares en stock`;

    const sorted = [...products].sort((a, b) => (b.fechaCreacion || 0) - (a.fechaCreacion || 0));

    list.innerHTML = sorted.map(prod => {
        const prov = providers.find(p => p.id === prod.proveedorId);
        const provName = prov ? prov.nombre : 'Proveedor sin asignar';
        const stock = getTotalStock(prod);
        const isSoldOut = stock === 0;

        const tallasHtml = Object.entries(prod.tallas || {})
            .filter(([, q]) => q > 0)
            .map(([t, q]) => `<span class="size-badge">${t} (${q})</span>`)
            .join(' ');

        return `
        <div class="list-item" style="flex-wrap:wrap; gap:0.8rem;">
            <div style="display:flex; gap:0.8rem; align-items:center; flex:1; min-width:200px;">
                ${prod.foto
                    ? `<img src="${prod.foto}" style="width:55px; height:55px; object-fit:cover; border-radius:var(--radius-sm);" onerror="this.src='';this.alt='👟';">`
                    : `<div style="width:55px; height:55px; background:#222; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; font-size:1.5rem;">👟</div>`}
                <div class="list-item-info">
                    <strong>${prod.nombre} ${isSoldOut ? '<span style="color:#ff3333; font-size:0.8em; margin-left:4px;">[AGOTADO]</span>' : ''}</strong>
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

    $('form-product-title').textContent = 'Editar Tenis: ' + prod.nombre;
    $('btn-save-prod').textContent = 'Actualizar Cambios';
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

    if (prod.foto) {
        $('prod-foto-preview').src = prod.foto;
        $('preview-wrapper').classList.remove('hidden');
    }

    // Restaurar tallas
    document.querySelectorAll('.size-stock-item').forEach(item => {
        const size = item.dataset.size;
        const input = item.querySelector('.size-input');
        if (prod.tallas && prod.tallas[size] > 0) {
            item.classList.add('active');
            input.disabled = false;
            input.value = prod.tallas[size];
        } else {
            item.classList.remove('active');
            input.disabled = true;
            input.value = 1;
        }
    });

    calcLive();
    window.scrollTo({ top: $('form-producto').offsetTop - 80, behavior: 'smooth' });
};

window.deleteProduct = async id => {
    if (confirm('¿Estás seguro de eliminar este modelo de tenis? Se borrará de la tienda.')) {
        try {
            await db.collection('productos').doc(id).delete();
        } catch (err) {
            console.error("Error al eliminar:", err);
            alert("Error al eliminar: " + err.message);
        }
    }
};

// ==========================================
// 8. REGISTRO DE VENTAS (DESCONTAR STOCK)
// ==========================================
window.promptSell = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    currentSoldProduct = prod;

    const modal = $('sell-modal');
    const nameEl = $('sell-product-name');
    const select = $('sell-size-select');

    if (nameEl) nameEl.textContent = `${prod.nombre} (${prod.marca})`;
    select.innerHTML = '<option value="">Selecciona la talla vendida...</option>' +
        Object.entries(prod.tallas || {})
            .filter(([, q]) => q > 0)
            .map(([t, q]) => `<option value="${t}">Talla ${t} (Stock disponible: ${q})</option>`)
            .join('');

    modal.classList.remove('hidden');
};

async function confirmSale() {
    const select = $('sell-size-select');
    if (!select || !select.value || !currentSoldProduct) {
        alert('Por favor selecciona la talla vendida.');
        return;
    }

    const size = select.value;
    const prod = currentSoldProduct;

    if (!prod.tallas[size] || prod.tallas[size] <= 0) {
        alert('No queda stock de esa talla.');
        return;
    }

    // Descontar stock
    prod.tallas[size] -= 1;
    if (prod.tallas[size] === 0) delete prod.tallas[size];
    const nuevosVendidos = (prod.vendidos || 0) + 1;

    const prov = providers.find(p => p.id === prod.proveedorId);
    const costoTotal = (prod.costoProveedor || 0) + (prod.costoEnvio || 0);
    const ganancia = (prod.precioVenta || 0) - costoTotal;

    const ventaData = {
        productoId: prod.id,
        nombreProducto: prod.nombre,
        marca: prod.marca,
        talla: size,
        precioVenta: prod.precioVenta,
        costoTotal,
        ganancia,
        proveedor: prov ? prov.nombre : 'Proveedor local',
        fecha: Date.now()
    };

    try {
        // Guardar venta y actualizar producto en Firestore
        await db.collection('ventas').add(ventaData);
        await db.collection('productos').doc(prod.id).update({
            tallas: prod.tallas,
            vendidos: nuevosVendidos
        });

        $('sell-modal').classList.add('hidden');
        currentSoldProduct = null;
        alert(`¡Venta registrada! Ganancia en este par: ${formatCOP(ganancia)} 🎉`);
    } catch (err) {
        console.error("Error al registrar venta:", err);
        alert("Error al registrar venta: " + err.message);
    }
}

// ==========================================
// 9. PROVEEDORES LOCALES (CRUD FIRESTORE)
// ==========================================
function initProviderForm() {
    const form = $('form-proveedor');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const nombre = $('prov-nombre').value.trim();
        const telefono = $('prov-telefono').value.trim();
        const notas = $('prov-notas').value.trim();

        if (!nombre) return;

        try {
            await db.collection('proveedores').add({
                nombre,
                telefono,
                notas,
                fechaCreacion: Date.now()
            });
            form.reset();
            alert("Proveedor guardado correctamente.");
        } catch (err) {
            console.error("Error al guardar proveedor:", err);
            alert("Error: " + err.message);
        }
    });
}

function renderProviders() {
    const list = $('proveedores-list');
    if (!list) return;

    if (providers.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Aún no tienes proveedores. Agrega uno a la izquierda. 📦</p>';
        return;
    }

    list.innerHTML = providers.map(p => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${p.nombre}</strong>
                <span>Tel: ${p.telefono || 'Sin teléfono'} ${p.notas ? ' · ' + p.notas : ''}</span>
            </div>
            <div class="list-actions">
                <button class="btn-action delete" onclick="deleteProvider('${p.id}')">Eliminar</button>
            </div>
        </div>
    `).join('');
}

window.deleteProvider = async id => {
    const linked = products.some(p => p.proveedorId === id);
    if (linked) {
        alert('Este proveedor tiene tenis asociados en tu inventario. Elimina o cambia esos productos primero.');
        return;
    }
    if (confirm('¿Eliminar este proveedor?')) {
        try {
            await db.collection('proveedores').doc(id).delete();
        } catch (err) {
            alert("Error: " + err.message);
        }
    }
};

function populateProviderDropdown() {
    const sel = $('prod-proveedor');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Selecciona proveedor local...</option>' +
        providers.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    if (current && providers.some(p => p.id === current)) sel.value = current;
}

// ==========================================
// 10. TIENDA PÚBLICA (CATÁLOGO Y CLIENTES)
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
        if (getTotalStock(p) === 0) return false; // Solo con stock
        const matchText = (p.nombre || '').toLowerCase().includes(term) ||
            (p.marca || '').toLowerCase().includes(term) ||
            (p.color || '').toLowerCase().includes(term);
        const matchMarca = marcaF ? p.marca === marcaF : true;
        const matchGenero = generoF ? p.genero === generoF : true;
        return matchText && matchMarca && matchGenero;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:3rem; grid-column:1/-1; font-size:1.1rem;">No encontramos tenis con esos filtros. ¡Escríbenos por WhatsApp y te los conseguimos! 👟</p>';
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

window.openProductModal = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    const modal = $('product-modal');
    if (!modal) return;

    const img = $('modal-img');
    if (img) {
        if (prod.foto) { img.src = prod.foto; img.style.display = 'block'; }
        else img.style.display = 'none';
    }

    $('modal-brand').textContent = prod.marca;
    $('modal-title').textContent = prod.nombre;
    $('modal-price').textContent = formatCOP(prod.precioVenta);
    $('modal-desc').textContent = [prod.color ? 'Color: ' + prod.color : '', prod.genero, 'Medellín, Colombia · Envíos a todo el país'].filter(Boolean).join(' · ');

    const sizesContainer = $('modal-size-selector');
    const available = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0);

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

    // Botón de WhatsApp
    const waBtn = $('modal-wa-btn');
    if (waBtn) {
        const newBtn = waBtn.cloneNode(true);
        waBtn.parentNode.replaceChild(newBtn, waBtn);
        newBtn.id = 'modal-wa-btn';
        newBtn.addEventListener('click', () => {
            const selectedBtn = sizesContainer?.querySelector('.size-btn.selected');
            const size = selectedBtn ? selectedBtn.dataset.size : 'N/A';
            const msg = `¡Hola! Me interesan los tenis: *${prod.nombre}* (${prod.marca})\n👟 Talla: *${size}*\n💵 Precio: *${formatCOP(prod.precioVenta)}*\n¿Están disponibles para envío?`;
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }

    modal.classList.remove('hidden');
};

window.quickWhatsApp = id => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const sizes = Object.keys(prod.tallas || {}).filter(t => prod.tallas[t] > 0).join(', ');
    const msg = `¡Hola! Me interesan los tenis: *${prod.nombre}* (${prod.marca})\nTallas que vi: ${sizes}\nPrecio: *${formatCOP(prod.precioVenta)}*\n¿Me podrías confirmar disponibilidad?`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ==========================================
// 11. DASHBOARD DE KPIS
// ==========================================
function renderDashboard() {
    let totalInvertido = 0;
    let valorVenta = 0;
    let enStock = 0;
    const provStats = {};

    products.forEach(p => {
        const stock = getTotalStock(p);
        if (stock > 0) {
            enStock += stock;
            const invertido = ((p.costoProveedor || 0) + (p.costoEnvio || 0)) * stock;
            const venta = (p.precioVenta || 0) * stock;
            totalInvertido += invertido;
            valorVenta += venta;

            const provId = p.proveedorId || 'sin_asignar';
            if (!provStats[provId]) provStats[provId] = { invertido: 0, venta: 0, pares: 0 };
            provStats[provId].invertido += invertido;
            provStats[provId].venta += venta;
            provStats[provId].pares += stock;
        }
    });

    const gananciaPotencial = valorVenta - totalInvertido;
    const gananciaRealizada = ventas.reduce((s, v) => s + (v.ganancia || 0), 0);

    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    set('kpi-invertido', formatCOP(totalInvertido));
    set('kpi-venta-potencial', formatCOP(valorVenta));
    set('kpi-ganancia-potencial', formatCOP(gananciaPotencial));
    set('kpi-ganancia-realizada', formatCOP(gananciaRealizada));
    set('kpi-stock', enStock);
    set('kpi-ventas-total', formatCOP(gananciaRealizada));

    const breakdown = $('kpi-proveedores-breakdown');
    if (breakdown) {
        const keys = Object.keys(provStats);
        if (keys.length === 0) {
            breakdown.innerHTML = '<p style="color:var(--text-muted);">Sin inventario actual.</p>';
        } else {
            breakdown.innerHTML = keys.map(pid => {
                const prov = providers.find(p => p.id === pid);
                const name = prov ? prov.nombre : 'Proveedor sin asignar';
                const s = provStats[pid];
                return `<p><strong>${name}:</strong> ${s.pares} pares · Invertido ${formatCOP(s.invertido)} · Venta ${formatCOP(s.venta)}</p>`;
            }).join('');
        }
    }
}

// ==========================================
// 12. HISTORIAL DE VENTAS
// ==========================================
function renderSales() {
    const list = $('ventas-list');
    if (!list) return;

    if (ventas.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Aún no tienes ventas registradas. Marca productos como vendidos en tu inventario. 📊</p>';
        return;
    }

    let html = `<table style="width:100%; border-collapse:collapse; min-width:600px;">
        <thead><tr style="text-align:left; border-bottom:1px solid var(--border-color);">
            <th style="padding:0.8rem; color:var(--text-muted); font-size:0.85rem;">Fecha</th>
            <th style="padding:0.8rem; color:var(--text-muted); font-size:0.85rem;">Tenis</th>
            <th style="padding:0.8rem; color:var(--text-muted); font-size:0.85rem;">Talla</th>
            <th style="padding:0.8rem; color:var(--text-muted); font-size:0.85rem;">Proveedor</th>
            <th style="padding:0.8rem; color:var(--text-muted); font-size:0.85rem;">Precio Venta</th>
            <th style="padding:0.8rem; color:var(--text-muted); font-size:0.85rem;">Ganancia Neta</th>
        </tr></thead><tbody>`;

    ventas.forEach(v => {
        html += `<tr style="border-bottom:1px solid #222;">
            <td style="padding:0.8rem; font-size:0.85rem; color:var(--text-muted);">${formatDate(v.fecha)}</td>
            <td style="padding:0.8rem; font-weight:600;">${v.nombreProducto} <small style="color:var(--neon-green);">(${v.marca})</small></td>
            <td style="padding:0.8rem;"><span class="size-badge">${v.talla}</span></td>
            <td style="padding:0.8rem; font-size:0.9rem;">${v.proveedor}</td>
            <td style="padding:0.8rem;">${formatCOP(v.precioVenta)}</td>
            <td style="padding:0.8rem; color:${v.ganancia >= 0 ? 'var(--neon-green)' : '#ff3333'}; font-weight:bold;">${formatCOP(v.ganancia)}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    list.innerHTML = html;
}

// ==========================================
// 13. MODALES Y EVENTOS GENERALES
// ==========================================
function initModals() {
    const sellModal = $('sell-modal');
    const prodModal = $('product-modal');
    const loginModal = $('login-modal');

    // Cerrar con botón X
    $('sell-modal-close')?.addEventListener('click', () => sellModal.classList.add('hidden'));
    $('modal-close')?.addEventListener('click', () => prodModal.classList.add('hidden'));
    $('login-modal-close')?.addEventListener('click', () => loginModal.classList.add('hidden'));

    // Confirmar venta
    $('confirm-sell-btn')?.addEventListener('click', confirmSale);

    // Cerrar al tocar fuera
    [sellModal, prodModal, loginModal].forEach(m => {
        if (m) m.addEventListener('click', e => {
            if (e.target === m) m.classList.add('hidden');
        });
    });
}

// ==========================================
// 14. HELPERS
// ==========================================
function $(id) { return document.getElementById(id); }

function formatCOP(n) {
    return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = v => String(v).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTotalStock(prod) {
    if (!prod || !prod.tallas) return 0;
    return Object.values(prod.tallas).reduce((s, q) => s + (parseInt(q) || 0), 0);
}
