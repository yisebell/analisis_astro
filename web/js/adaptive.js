/**
 * ==============================================================================
 * ASTRO ADAPTIVE ENGINE - PREDICTOR ADAPTATIVO & MÓDULO SEMANAL / RANGO DE DÍAS
 * ==============================================================================
 * Motor de Ensamble Bayesiano en Línea (Online Hedge + Fixed-Share) que aprende
 * día a día sin fuga de datos, combinando 10 expertos por posición (D1..D4) y
 * signo zodiacal:
 *
 *   E0 Azar uniforme (ancla de seguridad: previene sobreajuste)
 *   E1 Sesgo histórico global (Dirichlet: detecta sesgo físico persistente)
 *   E2 Régimen reciente (EWMA exponencial, vida media ~140 sorteos)
 *   E3 Secuencial N-grama (multi-profundidad L=1..6 con confianza por muestra)
 *   E4 Markov de saltos modulares (Δ siguiente condicionado al Δ anterior)
 *   E5 Polinómico suave (núcleo circular sobre F1..F4 de AstroPolynomial)
 *   E6 Híbrido Polinómico × Secuencial (producto de expertos)
 *   E7 Día de la semana (estacionalidad de calendario)
 *   E8 Contexto del día (Luna ← Sol del mismo día / Sol ← Luna de la víspera)
 *   E9 Atraso calibrado (presión de dígitos ausentes con contracción)
 *
 * Además incluye:
 *  - Modelo de terminales 2C (D3-D4) fusionando probabilidad posicional con
 *    transiciones secuenciales directas de pares 2C y memoria reciente EWMA.
 *  - Módulo Semanal / Rango de Días (H = 3, 5, 7, 10, 14, 30 sorteos):
 *    pronóstico día por día, probabilidad acumulada de salir al menos una vez,
 *    plan de cobertura óptima y backtesting walk-forward multi-horizonte.
 */

window.AstroAdaptive = (function () {
  'use strict';

  const EXPERTS = [
    { id: 'uni', code: 'E0', nombre: 'Azar uniforme', color: '#64748b', secuencial: false, digitos: true, signo: true },
    { id: 'glob', code: 'E1', nombre: 'Sesgo global', color: '#38bdf8', secuencial: false, digitos: true, signo: true },
    { id: 'rec', code: 'E2', nombre: 'Régimen reciente', color: '#22d3ee', secuencial: false, digitos: true, signo: true },
    { id: 'ngram', code: 'E3', nombre: 'Secuencial N-grama', color: '#a855f7', secuencial: true, digitos: true, signo: true },
    { id: 'delta', code: 'E4', nombre: 'Markov de saltos Δ', color: '#f472b6', secuencial: true, digitos: true, signo: false },
    { id: 'poly', code: 'E5', nombre: 'Polinómico suave', color: '#10b981', secuencial: true, digitos: true, signo: false },
    { id: 'hib', code: 'E6', nombre: 'Híbrido Poly×Sec', color: '#f59e0b', secuencial: true, digitos: true, signo: false },
    { id: 'wd', code: 'E7', nombre: 'Día de la semana', color: '#818cf8', secuencial: false, digitos: true, signo: true },
    { id: 'cross', code: 'E8', nombre: 'Contexto del día', color: '#fb7185', secuencial: true, digitos: true, signo: true },
    { id: 'gap', code: 'E9', nombre: 'Atraso calibrado', color: '#eab308', secuencial: false, digitos: true, signo: true }
  ];

  const SIGNOS = [
    'Aries', 'Tauro', 'Geminis', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Escorpion', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
  ];
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const CFG = {
    maxL: 6,
    maxLSigno: 3,
    ewmaDecay: 1 - 1 / 140,
    ewma2CDecay: 1 - 1 / 250,
    eta: 1.0,
    share: 0.005,
    polyWin: 5,
    trainSpan: 1500,
    evalSpan: 500
  };

  // ============================================================================
  // UTILIDADES
  // ============================================================================
  function normalize(p) {
    let s = 0;
    for (let i = 0; i < p.length; i++) s += p[i];
    if (!(s > 0)) return p.map(() => 1 / p.length);
    return p.map(v => v / s);
  }
  function uniform(K) { return new Array(K).fill(1 / K); }
  function mixU(p, a) { const K = p.length; return p.map(v => (1 - a) * v + a / K); }
  function argmax(p) { let b = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[b]) b = i; return b; }
  function rankIdx(p) { return p.map((v, i) => i).sort((a, b) => p[b] - p[a]); }
  function distCirc(a, b) { const d = Math.abs(a - b); return Math.min(d, 10 - d); }
  function weekday(f) { return new Date(f + 'T12:00:00Z').getUTCDay(); }
  function shiftDate(f, days) {
    const d = new Date(f + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function digitsOf(s) {
    if (s.d && s.d.length === 4) return s.d;
    const n = String(s.n).padStart(4, '0');
    return [+n[0], +n[1], +n[2], +n[3]];
  }
  function par2COf(s) {
    const d = digitsOf(s);
    return d[2] * 10 + d[3];
  }
  function signoIdx(s) {
    const k = String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace('escorpio', 'escorpion')
      .replace('escorpionn', 'escorpion');
    return SIGNOS.findIndex(x => x.toLowerCase() === k);
  }

  // ============================================================================
  // CANAL POR POSICIÓN (D1..D4 O SIGNO)
  // ============================================================================
  function crearCanal(K, esDigito) {
    const expertos = EXPERTS.filter(e => (esDigito ? e.digitos : e.signo));
    return {
      K,
      esDigito,
      expertos,
      w: new Array(expertos.length).fill(1 / expertos.length),
      glob: new Array(K).fill(0),
      globN: 0,
      ewma: new Array(K).fill(0),
      ngram: new Map(),
      deltaT: Array.from({ length: 10 }, () => new Array(10).fill(0)),
      wdT: Array.from({ length: 7 }, () => new Array(K).fill(0)),
      crossT: Array.from({ length: K }, () => new Array(K).fill(0)),
      lastSeen: new Array(K).fill(-1),
      hist: [],
      evalN: 0,
      hits: new Array(expertos.length + 1).fill(0),
      top3: new Array(expertos.length + 1).fill(0),
      logGain: new Array(expertos.length + 1).fill(0),
      wHist: []
    };
  }

  function predExpert(ch, id, ctx) {
    const K = ch.K;
    const h = ch.hist;
    const n = h.length;
    switch (id) {
      case 'uni':
        return uniform(K);
      case 'glob': {
        const a = 45;
        return ch.glob.map(c => (c + a / K) / (ch.globN + a));
      }
      case 'rec': {
        const a = 12;
        const s = ch.ewma.reduce((x, y) => x + y, 0);
        return ch.ewma.map(c => (c + a / K) / (s + a));
      }
      case 'ngram': {
        const maxL = ch.esDigito ? CFG.maxL : CFG.maxLSigno;
        const acc = new Array(K).fill(0);
        let wsum = 0;
        for (let L = 1; L <= Math.min(maxL, n); L++) {
          const key = L + ':' + h.slice(n - L).join(',');
          const c = ch.ngram.get(key);
          if (!c) break;
          const tot = c.reduce((x, y) => x + y, 0);
          const conf = tot / (tot + 6);
          const wL = Math.pow(L, 1.5) * conf;
          for (let d = 0; d < K; d++) acc[d] += wL * (c[d] + 0.5) / (tot + 0.5 * K);
          wsum += wL;
        }
        if (wsum === 0) return uniform(K);
        return mixU(acc.map(v => v / wsum), 0.18);
      }
      case 'delta': {
        if (n < 2) return uniform(K);
        const dPrev = (h[n - 1] - h[n - 2] + 10) % 10;
        const row = ch.deltaT[dPrev];
        const tot = row.reduce((x, y) => x + y, 0);
        const p = new Array(10).fill(0);
        for (let d = 0; d < 10; d++) {
          const delta = (d - h[n - 1] + 10) % 10;
          p[d] = (row[delta] + 3) / (tot + 30);
        }
        return p;
      }
      case 'poly': {
        if (!ctx.polyDigits) return uniform(K);
        const p = new Array(10).fill(0);
        ctx.polyDigits.forEach(pd => {
          for (let d = 0; d < 10; d++) {
            const dist = distCirc(d, pd);
            p[d] += Math.exp(-(dist * dist) / 2.2);
          }
        });
        return mixU(normalize(p), 0.52);
      }
      case 'hib': {
        const pp = predExpert(ch, 'poly', ctx);
        const pn = predExpert(ch, 'ngram', ctx);
        return mixU(normalize(pp.map((v, i) => v * pn[i])), 0.35);
      }
      case 'wd': {
        if (ctx.wd == null) return uniform(K);
        const row = ch.wdT[ctx.wd];
        const tot = row.reduce((x, y) => x + y, 0);
        const a = 35;
        return row.map(c => (c + a / K) / (tot + a));
      }
      case 'cross': {
        if (ctx.cross == null || ctx.cross < 0) return uniform(K);
        const row = ch.crossT[ctx.cross];
        const tot = row.reduce((x, y) => x + y, 0);
        const a = 35;
        return row.map(c => (c + a / K) / (tot + a));
      }
      case 'gap': {
        if (n < K) return uniform(K);
        const gaps = ch.lastSeen.map(ls => (ls < 0 ? n : n - 1 - ls));
        const raw = gaps.map(g => Math.exp(0.06 * Math.min(35, g / K - 1)));
        return mixU(normalize(raw), 0.7);
      }
    }
    return uniform(K);
  }

  function predictCanal(ch, ctx) {
    const preds = ch.expertos.map(e => predExpert(ch, e.id, ctx));
    const K = ch.K;
    const ens = new Array(K).fill(0);
    preds.forEach((p, e) => { for (let d = 0; d < K; d++) ens[d] += ch.w[e] * p[d]; });
    return { preds, ens: normalize(ens) };
  }

  function learnCanal(ch, preds, v, doLearn, doEval, ens) {
    const K = ch.K;
    if (doEval) {
      ch.evalN++;
      const all = preds.concat([ens]);
      all.forEach((p, e) => {
        const r = rankIdx(p);
        if (r[0] === v) ch.hits[e]++;
        if (r.slice(0, 3).includes(v)) ch.top3[e]++;
        ch.logGain[e] += Math.log2(Math.max(1e-12, p[v]) * K);
      });
    }
    if (doLearn) {
      let s = 0;
      for (let e = 0; e < ch.w.length; e++) {
        ch.w[e] *= Math.pow(Math.max(1e-9, preds[e][v]) * K, CFG.eta);
        s += ch.w[e];
      }
      const E = ch.w.length;
      for (let e = 0; e < E; e++) ch.w[e] = (1 - CFG.share) * (ch.w[e] / s) + CFG.share / E;
    }
  }

  function updateCanal(ch, v, ctx) {
    const K = ch.K;
    const h = ch.hist;
    const n = h.length;
    const maxL = ch.esDigito ? CFG.maxL : CFG.maxLSigno;
    for (let L = 1; L <= Math.min(maxL, n); L++) {
      const key = L + ':' + h.slice(n - L).join(',');
      let c = ch.ngram.get(key);
      if (!c) { c = new Array(K).fill(0); ch.ngram.set(key, c); }
      c[v]++;
    }
    if (ch.esDigito && n >= 2) {
      const dPrev = (h[n - 1] - h[n - 2] + 10) % 10;
      const dNow = (v - h[n - 1] + 10) % 10;
      ch.deltaT[dPrev][dNow]++;
    }
    ch.glob[v]++;
    ch.globN++;
    for (let d = 0; d < K; d++) ch.ewma[d] *= CFG.ewmaDecay;
    ch.ewma[v] += 1;
    if (ctx.wd != null) ch.wdT[ctx.wd][v]++;
    if (ctx.cross != null && ctx.cross >= 0) ch.crossT[ctx.cross][v]++;
    ch.lastSeen[v] = n;
    h.push(v);
  }

  // ============================================================================
  // MODELO DE TERMINALES 2C (CO-OCURRENCIA + TRANSICIÓN SECUENCIAL 2C)
  // ============================================================================
  function crearModelo2C() {
    return {
      glob: new Array(100).fill(0),
      globN: 0,
      ewma: new Array(100).fill(0),
      trans: Array.from({ length: 100 }, () => new Array(100).fill(0)),
      last2C: -1
    };
  }

  function updateModelo2C(m2, val2C) {
    if (m2.last2C >= 0) m2.trans[m2.last2C][val2C]++;
    m2.glob[val2C]++;
    m2.globN++;
    for (let k = 0; k < 100; k++) m2.ewma[k] *= CFG.ewma2CDecay;
    m2.ewma[val2C] += 1;
    m2.last2C = val2C;
  }

  /**
   * Fusiona probabilidad posicional P(D3=a)*P(D4=b) con transición secuencial 2C
   * y frecuencia suavizada 2C (con contracción fuerte para evitar sobreajuste).
   */
  function distribucion2C(P3, P4, m2, pasoH) {
    const out = new Array(100);
    const ewmaSum = m2.ewma.reduce((a, b) => a + b, 0);
    const hasTrans = (pasoH === 1 && m2.last2C >= 0);
    const tRow = hasTrans ? m2.trans[m2.last2C] : null;
    const tTot = hasTrans ? tRow.reduce((a, b) => a + b, 0) : 0;

    // En h=1 usamos transición secuencial directa + posicional + global/reciente;
    // en h>=2 decaemos la transición directa y damos más peso a la base estable.
    const wPos = pasoH === 1 ? 0.56 : 0.62;
    const wTrans = hasTrans ? 0.16 : 0;
    const wGlob = 0.18;
    const wRec = 1 - wPos - wTrans - wGlob;

    for (let a = 0; a < 10; a++) {
      for (let b = 0; b < 10; b++) {
        const idx = a * 10 + b;
        const pPos = P3[a] * P4[b];
        const pGlob = (m2.glob[idx] + 2.5) / (m2.globN + 250);
        const pRec = (m2.ewma[idx] + 1.8) / (ewmaSum + 180);
        const pTr = hasTrans ? (tRow[idx] + 0.8) / (tTot + 80) : 0.01;
        out[idx] = wPos * pPos + wTrans * pTr + wGlob * pGlob + wRec * pRec;
      }
    }
    return normalize(out);
  }

  // ============================================================================
  // CONTEXTO CRUZADO (DATOS DEL DÍA)
  // ============================================================================
  function construirMapaCruzado(loteria, otra) {
    if (loteria === 'combinados') {
      return { mode: 'prev_same_day', get: null, offset: 0 };
    }
    if (!otra || !otra.length || (loteria !== 'luna' && loteria !== 'sol')) return null;
    const m = new Map();
    otra.forEach(s => m.set(s.f, s));
    const offset = loteria === 'luna' ? 0 : -1;
    return { mode: 'other_lot', get: (fecha) => m.get(shiftDate(fecha, offset)) || null, offset };
  }

  // ============================================================================
  // MOTOR PRINCIPAL
  // ============================================================================
  function compute(sorteos, opts = {}) {
    if (!sorteos || sorteos.length < 60) return null;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const targetIdx = Math.max(0, Math.min(opts.targetIdx || 0, sorteos.length - 60));
    const horizonte = Math.max(1, Math.min(30, opts.horizonte || 7));
    const loteria = opts.loteria || 'luna';
    const desc = sorteos.slice(targetIdx);
    const crono = desc.slice().reverse();
    const n = crono.length;
    const cross = construirMapaCruzado(loteria, opts.otra);
    const Poly = window.AstroPolynomial;
    const tieneSignos = crono.filter(s => signoIdx(s.s) >= 0).length > n * 0.8;

    const canales = [0, 1, 2, 3].map(() => crearCanal(10, true));
    const canalSigno = tieneSignos ? crearCanal(12, false) : null;
    const modelo2C = crearModelo2C();
    const trainStart = Math.max(30, n - CFG.trainSpan);
    const evalStart = Math.max(trainStart, n - CFG.evalSpan);

    const histPred = [];

    function getCrossFor(i, fechaObjetivo) {
      if (!cross) return null;
      if (cross.mode === 'prev_same_day') {
        if (i > 0 && crono[i - 1].f === fechaObjetivo) return crono[i - 1];
        if (i === n && crono[n - 1]) return crono[n - 1];
        return null;
      }
      const cs = cross.get(fechaObjetivo);
      if (cs && (targetIdx === 0 || cs.f <= desc[0].f || (cross.offset === 0 && cs.f <= fechaObjetivo))) {
        return cs;
      }
      return null;
    }

    function buildCtx(i, fechaObjetivo) {
      const wd = weekday(fechaObjetivo);
      const crossS = getCrossFor(i, fechaObjetivo);
      let polyDigitsPorPos = null;
      if (Poly && typeof Poly.evaluarVentana === 'function' && i >= CFG.polyWin && i >= trainStart) {
        // 4to param false: usa solo F1..F4 (rápido, sin re-escanear N-gramas)
        const ev = Poly.evaluarVentana(desc, n - i, CFG.polyWin, false);
        if (ev) polyDigitsPorPos = [0, 1, 2, 3].map(p => ev.posiciones[p].formulas.slice(0, 4).map(f => f.digitoPred));
      }
      return { wd, crossS, polyDigitsPorPos };
    }

    function ctxCanal(base, p) {
      return {
        wd: base.wd,
        cross: base.crossS ? (p < 4 ? digitsOf(base.crossS)[p] : signoIdx(base.crossS.s)) : null,
        polyDigits: base.polyDigitsPorPos && p < 4 ? base.polyDigitsPorPos[p] : null
      };
    }

    /**
     * Distribución estacionaria calibrada para pasos futuros h >= 2 del horizonte.
     * Excluye expertos puramente de 1 paso y contrae suavemente hacia uniforme
     * para evitar arrastrar varianza de atraso a lo largo de toda una semana.
     */
    function stationary(ch, ctx) {
      const K = ch.K;
      const out = new Array(K).fill(0);
      let ws = 0;
      ch.expertos.forEach((e, ei) => {
        if (e.secuencial) return;
        const p = predExpert(ch, e.id, ctx);
        // Reducir peso relativo de atraso estático para horizontes largos
        const mult = e.id === 'gap' ? 0.45 : 1.0;
        const wEff = ch.w[ei] * mult;
        for (let d = 0; d < K; d++) out[d] += wEff * p[d];
        ws += wEff;
      });
      const base = ws > 0 ? out.map(v => v / ws) : uniform(K);
      return mixU(base, 0.25);
    }

    // ---------------- Pase walk-forward cronológico ----------------
    for (let i = 0; i < n; i++) {
      const s = crono[i];
      const digs = digitsOf(s);
      const activo = i >= trainStart;
      const base = activo
        ? buildCtx(i, s.f)
        : { wd: weekday(s.f), crossS: getCrossFor(i, s.f), polyDigitsPorPos: null };

      const ensPos = [];
      const statPos = [];
      for (let p = 0; p < 4; p++) {
        const ch = canales[p];
        const ctx = ctxCanal(base, p);
        if (activo) {
          const { preds, ens } = predictCanal(ch, ctx);
          ensPos.push(ens);
          if (i >= evalStart) statPos.push(stationary(ch, ctx));
          learnCanal(ch, preds, digs[p], true, i >= evalStart, ens);
          if (i >= evalStart && (i - evalStart) % 10 === 0) ch.wHist.push(ch.w.slice());
        }
        updateCanal(ch, digs[p], ctx);
      }
      if (canalSigno) {
        const sv = signoIdx(s.s);
        if (sv >= 0) {
          const ctx = ctxCanal(base, 4);
          if (activo) {
            const { preds, ens } = predictCanal(canalSigno, ctx);
            learnCanal(canalSigno, preds, sv, true, i >= evalStart, ens);
          }
          updateCanal(canalSigno, sv, ctx);
        }
      }
      if (i >= evalStart) {
        // Distribución 2C calibrada antes de observar s (sin fuga)
        const d2H1 = distribucion2C(ensPos[2], ensPos[3], modelo2C, 1);
        const d2St = distribucion2C(statPos[2], statPos[3], modelo2C, 2);
        histPred.push({ i, ens: ensPos, stat: statPos, d2H1, d2St });
      }
      updateModelo2C(modelo2C, par2COf(s));
    }

    // ---------------- Predicción del próximo sorteo ----------------
    const ultimo = desc[0];
    const fechaProx = shiftDate(ultimo.f, 1);
    const baseProx = buildCtx(n, fechaProx);
    const posiciones = canales.map((ch, p) => {
      const ctx = ctxCanal(baseProx, p);
      const { preds, ens } = predictCanal(ch, ctx);
      const ranking = rankIdx(ens).map(d => ({ digit: d, pct: Math.round(ens[d] * 1000) / 10 }));
      const expertos = ch.expertos.map((e, ei) => ({
        ...e,
        peso: ch.w[ei],
        top: argmax(preds[ei]),
        topPct: Math.round(preds[ei][argmax(preds[ei])] * 1000) / 10,
        pctAcierto: ch.evalN ? (ch.hits[ei] / ch.evalN) * 100 : 0,
        pctTop3: ch.evalN ? (ch.top3[ei] / ch.evalN) * 100 : 0,
        bitsGanados: ch.evalN ? ch.logGain[ei] / ch.evalN : 0
      }));
      const E = ch.expertos.length;
      return {
        pos: p,
        label: 'D' + (p + 1),
        ens,
        ranking,
        expertos,
        preds,
        evalN: ch.evalN,
        ensAcierto: ch.evalN ? (ch.hits[E] / ch.evalN) * 100 : 0,
        ensTop3: ch.evalN ? (ch.top3[E] / ch.evalN) * 100 : 0,
        ensBits: ch.evalN ? ch.logGain[E] / ch.evalN : 0,
        wHist: ch.wHist,
        stationary: (ctx2) => stationary(ch, ctx2)
      };
    });

    let signo = null;
    if (canalSigno) {
      const { preds, ens } = predictCanal(canalSigno, ctxCanal(baseProx, 4));
      const E = canalSigno.expertos.length;
      signo = {
        ranking: rankIdx(ens).map(k => ({ signo: SIGNOS[k], pct: Math.round(ens[k] * 1000) / 10 })),
        expertos: canalSigno.expertos.map((e, ei) => ({ ...e, peso: canalSigno.w[ei], top: SIGNOS[argmax(preds[ei])] })),
        ensAcierto: canalSigno.evalN ? (canalSigno.hits[E] / canalSigno.evalN) * 100 : 0,
        ensTop3: canalSigno.evalN ? (canalSigno.top3[E] / canalSigno.evalN) * 100 : 0,
        evalN: canalSigno.evalN
      };
    }

    // Top 4C, 3C, 2C para el próximo sorteo
    const P = posiciones.map(p => p.ens);
    const tops = P.map(p => rankIdx(p).slice(0, 5));
    const cands = [];
    tops[0].forEach(a => tops[1].forEach(b => tops[2].forEach(c => tops[3].forEach(d => {
      cands.push({ numero: `${a}${b}${c}${d}`, prob: P[0][a] * P[1][b] * P[2][c] * P[3][d] });
    }))));
    cands.sort((x, y) => y.prob - x.prob);
    const top4C = cands.slice(0, 12).map((c, idx) => ({
      ...c,
      lift: c.prob * 10000,
      signoSugerido: signo ? signo.ranking[idx % Math.min(4, signo.ranking.length)].signo : ''
    }));

    const dist2Prox = distribucion2C(P[2], P[3], modelo2C, 1);
    const top2C = dist2Prox
      .map((prob, idx) => ({ par: String(idx).padStart(2, '0'), prob, lift: prob * 100 }))
      .sort((x, y) => y.prob - x.prob)
      .slice(0, 12);

    const t3 = [];
    tops[1].forEach(a => tops[2].forEach(b => tops[3].forEach(c => {
      const p2 = dist2Prox[b * 10 + c];
      t3.push({ trio: `${a}${b}${c}`, prob: P[1][a] * p2 });
    })));
    t3.sort((x, y) => y.prob - x.prob);
    const top3C = t3.slice(0, 12).map(c => ({ ...c, lift: c.prob * 1000 }));

    const numeroEstrella = P.map(argmax).join('');

    // ---------------- Validación estadística global ----------------
    const evalN = posiciones[0].evalN;
    const hitsEns = posiciones.reduce((a, p) => a + (p.ensAcierto / 100) * p.evalN, 0);
    const hitsTop3Ens = posiciones.reduce((a, p) => a + (p.ensTop3 / 100) * p.evalN, 0);
    const totalD = evalN * 4;
    const pctEns = totalD ? (hitsEns / totalD) * 100 : 0;
    const pctTop3Ens = totalD ? (hitsTop3Ens / totalD) * 100 : 0;
    const z = totalD ? (hitsEns - 0.1 * totalD) / Math.sqrt(0.09 * totalD) : 0;
    const ci = totalD ? 1.96 * Math.sqrt(0.09 / totalD) * 100 : 0;
    const bitsEns = posiciones.reduce((a, p) => a + p.ensBits, 0) / 4;

    const rankingExpertos = canales[0].expertos.map((e, ei) => {
      const peso = posiciones.reduce((a, p) => a + p.expertos[ei].peso, 0) / 4;
      const acierto = posiciones.reduce((a, p) => a + p.expertos[ei].pctAcierto, 0) / 4;
      const top3 = posiciones.reduce((a, p) => a + p.expertos[ei].pctTop3, 0) / 4;
      const bits = posiciones.reduce((a, p) => a + p.expertos[ei].bitsGanados, 0) / 4;
      return { ...e, peso, acierto, top3, bits };
    }).sort((a, b) => b.peso - a.peso);

    // ---------------- Módulo Semanal / Rango de Días ----------------
    const horizon = computeHorizonte(posiciones, modelo2C, signo, fechaProx, horizonte, loteria);
    const horizonBT = backtestHorizonte(histPred, crono, horizonte);

    // Tabla comparativa de precisión para rangos estándar (1, 3, 5, 7, 14 días)
    const rangosTabla = [1, 3, 5, 7, 14];
    if (!rangosTabla.includes(horizonte)) {
      rangosTabla.push(horizonte);
      rangosTabla.sort((a, b) => a - b);
    }
    const resumenHorizontes = rangosTabla.map(h =>
      h === horizonte ? horizonBT : backtestHorizonte(histPred, crono, h)
    );

    // ---------------- Simulación histórica ----------------
    let backtest = null;
    if (targetIdx > 0) {
      const real = sorteos[targetIdx - 1];
      const rd = digitsOf(real);
      const aciertos = rd.map((d, p) => d === +numeroEstrella[p]);
      const enTop3 = rd.map((d, p) => posiciones[p].ranking.slice(0, 3).some(r => r.digit === d));
      const futurosH = sorteos.slice(Math.max(0, targetIdx - horizonte), targetIdx).reverse();
      const setTop2CH = new Set(horizon.top2C.slice(0, 10).map(x => x.par));
      const setTop3CH = new Set(horizon.top3C.slice(0, 10).map(x => x.trio));
      const hits2CEnRango = futurosH.filter(s => setTop2CH.has(String(s.n).padStart(4, '0').slice(2)));
      const hits3CEnRango = futurosH.filter(s => setTop3CH.has(String(s.n).padStart(4, '0').slice(1)));

      backtest = {
        real,
        aciertos,
        enTop3,
        totalAciertos: aciertos.filter(Boolean).length,
        en2C: top2C.some(c => c.par === real.n.slice(2)),
        en3C: top3C.some(c => c.trio === real.n.slice(1)),
        en4C: top4C.some(c => c.numero === real.n),
        horizonteReal: futurosH,
        hits2CEnRango,
        hits3CEnRango
      };
    }

    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    return {
      targetIdx,
      ultimo,
      fechaProx,
      loteria,
      contextoDia: baseProx.crossS
        ? {
            fecha: baseProx.crossS.f,
            numero: baseProx.crossS.n,
            signo: baseProx.crossS.s,
            loteria: loteria === 'luna' ? 'Astro Sol' : (loteria === 'sol' ? 'Astro Luna' : 'Sorteo previo')
          }
        : null,
      posiciones,
      signo,
      numeroEstrella,
      top4C,
      top3C,
      top2C,
      validacion: { evalN, pctEns, pctTop3Ens, z, ci, bitsEns, totalD },
      rankingExpertos,
      horizon,
      horizonBT,
      resumenHorizontes,
      backtest,
      cfg: { ...CFG, horizonte, nHistorico: n },
      ms: Math.round(t1 - t0)
    };
  }

  // ============================================================================
  // MÓDULO SEMANAL / RANGO DE DÍAS
  // ============================================================================
  function avanzarFechaSorteo(fecha, loteria) {
    // Astro Sol no juega domingos; Luna/Combinados juegan todos los días
    let next = shiftDate(fecha, 1);
    if (loteria === 'sol' && weekday(next) === 0) {
      next = shiftDate(next, 1);
    }
    return next;
  }

  function computeHorizonte(posiciones, modelo2C, signo, fechaProx, H, loteria) {
    const rho = 0.45;
    const dias = [];
    let fechaCur = (loteria === 'sol' && weekday(fechaProx) === 0) ? shiftDate(fechaProx, 1) : fechaProx;

    for (let h = 1; h <= H; h++) {
      const wd = weekday(fechaCur);
      const P = posiciones.map(pos => {
        if (h === 1) return pos.ens;
        const ctx = { wd, cross: null, polyDigits: null };
        const st = pos.stationary(ctx);
        const a = Math.pow(rho, h - 1);
        return pos.ens.map((v, d) => a * v + (1 - a) * st[d]);
      });

      const d2 = distribucion2C(P[2], P[3], modelo2C, h);
      let bestIdx = 0;
      for (let k = 1; k < 100; k++) if (d2[k] > d2[bestIdx]) bestIdx = k;
      const best2 = { par: String(bestIdx).padStart(2, '0'), prob: d2[bestIdx] };

      const top = P.map(argmax);
      const signoDia = signo ? signo.ranking[(h - 1) % Math.min(4, signo.ranking.length)].signo : '';

      dias.push({
        h,
        fecha: fechaCur,
        dia: DIAS[wd],
        P,
        d2,
        numero: top.join(''),
        signo: signoDia,
        topDig: P.map(p => rankIdx(p).slice(0, 3).map(d => ({ digit: d, pct: Math.round(p[d] * 1000) / 10 }))),
        top2C: best2
      });

      fechaCur = avanzarFechaSorteo(fechaCur, loteria);
    }

    // Probabilidad acumulada (al menos una vez) por dígito posicional
    const baseDig = 1 - Math.pow(0.9, H);
    const digAcum = [0, 1, 2, 3].map(p => {
      const out = [];
      for (let d = 0; d < 10; d++) {
        let noSale = 1;
        dias.forEach(x => { noSale *= (1 - x.P[p][d]); });
        out.push({ digit: d, prob: 1 - noSale, base: baseDig, lift: (1 - noSale) / baseDig });
      }
      return out.sort((a, b) => b.prob - a.prob);
    });

    // Probabilidad acumulada 2C en el rango de H sorteos
    const base2C = 1 - Math.pow(0.99, H);
    const pares = [];
    for (let k = 0; k < 100; k++) {
      let noSale = 1;
      dias.forEach(x => { noSale *= (1 - x.d2[k]); });
      pares.push({ par: String(k).padStart(2, '0'), prob: 1 - noSale });
    }
    pares.sort((x, y) => y.prob - x.prob);

    // Probabilidad acumulada 3C en el rango de H sorteos
    const base3C = 1 - Math.pow(0.999, H);
    const tops3 = [1, 2, 3].map(p => {
      const agg = new Array(10).fill(0);
      dias.forEach(x => x.P[p].forEach((v, d) => { agg[d] += v; }));
      return rankIdx(agg).slice(0, 6);
    });
    const trios = [];
    tops3[0].forEach(a => tops3[1].forEach(b => tops3[2].forEach(c => {
      let noSale = 1;
      dias.forEach(x => { noSale *= (1 - x.P[1][a] * x.d2[b * 10 + c]); });
      trios.push({ trio: `${a}${b}${c}`, prob: 1 - noSale });
    })));
    trios.sort((x, y) => y.prob - x.prob);

    // Top 4C del rango de H sorteos (para jugar toda la semana)
    const base4C = 1 - Math.pow(0.9999, H);
    const tops4 = [0, 1, 2, 3].map(p => digAcum[p].slice(0, 4).map(x => x.digit));
    const quads = [];
    tops4[0].forEach(a => tops4[1].forEach(b => tops4[2].forEach(c => tops4[3].forEach(d => {
      let noSale = 1;
      dias.forEach(x => { noSale *= (1 - x.P[0][a] * x.P[1][b] * x.d2[c * 10 + d]); });
      quads.push({ numero: `${a}${b}${c}${d}`, prob: 1 - noSale });
    }))));
    quads.sort((x, y) => y.prob - x.prob);

    // Plan de cobertura de terminales 2C (probabilidad conjunta de cubrir Top-K en H días)
    const cobertura = [3, 5, 8, 10, 15].map(k => {
      const sub = pares.slice(0, k);
      let noSaleConj = 1;
      dias.forEach(x => {
        let pDia = 0;
        sub.forEach(item => { pDia += x.d2[parseInt(item.par, 10)]; });
        noSaleConj *= Math.max(0, 1 - Math.min(0.999, pDia));
      });
      const probModelo = 1 - noSaleConj;
      const probAzar = 1 - Math.pow(1 - k / 100, H);
      return { k, probModelo, probAzar, ventaja: (probModelo - probAzar) * 100 };
    });

    return {
      H,
      fechaInicio: dias[0].fecha,
      fechaFin: dias[dias.length - 1].fecha,
      dias,
      digAcum,
      top2C: pares.slice(0, 15).map(x => ({ ...x, lift: x.prob / base2C })),
      top3C: trios.slice(0, 15).map(x => ({ ...x, lift: x.prob / base3C })),
      top4C: quads.slice(0, 8).map((x, idx) => ({
        ...x,
        lift: x.prob / base4C,
        signo: signo ? signo.ranking[idx % Math.min(4, signo.ranking.length)].signo : ''
      })),
      cobertura,
      base2C,
      base3C,
      base4C,
      baseDig
    };
  }

  /**
   * Backtest del horizonte: evalúa sin fuga en cada ancla histórica si el Top-10 2C
   * y el Top-3 de dígitos por posición salieron al menos una vez en los siguientes H sorteos.
   */
  function backtestHorizonte(histPred, crono, H) {
    const K2 = 10;
    let anclas = 0, hit2C = 0, hitDig = 0, totDig = 0;
    const rho = 0.45;
    for (let k = 0; k < histPred.length; k++) {
      const hp = histPred[k];
      if (!hp.ens.length || !hp.stat.length) continue;
      const i = hp.i;
      if (i + H > crono.length) break;

      // Acumular probabilidad de los 100 pares 2C a lo largo de H sorteos
      const noSale2C = new Array(100).fill(1);
      const aggDig = [0, 1, 2, 3].map(() => new Array(10).fill(0));

      for (let h = 1; h <= H; h++) {
        const a = Math.pow(rho, h - 1);
        for (let idx = 0; idx < 100; idx++) {
          const p2 = a * hp.d2H1[idx] + (1 - a) * hp.d2St[idx];
          noSale2C[idx] *= (1 - p2);
        }
        for (let p = 0; p < 4; p++) {
          for (let d = 0; d < 10; d++) {
            aggDig[p][d] += a * hp.ens[p][d] + (1 - a) * hp.stat[p][d];
          }
        }
      }

      const idxs = Array.from({ length: 100 }, (_, idx) => idx)
        .sort((x, y) => noSale2C[x] - noSale2C[y]);
      const setTop = new Set(idxs.slice(0, K2).map(idx => String(idx).padStart(2, '0')));
      const futuros = crono.slice(i, i + H);
      anclas++;
      if (futuros.some(s => setTop.has(String(s.n).padStart(4, '0').slice(2)))) hit2C++;

      for (let p = 0; p < 4; p++) {
        const top3 = rankIdx(aggDig[p]).slice(0, 3);
        totDig++;
        if (futuros.some(s => top3.includes(digitsOf(s)[p]))) hitDig++;
      }
    }
    const base2C = (1 - Math.pow(1 - K2 / 100, H)) * 100;
    const baseDig = (1 - Math.pow(0.7, H)) * 100;
    const pct2C = anclas ? (hit2C / anclas) * 100 : 0;
    const pctDig = totDig ? (hitDig / totDig) * 100 : 0;
    return {
      H,
      anclas,
      K2,
      pct2C,
      base2C,
      diff2C: pct2C - base2C,
      pctDig,
      baseDig,
      diffDig: pctDig - baseDig
    };
  }

  // ============================================================================
  // GRÁFICOS SVG
  // ============================================================================
  function palette() {
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    return isLight
      ? { bg: '#f8fafc', grid: '#e2e8f0', text: '#334155', muted: '#64748b', base: '#94a3b8' }
      : { bg: 'rgba(9, 13, 22, 0.6)', grid: 'rgba(148, 163, 184, 0.14)', text: '#e2e8f0', muted: '#94a3b8', base: 'rgba(148,163,184,0.55)' };
  }

  function renderDistribucionSVG(pos) {
    const pal = palette();
    const W = 300, H = 150, padL = 26, padR = 8, padT = 16, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxP = Math.max(0.16, ...pos.ens) * 1.08;
    const bw = plotW / 10;
    const toY = v => padT + plotH - (v / maxP) * plotH;
    const top = argmax(pos.ens);
    const bars = pos.ens.map((v, d) => {
      const x = padL + d * bw + bw * 0.15;
      const y = toY(v);
      const color = d === top ? '#f59e0b' : (v > 0.1 ? '#38bdf8' : '#475569');
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(padT + plotH - y).toFixed(1)}" rx="3" fill="${color}"><title>Dígito ${d}: ${(v * 100).toFixed(2)}%</title></rect>
        <text x="${(x + bw * 0.35).toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="${pal.text}" font-size="10" font-weight="700" font-family="var(--font-mono)">${d}</text>`;
    }).join('');
    const y10 = toY(0.1);
    return `<svg viewBox="0 0 ${W} ${H}" class="adp-svg" role="img" aria-label="Distribución ${pos.label}">
      <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="${pal.bg}"/>
      <line x1="${padL}" y1="${y10.toFixed(1)}" x2="${W - padR}" y2="${y10.toFixed(1)}" stroke="${pal.base}" stroke-dasharray="4,3"/>
      <text x="${padL - 4}" y="${(y10 + 3).toFixed(1)}" text-anchor="end" fill="${pal.muted}" font-size="8.5" font-family="var(--font-mono)">10%</text>
      ${bars}
      <text x="${padL}" y="11" fill="${pal.muted}" font-size="9.5" font-weight="600">${pos.label} · prob. del ensamble (línea = 10% azar)</text>
    </svg>`;
  }

  function renderPesosSVG(pos) {
    const pal = palette();
    const hist = pos.wHist;
    const W = 560, H = 175, padL = 32, padR = 10, padT = 18, padB = 20;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    if (!hist || hist.length < 2) return '';
    const E = hist[0].length;
    const toX = i => padL + (i / (hist.length - 1)) * plotW;
    const toY = v => padT + plotH - v * plotH;
    let layers = '';
    const cum = hist.map(() => 0);
    for (let e = 0; e < E; e++) {
      const lower = cum.slice();
      hist.forEach((w, i) => { cum[i] += w[e]; });
      let d = '';
      hist.forEach((w, i) => { d += (i ? 'L' : 'M') + toX(i).toFixed(1) + ',' + toY(cum[i]).toFixed(1); });
      for (let i = hist.length - 1; i >= 0; i--) d += 'L' + toX(i).toFixed(1) + ',' + toY(lower[i]).toFixed(1);
      d += 'Z';
      const meta = pos.expertos[e];
      layers += `<path d="${d}" fill="${meta.color}" opacity="0.86"><title>${meta.code} ${meta.nombre}: peso final ${(meta.peso * 100).toFixed(1)}%</title></path>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="adp-svg" role="img" aria-label="Evolución de pesos">
      <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="${pal.bg}"/>
      ${layers}
      <text x="${padL - 4}" y="${padT + 4}" text-anchor="end" fill="${pal.muted}" font-size="9">100%</text>
      <text x="${padL - 4}" y="${padT + plotH}" text-anchor="end" fill="${pal.muted}" font-size="9">0%</text>
      <text x="${padL}" y="12" fill="${pal.muted}" font-size="9.5" font-weight="600">${pos.label} · evolución de pesos entre los 10 expertos (últimos ${pos.evalN} sorteos)</text>
    </svg>`;
  }

  /** Curva SVG de cobertura acumulada (Top-10 2C real vs azar) según rango de días. */
  function renderHorizonteSVG(resumenHorizontes) {
    const pal = palette();
    if (!resumenHorizontes || !resumenHorizontes.length) return '';
    const W = 540, H = 185, padL = 38, padR = 16, padT = 22, padB = 28;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = resumenHorizontes.length;
    const toX = i => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const toY = pct => padT + plotH - (Math.min(100, Math.max(0, pct)) / 100) * plotH;

    const grid = [0, 25, 50, 75, 100].map(v => {
      const y = toY(v);
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${pal.grid}"/>
        <text x="${padL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="${pal.muted}" font-size="9" font-family="var(--font-mono)">${v}%</text>`;
    }).join('');

    const pathBase = resumenHorizontes.map((r, i) => `${i ? 'L' : 'M'}${toX(i).toFixed(1)},${toY(r.base2C).toFixed(1)}`).join(' ');
    const pathReal = resumenHorizontes.map((r, i) => `${i ? 'L' : 'M'}${toX(i).toFixed(1)},${toY(r.pct2C).toFixed(1)}`).join(' ');

    const dots = resumenHorizontes.map((r, i) => {
      const x = toX(i), yR = toY(r.pct2C), yB = toY(r.base2C);
      const col = r.pct2C >= r.base2C ? '#10b981' : '#f59e0b';
      return `
        <circle cx="${x.toFixed(1)}" cy="${yB.toFixed(1)}" r="3" fill="${pal.base}"/>
        <circle cx="${x.toFixed(1)}" cy="${yR.toFixed(1)}" r="4.5" fill="${col}" stroke="#fff" stroke-width="1.3">
          <title>Rango ${r.H}d: Modelo ${r.pct2C.toFixed(1)}% vs Azar ${r.base2C.toFixed(1)}% (${r.anclas} ventanas)</title>
        </circle>
        <text x="${x.toFixed(1)}" y="${(yR - 8).toFixed(1)}" text-anchor="middle" fill="${col}" font-size="9.5" font-weight="800" font-family="var(--font-mono)">${r.pct2C.toFixed(1)}%</text>
        <text x="${x.toFixed(1)}" y="${H - 9}" text-anchor="middle" fill="${pal.text}" font-size="9.5" font-weight="700" font-family="var(--font-mono)">${r.H}d</text>
      `;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" class="adp-svg" role="img" aria-label="Precisión por rango de días">
      <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="${pal.bg}"/>
      ${grid}
      <path d="${pathBase}" fill="none" stroke="${pal.base}" stroke-width="1.8" stroke-dasharray="4,3"/>
      <path d="${pathReal}" fill="none" stroke="#10b981" stroke-width="2.4"/>
      ${dots}
      <text x="${padL}" y="13" fill="${pal.muted}" font-size="9.5" font-weight="600">Acierto Top-10 Terminales 2C por Rango de Días (sólida = Real Backtest · punteada = Azar)</text>
    </svg>`;
  }

  return {
    EXPERTS,
    SIGNOS,
    DIAS,
    CFG,
    compute,
    renderDistribucionSVG,
    renderPesosSVG,
    renderHorizonteSVG
  };
})();
