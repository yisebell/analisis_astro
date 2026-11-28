/**
 * ==============================================================================
 * ASTRO DASHBOARD PRO - APPLICATION CONTROLLER (SPA)
 * Maneja el estado global, navegación de pestañas, renderizado reactivo y APIs
 * ==============================================================================
 */

(function () {
  'use strict';

  // Estado global de la aplicación
  const state = {
    loteria: 'luna', // 'luna', 'sol', 'combinados'
    tab: 'kpis',
    timeWindow: 'all', // '10', '30', '100', '1000', 'all'
    combinadoDistEnConjunto: true, // En modo Combinado, calcular distancias sorteo a sorteo en conjunto
    combinadosConjuntoCache: null,
    data: null,
    // Caché de cálculos por lotería
    calculos: {},
    // Paginación y filtros de tablas
    cifras4: { page: 1, pageSize: 50, search: '', sortCol: 'diasAtraso', sortAsc: false, filterNever: false },
    cifras3: { page: 1, pageSize: 50, search: '', sortCol: 'diasFin', sortAsc: false },
    cifras2: { page: 1, pageSize: 50, search: '', sortCol: 'diasFin', sortAsc: false },
    cifras1: { sortCol: 'num', sortAsc: true },
    matrices: { ventana: 100 },
    distancias: { cifras: 4, posicion: 'final' },
    vecinos: { subTab: 'num', query: '', queryB10: '' },
    ultimos: { limit: 10 },
    evaluador: {
      lista: '0859, 0539, 8370, 3614, 5842, 4874, 0610, 7147, 5173, 9105, 0517, 1051, 9032, 8344, 3502, 8071, 1793, 8428, 0470, 4104, 8621, 9159, 9684, 0542, 6868, 6435, 8450, 8318, 8737, 0802, 0208, 5637, 9580, 8624, 8122, 0869, 5341, 5340, 8047, 8078, 8362, 8363, 8155, 2645',
      search: '',
      page: 1,
      pageSize: 25,
      sortCol: 'score',
      sortAsc: false
    },
    secuencial: {
      targetIdx: 0,
      maxDepth: 7,
      expandedPos: {},
      randomCifras: {
        d2: Math.floor(Math.random() * 10),
        d3: Math.floor(Math.random() * 10)
      },
      rutaFichero: 'lista_numeros-3.txt',
      showPreview: false
    },
    polinomico: {
      windowSize: 5,
      targetIdx: 0,
      chartMode: 'both' // 'both', 'saltos', 'acumulada'
    },
    adaptativo: {
      targetIdx: 0,
      horizonte: 7,
      pesosPos: 0
    },
    quant: {
      evalWindow: 300,
      portfolioMode: 'diversificada', // 'diversificada' | 'max_prob'
      data: null,
      cacheKey: null,
      loading: false
    }
  };

  // Referencias DOM
  const dom = {};

  // ============================================================================
  // ICONOS VECTORIALES DE LOS 12 SIGNOS ZODIACALES
  // ============================================================================
  const ZODIAC_ICONS = {
    aries: {
      unicode: '♈',
      el: 'fuego',
      svg: '<path d="M12 20V9M12 9C12 5.5 9.5 4 7.5 4C5.3 4 4 5.7 4 7.5C4 8.8 4.7 9.8 5.6 10.3M12 9C12 5.5 14.5 4 16.5 4C18.7 4 20 5.7 20 7.5C20 8.8 19.3 9.8 18.4 10.3"/>'
    },
    tauro: {
      unicode: '♉',
      el: 'tierra',
      svg: '<circle cx="12" cy="14.5" r="5.5"/><path d="M6 4.5C6.8 7.5 9.1 9 12 9C14.9 9 17.2 7.5 18 4.5"/>'
    },
    geminis: {
      unicode: '♊',
      el: 'aire',
      svg: '<path d="M5 4.5C8.5 6.2 15.5 6.2 19 4.5M5 19.5C8.5 17.8 15.5 17.8 19 19.5M9 5.7V18.3M15 5.7V18.3"/>'
    },
    cancer: {
      unicode: '♋',
      el: 'agua',
      svg: '<circle cx="7.5" cy="9" r="3"/><path d="M7.5 6C12 5 16.5 6.8 19.5 10.5"/><circle cx="16.5" cy="15" r="3"/><path d="M16.5 18C12 19 7.5 17.2 4.5 13.5"/>'
    },
    leo: {
      unicode: '♌',
      el: 'fuego',
      svg: '<circle cx="7.5" cy="14.5" r="3"/><path d="M9.8 12.6C8.8 9 10.5 5 14 5C17 5 18.5 7.3 17.5 10.5L15.8 15.5C15.2 17.5 16.5 19.2 18.3 19C19.5 18.8 20.3 18 20.5 17"/>'
    },
    virgo: {
      unicode: '♍',
      el: 'tierra',
      svg: '<path d="M4.5 6V16.5M4.5 9C5.5 6.8 8.5 6.8 9 9.5V16.5M9 9C10 6.8 13 6.8 13.5 9.5V16.5C13.5 18 14.7 19.2 16.5 19.5M13.5 11C15.5 8.5 18.5 9.5 18 12.5C17.5 15.5 14 17.8 11.5 19.5"/>'
    },
    libra: {
      unicode: '♎',
      el: 'aire',
      svg: '<path d="M4 18.5H20M4 14.5H8.5C8 13.7 7.8 12.8 7.8 11.8C7.8 9.4 9.7 7.5 12 7.5C14.3 7.5 16.2 9.4 16.2 11.8C16.2 12.8 16 13.7 15.5 14.5H20"/>'
    },
    escorpion: {
      unicode: '♏',
      el: 'agua',
      svg: '<path d="M4 6V16.5M4 9C5 6.8 8 6.8 8.5 9.5V16.5M8.5 9C9.5 6.8 12.5 6.8 13 9.5V15.5C13 17.8 14.8 19 16.8 18.2L20 15M17.2 14.6L20 15L19.6 17.8"/>'
    },
    sagitario: {
      unicode: '♐',
      el: 'fuego',
      svg: '<path d="M5 19L19 5M12 5H19V12M7.5 11.5L12.5 16.5"/>'
    },
    capricornio: {
      unicode: '♑',
      el: 'tierra',
      svg: '<path d="M4.5 6.5L8.5 16.5L12.5 7.5C13.5 5.5 16.5 6 16.5 9V14.5M16.5 14.5C16.5 12.6 19.8 12.6 19.8 15.2C19.8 17.6 17 19.2 14.5 18.5C12.8 18 12 16.5 13 15.2C14 14 16.5 14.5 16.5 14.5Z"/>'
    },
    acuario: {
      unicode: '♒',
      el: 'aire',
      svg: '<path d="M4 9.5L7 6.5L10 9.5L13 6.5L16 9.5L19.5 6.5M4 16L7 13L10 16L13 13L16 16L19.5 13"/>'
    },
    piscis: {
      unicode: '♓',
      el: 'agua',
      svg: '<path d="M6 4.5C9.5 8 9.5 16 6 19.5M18 4.5C14.5 8 14.5 16 18 19.5M5 12H19"/>'
    }
  };

  function normalizarClaveSigno(signo) {
    if (!signo) return '';
    const key = String(signo).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return key === 'escorpio' ? 'escorpion' : key;
  }

  function getSignoUnicode(signo) {
    const meta = ZODIAC_ICONS[normalizarClaveSigno(signo)];
    return meta ? meta.unicode : '✦';
  }

  function renderSignoIcon(signo, size = 15) {
    const key = normalizarClaveSigno(signo);
    const meta = ZODIAC_ICONS[key];
    if (!meta) return '';
    return `<svg class="zodiac-svg zodiac-el-${meta.el}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${meta.svg}</svg>`;
  }

  function renderSignoWithIcon(signo, size = 15) {
    if (!signo) return '';
    const icon = renderSignoIcon(signo, size);
    return icon
      ? `<span class="zodiac-inline">${icon}<span>${signo}</span></span>`
      : String(signo);
  }

  // Inicialización cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheDom();
    initTheme();
    bindEvents();
    if (window.AstroAuth && typeof window.AstroAuth.ensureAuthenticated === 'function') {
      await window.AstroAuth.ensureAuthenticated();
    }
    await cargarDatos();
  }

  function apiFetch(url, options = {}) {
    if (window.AstroAuth && typeof window.AstroAuth.apiFetch === 'function') {
      return window.AstroAuth.apiFetch(url, options);
    }
    return fetch(url, options);
  }

  function cacheDom() {
    dom.btnLuna = document.getElementById('btnLuna');
    dom.btnSol = document.getElementById('btnSol');
    dom.btnComb = document.getElementById('btnComb');
    dom.timeSelect = document.getElementById('timeSelect');
    dom.btnSync = document.getElementById('btnSync');
    dom.btnExportExcel = document.getElementById('btnExportExcel');
    dom.btnThemeToggle = document.getElementById('btnThemeToggle');
    dom.themeToggleIcon = document.getElementById('themeToggleIcon');
    dom.themeToggleText = document.getElementById('themeToggleText');
    dom.statusDot = document.getElementById('statusDot');
    dom.statusText = document.getElementById('statusText');
    dom.lastUpdateText = document.getElementById('lastUpdateText');
    dom.totalDrawsText = document.getElementById('totalDrawsText');
    dom.toastContainer = document.getElementById('toastContainer');
    dom.pageTitle = document.getElementById('pageTitle');
    dom.pageSub = document.getElementById('pageSub');
  }

  function bindEvents() {
    // Selector de lotería
    dom.btnLuna.addEventListener('click', () => setLoteria('luna'));
    dom.btnSol.addEventListener('click', () => setLoteria('sol'));
    dom.btnComb.addEventListener('click', () => setLoteria('combinados'));

    // Selector de ventana temporal
    dom.timeSelect.addEventListener('change', (e) => {
      state.timeWindow = e.target.value;
      recalcularYRenderizar();
    });

    // Pestañas de navegación
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        setTab(tab);
        closeMobileSidebar();
      });
    });

    // Menú móvil responsivo (drawer)
    const btnMobileMenu = document.getElementById('btnMobileMenu');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    if (btnMobileMenu) btnMobileMenu.addEventListener('click', toggleMobileSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

    // Click-to-drilldown en cualquier número (.number-pill)
    setupNumberPillDrilldown();

    // Botones de acción superior
    if (dom.btnSync) {
      dom.btnSync.addEventListener('click', sincronizarResultados);
    }
    if (dom.btnExportExcel) {
      dom.btnExportExcel.addEventListener('click', exportarExcel);
    }
    if (dom.btnThemeToggle) {
      dom.btnThemeToggle.addEventListener('click', toggleTheme);
    }

    // Eventos específicos de vistas
    setupViewEvents();
  }

  // ============================================================================
  // GESTIÓN DE MODO CLARO / OSCURO (THEME SWITCHER)
  // ============================================================================

  function initTheme() {
    const savedTheme = localStorage.getItem('astro_theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    applyTheme(initialTheme, false);

    if (!savedTheme && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('astro_theme')) {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  }

  function applyTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      try {
        localStorage.setItem('astro_theme', theme);
      } catch (err) {}
    }
    updateThemeUI(theme);

    // Si la pestaña activa es Matrices, actualizar los estilos de calor dinámicos
    if (state.tab === 'matrices' && state.calculos && state.calculos.matrices) {
      renderMatrices();
    }
    // Si la pestaña activa es Polinómico, redibujar los gráficos SVG con la nueva paleta
    if (state.tab === 'polinomico' && state.calculos && state.calculos.polinomico) {
      renderPolinomico();
    }
    // Si la pestaña activa es Adaptativo, redibujar los gráficos SVG con la nueva paleta
    if (state.tab === 'adaptativo' && state.calculos && state.calculos.adaptativo) {
      renderAdaptativo();
    }
    // Si la pestaña activa es Lab Cuantitativo, redibujar los gráficos SVG con la nueva paleta
    if (state.tab === 'quant' && state.quant && state.quant.data) {
      renderQuant();
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme, true);
    mostrarToast(`Modo ${nextTheme === 'light' ? 'Claro' : 'Oscuro'} activado`, 'info');
  }

  function toggleMobileSidebar() {
    const sb = document.getElementById('appSidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (!sb) return;
    const isOpen = sb.classList.toggle('open');
    if (bd) bd.classList.toggle('visible', isOpen);
  }

  function closeMobileSidebar() {
    const sb = document.getElementById('appSidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (sb) sb.classList.remove('open');
    if (bd) bd.classList.remove('visible');
  }

  function setupNumberPillDrilldown() {
    const pop = document.getElementById('numberActionPopover');
    if (!pop) return;

    document.addEventListener('click', (e) => {
      const pill = e.target.closest('.number-pill');
      if (pill) {
        const raw = (pill.textContent || '').replace(/[^0-9]/g, '');
        if (raw.length >= 2 && raw.length <= 4) {
          e.stopPropagation();
          const rect = pill.getBoundingClientRect();
          pop.innerHTML = `
            <div class="number-popover-head">
              <span>Número #${raw}</span>
              <span style="font-size:0.68rem;color:var(--text-muted);">${raw.length}C</span>
            </div>
            <button type="button" class="number-popover-btn" data-act="vecinos" data-num="${raw}">🔮 Ver Vecinos (Antes/Desp)</button>
            ${raw.length === 4 ? `<button type="button" class="number-popover-btn" data-act="evaluador" data-num="${raw}">📋 Añadir a Radiografía</button>` : ''}
            <button type="button" class="number-popover-btn" data-act="copiar" data-num="${raw}">📋 Copiar "${raw}"</button>
          `;
          pop.style.display = 'flex';
          const top = Math.min(window.innerHeight - 150, rect.bottom + 6);
          const left = Math.min(window.innerWidth - 215, Math.max(10, rect.left));
          pop.style.top = `${top}px`;
          pop.style.left = `${left}px`;
          return;
        }
      }

      const actBtn = e.target.closest('.number-popover-btn');
      if (actBtn) {
        const act = actBtn.getAttribute('data-act');
        const num = actBtn.getAttribute('data-num');
        pop.style.display = 'none';
        if (act === 'vecinos') {
          state.vecinos.query = num;
          state.vecinos.subTab = 'num';
          const inp = document.getElementById('inputVecinos');
          if (inp) inp.value = num;
          setTab('vecinos');
        } else if (act === 'evaluador') {
          const inp = document.getElementById('inputEvaluador');
          const curr = (state.evaluador.lista || '').trim();
          const tokens = curr ? curr.split(/[\s,;]+/).filter(Boolean) : [];
          if (!tokens.includes(num)) {
            tokens.unshift(num);
            state.evaluador.lista = tokens.join(', ');
            if (inp) inp.value = state.evaluador.lista;
            mostrarToast(`Número #${num} añadido a Radiografía de Apuestas`, 'success');
          } else {
            mostrarToast(`#${num} ya estaba en tu lista de Radiografía`, 'info');
          }
          setTab('evaluador');
        } else if (act === 'copiar') {
          if (navigator.clipboard) navigator.clipboard.writeText(num).catch(() => {});
          mostrarToast(`Copiado: ${num}`, 'info');
        }
        return;
      }

      if (!e.target.closest('#numberActionPopover')) {
        pop.style.display = 'none';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') pop.style.display = 'none';
    });
  }

  function updateThemeUI(theme) {
    if (!dom.btnThemeToggle) return;
    const isLight = theme === 'light';
    if (dom.themeToggleIcon) {
      dom.themeToggleIcon.textContent = isLight ? '🌙' : '☀️';
    }
    if (dom.themeToggleText) {
      dom.themeToggleText.textContent = isLight ? 'Modo Oscuro' : 'Modo Claro';
    }
    dom.btnThemeToggle.setAttribute(
      'title',
      isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'
    );
  }

  function setupViewEvents() {
    // Buscador y filtros 4C
    const search4C = document.getElementById('search4C');
    if (search4C) {
      search4C.addEventListener('input', (e) => {
        state.cifras4.search = e.target.value.trim();
        state.cifras4.page = 1;
        renderCifras4();
      });
    }

    const btnFilterNever4C = document.getElementById('btnFilterNever4C');
    if (btnFilterNever4C) {
      btnFilterNever4C.addEventListener('click', () => {
        state.cifras4.filterNever = !state.cifras4.filterNever;
        btnFilterNever4C.classList.toggle('active', state.cifras4.filterNever);
        state.cifras4.page = 1;
        renderCifras4();
      });
    }

    // Buscador 3C
    const search3C = document.getElementById('search3C');
    if (search3C) {
      search3C.addEventListener('input', (e) => {
        state.cifras3.search = e.target.value.trim();
        state.cifras3.page = 1;
        renderCifras3();
      });
    }

    // Buscador 2C
    const search2C = document.getElementById('search2C');
    if (search2C) {
      search2C.addEventListener('input', (e) => {
        state.cifras2.search = e.target.value.trim();
        state.cifras2.page = 1;
        renderCifras2();
      });
    }

    // Selector de cantidad de filas en tabla Desglose Analítico Completo (KPIs)
    const selectLimitUltimos = document.getElementById('selectLimitUltimos');
    if (selectLimitUltimos) {
      selectLimitUltimos.addEventListener('change', (e) => {
        state.ultimos.limit = parseInt(e.target.value, 10) || 10;
        renderKPIs();
      });
    }

    // Check parametrizable: Distancias en conjunto (sorteo a sorteo) en modo Combinado
    const checksDistConjunto = [
      document.getElementById('checkDistConjunto'),
      document.getElementById('checkDistConjuntoTabDist')
    ].filter(Boolean);

    checksDistConjunto.forEach(chk => {
      chk.checked = state.combinadoDistEnConjunto;
      chk.addEventListener('change', (e) => {
        setCombinadoDistEnConjunto(e.target.checked);
      });
    });

    // Recargar Dashboard Clásico (Legacy)
    const btnReloadDashboardViejo = document.getElementById('btnReloadDashboardViejo');
    const frameDashboardViejo = document.getElementById('frameDashboardViejo');
    if (btnReloadDashboardViejo && frameDashboardViejo) {
      btnReloadDashboardViejo.addEventListener('click', () => {
        const src = frameDashboardViejo.src;
        frameDashboardViejo.src = '';
        setTimeout(() => {
          frameDashboardViejo.src = src;
        }, 50);
        mostrarToast('Recargando Dashboard Clásico...', 'info');
      });
    }

    // Selector de ventana en Matrices
    const matrixWindowSelect = document.getElementById('matrixWindowSelect');
    if (matrixWindowSelect) {
      matrixWindowSelect.addEventListener('change', (e) => {
        state.matrices.ventana = parseInt(e.target.value, 10);
        renderMatrices();
      });
    }

    // ── Selector de cifras / posición en Ranking Base 10 ───────────────────
    const btnsCifrasDB10 = document.querySelectorAll('[data-cifras-db10]');
    btnsCifrasDB10.forEach(btn => {
      btn.addEventListener('click', () => {
        state.distancias = state.distancias || {};
        state.distancias.cifras = parseInt(btn.getAttribute('data-cifras-db10'), 10);
        btnsCifrasDB10.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDistancias();
      });
    });

    const btnsPosicionDB10 = document.querySelectorAll('[data-posicion-db10]');
    btnsPosicionDB10.forEach(btn => {
      btn.addEventListener('click', () => {
        state.distancias = state.distancias || {};
        state.distancias.posicion = btn.getAttribute('data-posicion-db10');
        btnsPosicionDB10.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDistancias();
      });
    });

    // ── Buscador DB10 por dígitos ──────────────────────────────────────────
    const inputBuscadorDB10 = document.getElementById('inputBuscadorDB10');
    const btnBuscarDB10     = document.getElementById('btnBuscarDB10');
    const btnLimpiarDB10    = document.getElementById('btnLimpiarDB10');

    function ejecutarBusquedaDB10() {
      const q = (inputBuscadorDB10 ? inputBuscadorDB10.value.trim().replace(/[^0-9*]/g, '') : '');
      renderBuscadorDB10(q);
    }

    if (btnBuscarDB10) btnBuscarDB10.addEventListener('click', ejecutarBusquedaDB10);
    if (inputBuscadorDB10) {
      inputBuscadorDB10.addEventListener('keydown', e => { if (e.key === 'Enter') ejecutarBusquedaDB10(); });
    }
    if (btnLimpiarDB10) {
      btnLimpiarDB10.addEventListener('click', () => {
        if (inputBuscadorDB10) inputBuscadorDB10.value = '';
        const tbody = document.getElementById('tbodyBuscadorDB10');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:1rem;">Ingresa un patrón para buscar.</td></tr>';
      });
    }

    // Buscador de Vecinos y Distancias Base 10
    const btnSubVecinosNum = document.getElementById('btnSubVecinosNum');
    const btnSubVecinosB10 = document.getElementById('btnSubVecinosB10');
    const btnSubVecinosAmbos = document.getElementById('btnSubVecinosAmbos');
    const subBtnsVecinos = [btnSubVecinosNum, btnSubVecinosB10, btnSubVecinosAmbos];

    function setSubTabVecinos(mode) {
      state.vecinos.subTab = mode;
      subBtnsVecinos.forEach(b => {
        if (b) b.classList.toggle('active', b.getAttribute('data-subtab') === mode);
      });
      renderVecinos();
    }

    if (btnSubVecinosNum) btnSubVecinosNum.addEventListener('click', () => setSubTabVecinos('num'));
    if (btnSubVecinosB10) btnSubVecinosB10.addEventListener('click', () => setSubTabVecinos('b10'));
    if (btnSubVecinosAmbos) btnSubVecinosAmbos.addEventListener('click', () => setSubTabVecinos('ambos'));

    // Acciones Vecinos por Número
    const btnSearchVecinos = document.getElementById('btnSearchVecinos');
    const inputVecinos = document.getElementById('inputVecinos');
    const btnUltimoNumeroVecinos = document.getElementById('btnUltimoNumeroVecinos');

    if (btnSearchVecinos && inputVecinos) {
      btnSearchVecinos.addEventListener('click', () => {
        state.vecinos.query = inputVecinos.value.trim();
        renderVecinos();
      });
      inputVecinos.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          state.vecinos.query = inputVecinos.value.trim();
          renderVecinos();
        }
      });
    }

    if (btnUltimoNumeroVecinos) {
      btnUltimoNumeroVecinos.addEventListener('click', () => {
        const sorteos = obtenerSorteosFiltrados();
        if (sorteos && sorteos.length > 0) {
          state.vecinos.query = sorteos[0].n;
          if (inputVecinos) inputVecinos.value = state.vecinos.query;
          renderVecinos();
        }
      });
    }

    // Acciones Vecinos por Distancia Base 10
    const btnSearchVecinosB10 = document.getElementById('btnSearchVecinosB10');
    const inputVecinosB10 = document.getElementById('inputVecinosB10');
    const btnUltimaDB10Vecinos = document.getElementById('btnUltimaDB10Vecinos');

    if (btnSearchVecinosB10 && inputVecinosB10) {
      btnSearchVecinosB10.addEventListener('click', () => {
        state.vecinos.queryB10 = inputVecinosB10.value.trim();
        renderVecinos();
      });
      inputVecinosB10.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          state.vecinos.queryB10 = inputVecinosB10.value.trim();
          renderVecinos();
        }
      });
    }

    if (btnUltimaDB10Vecinos) {
      btnUltimaDB10Vecinos.addEventListener('click', () => {
        const sorteos = obtenerSorteosFiltrados();
        if (sorteos && sorteos.length > 0) {
          state.vecinos.queryB10 = sorteos[0].db10 || '';
          if (inputVecinosB10) inputVecinosB10.value = state.vecinos.queryB10;
          renderVecinos();
        }
      });
    }

    // Radiografía / Evaluador de Apuestas
    const btnRunEvaluador = document.getElementById('btnRunEvaluador');
    const inputEvaluador = document.getElementById('inputEvaluador');
    const btnCargarTxtEvaluador = document.getElementById('btnCargarTxtEvaluador');
    const fileTxtEvaluador = document.getElementById('fileTxtEvaluador');
    const btnLimpiarEvaluador = document.getElementById('btnLimpiarEvaluador');
    const searchEvaluador = document.getElementById('searchEvaluador');
    const btnClearSearchEvaluador = document.getElementById('btnClearSearchEvaluador');
    const evaluadorPageSizeSelect = document.getElementById('evaluadorPageSizeSelect');

    const btnRecargarDefaultEvaluador = document.getElementById('btnRecargarDefaultEvaluador');

    if (btnRunEvaluador && inputEvaluador) {
      btnRunEvaluador.addEventListener('click', () => {
        const raw = inputEvaluador.value;
        const tokens = raw.replace(/[\n\r,;]+/g, ' ').split(/\s+/).filter(Boolean);
        const unicos = [];
        const set = new Set();
        let repetidos = 0;

        tokens.forEach(tok => {
          const match = tok.match(/\d{4}/);
          if (match) {
            const num = match[0];
            if (!set.has(num)) {
              set.add(num);
              unicos.push(num);
            } else {
              repetidos++;
            }
          }
        });

        if (unicos.length > 0) {
          inputEvaluador.value = unicos.join(', ');
          state.evaluador.lista = unicos.join(', ');
        } else {
          state.evaluador.lista = raw;
        }

        if (repetidos > 0) {
          mostrarToast(`Se omitieron ${repetidos} número(s) repetido(s) en la lista`, 'info');
        }

        state.evaluador.page = 1;
        renderEvaluador();
      });
    }

    if (btnCargarTxtEvaluador && fileTxtEvaluador) {
      btnCargarTxtEvaluador.addEventListener('click', () => {
        fileTxtEvaluador.value = '';
        fileTxtEvaluador.click();
      });
      fileTxtEvaluador.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          procesarArchivosTxtEvaluador(e.target.files);
        }
      });
    }

    if (btnRecargarDefaultEvaluador) {
      btnRecargarDefaultEvaluador.addEventListener('click', () => {
        cargarListaPredeterminadaEvaluador(true);
      });
    }

    if (inputEvaluador) {
      inputEvaluador.addEventListener('dragover', (e) => {
        e.preventDefault();
        inputEvaluador.classList.add('dragover');
      });
      inputEvaluador.addEventListener('dragleave', () => {
        inputEvaluador.classList.remove('dragover');
      });
      inputEvaluador.addEventListener('drop', (e) => {
        e.preventDefault();
        inputEvaluador.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          procesarArchivosTxtEvaluador(e.dataTransfer.files);
        }
      });
    }

    if (btnLimpiarEvaluador && inputEvaluador) {
      btnLimpiarEvaluador.addEventListener('click', () => {
        inputEvaluador.value = '';
        state.evaluador.lista = '';
        state.evaluador.search = '';
        state.evaluador.page = 1;
        if (searchEvaluador) searchEvaluador.value = '';
        if (btnClearSearchEvaluador) btnClearSearchEvaluador.style.display = 'none';
        const fileStatus = document.getElementById('evaluadorFileStatus');
        if (fileStatus) fileStatus.style.display = 'none';
        const searchFeedback = document.getElementById('evaluadorSearchFeedback');
        if (searchFeedback) searchFeedback.style.display = 'none';
        renderEvaluador();
        mostrarToast('Lista de apuestas vaciada', 'info');
      });
    }

    if (searchEvaluador) {
      searchEvaluador.addEventListener('input', () => {
        state.evaluador.search = searchEvaluador.value.trim();
        state.evaluador.page = 1;
        if (btnClearSearchEvaluador) {
          btnClearSearchEvaluador.style.display = state.evaluador.search ? 'block' : 'none';
        }
        renderEvaluador();
      });
    }

    if (btnClearSearchEvaluador && searchEvaluador) {
      btnClearSearchEvaluador.addEventListener('click', () => {
        searchEvaluador.value = '';
        state.evaluador.search = '';
        state.evaluador.page = 1;
        btnClearSearchEvaluador.style.display = 'none';
        renderEvaluador();
        searchEvaluador.focus();
      });
    }

    if (evaluadorPageSizeSelect) {
      evaluadorPageSizeSelect.addEventListener('change', () => {
        state.evaluador.pageSize = parseInt(evaluadorPageSizeSelect.value, 10) || 25;
        state.evaluador.page = 1;
        renderEvaluador();
      });
    }

    // Cabeceras ordenables de la tabla Radiografía
    const tableEvaluador = document.getElementById('tableEvaluador');
    if (tableEvaluador) {
      const sortableHeaders = tableEvaluador.querySelectorAll('th.sortable-th');
      sortableHeaders.forEach(th => {
        th.addEventListener('click', () => {
          const col = th.getAttribute('data-sort');
          if (!col) return;
          if (state.evaluador.sortCol === col) {
            state.evaluador.sortAsc = !state.evaluador.sortAsc;
          } else {
            state.evaluador.sortCol = col;
            state.evaluador.sortAsc = (col === 'rank' || col === 'numero');
          }
          renderEvaluador();
        });
      });
    }

    // Cabeceras ordenables para tablas de 4 Cifras, 3 Cifras, 2 Cifras y 1 Cifra
    bindSortableTable('tableCifras4', state.cifras4, renderCifras4, ['num']);
    bindSortableTable('tableCifras3', state.cifras3, renderCifras3, ['num']);
    bindSortableTable('tableCifras2', state.cifras2, renderCifras2, ['num']);
    bindSortableTable('tableCifras1', state.cifras1, renderCifras1, ['num']);

    // Eventos del Laboratorio Cuantitativo (ML)
    const selectQuantWindow = document.getElementById('selectQuantWindow');
    if (selectQuantWindow) {
      selectQuantWindow.addEventListener('change', (e) => {
        state.quant.evalWindow = parseInt(e.target.value, 10) || 300;
        state.quant.cacheKey = null;
        cargarYRenderizarQuant(true);
      });
    }

    const btnRunQuant = document.getElementById('btnRunQuant');
    if (btnRunQuant) {
      btnRunQuant.addEventListener('click', () => {
        state.quant.cacheKey = null;
        cargarYRenderizarQuant(true);
      });
    }

    const btnsQPort = document.querySelectorAll('[data-qport]');
    btnsQPort.forEach(btn => {
      btn.addEventListener('click', () => {
        state.quant.portfolioMode = btn.getAttribute('data-qport') || 'diversificada';
        btnsQPort.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderQuant();
      });
    });

    const btnExportQuantPw = document.getElementById('btnExportQuantPlaywright');
    if (btnExportQuantPw) {
      btnExportQuantPw.addEventListener('click', ejecutarExportacionQuantPlaywright);
    }

    // Predictor Secuencial (Punto de análisis / Simulación)
    const selectSorteoSecuencial = document.getElementById('selectSorteoSecuencial');
    const btnResetSorteoSecuencial = document.getElementById('btnResetSorteoSecuencial');

    if (selectSorteoSecuencial) {
      selectSorteoSecuencial.addEventListener('change', (e) => {
        state.secuencial.targetIdx = parseInt(e.target.value, 10) || 0;
        delete state.calculos.secuencial;
        delete state.calculos.top8Convergencia;
        renderTabActual();
      });
    }

    if (btnResetSorteoSecuencial) {
      btnResetSorteoSecuencial.addEventListener('click', () => {
        state.secuencial.targetIdx = 0;
        if (selectSorteoSecuencial) selectSorteoSecuencial.value = '0';
        delete state.calculos.secuencial;
        delete state.calculos.top8Convergencia;
        renderTabActual();
        mostrarToast('Regresando al sorteo actual en vivo', 'info');
      });
    }

    // Exportación de Fichero de Boletos (.txt / Portapapeles)
    const inputRutaExportFichero = document.getElementById('inputRutaExportFichero');
    if (inputRutaExportFichero) {
      inputRutaExportFichero.addEventListener('input', (e) => {
        state.secuencial.rutaFichero = e.target.value.trim() || 'lista_numeros-3.txt';
      });
    }

    const btnCopiarFicheroPw = document.getElementById('btnCopiarFicheroPlaywright');
    if (btnCopiarFicheroPw) {
      btnCopiarFicheroPw.addEventListener('click', copiarFicheroApuestasAlPortapapeles);
    }

    const btnGuardarListaNube = document.getElementById('btnGuardarListaNube');
    if (btnGuardarListaNube) {
      btnGuardarListaNube.addEventListener('click', guardarListaUsuarioEnNube);
    }

    const btnGenerarRandomCifras = document.getElementById('btnGenerarRandomCifras');
    if (btnGenerarRandomCifras) {
      btnGenerarRandomCifras.addEventListener('click', () => {
        state.secuencial.randomCifras = {
          d2: Math.floor(Math.random() * 10),
          d3: Math.floor(Math.random() * 10)
        };
        actualizarPreviewFichero();
        const gen = generarContenidoFicheroApuestas();
        mostrarToast(`Nuevas cifras 2 y 3: ${state.secuencial.randomCifras.d2} y ${state.secuencial.randomCifras.d3} (Comodín: ${gen ? gen.numEspecial : '----'})`, 'info');
      });
    }

    const btnTogglePreviewFichero = document.getElementById('btnTogglePreviewFichero');
    if (btnTogglePreviewFichero) {
      btnTogglePreviewFichero.addEventListener('click', () => {
        state.secuencial.showPreview = !state.secuencial.showPreview;
        actualizarPreviewFichero();
      });
    }

    const btnExportarFicheroPlaywright = document.getElementById('btnExportarFicheroPlaywright');
    if (btnExportarFicheroPlaywright) {
      btnExportarFicheroPlaywright.addEventListener('click', ejecutarExportacionFicheroPlaywright);
    }

    // Predictor Polinómico (Ventana, Modo de Gráficos y Simulación Histórica)
    const btnsPolyWin = document.querySelectorAll('[data-poly-win]');
    btnsPolyWin.forEach(btn => {
      btn.addEventListener('click', () => {
        state.polinomico.windowSize = parseInt(btn.getAttribute('data-poly-win'), 10) || 5;
        btnsPolyWin.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        delete state.calculos.polinomico;
        renderTabActual();
      });
    });

    const btnsPolyChart = document.querySelectorAll('[data-poly-chart]');
    btnsPolyChart.forEach(btn => {
      btn.addEventListener('click', () => {
        state.polinomico.chartMode = btn.getAttribute('data-poly-chart') || 'both';
        btnsPolyChart.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPolinomico();
      });
    });

    const selectSorteoPolinomico = document.getElementById('selectSorteoPolinomico');
    if (selectSorteoPolinomico) {
      selectSorteoPolinomico.addEventListener('change', (e) => {
        state.polinomico.targetIdx = parseInt(e.target.value, 10) || 0;
        delete state.calculos.polinomico;
        renderTabActual();
      });
    }

    const btnResetSorteoPolinomico = document.getElementById('btnResetSorteoPolinomico');
    if (btnResetSorteoPolinomico) {
      btnResetSorteoPolinomico.addEventListener('click', () => {
        state.polinomico.targetIdx = 0;
        if (selectSorteoPolinomico) selectSorteoPolinomico.value = '0';
        delete state.calculos.polinomico;
        renderTabActual();
        mostrarToast('Regresando al sorteo actual en vivo (Polinómico)', 'info');
      });
    }

    // Predictor Adaptativo & Módulo Semanal / Rango de Días
    const btnsAdpH = document.querySelectorAll('[data-adp-h]');
    btnsAdpH.forEach(btn => {
      btn.addEventListener('click', () => {
        state.adaptativo.horizonte = parseInt(btn.getAttribute('data-adp-h'), 10) || 7;
        btnsAdpH.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        delete state.calculos.adaptativo;
        renderTabActual();
      });
    });

    const btnsAdpPos = document.querySelectorAll('[data-adp-pos]');
    btnsAdpPos.forEach(btn => {
      btn.addEventListener('click', () => {
        state.adaptativo.pesosPos = parseInt(btn.getAttribute('data-adp-pos'), 10) || 0;
        btnsAdpPos.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderAdaptativo();
      });
    });

    const selectSorteoAdaptativo = document.getElementById('selectSorteoAdaptativo');
    if (selectSorteoAdaptativo) {
      selectSorteoAdaptativo.addEventListener('change', (e) => {
        state.adaptativo.targetIdx = parseInt(e.target.value, 10) || 0;
        delete state.calculos.adaptativo;
        renderTabActual();
      });
    }

    const btnResetSorteoAdaptativo = document.getElementById('btnResetSorteoAdaptativo');
    if (btnResetSorteoAdaptativo) {
      btnResetSorteoAdaptativo.addEventListener('click', () => {
        state.adaptativo.targetIdx = 0;
        if (selectSorteoAdaptativo) selectSorteoAdaptativo.value = '0';
        delete state.calculos.adaptativo;
        renderTabActual();
        mostrarToast('Regresando al sorteo actual en vivo (Adaptativo)', 'info');
      });
    }
  }

  // ============================================================================
  // CARGA DE DATOS
  // ============================================================================

  function cargarScriptOfflineDatos() {
    return new Promise((resolve) => {
      if (window.LOTERIA_DATA) {
        resolve(window.LOTERIA_DATA);
        return;
      }
      const script = document.createElement('script');
      script.src = 'data/loteria_data.js';
      script.onload = () => resolve(window.LOTERIA_DATA || null);
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
    });
  }

  function construirCombinadosDesdeBase(dataObj) {
    if (!dataObj) return [];
    if (Array.isArray(dataObj.combinados) && dataObj.combinados.length > 0) {
      return dataObj.combinados;
    }
    const luna = dataObj.luna || [];
    const sol = dataObj.sol || [];
    const merged = luna.concat(sol);
    merged.sort((a, b) => {
      if (a.f !== b.f) return a.f < b.f ? 1 : -1;
      const wa = a.l === 'luna' ? 2 : 1;
      const wb = b.l === 'luna' ? 2 : 1;
      return wb - wa;
    });
    dataObj.combinados = merged;
    return merged;
  }

  async function cargarDatos() {
    mostrarToast('Cargando registros históricos desde Supabase...', 'info');
    try {
      const res = await apiFetch(`/api/datos?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        state.data = await res.json();
        setOnlineStatus(true, 'Conectado a Supabase');
      } else if (res.status === 401 || res.status === 403) {
        setOnlineStatus(false, 'Sesión requerida');
        return;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      setOnlineStatus(false, 'Error de conexión');
      mostrarToast(`No se pudieron cargar los datos: ${err.message}`, 'error');
      return;
    }

    // Construir combinados en memoria (<5ms) si el payload compacto no los duplica
    construirCombinadosDesdeBase(state.data);

    // Invalidar cachés al recargar datos
    state.combinadosConjuntoCache = null;
    state.quant.cacheKey = null;

    actualizarVisibilidadCheckCombinado();
    actualizarMetadataHeader();
    
    // Inicializar por default con el último sorteo de la lotería activa
    const sorteosInit = obtenerSorteosFiltrados();
    if (sorteosInit && sorteosInit.length > 0) {
      if (!state.vecinos.query) {
        state.vecinos.query = sorteosInit[0].n;
        const inputVecinos = document.getElementById('inputVecinos');
        if (inputVecinos) inputVecinos.value = state.vecinos.query;
      }
      if (!state.vecinos.queryB10) {
        state.vecinos.queryB10 = sorteosInit[0].db10 || '';
        const inputVecinosB10 = document.getElementById('inputVecinosB10');
        if (inputVecinosB10) inputVecinosB10.value = state.vecinos.queryB10;
      }
    }

    recalcularYRenderizar();
    await cargarListaPredeterminadaEvaluador(false);
    mostrarToast('Datos cargados exitosamente', 'success');
  }

  function setOnlineStatus(online, mensaje) {
    if (dom.statusDot) {
      dom.statusDot.classList.toggle('offline', !online);
    }
    if (dom.statusText) {
      dom.statusText.textContent = mensaje;
    }
  }

  function actualizarMetadataHeader() {
    if (!state.data || !state.data.metadata) return;
    const m = state.data.metadata;
    if (dom.lastUpdateText) {
      dom.lastUpdateText.textContent = m.generado_el || 'Reciente';
    }
    if (dom.totalDrawsText) {
      const tot = (state.loteria === 'luna') ? m.total_luna :
                  (state.loteria === 'sol') ? m.total_sol : m.total_combinados;
      dom.totalDrawsText.textContent = (tot || 0).toLocaleString();
    }

    const ultObj = (state.loteria === 'luna') ? m.ultimo_luna :
                   (state.loteria === 'sol') ? m.ultimo_sol : obtenerSorteosActivosBase()[0];
    if (ultObj) {
      const bNum = document.getElementById('badgeUltimoSorteoRef');
      if (bNum) bNum.textContent = `${ultObj.n} (${ultObj.s || ''})`;
      const bB10 = document.getElementById('badgeUltimaDB10Ref');
      if (bB10) bB10.textContent = `DB10: ${ultObj.db10 || '-'}`;
    }
  }

  // ============================================================================
  // GESTIÓN DE ESTADO Y FILTRADO
  // ============================================================================

  function setLoteria(tipo) {
    state.loteria = tipo;
    [dom.btnLuna, dom.btnSol, dom.btnComb].forEach(b => b.classList.remove('active'));
    if (tipo === 'luna') dom.btnLuna.classList.add('active');
    else if (tipo === 'sol') dom.btnSol.classList.add('active');
    else dom.btnComb.classList.add('active');

    // Cambiar sugeridos en vecinos al último sorteo de la nueva lotería seleccionada
    const sorteos = obtenerSorteosFiltrados();
    if (sorteos && sorteos.length > 0) {
      state.vecinos.query = sorteos[0].n;
      state.vecinos.queryB10 = sorteos[0].db10 || '';
      const inputVecinos = document.getElementById('inputVecinos');
      if (inputVecinos) inputVecinos.value = state.vecinos.query;
      const inputVecinosB10 = document.getElementById('inputVecinosB10');
      if (inputVecinosB10) inputVecinosB10.value = state.vecinos.queryB10;
    }

    actualizarVisibilidadCheckCombinado();
    actualizarMetadataHeader();
    recalcularYRenderizar();
  }

  function actualizarVisibilidadCheckCombinado() {
    const esCombinado = state.loteria === 'combinados';
    const wraps = [
      document.getElementById('wrapCheckDistConjunto'),
      document.getElementById('wrapCheckDistConjuntoTabDist')
    ];
    wraps.forEach(el => {
      if (el) el.style.display = esCombinado ? 'inline-flex' : 'none';
    });
    const checks = [
      document.getElementById('checkDistConjunto'),
      document.getElementById('checkDistConjuntoTabDist')
    ];
    checks.forEach(chk => {
      if (chk) chk.checked = state.combinadoDistEnConjunto;
    });
  }

  function setCombinadoDistEnConjunto(enConjunto) {
    state.combinadoDistEnConjunto = Boolean(enConjunto);
    actualizarVisibilidadCheckCombinado();

    if (state.loteria === 'combinados') {
      const sorteos = obtenerSorteosFiltrados();
      if (sorteos && sorteos.length > 0) {
        state.vecinos.queryB10 = sorteos[0].db10 || '';
        const inputVecinosB10 = document.getElementById('inputVecinosB10');
        if (inputVecinosB10) inputVecinosB10.value = state.vecinos.queryB10;
      }
      actualizarMetadataHeader();
      recalcularYRenderizar();
      mostrarToast(
        state.combinadoDistEnConjunto
          ? 'Distancias calculadas en conjunto (sorteo a sorteo)'
          : 'Distancias calculadas por lotería individual (Luna vs Luna, Sol vs Sol)',
        'info'
      );
    }
  }

  function setTab(tabId) {
    state.tab = tabId;
    document.querySelectorAll('.nav-item[data-tab]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + tabId);
    });

    // Actualizar títulos de header
    const titulos = {
      kpis: ['Visión General & KPIs', 'Resumen ejecutivo de métricas clave y últimos sorteos'],
      cifras4: ['Análisis 4 Cifras (0000-9999)', 'Radiografía completa de números de 4 dígitos, atrasos y frecuencias (Hoja 4C)'],
      cifras3: ['Análisis 3 Cifras (000-999)', 'Comportamiento de los 3 Primeros y 3 Últimos dígitos (Hoja 3C)'],
      cifras2: ['Análisis 2 Cifras (00-99)', 'Comportamiento de los 2 Primeros, Centro y 2 Últimos (Hoja 2C)'],
      cifras1: ['Análisis 1 Cifra (0-9)', 'Frecuencia y atrasos posicionales con Score Ponderado (Hoja 1C)'],
      matrices: ['Matrices de Posición y Calor', 'Distribución porcentual por dígitos y ventanas de 10, 100, 1000 días (Hoja Matrices)'],
      distancias: ['Distancias & Base 10', 'Saltos modulares, tuplas repetidas y patrones en Base 10 (Hojas Distancias)'],
      vecinos: ['Buscador de Vecinos (Números y Distancias Base 10)', 'Historial de transiciones con sorteo anterior, posterior e intervalos (Hoja anterior_proximo y Base 10)'],
      evaluador: ['Radiografía de Apuestas', 'Evaluador rápido de listas de números con score estadístico (tabla_analisis_numeros.py)'],
      pronosticos: ['Pronósticos & Proyecciones', 'Modelado algorítmico combinando calor reciente, distancias y atrasos óptimos'],
      secuencial: ['Predictor Secuencial', 'Análisis de patrones hacia atrás (N-gramas) y predicción según repeticiones históricas'],
      polinomico: ['Predictor Polinómico + Híbrido Secuencial', 'Modelado de dígitos en aumento modular (Base 10) con 4 fórmulas polinómicas + F5 Híbrida Secuencial'],
      adaptativo: ['Predictor Adaptativo & Módulo Semanal', 'Ensamble bayesiano día a día (10 expertos + contexto Sol↔Luna) y proyecciones por rango de días'],
      quant: ['Laboratorio Cuantitativo & ML', 'Auditoría forense (χ², FDR, CUSUM), Arena Walk-Forward de 6 modelos y Cartera Óptima 2C/3C']
    };

    if (titulos[tabId]) {
      dom.pageTitle.textContent = titulos[tabId][0];
      dom.pageSub.textContent = titulos[tabId][1];
    }

    renderTabActual();
  }

  function obtenerSorteosActivosBase() {
    if (!state.data) return [];
    if (state.loteria === 'combinados' && state.combinadoDistEnConjunto) {
      if (!state.combinadosConjuntoCache) {
        const rawComb = state.data.combinados || [];
        state.combinadosConjuntoCache = (typeof AstroEngine.recalcularMetricasEnConjunto === 'function')
          ? AstroEngine.recalcularMetricasEnConjunto(rawComb)
          : rawComb;
      }
      return state.combinadosConjuntoCache;
    }
    return state.data[state.loteria] || [];
  }

  function obtenerSorteosFiltrados() {
    let list = obtenerSorteosActivosBase();
    if (state.timeWindow !== 'all') {
      const dias = parseInt(state.timeWindow, 10);
      list = list.slice(0, dias);
    }
    return list;
  }

  function recalcularYRenderizar() {
    // Invalidar caché perezosa: cada pestaña calcula solo lo que necesita al renderizarse
    state.calculos = {};
    state.quant.cacheKey = null;
    renderTabActual();
  }

  function ensureCalculosParaTab(tabId) {
    const sorteos = obtenerSorteosFiltrados();
    if (!sorteos.length) return;

    if ((tabId === 'kpis' || tabId === 'cifras4') && !state.calculos.cifras4) {
      state.calculos.cifras4 = AstroEngine.computeCifras4(sorteos);
    }
    if (tabId === 'cifras3' && !state.calculos.cifras3) {
      state.calculos.cifras3 = AstroEngine.computeCifras3(sorteos);
    }
    if (tabId === 'cifras2' && !state.calculos.cifras2) {
      state.calculos.cifras2 = AstroEngine.computeCifras2(sorteos);
    }
    if (tabId === 'cifras1' && !state.calculos.cifras1) {
      state.calculos.cifras1 = AstroEngine.computeCifras1(sorteos);
    }
    if (tabId === 'matrices' && !state.calculos.matrices) {
      state.calculos.matrices = AstroEngine.computeMatrices(sorteos);
    }
    if (tabId === 'distancias' && !state.calculos.distancias) {
      state.calculos.distancias = AstroEngine.computeDistancias(sorteos);
    }
    if (tabId === 'pronosticos' && !state.calculos.pronosticos) {
      state.calculos.pronosticos = AstroEngine.computePronosticos(sorteos);
      if (typeof AstroEngine.computePronosticosJEV === 'function') {
        state.calculos.pronosticosJEV = AstroEngine.computePronosticosJEV(sorteos);
      }
      if (typeof AstroEngine.computePronosticosJEVPrimeras === 'function') {
        state.calculos.pronosticosJEVPrimeras = AstroEngine.computePronosticosJEVPrimeras(sorteos);
      }
      if (typeof AstroEngine.computePronosticosJEVSignos === 'function') {
        state.calculos.pronosticosJEVSignos = AstroEngine.computePronosticosJEVSignos(sorteos);
      }
      if (typeof AstroEngine.computeCombinacionesTop5 === 'function') {
        state.calculos.combinacionesTop5 = AstroEngine.computeCombinacionesTop5(
          sorteos,
          state.calculos.pronosticosJEVPrimeras,
          state.calculos.pronosticosJEV,
          state.calculos.pronosticosJEVSignos
        );
      }
    }
    if (tabId === 'secuencial') {
      if (!state.calculos.secuencial && typeof AstroEngine.computePredictorSecuencial === 'function') {
        state.calculos.secuencial = AstroEngine.computePredictorSecuencial(
          sorteos,
          state.secuencial.targetIdx,
          state.secuencial.maxDepth
        );
      }
      if (!state.calculos.top8Convergencia && typeof AstroEngine.computeConvergenciaEntropica === 'function') {
        state.calculos.top8Convergencia = AstroEngine.computeConvergenciaEntropica(
          sorteos,
          state.secuencial.targetIdx
        );
      }
    }
    if (tabId === 'polinomico' && !state.calculos.polinomico) {
      if (window.AstroPolynomial && typeof window.AstroPolynomial.computePredictorPolinomico === 'function') {
        state.calculos.polinomico = window.AstroPolynomial.computePredictorPolinomico(
          sorteos,
          state.polinomico.targetIdx,
          state.polinomico.windowSize
        );
      }
    }
    if (tabId === 'adaptativo' && !state.calculos.adaptativo) {
      if (window.AstroAdaptive && typeof window.AstroAdaptive.compute === 'function') {
        const otra = state.data
          ? (state.loteria === 'luna' ? state.data.sol : (state.loteria === 'sol' ? state.data.luna : null))
          : null;
        state.calculos.adaptativo = window.AstroAdaptive.compute(sorteos, {
          targetIdx: state.adaptativo.targetIdx,
          loteria: state.loteria,
          otra: otra,
          horizonte: state.adaptativo.horizonte
        });
      }
    }
  }

  function renderTabActual() {
    ensureCalculosParaTab(state.tab);
    switch (state.tab) {
      case 'kpis': renderKPIs(); break;
      case 'cifras4': renderCifras4(); break;
      case 'cifras3': renderCifras3(); break;
      case 'cifras2': renderCifras2(); break;
      case 'cifras1': renderCifras1(); break;
      case 'matrices': renderMatrices(); break;
      case 'distancias': renderDistancias(); break;
      case 'vecinos': renderVecinos(); break;
      case 'evaluador': renderEvaluador(); break;
      case 'pronosticos': renderPronosticos(); break;
      case 'secuencial': renderSecuencial(); break;
      case 'polinomico': renderPolinomico(); break;
      case 'adaptativo': renderAdaptativo(); break;
      case 'quant': cargarYRenderizarQuant(false); break;
    }
  }

  // ============================================================================
  // RENDERS DE VISTAS INDIVIDUALES
  // ============================================================================

  // 1. KPIs & Visión General
  function renderKPIs() {
    const sorteos = obtenerSorteosFiltrados();
    if (!sorteos.length) return;
    const ultimo = sorteos[0];
    const anterior = sorteos[1];

    // Banner de Último Sorteo
    const banner = document.getElementById('lastDrawBanner');
    if (banner) {
      banner.innerHTML = `
        <div class="draw-info">
          <h3>ÚLTIMO RESULTADO REGISTRADO</h3>
          <div class="draw-date">${formatearFechaHumana(ultimo.f)} &bull; ${ultimo.l.toUpperCase()}</div>
        </div>
        <div class="draw-balls">
          <div class="ball">${ultimo.d[0]}</div>
          <div class="ball">${ultimo.d[1]}</div>
          <div class="ball">${ultimo.d[2]}</div>
          <div class="ball">${ultimo.d[3]}</div>
          <div class="sign-badge">${renderSignoWithIcon(ultimo.s, 18)}</div>
        </div>
        <div class="draw-calcs">
          ${state.loteria === 'combinados'
            ? `<div class="draw-calcs-mode">${state.combinadoDistEnConjunto ? '⚡ En conjunto (sorteo a sorteo)' : '🔀 Por lotería individual'}</div>`
            : ''}
          <div>Calc_Diferencias: <code>${ultimo.c.join('-')}</code></div>
          <div>Distancias (0-5): <code>${ultimo.dist.join('-')}</code></div>
          <div>Distancia Base10: <code>${ultimo.db10}</code></div>
        </div>
      `;
    }

    // Tarjetas KPI
    const c4 = state.calculos.cifras4 || [];
    const nuncaSalieron = c4.filter(x => x.freq === 0).length;
    const salieronAlgunaVez = 10000 - nuncaSalieron;

    // Número más caliente en 4C
    const masCaliente4C = c4.slice().sort((a, b) => b.freq - a.freq)[0];
    // Número más atrasado en 4C (de los que han salido)
    const salidos = c4.filter(x => x.freq > 0);
    const masAtrasado4C = salidos.slice().sort((a, b) => b.sorteosAtraso - a.sorteosAtraso)[0];

    document.getElementById('kpiTotalSorteos').textContent = sorteos.length.toLocaleString();
    document.getElementById('kpiNumerosSinSalir').textContent = nuncaSalieron.toLocaleString();
    document.getElementById('kpiPctCobertura').textContent = ((salieronAlgunaVez / 10000) * 100).toFixed(1) + '%';
    
    if (masCaliente4C) {
      document.getElementById('kpiMasCaliente').textContent = masCaliente4C.num;
      document.getElementById('kpiMasCalienteSub').textContent = `${masCaliente4C.freq} veces`;
    }
    if (masAtrasado4C) {
      document.getElementById('kpiMasAtrasado').textContent = masAtrasado4C.num;
      document.getElementById('kpiMasAtrasadoSub').textContent = `Hace ${masAtrasado4C.sorteosAtraso} sorteos (${masAtrasado4C.diasAtraso} días)`;
    }

    // Tabla de Últimos Sorteos (Desglose Analítico Completo)
    const tbodyUltimos = document.getElementById('tbodyUltimos10');
    if (tbodyUltimos) {
      const limit = (state.ultimos && state.ultimos.limit) ? state.ultimos.limit : 10;
      const items = sorteos.slice(0, limit);

      // Actualizar título y contador
      const titleEl = document.getElementById('titleUltimosSorteos');
      if (titleEl) {
        titleEl.textContent = limit >= sorteos.length
          ? `Todos los Sorteos (${sorteos.length.toLocaleString()}) — Desglose Analítico Completo`
          : `Últimos ${items.length} Sorteos (Desglose Analítico Completo)`;
      }
      const countEl = document.getElementById('countUltimosSorteos');
      if (countEl) {
        countEl.textContent = `Mostrando ${items.length.toLocaleString()} de ${sorteos.length.toLocaleString()}`;
      }

      tbodyUltimos.innerHTML = items.map((s, idx) => `
        <tr>
          <td><span class="col-mono">${s.f}</span></td>
          <td><span class="badge ${s.l === 'luna' ? 'badge-info' : 'badge-warning'}">${s.l.toUpperCase()}</span></td>
          <td><span class="number-pill">${s.n}</span></td>
          <td><span class="sign-badge" style="padding:0.2rem 0.5rem;font-size:0.75rem;">${renderSignoWithIcon(s.s, 14)}</span></td>
          <td class="col-mono">${s.d[0]} | ${s.d[1]} | ${s.d[2]} | ${s.d[3]}</td>
          <td class="col-mono">${s.c.join('-')}</td>
          <td class="col-mono">${s.dist.join('-')}</td>
          <td class="col-mono">${s.db10}</td>
        </tr>
      `).join('');
    }
  }

  // 2. Análisis 4 Cifras (Hoja 4C)
  function renderCifras4() {
    let data = state.calculos.cifras4 || [];
    const cfg = state.cifras4;

    // Filtros
    if (cfg.search) {
      data = data.filter(x => x.num.includes(cfg.search));
    }
    if (cfg.filterNever) {
      data = data.filter(x => x.freq === 0);
    }

    // Ordenamiento
    data = data.slice().sort((a, b) => {
      let va = a[cfg.sortCol], vb = b[cfg.sortCol];
      if (va === null || va === undefined) va = '';
      if (vb === null || vb === undefined) vb = '';
      if (typeof va === 'string') return cfg.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return cfg.sortAsc ? va - vb : vb - va;
    });

    updateSortHeaderIcons('tableCifras4', cfg);

    // Paginación
    const total = data.length;
    const totalPages = Math.ceil(total / cfg.pageSize) || 1;
    cfg.page = Math.min(cfg.page, totalPages);
    const start = (cfg.page - 1) * cfg.pageSize;
    const pageItems = data.slice(start, start + cfg.pageSize);

    // Contadores
    const countInfo = document.getElementById('countCifras4');
    if (countInfo) countInfo.textContent = `Mostrando ${start + 1}-${Math.min(start + cfg.pageSize, total)} de ${total} registros`;

    const tbody = document.getElementById('tbodyCifras4');
    if (tbody) {
      tbody.innerHTML = pageItems.map(item => `
        <tr>
          <td><span class="number-pill">${item.num}</span></td>
          <td class="col-mono">${item.freq}</td>
          <td class="col-mono">${item.freq === 0 ? '<span class="badge badge-warning">NUNCA</span>' : item.diasAtraso + ' días'}</td>
          <td class="col-mono">${item.freq === 0 ? '-' : item.sorteosAtraso + ' sorteos'}</td>
          <td>${item.ultimaFecha || '<span style="color:var(--text-dim)">Sin registro</span>'}</td>
          <td class="col-mono">${item.freq10}</td>
          <td class="col-mono">${item.freq100}</td>
          <td class="col-mono">${item.freq1000}</td>
        </tr>
      `).join('');
    }

    renderPaginationControls('paginationCifras4', cfg, totalPages, renderCifras4);
  }

  // Helpers de ordenamiento de cabeceras de tablas
  function bindSortableTable(tableId, cfg, renderFn, ascDefaultCols = []) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('th.sortable-th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (!col) return;
        if (cfg.sortCol === col) {
          cfg.sortAsc = !cfg.sortAsc;
        } else {
          cfg.sortCol = col;
          cfg.sortAsc = ascDefaultCols.includes(col);
        }
        if (typeof cfg.page === 'number') cfg.page = 1;
        renderFn();
      });
    });
  }

  function updateSortHeaderIcons(tableId, cfg) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('th.sortable-th').forEach(th => {
      const col = th.getAttribute('data-sort');
      const icon = th.querySelector('.sort-icon');
      if (col === cfg.sortCol) {
        th.classList.add('active-sort');
        if (icon) icon.textContent = cfg.sortAsc ? '▲' : '▼';
      } else {
        th.classList.remove('active-sort');
        if (icon) icon.textContent = '↕';
      }
    });
  }

  // 3. Análisis 3 Cifras (Hoja 3C)
  function renderCifras3() {
    let data = state.calculos.cifras3 || [];
    const cfg = state.cifras3;

    if (cfg.search) {
      data = data.filter(x => x.num.includes(cfg.search));
    }

    data = data.slice().sort((a, b) => {
      let va = a[cfg.sortCol], vb = b[cfg.sortCol];
      if (typeof va === 'string') return cfg.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return cfg.sortAsc ? va - vb : vb - va;
    });

    updateSortHeaderIcons('tableCifras3', cfg);

    const total = data.length;
    const totalPages = Math.ceil(total / cfg.pageSize) || 1;
    cfg.page = Math.min(cfg.page, totalPages);
    const start = (cfg.page - 1) * cfg.pageSize;
    const pageItems = data.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('tbodyCifras3');
    if (tbody) {
      tbody.innerHTML = pageItems.map(item => `
        <tr>
          <td><span class="number-pill">${item.num}</span></td>
          <td class="col-mono">${item.freqIni}</td>
          <td class="col-mono">${item.diasIni} días (${item.atrasoIni} sort.)</td>
          <td class="col-mono" style="border-left:1px solid var(--border-subtle);">${item.freqFin}</td>
          <td class="col-mono">${item.diasFin} días (${item.atrasoFin} sort.)</td>
        </tr>
      `).join('');
    }

    renderPaginationControls('paginationCifras3', cfg, totalPages, renderCifras3);
  }

  // 4. Análisis 2 Cifras (Hoja 2C)
  function renderCifras2() {
    let data = state.calculos.cifras2 || [];
    const cfg = state.cifras2;

    if (cfg.search) {
      data = data.filter(x => x.num.includes(cfg.search));
    }

    data = data.slice().sort((a, b) => {
      let va = a[cfg.sortCol], vb = b[cfg.sortCol];
      if (typeof va === 'string') return cfg.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return cfg.sortAsc ? va - vb : vb - va;
    });

    updateSortHeaderIcons('tableCifras2', cfg);

    const total = data.length;
    const totalPages = Math.ceil(total / cfg.pageSize) || 1;
    cfg.page = Math.min(cfg.page, totalPages);
    const start = (cfg.page - 1) * cfg.pageSize;
    const pageItems = data.slice(start, start + cfg.pageSize);

    const tbody = document.getElementById('tbodyCifras2');
    if (tbody) {
      tbody.innerHTML = pageItems.map(item => `
        <tr>
          <td><span class="number-pill">${item.num}</span></td>
          <td class="col-mono">${item.freqIni}</td>
          <td class="col-mono">${item.diasIni}d <span style="font-size:0.7rem;color:var(--text-dim)">(${item.atrasoIni}s)</span></td>
          <td class="col-mono" style="border-left:1px solid var(--border-subtle);">${item.freqMid}</td>
          <td class="col-mono">${item.diasMid}d <span style="font-size:0.7rem;color:var(--text-dim)">(${item.atrasoMid}s)</span></td>
          <td class="col-mono" style="border-left:1px solid var(--border-subtle);">${item.freqFin}</td>
          <td class="col-mono">${item.diasFin}d <span style="font-size:0.7rem;color:var(--text-dim)">(${item.atrasoFin}s)</span></td>
          <td class="col-mono" style="border-left:1px solid var(--border-subtle);font-weight:700;color:var(--accent-cyan)">${item.totalFreq}</td>
        </tr>
      `).join('');
    }

    renderPaginationControls('paginationCifras2', cfg, totalPages, renderCifras2);
  }

  // Helper de badge de atraso para 1 Cifra (verde si muy reciente, rojo si muy atrasado)
  function renderAtraso1CBadge(posData) {
    const atraso = posData.atraso;
    const dias = posData.dias;
    if (atraso <= 2) {
      const title = atraso === 0 ? 'Salió en el último sorteo' : `Muy reciente (${atraso} sorteos)`;
      return `<span class="delay-badge delay-recent" title="${title}"><span class="delay-dot"></span>${dias}d <span class="delay-sub">(${atraso}s)</span></span>`;
    }
    if (atraso >= 15) {
      return `<span class="delay-badge delay-overdue" title="Muy atrasado (${atraso} sorteos)"><span class="delay-dot"></span>${dias}d <span class="delay-sub">(${atraso}s)</span></span>`;
    }
    return `${dias}d <span style="font-size:0.7rem;color:var(--text-dim)">(${atraso}s)</span>`;
  }

  function getSortVal1C(item, col) {
    if (col === 'num') return parseInt(item.num, 10);
    const m = col.match(/^p([0-3])_(freq|atraso|score|dias)$/);
    if (m) {
      const posIdx = parseInt(m[1], 10);
      const metric = m[2];
      return item.pos[posIdx][metric] ?? 0;
    }
    return 0;
  }

  // 5. Análisis 1 Cifra (Hoja 1C)
  function renderCifras1() {
    let data = state.calculos.cifras1 || [];
    const cfg = state.cifras1;

    data = data.slice().sort((a, b) => {
      const va = getSortVal1C(a, cfg.sortCol);
      const vb = getSortVal1C(b, cfg.sortCol);
      return cfg.sortAsc ? va - vb : vb - va;
    });

    updateSortHeaderIcons('tableCifras1', cfg);

    const tbody = document.getElementById('tbodyCifras1');
    if (!tbody) return;

    tbody.innerHTML = data.map(item => `
      <tr>
        <td><div class="ball" style="width:36px;height:36px;font-size:1.1rem;margin:auto;">${item.num}</div></td>
        <!-- Posición 1 -->
        <td class="col-mono">${item.pos[0].freq}</td>
        <td class="col-mono">${renderAtraso1CBadge(item.pos[0])}</td>
        <td class="col-mono"><span class="kpi-badge badge-primary">${item.pos[0].score.toFixed(1)}%</span></td>
        <!-- Posición 2 -->
        <td class="col-mono" style="border-left:1px solid var(--border-subtle);">${item.pos[1].freq}</td>
        <td class="col-mono">${renderAtraso1CBadge(item.pos[1])}</td>
        <td class="col-mono"><span class="kpi-badge badge-primary">${item.pos[1].score.toFixed(1)}%</span></td>
        <!-- Posición 3 -->
        <td class="col-mono" style="border-left:1px solid var(--border-subtle);">${item.pos[2].freq}</td>
        <td class="col-mono">${renderAtraso1CBadge(item.pos[2])}</td>
        <td class="col-mono"><span class="kpi-badge badge-primary">${item.pos[2].score.toFixed(1)}%</span></td>
        <!-- Posición 4 -->
        <td class="col-mono" style="border-left:1px solid var(--border-subtle);">${item.pos[3].freq}</td>
        <td class="col-mono">${renderAtraso1CBadge(item.pos[3])}</td>
        <td class="col-mono"><span class="kpi-badge badge-primary">${item.pos[3].score.toFixed(1)}%</span></td>
      </tr>
    `).join('');
  }

  // 6. Matrices de Posición y Calor
  function renderMatrices() {
    const matricesObj = state.calculos.matrices;
    if (!matricesObj) return;
    const v = state.matrices.ventana;
    const info = matricesObj[v] || matricesObj[100];
    if (!info) return;

    // Renderizar tabla Heatmap
    const tbody = document.getElementById('tbodyMatrices');
    if (tbody) {
      tbody.innerHTML = info.matriz.map(row => `
        <tr>
          <td style="text-align:center;"><span class="ball" style="width:32px;height:32px;font-size:1rem;margin:auto;">${row.digito}</span></td>
          <td><div class="heatmap-cell" style="${getHeatCellStyle(row.pct1)}">${row.pos1} <span class="cell-subtext">${row.pct1.toFixed(1)}%</span></div></td>
          <td><div class="heatmap-cell" style="${getHeatCellStyle(row.pct2)}">${row.pos2} <span class="cell-subtext">${row.pct2.toFixed(1)}%</span></div></td>
          <td><div class="heatmap-cell" style="${getHeatCellStyle(row.pct3)}">${row.pos3} <span class="cell-subtext">${row.pct3.toFixed(1)}%</span></div></td>
          <td><div class="heatmap-cell" style="${getHeatCellStyle(row.pct4)}">${row.pos4} <span class="cell-subtext">${row.pct4.toFixed(1)}%</span></div></td>
        </tr>
      `).join('');
    }

    // Renderizar Ranking de Pares (Pos 3 y 4)
    const tbodyPares = document.getElementById('tbodyParesRanking');
    if (tbodyPares && info.paresRanking) {
      tbodyPares.innerHTML = info.paresRanking.slice(0, 15).map((p, idx) => `
        <tr>
          <td><span class="badge ${idx < 3 ? 'badge-warning' : 'badge-primary'}">#${idx + 1}</span></td>
          <td><span class="number-pill">${p.par}</span></td>
          <td class="col-mono">${p.count}</td>
          <td class="col-mono">${p.pct.toFixed(2)}%</td>
        </tr>
      `).join('');
    }
  }

  function getHeatCellStyle(pct) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    let bg, color;
    if (pct < 6) {
      bg = isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.7)';
      color = isLight ? '#475569' : '#64748b';
    } else if (pct < 8) {
      bg = isLight ? '#e0e7ff' : 'rgba(30, 27, 75, 0.8)';
      color = isLight ? '#3730a3' : '#a5b4fc';
    } else if (pct < 10) {
      bg = 'rgba(67, 56, 202, 0.8)';
      color = '#ffffff';
    } else if (pct < 12) {
      bg = 'rgba(79, 70, 229, 0.85)';
      color = '#ffffff';
    } else if (pct < 14) {
      bg = 'rgba(14, 165, 233, 0.85)';
      color = '#ffffff';
    } else if (pct < 16) {
      bg = 'rgba(16, 185, 129, 0.85)';
      color = '#ffffff';
    } else if (pct < 18) {
      bg = 'rgba(245, 158, 11, 0.85)';
      color = '#ffffff';
    } else {
      bg = 'rgba(239, 68, 68, 0.9)';
      color = '#ffffff';
    }
    return `background:${bg};color:${color};`;
  }

  function getColorHeat(pct) {
    return getHeatCellStyle(pct);
  }

  // ── Helper: proyectar un patrón Base10 sobre un número del último sorteo ──
  // db10pattern: string de N dígitos (1-4), ultimoNum: string de 4 dígitos
  // Suma dígito a dígito (módulo 10). Si el patrón tiene <4 dígitos y posición
  // es 'final', aplica sobre los últimos N dígitos; si es 'inicio', sobre los primeros N.
  function proyectarDB10(ultimoNum, db10pattern, posicion) {
    if (!ultimoNum || !db10pattern) return '—';
    const num = (ultimoNum + '').padStart(4, '0');
    const pat = (db10pattern + '');
    const n = pat.length;
    const digits = num.split('').map(Number);
    const patDigits = pat.split('').map(Number);

    if (n === 4) {
      // Suma dígito a dígito mod 10
      const result = digits.map((d, i) => (d + patDigits[i]) % 10).join('');
      return result;
    } else {
      // Aplicar solo sobre N dígitos según posición
      const result = [...digits];
      if (posicion === 'final') {
        const start = 4 - n;
        for (let i = 0; i < n; i++) result[start + i] = (result[start + i] + patDigits[i]) % 10;
      } else {
        for (let i = 0; i < n; i++) result[i] = (result[i] + patDigits[i]) % 10;
      }
      return result.join('');
    }
  }

  // 7. Distancias & Distancias Base 10
  function renderDistancias() {
    const distObj = state.calculos.distancias;
    if (!distObj) return;

    const sorteos = obtenerSorteosFiltrados();
    const totalSorteos = (sorteos && sorteos.length) || 1;

    // ── Tabla Mayor Probabilidad ──────────────────────────────────────────
    const tbodyMayorProb = document.getElementById('tbodyMayorProb');
    if (tbodyMayorProb) {
      tbodyMayorProb.innerHTML = distObj.mayorProb.map(d => `
        <tr>
          <td><span class="number-pill">Distancia ${d.distancia}</span></td>
          <td class="col-mono">${d.pos1.toFixed(1)}%</td>
          <td class="col-mono">${d.pos2.toFixed(1)}%</td>
          <td class="col-mono">${d.pos3.toFixed(1)}%</td>
          <td class="col-mono">${d.pos4.toFixed(1)}%</td>
          <td class="col-mono" style="font-weight:700;color:var(--accent-emerald)">${d.promedio.toFixed(1)}%</td>
        </tr>
      `).join('');
    }

    // ── Tabla Tuplas ──────────────────────────────────────────────────────
    const tbodyTuplas = document.getElementById('tbodyTuplas');
    if (tbodyTuplas) {
      tbodyTuplas.innerHTML = distObj.tuplasRanking.slice(0, 15).map((t, idx) => `
        <tr>
          <td><span class="badge badge-info">#${idx + 1}</span></td>
          <td><code style="font-size:0.9rem;padding:0.2rem 0.5rem;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-main);">${t.tupla}</code></td>
          <td class="col-mono">${t.count}</td>
          <td class="col-mono">${t.pct.toFixed(2)}%</td>
        </tr>
      `).join('');
    }

    // ── Tabla Base10 con selector de cifras / posición ───────────────────
    const cifras   = (state.distancias && state.distancias.cifras)   || 4;
    const posicion = (state.distancias && state.distancias.posicion) || 'final';

    // Marcar botones activos
    document.querySelectorAll('[data-cifras-db10]').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-cifras-db10'), 10) === cifras);
    });
    document.querySelectorAll('[data-posicion-db10]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-posicion-db10') === posicion);
    });

    const db10Full = distObj.db10RankingAll || distObj.db10Ranking || [];
    let rankingFiltrado;
    if (cifras === 4) {
      rankingFiltrado = db10Full.slice(0, 20).map(b => ({
        clave: b.clave, freq: b.freq, atraso: b.atraso,
        pct: (b.freq / totalSorteos) * 100
      }));
    } else {
      const grupos = {};
      db10Full.forEach(b => {
        const clave4 = (b.clave + '').padStart(4, '0');
        const key = posicion === 'inicio'
          ? clave4.substring(0, cifras)
          : clave4.substring(4 - cifras);
        if (!grupos[key]) grupos[key] = { clave: key, freq: 0, atraso: Infinity };
        grupos[key].freq += b.freq;
        if (b.atraso < grupos[key].atraso) grupos[key].atraso = b.atraso;
      });
      rankingFiltrado = Object.values(grupos)
        .sort((a, b) => b.freq - a.freq)
        .slice(0, 20)
        .map(g => ({ ...g, pct: (g.freq / totalSorteos) * 100 }));
    }

    const tbodyBase10 = document.getElementById('tbodyBase10');
    if (tbodyBase10) {
      const ultimoNum = (sorteos && sorteos[0]) ? (sorteos[0].n + '') : '0000';
      tbodyBase10.innerHTML = rankingFiltrado.map(b => {
        const proyeccion = proyectarDB10(ultimoNum, b.clave, posicion);
        return `
          <tr>
            <td><span class="number-pill">${b.clave}</span></td>
            <td class="col-mono">${b.freq}</td>
            <td class="col-mono">${b.pct.toFixed(2)}%</td>
            <td class="col-mono">${b.atraso === Infinity ? 'N/A' : b.atraso + ' sorteos'}</td>
            <td class="col-mono" style="font-weight:700;color:var(--accent-cyan);"
                title="${ultimoNum} + ${b.clave} → ${proyeccion}">
              ${proyeccion}
            </td>
          </tr>`;
      }).join('');
    }

    // ── Estadísticas Avanzadas de Base 10 ────────────────────────────────
    _renderEstadisticasAvanzadasDB10(distObj, sorteos, totalSorteos);
  }

  // ── Buscador DB10 ────────────────────────────────────────────────────────
  // Busca en TODOS los sorteos (no solo top-50), con soporte de sufijo (*14),
  // prefijo (14*) o subcadena libre (14 → contiene "14")
  function renderBuscadorDB10(query) {
    const tbody = document.getElementById('tbodyBuscadorDB10');
    if (!tbody) return;
    if (!query) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:1rem;">Ingresa un patrón para buscar.</td></tr>';
      return;
    }

    const sorteos = obtenerSorteosFiltrados();
    if (!sorteos || !sorteos.length) return;

    const ultimoNum = sorteos[0] ? (sorteos[0].n + '') : '0000';

    // Limpiar query: solo dígitos + comodín *
    const rawQuery = query.trim();
    const q = rawQuery.replace(/[^0-9*]/g, '');
    if (!q) return;

    // Detectar modo: *XX (sufijo), XX* (prefijo), XXXX (exacto), XX (subcadena)
    let matchFn;
    if (q.startsWith('*') && !q.endsWith('*')) {
      // Modo sufijo: *14 → termina en "14"
      const suffix = q.slice(1);
      matchFn = (clave) => (clave + '').endsWith(suffix);
    } else if (q.endsWith('*') && !q.startsWith('*')) {
      // Modo prefijo: 14* → empieza en "14"
      const prefix = q.slice(0, -1);
      matchFn = (clave) => (clave + '').startsWith(prefix);
    } else {
      // Sin comodín: si es 4 dígitos → exacto; si <4 → sufijo primero, luego subcadena
      const digits = q.replace(/\*/g, '');
      if (digits.length === 4) {
        matchFn = (clave) => (clave + '') === digits;
      } else {
        // Busca como terminación (sufijo) por defecto, incluye también subcadena
        matchFn = (clave) => (clave + '').endsWith(digits) || (clave + '').includes(digits);
      }
    }

    // Construir mapa completo de TODOS los sorteos (no solo top-50)
    const db10MapCompleto = {};
    for (let i = 0; i < sorteos.length; i++) {
      const b10 = sorteos[i].db10 + '';
      if (!b10 || b10 === 'undefined') continue;
      if (!db10MapCompleto[b10]) db10MapCompleto[b10] = { clave: b10, freq: 0, atraso: i };
      db10MapCompleto[b10].freq++;
    }

    // Filtrar por coincidencia
    let resultados = Object.values(db10MapCompleto)
      .filter(b => matchFn(b.clave))
      .sort((a, b) => b.freq - a.freq);

    // Si no hay resultados: mostrar "nunca ha salido"
    if (resultados.length === 0) {
      const digits = q.replace(/\*/g, '');
      const proyeccion = proyectarDB10(ultimoNum, digits, 'final');
      tbody.innerHTML = `<tr>
        <td><span class="number-pill">${digits}</span></td>
        <td class="col-mono">0</td>
        <td class="col-mono">N/A</td>
        <td><span class="badge badge-warning">⚠️ Nunca ha salido</span></td>
        <td class="col-mono" style="font-weight:700;color:var(--accent-cyan);">${proyeccion}</td>
      </tr>`;
      return;
    }

    tbody.innerHTML = resultados.map(b => {
      const proyeccion = proyectarDB10(ultimoNum, b.clave, 'final');
      return `
        <tr>
          <td><span class="number-pill">${b.clave}</span></td>
          <td class="col-mono">${b.freq}</td>
          <td class="col-mono">${b.atraso} sorteos</td>
          <td><span class="badge" style="background:rgba(16,185,129,0.2);color:#34d399;">✅ Ha salido</span></td>
          <td class="col-mono" style="font-weight:700;color:var(--accent-cyan);"
              title="${ultimoNum} + ${b.clave} → ${proyeccion}">${proyeccion}</td>
        </tr>`;
    }).join('');
  }

  // ── Estadísticas Avanzadas (helper interno, sobre 100% del histórico) ────
  function _renderEstadisticasAvanzadasDB10(distObj, sorteos, totalSorteos) {
    const ranking = distObj.db10RankingAll || distObj.db10Ranking || [];
    if (!ranking.length) return;

    // ── a) Distribución por dígito inicial ──────────────────────────────
    const decilEl = document.getElementById('distDecilDB10');
    if (decilEl) {
      const conteo = {};
      for (let d = 0; d <= 9; d++) conteo[d] = 0;
      ranking.forEach(b => {
        const primer = (b.clave + '').charAt(0);
        const d = parseInt(primer, 10);
        if (!isNaN(d)) conteo[d] = (conteo[d] || 0) + b.freq;
      });
      const maxConteo = Math.max(...Object.values(conteo), 1);
      decilEl.innerHTML = Object.entries(conteo).map(([d, cnt]) => {
        const pct = ((cnt / maxConteo) * 100).toFixed(0);
        const freqPct = ((cnt / totalSorteos) * 100).toFixed(1);
        return `
          <div style="background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;padding:0.6rem 0.75rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">
              <span style="font-weight:700;font-size:1rem;color:var(--accent-cyan);">${d}xxx</span>
              <span style="font-size:0.75rem;color:var(--text-muted);">${freqPct}%</span>
            </div>
            <div style="height:6px;background:var(--border-subtle);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--accent-cyan);border-radius:3px;transition:width 0.4s;"></div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.2rem;">${cnt} sorteos</div>
          </div>
        `;
      }).join('');
    }

    // ── b) Coeficiente de concentración (Gini simplificado) ─────────────
    const giniEl = document.getElementById('giniDB10');
    if (giniEl) {
      const freqs = ranking.map(b => b.freq).sort((a, b) => a - b);
      const n = freqs.length;
      const totalFreq = freqs.reduce((s, f) => s + f, 0) || 1;
      let gini = 0;
      freqs.forEach((f, i) => { gini += (2 * (i + 1) - n - 1) * f; });
      gini = Math.abs(gini) / (n * totalFreq);

      // ¿El 20% de patrones concentra >80% de sorteos?
      const top20Pct = Math.ceil(n * 0.2);
      const topFreqs = [...freqs].sort((a, b) => b - a).slice(0, top20Pct);
      const topSum = topFreqs.reduce((s, f) => s + f, 0);
      const concentrado = (topSum / totalFreq) > 0.8;
      const nivelTexto = gini > 0.5 ? '🔴 Alta concentración' : gini > 0.3 ? '🟡 Concentración media' : '🟢 Distribución uniforme';
      const nivelColor = gini > 0.5 ? '#f87171' : gini > 0.3 ? '#fbbf24' : '#34d399';

      giniEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Índice Gini</span></div>
          <div class="kpi-value" style="color:${nivelColor};">${gini.toFixed(3)}</div>
          <div class="kpi-sub">${nivelTexto}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Top 20% de patrones</span></div>
          <div class="kpi-value">${((topSum / totalFreq) * 100).toFixed(1)}%</div>
          <div class="kpi-sub">de los sorteos históricos</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Interpretación</span></div>
          <div class="kpi-value" style="font-size:1rem;color:${nivelColor};">${concentrado ? 'Alta concentración' : 'Distribución uniforme'}</div>
          <div class="kpi-sub">${top20Pct} patrones acumulan ${((topSum / totalFreq) * 100).toFixed(1)}% de salidas</div>
        </div>
      `;
    }

    // ── c) Patrones en racha (últimos 10 sorteos vs. promedio histórico) ─
    const rachaEl = document.getElementById('rachaDB10');
    if (rachaEl && sorteos && sorteos.length) {
      const ultimos10 = sorteos.slice(0, 10);
      const conteoReciente = {};
      ultimos10.forEach(s => {
        const k = s.db10 || '';
        if (k) conteoReciente[k] = (conteoReciente[k] || 0) + 1;
      });
      // promedio histórico por patrón
      const promedioHistorico = {};
      ranking.forEach(b => { promedioHistorico[b.clave] = b.freq / totalSorteos; });

      const rachaItems = Object.entries(conteoReciente)
        .map(([clave, cntReciente]) => {
          const promHist = promedioHistorico[clave] || 0;
          const esperado10 = promHist * 10;
          const ratio = esperado10 > 0 ? cntReciente / esperado10 : (cntReciente > 0 ? 99 : 0);
          return { clave, cntReciente, ratio };
        })
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3);

      if (rachaItems.length === 0) {
        rachaEl.innerHTML = '<div style="color:var(--text-dim);padding:0.75rem;">Sin datos recientes suficientes.</div>';
      } else {
        rachaEl.innerHTML = rachaItems.map(item => {
          const enRacha = item.ratio >= 2;
          const color = enRacha ? '#f97316' : 'var(--accent-cyan)';
          return `
            <div class="kpi-card">
              <div class="kpi-header"><span class="kpi-title">Patrón ${item.clave}</span></div>
              <div class="kpi-value" style="color:${color};">${item.cntReciente}/${10}</div>
              <div class="kpi-sub">${enRacha ? '🔥 En racha' : '📈 Por encima del promedio'} · ratio ×${item.ratio.toFixed(1)}</div>
            </div>
          `;
        }).join('');
      }
    }

    // ── d) Top 10 patrones con mayor atraso (≥2 apariciones) ────────────
    const tbodyAtraso = document.getElementById('tbodyAtrasoMaxDB10');
    if (tbodyAtraso) {
      const top10Atraso = ranking
        .filter(b => b.freq >= 2)
        .sort((a, b) => b.atraso - a.atraso)
        .slice(0, 10);

      if (!top10Atraso.length) {
        tbodyAtraso.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:1rem;">Sin datos disponibles.</td></tr>';
      } else {
        tbodyAtraso.innerHTML = top10Atraso.map(b => {
          const pct = ((b.freq / totalSorteos) * 100).toFixed(2);
          return `
            <tr>
              <td><span class="number-pill">${b.clave}</span></td>
              <td class="col-mono">${b.freq}</td>
              <td class="col-mono" style="color:#f87171;font-weight:700;">${b.atraso} sorteos</td>
              <td class="col-mono">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // 8. Búsqueda de Vecinos y Distancias Base 10
  function renderVecinos() {
    const sorteos = obtenerSorteosFiltrados();
    if (!sorteos || !sorteos.length) return;

    const ultimoSorteo = sorteos[0];

    // Actualizar badges de referencia del último sorteo
    const badgeUltimo = document.getElementById('badgeUltimoSorteoRef');
    if (badgeUltimo) badgeUltimo.textContent = `${ultimoSorteo.n} (${ultimoSorteo.s || ''})`;
    const badgeUltimaDB10 = document.getElementById('badgeUltimaDB10Ref');
    if (badgeUltimaDB10) badgeUltimaDB10.textContent = `DB10: ${ultimoSorteo.db10 || '-'}`;

    // Valor default para número: último número salido
    if (!state.vecinos.query) {
      state.vecinos.query = ultimoSorteo.n;
    }
    const inputVecinos = document.getElementById('inputVecinos');
    if (inputVecinos && !inputVecinos.value) {
      inputVecinos.value = state.vecinos.query;
    }

    // Valor default para DB10: última distancia base 10 salida
    if (!state.vecinos.queryB10) {
      state.vecinos.queryB10 = ultimoSorteo.db10 || '';
    }
    const inputVecinosB10 = document.getElementById('inputVecinosB10');
    if (inputVecinosB10 && !inputVecinosB10.value) {
      inputVecinosB10.value = state.vecinos.queryB10;
    }

    // Alternar visibilidad de paneles según modo
    const cardNum = document.getElementById('cardVecinosNum');
    const cardB10 = document.getElementById('cardVecinosB10');
    const mode = state.vecinos.subTab || 'num';
    if (cardNum && cardB10) {
      if (mode === 'num') {
        cardNum.style.display = 'block';
        cardB10.style.display = 'none';
      } else if (mode === 'b10') {
        cardNum.style.display = 'none';
        cardB10.style.display = 'block';
      } else {
        cardNum.style.display = 'block';
        cardB10.style.display = 'block';
      }
    }

    // Renderizar ambas secciones
    renderVecinosNumeros(sorteos);
    renderVecinosBase10(sorteos);
  }

  function renderVecinosNumeros(sorteos) {
    const query = state.vecinos.query;
    const res = AstroEngine.computeVecinos(sorteos, query);
    if (!res) return;

    const elNum = document.getElementById('vecinosNumeroConsultado');
    if (elNum) elNum.textContent = res.numero;
    const elTot = document.getElementById('vecinosTotalSalidas');
    if (elTot) elTot.textContent = res.totalReps;
    const elProm = document.getElementById('vecinosPromedioIntervalo');
    if (elProm) elProm.textContent = res.promedioIntervalo + ' sorteos';
    const elAtraso = document.getElementById('vecinosSorteosDesdeUltimo');
    if (elAtraso) elAtraso.textContent = res.sorteosDesdeUltimo === 0 ? '¡Salió hoy!' : res.sorteosDesdeUltimo + ' sorteos';

    // Signos zodiacales
    const divSignos = document.getElementById('vecinosSignosRanking');
    if (divSignos) {
      divSignos.innerHTML = res.signosRanking.map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.6rem;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:6px;font-size:0.8rem;">
          <span style="font-weight:600;">${renderSignoWithIcon(s.signo, 15)}</span>
          <span class="col-mono">${s.count} veces (${s.pct.toFixed(1)}%)</span>
        </div>
      `).join('');
    }

    // Tabla Coincidencias con ANTES y DESPUÉS
    const tbody = document.getElementById('tbodyVecinos');
    if (tbody) {
      tbody.innerHTML = res.coincidencias.slice(0, 40).map(c => `
        <tr>
          <!-- ANTES -->
          <td style="background:var(--bg-card-hover);">
            ${c.anterior ? `
              <span class="col-mono" style="color:var(--text-dim);font-size:0.75rem;">${c.anterior.fecha}</span>
              <span class="number-pill">${c.anterior.numero}</span>
              <span style="font-size:0.75rem;color:#f59e0b;">${renderSignoWithIcon(c.anterior.signo, 13)}</span>
              <span class="badge" style="font-size:0.7rem;background:rgba(99,102,241,0.15);color:var(--accent-cyan);" title="Distancia Base 10">DB10: ${c.anterior.db10}</span>
            ` : '<span style="color:var(--text-dim)">-</span>'}
          </td>
          <!-- AHORA (Coincidencia) -->
          <td style="background:rgba(99,102,241,0.08);border-left:1px solid rgba(99,102,241,0.3);border-right:1px solid rgba(99,102,241,0.3);">
            <span class="col-mono" style="font-weight:700;">${c.fecha}</span>
            <span class="number-pill" style="border-color:var(--accent-cyan);font-weight:800;">${c.numero}</span>
            <span class="sign-badge" style="padding:0.15rem 0.45rem;font-size:0.72rem;display:inline-flex;">${renderSignoWithIcon(c.signo, 13)}</span>
            <span class="badge" style="font-size:0.72rem;background:rgba(16,185,129,0.2);color:#34d399;font-weight:700;" title="Distancia Base 10">DB10: ${c.db10}</span>
          </td>
          <!-- DESPUÉS -->
          <td style="background:var(--bg-card-hover);">
            ${c.posterior ? `
              <span class="col-mono" style="color:var(--text-dim);font-size:0.75rem;">${c.posterior.fecha}</span>
              <span class="number-pill">${c.posterior.numero}</span>
              <span style="font-size:0.75rem;color:#f59e0b;">${renderSignoWithIcon(c.posterior.signo, 13)}</span>
              <span class="badge" style="font-size:0.7rem;background:rgba(99,102,241,0.15);color:var(--accent-cyan);" title="Distancia Base 10">DB10: ${c.posterior.db10}</span>
            ` : '<span class="badge badge-warning">AL DÍA (ÚLTIMO)</span>'}
          </td>
          <!-- Intervalo -->
          <td class="col-mono" style="text-align:center;">${c.intervaloConSiguiente ? c.intervaloConSiguiente + ' sort.' : '-'}</td>
        </tr>
      `).join('');
    }
  }

  function renderVecinosBase10(sorteos) {
    const queryB10 = state.vecinos.queryB10;
    const res = AstroEngine.computeVecinosBase10(sorteos, queryB10);
    if (!res) return;

    const elB10 = document.getElementById('vecinosB10Consultado');
    if (elB10) elB10.textContent = res.db10;
    const elTot = document.getElementById('vecinosB10TotalSalidas');
    if (elTot) elTot.textContent = res.totalReps;
    const elProm = document.getElementById('vecinosB10PromedioIntervalo');
    if (elProm) elProm.textContent = res.promedioIntervalo + ' sorteos';
    const elAtraso = document.getElementById('vecinosB10SorteosDesdeUltimo');
    if (elAtraso) elAtraso.textContent = res.sorteosDesdeUltimo === 0 ? '¡Salió hoy!' : res.sorteosDesdeUltimo + ' sorteos';

    // Signos zodiacales
    const divSignos = document.getElementById('vecinosB10SignosRanking');
    if (divSignos) {
      divSignos.innerHTML = res.signosRanking.map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0.5rem;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:6px;font-size:0.78rem;">
          <span style="font-weight:600;">${renderSignoWithIcon(s.signo, 15)}</span>
          <span class="col-mono">${s.count} (${s.pct.toFixed(1)}%)</span>
        </div>
      `).join('');
    }

    // Patrones DB10 posteriores más repetidos
    const divPosteriores = document.getElementById('vecinosB10PosterioresRanking');
    if (divPosteriores) {
      if (res.db10PosterioresRanking && res.db10PosterioresRanking.length > 0) {
        divPosteriores.innerHTML = res.db10PosterioresRanking.map(p => `
          <div style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.3rem 0.55rem;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:6px;font-size:0.78rem;">
            <code style="color:#34d399;font-weight:700;">${p.db10}</code>
            <span style="color:var(--text-muted);font-size:0.72rem;">${p.count}x (${p.pct.toFixed(1)}%)</span>
          </div>
        `).join('');
      } else {
        divPosteriores.innerHTML = '<span style="color:var(--text-dim);font-size:0.8rem;">Sin datos suficientes en sorteo posterior.</span>';
      }
    }

    // Terminaciones 2D posteriores
    const divTermPost = document.getElementById('vecinosB10TermPosteriores');
    if (divTermPost) {
      if (res.numPosterioresRanking && res.numPosterioresRanking.length > 0) {
        divTermPost.innerHTML = res.numPosterioresRanking.map(t => `
          <div style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.25rem 0.45rem;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:4px;font-size:0.75rem;">
            <span class="number-pill" style="font-size:0.75rem;padding:0.1rem 0.35rem;">*${t.term2D}</span>
            <span style="color:var(--text-muted);">${t.count}x</span>
          </div>
        `).join('');
      } else {
        divTermPost.innerHTML = '';
      }
    }

    // Tabla de Transiciones DB10
    const tbody = document.getElementById('tbodyVecinosB10');
    if (tbody) {
      tbody.innerHTML = res.coincidencias.slice(0, 40).map(c => `
        <tr>
          <!-- ANTES -->
          <td style="background:var(--bg-card-hover);">
            ${c.anterior ? `
              <span class="col-mono" style="color:var(--text-dim);font-size:0.75rem;">${c.anterior.fecha}</span>
              <span class="number-pill">${c.anterior.numero}</span>
              <span style="font-size:0.75rem;color:#f59e0b;">${renderSignoWithIcon(c.anterior.signo, 13)}</span>
              <span class="badge" style="font-size:0.7rem;background:rgba(99,102,241,0.15);color:var(--accent-cyan);" title="DB10 Sorteo Previo">DB10: ${c.anterior.db10}</span>
            ` : '<span style="color:var(--text-dim)">-</span>'}
          </td>
          <!-- AHORA (Coincidencia DB10) -->
          <td style="background:rgba(16,185,129,0.07);border-left:1px solid rgba(16,185,129,0.3);border-right:1px solid rgba(16,185,129,0.3);">
            <span class="col-mono" style="font-weight:700;">${c.fecha}</span>
            <span class="number-pill" style="font-weight:700;">${c.numero}</span>
            <span class="sign-badge" style="padding:0.15rem 0.45rem;font-size:0.72rem;display:inline-flex;">${renderSignoWithIcon(c.signo, 13)}</span>
            <span class="badge" style="font-size:0.75rem;background:rgba(16,185,129,0.25);color:#34d399;font-weight:800;border:1px solid rgba(16,185,129,0.4);" title="Patrón DB10 Evaluado">DB10: ${c.db10}</span>
          </td>
          <!-- DESPUÉS (Transición) -->
          <td style="background:var(--bg-card-hover);">
            ${c.posterior ? `
              <span class="col-mono" style="color:var(--text-dim);font-size:0.75rem;">${c.posterior.fecha}</span>
              <span class="number-pill" style="border-color:#34d399;">${c.posterior.numero}</span>
              <span style="font-size:0.75rem;color:#f59e0b;">${renderSignoWithIcon(c.posterior.signo, 13)}</span>
              <span class="badge" style="font-size:0.75rem;background:rgba(99,102,241,0.2);color:var(--accent-cyan);font-weight:700;" title="DB10 Siguiente">DB10: ${c.posterior.db10}</span>
            ` : '<span class="badge badge-warning">AL DÍA (ÚLTIMO)</span>'}
          </td>
          <!-- Intervalo -->
          <td class="col-mono" style="text-align:center;">${c.intervaloConSiguiente ? c.intervaloConSiguiente + ' sort.' : '-'}</td>
        </tr>
      `).join('');
    }
  }

  // ============================================================================
  // 9. RADIOGRAFÍA / EVALUADOR DE APUESTAS & CARGA DE TXT
  // ============================================================================

  const LISTA_DEFAULT_FALLBACK = '0859, 0539, 8370, 3614, 5842, 4874, 0610, 7147, 5173, 9105, 0517, 1051, 9032, 8344, 3502, 8071, 1793, 8428, 0470, 4104, 8621, 9159, 9684, 0542, 6868, 6435, 8450, 8318, 8737, 0802, 0208, 5637, 9580, 8624, 8122, 0869, 5341, 5340, 8047, 8078, 8362, 8363, 8155, 2645';

  async function cargarListaPredeterminadaEvaluador(forzar = false) {
    let rawText = '';

    // 1. Consultar lista guardada del usuario en Supabase
    try {
      const res = await apiFetch(`/api/lista_usuario?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.numeros) && json.numeros.length > 0) {
          rawText = json.numeros.join('\n');
        }
      }
    } catch (e) {
      // Fallback silencioso
    }

    // 2. Fallback al metadata empaquetado en dataset
    if (!rawText && state.data && state.data.metadata && state.data.metadata.lista_default && state.data.metadata.lista_default.length > 0) {
      rawText = state.data.metadata.lista_default.join('\n');
    }

    // 3. Fallback a constante empaquetada
    if (!rawText) {
      rawText = LISTA_DEFAULT_FALLBACK;
    }

    // Extraer y deduplicar números de 4 dígitos
    const tokens = rawText.split(/\r?\n|[,;\s]+/);
    const unicos = [];
    const set = new Set();

    for (const tok of tokens) {
      const match = tok.match(/\d{4}/);
      if (match) {
        const num = match[0];
        if (!set.has(num)) {
          set.add(num);
          unicos.push(num);
        }
      }
    }

    const inputEvaluador = document.getElementById('inputEvaluador');
    if (inputEvaluador) {
      inputEvaluador.value = unicos.join(', ');
    }

    state.evaluador.lista = unicos.join(', ');
    state.evaluador.page = 1;
    state.evaluador.search = '';

    const searchInput = document.getElementById('searchEvaluador');
    if (searchInput) searchInput.value = '';

    const statusBadge = document.getElementById('evaluadorFileStatus');
    if (statusBadge) {
      statusBadge.style.display = 'inline-block';
      statusBadge.textContent = `📄 analisis_astro/lista_numeros.txt: ${unicos.length} números únicos 4D`;
    }

    renderEvaluador();
    if (forzar) {
      mostrarToast(`Lista predeterminada cargada (${unicos.length} números únicos)`, 'success');
    }
  }

  async function procesarArchivosTxtEvaluador(fileList) {
    if (!fileList || fileList.length === 0) return;

    const archivos = Array.from(fileList).filter(f => 
      f.name.toLowerCase().endsWith('.txt') || f.type === 'text/plain' || f.type === ''
    );

    if (archivos.length === 0) {
      mostrarToast('Por favor selecciona archivos de texto con extensión .txt', 'error');
      return;
    }

    mostrarToast(`Leyendo ${archivos.length} archivo(s)...`, 'info');

    // Leer los archivos seleccionados en paralelo
    const lecturas = await Promise.all(
      archivos.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, content: e.target.result || '', ok: true });
          reader.onerror = () => resolve({ name: file.name, content: '', ok: false });
          reader.readAsText(file, 'UTF-8');
        });
      })
    );

    const unicos = [];
    const set = new Set();
    let totalExtraidos = 0;
    let totalLineas = 0;
    const nombresExitosos = [];

    for (const item of lecturas) {
      if (!item.ok || !item.content.trim()) continue;
      nombresExitosos.push(item.name);
      const lines = item.content.split(/\r?\n/);
      totalLineas += lines.length;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // En cada línea extraer el primer número de 4 dígitos consecutivos
        const match = line.match(/\d{4}/);
        if (match) {
          totalExtraidos++;
          const num = match[0];
          // Si un número está repetido, no duplicar ese valor
          if (!set.has(num)) {
            set.add(num);
            unicos.push(num);
          }
        }
      }
    }

    if (!unicos.length) {
      mostrarToast(`No se encontraron números válidos de 4 dígitos en los archivos seleccionados.`, 'error');
      return;
    }

    const duplicados = totalExtraidos - unicos.length;

    // Actualizar textarea y estado
    const inputEvaluador = document.getElementById('inputEvaluador');
    if (inputEvaluador) {
      inputEvaluador.value = unicos.join(', ');
    }

    state.evaluador.lista = unicos.join(', ');
    state.evaluador.page = 1;
    state.evaluador.search = '';

    const searchInput = document.getElementById('searchEvaluador');
    if (searchInput) searchInput.value = '';

    const btnClear = document.getElementById('btnClearSearchEvaluador');
    if (btnClear) btnClear.style.display = 'none';

    // Badge descriptivo de los archivos procesados y duplicados omitidos
    const statusBadge = document.getElementById('evaluadorFileStatus');
    if (statusBadge) {
      statusBadge.style.display = 'inline-block';
      if (archivos.length === 1) {
        statusBadge.textContent = `📄 ${archivos[0].name}: ${unicos.length} números únicos 4D (${duplicados > 0 ? `${duplicados} repetidos omitidos de ` : ''}${totalExtraidos} extraídos de ${totalLineas} líneas)`;
      } else {
        const nombresTxt = nombresExitosos.length <= 3 ? nombresExitosos.join(', ') : `${nombresExitosos.slice(0, 2).join(', ')} y ${nombresExitosos.length - 2} más`;
        statusBadge.textContent = `📚 ${archivos.length} archivos (${nombresTxt}): ${unicos.length} números únicos 4D (${duplicados} repetidos omitidos de ${totalExtraidos} extraídos)`;
      }
    }

    renderEvaluador();
    const msgDups = duplicados > 0 ? ` (${duplicados} repetidos omitidos)` : '';
    mostrarToast(`Cargados ${unicos.length} números únicos de 4D desde ${archivos.length} archivo(s)${msgDups}`, 'success');
  }

  /**
   * Evalúa si un número de 4 cifras coincide con la búsqueda y sus combinaciones
   * Reglas:
   * - 3 cifras (ABC): evalúa todas las combinaciones 0-9 en primera cifra (_ABC) y 0-9 en última (ABC_).
   * - 2 cifras (AB): evalúa todas las combinaciones en inicio (AB__), centro (_AB_) y final (__AB).
   * - 1 cifra (A): evalúa el dígito en cualquiera de las 4 posiciones.
   * - 4 cifras (ABCD): coincidencia exacta.
   * - Comodines (? o * o _): regex evaluada dinámicamente.
   */
  function evaluarBusquedaCombinaciones(itemNumero, query) {
    if (!query) {
      return { isMatch: true, ranges: [] };
    }
    const q = query.trim();
    if (!q) {
      return { isMatch: true, ranges: [] };
    }

    // 1. Si contiene comodines (? o * o _)
    if (/[\?\*_]/.test(q)) {
      const pattern = '^' + q.replace(/\?/g, '\\d').replace(/_/g, '\\d').replace(/\*/g, '\\d*') + '$';
      try {
        const reg = new RegExp(pattern);
        const ok = reg.test(itemNumero);
        return { isMatch: ok, ranges: ok ? [[0, 4]] : [] };
      } catch (e) {
        // Fallback
      }
    }

    // 2. Si son exclusivamente dígitos
    if (/^\d+$/.test(q)) {
      // 4 dígitos: Coincidencia exacta
      if (q.length === 4) {
        const isExact = itemNumero === q;
        return { isMatch: isExact, ranges: isExact ? [[0, 4]] : [] };
      }

      // 3 dígitos:
      // Evalúa todas las combinaciones de 0-9 en la primera cifra (_ABC) y 0-9 en la última (ABC_)
      if (q.length === 3) {
        const ranges = [];
        // Coincide al inicio: ABC_ (última cifra 0-9)
        if (itemNumero.substring(0, 3) === q) {
          ranges.push([0, 3]);
        }
        // Coincide al final: _ABC (primera cifra 0-9)
        if (itemNumero.substring(1, 4) === q) {
          ranges.push([1, 4]);
        }
        return { isMatch: ranges.length > 0, ranges };
      }

      // 2 dígitos:
      // Combinaciones inicio (AB__), centro (_AB_), final (__AB)
      if (q.length === 2) {
        const ranges = [];
        if (itemNumero.substring(0, 2) === q) ranges.push([0, 2]);
        if (itemNumero.substring(1, 3) === q) ranges.push([1, 3]);
        if (itemNumero.substring(2, 4) === q) ranges.push([2, 4]);
        return { isMatch: ranges.length > 0, ranges };
      }

      // 1 dígito:
      // Dígito en cualquiera de las 4 posiciones
      if (q.length === 1) {
        const ranges = [];
        for (let i = 0; i < 4; i++) {
          if (itemNumero[i] === q) {
            ranges.push([i, i + 1]);
          }
        }
        return { isMatch: ranges.length > 0, ranges };
      }
    }

    // Búsqueda general fallback
    const idx = itemNumero.indexOf(q);
    if (idx !== -1) {
      return { isMatch: true, ranges: [[idx, idx + q.length]] };
    }
    return { isMatch: false, ranges: [] };
  }

  function generarFeedbackBusqueda(query, totalListado, totalFiltrados, itemsFiltrados) {
    if (!query || !query.trim()) return '';
    const q = query.trim();

    let desc = '';
    let ejemplosCombs = '';

    if (/^\d{3}$/.test(q)) {
      desc = `Buscando combinaciones de 3 cifras (<strong>${q}</strong>): Evaluando <strong>0${q}–9${q}</strong> (primera cifra 0-9) y <strong>${q}0–${q}9</strong> (última cifra 0-9).`;
      const numsPresentes = itemsFiltrados.slice(0, 8).map(x => `<span class="comb-tag">${x.numero}</span>`).join(' ');
      ejemplosCombs = `<div style="margin-top:0.35rem;">Coincidencias en tu lista: <strong>${totalFiltrados}</strong> apuestas ${numsPresentes}${totalFiltrados > 8 ? ' ...' : ''}</div>`;
    } else if (/^\d{2}$/.test(q)) {
      desc = `Buscando combinaciones de 2 cifras (<strong>${q}</strong>): Evaluando iniciales <strong>${q}__</strong> (00-99), centro <strong>_${q}_</strong> y terminales <strong>__${q}</strong> (00-99).`;
      const numsPresentes = itemsFiltrados.slice(0, 8).map(x => `<span class="comb-tag">${x.numero}</span>`).join(' ');
      ejemplosCombs = `<div style="margin-top:0.35rem;">Coincidencias en tu lista: <strong>${totalFiltrados}</strong> apuestas ${numsPresentes}${totalFiltrados > 8 ? ' ...' : ''}</div>`;
    } else if (/^\d{1}$/.test(q)) {
      desc = `Buscando combinaciones con el dígito <strong>'${q}'</strong> en cualquiera de las 4 posiciones.`;
      ejemplosCombs = `<div style="margin-top:0.35rem;">Coincidencias en tu lista: <strong>${totalFiltrados}</strong> de ${totalListado} apuestas.</div>`;
    } else if (/^\d{4}$/.test(q)) {
      desc = `Búsqueda exacta de 4 cifras (<strong>${q}</strong>).`;
      ejemplosCombs = totalFiltrados > 0
        ? `<div style="margin-top:0.35rem;color:var(--accent-emerald);">✓ Número encontrado en tu lista (Rank #${itemsFiltrados[0].originalRank}).</div>`
        : `<div style="margin-top:0.35rem;color:var(--accent-rose);">✕ El número ${q} no se encuentra en el listado analizado.</div>`;
    } else {
      desc = `Búsqueda por patrón o filtro: <strong>"${q}"</strong>.`;
      ejemplosCombs = `<div style="margin-top:0.35rem;">Coincidencias: <strong>${totalFiltrados}</strong> de ${totalListado}.</div>`;
    }

    return `<div>${desc}</div>${ejemplosCombs}`;
  }

  function renderNumeroResaltado(numStr, ranges) {
    if (!ranges || !ranges.length) {
      return `<span class="number-pill" style="font-size:0.95rem;">${numStr}</span>`;
    }
    const isHighlighted = new Array(numStr.length).fill(false);
    ranges.forEach(([start, end]) => {
      for (let i = start; i < end && i < numStr.length; i++) {
        isHighlighted[i] = true;
      }
    });

    let inner = '';
    let inside = false;
    for (let i = 0; i < numStr.length; i++) {
      if (isHighlighted[i] && !inside) {
        inner += '<mark class="num-match">';
        inside = true;
      } else if (!isHighlighted[i] && inside) {
        inner += '</mark>';
        inside = false;
      }
      inner += numStr[i];
    }
    if (inside) inner += '</mark>';

    return `<span class="number-pill" style="font-size:0.95rem;">${inner}</span>`;
  }

  function renderEvaluador() {
    const sorteos = obtenerSorteosFiltrados();
    const lista = state.evaluador.lista;
    const res = AstroEngine.computeEvaluadorLista(sorteos, lista);

    const tbody = document.getElementById('tbodyEvaluador');
    const feedbackBox = document.getElementById('evaluadorSearchFeedback');
    const countSummary = document.getElementById('evaluadorCountSummary');
    const paginationInfo = document.getElementById('evaluadorPaginationInfo');
    const paginationEl = document.getElementById('paginationEvaluador');
    const cfg = state.evaluador;

    if (!tbody) return;

    if (!res.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:2.5rem;">Ingresa números de 4 cifras o carga un archivo .txt arriba y presiona "Evaluar Lista"</td></tr>`;
      if (feedbackBox) feedbackBox.style.display = 'none';
      if (countSummary) countSummary.textContent = '0 números';
      if (paginationInfo) paginationInfo.textContent = 'Sin datos';
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    // 1. Asignar rank original a cada elemento
    const totalOriginal = res.length;
    res.forEach((r, idx) => {
      r.originalRank = idx + 1;
      r.rank = idx + 1;
    });

    // 2. Filtrado y evaluación de combinaciones con el buscador
    const query = (cfg.search || '').trim();
    let filtrados = [];

    for (let i = 0; i < res.length; i++) {
      const item = res[i];
      const evalRes = evaluarBusquedaCombinaciones(item.numero, query);
      if (evalRes.isMatch) {
        item.highlightRanges = evalRes.ranges;
        filtrados.push(item);
      }
    }

    // Feedback visual de búsqueda y combinaciones
    if (feedbackBox) {
      if (query) {
        feedbackBox.style.display = 'block';
        feedbackBox.innerHTML = generarFeedbackBusqueda(query, totalOriginal, filtrados.length, filtrados);
      } else {
        feedbackBox.style.display = 'none';
      }
    }

    // 3. Ordenamiento
    filtrados.sort((a, b) => {
      let va = a[cfg.sortCol];
      let vb = b[cfg.sortCol];
      if (typeof va === 'string') {
        return cfg.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return cfg.sortAsc ? (va - vb) : (vb - va);
    });

    // Actualizar iconos de cabeceras de tabla
    const tableEvaluador = document.getElementById('tableEvaluador');
    if (tableEvaluador) {
      tableEvaluador.querySelectorAll('th.sortable-th').forEach(th => {
        const col = th.getAttribute('data-sort');
        const icon = th.querySelector('.sort-icon');
        if (col === cfg.sortCol) {
          th.classList.add('active-sort');
          if (icon) icon.textContent = cfg.sortAsc ? '▲' : '▼';
        } else {
          th.classList.remove('active-sort');
          if (icon) icon.textContent = '↕';
        }
      });
    }

    // 4. Paginación
    const total = filtrados.length;
    const totalPages = Math.ceil(total / cfg.pageSize) || 1;
    cfg.page = Math.min(cfg.page, totalPages);
    if (cfg.page < 1) cfg.page = 1;
    const start = (cfg.page - 1) * cfg.pageSize;
    const pageItems = filtrados.slice(start, start + cfg.pageSize);

    renderPaginationControls('paginationEvaluador', cfg, totalPages, renderEvaluador);

    // Contadores de estado
    if (countSummary) {
      countSummary.textContent = query
        ? `${total} de ${totalOriginal} coincidentes`
        : `${totalOriginal} números en total`;
    }

    if (paginationInfo) {
      if (!total) {
        paginationInfo.textContent = 'No se encontraron coincidencias para la búsqueda';
      } else {
        const fin = Math.min(start + cfg.pageSize, total);
        paginationInfo.textContent = `Mostrando ${start + 1}–${fin} de ${total} números evaluados`;
      }
    }

    // 5. Renderizar cuerpo de la tabla
    if (!pageItems.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:2rem;">No hay números en tu lista que coincidan con las combinaciones de "${query}".</td></tr>`;
      return;
    }

    tbody.innerHTML = pageItems.map((r) => `
      <tr>
        <td><span class="badge ${r.originalRank <= 3 ? 'badge-success' : 'badge-primary'}">#${r.originalRank}</span></td>
        <td>${renderNumeroResaltado(r.numero, r.highlightRanges)}</td>
        <td class="col-mono" style="font-weight:700;color:var(--accent-emerald);font-size:1rem;">${r.score} pts</td>
        <td class="col-mono">${r.freq4} veces <span style="color:var(--text-dim);font-size:0.75rem;">(${r.atraso4} sort.)</span></td>
        <td class="col-mono">${r.p3Fin} <span style="color:var(--accent-cyan);font-weight:600;">(${r.freq3Fin}x)</span> <span style="color:var(--text-dim);font-size:0.75rem;">${r.atraso3Fin}s</span></td>
        <td class="col-mono">${r.p2Fin} <span style="color:var(--accent-amber);font-weight:600;">(${r.freq2Fin}x)</span> <span style="color:var(--text-dim);font-size:0.75rem;">${r.atraso2Fin}s</span></td>
        <td class="col-mono">${r.p3Ini} <span style="color:var(--text-dim);font-size:0.75rem;">${r.atraso3Ini}s</span></td>
        <td class="col-mono">${r.p2Ini} <span style="color:var(--text-dim);font-size:0.75rem;">${r.atraso2Ini}s</span></td>
        <td class="col-mono">${r.p2Mid} <span style="color:var(--text-dim);font-size:0.75rem;">${r.atraso2Mid}s</span></td>
      </tr>
    `).join('');
  }

  // 10. Pronósticos & Proyecciones Inteligentes (con botón de Recalcular y Módulos JEV)
  function renderPronosticos() {
    renderCombinacionesTop5();
    renderPronosticosJEVPrimeras();
    renderPronosticosJEV();
    renderPronosticosJEVSignos();
    renderPronosticos4C();

    // Bind del botón recalcular (idempotente)
    const btnRecalc = document.getElementById('btnRecalcularPronosticos');
    if (btnRecalc && !btnRecalc._bound) {
      btnRecalc._bound = true;
      btnRecalc.addEventListener('click', () => {
        btnRecalc.classList.add('loading');
        // Forzar recálculo completo de pronósticos
        const sorteos = obtenerSorteosFiltrados();
        if (sorteos.length) {
          state.calculos.pronosticos = AstroEngine.computePronosticos(sorteos);
          if (typeof AstroEngine.computePronosticosJEV === 'function') {
            state.calculos.pronosticosJEV = AstroEngine.computePronosticosJEV(sorteos);
          }
          if (typeof AstroEngine.computePronosticosJEVPrimeras === 'function') {
            state.calculos.pronosticosJEVPrimeras = AstroEngine.computePronosticosJEVPrimeras(sorteos);
          }
          if (typeof AstroEngine.computePronosticosJEVSignos === 'function') {
            state.calculos.pronosticosJEVSignos = AstroEngine.computePronosticosJEVSignos(sorteos);
          }
          if (typeof AstroEngine.computeCombinacionesTop5 === 'function') {
            state.calculos.combinacionesTop5 = AstroEngine.computeCombinacionesTop5(
              sorteos,
              state.calculos.pronosticosJEVPrimeras,
              state.calculos.pronosticosJEV,
              state.calculos.pronosticosJEVSignos
            );
          }
        }
        renderCombinacionesTop5();
        renderPronosticosJEVPrimeras();
        renderPronosticosJEV();
        renderPronosticosJEVSignos();
        renderPronosticos4C();

        // Actualizar timestamp
        const tsEl = document.getElementById('pronosticosTimestamp');
        if (tsEl) {
          const ahora = new Date();
          tsEl.textContent = `Último cálculo: ${ahora.toLocaleTimeString('es-CO')} — ${ahora.toLocaleDateString('es-CO')}`;
        }
        btnRecalc.classList.remove('loading');
        mostrarToast('Todos los pronósticos y combinaciones recalculados con éxito', 'success');
      });
    }
  }

  // 10.1 Super Combinaciones Top 5 (4 Cifras + Signo)
  function renderCombinacionesTop5() {
    const combs = state.calculos.combinacionesTop5 || [];
    const grid = document.getElementById('gridSuperCombinaciones');
    const tbody = document.getElementById('tbodyCombinacionesTop5');

    if (grid) {
      if (!combs.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:2rem;">Presiona "Recalcular Todos los Pronósticos" para generar combinaciones.</div>`;
      } else {
        const top5 = combs.slice(0, 5);
        grid.innerHTML = top5.map((c, idx) => {
          const digs = c.numero.split('');
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
          return `
            <div class="kpi-card super-comb-card">
              <div style="position:absolute;top:0.6rem;right:0.75rem;font-size:1.2rem;">${medal}</div>
              <div style="font-size:0.72rem;color:var(--accent-cyan);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">
                Pick Top #${idx + 1}
              </div>
              
              <!-- Balotas del número -->
              <div style="display:flex;align-items:center;gap:0.4rem;margin:0.75rem 0;">
                <div class="ball" style="width:36px;height:36px;font-size:1.15rem;box-shadow:0 0 10px rgba(99,102,241,0.5);">${digs[0]}</div>
                <div class="ball" style="width:36px;height:36px;font-size:1.15rem;box-shadow:0 0 10px rgba(99,102,241,0.5);">${digs[1]}</div>
                <div class="ball" style="width:36px;height:36px;font-size:1.15rem;box-shadow:0 0 10px rgba(6,182,212,0.5);">${digs[2]}</div>
                <div class="ball" style="width:36px;height:36px;font-size:1.15rem;box-shadow:0 0 10px rgba(6,182,212,0.5);">${digs[3]}</div>
                <span class="sign-badge" style="margin-left:auto;padding:0.25rem 0.6rem;font-size:0.8rem;">
                  ${renderSignoWithIcon(c.signo, 15)}
                </span>
              </div>

              <!-- Desglose de Scores -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;font-size:0.78rem;">
                <span style="color:var(--text-muted);">Score Global:</span>
                <span class="col-mono" style="font-size:1.1rem;font-weight:800;color:var(--accent-emerald);">${c.scoreGlobal} pts</span>
              </div>

              <div style="display:flex;gap:0.5rem;font-size:0.72rem;margin-bottom:0.5rem;">
                <span style="background:var(--bg-input);padding:0.2rem 0.45rem;border-radius:4px;border:1px solid var(--border-subtle);">
                  2C Ini: <strong>${c.parIni}</strong> (${c.atrasoIni}s)
                </span>
                <span style="background:var(--bg-input);padding:0.2rem 0.45rem;border-radius:4px;border:1px solid var(--border-subtle);">
                  2C Fin: <strong>${c.parFin}</strong> (${c.atrasoFin}s)
                </span>
              </div>

              <div style="font-size:0.72rem;color:${c.esInedito ? 'var(--accent-emerald)' : 'var(--text-muted)'};line-height:1.3;">
                ${c.esInedito ? '🟢 ' : '🔵 '} ${c.historia4C}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (tbody) {
      if (!combs.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:2rem;">Presiona "Recalcular Todos los Pronósticos" para generar la matriz.</td></tr>`;
      } else {
        tbody.innerHTML = combs.map((c, idx) => `
          <tr>
            <td><span class="badge ${idx < 5 ? 'badge-warning' : idx < 10 ? 'badge-info' : 'badge-primary'}">#${c.rank}</span></td>
            <td><span class="number-pill" style="font-size:1.1rem;font-weight:800;letter-spacing:0.1em;">${c.numero}</span></td>
            <td><span class="number-pill" style="border-color:var(--primary);">${c.parIni}</span> <span style="font-size:0.72rem;color:var(--text-dim);">(${c.atrasoIni}s)</span></td>
            <td><span class="number-pill" style="border-color:var(--accent-cyan);">${c.parFin}</span> <span style="font-size:0.72rem;color:var(--text-dim);">(${c.atrasoFin}s)</span></td>
            <td><span class="sign-badge" style="padding:0.15rem 0.45rem;font-size:0.75rem;">${renderSignoWithIcon(c.signo, 14)}</span></td>
            <td class="col-mono" style="font-weight:800;color:var(--accent-emerald);font-size:1rem;">${c.scoreGlobal}</td>
            <td style="font-size:0.75rem;color:${c.esInedito ? 'var(--accent-emerald)' : 'var(--text-muted)'};">${c.historia4C}</td>
            <td style="font-size:0.74rem;max-width:320px;line-height:1.4;">${c.razon}</td>
          </tr>
        `).join('');
      }
    }
  }

  // 10.2 Predicciones JEV — Primeras 2 Cifras
  function renderPronosticosJEVPrimeras() {
    const jev = state.calculos.pronosticosJEVPrimeras || [];
    const tbody = document.getElementById('tbodyJEVIni');
    const kpiEsperada = document.getElementById('jevIniFrecEsperada');
    const kpiDeficit = document.getElementById('jevIniMayorDeficit');
    const kpiDeficitSub = document.getElementById('jevIniMayorDeficitSub');
    const kpiAtraso = document.getElementById('jevIniMayorAtraso');
    const kpiAtrasoSub = document.getElementById('jevIniMayorAtrasoSub');
    const kpiDobles = document.getElementById('jevIniDoblesSenal');

    if (!tbody) return;

    if (!jev.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:2rem;">Presiona "Recalcular Todos los Pronósticos" para generar predicciones JEV iniciales.</td></tr>`;
      return;
    }

    // KPIs
    if (kpiEsperada && jev[0]) kpiEsperada.textContent = jev[0].esperada;
    if (kpiDeficit && jev[0]) {
      kpiDeficit.textContent = jev[0].par;
      if (kpiDeficitSub) kpiDeficitSub.textContent = `Déficit: ${jev[0].deficit} sorteos`;
    }
    const masAtrasado = jev.slice().sort((a, b) => b.atraso - a.atraso)[0];
    if (kpiAtraso && masAtrasado) {
      kpiAtraso.textContent = masAtrasado.par;
      if (kpiAtrasoSub) kpiAtrasoSub.textContent = `${masAtrasado.atraso} sorteos sin salir`;
    }
    const dobles = jev.filter(j => j.tendencia === 'frío' && j.deficit > 0).length;
    if (kpiDobles) kpiDobles.textContent = dobles;

    // Tabla
    tbody.innerHTML = jev.map((j, idx) => {
      const tendenciaColor = j.tendencia === 'caliente' ? 'var(--accent-rose)' :
                             j.tendencia === 'frío' ? 'var(--accent-cyan)' : 'var(--text-muted)';
      const tendenciaIcon = j.tendencia === 'caliente' ? '🔥' :
                            j.tendencia === 'frío' ? '❄️' : '➖';
      const scoreBg = j.scoreJEV > 30 ? 'rgba(239, 68, 68, 0.15)' :
                      j.scoreJEV > 20 ? 'rgba(245, 158, 11, 0.15)' : 'transparent';
      return `
        <tr style="background:${scoreBg};">
          <td><span class="badge ${idx < 3 ? 'badge-warning' : idx < 10 ? 'badge-info' : 'badge-primary'}">#${idx + 1}</span></td>
          <td><span class="number-pill" style="font-size:1.1rem;font-weight:800;border-color:var(--primary);">${j.par}</span></td>
          <td class="col-mono" style="font-weight:700;color:var(--accent-emerald);font-size:1rem;">${j.scoreJEV}</td>
          <td class="col-mono">${j.frecuencia}</td>
          <td class="col-mono">${j.esperada}</td>
          <td class="col-mono" style="font-weight:600;color:${j.deficit > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">${j.deficit > 0 ? '+' : ''}${j.deficit}</td>
          <td class="col-mono">${j.atraso}</td>
          <td class="col-mono">${j.atrasoRelativo}x</td>
          <td style="color:${tendenciaColor};font-weight:600;">${tendenciaIcon} ${j.tendencia.charAt(0).toUpperCase() + j.tendencia.slice(1)}</td>
          <td style="font-size:0.75rem;max-width:280px;line-height:1.4;">${j.razon}</td>
        </tr>
      `;
    }).join('');
  }

  // 10.3 Predicciones JEV — Últimas 2 Cifras
  function renderPronosticosJEV() {
    const jev = state.calculos.pronosticosJEV || [];
    const tbody = document.getElementById('tbodyJEV');
    const kpiEsperada = document.getElementById('jevFrecEsperada');
    const kpiDeficit = document.getElementById('jevMayorDeficit');
    const kpiDeficitSub = document.getElementById('jevMayorDeficitSub');
    const kpiAtraso = document.getElementById('jevMayorAtraso');
    const kpiAtrasoSub = document.getElementById('jevMayorAtrasoSub');
    const kpiDobles = document.getElementById('jevDoblesSenal');

    if (!tbody) return;

    if (!jev.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:2rem;">Presiona "Recalcular Todos los Pronósticos" para generar predicciones JEV terminales.</td></tr>`;
      return;
    }

    // KPIs
    if (kpiEsperada && jev[0]) kpiEsperada.textContent = jev[0].esperada;
    if (kpiDeficit && jev[0]) {
      kpiDeficit.textContent = jev[0].par;
      if (kpiDeficitSub) kpiDeficitSub.textContent = `Déficit: ${jev[0].deficit} sorteos`;
    }
    const masAtrasado = jev.slice().sort((a, b) => b.atraso - a.atraso)[0];
    if (kpiAtraso && masAtrasado) {
      kpiAtraso.textContent = masAtrasado.par;
      if (kpiAtrasoSub) kpiAtrasoSub.textContent = `${masAtrasado.atraso} sorteos sin salir`;
    }
    const dobles = jev.filter(j => j.tendencia === 'frío' && j.deficit > 0).length;
    if (kpiDobles) kpiDobles.textContent = dobles;

    // Tabla
    tbody.innerHTML = jev.map((j, idx) => {
      const tendenciaColor = j.tendencia === 'caliente' ? 'var(--accent-rose)' :
                             j.tendencia === 'frío' ? 'var(--accent-cyan)' : 'var(--text-muted)';
      const tendenciaIcon = j.tendencia === 'caliente' ? '🔥' :
                            j.tendencia === 'frío' ? '❄️' : '➖';
      const scoreBg = j.scoreJEV > 30 ? 'rgba(239, 68, 68, 0.15)' :
                      j.scoreJEV > 20 ? 'rgba(245, 158, 11, 0.15)' : 'transparent';
      return `
        <tr style="background:${scoreBg};">
          <td><span class="badge ${idx < 3 ? 'badge-warning' : idx < 10 ? 'badge-info' : 'badge-primary'}">#${idx + 1}</span></td>
          <td><span class="number-pill" style="font-size:1.1rem;font-weight:800;border-color:var(--accent-cyan);">${j.par}</span></td>
          <td class="col-mono" style="font-weight:700;color:var(--accent-emerald);font-size:1rem;">${j.scoreJEV}</td>
          <td class="col-mono">${j.frecuencia}</td>
          <td class="col-mono">${j.esperada}</td>
          <td class="col-mono" style="font-weight:600;color:${j.deficit > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">${j.deficit > 0 ? '+' : ''}${j.deficit}</td>
          <td class="col-mono">${j.atraso}</td>
          <td class="col-mono">${j.atrasoRelativo}x</td>
          <td style="color:${tendenciaColor};font-weight:600;">${tendenciaIcon} ${j.tendencia.charAt(0).toUpperCase() + j.tendencia.slice(1)}</td>
          <td style="font-size:0.75rem;max-width:280px;line-height:1.4;">${j.razon}</td>
        </tr>
      `;
    }).join('');
  }

  // 10.4 Predicciones JEV — Signos Zodiacales (12 Signos)
  function renderPronosticosJEVSignos() {
    const signos = state.calculos.pronosticosJEVSignos || [];
    const tbody = document.getElementById('tbodyJEVSignos');
    const kpiEsperada = document.getElementById('jevSignoFrecEsperada');
    const kpiDeficit = document.getElementById('jevSignoMayorDeficit');
    const kpiDeficitSub = document.getElementById('jevSignoMayorDeficitSub');
    const kpiAtraso = document.getElementById('jevSignoMayorAtraso');
    const kpiAtrasoSub = document.getElementById('jevSignoMayorAtrasoSub');
    const kpiCaliente = document.getElementById('jevSignoMasCaliente');
    const kpiCalienteSub = document.getElementById('jevSignoMasCalienteSub');

    if (!tbody) return;

    if (!signos.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:2rem;">Presiona "Recalcular Todos los Pronósticos" para evaluar los signos zodiacales.</td></tr>`;
      return;
    }

    // KPIs
    if (kpiEsperada && signos[0]) kpiEsperada.textContent = signos[0].esperada;
    if (kpiDeficit && signos[0]) {
      kpiDeficit.innerHTML = renderSignoWithIcon(signos[0].signo, 22);
      if (kpiDeficitSub) kpiDeficitSub.textContent = `Déficit: ${signos[0].deficit} sorteos`;
    }
    const masAtrasado = signos.slice().sort((a, b) => b.atraso - a.atraso)[0];
    if (kpiAtraso && masAtrasado) {
      kpiAtraso.innerHTML = renderSignoWithIcon(masAtrasado.signo, 22);
      if (kpiAtrasoSub) kpiAtrasoSub.textContent = `${masAtrasado.atraso} sorteos sin salir`;
    }
    const masCaliente = signos.slice().sort((a, b) => b.frecuencia - a.frecuencia)[0];
    if (kpiCaliente && masCaliente) {
      kpiCaliente.innerHTML = renderSignoWithIcon(masCaliente.signo, 22);
      if (kpiCalienteSub) kpiCalienteSub.textContent = `${masCaliente.frecuencia} salidas totales`;
    }

    // Tabla
    tbody.innerHTML = signos.map((s, idx) => {
      const tendenciaColor = s.tendencia === 'caliente' ? 'var(--accent-rose)' :
                             s.tendencia === 'frío' ? 'var(--accent-cyan)' : 'var(--text-muted)';
      const tendenciaIcon = s.tendencia === 'caliente' ? '🔥' :
                            s.tendencia === 'frío' ? '❄️' : '➖';
      const scoreBg = s.scoreJEV > 30 ? 'rgba(239, 68, 68, 0.15)' :
                      s.scoreJEV > 20 ? 'rgba(245, 158, 11, 0.15)' : 'transparent';
      return `
        <tr style="background:${scoreBg};">
          <td><span class="badge ${idx < 3 ? 'badge-warning' : idx < 6 ? 'badge-info' : 'badge-primary'}">#${idx + 1}</span></td>
          <td><span class="sign-badge" style="font-size:0.95rem;padding:0.25rem 0.65rem;font-weight:700;">${renderSignoWithIcon(s.signo, 17)}</span></td>
          <td class="col-mono" style="font-weight:700;color:var(--accent-emerald);font-size:1rem;">${s.scoreJEV}</td>
          <td class="col-mono">${s.frecuencia}</td>
          <td class="col-mono">${s.esperada}</td>
          <td class="col-mono" style="font-weight:600;color:${s.deficit > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">${s.deficit > 0 ? '+' : ''}${s.deficit}</td>
          <td class="col-mono">${s.atraso}</td>
          <td class="col-mono">${s.atrasoRelativo}x</td>
          <td style="color:${tendenciaColor};font-weight:600;">${tendenciaIcon} ${s.tendencia.charAt(0).toUpperCase() + s.tendencia.slice(1)}</td>
          <td style="font-size:0.75rem;max-width:300px;line-height:1.4;">${s.razon}</td>
        </tr>
      `;
    }).join('');
  }

  // 10.5 Proyecciones 4 Cifras (Posicional)
  function renderPronosticos4C() {
    const proms = state.calculos.pronosticos || [];
    const container = document.getElementById('pronosticosList');
    if (!container) return;

    if (!proms.length) {
      container.innerHTML = `<p style="color:var(--text-muted)">Presiona "Recalcular Todos los Pronósticos" para generar candidatos.</p>`;
      return;
    }

    container.innerHTML = proms.map((p, idx) => `
      <div class="pred-item">
        <div class="pred-top">
          <div class="pred-number">${p.num}</div>
          <div class="pred-score">${p.score}% Prob.</div>
        </div>
        <div class="pred-reasons">
          <strong>Fundamentación estadística:</strong><br>
          ${p.razon}
        </div>
      </div>
    `).join('');
  }

  // ============================================================================
  // 11. PREDICTOR SECUENCIAL (N-GRAMAS / RETRO-PATRONES)
  // ============================================================================
  function renderSecuencial() {
    const sorteos = obtenerSorteosFiltrados();
    if (!sorteos.length) return;

    const dataSec = state.calculos.secuencial;
    if (!dataSec) return;

    // 1. Selector de Sorteos para simulación / backtesting (cacheado por lotería + ventana)
    const select = document.getElementById('selectSorteoSecuencial');
    if (select) {
      const cantOpciones = Math.min(30, sorteos.length);
      const cacheKey = `${state.loteria}-${state.timeWindow}-${cantOpciones}-${sorteos[0].f}-${sorteos[0].n}`;
      if (select.dataset.cacheKey !== cacheKey) {
        select.innerHTML = '';
        for (let i = 0; i < cantOpciones; i++) {
          const s = sorteos[i];
          const opt = document.createElement('option');
          opt.value = i.toString();
          const signoTxt = s.s ? `${getSignoUnicode(s.s)} ${s.s}` : '';
          opt.textContent = (i === 0)
            ? `🔴 En Vivo: ${s.f} (#${s.n} ${signoTxt})`
            : `T-${i}: ${s.f} (#${s.n} ${signoTxt})`;
          select.appendChild(opt);
        }
        select.dataset.cacheKey = cacheKey;
      }
      select.value = state.secuencial.targetIdx.toString();
    }

    // 2. Badge de Modo
    const badgeModo = document.getElementById('secuencialBadgeModo');
    if (badgeModo) {
      if (dataSec.esBacktest) {
        badgeModo.className = 'badge badge-warning';
        badgeModo.textContent = `Modo: Simulación / Backtesting (Punto ${dataSec.sorteoBase.f} #${dataSec.sorteoBase.n})`;
      } else {
        badgeModo.className = 'badge badge-info';
        badgeModo.textContent = `Modo: En Vivo (Predicción Próximo Sorteo)`;
      }
    }

    // 3. Cadena de sorteos visualizada
    const contCadena = document.getElementById('cadenaSorteosVisual');
    if (contCadena) {
      contCadena.innerHTML = dataSec.sorteosVisual.map((item, idx) => `
        <div class="secuencial-chain-node ${item.esActual ? 'is-base' : ''}">
          <span class="secuencial-node-label">${item.esActual ? '★ Sorteo Base' : 'T-' + (dataSec.sorteosVisual.length - 1 - idx)}</span>
          <span class="secuencial-node-num">${item.numero}</span>
          <span class="secuencial-node-sub">${item.fecha} (${item.signo ? renderSignoWithIcon(item.signo, 12) : item.loteria})</span>
        </div>
        ${idx < dataSec.sorteosVisual.length - 1 ? '<span class="secuencial-chain-arrow">➔</span>' : ''}
      `).join('');
    }

    // 4. Panel de Evaluación Backtesting
    const panelBt = document.getElementById('panelBacktestSecuencial');
    if (panelBt) {
      if (dataSec.esBacktest && dataSec.backtestResult) {
        panelBt.style.display = 'block';
        const bt = dataSec.backtestResult;
        panelBt.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
            <div>
              <div style="font-size:0.75rem;font-weight:700;color:var(--primary);text-transform:uppercase;">
                🎯 Verificación de Predicción vs Realidad (Backtest)
              </div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--text-main);margin-top:0.2rem;">
                Resultado Real Siguiente: <span style="font-family:var(--font-mono);color:#38bdf8;font-size:1.15rem;">${bt.numReal}</span>
                <span style="font-size:0.85rem;color:var(--text-muted);font-weight:500;">(${bt.fechaReal}${bt.signoReal ? ' &bull; ' + renderSignoWithIcon(bt.signoReal, 14) : ''})</span>
              </div>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <span class="badge ${bt.aciertoTotal ? 'badge-success' : 'badge-danger'}">
                4 Cifras: ${bt.aciertoTotal ? '¡PLENO ACERTADO!' : 'Sin acierto pleno'}
              </span>
              <span class="badge ${bt.acierto3C ? 'badge-success' : 'badge-info'}">
                3C Fin: ${bt.acierto3C ? '¡ACERTADO!' : 'No'}
              </span>
              <span class="badge ${bt.acierto2C ? 'badge-success' : 'badge-info'}">
                2C Fin: ${bt.acierto2C ? '¡ACERTADO!' : 'No'}
              </span>
              <span class="badge ${bt.totalDigitosAcertados >= 2 ? 'badge-success' : 'badge-warning'}">
                ${bt.totalDigitosAcertados} de 4 dígitos acertados
              </span>
            </div>
          </div>
        `;
      } else {
        panelBt.style.display = 'none';
      }
    }

    // 5. Hero Card
    const numEstrella = document.getElementById('secuencialNumeroEstrella');
    if (numEstrella) {
      numEstrella.textContent = dataSec.consolidado.numeroEstrella;
    }

    const badgeFuerza = document.getElementById('badgeFuerzaSecuencia');
    if (badgeFuerza) {
      const prof = dataSec.consolidado.profundidadPromedio;
      badgeFuerza.className = prof >= 3 ? 'badge badge-warning' : 'badge badge-info';
      badgeFuerza.textContent = prof >= 3 ? 'Fuerza: Alta 🔥' : 'Fuerza: Moderada ⚡';
    }

    const elConf = document.getElementById('secuencialConfianza');
    if (elConf) elConf.textContent = `${dataSec.consolidado.confianzaPromedio}%`;

    const elProf = document.getElementById('secuencialProfundidad');
    if (elProf) elProf.textContent = `${dataSec.consolidado.profundidadPromedio} sorteos`;

    const elTop2C = document.getElementById('secuencialTop2C');
    const elTop2CSub = document.getElementById('secuencialTop2CSub');
    if (elTop2C && elTop2CSub) {
      if (dataSec.consolidado.top2CFinal) {
        elTop2C.textContent = dataSec.consolidado.top2CFinal.par;
        elTop2CSub.textContent = `${dataSec.consolidado.top2CFinal.pct}% (${dataSec.consolidado.top2CFinal.freq}x salidas)`;
      } else {
        elTop2C.textContent = '--';
        elTop2CSub.textContent = 'Sin histórico';
      }
    }

    const elTop3C = document.getElementById('secuencialTop3C');
    const elTop3CSub = document.getElementById('secuencialTop3CSub');
    if (elTop3C && elTop3CSub) {
      if (dataSec.consolidado.top3CFinal) {
        elTop3C.textContent = dataSec.consolidado.top3CFinal.trio;
        elTop3CSub.textContent = `${dataSec.consolidado.top3CFinal.pct}% (${dataSec.consolidado.top3CFinal.freq}x salidas)`;
      } else {
        elTop3C.textContent = '---';
        elTop3CSub.textContent = 'Sin histórico';
      }
    }

    const contAlt = document.getElementById('secuencialAlternativos');
    if (contAlt) {
      contAlt.innerHTML = dataSec.consolidado.alternativos.map(num => `
        <span class="comb-tag" style="font-size:0.95rem;padding:0.3rem 0.75rem;cursor:pointer;" title="Número alternativo sugerido">
          ${num}
        </span>
      `).join('');
    }

    // 5.5 Renderizar los 8 Números de Oro (Motor de Convergencia Entrópica)
    const inputRuta = document.getElementById('inputRutaExportFichero');
    if (inputRuta && state.secuencial.rutaFichero) {
      inputRuta.value = state.secuencial.rutaFichero;
    }
    actualizarPreviewFichero();

    const gridConvergencia = document.getElementById('gridConvergenciaEntropica');
    const panelBtConv = document.getElementById('panelBacktestConvergencia');
    const top8 = state.calculos.top8Convergencia || [];

    const normSignoBt = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const btConvActivo = Boolean(dataSec.esBacktest && dataSec.backtestResult && top8.length > 0);
    const btConv = btConvActivo ? dataSec.backtestResult : null;
    const numRealConv = btConv ? String(btConv.numReal || '').padStart(4, '0') : '';
    const signoRealConvNorm = btConv ? normSignoBt(btConv.signoReal) : '';

    const evalsConv = btConvActivo
      ? top8.map((item) => {
          const numPred = String(item.numero || '').padStart(4, '0');
          let digitosAcertados = 0;
          for (let p = 0; p < 4; p++) {
            if (numPred[p] === numRealConv[p]) digitosAcertados++;
          }
          return {
            rank: item.rank,
            numero: numPred,
            acierto4C: numPred === numRealConv,
            acierto3C: numPred.slice(1, 4) === numRealConv.slice(1, 4),
            acierto2C: numPred.slice(2, 4) === numRealConv.slice(2, 4),
            digitosAcertados,
            aciertoSigno: Boolean(signoRealConvNorm && normSignoBt(item.signo) === signoRealConvNorm)
          };
        })
      : [];

    if (panelBtConv) {
      if (btConvActivo) {
        panelBtConv.style.display = 'block';
        const hits4C = evalsConv.filter(e => e.acierto4C);
        const hits3C = evalsConv.filter(e => e.acierto3C);
        const hits2C = evalsConv.filter(e => e.acierto2C);
        const hitsSigno = evalsConv.filter(e => e.aciertoSigno);
        const mejorItem = evalsConv.reduce((best, cur) => (cur.digitosAcertados > best.digitosAcertados ? cur : best), evalsConv[0]);

        panelBtConv.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
            <div>
              <div style="font-size:0.75rem;font-weight:700;color:var(--primary);text-transform:uppercase;">
                🎯 Verificación de Predicción vs Realidad (Backtest — Top 8 de Oro)
              </div>
              <div style="font-size:0.95rem;font-weight:800;color:var(--text-main);margin-top:0.2rem;">
                Resultado Real Siguiente: <span style="font-family:var(--font-mono);color:#38bdf8;font-size:1.15rem;">${btConv.numReal}</span>
                <span style="font-size:0.85rem;color:var(--text-muted);font-weight:500;">(${btConv.fechaReal}${btConv.signoReal ? ' &bull; ' + renderSignoWithIcon(btConv.signoReal, 14) : ''})</span>
              </div>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <span class="badge ${hits4C.length ? 'badge-success' : 'badge-danger'}">
                4 Cifras: ${hits4C.length ? `¡PLENO ACERTADO! (#${hits4C.map(h => h.rank).join(', #')})` : 'Sin acierto pleno'}
              </span>
              <span class="badge ${hits3C.length ? 'badge-success' : 'badge-info'}">
                3C Fin: ${hits3C.length ? `¡ACERTADO! (#${hits3C.map(h => h.rank).join(', #')})` : 'No'}
              </span>
              <span class="badge ${hits2C.length ? 'badge-success' : 'badge-info'}">
                2C Fin: ${hits2C.length ? `¡ACERTADO! (#${hits2C.map(h => h.rank).join(', #')})` : 'No'}
              </span>
              <span class="badge ${mejorItem.digitosAcertados >= 2 ? 'badge-success' : 'badge-warning'}">
                Mejor: ${mejorItem.digitosAcertados} de 4 dígitos (#${mejorItem.rank})
              </span>
              ${signoRealConvNorm ? `
                <span class="badge ${hitsSigno.length ? 'badge-success' : 'badge-info'}">
                  Signo: ${hitsSigno.length ? `¡ACERTADO! (${hitsSigno.length}/8)` : 'No'}
                </span>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        panelBtConv.style.display = 'none';
      }
    }

    if (gridConvergencia) {
      if (!top8.length) {
        gridConvergencia.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;">Calculando los 8 números de oro...</p>`;
      } else {
        gridConvergencia.innerHTML = top8.map((item, idx) => {
          const ev = btConvActivo ? evalsConv[idx] : null;
          const esAciertoClave = Boolean(ev && (ev.acierto4C || ev.acierto3C || ev.acierto2C));
          const numeroHtml = ev
            ? ev.numero.split('').map((ch, p) => (
                ch === numRealConv[p]
                  ? `<span class="convergencia-digit-hit" title="Dígito acertado en posición D${p + 1}">${ch}</span>`
                  : ch
              )).join('')
            : item.numero;

          const btStripHtml = ev ? `
            <div class="convergencia-bt-strip ${esAciertoClave ? 'is-hit' : ''}">
              <span>Real: <strong>${btConv.numReal}</strong></span>
              <div style="display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center;">
                ${ev.acierto4C ? '<span class="badge badge-success" style="font-size:0.68rem;padding:0.12rem 0.45rem;">¡PLENO 4C!</span>' : ''}
                ${!ev.acierto4C && ev.acierto3C ? '<span class="badge badge-success" style="font-size:0.68rem;padding:0.12rem 0.45rem;">3C Fin ✓</span>' : ''}
                ${!ev.acierto4C && !ev.acierto3C && ev.acierto2C ? '<span class="badge badge-success" style="font-size:0.68rem;padding:0.12rem 0.45rem;">2C Fin ✓</span>' : ''}
                <span class="badge ${ev.digitosAcertados >= 2 ? 'badge-success' : 'badge-warning'}" style="font-size:0.68rem;padding:0.12rem 0.45rem;">${ev.digitosAcertados}/4 díg.</span>
                ${ev.aciertoSigno ? '<span class="badge badge-success" style="font-size:0.68rem;padding:0.12rem 0.45rem;">Signo ✓</span>' : ''}
              </div>
            </div>
          ` : '';

          return `
          <div class="convergencia-card ${idx === 0 ? 'is-top1' : ''} ${esAciertoClave ? 'is-bt-hit' : ''}">
            <div class="convergencia-header">
              <span class="convergencia-rank-badge">#${item.rank} ELECCIÓN DE ORO</span>
              <span class="sign-badge" style="font-size:0.75rem;padding:0.15rem 0.55rem;font-weight:700;">
                ${renderSignoWithIcon(item.signo, 14)}
              </span>
            </div>

            <div class="convergencia-number-row">
              <div class="convergencia-number">${numeroHtml}</div>
              <div class="convergencia-score-tag" title="Score de Convergencia Multidimensional">${item.score}%</div>
            </div>

            ${btStripHtml}

            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;color:var(--text-muted);">
              <span>${item.nivel}</span>
              <span>Cohesión: <strong style="color:var(--text-main);">${item.cohesionScore}x</strong></span>
            </div>

            <div class="convergencia-tags-row">
              <span class="convergencia-pill highlight" title="Probabilidad de que el 1er dígito acompañe al último">
                D1-D4: <strong>${item.r14}%</strong> (${item.diff14Pct >= 0 ? '+' : ''}${item.diff14Pct}%)
              </span>
              <span class="convergencia-pill" title="Afinidad pareja inicial">
                Par Ini: <strong>${item.r12}%</strong>
              </span>
              <span class="convergencia-pill" title="Afinidad pareja terminal">
                Par Fin: <strong>${item.r34}%</strong>
              </span>
              <span class="convergencia-pill" title="Fuerza en predictor secuencial">
                Secuencial: <strong>${item.secAvg}%</strong>
              </span>
            </div>

            <div class="convergencia-reason">
              ${item.fundamentacion}
            </div>
          </div>
        `;
        }).join('');
      }
    }

    // 6. Grid de las 4 Posiciones (D1, D2, D3, D4)
    const gridPos = document.getElementById('gridPosicionesSecuencial');
    if (gridPos) {
      gridPos.innerHTML = dataSec.posiciones.map(pos => {
        const isExp = state.secuencial.expandedPos[pos.pos];
        const matchesLmax = pos.matchesLmax || [];

        return `
          <div class="secuencial-pos-card">
            <div class="secuencial-pos-header">
              <div>
                <span class="secuencial-pos-tag">${pos.info.short} &bull; ${pos.info.label}</span>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.15rem;">
                  Secuencia máxima: <strong>${pos.Lmax} sorteos</strong> (${matchesLmax.length} repeticiones)
                </div>
              </div>
              <span class="badge badge-primary">Top Pick: ${pos.topPick.digit}</span>
            </div>

            <!-- Ganador -->
            <div class="secuencial-pos-winner">
              <div class="secuencial-digit-circle">${pos.topPick.digit}</div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:0.8rem;font-weight:700;color:var(--text-main);">Dígito Predilecto</span>
                  <span style="font-size:1.15rem;font-weight:800;color:#10b981;font-family:var(--font-mono);">${pos.topPick.pct}%</span>
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.2rem;">
                  2do: Dígito <strong>${pos.runnerUp.digit}</strong> (${pos.runnerUp.pct}%) &bull; 3ero: <strong>${pos.thirdPick.digit}</strong> (${pos.thirdPick.pct}%)
                </div>
              </div>
            </div>

            <!-- Cadena cronológica detectada -->
            <div style="background:rgba(0,0,0,0.15);padding:0.6rem 0.75rem;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);font-size:0.75rem;">
              <span style="color:var(--text-muted);">Patrón cronológico previo:</span>
              <div style="margin-top:0.35rem;font-family:var(--font-mono);font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                ${pos.patronCronologico.map(d => `<span class="secuencial-chain-pill">${d}</span>`).join('<span style="opacity:0.4;">➔</span>')}
                <span style="color:#10b981;font-weight:800;">➔ [ ? = ${pos.topPick.digit} ]</span>
              </div>
            </div>

            <!-- Barras de probabilidad consolidada (0 al 9) -->
            <div>
              <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:0.4rem;">
                Probabilidad Consolidada (0 al 9)
              </div>
              ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                const item = pos.ranking.find(r => r.digit === d) || { digit: d, pct: 0 };
                const isWinner = (d === pos.topPick.digit);
                return `
                  <div class="secuencial-prob-row">
                    <span style="font-family:var(--font-mono);font-weight:${isWinner ? '800' : '600'};color:${isWinner ? '#10b981' : 'var(--text-main)'};">${d}</span>
                    <div class="secuencial-bar-track">
                      <div class="secuencial-bar-fill ${isWinner ? 'is-winner' : ''}" style="width:${Math.max(2, item.pct)}%;"></div>
                    </div>
                    <span style="font-family:var(--font-mono);font-size:0.72rem;text-align:right;color:${isWinner ? '#10b981' : 'var(--text-muted)'};font-weight:${isWinner ? '700' : '400'};">${item.pct}%</span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Botón para ver historial de repeticiones -->
            <button class="btn-action btn-toggle-pos-historial" data-pos="${pos.pos}" style="width:100%;justify-content:center;font-size:0.75rem;padding:0.4rem 0.6rem;">
              <span>${isExp ? '▲ Ocultar Historial' : '▼ Ver Repeticiones Históricas (' + matchesLmax.length + ')'}</span>
            </button>

            <!-- Tabla de coincidencias desplegable -->
            <div id="historialPos${pos.pos}" style="display:${isExp ? 'block' : 'none'};margin-top:0.5rem;max-height:220px;overflow-y:auto;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
              <table class="data-table" style="font-size:0.72rem;">
                <thead>
                  <tr>
                    <th>Fecha Base</th>
                    <th>Sorteo</th>
                    <th>Sorteo Siguiente</th>
                    <th>Dígito</th>
                  </tr>
                </thead>
                <tbody>
                  ${matchesLmax.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Sin repeticiones previas</td></tr>' : matchesLmax.slice(0, 20).map(m => `
                    <tr>
                      <td>${m.fecha}</td>
                      <td class="col-mono">#${m.num}</td>
                      <td class="col-mono">${m.fechaSig} (#${m.numSig})</td>
                      <td class="col-mono" style="font-weight:700;color:#10b981;">➔ ${m.nextDigit}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

          </div>
        `;
      }).join('');

      // Asociar eventos a los botones de desplegar historial
      gridPos.querySelectorAll('.btn-toggle-pos-historial').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const p = parseInt(e.currentTarget.getAttribute('data-pos'), 10);
          state.secuencial.expandedPos[p] = !state.secuencial.expandedPos[p];
          renderSecuencial();
        });
      });
    }

    // 7. Contenido 2 Cifras Finales
    const cont2C = document.getElementById('contenido2CSecuencial');
    const badge2C = document.getElementById('badgeLmax2C');
    if (cont2C && dataSec.dosCifras) {
      if (badge2C) badge2C.textContent = `Longitud ${dataSec.dosCifras.Lmax}`;
      const c2 = dataSec.dosCifras;
      cont2C.innerHTML = `
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem;">
          Secuencia reciente terminal: <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-main);">${c2.seqActual.slice().reverse().join(' ➔ ')}</span>
          <span style="font-size:0.75rem;">(${c2.matches.length} coincidencias en el histórico)</span>
        </div>
        <div class="table-responsive">
          <table class="data-table" style="font-size:0.78rem;">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Par Siguiente</th>
                <th>Salidas</th>
                <th>Probabilidad</th>
              </tr>
            </thead>
            <tbody>
              ${c2.top.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Sin coincidencias</td></tr>' : c2.top.slice(0, 5).map((item, idx) => `
                <tr>
                  <td><span class="badge ${idx === 0 ? 'badge-warning' : 'badge-primary'}">#${idx + 1}</span></td>
                  <td class="col-mono" style="font-weight:800;font-size:1rem;color:#10b981;">${item.par}</td>
                  <td class="col-mono">${item.freq}x</td>
                  <td class="col-mono" style="font-weight:700;">${item.pct}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // 8. Contenido 3 Cifras Finales
    const cont3C = document.getElementById('contenido3CSecuencial');
    const badge3C = document.getElementById('badgeLmax3C');
    if (cont3C && dataSec.tresCifras) {
      if (badge3C) badge3C.textContent = `Longitud ${dataSec.tresCifras.Lmax}`;
      const c3 = dataSec.tresCifras;
      cont3C.innerHTML = `
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem;">
          Trío terminal evaluado: <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-main);">${c3.prev3C ? c3.prev3C + ' ➔ ' : ''}${c3.curr3C}</span>
          <span style="font-size:0.75rem;">(${c3.matches.length} salidas en el histórico)</span>
        </div>
        <div class="table-responsive">
          <table class="data-table" style="font-size:0.78rem;">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Trío Siguiente</th>
                <th>Salidas</th>
                <th>Probabilidad</th>
              </tr>
            </thead>
            <tbody>
              ${c3.top.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Sin coincidencias</td></tr>' : c3.top.slice(0, 5).map((item, idx) => `
                <tr>
                  <td><span class="badge ${idx === 0 ? 'badge-warning' : 'badge-primary'}">#${idx + 1}</span></td>
                  <td class="col-mono" style="font-weight:800;font-size:1rem;color:#f59e0b;">${item.trio}</td>
                  <td class="col-mono">${item.freq}x</td>
                  <td class="col-mono" style="font-weight:700;">${item.pct}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // 9. Contenido 4 Cifras Completo
    const cont4C = document.getElementById('contenido4CSecuencial');
    if (cont4C && dataSec.cuatroCifras) {
      const c4 = dataSec.cuatroCifras;
      if (c4.matches.length === 0) {
        cont4C.innerHTML = `
          <div style="padding:1rem;background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);border-radius:var(--radius-md);text-align:center;color:var(--text-muted);font-size:0.85rem;">
            El número exacto de 4 cifras <strong>#${c4.curr4C}</strong> no tiene salidas históricas repetidas con sorteo posterior registrado.
            Se priorizan las proyecciones posicionales y terminales.
          </div>
        `;
      } else {
        cont4C.innerHTML = `
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">
            El número <strong>#${c4.curr4C}</strong> ha salido <strong>${c4.matches.length} veces</strong> en el histórico. En los sorteos inmediatamente posteriores salieron:
          </div>
          <div class="table-responsive">
            <table class="data-table" style="font-size:0.8rem;">
              <thead>
                <tr>
                  <th>Fecha Sorteo Base</th>
                  <th>Número Base</th>
                  <th>Signo Base</th>
                  <th>Fecha Siguiente</th>
                  <th>Número que Salió al Siguiente</th>
                  <th>Signo Siguiente</th>
                </tr>
              </thead>
              <tbody>
                ${c4.matches.map(m => `
                  <tr>
                    <td>${m.fecha}</td>
                    <td class="col-mono">#${m.num}</td>
                    <td>${renderSignoWithIcon(m.signo, 14)}</td>
                    <td>${m.fechaSig}</td>
                    <td class="col-mono" style="font-weight:800;font-size:1.05rem;color:#38bdf8;">#${m.numSig}</td>
                    <td>${renderSignoWithIcon(m.signoSig, 14)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }
  }

  // ============================================================================
  // 10B. PREDICTOR POLINÓMICO (4 FÓRMULAS & GRÁFICOS SVG)
  // ============================================================================
  function renderPolinomico() {
    const sorteos = obtenerSorteosFiltrados();
    const poly = state.calculos.polinomico;
    const PolyMod = window.AstroPolynomial;
    if (!poly || !PolyMod || !sorteos.length) return;

    // 1. Poblar selector de punto de análisis (últimos 50 sorteos)
    const selectSorteo = document.getElementById('selectSorteoPolinomico');
    if (selectSorteo) {
      const maxOpts = Math.min(50, Math.max(1, sorteos.length - poly.windowSize));
      const desiredKey = `${state.loteria}-${state.timeWindow}-${maxOpts}`;
      if (selectSorteo.dataset.cacheKey !== desiredKey) {
        let optsHtml = '';
        for (let i = 0; i < maxOpts; i++) {
          const s = sorteos[i];
          const label = i === 0
            ? `🔴 EN VIVO: #${s.n} (${formatearFechaHumana(s.f)})`
            : `Simular desde #${s.n} (${formatearFechaHumana(s.f)})`;
          optsHtml += `<option value="${i}">${label}</option>`;
        }
        selectSorteo.innerHTML = optsHtml;
        selectSorteo.dataset.cacheKey = desiredKey;
      }
      selectSorteo.value = String(poly.targetIdx);
    }

    // 2. Badges de Modo y Consenso
    const badgeModo = document.getElementById('polyBadgeModo');
    if (badgeModo) {
      if (poly.targetIdx === 0) {
        badgeModo.textContent = 'Modo: En Vivo (Próximo Sorteo)';
        badgeModo.className = 'badge badge-info';
      } else {
        badgeModo.textContent = `Simulación Histórica (Base: #${poly.sorteoBase.n})`;
        badgeModo.className = 'badge badge-warning';
      }
    }

    const badgeConsenso = document.getElementById('polyBadgeConsenso');
    if (badgeConsenso) {
      badgeConsenso.textContent = `Consenso: #${poly.numeroConsenso}`;
    }

    // 3. Cadena cronológica (Más Antiguo -> Más Actual)
    const cadenaEl = document.getElementById('polyCadenaCrono');
    if (cadenaEl) {
      cadenaEl.innerHTML = poly.crono.map((s, idx) => {
        const isLast = idx === poly.crono.length - 1;
        return `
          ${idx > 0 ? '<span class="poly-chain-arrow">➔</span>' : ''}
          <div class="poly-chain-chip ${isLast ? 'is-latest' : ''}">
            <span class="chip-num">${s.n}</span>
            <span class="chip-date">${formatearFechaHumana(s.f)}</span>
          </div>
        `;
      }).join('') + `
        <span class="poly-chain-arrow">➔</span>
        <div class="poly-chain-chip" style="border-style:dashed;border-color:var(--accent-amber);">
          <span class="chip-num" style="color:var(--accent-amber);">????</span>
          <span class="chip-date">Próximo</span>
        </div>
      `;
    }

    // 4. Panel de Validación (solo si está en modo simulación histórica)
    const panelBacktest = document.getElementById('panelBacktestPolinomico');
    if (panelBacktest) {
      if (poly.sorteoSiguienteReal) {
        panelBacktest.style.display = 'block';
        const real = poly.sorteoSiguienteReal;
        const realDigs = [0, 1, 2, 3].map(p => parseInt(real.n[p], 10));

        const evalChips = poly.predicciones.map(pred => {
          let exactos = 0;
          let cercanos = 0;
          const digsHtml = pred.digitos.map((d, p) => {
            const dist = PolyMod.distCircular(d, realDigs[p]);
            if (dist === 0) exactos++;
            if (dist <= 1) cercanos++;
            const style = dist === 0
              ? 'color:#10b981;font-weight:900;text-decoration:underline;'
              : dist === 1
                ? 'color:#f59e0b;font-weight:700;'
                : 'opacity:0.65;';
            return `<span style="${style}">${d}</span>`;
          }).join('');
          return `
            <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:0.45rem 0.7rem;display:flex;align-items:center;gap:0.55rem;">
              <span class="poly-pred-code" style="background:${pred.colorSoft};color:${pred.color};">${pred.code}</span>
              <span style="font-family:var(--font-mono);font-size:1.05rem;letter-spacing:0.1em;">${digsHtml}</span>
              <span style="font-size:0.72rem;color:var(--text-muted);">${exactos}/4 exact. (${cercanos}/4 ±1)</span>
            </div>
          `;
        }).join('');

        panelBacktest.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
            <div>
              <span class="badge badge-primary" style="font-size:0.72rem;margin-bottom:0.25rem;">Validación Histórica Real</span>
              <div style="font-size:0.85rem;color:var(--text-main);">
                Sorteo real siguiente (${formatearFechaHumana(real.f)}):
                <strong style="font-family:var(--font-mono);font-size:1.15rem;color:#38bdf8;letter-spacing:0.1em;margin-left:0.35rem;">#${real.n}</strong>
                <span style="font-size:0.78rem;color:var(--text-muted);margin-left:0.35rem;">(${real.s || ''})</span>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
              ${evalChips}
            </div>
          </div>
        `;
      } else {
        panelBacktest.style.display = 'none';
      }
    }

    // 5. Renderizar las 4 Tarjetas Hero de Predicciones
    const predGrid = document.getElementById('polyPrediccionesGrid');
    if (predGrid) {
      predGrid.innerHTML = poly.predicciones.map((pred, idx) => {
        const bt = pred.backtest;
        const r2Pct = Math.round(pred.r2Avg * 100);
        return `
          <div class="poly-pred-card ${pred.esMejorBacktest ? 'is-best' : ''}" style="border-top: 3px solid ${pred.color};">
            <div class="poly-pred-header">
              <div style="display:flex;align-items:center;gap:0.45rem;">
                <span class="poly-pred-code" style="background:${pred.colorSoft};color:${pred.color};">${pred.code}</span>
                <span style="font-size:0.85rem;font-weight:700;color:var(--text-main);">${pred.nombre}</span>
              </div>
              ${pred.esMejorBacktest ? '<span class="badge badge-warning" style="font-size:0.68rem;">★ Mejor Backtest</span>' : `<span class="badge" style="font-size:0.68rem;">Opción #${idx + 1}</span>`}
            </div>

            <div class="poly-pred-number" style="color:${pred.color};">${pred.numero}</div>

            <div style="font-size:0.76rem;color:var(--text-muted);line-height:1.35;">
              ${pred.subtitulo}
            </div>

            <div class="poly-pred-eq">${pred.ecuacionTipo}</div>

            <div class="poly-pred-metrics">
              <span class="convergencia-pill">Saltos: <strong>+${pred.saltos.join(', +')}</strong></span>
              ${pred.id === 'f5' && pred.extra
                ? `<span class="convergencia-pill">Prob. post.: <strong>${pred.extra.probMedia}%</strong></span>`
                : `<span class="convergencia-pill">R² medio: <strong>${r2Pct}%</strong></span>`}
              ${bt && poly.backtest.totalEval > 0
                ? `<span class="convergencia-pill highlight">Exacto: <strong>${bt.pctExacto.toFixed(1)}%</strong> | ±1: <strong>${bt.pctCercano.toFixed(1)}%</strong></span>`
                : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // 6. Renderizar Cuadrícula de Gráficos y Fórmulas por Dígito (D1..D4)
    const digGrid = document.getElementById('polyDigitosGrid');
    if (digGrid) {
      const chartMode = state.polinomico.chartMode || 'both';
      digGrid.innerHTML = poly.posiciones.map(posData => {
        // Píldoras de pasos (d_prev -> d_curr (+Δ))
        const stepsHtml = posData.saltos.map((delta, i) => {
          const dPrev = posData.digitos[i];
          const dCurr = posData.digitos[i + 1];
          return `
            <span class="poly-step-pill" title="x=${i + 1}: de ${dPrev} a ${dCurr} = +${delta} (acumulado ${posData.acumulada[i + 1]})">
              x=${i + 1}: <strong>${dPrev}→${dCurr}</strong> <span class="step-delta">(+${delta})</span>
            </span>
          `;
        }).join('');

        // Gráficos SVG según modo elegido
        let chartsHtml = '';
        if (chartMode === 'both' || chartMode === 'saltos') {
          chartsHtml += PolyMod.renderChartSaltosSVG(posData);
        }
        if (chartMode === 'both' || chartMode === 'acumulada') {
          chartsHtml += PolyMod.renderChartAcumuladoSVG(posData);
        }

        // Filas de las fórmulas calculadas para este dígito (F1..F5)
        const rowsHtml = posData.formulas.map((f, fIdx) => {
          const meta = poly.formulaMeta[fIdx];
          const r2Str = meta.serie === 'hibrida' ? `${f.probPct}%` : `${Math.round(f.r2 * 100)}%`;
          const valDesc = meta.serie === 'acumulada'
            ? `S=${PolyMod.fmtNum(f.valorPredicho, 1)}`
            : meta.serie === 'hibrida'
              ? `+${f.saltoImplicito}`
              : `Δ=${PolyMod.fmtNum(f.valorPredicho, 2)}`;
          return `
            <tr>
              <td>
                <span class="poly-pred-code" style="background:${meta.colorSoft};color:${meta.color};">${meta.code}</span>
              </td>
              <td class="poly-formula-code">${f.formulaStr}</td>
              <td class="col-mono" style="white-space:nowrap;">${r2Str}</td>
              <td class="col-mono" style="white-space:nowrap;color:var(--text-muted);">${valDesc}</td>
              <td style="text-align:center;">
                <span class="poly-digit-badge" style="background:${meta.color};">${f.digitoPred}</span>
              </td>
            </tr>
          `;
        }).join('');

        return `
          <div class="poly-digit-card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <span class="badge badge-primary" style="font-size:0.78rem;font-weight:800;">${posData.label}</span>
                <span style="font-size:0.78rem;color:var(--text-muted);">
                  Último: <strong style="color:var(--text-main);font-family:var(--font-mono);">${posData.ultimoDigito}</strong>
                  &bull; Promedio salto: <strong style="color:var(--accent-cyan);font-family:var(--font-mono);">+${PolyMod.fmtNum(posData.promedioSaltos, 2)}</strong>
                </span>
              </div>
              <span class="badge badge-warning" style="font-size:0.74rem;">
                Consenso: ${posData.consenso.digit} (${posData.consenso.count}/${posData.formulas.length})
              </span>
            </div>

            <div class="poly-steps-strip">
              ${stepsHtml}
            </div>

            <div class="poly-charts-stack">
              ${chartsHtml}
            </div>

            <div class="table-responsive">
              <table class="poly-formula-table">
                <thead>
                  <tr>
                    <th>Mod.</th>
                    <th>Fórmula Estadística Hallada</th>
                    <th>R²</th>
                    <th>Proy.</th>
                    <th style="text-align:center;">Dígito</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('');
    }

    // 7. Backtesting Comparativo (Gráfico SVG + Tabla)
    const btBadge = document.getElementById('polyBacktestBadge');
    if (btBadge) {
      btBadge.textContent = `${poly.backtest.totalEval} sorteos evaluados (ventana W=${poly.windowSize})`;
    }

    const btChartEl = document.getElementById('polyBacktestChart');
    if (btChartEl && poly.backtest.totalEval > 0) {
      btChartEl.innerHTML = PolyMod.renderChartBacktestSVG(poly.backtest);
    } else if (btChartEl) {
      btChartEl.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:0.82rem;">No hay suficientes sorteos anteriores para ejecutar backtesting.</div>';
    }

    const tbodyBt = document.getElementById('tbodyPolyBacktest');
    if (tbodyBt) {
      if (poly.backtest.totalEval === 0) {
        tbodyBt.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Sin datos suficientes para backtesting.</td></tr>';
      } else {
        tbodyBt.innerHTML = poly.backtest.stats.map(s => {
          const isBest = s.id === poly.backtest.mejorId;
          const posBreakdown = s.pctPos.map(p => `${p.toFixed(0)}%`).join(' / ');
          return `
            <tr style="${isBest ? 'background:rgba(245,158,11,0.07);' : ''}">
              <td>
                <span class="poly-pred-code" style="background:${s.color}26;color:${s.color};margin-right:0.35rem;">${s.code}</span>
                <strong>${s.nombre}</strong>
                ${isBest ? '<span style="color:#f59e0b;margin-left:0.25rem;">★</span>' : ''}
              </td>
              <td class="col-mono" style="font-weight:800;color:${s.color};">${s.pctExacto.toFixed(1)}%</td>
              <td class="col-mono" style="font-weight:700;">${s.pctCercano.toFixed(1)}%</td>
              <td class="col-mono">${s.maeGlobal.toFixed(2)}</td>
              <td class="col-mono" style="font-size:0.75rem;color:var(--text-muted);">${posBreakdown}</td>
              <td class="col-mono">${s.sorteos2Mas} / ${poly.backtest.totalEval}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // ============================================================================
  // 10B2. PREDICTOR ADAPTATIVO & MÓDULO SEMANAL / RANGO DE DÍAS
  // ============================================================================
  function renderAdaptativo() {
    const sorteos = obtenerSorteosFiltrados();
    const adp = state.calculos.adaptativo;
    const AdpMod = window.AstroAdaptive;
    if (!AdpMod || !sorteos.length) return;

    const heroGrid = document.getElementById('adpHeroGrid');
    if (!adp) {
      if (heroGrid) {
        heroGrid.innerHTML = '<div class="card-panel" style="grid-column:1/-1;text-align:center;color:var(--text-muted);">Se necesitan al menos 60 sorteos en la ventana seleccionada (cambia el filtro temporal a 100, 1000 o Todo el Histórico).</div>';
      }
      return;
    }

    // 1. Selector de sorteo base / simulación (últimos 50)
    const selectEl = document.getElementById('selectSorteoAdaptativo');
    if (selectEl) {
      const maxOpts = Math.min(50, Math.max(1, sorteos.length - 60));
      const desiredKey = `adp-${state.loteria}-${state.timeWindow}-${maxOpts}`;
      if (selectEl.dataset.cacheKey !== desiredKey) {
        let html = '';
        for (let i = 0; i < maxOpts; i++) {
          const s = sorteos[i];
          const label = i === 0
            ? `🔴 EN VIVO: #${s.n} (${formatearFechaHumana(s.f)})`
            : `Simular desde #${s.n} (${formatearFechaHumana(s.f)})`;
          html += `<option value="${i}">${label}</option>`;
        }
        selectEl.innerHTML = html;
        selectEl.dataset.cacheKey = desiredKey;
      }
      selectEl.value = String(adp.targetIdx);
    }

    // 2. Badges de contexto del día y modo
    const ctxBadges = document.getElementById('adpContextoBadges');
    if (ctxBadges) {
      const modoHtml = adp.targetIdx === 0
        ? '<span class="badge badge-info" style="font-size:0.74rem;">Modo: En Vivo</span>'
        : `<span class="badge badge-warning" style="font-size:0.74rem;">Simulación · Base #${adp.ultimo.n}</span>`;
      const ctxHtml = adp.contextoDia
        ? `<span class="badge badge-primary" style="font-size:0.74rem;">Ref. Día (${adp.contextoDia.loteria}): #${adp.contextoDia.numero} ${adp.contextoDia.signo}</span>`
        : '<span class="badge" style="font-size:0.74rem;">Ref. Día: Histórico propio</span>';
      const msHtml = `<span class="badge" style="font-size:0.72rem;opacity:0.85;">${adp.cfg.nHistorico} sorteos · ${adp.ms} ms</span>`;
      ctxBadges.innerHTML = modoHtml + ctxHtml + msHtml;
    }

    // 3. Panel de validación en simulación histórica
    const panelBt = document.getElementById('panelBacktestAdaptativo');
    if (panelBt) {
      if (adp.backtest) {
        panelBt.style.display = 'block';
        const bt = adp.backtest;
        const digHtml = bt.real.n.split('').map((ch, idx) => {
          const st = bt.aciertos[idx]
            ? 'color:#10b981;font-weight:900;text-decoration:underline;'
            : bt.enTop3[idx]
              ? 'color:#f59e0b;font-weight:700;'
              : 'opacity:0.65;';
          return `<span style="${st}">${ch}</span>`;
        }).join('');

        const histChips = bt.horizonteReal.map(s => {
          const hit2 = bt.hits2CEnRango.some(x => x.f === s.f && x.n === s.n);
          const hit3 = bt.hits3CEnRango.some(x => x.f === s.f && x.n === s.n);
          const bg = hit3
            ? 'border-color:#10b981;background:rgba(16,185,129,0.18);'
            : hit2
              ? 'border-color:#38bdf8;background:rgba(56,189,248,0.14);'
              : '';
          return `<span class="adp-pick-chip" style="${bg}">
            <strong>${s.n}</strong>
            <span class="chip-meta">${formatearFechaHumana(s.f)}${hit3 ? ' ★3C' : (hit2 ? ' ✓2C' : '')}</span>
          </span>`;
        }).join('');

        panelBt.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.85rem;">
            <div>
              <span class="badge badge-primary" style="font-size:0.72rem;margin-bottom:0.3rem;">Validación Real Sin Fuga</span>
              <div style="font-size:0.86rem;">
                Siguiente sorteo real (${formatearFechaHumana(bt.real.f)}):
                <strong style="font-family:var(--font-mono);font-size:1.15rem;letter-spacing:0.12em;margin:0 0.35rem;">#${digHtml}</strong>
                <span style="color:var(--text-muted);">(${bt.real.s || ''})</span>
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.25rem;">
                Exactos: <strong>${bt.totalAciertos}/4</strong> &bull;
                En Top-3 dígito: <strong>${bt.enTop3.filter(Boolean).length}/4</strong> &bull;
                Top-12 2C: <strong>${bt.en2C ? 'SÍ ✓' : 'No'}</strong> &bull;
                En rango ${adp.horizon.H}d: <strong>${bt.hits2CEnRango.length} aciertos 2C</strong> / <strong>${bt.hits3CEnRango.length} aciertos 3C</strong>
              </div>
            </div>
            <div style="flex:1;min-width:260px;">
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.3rem;">Sorteos reales ocurridos en los siguientes ${adp.horizon.H} sorteos:</div>
              <div class="adp-pills-wrap">${histChips || '<span style="font-size:0.76rem;color:var(--text-muted);">Sin sorteos futuros suficientes</span>'}</div>
            </div>
          </div>
        `;
      } else {
        panelBt.style.display = 'none';
      }
    }

    // 4. Tarjeta Hero + Top 4C / 3C / 2C para próximo sorteo
    if (heroGrid) {
      const topSigno = adp.signo && adp.signo.ranking.length ? adp.signo.ranking[0] : null;
      const top3Signos = adp.signo ? adp.signo.ranking.slice(0, 3) : [];
      const zSign = adp.validacion.z >= 0 ? '+' : '';
      const diff2C = adp.horizonBT.pct2C - adp.horizonBT.base2C;

      const top4Html = adp.top4C.slice(0, 8).map(item => `
        <span class="adp-pick-chip">
          <span class="number-pill" data-num="${item.numero}" title="Analizar ${item.numero}">${item.numero}</span>
          <span class="chip-meta">${item.lift.toFixed(2)}×${item.signoSugerido ? ' · ' + item.signoSugerido.slice(0, 3) : ''}</span>
        </span>
      `).join('');

      const top3Html = adp.top3C.slice(0, 8).map(item => `
        <span class="adp-pick-chip">
          <strong style="color:var(--accent-purple);">${item.trio}</strong>
          <span class="chip-meta">${(item.prob * 100).toFixed(2)}%</span>
        </span>
      `).join('');

      const top2Html = adp.top2C.slice(0, 10).map(item => `
        <span class="adp-pick-chip">
          <strong style="color:var(--accent-emerald);">${item.par}</strong>
          <span class="chip-meta">${(item.prob * 100).toFixed(2)}%</span>
        </span>
      `).join('');

      heroGrid.innerHTML = `
        <div class="adp-star-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
            <span class="badge badge-info" style="font-size:0.72rem;">Próximo Sorteo · ${formatearFechaHumana(adp.fechaProx)}</span>
            <span class="badge badge-warning" style="font-size:0.72rem;">Ensamble 10 Expertos</span>
          </div>

          <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <span class="adp-star-number number-pill" data-num="${adp.numeroEstrella}" style="background:none;border:none;padding:0;cursor:pointer;" title="Analizar #${adp.numeroEstrella}">${adp.numeroEstrella}</span>
            ${topSigno ? `<div style="font-size:0.95rem;font-weight:700;">${renderSignoWithIcon(topSigno.signo, 18)} <span style="font-size:0.76rem;color:var(--text-muted);">(${topSigno.pct}%)</span></div>` : ''}
          </div>

          ${top3Signos.length ? `
            <div style="font-size:0.76rem;color:var(--text-muted);">
              Signos top: ${top3Signos.map(s => `<strong>${s.signo}</strong> (${s.pct}%)`).join(' · ')}
            </div>
          ` : ''}

          <div class="poly-pred-metrics" style="border-top-color:rgba(56,189,248,0.25);">
            <span class="convergencia-pill highlight">Exacto (${adp.validacion.evalN}d): <strong>${adp.validacion.pctEns.toFixed(2)}%</strong> (z=${zSign}${adp.validacion.z.toFixed(2)})</span>
            <span class="convergencia-pill">Top-3 díg.: <strong>${adp.validacion.pctTop3Ens.toFixed(1)}%</strong></span>
            <span class="convergencia-pill">Rango ${adp.horizon.H}d 2C: <strong>${adp.horizonBT.pct2C.toFixed(1)}%</strong> (${diff2C >= 0 ? '+' : ''}${diff2C.toFixed(1)} pts vs azar)</span>
          </div>
        </div>

        <div class="adp-subcards-panel">
          <div>
            <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.4rem;">
              Top 8 Combinaciones 4 Cifras (Probabilidad Conjunta · clic para analizar)
            </div>
            <div class="adp-pills-wrap">${top4Html}</div>
          </div>
          <div>
            <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.4rem;">
              Top 8 Terminales 3 Cifras (D2–D4)
            </div>
            <div class="adp-pills-wrap">${top3Html}</div>
          </div>
          <div>
            <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.4rem;">
              Top 10 Terminales 2 Cifras (Posicional + Secuencial 2C)
            </div>
            <div class="adp-pills-wrap">${top2Html}</div>
          </div>
        </div>
      `;
    }

    // 5. Distribuciones SVG por posición
    const evalBadge = document.getElementById('adpEvalBadge');
    if (evalBadge) {
      evalBadge.textContent = `Walk-Forward: ${adp.validacion.evalN} sorteos (${adp.validacion.totalD} dígitos)`;
    }
    const distGrid = document.getElementById('adpDistGrid');
    if (distGrid) {
      distGrid.innerHTML = adp.posiciones.map(pos => {
        const top3 = pos.ranking.slice(0, 3).map(r => `<strong>${r.digit}</strong> (${r.pct}%)`).join(' · ');
        return `
          <div style="display:flex;flex-direction:column;gap:0.45rem;">
            ${AdpMod.renderDistribucionSVG(pos)}
            <div style="font-size:0.74rem;color:var(--text-muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.25rem;">
              <span>Top-3: ${top3}</span>
              <span style="font-family:var(--font-mono);">BT: ${pos.ensAcierto.toFixed(1)}%</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // 6. Módulo Semanal / Rango de Días
    const hData = adp.horizon;
    const hTit = document.getElementById('adpHorizonteTitulo');
    if (hTit) {
      hTit.textContent = hData.H === 7
        ? 'Proyección Semanal (Próximos 7 Sorteos)'
        : `Proyección de Rango: Próximos ${hData.H} Sorteos`;
    }
    const hBadge = document.getElementById('adpHorizonteRangoBadge');
    if (hBadge) {
      hBadge.textContent = `${formatearFechaHumana(hData.fechaInicio)} ➔ ${formatearFechaHumana(hData.fechaFin)}`;
    }

    const hTopGrid = document.getElementById('adpHorizonteTopGrid');
    if (hTopGrid) {
      const box4C = hData.top4C.map(x => `
        <span class="adp-pick-chip">
          <span class="number-pill" data-num="${x.numero}">${x.numero}</span>
          <span class="chip-meta">${(x.prob * 100).toFixed(2)}% (${x.lift.toFixed(2)}×)</span>
        </span>
      `).join('');

      const box2C = hData.top2C.slice(0, 12).map(x => `
        <span class="adp-pick-chip">
          <strong style="color:var(--accent-emerald);">${x.par}</strong>
          <span class="chip-meta">${(x.prob * 100).toFixed(1)}% · ${x.lift.toFixed(2)}×</span>
        </span>
      `).join('');

      const box3C = hData.top3C.slice(0, 12).map(x => `
        <span class="adp-pick-chip">
          <strong style="color:var(--accent-purple);">${x.trio}</strong>
          <span class="chip-meta">${(x.prob * 100).toFixed(2)}% · ${x.lift.toFixed(2)}×</span>
        </span>
      `).join('');

      hTopGrid.innerHTML = `
        <div class="adp-horizon-box">
          <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;color:var(--accent-cyan);">
            Top 8 Números 4C para los ${hData.H} sorteos
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);">Probabilidad acumulada de salir al menos una vez (base azar: ${(hData.base4C * 100).toFixed(3)}%)</div>
          <div class="adp-pills-wrap">${box4C}</div>
        </div>
        <div class="adp-horizon-box">
          <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;color:var(--accent-emerald);">
            Top 12 Terminales 2C del Rango (${hData.H} sorteos)
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);">Base azar individual: ${(hData.base2C * 100).toFixed(1)}% en ${hData.H} sorteos</div>
          <div class="adp-pills-wrap">${box2C}</div>
        </div>
        <div class="adp-horizon-box">
          <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;color:var(--accent-purple);">
            Top 12 Terminales 3C del Rango (${hData.H} sorteos)
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);">Base azar individual: ${(hData.base3C * 100).toFixed(2)}% en ${hData.H} sorteos</div>
          <div class="adp-pills-wrap">${box3C}</div>
        </div>
      `;
    }

    // Tabla cronograma día por día
    const tbodyDias = document.getElementById('tbodyAdpDias');
    if (tbodyDias) {
      tbodyDias.innerHTML = hData.dias.map(d => {
        const topDigStr = d.topDig.map((arr, p) =>
          `<span style="margin-right:0.45rem;"><strong style="color:var(--text-muted);font-size:0.7rem;">D${p + 1}:</strong> ${arr.map(x => x.digit).join(',')}</span>`
        ).join('');
        return `
          <tr>
            <td><span class="badge ${d.h === 1 ? 'badge-warning' : ''}" style="font-size:0.72rem;">Día +${d.h} (${d.dia})</span></td>
            <td class="col-mono" style="white-space:nowrap;">${formatearFechaHumana(d.fecha)}</td>
            <td><span class="number-pill" data-num="${d.numero}">${d.numero}</span></td>
            <td>${d.signo ? renderSignoWithIcon(d.signo, 14) : '-'}</td>
            <td class="col-mono" style="font-size:0.76rem;">${topDigStr}</td>
            <td class="col-mono"><strong style="color:var(--accent-emerald);">${d.top2C.par}</strong> <span style="color:var(--text-muted);font-size:0.72rem;">(${(d.top2C.prob * 100).toFixed(2)}%)</span></td>
          </tr>
        `;
      }).join('');
    }

    // Gráfico multi-horizonte y tablas de precisión / cobertura
    const hChart = document.getElementById('adpHorizonteChart');
    if (hChart) {
      hChart.innerHTML = AdpMod.renderHorizonteSVG(adp.resumenHorizontes);
    }

    const tbodyH = document.getElementById('tbodyAdpHorizontes');
    if (tbodyH) {
      tbodyH.innerHTML = adp.resumenHorizontes.map(r => {
        const esActual = r.H === hData.H;
        const diff = r.pct2C - r.base2C;
        const diffColor = diff >= 0 ? '#10b981' : '#f59e0b';
        return `
          <tr style="${esActual ? 'background:rgba(56,189,248,0.1);font-weight:700;' : ''}">
            <td class="col-mono">${r.H} ${r.H === 1 ? 'día' : 'días'}${esActual ? ' ★' : ''}</td>
            <td class="col-mono" style="font-weight:800;color:${diffColor};">${r.pct2C.toFixed(1)}%</td>
            <td class="col-mono" style="color:var(--text-muted);">${r.base2C.toFixed(1)}%</td>
            <td class="col-mono" style="color:${diffColor};">${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pts</td>
            <td class="col-mono">${r.pctDig.toFixed(1)}% <span style="color:var(--text-muted);font-size:0.7rem;">(azar ${r.baseDig.toFixed(1)}%)</span></td>
          </tr>
        `;
      }).join('');
    }

    const tbodyCob = document.getElementById('tbodyAdpCobertura');
    if (tbodyCob) {
      tbodyCob.innerHTML = hData.cobertura.map(c => `
        <tr>
          <td class="col-mono"><strong>Top ${c.k} terminales 2C</strong></td>
          <td class="col-mono" style="font-weight:800;color:var(--accent-emerald);">${(c.probModelo * 100).toFixed(1)}%</td>
          <td class="col-mono" style="color:var(--text-muted);">${(c.probAzar * 100).toFixed(1)}%</td>
          <td class="col-mono" style="color:${c.ventaja >= 0 ? '#10b981' : '#f59e0b'};">${c.ventaja >= 0 ? '+' : ''}${c.ventaja.toFixed(1)} pts</td>
        </tr>
      `).join('');
    }

    const digAcumBox = document.getElementById('adpDigAcumBox');
    if (digAcumBox) {
      digAcumBox.innerHTML = `
        <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.4rem;">
          Dígitos más probables en los próximos ${hData.H} sorteos (base azar ${(hData.baseDig * 100).toFixed(1)}%)
        </div>
        <div class="adp-dig-acum-grid">
          ${hData.digAcum.map((arr, p) => `
            <div class="adp-dig-acum-item">
              <div style="font-weight:800;color:var(--accent-cyan);margin-bottom:0.2rem;">Posición D${p + 1}</div>
              <div class="col-mono">${arr.slice(0, 4).map(x => `<strong>${x.digit}</strong>(${(x.prob * 100).toFixed(0)}%)`).join(' · ')}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 7. Arena de los 10 expertos + gráfico de evolución de pesos
    const tbodyExp = document.getElementById('tbodyAdpExpertos');
    if (tbodyExp) {
      tbodyExp.innerHTML = adp.rankingExpertos.map((e, rank) => {
        const wPct = (e.peso * 100).toFixed(1);
        const barW = Math.min(100, e.peso * 260);
        const picks = adp.posiciones.map(pos => {
          const found = pos.expertos.find(x => x.id === e.id);
          return found ? found.top : '-';
        }).join(' / ');
        return `
          <tr style="${rank === 0 ? 'background:rgba(245,158,11,0.07);' : ''}">
            <td>
              <span class="poly-pred-code" style="background:${e.color}26;color:${e.color};margin-right:0.35rem;">${e.code}</span>
              <strong>${e.nombre}</strong>
            </td>
            <td class="col-mono" style="white-space:nowrap;">
              <span class="adp-weight-bar"><span style="width:${barW.toFixed(0)}%;background:${e.color};"></span></span>
              <strong>${wPct}%</strong>
            </td>
            <td class="col-mono" style="font-weight:700;">${e.acierto.toFixed(1)}%</td>
            <td class="col-mono" style="color:var(--text-muted);">${e.top3.toFixed(1)}%</td>
            <td class="col-mono" style="font-weight:700;color:${e.color};">${picks}</td>
          </tr>
        `;
      }).join('');
    }

    const pesosChart = document.getElementById('adpPesosChart');
    if (pesosChart) {
      const pIdx = Math.min(3, Math.max(0, state.adaptativo.pesosPos || 0));
      pesosChart.innerHTML = AdpMod.renderPesosSVG(adp.posiciones[pIdx]);
    }
  }

  // ============================================================================
  // 10C. LABORATORIO CUANTITATIVO (ML + FORENSE + CARTERA ÓPTIMA)
  // ============================================================================
  async function cargarYRenderizarQuant(force = false) {
    const key = `${state.loteria}-${state.quant.evalWindow}`;
    if (!force && state.quant.data && state.quant.cacheKey === key) {
      renderQuant();
      return;
    }

    const btn = document.getElementById('btnRunQuant');
    if (btn) { btn.classList.add('loading'); btn.disabled = true; }

    const banner = document.getElementById('quantEdgeBanner');
    if (banner) {
      banner.className = 'edge-banner edge-amarillo';
      banner.innerHTML = `
        <div class="edge-dot"></div>
        <div>
          <div class="edge-title">Ejecutando motor cuantitativo (Walk-Forward ${state.quant.evalWindow} sorteos)...</div>
          <div class="edge-desc">Evaluando χ², FDR Benjamini-Hochberg, Factor de Bayes, CUSUM, CTW, Regresión Logística L2 y Covering Design.</div>
        </div>
      `;
    }

    let payload = null;
    try {
      const res = await apiFetch(`/api/quant?loteria=${encodeURIComponent(state.loteria)}&window=${state.quant.evalWindow}&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        payload = await res.json();
      }
    } catch (e) {
      // Fallback a JS local si el servidor no responde
    }

    if (!payload || !payload.ok) {
      if (window.AstroQuant && typeof window.AstroQuant.computeFallbackJS === 'function') {
        const sorteosBase = obtenerSorteosActivosBase();
        payload = window.AstroQuant.computeFallbackJS(sorteosBase, state.loteria, state.quant.evalWindow);
      }
    }

    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }

    if (payload && payload.ok) {
      state.quant.data = payload;
      state.quant.cacheKey = key;
      renderQuant();
    } else if (banner) {
      banner.className = 'edge-banner edge-rojo';
      banner.innerHTML = `
        <div class="edge-dot"></div>
        <div>
          <div class="edge-title">No se pudo calcular el análisis cuantitativo</div>
          <div class="edge-desc">${(payload && payload.error) || 'Error inesperado'}</div>
        </div>
      `;
    }
  }

  function renderQuant() {
    const q = state.quant.data;
    const QMod = window.AstroQuant;
    if (!q || !QMod) return;

    // 1. Semáforo de Edge
    const banner = document.getElementById('quantEdgeBanner');
    if (banner && q.edge) {
      const cls = q.edge.nivel === 'verde' ? 'edge-verde' : q.edge.nivel === 'amarillo' ? 'edge-amarillo' : 'edge-rojo';
      banner.className = `edge-banner ${cls}`;
      banner.innerHTML = `
        <div class="edge-dot"></div>
        <div style="flex:1;">
          <div class="edge-title">${q.edge.titulo} ${q.offline ? '<span class="badge badge-info" style="margin-left:0.4rem;">Offline JS</span>' : '<span class="badge badge-primary" style="margin-left:0.4rem;">Python NumPy</span>'}</div>
          <div class="edge-desc">${q.edge.descripcion}</div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
          <span class="convergencia-pill">Alertas FDR: <strong>${q.edge.anomalias_fdr}</strong></span>
          <span class="convergencia-pill">ΔLog-Loss: <strong>${q.edge.delta_ll_milinats >= 0 ? '+' : ''}${q.edge.delta_ll_milinats} mnat</strong></span>
          <span class="convergencia-pill">p-valor: <strong>${q.edge.pvalue_ensamble}</strong></span>
        </div>
      `;
    }

    // 2. Cartera Óptima de 8 Boletos
    const modo = state.quant.portfolioMode || 'diversificada';
    const port = q.cartera && (q.cartera[modo] || q.cartera.diversificada);
    const kpiEl = document.getElementById('quantPortfolioKpis');
    const gridEl = document.getElementById('quantPortfolioGrid');

    if (port && kpiEl) {
      kpiEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Terminales 2C Únicas</span><span class="kpi-icon">🛡️</span></div>
          <div class="kpi-value" style="color:var(--accent-emerald);">${port.terminales_2c_unicas} / ${port.tickets.length}</div>
          <div class="kpi-sub">3C únicas: <strong>${port.terminales_3c_unicas}/${port.tickets.length}</strong></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Prob. Acierto ≥1 (2C)</span><span class="kpi-icon">🎯</span></div>
          <div class="kpi-value" style="color:var(--accent-cyan);">${port.cobertura_2c_pct}%</div>
          <div class="kpi-sub">Cobertura 3C: <strong>${port.cobertura_3c_pct}%</strong> por sorteo</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">EV Cartera (TODOS)</span><span class="kpi-icon">💰</span></div>
          <div class="kpi-value">$${port.ev_todos_total_cop.toLocaleString()}</div>
          <div class="kpi-sub">Retorno teórico: <strong>${port.ev_todos_pct}%</strong> sobre $${port.costo_total_cop.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">EV Cartera (Signo Directo)</span><span class="kpi-icon">♈</span></div>
          <div class="kpi-value">$${port.ev_directo_total_cop.toLocaleString()}</div>
          <div class="kpi-sub">Retorno teórico: <strong>${port.ev_directo_pct}%</strong> (top signos calibrados)</div>
        </div>
      `;
    }

    if (port && gridEl) {
      gridEl.innerHTML = port.tickets.map(t => `
        <div class="portfolio-ticket-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="badge ${t.rank <= 3 ? 'badge-warning' : 'badge-primary'}">#${t.rank} ÓPTIMO</span>
            <span class="sign-badge" style="padding:0.15rem 0.5rem;font-size:0.74rem;">${renderSignoWithIcon(t.signo, 14)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;">
            <span class="portfolio-ticket-num number-pill" style="background:transparent;border:none;padding:0;">${t.numero}</span>
            <span class="col-mono" style="font-size:0.82rem;color:var(--accent-emerald);">${t.prob_4c_rel}% rel</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
            <span class="convergencia-pill">2C *${t.t2}: <strong>${t.prob_2c_pct}%</strong></span>
            <span class="convergencia-pill">3C *${t.t3}: <strong>${t.prob_3c_pct}%</strong></span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
            <span>EV TODOS: <strong>$${t.ev_todos_por_1000}/1k</strong></span>
            <span>Directo: <strong>$${t.ev_directo_por_1000}/1k</strong></span>
          </div>
        </div>
      `).join('');
    }

    // 3. Arena Walk-Forward
    const arena = q.arena;
    const subArena = document.getElementById('quantArenaSub');
    if (subArena && arena) {
      subArena.textContent = `Evaluados ${arena.eval_window} sorteos (${arena.total_digitos_evaluados.toLocaleString()} dígitos) del ${formatearFechaHumana(arena.fecha_inicio_eval)} al ${formatearFechaHumana(arena.fecha_fin_eval)}.`;
    }

    const arenaChart = document.getElementById('quantArenaChart');
    if (arenaChart && arena) {
      arenaChart.innerHTML = QMod.renderArenaChartSVG(arena.modelos);
    }

    const tbodyArena = document.getElementById('tbodyQuantArena');
    if (tbodyArena && arena) {
      tbodyArena.innerHTML = arena.modelos.map(m => {
        const isEns = m.id === 'm5_ensamble';
        const llColor = m.delta_ll_vs_azar > 0 ? 'var(--accent-emerald)' : m.delta_ll_vs_azar < -2 ? 'var(--accent-rose)' : 'var(--text-muted)';
        return `
          <tr style="${isEns ? 'background:rgba(245,158,11,0.08);' : ''}">
            <td>
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${m.color};margin-right:0.4rem;"></span>
              <strong>${m.nombre}</strong>
            </td>
            <td class="col-mono" style="font-weight:800;color:${m.exact_pct > 10 ? 'var(--accent-emerald)' : 'var(--text-main)'};">${m.exact_pct.toFixed(2)}%</td>
            <td class="col-mono">${m.near_pct.toFixed(1)}%</td>
            <td class="col-mono">${m.log_loss.toFixed(4)} <span style="color:${llColor};font-size:0.72rem;">(${m.delta_ll_vs_azar >= 0 ? '+' : ''}${m.delta_ll_vs_azar})</span></td>
            <td class="col-mono">${m.hits_2c} / ${m.hits_3c} / ${m.hits_4c}</td>
            <td class="col-mono" style="color:${m.roi_todos_pct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">${m.roi_todos_pct >= 0 ? '+' : ''}${m.roi_todos_pct}%</td>
            <td class="col-mono">${m.id === 'm5_ensamble' ? '—' : m.peso_ensamble_pct + '%'}</td>
            <td><span class="number-pill">${m.next_pick}</span> <span style="font-size:0.7rem;color:var(--text-muted);">${m.next_signo}</span></td>
          </tr>
        `;
      }).join('');
    }

    // Distribuciones Posteriores Calibradas (4 gráficos SVG)
    const postGrid = document.getElementById('quantPosteriorGrid');
    if (postGrid && arena && arena.ensamble_probs_pos) {
      postGrid.innerHTML = arena.ensamble_probs_pos.map((probs, pIdx) => QMod.renderPosteriorPosSVG(pIdx, probs)).join('');
    }

    // 4. Auditoría Forense & CUSUM
    const fGrid = document.getElementById('quantForensicGrid');
    if (fGrid && q.forense && q.forense.posiciones) {
      const posColors = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b'];
      fGrid.innerHTML = q.forense.posiciones.map((pos, idx) => {
        const t1000 = pos.tests['1000'];
        const tAll = pos.tests['historico'];
        const t300 = pos.tests['300'];
        const anom = pos.anomalia_significativa;
        return `
          <div class="forensic-card ${anom ? 'is-anomaly' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="badge badge-primary">${pos.label}</span>
              <span class="badge ${anom ? 'badge-warning' : 'badge-info'}">
                ${anom ? '⚠️ Sesgo FDR < 0.05' : 'Uniforme (q=' + pos.qvalue_fdr_1000 + ')'}
              </span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.4rem;font-size:0.73rem;">
              <div style="background:var(--bg-card);padding:0.4rem;border-radius:6px;border:1px solid var(--border-subtle);">
                <div style="color:var(--text-dim);">χ² Hist.</div>
                <div class="col-mono" style="font-weight:700;">${tAll.chi2} <span style="font-size:0.66rem;color:var(--text-muted);">p=${tAll.pvalue}</span></div>
              </div>
              <div style="background:var(--bg-card);padding:0.4rem;border-radius:6px;border:1px solid var(--border-subtle);">
                <div style="color:var(--text-dim);">χ² 1,000d</div>
                <div class="col-mono" style="font-weight:700;color:${t1000.pvalue < 0.05 ? 'var(--accent-amber)' : 'var(--text-main)'};">${t1000.chi2} <span style="font-size:0.66rem;">p=${t1000.pvalue}</span></div>
              </div>
              <div style="background:var(--bg-card);padding:0.4rem;border-radius:6px;border:1px solid var(--border-subtle);">
                <div style="color:var(--text-dim);">χ² 300d</div>
                <div class="col-mono" style="font-weight:700;">${t300.chi2} <span style="font-size:0.66rem;color:var(--text-muted);">p=${t300.pvalue}</span></div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text-muted);">
              <span>Entropía: <strong class="col-mono">${(t1000.entropia_norm * 100).toFixed(2)}%</strong></span>
              <span>log₁₀(BF): <strong class="col-mono" style="color:${t1000.log10_bf > 0 ? 'var(--accent-amber)' : 'var(--text-main)'};">${t1000.log10_bf >= 0 ? '+' : ''}${t1000.log10_bf}</strong></span>
              <span>Top: <strong class="col-mono">#${t1000.top_digito} (${t1000.top_pct}%)</strong></span>
            </div>
            ${QMod.renderSparklineChi2SVG(pos.regimen.sparkline, posColors[idx])}
            <div style="font-size:0.71rem;color:var(--text-muted);">
              CUSUM: <strong>${pos.regimen.detectado ? '⚡ Posible cambio (' + (pos.regimen.fecha_cambio || '-') + ', díg. ' + pos.regimen.digito_impulsor + ')' : 'Sin cambio de régimen'}</strong>
            </div>
          </div>
        `;
      }).join('');
    }

    // Dependencias estructurales
    const depEl = document.getElementById('quantDependenciasStrip');
    if (depEl && q.forense && q.forense.dependencias) {
      const dep = q.forense.dependencias;
      const sg = q.forense.signos.tests['1000'];
      depEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Repetición Lag-1</span><span class="kpi-icon">🔁</span></div>
          <div class="kpi-value">${dep.lag1_repeat_pct}%</div>
          <div class="kpi-sub">Referencia azar puro: 10.00%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Acoplamiento D1–D4</span><span class="kpi-icon">🔗</span></div>
          <div class="kpi-value">χ²=${dep.d1_d4.chi2}</div>
          <div class="kpi-sub">p-valor: <strong>${dep.d1_d4.pvalue}</strong> (df=99)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Cruce Sol ➔ Luna</span><span class="kpi-icon">☀️🌙</span></div>
          <div class="kpi-value">${dep.cross_sol_luna_pct !== null ? dep.cross_sol_luna_pct + '%' : 'N/A'}</div>
          <div class="kpi-sub">${dep.cross_days ? dep.cross_days.toLocaleString() + ' días compartidos (azar: 10%)' : 'Requiere ambas loterías'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span class="kpi-title">Signos Zodiacales (1,000d)</span><span class="kpi-icon">♈</span></div>
          <div class="kpi-value">χ²=${sg.chi2}</div>
          <div class="kpi-sub">p=${sg.pvalue} &bull; Top: <strong>${sg.top_signo} (${sg.top_pct}%)</strong></div>
        </div>
      `;
    }
  }

  function descargarArchivoTexto(nombreArchivo, contenido) {
    const safeName = (nombreArchivo || 'lista_numeros-3.txt').replace(/[\\/:*?"<>|]+/g, '_');
    const finalName = safeName.toLowerCase().endsWith('.txt') ? safeName : `${safeName}.txt`;
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return finalName;
  }

  async function ejecutarExportacionQuantPlaywright() {
    const q = state.quant.data;
    const modo = state.quant.portfolioMode || 'diversificada';
    const port = q && q.cartera && (q.cartera[modo] || q.cartera.diversificada);
    if (!port || !port.tickets || !port.tickets.length) {
      mostrarToast('Aún no se ha generado la cartera cuantitativa', 'error');
      return;
    }

    const bloque1 = port.tickets.slice(0, 4).map(t => `${t.numero} 1000 TODOS`).join('\n');
    const bloque2 = port.tickets.slice(4, 8).map(t => `${t.numero} 1000 TODOS`).join('\n');
    const topT = port.tickets[0];
    const signosTop = (q.cartera.signos_top || []).map(x => x.signo.toUpperCase());
    const sExtra = signosTop.find(s => s !== 'LEO' && s !== 'ESCORPION') || 'LIBRA';
    const bloque3 = [
      `${topT.numero} 500 TODOS`,
      `${topT.numero} 500 LEO`,
      `${topT.numero} 500 ESCORPION`,
      `${topT.numero} 500 ${sExtra}`
    ].join('\n');

    const contenido = `${bloque1}\n\n${bloque2}\n\n${bloque3}\n`;
    const nombre = descargarArchivoTexto(`cartera_${state.loteria}_${modo}.txt`, contenido);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(contenido).catch(() => {});
    }
    mostrarToast(`Cartera descargada (${nombre}) y copiada al portapapeles`, 'success');
  }

  // ============================================================================
  // EXPORTADOR DE FICHERO DE APUESTAS (PLAYWRIGHT)
  // ============================================================================
  function generarContenidoFicheroApuestas() {
    const top8 = state.calculos.top8Convergencia || [];
    if (!top8 || top8.length < 8) return null;

    // Conteo de frecuencias para identificar la primera cifra y última cifra más común
    const countsD1 = {};
    const countsD4 = {};
    const countsSignos = {};

    top8.forEach(item => {
      const n = item.numero;
      countsD1[n[0]] = (countsD1[n[0]] || 0) + 1;
      countsD4[n[3]] = (countsD4[n[3]] || 0) + 1;
      if (item.signo) {
        const s = item.signo.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        countsSignos[s] = (countsSignos[s] || 0) + 1;
      }
    });

    const firstDigit = Object.keys(countsD1).sort((a, b) => countsD1[b] - countsD1[a])[0] || top8[0].numero[0];
    const lastDigit = Object.keys(countsD4).sort((a, b) => countsD4[b] - countsD4[a])[0] || top8[0].numero[3];

    // Signo más común del pronóstico, asegurando no duplicar con LEO ni ESCORPION
    const sortedSignos = Object.keys(countsSignos).sort((a, b) => countsSignos[b] - countsSignos[a]);
    let signoComun = sortedSignos.find(s => s !== 'LEO' && s !== 'ESCORPION');
    if (!signoComun) {
      signoComun = 'LIBRA';
    }

    const d2 = state.secuencial.randomCifras.d2;
    const d3 = state.secuencial.randomCifras.d3;
    const numEspecial = `${firstDigit}${d2}${d3}${lastDigit}`;

    // Bloque 1: Primeros 4 números favoritos con 1000 TODOS
    const bloque1 = top8.slice(0, 4).map(x => `${x.numero} 1000 TODOS`).join('\n');
    // Bloque 2: Siguientes 4 números favoritos con 1000 TODOS
    const bloque2 = top8.slice(4, 8).map(x => `${x.numero} 1000 TODOS`).join('\n');
    // Bloque 3: Número comodín con 500 y signos TODOS, LEO, ESCORPION y el más común
    const bloque3 = [
      `${numEspecial} 500 TODOS`,
      `${numEspecial} 500 LEO`,
      `${numEspecial} 500 ESCORPION`,
      `${numEspecial} 500 ${signoComun}`
    ].join('\n');

    const contenido = `${bloque1}\n\n${bloque2}\n\n${bloque3}\n`;

    return {
      contenido,
      numEspecial,
      signoComun,
      firstDigit,
      lastDigit,
      d2,
      d3
    };
  }

  function actualizarPreviewFichero() {
    const container = document.getElementById('previewFicheroContainer');
    const pre = document.getElementById('prePreviewFichero');
    const tagNum = document.getElementById('previewNumeroEspecialTag');
    const tagSigno = document.getElementById('previewSignoComunTag');
    const textToggle = document.getElementById('textTogglePreview');

    if (!container || !pre) return;

    if (state.secuencial.showPreview) {
      container.style.display = 'block';
      if (textToggle) textToggle.textContent = '▲ Ocultar Vista Previa';
      const gen = generarContenidoFicheroApuestas();
      if (gen) {
        pre.textContent = gen.contenido;
        if (tagNum) tagNum.textContent = `Comodín: #${gen.numEspecial} (${gen.firstDigit}-${gen.d2}-${gen.d3}-${gen.lastDigit})`;
        if (tagSigno) tagSigno.innerHTML = `Signo: ${renderSignoWithIcon(gen.signoComun, 13)}`;
      } else {
        pre.textContent = 'Generando pronósticos de apuestas...';
      }
    } else {
      container.style.display = 'none';
      if (textToggle) textToggle.textContent = '👁️ Vista Previa';
    }
  }

  async function copiarFicheroApuestasAlPortapapeles() {
    const gen = generarContenidoFicheroApuestas();
    if (!gen) {
      mostrarToast('Aún no se han generado los 8 números de oro para copiar', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(gen.contenido);
      mostrarToast('Lista de boletos copiada al portapapeles', 'success');
    } catch (err) {
      mostrarToast('No se pudo acceder al portapapeles en este navegador', 'error');
    }
  }

  async function ejecutarExportacionFicheroPlaywright() {
    const gen = generarContenidoFicheroApuestas();
    if (!gen) {
      mostrarToast('Aún no se han generado los 8 números de oro para exportar', 'error');
      return;
    }

    const inputRuta = document.getElementById('inputRutaExportFichero');
    const nombreBase = (inputRuta && inputRuta.value.trim()) ? inputRuta.value.trim() : state.secuencial.rutaFichero;
    state.secuencial.rutaFichero = nombreBase;

    const finalName = descargarArchivoTexto(nombreBase, gen.contenido);
    const lineas = gen.contenido.trim().splitlines ? gen.contenido.trim().splitlines().length : gen.contenido.trim().split('\n').length;
    mostrarToast(`¡Archivo descargado (${finalName} - ${lineas} líneas)!`, 'success');
  }

  async function guardarListaUsuarioEnNube() {
    const inputEvaluador = document.getElementById('inputEvaluador');
    const texto = inputEvaluador ? inputEvaluador.value : (state.evaluador.lista || '');
    const tokens = texto.split(/\r?\n|[,;\s]+/).map(t => t.trim()).filter(t => /^\d{4}$/.test(t));
    const unicos = Array.from(new Set(tokens));
    if (!unicos.length) {
      mostrarToast('Ingresa al menos un número de 4 cifras para guardar.', 'error');
      return;
    }

    mostrarToast('Guardando lista en tu cuenta de Supabase...', 'info');
    try {
      const res = await apiFetch('/api/lista_usuario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeros: unicos })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        mostrarToast(`¡Lista guardada en la nube! (${data.total} números)`, 'success');
      } else {
        throw new Error(data.detail || data.error || 'No se pudo guardar');
      }
    } catch (err) {
      mostrarToast(`Error al guardar lista: ${err.message}`, 'error');
    }
  }

  // ============================================================================
  // AUXILIARES DE PAGINACIÓN Y FORMATO
  // ============================================================================

  function renderPaginationControls(elementId, cfg, totalPages, renderFn) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.innerHTML = `
      <div class="pagination-buttons">
        <button class="btn-page" ${cfg.page <= 1 ? 'disabled' : ''} id="${elementId}-prev">‹</button>
        <span style="font-size:0.8rem;padding:0 0.5rem;">Pág. ${cfg.page} de ${totalPages}</span>
        <button class="btn-page" ${cfg.page >= totalPages ? 'disabled' : ''} id="${elementId}-next">›</button>
      </div>
    `;

    const prev = document.getElementById(`${elementId}-prev`);
    const next = document.getElementById(`${elementId}-next`);
    if (prev) prev.addEventListener('click', () => { if (cfg.page > 1) { cfg.page--; renderFn(); } });
    if (next) next.addEventListener('click', () => { if (cfg.page < totalPages) { cfg.page++; renderFn(); } });
  }

  function formatearFechaHumana(fStr) {
    if (!fStr) return '';
    const partes = fStr.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fStr;
  }

  // ============================================================================
  // ACCIONES REMOTAS (SINCRONIZACIÓN Y EXPORTACIÓN)
  // ============================================================================

  async function sincronizarResultados() {
    if (!dom.btnSync) return;
    dom.btnSync.classList.add('loading');
    dom.btnSync.disabled = true;
    mostrarToast('Sincronizando resultados desde astroluna.co hacia Supabase...', 'info');

    try {
      const res = await apiFetch('/api/actualizar', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        const nuevos = data.resultado && typeof data.resultado.total_insertados === 'number'
          ? data.resultado.total_insertados
          : null;
        const msg = nuevos !== null && nuevos > 0
          ? `¡Supabase sincronizado con éxito! (+${nuevos} nuevos registros)`
          : '¡Supabase sincronizado con éxito! Ya estás al día.';
        mostrarToast(msg, 'success');
        await cargarDatos();
      } else {
        throw new Error(data.detail || data.error || 'Fallo en la actualización');
      }
    } catch (err) {
      mostrarToast(`No se pudo sincronizar: ${err.message}`, 'error');
    } finally {
      dom.btnSync.classList.remove('loading');
      dom.btnSync.disabled = false;
    }
  }

  async function exportarExcel() {
    mostrarToast('Generando libro Excel (.xlsx) en el servidor...', 'info');
    try {
      const res = await apiFetch('/api/exportar_excel?loteria=all', { method: 'GET' });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          msg = errJson.detail || errJson.error || msg;
        } catch (e) {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="?([^"]+)"?/i);
      const filename = match ? match[1] : `astro_resultados_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      mostrarToast(`¡Excel descargado (${filename})!`, 'success');
    } catch (err) {
      mostrarToast(`Error al descargar Excel: ${err.message}`, 'error');
    }
  }

  function mostrarToast(mensaje, tipo = 'info') {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    const icono = tipo === 'success' ? '✓' : tipo === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icono}</span> <span>${mensaje}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

})();

