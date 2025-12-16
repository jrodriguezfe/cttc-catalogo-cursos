// app.js - cttc-catalogo-parrilla (Especializado)

let currentEditId = null; 
let allProgramas = []; 

// =================================================================
// HELPERS GENERALES
// =================================================================
function formatDate(dateString) {
    if (!dateString) return 'Fecha por definir';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

function getMonthName(monthIndex) {
    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return monthNames[monthIndex];
}

function showSection(sectionId, isNew = false) {
    document.querySelectorAll('.spa-section').forEach(s => s.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';

    if (sectionId === 'admin-dashboard') loadAdminList();
    if (sectionId === 'parrilla') cargarParrilla();

    if (sectionId === 'admin-form') {
        const titleElement = document.getElementById('form-title');
        const badgeElement = document.getElementById('is-new-instance-badge');
        
        if (isNew) {
            currentEditId = null;
            document.getElementById('cursoForm').reset();
            document.getElementById('searchResults').innerHTML = ''; 
            document.getElementById('searchCourseInput').value = ''; 
            titleElement.textContent = "Crear Nuevo Curso Base";
            badgeElement.textContent = "Nuevo Curso Base";
        }
    }
}

// =================================================================
// LÓGICA DE AUTENTICACIÓN
// =================================================================
function setupAuthStateListener() {
    auth.onAuthStateChanged(user => {
        const adminLink = document.getElementById('nav-admin-link');
        const loginLink = document.getElementById('nav-login-link');
        
        if (user) {
            document.body.classList.add('admin-logged-in'); // MEJORA
            adminLink.classList.remove('d-none');
            loginLink.classList.add('d-none');
        } else {
            document.body.classList.remove('admin-logged-in'); // MEJORA
            adminLink.classList.add('d-none');
            loginLink.classList.remove('d-none');
            
            if (document.getElementById('admin-dashboard').style.display === 'block' || 
                document.getElementById('admin-form').style.display === 'block') {
                showSection('parrilla'); 
            }
        }
    });
}

function loginAdmin(email, password) {
    const errorMessage = document.getElementById('login-error-message');
    errorMessage.classList.add('d-none');
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            showSection('admin-dashboard');
        })
        .catch(error => {
            errorMessage.textContent = "Error de inicio de sesión: Credenciales incorrectas o usuario no encontrado.";
            errorMessage.classList.remove('d-none');
            console.error("Login Error: ", error);
        });
}

function logoutAdmin() {
    auth.signOut().then(() => {
        alert("Sesión cerrada correctamente.");
        showSection('parrilla');
    }).catch(error => {
        console.error("Logout Error: ", error);
    });
}

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    loginAdmin(email, password);
});

// =================================================================
// LÓGICA DE LA PARRILLA DINÁMICA
// =================================================================

function setupMonthYearSelector() {
    const selector = document.getElementById('monthYearSelector');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); 
    
    selector.innerHTML = ''; 

    const totalMonths = 15; 
    let monthCounter = currentMonth - 3; 
    let yearCounter = currentYear;

    for (let i = 0; i < totalMonths; i++) {
        
        if (monthCounter < 0) {
            monthCounter += 12;
            yearCounter--;
        } else if (monthCounter > 11) {
            monthCounter -= 12;
            yearCounter++;
        }
        
        const monthIndex = monthCounter + 1; 
        const monthName = getMonthName(monthCounter);
        const value = `${yearCounter}-${monthIndex.toString().padStart(2, '0')}`;
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${monthName} ${yearCounter}`;
        
        if (i === 3) { 
            option.selected = true;
        }

        selector.appendChild(option);

        monthCounter++;
    }
}


function toggleDescription(id) {
    const element = document.getElementById(`desc-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    
    element.classList.toggle('show');

    if (element.classList.contains('show')) {
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    } else {
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    }
}


function cargarParrilla() {
    const container = document.getElementById('parrilla-container');
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-acento-principal"></div><p>Cargando cursos...</p></div>';

    const selector = document.getElementById('monthYearSelector');
    const selectedValue = selector ? selector.value : null;

    let targetYear, targetMonth, monthName;

    if (selectedValue) {
        const parts = selectedValue.split('-');
        targetYear = parseInt(parts[0]);
        targetMonth = parseInt(parts[1]); 
        monthName = getMonthName(targetMonth - 1);
    } else {
        const now = new Date();
        targetYear = now.getFullYear();
        targetMonth = now.getMonth() + 1;
        monthName = getMonthName(now.getMonth());
    }

    document.getElementById('currentMonthName').textContent = `${monthName} ${targetYear}`;

    db.collection('programas').get().then(snapshot => {
        allProgramas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const programasDelMes = allProgramas.filter(p => {
            if (!p.fechaInicio || p.estado !== 'Activo') return false; 
            
            const parts = p.fechaInicio.split('-'); 
            if (parts.length !== 3) return false;

            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);

            return year === targetYear && month === targetMonth;
            
        }).sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));

        container.innerHTML = ''; 

        if (programasDelMes.length === 0) {
            container.innerHTML = `<div class="col-12"><div class="alert alert-warning">No hay cursos programados para iniciar en ${monthName} ${targetYear}.</div></div>`;
            return;
        }

        programasDelMes.forEach(p => {
            const vacantesDisponibles = (p.vacantesTotal || 0) - (p.vacantesOcupadas || 0);
            const isFull = vacantesDisponibles <= 0;
            const badgeClass = isFull ? 'badge-completo' : 'badge-vacantes-disponibles';
            const badgeText = isFull ? 'COMPLETO' : 'VACANTES';

            const cardHtml = `
                <div class="card-item-horizontal"> 
                    <div class="card card-parrilla h-100 shadow-sm">
                        <span class="badge badge-vacantes ${badgeClass}">${badgeText}</span>
                        <img src="${p.imagenUrl || 'https://placehold.co/300x180?text=Curso+CTTC'}" class="card-img-top" loading="lazy">
                        
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title fw-bold text-acento">${p.titulo}</h5>
                            <p class="card-text small mb-1"><i class="bi bi-globe"></i> Modalidad: <strong>${p.modalidad || 'N/A'}</strong></p>
                            <hr class="my-2">
                            <p class="card-text small mb-1"><i class="bi bi-calendar-event text-acento"></i> Inicio: <strong>${formatDate(p.fechaInicio)}</strong></p>
                            <p class="card-text small mb-2"><i class="bi bi-stopwatch text-acento"></i> Horario: ${p.horario || 'Por definir'}</p>
                            <p class="card-text small mb-2"><i class="bi bi-clock"></i> Duración: ${p.duracion || 'N/A'}</p>
                            
                            <h5 class="fw-bold text-primary mb-2">S/ ${p.costo || 'Consultar'}</h5> 

                            <div class="mt-2">
                                <a href="javascript:void(0)" class="btn btn-link p-0" onclick="toggleDescription('${p.id}')">
                                    Descripción <i id="icon-${p.id}" class="bi bi-chevron-down small"></i>
                                </a>
                                <div id="desc-${p.id}" class="desc-toggle">
                                    <p class="small text-muted">${p.descripcion || 'Sin descripción detallada.'}</p>
                                </div>
                            </div>
                            
                            <div class="mt-auto pt-3">
                                <a href="https://wa.me/51954622231?text=Hola,%20quisiera%20más%20información%20sobre%20el%20curso%20de%20${p.titulo}" target="_blank" class="btn btn-acento-principal w-100"><i class="bi bi-whatsapp"></i> Consultar</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });
    }).catch(error => {
        container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error al cargar datos. Verifique sus reglas de Firebase.</div></div>`;
        console.error("Error fetching data: ", error);
    });
}


// =================================================================
// LÓGICA DE BÚSQUEDA Y DUPLICACIÓN
// =================================================================

function filterExistingCourses() {
    const inputElement = document.getElementById('searchCourseInput');
    const resultsContainer = document.getElementById('searchResults');
    const searchTerm = inputElement.value.toLowerCase().trim();
    resultsContainer.innerHTML = ''; 

    if (searchTerm.length < 3) {
        resultsContainer.innerHTML = `<a href="#" class="list-group-item list-group-item-action text-muted">Escriba al menos 3 caracteres para buscar.</a>`;
        return;
    }

    const foundCourses = allProgramas.filter(p => 
        p.titulo && p.titulo.toLowerCase().includes(searchTerm) ||
        p.programa && p.programa.toLowerCase().includes(searchTerm)
    );

    if (foundCourses.length === 0) {
        resultsContainer.innerHTML = `<a href="#" class="list-group-item list-group-item-action text-danger">No se encontraron cursos con ese término.</a>`;
        return;
    }

    foundCourses.forEach(p => {
        const item = document.createElement('a');
        item.href = "javascript:void(0)";
        item.classList.add('list-group-item', 'list-group-item-action', 'list-group-item-light');
        item.innerHTML = `
            <strong>${p.titulo}</strong> (${p.programa || 'N/A'})
            <br><small class="text-muted">ID: ${p.id.substring(0, 8)}... - Modalidad: ${p.modalidad}</small>
        `;
        item.onclick = () => loadCourseDataForNewInstance(p.id); 
        resultsContainer.appendChild(item);
    });
}

function loadCourseDataForNewInstance(id) {
    const programa = allProgramas.find(p => p.id === id);
    if (!programa) return;

    document.getElementById('titulo').value = programa.titulo || '';
    document.getElementById('programa').value = programa.programa || '';
    document.getElementById('descripcion').value = programa.descripcion || '';
    document.getElementById('duracion').value = programa.duracion || '';
    document.getElementById('modalidad').value = programa.modalidad || 'Online';
    document.getElementById('imagenUrl').value = programa.imagenUrl || 'images/default-course.jpg';
    document.getElementById('categoria').value = programa.categoria || 'Programa';

    currentEditId = null; 
    
    document.getElementById('form-title').textContent = `Crear Nueva Instancia de: ${programa.titulo}`;
    document.getElementById('is-new-instance-badge').textContent = "¡DUPLICADO!";

    document.getElementById('fechaInicio').value = ''; 
    document.getElementById('horario').value = '';     
    document.getElementById('costo').value = programa.costo || '0.00'; 
    document.getElementById('vacantesTotal').value = programa.vacantesTotal || 20; 
    document.getElementById('vacantesOcupadas').value = 0; 
    document.getElementById('estado').value = 'Activo'; 
    
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchCourseInput').value = '';

    alert(`Datos base de "${programa.titulo}" cargados. ¡Configure la nueva Fecha y Horario!`);
}


// =================================================================
// LÓGICA DE ADMINISTRACIÓN (ESCRITURA)
// =================================================================

document.getElementById('cursoForm').addEventListener('submit', function(e) {
    e.preventDefault();
    savePrograma();
});

function savePrograma() {
    if (!auth.currentUser) {
        alert("Operación denegada. Debe iniciar sesión como administrador para guardar.");
        showSection('login-section');
        return;
    }

    const data = {
        titulo: document.getElementById('titulo').value,
        programa: document.getElementById('programa').value,
        descripcion: document.getElementById('descripcion').value,
        duracion: document.getElementById('duracion').value,
        modalidad: document.getElementById('modalidad').value,
        fechaInicio: document.getElementById('fechaInicio').value,
        horario: document.getElementById('horario').value,
        costo: document.getElementById('costo').value, 
        vacantesTotal: parseInt(document.getElementById('vacantesTotal').value),
        vacantesOcupadas: parseInt(document.getElementById('vacantesOcupadas').value),
        estado: document.getElementById('estado').value,
        imagenUrl: document.getElementById('imagenUrl').value,
        categoria: document.getElementById('categoria').value,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (currentEditId) {
            db.collection('programas').doc(currentEditId).update(data)
                .then(() => {
                    alert("Instancia de curso actualizada correctamente.");
                    showSection('admin-dashboard');
                });
        } else {
            db.collection('programas').add(data)
                .then(() => {
                    alert("Nuevo curso base/instancia guardado correctamente.");
                    showSection('admin-dashboard');
                });
        }
    } catch(e) { 
        alert("Error al guardar: " + e.message); 
        console.error(e);
    }
}

function loadAdminList() {
    const container = document.getElementById('admin-list-container');
    container.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-acento-principal"></div></div>';
    
    // MEJORA: Ahora usa el selector propio del admin
    const selector = document.getElementById('adminMonthSelector');
    const selectedValue = selector ? selector.value : null;
    let targetYear, targetMonth;

    if (selectedValue) {
        const parts = selectedValue.split('-');
        targetYear = parseInt(parts[0]);
        targetMonth = parseInt(parts[1]);
    }

    db.collection('programas').get().then(snapshot => {
        allProgramas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 1. FILTRAR: Usando el selector independiente del administrador
        const programasFiltrados = allProgramas.filter(p => {
            if (!p.fechaInicio) return false;
            const parts = p.fechaInicio.split('-');
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            return year === targetYear && month === targetMonth;
        });

        // 2. ORDENAR: De MENOR a MAYOR (Orden cronológico ascendente)
        // Se usa (a - b) para que la fecha más cercana aparezca primero
        programasFiltrados.sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));

        let html = `
            <div class="alert alert-secondary py-2">Lista Admin - Periodo: <strong>${selector.options[selector.selectedIndex].text}</strong></div>
            <table class="table table-striped table-hover align-middle">
                <thead>
                    <tr>
                        <th>Curso</th>
                        <th>Modalidad</th> 
                        <th>Inicio / Horario</th>
                        <th>Costo / Vacantes</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (programasFiltrados.length === 0) {
            html += `<tr><td colspan="5" class="text-center">No hay cursos para este periodo.</td></tr>`;
        }

        programasFiltrados.forEach(p => {
            const vacantesDisponibles = (p.vacantesTotal || 0) - (p.vacantesOcupadas || 0);
            const statusBadge = vacantesDisponibles <= 0 ? 
                `<span class="badge bg-danger">Completo</span>` : 
                `<span class="badge bg-success">Vacantes (${vacantesDisponibles})</span>`;
            
            const activeBadge = p.estado === 'Activo' ? 
                `<span class="badge bg-primary">Activo</span>` : 
                `<span class="badge bg-secondary">Inactivo</span>`;

            html += `
                <tr>
                    <td><strong>${p.titulo}</strong><br><small class="text-muted">Prog: ${p.programa || 'N/A'}</small></td>
                    <td><span class="badge bg-secondary">${p.modalidad || 'N/A'}</span> <br><small class="text-muted">${activeBadge}</small></td>
                    <td>${formatDate(p.fechaInicio || 'N/A')}<br><small class="text-muted">${p.horario || 'N/A'}</small></td>
                    <td><strong>S/ ${p.costo || '0.00'}</strong><br>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="editNewGroup('${p.id}', false)"><i class="bi bi-pencil-square"></i> Editar</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarPrograma('${p.id}')"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    });
}


function editNewGroup(id, isNewInstance) {
    const programa = allProgramas.find(p => p.id === id);
    if (!programa) return;

    const titleElement = document.getElementById('form-title');
    const badgeElement = document.getElementById('is-new-instance-badge');
    const searchResults = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchCourseInput');
    
    searchResults.innerHTML = '';
    searchInput.value = '';

    document.getElementById('titulo').value = programa.titulo || '';
    document.getElementById('programa').value = programa.programa || '';
    document.getElementById('descripcion').value = programa.descripcion || '';
    document.getElementById('duracion').value = programa.duracion || '';
    document.getElementById('modalidad').value = programa.modalidad || 'Online';
    document.getElementById('imagenUrl').value = programa.imagenUrl || 'images/default-course.jpg'; // CARGA IMAGEN URL
    document.getElementById('categoria').value = programa.categoria || 'Programa';

    if (isNewInstance) {
        currentEditId = null;
        titleElement.textContent = `Crear Nueva Instancia de: ${programa.titulo}`;
        badgeElement.textContent = "¡NUEVA FECHA!";
        
        document.getElementById('fechaInicio').value = ''; 
        document.getElementById('horario').value = ''; 
        document.getElementById('costo').value = programa.costo || '0.00'; 
        document.getElementById('vacantesTotal').value = programa.vacantesTotal || 20;
        document.getElementById('vacantesOcupadas').value = 0; 
        document.getElementById('estado').value = 'Activo'; 
        
    } else {
        currentEditId = id;
        titleElement.textContent = `Editando Instancia: ${programa.titulo}`;
        badgeElement.textContent = "EDITANDO";

        document.getElementById('fechaInicio').value = programa.fechaInicio || '';
        document.getElementById('horario').value = programa.horario || '';
        document.getElementById('costo').value = programa.costo || '0.00'; 
        document.getElementById('vacantesTotal').value = programa.vacantesTotal || 20;
        document.getElementById('vacantesOcupadas').value = programa.vacantesOcupadas || 0;
        document.getElementById('estado').value = programa.estado || 'Activo';
    }

    showSection('admin-form');
}

function eliminarPrograma(id) {
    if (!auth.currentUser) {
        alert("Operación denegada. Debe iniciar sesión como administrador para eliminar.");
        showSection('login-section');
        return;
    }
    
    if(confirm("¿Estás seguro de eliminar ESTA INSTANCIA de curso?")) {
        db.collection('programas').doc(id).delete().then(() => { 
            loadAdminList(); 
            cargarParrilla(); 
            alert("Instancia eliminada correctamente.");
        }).catch(e => {
            alert("Error al eliminar: " + e.message);
        });
    }
}

/**
 * MEJORA: Control de visibilidad del botón Salir y Scroll
 */
function scrollParrilla(distance) {
    const container = document.getElementById('parrilla-container');
    container.scrollBy({ left: distance, behavior: 'smooth' });
}


// --- NUEVA FUNCIÓN: Sincroniza las vistas al cambiar el mes ---
function actualizarTodo() {
    cargarParrilla(); // Refresca la vista de usuario
    // Si el panel de admin está visible, refresca su lista con el nuevo filtro de mes
    if (document.getElementById('admin-dashboard').style.display === 'block') {
        loadAdminList();
    }
}

// --- Inicializar el selector del Admin ---
function setupAdminMonthSelector() {
    const adminSelector = document.getElementById('adminMonthSelector');
    const userSelector = document.getElementById('monthYearSelector');
    
    // Copiamos las opciones del selector de usuario al del admin
    adminSelector.innerHTML = userSelector.innerHTML;
    adminSelector.value = userSelector.value;
}



// =================================================================
// INICIALIZACIÓN
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupAuthStateListener(); 
    setupMonthYearSelector(); // Selector de usuario
    setupAdminMonthSelector(); // MEJORA: Selector independiente de admin
    cargarParrilla(); 
    showSection('parrilla');
});