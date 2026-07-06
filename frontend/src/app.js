// Por defecto vacio: el navegador llama a rutas relativas del mismo origen
// (/api/...) y nginx las reenvia al backend (ver nginx.conf.template). Solo
// hace falta setear window.APP_CONFIG.API_URL si el backend vive en otro
// origen sin proxy de por medio.
const API_URL = window.APP_CONFIG?.API_URL || '';

const el = {
  alertas: document.getElementById('alertas'),
  tablaLibros: document.getElementById('tabla-libros'),
  tablaPrestamos: document.getElementById('tabla-prestamos'),
  formLibro: document.getElementById('form-libro'),
  formPrestamo: document.getElementById('form-prestamo'),
  selectLibro: document.getElementById('select-libro'),
  btnCancelarEdicion: document.getElementById('btn-cancelar-edicion'),
};

function mostrarAlerta(mensaje, tipo = 'error') {
  const div = document.createElement('div');
  div.className = `alerta ${tipo}`;
  div.textContent = mensaje;
  el.alertas.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const body = await res.json();
      mensaje = body.error || mensaje;
    } catch (_) {
      // respuesta sin cuerpo JSON (ej. 204)
    }
    throw new Error(mensaje);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------
// Libros
// ---------------------------------------------------------------------

async function cargarLibros() {
  try {
    const libros = await apiFetch('/api/libros');
    renderTablaLibros(libros);
    renderSelectLibros(libros);
  } catch (err) {
    mostrarAlerta(`No se pudieron cargar los libros: ${err.message}`);
  }
}

function renderTablaLibros(libros) {
  if (libros.length === 0) {
    el.tablaLibros.innerHTML = '<tr><td colspan="5">No hay libros registrados.</td></tr>';
    return;
  }
  el.tablaLibros.innerHTML = libros
    .map(
      (libro) => `
      <tr>
        <td>${escapeHtml(libro.titulo)}</td>
        <td>${escapeHtml(libro.autor)}</td>
        <td>${escapeHtml(libro.isbn)}</td>
        <td>${libro.stock_disponible} / ${libro.stock_total}</td>
        <td>
          <button class="btn-accion btn-editar" data-id="${libro.id}">Editar</button>
          <button class="btn-accion btn-eliminar" data-id="${libro.id}">Eliminar</button>
        </td>
      </tr>`
    )
    .join('');
}

function renderSelectLibros(libros) {
  const disponibles = libros.filter((l) => l.stock_disponible > 0);
  el.selectLibro.innerHTML =
    '<option value="">Selecciona un libro</option>' +
    disponibles
      .map((l) => `<option value="${l.id}">${escapeHtml(l.titulo)} (${l.stock_disponible} disp.)</option>`)
      .join('');
}

el.formLibro.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(el.formLibro);
  const id = formData.get('id');
  const payload = {
    titulo: formData.get('titulo'),
    autor: formData.get('autor'),
    isbn: formData.get('isbn'),
    stock_total: Number(formData.get('stock_total')),
  };

  try {
    if (id) {
      await apiFetch(`/api/libros/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      mostrarAlerta('Libro actualizado correctamente.', 'exito');
    } else {
      await apiFetch('/api/libros', { method: 'POST', body: JSON.stringify(payload) });
      mostrarAlerta('Libro creado correctamente.', 'exito');
    }
    el.formLibro.reset();
    el.formLibro.querySelector('[name="id"]').value = '';
    el.btnCancelarEdicion.hidden = true;
    await cargarLibros();
  } catch (err) {
    mostrarAlerta(`No se pudo guardar el libro: ${err.message}`);
  }
});

el.btnCancelarEdicion.addEventListener('click', () => {
  el.formLibro.reset();
  el.formLibro.querySelector('[name="id"]').value = '';
  el.btnCancelarEdicion.hidden = true;
});

el.tablaLibros.addEventListener('click', async (event) => {
  const { id } = event.target.dataset;
  if (!id) return;

  if (event.target.classList.contains('btn-eliminar')) {
    if (!confirm('¿Eliminar este libro?')) return;
    try {
      await apiFetch(`/api/libros/${id}`, { method: 'DELETE' });
      mostrarAlerta('Libro eliminado.', 'exito');
      await cargarLibros();
    } catch (err) {
      mostrarAlerta(`No se pudo eliminar el libro: ${err.message}`);
    }
  }

  if (event.target.classList.contains('btn-editar')) {
    try {
      const libros = await apiFetch('/api/libros');
      const libro = libros.find((l) => String(l.id) === String(id));
      if (!libro) return;
      el.formLibro.querySelector('[name="id"]').value = libro.id;
      el.formLibro.querySelector('[name="titulo"]').value = libro.titulo;
      el.formLibro.querySelector('[name="autor"]').value = libro.autor;
      el.formLibro.querySelector('[name="isbn"]').value = libro.isbn;
      el.formLibro.querySelector('[name="stock_total"]').value = libro.stock_total;
      el.btnCancelarEdicion.hidden = false;
    } catch (err) {
      mostrarAlerta(`No se pudo cargar el libro: ${err.message}`);
    }
  }
});

// ---------------------------------------------------------------------
// Prestamos
// ---------------------------------------------------------------------

async function cargarPrestamos() {
  try {
    const prestamos = await apiFetch('/api/prestamos');
    renderTablaPrestamos(prestamos);
  } catch (err) {
    mostrarAlerta(`No se pudieron cargar los prestamos: ${err.message}`);
  }
}

function renderTablaPrestamos(prestamos) {
  if (prestamos.length === 0) {
    el.tablaPrestamos.innerHTML = '<tr><td colspan="6">No hay prestamos registrados.</td></tr>';
    return;
  }
  el.tablaPrestamos.innerHTML = prestamos
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.libro_titulo)}</td>
        <td>${escapeHtml(p.nombre_usuario)}</td>
        <td>${formatFecha(p.fecha_prestamo)}</td>
        <td>${formatFecha(p.fecha_devolucion_estimada)}</td>
        <td><span class="badge-${p.estado}">${p.estado}</span></td>
        <td>
          ${
            p.estado === 'prestado'
              ? `<button class="btn-accion btn-devolver" data-id="${p.id}">Devolver</button>`
              : ''
          }
        </td>
      </tr>`
    )
    .join('');
}

el.formPrestamo.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(el.formPrestamo);
  const payload = {
    libro_id: Number(formData.get('libro_id')),
    nombre_usuario: formData.get('nombre_usuario'),
    fecha_devolucion_estimada: formData.get('fecha_devolucion_estimada'),
  };

  try {
    await apiFetch('/api/prestamos', { method: 'POST', body: JSON.stringify(payload) });
    mostrarAlerta('Prestamo creado correctamente.', 'exito');
    el.formPrestamo.reset();
    await Promise.all([cargarLibros(), cargarPrestamos()]);
  } catch (err) {
    mostrarAlerta(`No se pudo crear el prestamo: ${err.message}`);
  }
});

el.tablaPrestamos.addEventListener('click', async (event) => {
  if (!event.target.classList.contains('btn-devolver')) return;
  const { id } = event.target.dataset;
  try {
    await apiFetch(`/api/prestamos/${id}/devolver`, { method: 'PUT' });
    mostrarAlerta('Prestamo marcado como devuelto.', 'exito');
    await Promise.all([cargarLibros(), cargarPrestamos()]);
  } catch (err) {
    mostrarAlerta(`No se pudo devolver el prestamo: ${err.message}`);
  }
});

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatFecha(value) {
  if (!value) return '-';
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? value : fecha.toLocaleDateString('es-CL');
}

cargarLibros();
cargarPrestamos();
