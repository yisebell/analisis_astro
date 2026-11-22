/**
 * ==============================================================================
 * ASTRO AUTH - Autenticación segura con Supabase Auth (JWT + Control de Roles)
 * ==============================================================================
 */
window.AstroAuth = (function () {
  'use strict';

  let supabaseClient = null;
  let currentSession = null;
  let currentProfile = null;
  let authReadyResolve = null;
  let initialized = false;

  async function initClient() {
    if (supabaseClient) return supabaseClient;
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('No se pudo obtener la configuración de autenticación del servidor.');
    }
    const cfg = await res.json();
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      throw new Error('Supabase no está configurado en las variables de entorno del servidor.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('No se cargó el SDK de Supabase Auth.');
    }
    supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return supabaseClient;
  }

  function showAuthOverlay(errorMsg) {
    const overlay = document.getElementById('authOverlay');
    const app = document.getElementById('appContainer');
    if (app) app.style.display = 'none';
    if (overlay) overlay.style.display = 'flex';
    setAuthError(errorMsg || '');
  }

  function hideAuthOverlay() {
    const overlay = document.getElementById('authOverlay');
    const app = document.getElementById('appContainer');
    if (overlay) overlay.style.display = 'none';
    if (app) app.style.display = '';
  }

  function setAuthError(msg) {
    const el = document.getElementById('authErrorMsg');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function updateUserUI(profile) {
    const emailEl = document.getElementById('authUserEmail');
    const roleEl = document.getElementById('authUserRole');
    const btnSync = document.getElementById('btnSync');

    if (emailEl) emailEl.textContent = (profile && profile.email) ? profile.email : '-';
    if (roleEl) {
      const isAdmin = profile && profile.role === 'admin';
      roleEl.textContent = isAdmin ? 'ADMIN' : 'LECTOR';
      roleEl.className = `auth-role-badge ${isAdmin ? 'is-admin' : 'is-viewer'}`;
    }
    if (btnSync) {
      const isAdmin = profile && profile.role === 'admin';
      btnSync.style.display = isAdmin ? '' : 'none';
    }
  }

  async function verifySessionWithBackend(session) {
    if (!session || !session.access_token) return null;
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      let detail = 'Sesión no autorizada.';
      try {
        const body = await res.json();
        if (body && body.detail) detail = body.detail;
      } catch (e) {}
      throw new Error(detail);
    }
    return await res.json();
  }

  function bindLoginForm() {
    const form = document.getElementById('authLoginForm');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('authEmail');
      const passInput = document.getElementById('authPassword');
      const submitBtn = document.getElementById('btnAuthSubmit');
      const email = (emailInput && emailInput.value || '').trim();
      const password = (passInput && passInput.value) || '';

      if (!email || !password) {
        setAuthError('Ingresa tu correo electrónico y contraseña.');
        return;
      }

      setAuthError('');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificando acceso...';
      }

      try {
        const client = await initClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          throw new Error(
            error.message === 'Invalid login credentials'
              ? 'Correo o contraseña incorrectos.'
              : error.message
          );
        }

        const profile = await verifySessionWithBackend(data.session);
        currentSession = data.session;
        currentProfile = profile;
        if (passInput) passInput.value = '';
        updateUserUI(profile);
        hideAuthOverlay();

        if (authReadyResolve) {
          const resolve = authReadyResolve;
          authReadyResolve = null;
          resolve(profile);
        } else {
          window.location.reload();
        }
      } catch (err) {
        if (supabaseClient) {
          await supabaseClient.auth.signOut().catch(() => {});
        }
        currentSession = null;
        currentProfile = null;
        setAuthError(err.message || 'Error al iniciar sesión.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Iniciar sesión';
        }
      }
    });

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout && btnLogout.dataset.bound !== '1') {
      btnLogout.dataset.bound = '1';
      btnLogout.addEventListener('click', signOut);
    }
  }

  async function ensureAuthenticated() {
    bindLoginForm();

    try {
      const client = await initClient();
      if (!initialized) {
        initialized = true;
        client.auth.onAuthStateChange((event, session) => {
          currentSession = session;
          if (event === 'SIGNED_OUT') {
            currentProfile = null;
            showAuthOverlay('');
          }
        });
      }

      const { data } = await client.auth.getSession();
      if (data && data.session) {
        try {
          const profile = await verifySessionWithBackend(data.session);
          currentSession = data.session;
          currentProfile = profile;
          updateUserUI(profile);
          hideAuthOverlay();
          return profile;
        } catch (err) {
          await client.auth.signOut().catch(() => {});
          showAuthOverlay(err.message);
        }
      } else {
        showAuthOverlay('');
      }
    } catch (err) {
      showAuthOverlay(err.message || 'No se pudo inicializar la autenticación.');
    }

    return new Promise((resolve) => {
      authReadyResolve = resolve;
    });
  }

  async function getAccessToken() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    currentSession = data ? data.session : null;
    return currentSession ? currentSession.access_token : null;
  }

  async function apiFetch(url, options = {}) {
    const token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      if (supabaseClient) {
        await supabaseClient.auth.signOut().catch(() => {});
      }
      currentSession = null;
      currentProfile = null;
      showAuthOverlay('Tu sesión expiró. Por favor inicia sesión de nuevo.');
    }
    return response;
  }

  async function signOut() {
    if (supabaseClient) {
      await supabaseClient.auth.signOut().catch(() => {});
    }
    currentSession = null;
    currentProfile = null;
    showAuthOverlay('');
    window.location.reload();
  }

  function isAdmin() {
    return Boolean(currentProfile && currentProfile.role === 'admin');
  }

  function getUser() {
    return currentProfile;
  }

  return {
    ensureAuthenticated,
    apiFetch,
    signOut,
    isAdmin,
    getUser,
  };
})();
