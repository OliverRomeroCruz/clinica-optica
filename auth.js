// Authentication Logic (SQLite Local DB)

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
  const userProfileView = document.getElementById('user-profile-view');
  
  const authMsgBox = document.getElementById('auth-message-box');

  // Check persisted user session
  checkSession();

  // Open modal
  openAuthBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentUser = getCurrentUser();
      if (currentUser) {
        showProfile(currentUser);
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
    if (userProfileView) userProfileView.classList.add('hidden');

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
    if (authMsgBox) {
      authMsgBox.classList.add('hidden');
      authMsgBox.textContent = '';
    }
  }

  // Handle Register Form Submission
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMessage();

      const nombre = document.getElementById('reg-nombre').value.trim();
      const correo = document.getElementById('reg-correo').value.trim();
      const contrasena = document.getElementById('reg-contrasena').value;
      const rol = document.getElementById('reg-rol').value;

      const submitBtn = formRegister.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'REGISTRANDO EN BASE DE DATOS...';

      try {
        const resp = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: json_payload({ nombre, correo, contrasena, rol })
        });
        const data = await resp.json();

        if (data.ok) {
          showMessage('¡Cuenta creada con éxito! Iniciando sesión...', false);
          localStorage.setItem('optica_user', JSON.stringify(data.usuario));
          setTimeout(() => {
            updateNavUser(data.usuario);
            showProfile(data.usuario);
          }, 800);
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
      submitBtn.innerHTML = 'COMPROBANDO CREDENCIALES...';

      try {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: json_payload({ correo, contrasena })
        });
        const data = await resp.json();

        if (data.ok) {
          showMessage('¡Bienvenido! Sesión iniciada.', false);
          localStorage.setItem('optica_user', JSON.stringify(data.usuario));
          setTimeout(() => {
            updateNavUser(data.usuario);
            showProfile(data.usuario);
          }, 600);
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

  function showProfile(user) {
    if (formLogin) formLogin.classList.add('hidden');
    if (formRegister) formRegister.classList.add('hidden');
    if (userProfileView) {
      userProfileView.classList.remove('hidden');
      document.getElementById('profile-name').textContent = user.nombre;
      document.getElementById('profile-email').textContent = user.correo;
      document.getElementById('profile-role').textContent = user.rol.toUpperCase();
      document.getElementById('profile-id').textContent = `ID #00${user.id}`;
    }
  }

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
      navAuthContainer.innerHTML = `
        <div class="flex items-center gap-3">
          <button class="open-auth-btn flex items-center gap-2 text-[11px] font-mono tracking-wider text-[#262626] hover:opacity-80 py-1.5 px-3 border border-[#ECECEC] bg-[#FAFBFB]">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="font-bold">${escapeHtml(user.nombre.split(' ')[0])}</span>
            <span class="text-neutral-400">(${escapeHtml(user.rol)})</span>
          </button>
        </div>
      `;
      if (mobileAuthContainer) {
        mobileAuthContainer.innerHTML = `
          <button class="open-auth-btn w-full btn-apex-exact py-3 text-center justify-center">
            MI CUENTA (${escapeHtml(user.nombre.split(' ')[0])})
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

    // Reattach open handlers
    document.querySelectorAll('.open-auth-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const curr = getCurrentUser();
        if (curr) {
          showProfile(curr);
        } else {
          switchTab('login');
        }
        openModal();
      });
    });
  }

  function json_payload(obj) {
    return JSON.stringify(obj);
  }

  function escapeHtml(text) {
    return (text || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }
}
