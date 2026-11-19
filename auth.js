// Authentication & Client / Admin Dashboard Logic (SQLite Local DB)

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

function initAuth() {
  const authModal = document.getElementById('auth-modal');
  const openAuthBtns = document.querySelectorAll('.open-auth-btn');
  const closeAuthBtn = document.getElementById('close-auth-modal');
  
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const dashboardView = document.getElementById('dashboard-view');
  const authTabsContainer = document.getElementById('auth-tabs-container');
  
  const authMsgBox = document.getElementById('auth-message-box');

  // Check persisted user session
  checkSession();

  // Open modal
  openAuthBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentUser = getCurrentUser();
      if (currentUser) {
        showDashboard(currentUser);
      } else {
        switchTab('login');
      }
      openModal();
    });
  });

  // Close modal
  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', closeModal);
  }
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeModal();
    });
  }

  function openModal() {
    if (authModal) {
      authModal.classList.remove('hidden');
      authModal.classList.add('flex');
      document.body.style.overflow = 'hidden';
      clearMessage();
    }
  }

  function closeModal() {
    if (authModal) {
      authModal.classList.add('hidden');
      authModal.classList.remove('flex');
      document.body.style.overflow = '';
      clearMessage();
    }
  }

  // Switch tabs
  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => switchTab('login'));
    tabRegister.addEventListener('click', () => switchTab('register'));
  }

  function switchTab(mode) {
    clearMessage();
    if (dashboardView) dashboardView.classList.add('hidden');
    if (authTabsContainer) authTabsContainer.classList.remove('hidden');

    if (mode === 'login') {
      tabLogin.classList.add('border-b-2', 'border-[#262626]', 'text-[#262626]', 'font-bold');
      tabLogin.classList.remove('text-[#9A9A9A]');
      tabRegister.classList.remove('border-b-2', 'border-[#262626]', 'text-[#262626]', 'font-bold');
      tabRegister.classList.add('text-[#9A9A9A]');

      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    } else {
      tabRegister.classList.add('border-b-2', 'border-[#262626]', 'text-[#262626]', 'font-bold');
      tabRegister.classList.remove('text-[#9A9A9A]');
      tabLogin.classList.remove('border-b-2', 'border-[#262626]', 'text-[#262626]', 'font-bold');
      tabLogin.classList.add('text-[#9A9A9A]');

      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
    }
  }

  function showMessage(text, isError = true) {
    if (!authMsgBox) return;
    authMsgBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    if (isError) {
      authMsgBox.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    } else {
      authMsgBox.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    }
    authMsgBox.textContent = text;
  }

  function clearMessage() {
    if (!authMsgBox) return;
    authMsgBox.classList.add('hidden');
    authMsgBox.textContent = '';
  }

  // Handle Register Form Submission (ALWAYS CLIENT)
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMessage();

      const nombre = document.getElementById('reg-nombre').value.trim();
      const correo = document.getElementById('reg-correo').value.trim();
      const contrasena = document.getElementById('reg-contrasena').value;

      const submitBtn = formRegister.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'REGISTRANDO CLIENTE...';

      try {
        const resp = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, correo, contrasena })
        });
        const data = await resp.json();

        if (data.ok) {
          showMessage('¡Cuenta de cliente creada! Iniciando sesión...', false);
          localStorage.setItem('optica_user', JSON.stringify(data.usuario));
          setTimeout(() => {
            updateNavUser(data.usuario);
            showDashboard(data.usuario);
          }, 600);
        } else {
          showMessage(data.error || 'Error al registrar usuario.');
        }
      } catch (err) {
        showMessage('Error de conexión con el servidor local.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Handle Login Form Submission
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMessage();

      const correo = document.getElementById('login-correo').value.trim();
      const contrasena = document.getElementById('login-contrasena').value;

      const submitBtn = formLogin.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'COMPROBANDO ACCESO...';

      try {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo, contrasena })
        });
        const data = await resp.json();

        if (data.ok) {
          showMessage('¡Bienvenido! Sesión iniciada.', false);
          localStorage.setItem('optica_user', JSON.stringify(data.usuario));
          setTimeout(() => {
            updateNavUser(data.usuario);
            showDashboard(data.usuario);
          }, 500);
        } else {
          showMessage(data.error || 'Correo o contraseña incorrectos.');
        }
      } catch (err) {
        showMessage('Error de conexión con el servidor local.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('optica_user');
      updateNavUser(null);
      switchTab('login');
      closeModal();
    });
  }

  // ==================== DASHBOARD VIEW (ADMIN VS CLIENTE) ====================
  function showDashboard(user) {
    if (formLogin) formLogin.classList.add('hidden');
    if (formRegister) formRegister.classList.add('hidden');
    if (authTabsContainer) authTabsContainer.classList.add('hidden');
    if (!dashboardView) return;

    dashboardView.classList.remove('hidden');

    document.getElementById('dash-user-name').textContent = user.nombre;
    document.getElementById('dash-user-email').textContent = user.correo;
    
    const roleBadge = document.getElementById('dash-user-role-badge');
    if (roleBadge) {
      if (user.rol === 'admin') {
        roleBadge.textContent = 'ADMINISTRADOR DE CLÍNICA';
        roleBadge.className = 'text-[10px] font-mono px-2.5 py-1 bg-[#262626] text-white tracking-widest uppercase';
      } else {
        roleBadge.textContent = 'CLIENTE / PACIENTE';
        roleBadge.className = 'text-[10px] font-mono px-2.5 py-1 bg-neutral-100 text-[#262626] border border-[#ECECEC] tracking-widest uppercase';
      }
    }

    const adminPanel = document.getElementById('admin-management-panel');
    const clientPanel = document.getElementById('client-personal-panel');

    if (user.rol === 'admin') {
      if (adminPanel) adminPanel.classList.remove('hidden');
      if (clientPanel) clientPanel.classList.add('hidden');
      loadAdminOrders();
      loadAdminAppointments();
      loadAdminClientsList();
    } else {
      if (adminPanel) adminPanel.classList.add('hidden');
      if (clientPanel) clientPanel.classList.remove('hidden');
      loadClientOrders(user.id);
      loadClientAppointments(user.id);
    }
  }

  // ==================== CLIENT METHODS ====================
  async function loadClientOrders(userId) {
    const container = document.getElementById('client-orders-container');
    if (!container) return;

    container.innerHTML = '<p class="text-xs text-neutral-400 py-4 text-center">Cargando tus pedidos desde la base de datos...</p>';

    try {
      const resp = await fetch(`/api/pedidos?user_id=${userId}`);
      const data = await resp.json();

      if (!data.ok || !data.pedidos || data.pedidos.length === 0) {
        container.innerHTML = `
          <div class="p-6 border border-dashed border-[#ECECEC] text-center my-3">
            <span class="text-2xl block mb-2">👓</span>
            <p class="text-xs font-semibold text-[#262626]">No tienes pedidos en curso.</p>
            <p class="text-[11px] text-neutral-400 mt-1">Cuando solicites gafas, lentillas o cristales en la óptica, podrás seguir aquí su estado.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.pedidos.map(p => {
        let badgeClass = 'bg-neutral-100 text-neutral-700 border-neutral-200';
        let alertPickup = '';

        if (p.estado === 'Listo para recoger') {
          badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
          alertPickup = `
            <div class="mt-3 p-2.5 bg-emerald-50/80 border border-emerald-200 flex items-center gap-2 text-[11px] text-emerald-900">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span><strong>¡Ya está listo!</strong> Puedes pasar a recoger tu producto por el atelier en Calle Jorge Juan 18.</span>
            </div>
          `;
        } else if (p.estado === 'En taller / Pedido') {
          badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
        } else if (p.estado === 'Entregado') {
          badgeClass = 'bg-neutral-900 text-white border-neutral-900';
        }

        return `
          <div class="p-5 border border-[#ECECEC] mb-3 bg-white">
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <span class="text-[10px] font-mono tracking-wider text-neutral-400 uppercase">PEDIDO #${p.id} · ${escapeHtml(p.tipo)}</span>
                <h4 class="text-sm font-bold text-[#262626] mt-0.5">${escapeHtml(p.producto)}</h4>
              </div>
              <span class="text-[10px] font-mono tracking-wider px-2.5 py-1 border ${badgeClass} uppercase whitespace-nowrap">
                ${escapeHtml(p.estado)}
              </span>
            </div>
            ${p.notas ? `<p class="text-[11px] text-neutral-500 font-mono mt-1">${escapeHtml(p.notas)}</p>` : ''}
            <div class="pt-3 mt-3 border-t border-[#ECECEC] flex items-center justify-between text-[10px] font-mono text-neutral-400">
              <span>SOLICITADO EL: ${escapeHtml(p.fecha_pedido.substring(0, 10))}</span>
              <span>CLÍNICA ÓPTICA</span>
            </div>
            ${alertPickup}
          </div>
        `;
      }).join('');

    } catch (err) {
      container.innerHTML = '<p class="text-xs text-red-500 py-4 text-center">Error al conectar con la base de datos.</p>';
    }
  }

  async function loadClientAppointments(userId) {
    const container = document.getElementById('client-appointments-container');
    if (!container) return;

    container.innerHTML = '<p class="text-xs text-neutral-400 py-4 text-center">Consultando tus fechas de quedada...</p>';

    try {
      const resp = await fetch(`/api/citas?user_id=${userId}`);
      const data = await resp.json();

      if (!data.ok || !data.citas || data.citas.length === 0) {
        container.innerHTML = `
          <div class="p-6 border border-dashed border-[#ECECEC] text-center my-3">
            <span class="text-2xl block mb-2">📅</span>
            <p class="text-xs font-semibold text-[#262626]">No tienes citas programadas.</p>
            <p class="text-[11px] text-neutral-400 mt-1">Puedes solicitar una fecha de quedada para graduación o revisión.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.citas.map(c => `
        <div class="p-4 border border-[#ECECEC] mb-3 bg-white flex items-center justify-between">
          <div>
            <span class="text-[10px] font-mono tracking-wider text-neutral-400 uppercase">FECHA DE QUEDADA</span>
            <h4 class="text-sm font-bold text-[#262626]">${escapeHtml(c.servicio)}</h4>
            <p class="text-xs text-neutral-600 font-mono mt-0.5">Día: <strong>${escapeHtml(c.fecha_cita)}</strong> a las <strong>${escapeHtml(c.hora_cita)} h</strong></p>
          </div>
          <span class="text-[10px] font-mono px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
            ${escapeHtml(c.estado)}
          </span>
        </div>
      `).join('');

    } catch (err) {
      container.innerHTML = '<p class="text-xs text-red-500 py-4 text-center">Error al cargar citas.</p>';
    }
  }

  // ==================== ADMIN METHODS ====================
  async function loadAdminOrders() {
    const container = document.getElementById('admin-orders-container');
    if (!container) return;

    container.innerHTML = '<p class="text-xs text-neutral-400 py-4 text-center">Cargando todos los pedidos de clientes...</p>';

    try {
      const resp = await fetch('/api/pedidos');
      const data = await resp.json();

      if (!data.ok || !data.pedidos || data.pedidos.length === 0) {
        container.innerHTML = '<p class="text-xs text-neutral-400 py-4 text-center">Aún no hay pedidos registrados en la clínica.</p>';
        return;
      }

      container.innerHTML = data.pedidos.map(p => `
        <div class="p-5 border border-[#ECECEC] mb-4 bg-white" data-order-id="${p.id}">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#ECECEC]">
            <div>
              <span class="text-[10px] font-mono tracking-wider text-neutral-400 uppercase">PEDIDO #${p.id} · CLIENTE: <strong>${escapeHtml(p.cliente_nombre)}</strong> (${escapeHtml(p.cliente_correo)})</span>
              <h4 class="text-sm font-bold text-[#262626] mt-0.5">${escapeHtml(p.producto)}</h4>
            </div>
            
            <!-- Selector de Estado para el Admin -->
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-mono text-neutral-400 uppercase">ESTADO:</span>
              <select class="admin-status-dropdown bg-white border border-[#262626] text-xs font-semibold p-1.5 focus:outline-none" data-id="${p.id}">
                <option value="Pendiente" ${p.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="En taller / Pedido" ${p.estado === 'En taller / Pedido' ? 'selected' : ''}>En taller / Pedido</option>
                <option value="Listo para recoger" ${p.estado === 'Listo para recoger' ? 'selected' : ''}>Listo para recoger</option>
                <option value="Entregado" ${p.estado === 'Entregado' ? 'selected' : ''}>Entregado</option>
              </select>
            </div>
          </div>

          <div class="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] font-mono text-neutral-500 gap-2">
            <span>Tipo: ${escapeHtml(p.tipo)} | Notas: ${escapeHtml(p.notas || 'Sin notas adicionales')}</span>
            <span class="text-neutral-400">Fecha: ${escapeHtml(p.fecha_pedido.substring(0, 16))}</span>
          </div>
        </div>
      `).join('');

      // Attach status change events
      container.querySelectorAll('.admin-status-dropdown').forEach(select => {
        select.addEventListener('change', async (e) => {
          const pedidoId = select.dataset.id;
          const nuevoEstado = select.value;
          const originalColor = select.style.backgroundColor;
          select.style.backgroundColor = '#fef08a';

          try {
            const resp = await fetch('/api/pedidos/actualizar_estado', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pedido_id: pedidoId, nuevo_estado: nuevoEstado })
            });
            const res = await resp.json();

            if (res.ok) {
              select.style.backgroundColor = '#bbf7d0'; // Green flash
              setTimeout(() => select.style.backgroundColor = originalColor, 1200);
            } else {
              alert('Error al actualizar estado: ' + res.error);
              select.style.backgroundColor = '#fecaca';
            }
          } catch (err) {
            alert('Error de conexión al actualizar estado.');
          }
        });
      });

    } catch (err) {
      container.innerHTML = '<p class="text-xs text-red-500 py-4 text-center">Error al cargar pedidos.</p>';
    }
  }

  async function loadAdminAppointments() {
    const container = document.getElementById('admin-appointments-container');
    if (!container) return;

    try {
      const resp = await fetch('/api/citas');
      const data = await resp.json();

      if (!data.ok || !data.citas || data.citas.length === 0) {
        container.innerHTML = '<p class="text-xs text-neutral-400 py-4 text-center">No hay citas registradas.</p>';
        return;
      }

      container.innerHTML = data.citas.map(c => `
        <div class="p-3 border border-[#ECECEC] mb-2 bg-white flex items-center justify-between text-xs font-mono">
          <div>
            <strong>${escapeHtml(c.cliente_nombre)}</strong> (${escapeHtml(c.cliente_correo)})<br>
            <span class="text-neutral-600">${escapeHtml(c.servicio)}</span>
          </div>
          <div class="text-right">
            <span class="font-bold text-[#262626]">${escapeHtml(c.fecha_cita)} · ${escapeHtml(c.hora_cita)} h</span>
            <span class="block text-[10px] text-emerald-600 font-bold uppercase">${escapeHtml(c.estado)}</span>
          </div>
        </div>
      `).join('');

    } catch (err) {
      container.innerHTML = '<p class="text-xs text-red-500 py-2">Error al cargar citas.</p>';
    }
  }

  async function loadAdminClientsList() {
    const selectClient = document.getElementById('new-order-client-select');
    if (!selectClient) return;

    try {
      const resp = await fetch('/api/usuarios');
      const data = await resp.json();

      if (data.ok && data.clientes) {
        selectClient.innerHTML = data.clientes.map(cl => `
          <option value="${cl.id}">${escapeHtml(cl.nombre)} (${escapeHtml(cl.correo)})</option>
        `).join('');
      }
    } catch {}
  }

  // Handle Admin creating a new order for a client
  const formNewOrder = document.getElementById('admin-form-new-order');
  if (formNewOrder) {
    formNewOrder.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usuario_id = document.getElementById('new-order-client-select').value;
      const producto = document.getElementById('new-order-product').value.trim();
      const tipo = document.getElementById('new-order-type').value;
      const estado = document.getElementById('new-order-initial-status').value;
      const notas = document.getElementById('new-order-notes').value.trim();

      if (!usuario_id || !producto) return;

      try {
        const resp = await fetch('/api/pedidos/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario_id, producto, tipo, estado, notas })
        });
        const res = await resp.json();

        if (res.ok) {
          alert('¡Pedido asignado con éxito al cliente!');
          formNewOrder.reset();
          loadAdminOrders();
        } else {
          alert('Error: ' + res.error);
        }
      } catch (err) {
        alert('Error al conectar con la base de datos.');
      }
    });
  }

  // Handle Client requesting an appointment
  const formClientNewAppt = document.getElementById('client-form-new-appointment');
  if (formClientNewAppt) {
    formClientNewAppt.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = getCurrentUser();
      if (!user) return;

      const servicio = document.getElementById('client-new-appt-service').value;
      const fecha_cita = document.getElementById('client-new-appt-date').value;
      const hora_cita = document.getElementById('client-new-appt-time').value;

      try {
        const resp = await fetch('/api/citas/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario_id: user.id, servicio, fecha_cita, hora_cita })
        });
        const res = await resp.json();

        if (res.ok) {
          alert('¡Cita solicitada y registrada correctamente!');
          loadClientAppointments(user.id);
        } else {
          alert('Error: ' + res.error);
        }
      } catch (err) {
        alert('Error al conectar con la base de datos.');
      }
    });
  }

  // ==================== SESSION HELPERS ====================
  function checkSession() {
    const user = getCurrentUser();
    updateNavUser(user);
  }

  function getCurrentUser() {
    try {
      const data = localStorage.getItem('optica_user');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function updateNavUser(user) {
    const navAuthContainer = document.getElementById('nav-auth-container');
    const mobileAuthContainer = document.getElementById('mobile-auth-container');
    if (!navAuthContainer) return;

    if (user) {
      const isAdm = user.rol === 'admin';
      const roleColor = isAdm ? 'bg-[#262626] text-white' : 'bg-emerald-500 text-white';
      const roleName = isAdm ? 'Admin' : 'Cliente';

      navAuthContainer.innerHTML = `
        <div class="flex items-center gap-3">
          <button class="open-auth-btn flex items-center gap-2 text-[11px] font-mono tracking-wider text-[#262626] hover:opacity-80 py-1.5 px-3 border border-[#ECECEC] bg-[#FAFBFB]">
            <span class="w-2 h-2 rounded-full ${isAdm ? 'bg-black' : 'bg-emerald-500'}"></span>
            <span class="font-bold">${escapeHtml(user.nombre.split(' ')[0])}</span>
            <span class="text-neutral-400">(${roleName})</span>
          </button>
        </div>
      `;
      if (mobileAuthContainer) {
        mobileAuthContainer.innerHTML = `
          <button class="open-auth-btn w-full btn-apex-exact py-3 text-center justify-center">
            ${isAdm ? 'PANEL DE ADMINISTRACIÓN' : 'MI ESPACIO CLIENTE'} (${escapeHtml(user.nombre.split(' ')[0])})
          </button>
        `;
      }
    } else {
      navAuthContainer.innerHTML = `
        <button class="open-auth-btn text-[11px] font-semibold tracking-[0.2em] uppercase text-[#262626] hover:opacity-70 transition-opacity flex items-center gap-2 border border-[#262626] px-4 py-2">
          <span>ACCEDER</span>
          <span class="text-xs">→</span>
        </button>
      `;
      if (mobileAuthContainer) {
        mobileAuthContainer.innerHTML = `
          <button class="open-auth-btn w-full btn-apex-exact py-3 text-center justify-center">
            ACCEDER / REGISTRARSE
          </button>
        `;
      }
    }

    document.querySelectorAll('.open-auth-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const curr = getCurrentUser();
        if (curr) {
          showDashboard(curr);
        } else {
          switchTab('login');
        }
        openModal();
      });
    });
  }

  function escapeHtml(text) {
    return (text || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }
}
