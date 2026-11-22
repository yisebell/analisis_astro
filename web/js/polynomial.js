/**
 * ==============================================================================
 * ASTRO POLYNOMIAL ENGINE - PREDICTOR POLINÓMICO & SERIES MODULARES CRECIENTES
 * ==============================================================================
 * Modela cada uno de los 4 dígitos como una serie modular creciente (Base 10):
 *   - Saltos crecientes:  Δ_x = (d_x - d_{x-1} + 10) mod 10   (x = 1..n)
 *   - Serie acumulada:    S_0 = d_0,  S_x = S_{x-1} + Δ_x     (x = 0..n)
 *
 * Implementa 4 fórmulas estadísticas / polinómicas independientes por dígito:
 *   F1. Lineal Acumulada (Pendiente OLS sobre S_x)
 *   F2. Polinómica Cuadrática de Saltos (Grado 2 Ridge sobre Δ_x)
 *   F3. Cúbica Ponderada Acumulada (Grado 3 WLS Exponencial sobre S_x)
 *   F4. Armónica-Polinómica de Saltos (Tendencia + Ciclo Fourier sobre Δ_x)
 *
 * Incluye backtesting automático sin fuga de datos y generadores de gráficos SVG.
 */

window.AstroPolynomial = (function () {
  'use strict';

  const FORMULA_META = [
    {
      id: 'f1',
      code: 'F1',
      nombre: 'Lineal Acumulada (OLS)',
      nombreCorto: 'Lineal OLS',
      subtitulo: 'Pendiente constante sobre trayectoria en aumento S(x)',
      color: '#38bdf8',
      colorSoft: 'rgba(56, 189, 248, 0.16)',
      serie: 'acumulada',
      ecuacionTipo: 'S(x) = m·x + b'
    },
    {
      id: 'f2',
      code: 'F2',
      nombre: 'Cuadrática de Saltos (Grado 2)',
      nombreCorto: 'Cuadrática Δ',
      subtitulo: 'Parábola Ridge sobre incrementos modulares y(x) = Δ_x',
      color: '#a855f7',
      colorSoft: 'rgba(168, 85, 247, 0.16)',
      serie: 'saltos',
      ecuacionTipo: 'y(x) = a·x² + b·x + c'
    },
    {
      id: 'f3',
      code: 'F3',
      nombre: 'Cúbica Ponderada (WLS)',
      nombreCorto: 'Cúbica WLS',
      subtitulo: 'Polinomio grado 3 con mayor peso a sorteos recientes',
      color: '#10b981',
      colorSoft: 'rgba(16, 185, 129, 0.16)',
      serie: 'acumulada',
      ecuacionTipo: 'S(x) = a·x³ + b·x² + c·x + d'
    },
    {
      id: 'f4',
      code: 'F4',
      nombre: 'Armónica-Polinómica (Ciclo)',
      nombreCorto: 'Armónica Δ',
      subtitulo: 'Tendencia lineal + oscilación espectral dominante sobre Δ_x',
      color: '#f59e0b',
      colorSoft: 'rgba(245, 158, 11, 0.16)',
      serie: 'saltos',
      ecuacionTipo: 'y(x) = c₀ + c₁x + c₂cos(ωx) + c₃sin(ωx)'
    }
  ];

  // ============================================================================
  // UTILIDADES MATEMÁTICAS Y ÁLGEBRA LINEAL
  // ============================================================================

  function mod10(v) {
    const r = Math.round(v);
    return ((r % 10) + 10) % 10;
  }

  function distCircular(a, b) {
    const d = Math.abs(a - b);
    return Math.min(d, 10 - d);
  }

  function fmtNum(v, dec = 2) {
    if (!isFinite(v)) return '0';
    const fixed = Number(v.toFixed(dec));
    return Object.is(fixed, -0) ? '0' : fixed.toString();
  }

  function fmtSignedTerm(coef, suffix, isFirst) {
    if (!isFinite(coef)) return '';
    const absVal = Math.abs(coef);
    const str = fmtNum(absVal, 2);
    if (isFirst) {
      return (coef < 0 ? '-' : '') + str + suffix;
    }
    return (coef < 0 ? ' - ' : ' + ') + str + suffix;
  }

  /**
   * Resuelve el sistema lineal A * x = b mediante eliminación Gaussiana con pivoteo parcial.
   */
  function solveLinearSystem(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.slice().concat([b[i]]));

    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let maxAbs = Math.abs(M[col][col]);
      for (let r = col + 1; r < n; r++) {
        const val = Math.abs(M[r][col]);
        if (val > maxAbs) {
          maxAbs = val;
          pivotRow = r;
        }
      }

      if (maxAbs < 1e-12) {
        M[col][col] = 1e-9;
      } else if (pivotRow !== col) {
        const tmp = M[col];
        M[col] = M[pivotRow];
        M[pivotRow] = tmp;
      }

      const pivot = M[col][col];
      for (let r = col + 1; r < n; r++) {
        const factor = M[r][col] / pivot;
        if (factor === 0) continue;
        for (let c = col; c <= n; c++) {
          M[r][c] -= factor * M[col][c];
        }
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * x[j];
      }
      x[i] = Math.abs(M[i][i]) < 1e-12 ? 0 : sum / M[i][i];
    }
    return x;
  }

  /**
   * Ajusta una combinación lineal de funciones base (WLS + Ridge).
   * @param {number[][]} phi Matriz de diseño N x P
   * @param {number[]} ys Vector objetivo N
   * @param {number[]} weights Pesos N (opcional)
   * @param {number} lambda Regularización Ridge (no se aplica a la columna 0 = intercepto)
   */
  function fitBasisWLS(phi, ys, weights, lambda = 0) {
    const N = ys.length;
    const P = phi[0].length;
    const AtA = Array.from({ length: P }, () => new Array(P).fill(0));
    const Atb = new Array(P).fill(0);

    for (let i = 0; i < N; i++) {
      const w = weights ? weights[i] : 1;
      const row = phi[i];
      const y = ys[i];
      for (let j = 0; j < P; j++) {
        const wj = w * row[j];
        Atb[j] += wj * y;
        for (let k = j; k < P; k++) {
          AtA[j][k] += wj * row[k];
        }
      }
    }

    for (let j = 0; j < P; j++) {
      for (let k = 0; k < j; k++) {
        AtA[j][k] = AtA[k][j];
      }
      if (j > 0 && lambda > 0) {
        AtA[j][j] += lambda;
      }
    }

    return solveLinearSystem(AtA, Atb);
  }

  /**
   * Calcula R² y RMSE entre valores reales y predichos.
   */
  function computeMetrics(ys, yHats) {
    const n = ys.length;
    if (n === 0) return { r2: 0, rmse: 0 };
    const mean = ys.reduce((a, b) => a + b, 0) / n;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const err = ys[i] - yHats[i];
      ssRes += err * err;
      const dev = ys[i] - mean;
      ssTot += dev * dev;
    }
    const rmse = Math.sqrt(ssRes / n);
    let r2 = ssTot < 1e-9 ? (ssRes < 1e-9 ? 1 : 0) : 1 - ssRes / ssTot;
    r2 = Math.max(0, Math.min(1, r2));
    return { r2, rmse };
  }

  // ============================================================================
  // LAS 4 FÓRMULAS ESTADÍSTICAS PARA UN DÍGITO
  // ============================================================================

  /**
   * F1: Regresión Lineal OLS sobre la serie acumulada S(x), x = 0..n
   */
  function fitF1LinealAcumulada(xsS, ysS) {
    const n = xsS.length - 1; // último índice
    const phi = xsS.map(x => [1, x]);
    const coef = fitBasisWLS(phi, ysS, null, 0);
    const [b, m] = coef;

    const evalFn = (x) => b + m * x;
    const fitted = xsS.map(evalFn);
    const { r2, rmse } = computeMetrics(ysS, fitted);

    const xNext = n + 1;
    const sNext = evalFn(xNext);
    const deltaNext = sNext - ysS[n];
    const digitoPred = mod10(sNext);

    const formulaStr = `S(x) = ${fmtSignedTerm(m, 'x', true)}${fmtSignedTerm(b, '', false)}`;

    return {
      id: 'f1',
      coef: { m, b },
      evalFn,
      fitted,
      xNext,
      valorPredicho: sNext,
      saltoImplicito: deltaNext,
      digitoPred,
      r2,
      rmse,
      formulaStr,
      pendiente: m
    };
  }

  /**
   * F2: Polinomio Cuadrático Ridge sobre saltos Δ(x), x = 1..n
   */
  function fitF2CuadraticaSaltos(xsD, ysD, ultimoDigito) {
    const n = xsD.length;
    // Escalar x en torno a su centro para estabilidad numérica y convertir de vuelta
    const xMean = (n + 1) / 2;
    const phi = xsD.map(x => {
      const xc = x - xMean;
      return [1, xc, xc * xc];
    });

    // Regularización suave proporcional al tamaño para evitar extrapolaciones explosivas
    const lambda = n <= 5 ? 0.35 : 0.18;
    const [c0, c1, c2] = fitBasisWLS(phi, ysD, null, lambda);

    // Convertir a forma estándar a*x² + b*x + c
    const a = c2;
    const b = c1 - 2 * c2 * xMean;
    const c = c0 - c1 * xMean + c2 * xMean * xMean;

    const evalFn = (x) => a * x * x + b * x + c;
    const fitted = xsD.map(evalFn);
    const { r2, rmse } = computeMetrics(ysD, fitted);

    const xNext = n + 1;
    const rawDelta = evalFn(xNext);
    // Acotamos suavemente para visualización, pero mantenemos valor real para explicar
    const deltaClamped = Math.max(-2, Math.min(11, rawDelta));
    const digitoPred = mod10(ultimoDigito + rawDelta);

    const formulaStr = `y(x) = ${fmtSignedTerm(a, 'x²', true)}${fmtSignedTerm(b, 'x', false)}${fmtSignedTerm(c, '', false)}`;

    return {
      id: 'f2',
      coef: { a, b, c },
      evalFn,
      fitted,
      xNext,
      valorPredicho: rawDelta,
      valorVisual: deltaClamped,
      saltoImplicito: rawDelta,
      digitoPred,
      r2,
      rmse,
      formulaStr,
      curvatura: a
    };
  }

  /**
   * F3: Polinomio Cúbico Ponderado Exponencialmente (WLS + Ridge) sobre S(x), x = 0..n
   */
  function fitF3CubicaPonderada(xsS, ysS) {
    const n = xsS.length - 1;
    const xMean = n / 2;
    const alpha = 0.32; // Prioriza los sorteos más recientes
    const weights = xsS.map(x => Math.exp(alpha * (x - n)));

    const phi = xsS.map(x => {
      const xc = x - xMean;
      return [1, xc, xc * xc, xc * xc * xc];
    });

    // Regularización Ridge más fuerte en términos de alto orden si hay pocos puntos
    const lambda = n <= 5 ? 0.65 : 0.28;
    const [k0, k1, k2, k3] = fitBasisWLS(phi, ysS, weights, lambda);

    // Expandir k0 + k1(x-m) + k2(x-m)² + k3(x-m)³ a a*x³ + b*x² + c*x + d
    const m = xMean;
    const a = k3;
    const b = k2 - 3 * k3 * m;
    const c = k1 - 2 * k2 * m + 3 * k3 * m * m;
    const d = k0 - k1 * m + k2 * m * m - k3 * m * m * m;

    const evalFn = (x) => ((a * x + b) * x + c) * x + d;
    const fitted = xsS.map(evalFn);
    const { r2, rmse } = computeMetrics(ysS, fitted);

    const xNext = n + 1;
    const sNext = evalFn(xNext);
    const deltaNext = sNext - ysS[n];
    const digitoPred = mod10(sNext);

    const formulaStr = `S(x) = ${fmtSignedTerm(a, 'x³', true)}${fmtSignedTerm(b, 'x²', false)}${fmtSignedTerm(c, 'x', false)}${fmtSignedTerm(d, '', false)}`;

    return {
      id: 'f3',
      coef: { a, b, c, d },
      evalFn,
      fitted,
      xNext,
      valorPredicho: sNext,
      saltoImplicito: deltaNext,
      digitoPred,
      r2,
      rmse,
      formulaStr
    };
  }

  /**
   * F4: Modelo Armónico-Polinómico sobre saltos Δ(x), x = 1..n
   * y(x) = c0 + c1*x + c2*cos(ω*x) + c3*sin(ω*x)
   * Selecciona automáticamente el periodo dominante T que minimiza error regularizado.
   */
  function fitF4ArmonicaSaltos(xsD, ysD, ultimoDigito) {
    const n = xsD.length;
    const lambda = n <= 5 ? 0.45 : 0.22;

    // Candidatos de periodo T
    const maxT = Math.max(6, n);
    let best = null;

    for (let T = 2.2; T <= maxT + 0.01; T += 0.4) {
      const omega = (2 * Math.PI) / T;
      const phi = xsD.map(x => [1, x, Math.cos(omega * x), Math.sin(omega * x)]);
      const coef = fitBasisWLS(phi, ysD, null, lambda);
      const evalFn = (x) => coef[0] + coef[1] * x + coef[2] * Math.cos(omega * x) + coef[3] * Math.sin(omega * x);
      const fitted = xsD.map(evalFn);

      let loss = 0;
      for (let i = 0; i < n; i++) {
        const err = ysD[i] - fitted[i];
        loss += err * err;
      }
      // Penalización suave de complejidad de coeficientes armónicos
      loss += 0.05 * (coef[2] * coef[2] + coef[3] * coef[3]);

      if (!best || loss < best.loss) {
        best = { loss, T, omega, coef, evalFn, fitted };
      }
    }

    const { T, omega, coef, evalFn, fitted } = best;
    const { r2, rmse } = computeMetrics(ysD, fitted);

    const xNext = n + 1;
    const rawDelta = evalFn(xNext);
    const deltaClamped = Math.max(-2, Math.min(11, rawDelta));
    const digitoPred = mod10(ultimoDigito + rawDelta);

    const formulaStr =
      `y(x) = ${fmtSignedTerm(coef[0], '', true)}${fmtSignedTerm(coef[1], 'x', false)}` +
      `${fmtSignedTerm(coef[2], `cos(${fmtNum(omega, 2)}x)`, false)}` +
      `${fmtSignedTerm(coef[3], `sin(${fmtNum(omega, 2)}x)`, false)}`;

    return {
      id: 'f4',
      coef: { c0: coef[0], c1: coef[1], c2: coef[2], c3: coef[3], omega, periodo: T },
      evalFn,
      fitted,
      xNext,
      valorPredicho: rawDelta,
      valorVisual: deltaClamped,
      saltoImplicito: rawDelta,
      digitoPred,
      r2,
      rmse,
      formulaStr,
      periodo: T
    };
  }

  // ============================================================================
  // ANÁLISIS COMPLETO DE UNA POSICIÓN Y DE UN SORTEO
  // ============================================================================

  /**
   * Analiza los 4 dígitos tomando una ventana de W sorteos desde targetIdx hacia atrás.
   */
  function evaluarVentana(sorteos, targetIdx, windowSize) {
    const sliceDesc = sorteos.slice(targetIdx, targetIdx + windowSize);
    if (sliceDesc.length < 3) return null;

    // Invertir a orden cronológico: índice 0 = más antiguo, índice W-1 = más actual
    const crono = sliceDesc.slice().reverse();
    const W = crono.length;
    const nSaltos = W - 1;

    const posiciones = [];

    for (let pos = 0; pos < 4; pos++) {
      const digitos = crono.map(s => parseInt(s.n[pos], 10));
      const saltos = [];
      const xsD = [];
      const acumulada = [digitos[0]];
      const xsS = [0];

      for (let i = 1; i < W; i++) {
        const delta = (digitos[i] - digitos[i - 1] + 10) % 10;
        saltos.push(delta);
        xsD.push(i); // x = 1, 2, ..., nSaltos
        acumulada.push(acumulada[i - 1] + delta);
        xsS.push(i); // x = 0, 1, ..., nSaltos
      }

      const ultimoDigito = digitos[W - 1];
      const f1 = fitF1LinealAcumulada(xsS, acumulada);
      const f2 = fitF2CuadraticaSaltos(xsD, saltos, ultimoDigito);
      const f3 = fitF3CubicaPonderada(xsS, acumulada);
      const f4 = fitF4ArmonicaSaltos(xsD, saltos, ultimoDigito);

      const formulas = [f1, f2, f3, f4];

      // Consenso: dígito más votado entre las 4 fórmulas (desempate por R²)
      const votos = {};
      formulas.forEach(f => {
        if (!votos[f.digitoPred]) votos[f.digitoPred] = { count: 0, r2Sum: 0, digit: f.digitoPred };
        votos[f.digitoPred].count++;
        votos[f.digitoPred].r2Sum += f.r2;
      });
      const rankingVotos = Object.values(votos).sort((a, b) => b.count - a.count || b.r2Sum - a.r2Sum);
      const consenso = rankingVotos[0];

      // Promedio de saltos en esta ventana
      const promedioSaltos = saltos.reduce((a, b) => a + b, 0) / nSaltos;

      posiciones.push({
        pos,
        label: `Dígito ${pos + 1}`,
        digitos,
        saltos,
        xsD,
        acumulada,
        xsS,
        ultimoDigito,
        promedioSaltos,
        formulas,
        consenso
      });
    }

    // Construir las 4 predicciones de 4 cifras (una por fórmula)
    const predicciones = FORMULA_META.map((meta, fIdx) => {
      const digitosPred = posiciones.map(p => p.formulas[fIdx].digitoPred);
      const saltosPred = posiciones.map(p => mod10(p.formulas[fIdx].digitoPred - p.ultimoDigito));
      const r2Avg = posiciones.reduce((acc, p) => acc + p.formulas[fIdx].r2, 0) / 4;
      const rmseAvg = posiciones.reduce((acc, p) => acc + p.formulas[fIdx].rmse, 0) / 4;
      return {
        ...meta,
        numero: digitosPred.join(''),
        digitos: digitosPred,
        saltos: saltosPred,
        r2Avg,
        rmseAvg
      };
    });

    const numeroConsenso = posiciones.map(p => p.consenso.digit).join('');

    return {
      crono,
      windowSize: W,
      nSaltos,
      targetIdx,
      sorteoBase: sorteos[targetIdx],
      sorteoSiguienteReal: targetIdx > 0 ? sorteos[targetIdx - 1] : null,
      posiciones,
      predicciones,
      numeroConsenso
    };
  }

  /**
   * Ejecuta backtesting real sobre los últimos K sorteos previos a targetIdx
   * (sin fuga de datos: para predecir sorteos[i-1], solo usa sorteos[i..i+W-1]).
   */
  function ejecutarBacktest(sorteos, targetIdx, windowSize, maxEval = 30) {
    const disponibles = sorteos.length - (targetIdx + 1) - windowSize;
    const totalEval = Math.max(0, Math.min(maxEval, disponibles));

    const stats = FORMULA_META.map(meta => ({
      id: meta.id,
      code: meta.code,
      nombre: meta.nombreCorto,
      color: meta.color,
      exactosPos: [0, 0, 0, 0],
      cercanosPos: [0, 0, 0, 0], // distancia circular <= 1
      maePos: [0, 0, 0, 0],
      exactosTotal: 0,
      cercanosTotal: 0,
      sorteos2Mas: 0,
      sorteos3Mas: 0
    }));

    for (let step = 1; step <= totalEval; step++) {
      const baseIdx = targetIdx + step;
      const realNext = sorteos[baseIdx - 1];
      if (!realNext) continue;

      const evalRes = evaluarVentana(sorteos, baseIdx, windowSize);
      if (!evalRes) continue;

      const realDigits = [0, 1, 2, 3].map(p => parseInt(realNext.n[p], 10));

      evalRes.predicciones.forEach((pred, fIdx) => {
        let hitsEnSorteo = 0;
        for (let p = 0; p < 4; p++) {
          const dist = distCircular(pred.digitos[p], realDigits[p]);
          stats[fIdx].maePos[p] += dist;
          if (dist === 0) {
            stats[fIdx].exactosPos[p]++;
            stats[fIdx].exactosTotal++;
            hitsEnSorteo++;
          }
          if (dist <= 1) {
            stats[fIdx].cercanosPos[p]++;
            stats[fIdx].cercanosTotal++;
          }
        }
        if (hitsEnSorteo >= 2) stats[fIdx].sorteos2Mas++;
        if (hitsEnSorteo >= 3) stats[fIdx].sorteos3Mas++;
      });
    }

    const totalDigitos = totalEval * 4;
    stats.forEach(s => {
      s.pctExacto = totalDigitos > 0 ? (s.exactosTotal / totalDigitos) * 100 : 0;
      s.pctCercano = totalDigitos > 0 ? (s.cercanosTotal / totalDigitos) * 100 : 0;
      s.maeGlobal = totalDigitos > 0 ? (s.maePos.reduce((a, b) => a + b, 0) / totalDigitos) : 0;
      s.pctPos = s.exactosPos.map(v => (totalEval > 0 ? (v / totalEval) * 100 : 0));
      s.pctCercanoPos = s.cercanosPos.map(v => (totalEval > 0 ? (v / totalEval) * 100 : 0));
    });

    // Identificar mejor fórmula en backtesting
    const mejor = stats.slice().sort((a, b) => b.pctExacto - a.pctExacto || b.pctCercano - a.pctCercano)[0];

    return {
      totalEval,
      stats,
      mejorId: mejor ? mejor.id : 'f1'
    };
  }

  /**
   * Punto de entrada principal del Predictor Polinómico.
   */
  function computePredictorPolinomico(sorteos, targetIdx = 0, windowSize = 5) {
    if (!sorteos || sorteos.length < 4) return null;
    const safeTarget = Math.min(Math.max(0, targetIdx), Math.max(0, sorteos.length - 4));
    const safeWin = Math.min(Math.max(4, windowSize), sorteos.length - safeTarget);

    const analisis = evaluarVentana(sorteos, safeTarget, safeWin);
    if (!analisis) return null;

    const backtest = ejecutarBacktest(sorteos, safeTarget, safeWin, 30);

    // Enriquecer cada predicción con su rendimiento en backtest
    analisis.predicciones.forEach((pred, idx) => {
      pred.backtest = backtest.stats[idx];
      pred.esMejorBacktest = (pred.id === backtest.mejorId && backtest.totalEval > 0);
    });

    return {
      ...analisis,
      backtest,
      formulaMeta: FORMULA_META
    };
  }

  // ============================================================================
  // GENERADORES DE GRÁFICOS SVG (SIN DEPENDENCIAS, ADAPTABLES A TEMA CLARO/OSCURO)
  // ============================================================================

  function getThemePalette() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight
      ? {
          bg: '#f8fafc',
          grid: '#e2e8f0',
          axis: '#94a3b8',
          text: '#334155',
          textMuted: '#64748b',
          realLine: '#0f172a',
          realFill: '#ffffff',
          predZone: 'rgba(99, 102, 241, 0.08)',
          predBorder: 'rgba(99, 102, 241, 0.35)'
        }
      : {
          bg: 'rgba(9, 13, 22, 0.6)',
          grid: 'rgba(148, 163, 184, 0.12)',
          axis: 'rgba(148, 163, 184, 0.35)',
          text: '#e2e8f0',
          textMuted: '#94a3b8',
          realLine: '#f8fafc',
          realFill: '#0f172a',
          predZone: 'rgba(99, 102, 241, 0.12)',
          predBorder: 'rgba(99, 102, 241, 0.4)'
        };
  }

  /**
   * Gráfico 1: Serie de Saltos Modulares Δ(x) + F2 (Cuadrática) + F4 (Armónica)
   */
  function renderChartSaltosSVG(posData) {
    const pal = getThemePalette();
    const W = 480;
    const H = 220;
    const padL = 38;
    const padR = 26;
    const padT = 22;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const n = posData.xsD.length; // 1..n, predicción en n+1
    const xMin = 0.7;
    const xMax = n + 1.35;
    const yMin = -0.5;
    const yMax = 9.8;

    const toX = (x) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
    const toY = (y) => padT + plotH - ((Math.max(yMin, Math.min(yMax, y)) - yMin) / (yMax - yMin)) * plotH;

    const f2 = posData.formulas[1];
    const f4 = posData.formulas[3];

    // Muestreo suave de curvas F2 y F4 desde x=1 hasta x=n+1
    const buildCurvePath = (fn) => {
      const steps = 48;
      let d = '';
      for (let i = 0; i <= steps; i++) {
        const x = 1 + (i / steps) * n;
        const y = fn(x);
        const px = toX(x);
        const py = toY(y);
        d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1);
      }
      return d;
    };

    const pathF2 = buildCurvePath(f2.evalFn);
    const pathF4 = buildCurvePath(f4.evalFn);

    // Línea real de saltos
    const realPath = posData.xsD
      .map((x, i) => `${i === 0 ? 'M' : 'L'}${toX(x).toFixed(1)},${toY(posData.saltos[i]).toFixed(1)}`)
      .join(' ');

    // Zona sombreada de predicción x = n+1
    const predZoneX = toX(n + 0.55);
    const predZoneW = toX(n + 1.35) - predZoneX;

    // Grilla horizontal (0, 3, 6, 9)
    const yTicks = [0, 3, 6, 9];
    const gridH = yTicks
      .map(val => {
        const y = toY(val);
        return `
          <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${pal.grid}" stroke-width="1"/>
          <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${pal.textMuted}" font-size="10" font-family="var(--font-mono)">+${val}</text>
        `;
      })
      .join('');

    // Etiquetas eje X
    const xLabels = posData.xsD
      .map(x => {
        const px = toX(x);
        return `<text x="${px.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="${pal.textMuted}" font-size="10" font-family="var(--font-mono)">x=${x}</text>`;
      })
      .join('');

    const pxNext = toX(n + 1);

    // Puntos reales con tooltips SVG (<title>)
    const realDots = posData.xsD
      .map((x, i) => {
        const px = toX(x);
        const py = toY(posData.saltos[i]);
        const dPrev = posData.digitos[i];
        const dCurr = posData.digitos[i + 1];
        const dy = posData.saltos[i];
        return `
          <g class="poly-point">
            <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" fill="${pal.realFill}" stroke="${pal.realLine}" stroke-width="2.2">
              <title>x=${x}: ${dPrev} → ${dCurr} (Salto +${dy})</title>
            </circle>
            <text x="${px.toFixed(1)}" y="${(py - 9).toFixed(1)}" text-anchor="middle" fill="${pal.text}" font-size="10" font-weight="700" font-family="var(--font-mono)">+${dy}</text>
          </g>
        `;
      })
      .join('');

    // Puntos proyectados F2 y F4 en x = n+1
    const pyF2 = toY(f2.valorPredicho);
    const pyF4 = toY(f4.valorPredicho);
    const offsetF2 = Math.abs(pyF2 - pyF4) < 14 ? -11 : -9;
    const offsetF4 = Math.abs(pyF2 - pyF4) < 14 ? 15 : -9;

    return `
      <svg viewBox="0 0 ${W} ${H}" class="poly-svg-chart" role="img" aria-label="Gráfico de saltos modulares para ${posData.label}">
        <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="${pal.bg}" />
        <!-- Zona de predicción -->
        <rect x="${predZoneX.toFixed(1)}" y="${padT}" width="${predZoneW.toFixed(1)}" height="${plotH}" fill="${pal.predZone}" rx="4" />
        <line x1="${predZoneX.toFixed(1)}" y1="${padT}" x2="${predZoneX.toFixed(1)}" y2="${padT + plotH}" stroke="${pal.predBorder}" stroke-dasharray="4,3" stroke-width="1.2" />

        ${gridH}
        <!-- Eje X -->
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${pal.axis}" stroke-width="1" />
        ${xLabels}
        <text x="${pxNext.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="#818cf8" font-size="10" font-weight="800" font-family="var(--font-mono)">PRÓX</text>

        <!-- Curvas de ajuste F2 y F4 -->
        <path d="${pathF2}" fill="none" stroke="${FORMULA_META[1].color}" stroke-width="2" stroke-dasharray="5,3" opacity="0.92" />
        <path d="${pathF4}" fill="none" stroke="${FORMULA_META[3].color}" stroke-width="2" stroke-dasharray="3,2" opacity="0.92" />

        <!-- Línea real -->
        <path d="${realPath}" fill="none" stroke="${pal.realLine}" stroke-width="2.2" />
        ${realDots}

        <!-- Predicción F2 -->
        <circle cx="${pxNext.toFixed(1)}" cy="${pyF2.toFixed(1)}" r="5.5" fill="${FORMULA_META[1].color}" stroke="#fff" stroke-width="1.5">
          <title>F2 Cuadrática: Δ=${fmtNum(f2.valorPredicho, 2)} → Dígito ${f2.digitoPred}</title>
        </circle>
        <text x="${pxNext.toFixed(1)}" y="${(pyF2 + offsetF2).toFixed(1)}" text-anchor="middle" fill="${FORMULA_META[1].color}" font-size="10.5" font-weight="800" font-family="var(--font-mono)">F2:${f2.digitoPred}</text>

        <!-- Predicción F4 -->
        <circle cx="${pxNext.toFixed(1)}" cy="${pyF4.toFixed(1)}" r="5.5" fill="${FORMULA_META[3].color}" stroke="#fff" stroke-width="1.5">
          <title>F4 Armónica: Δ=${fmtNum(f4.valorPredicho, 2)} → Dígito ${f4.digitoPred}</title>
        </circle>
        <text x="${pxNext.toFixed(1)}" y="${(pyF4 + offsetF4).toFixed(1)}" text-anchor="middle" fill="${FORMULA_META[3].color}" font-size="10.5" font-weight="800" font-family="var(--font-mono)">F4:${f4.digitoPred}</text>

        <!-- Título superior interno -->
        <text x="${padL}" y="14" fill="${pal.textMuted}" font-size="10" font-weight="600">Saltos Modulares Δ(x) &bull; F2 Cuadrática vs F4 Armónica</text>
      </svg>
    `;
  }

  /**
   * Gráfico 2: Trayectoria Acumulada en Aumento S(x) + F1 (Lineal OLS) + F3 (Cúbica WLS)
   */
  function renderChartAcumuladoSVG(posData) {
    const pal = getThemePalette();
    const W = 480;
    const H = 220;
    const padL = 42;
    const padR = 28;
    const padT = 22;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const n = posData.xsS.length - 1; // 0..n, predicción en n+1
    const f1 = posData.formulas[0];
    const f3 = posData.formulas[2];

    const allY = posData.acumulada.concat([f1.valorPredicho, f3.valorPredicho]);
    const rawMin = Math.min(...allY);
    const rawMax = Math.max(...allY);
    const span = Math.max(6, rawMax - rawMin);
    const yMin = Math.floor(rawMin - span * 0.12);
    const yMax = Math.ceil(rawMax + span * 0.16);

    const xMin = -0.35;
    const xMax = n + 1.4;

    const toX = (x) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
    const toY = (y) => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    // Curvas F1 y F3 desde x=0 hasta x=n+1
    const buildCurvePath = (fn) => {
      const steps = 48;
      let d = '';
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * (n + 1);
        const y = fn(x);
        const px = toX(x);
        const py = toY(y);
        d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1);
      }
      return d;
    };

    const pathF1 = buildCurvePath(f1.evalFn);
    const pathF3 = buildCurvePath(f3.evalFn);

    const realPath = posData.xsS
      .map((x, i) => `${i === 0 ? 'M' : 'L'}${toX(x).toFixed(1)},${toY(posData.acumulada[i]).toFixed(1)}`)
      .join(' ');

    const predZoneX = toX(n + 0.52);
    const predZoneW = toX(n + 1.4) - predZoneX;

    // 4 marcas horizontales limpias
    const gridH = [0, 1, 2, 3]
      .map(k => {
        const val = yMin + (k / 3) * (yMax - yMin);
        const y = toY(val);
        return `
          <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${pal.grid}" stroke-width="1"/>
          <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${pal.textMuted}" font-size="10" font-family="var(--font-mono)">${Math.round(val)}</text>
        `;
      })
      .join('');

    const xLabels = posData.xsS
      .map(x => {
        const px = toX(x);
        return `<text x="${px.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="${pal.textMuted}" font-size="10" font-family="var(--font-mono)">t=${x}</text>`;
      })
      .join('');

    const pxNext = toX(n + 1);

    const realDots = posData.xsS
      .map((x, i) => {
        const px = toX(x);
        const py = toY(posData.acumulada[i]);
        const sVal = posData.acumulada[i];
        const dig = posData.digitos[i];
        return `
          <g class="poly-point">
            <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" fill="${pal.realFill}" stroke="${pal.realLine}" stroke-width="2.2">
              <title>t=${x}: Acumulado S=${sVal} (Dígito real: ${dig})</title>
            </circle>
            <text x="${px.toFixed(1)}" y="${(py - 9).toFixed(1)}" text-anchor="middle" fill="${pal.text}" font-size="9.5" font-weight="700" font-family="var(--font-mono)">${sVal}</text>
          </g>
        `;
      })
      .join('');

    const pyF1 = toY(f1.valorPredicho);
    const pyF3 = toY(f3.valorPredicho);
    const offsetF1 = Math.abs(pyF1 - pyF3) < 14 ? -11 : -9;
    const offsetF3 = Math.abs(pyF1 - pyF3) < 14 ? 15 : -9;

    return `
      <svg viewBox="0 0 ${W} ${H}" class="poly-svg-chart" role="img" aria-label="Gráfico acumulado en aumento para ${posData.label}">
        <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="${pal.bg}" />
        <rect x="${predZoneX.toFixed(1)}" y="${padT}" width="${predZoneW.toFixed(1)}" height="${plotH}" fill="${pal.predZone}" rx="4" />
        <line x1="${predZoneX.toFixed(1)}" y1="${padT}" x2="${predZoneX.toFixed(1)}" y2="${padT + plotH}" stroke="${pal.predBorder}" stroke-dasharray="4,3" stroke-width="1.2" />

        ${gridH}
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${pal.axis}" stroke-width="1" />
        ${xLabels}
        <text x="${pxNext.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="#818cf8" font-size="10" font-weight="800" font-family="var(--font-mono)">PRÓX</text>

        <!-- Curvas F1 y F3 -->
        <path d="${pathF1}" fill="none" stroke="${FORMULA_META[0].color}" stroke-width="2" stroke-dasharray="6,3" opacity="0.95" />
        <path d="${pathF3}" fill="none" stroke="${FORMULA_META[2].color}" stroke-width="2" opacity="0.95" />

        <!-- Escalera real acumulada -->
        <path d="${realPath}" fill="none" stroke="${pal.realLine}" stroke-width="2.2" />
        ${realDots}

        <!-- Predicción F1 -->
        <circle cx="${pxNext.toFixed(1)}" cy="${pyF1.toFixed(1)}" r="5.5" fill="${FORMULA_META[0].color}" stroke="#fff" stroke-width="1.5">
          <title>F1 Lineal OLS: S=${fmtNum(f1.valorPredicho, 1)} → Dígito ${f1.digitoPred}</title>
        </circle>
        <text x="${pxNext.toFixed(1)}" y="${(pyF1 + offsetF1).toFixed(1)}" text-anchor="middle" fill="${FORMULA_META[0].color}" font-size="10.5" font-weight="800" font-family="var(--font-mono)">F1:${f1.digitoPred}</text>

        <!-- Predicción F3 -->
        <circle cx="${pxNext.toFixed(1)}" cy="${pyF3.toFixed(1)}" r="5.5" fill="${FORMULA_META[2].color}" stroke="#fff" stroke-width="1.5">
          <title>F3 Cúbica WLS: S=${fmtNum(f3.valorPredicho, 1)} → Dígito ${f3.digitoPred}</title>
        </circle>
        <text x="${pxNext.toFixed(1)}" y="${(pyF3 + offsetF3).toFixed(1)}" text-anchor="middle" fill="${FORMULA_META[2].color}" font-size="10.5" font-weight="800" font-family="var(--font-mono)">F3:${f3.digitoPred}</text>

        <text x="${padL}" y="14" fill="${pal.textMuted}" font-size="10" font-weight="600">Curva Acumulada S(t) &bull; F1 Pendiente OLS (m=${fmtNum(f1.pendiente, 2)}) vs F3 Cúbica WLS</text>
      </svg>
    `;
  }

  /**
   * Gráfico 3: Barras comparativas de Backtesting (Acierto Exacto vs Cercano ±1)
   */
  function renderChartBacktestSVG(backtest) {
    const pal = getThemePalette();
    const W = 560;
    const H = 200;
    const padL = 44;
    const padR = 20;
    const padT = 26;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxPct = Math.max(45, ...backtest.stats.map(s => s.pctCercano + 6));
    const toY = (v) => padT + plotH - (v / maxPct) * plotH;

    // Línea de referencia teórica al azar (10% exacto, 30% ±1)
    const yAzar10 = toY(10);
    const yAzar30 = toY(30);

    const groupW = plotW / 4;
    const barW = Math.min(34, groupW * 0.28);

    const bars = backtest.stats
      .map((s, i) => {
        const cx = padL + groupW * i + groupW / 2;
        const x1 = cx - barW - 3;
        const x2 = cx + 3;
        const y1 = toY(s.pctExacto);
        const h1 = padT + plotH - y1;
        const y2 = toY(s.pctCercano);
        const h2 = padT + plotH - y2;

        return `
          <g>
            <rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${barW}" height="${Math.max(2, h1).toFixed(1)}" rx="4" fill="${s.color}">
              <title>${s.code} (${s.nombre}) Exacto: ${s.pctExacto.toFixed(1)}%</title>
            </rect>
            <text x="${(x1 + barW / 2).toFixed(1)}" y="${(y1 - 5).toFixed(1)}" text-anchor="middle" fill="${s.color}" font-size="10" font-weight="800" font-family="var(--font-mono)">${s.pctExacto.toFixed(1)}%</text>

            <rect x="${x2.toFixed(1)}" y="${y2.toFixed(1)}" width="${barW}" height="${Math.max(2, h2).toFixed(1)}" rx="4" fill="${s.color}" opacity="0.38" stroke="${s.color}" stroke-width="1">
              <title>${s.code} (${s.nombre}) Cercano (±1): ${s.pctCercano.toFixed(1)}%</title>
            </rect>
            <text x="${(x2 + barW / 2).toFixed(1)}" y="${(y2 - 5).toFixed(1)}" text-anchor="middle" fill="${pal.textMuted}" font-size="9.5" font-weight="700" font-family="var(--font-mono)">${s.pctCercano.toFixed(1)}%</text>

            <text x="${cx.toFixed(1)}" y="${H - 18}" text-anchor="middle" fill="${pal.text}" font-size="11" font-weight="700">${s.code}</text>
            <text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" fill="${pal.textMuted}" font-size="9">${s.nombre}</text>
          </g>
        `;
      })
      .join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" class="poly-svg-chart" role="img" aria-label="Comparativa de rendimiento en backtesting">
        <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="${pal.bg}" />
        <!-- Referencias teóricas -->
        <line x1="${padL}" y1="${yAzar10.toFixed(1)}" x2="${W - padR}" y2="${yAzar10.toFixed(1)}" stroke="${pal.grid}" stroke-dasharray="4,3" stroke-width="1.2" />
        <text x="${padL - 6}" y="${(yAzar10 + 3).toFixed(1)}" text-anchor="end" fill="${pal.textMuted}" font-size="9" font-family="var(--font-mono)">10%</text>

        <line x1="${padL}" y1="${yAzar30.toFixed(1)}" x2="${W - padR}" y2="${yAzar30.toFixed(1)}" stroke="${pal.grid}" stroke-dasharray="4,3" stroke-width="1.2" />
        <text x="${padL - 6}" y="${(yAzar30 + 3).toFixed(1)}" text-anchor="end" fill="${pal.textMuted}" font-size="9" font-family="var(--font-mono)">30%</text>

        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${pal.axis}" stroke-width="1" />
        ${bars}

        <text x="${padL}" y="15" fill="${pal.textMuted}" font-size="10" font-weight="600">Backtesting (${backtest.totalEval} sorteos): Barra sólida = Exacto (base 10%) &bull; Translúcida = ±1 (base 30%)</text>
      </svg>
    `;
  }

  return {
    FORMULA_META,
    computePredictorPolinomico,
    renderChartSaltosSVG,
    renderChartAcumuladoSVG,
    renderChartBacktestSVG,
    mod10,
    distCircular,
    fmtNum
  };
})();
