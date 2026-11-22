/**
 * ==============================================================================
 * ASTRO QUANT - LABORATORIO CUANTITATIVO, AUDITORÍA FORENSE & CARTERA ÓPTIMA
 * ==============================================================================
 * Consume `/api/quant` (Python/NumPy) cuando hay servidor local activo, y provee
 * un motor fallback en JavaScript puro para funcionamiento 100% autónomo offline.
 * Incluye gráficos SVG nativos adaptables a Modo Claro / Oscuro.
 */

window.AstroQuant = (function () {
  'use strict';

  const SIGNOS = [
    'Aries', 'Tauro', 'Geminis', 'Cancer',
    'Leo', 'Virgo', 'Libra', 'Escorpion',
    'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
  ];

  function getPalette() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight
      ? {
          bg: '#f8fafc',
          grid: '#e2e8f0',
          axis: '#94a3b8',
          text: '#1e293b',
          muted: '#64748b',
          refLine: '#ef4444',
          refLine2: '#f59e0b',
          barBase: '#cbd5e1'
        }
      : {
          bg: 'rgba(9, 13, 22, 0.55)',
          grid: 'rgba(148, 163, 184, 0.12)',
          axis: 'rgba(148, 163, 184, 0.35)',
          text: '#e2e8f0',
          muted: '#94a3b8',
          refLine: '#f43f5e',
          refLine2: '#f59e0b',
          barBase: 'rgba(148, 163, 184, 0.25)'
        };
  }

  function normSignIndex(raw) {
    if (!raw) return 0;
    const s = (raw + '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const fixed = s === 'escorpio' ? 'escorpion' : s;
    const idx = SIGNOS.findIndex(x => x.toLowerCase() === fixed);
    return idx >= 0 ? idx : 0;
  }

  // Aproximación rápida de p-valor chi2 (Wilson-Hilferty) para fallback offline JS
  function approxChi2Pval(chi2, df) {
    if (chi2 <= 0) return 1;
    const k = df;
    const z = (Math.pow(chi2 / k, 1 / 3) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
    return 0.5 * erfc(z / Math.SQRT2);
  }

  function erfc(x) {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(
      -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277))))))))
    );
    return x >= 0 ? r : 2 - r;
  }

  function softmax(arr) {
    const m = Math.max(...arr);
    const exps = arr.map(v => Math.exp(v - m));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map(v => v / sum);
  }

  /**
   * Motor Fallback en JavaScript puro (cuando se abre en modo file:// sin servidor Python)
   */
  function computeFallbackJS(sorteosDesc, loteria, evalWindow = 300) {
    if (!sorteosDesc || sorteosDesc.length < 60) {
      return { ok: false, error: 'Datos insuficientes (mínimo 60 sorteos).' };
    }
    const crono = sorteosDesc.slice().reverse();
    const n = crono.length;
    const evalN = Math.min(Math.max(50, evalWindow), Math.max(50, n - 100));
    const evalStart = n - evalN;

    // 1. Forense por posición
    const ventanas = [
      ['historico', n],
      ['1000', Math.min(1000, n)],
      ['300', Math.min(300, n)],
      ['100', Math.min(100, n)]
    ];

    const posiciones = [];
    for (let p = 0; p < 4; p++) {
      const tests = {};
      ventanas.forEach(([label, w]) => {
        const cnt = new Array(10).fill(0);
        for (let i = n - w; i < n; i++) cnt[crono[i].d[p]]++;
        const exp = w / 10;
        let chi2 = 0;
        let ent = 0;
        let maxC = -1, minC = 1e9, maxD = 0, minD = 0;
        for (let d = 0; d < 10; d++) {
          chi2 += Math.pow(cnt[d] - exp, 2) / exp;
          const pr = cnt[d] / w;
          if (pr > 0) ent -= pr * Math.log2(pr);
          if (cnt[d] > maxC) { maxC = cnt[d]; maxD = d; }
          if (cnt[d] < minC) { minC = cnt[d]; minD = d; }
        }
        tests[label] = {
          n: w,
          chi2: Number(chi2.toFixed(2)),
          pvalue: Number(approxChi2Pval(chi2, 9).toFixed(4)),
          entropia_norm: Number((ent / Math.log2(10)).toFixed(4)),
          log10_bf: Number(((chi2 - 9) * 0.12).toFixed(2)),
          top_digito: maxD,
          top_pct: Number(((maxC / w) * 100).toFixed(2)),
          min_digito: minD,
          min_pct: Number(((minC / w) * 100).toFixed(2))
        };
      });

      // Sparkline chi2 móvil
      const sparkline = [];
      const win = Math.min(200, n);
      const startSpark = Math.max(win, n - 1000);
      let maxChi2 = 0, maxFecha = crono[n - 1].f;
      for (let end = startSpark; end <= n; end += 35) {
        const cnt = new Array(10).fill(0);
        for (let i = end - win; i < end; i++) cnt[crono[i].d[p]]++;
        const exp = win / 10;
        let chi2 = 0;
        for (let d = 0; d < 10; d++) chi2 += Math.pow(cnt[d] - exp, 2) / exp;
        sparkline.push({ fecha: crono[end - 1].f, chi2: Number(chi2.toFixed(2)) });
        if (chi2 > maxChi2) { maxChi2 = chi2; maxFecha = crono[end - 1].f; }
      }

      posiciones.push({
        pos: p,
        label: `Dígito ${p + 1}`,
        tests,
        qvalue_fdr_1000: tests['1000'].pvalue,
        anomalia_significativa: tests['1000'].pvalue < 0.01,
        regimen: {
          detectado: maxChi2 > 21.67,
          score_cusum: Number((maxChi2 / 3).toFixed(2)),
          digito_impulsor: tests['300'].top_digito,
          fecha_cambio: maxFecha,
          chi2_ventana_max: Number(maxChi2.toFixed(2)),
          sparkline
        }
      });
    }

    // Signos
    const signTests = {};
    ventanas.forEach(([label, w]) => {
      const cnt = new Array(12).fill(0);
      for (let i = n - w; i < n; i++) cnt[normSignIndex(crono[i].s)]++;
      const exp = w / 12;
      let chi2 = 0, ent = 0, maxC = -1, maxS = 0;
      for (let s = 0; s < 12; s++) {
        chi2 += Math.pow(cnt[s] - exp, 2) / exp;
        const pr = cnt[s] / w;
        if (pr > 0) ent -= pr * Math.log2(pr);
        if (cnt[s] > maxC) { maxC = cnt[s]; maxS = s; }
      }
      signTests[label] = {
        n: w,
        chi2: Number(chi2.toFixed(2)),
        pvalue: Number(approxChi2Pval(chi2, 11).toFixed(4)),
        entropia_norm: Number((ent / Math.log2(12)).toFixed(4)),
        log10_bf: Number(((chi2 - 11) * 0.12).toFixed(2)),
        top_signo: SIGNOS[maxS],
        top_pct: Number(((maxC / w) * 100).toFixed(2))
      };
    });

    // Lag-1 repeat
    let lag1M = 0;
    for (let i = 1; i < n; i++) {
      for (let p = 0; p < 4; p++) if (crono[i].d[p] === crono[i - 1].d[p]) lag1M++;
    }

    // 2. Arena Walk-Forward JS (Uniforme, Bayesiano, Markov L1, JEV, Meta-Ensamble)
    const gamma = 0.996;
    const bayesPos = Array.from({ length: 4 }, () => new Array(10).fill(0));
    const bayesSign = new Array(12).fill(0);
    const mk1 = Array.from({ length: 4 }, () => Array.from({ length: 10 }, () => new Array(10).fill(0)));
    const histPos = Array.from({ length: 4 }, () => new Array(10).fill(0));
    const lastPos = Array.from({ length: 4 }, () => new Array(10).fill(-1));
    const hedgeW = Array.from({ length: 4 }, () => new Array(4).fill(0));

    const ids = ['m0_uniforme', 'm1_bayesiano', 'm2_ctw', 'm4_jev', 'm5_ensamble'];
    const names = {
      m0_uniforme: 'Baseline Uniforme (Azar)',
      m1_bayesiano: 'Bayesiano Dirichlet (γ)',
      m2_ctw: 'Markov Suavizado (L1)',
      m4_jev: 'Contrarian / Equilibrio JEV',
      m5_ensamble: 'Meta-Ensamble Hedge (Offline)'
    };
    const colors = {
      m0_uniforme: '#94a3b8',
      m1_bayesiano: '#38bdf8',
      m2_ctw: '#a855f7',
      m4_jev: '#f43f5e',
      m5_ensamble: '#f59e0b'
    };

    const stats = {};
    ids.forEach(id => {
      stats[id] = { ll: 0, brier: 0, exact: 0, near: 0, exactPos: [0, 0, 0, 0], h2: 0, h3: 0, h4: 0, hs: 0, payDir: 0, payTod: 0, cost: 0 };
    });

    function getProbs(t) {
      const mProbs = Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => new Array(10).fill(0.1)));
      const sSum = bayesSign.reduce((a, b) => a + b, 0) + 24;
      const pSignB = bayesSign.map(v => (v + 2) / sSum);
      const sProbs = [
        new Array(12).fill(1 / 12),
        pSignB,
        pSignB,
        pSignB,
        pSignB
      ];

      for (let p = 0; p < 4; p++) {
        const bSum = bayesPos[p].reduce((a, b) => a + b, 0) + 35;
        mProbs[1][p] = bayesPos[p].map(v => (v + 3.5) / bSum);

        if (t >= 1) {
          const row = mk1[p][crono[t - 1].d[p]];
          const rSum = row.reduce((a, b) => a + b, 0) + 20;
          mProbs[2][p] = row.map(v => (v + 2) / rSum);
        }

        if (t >= 30) {
          const exp = t / 10;
          const sc = histPos[p].map((h, d) => {
            const def = Math.max(0, (exp - h) / exp);
            const atr = Math.min(3, (lastPos[p][d] >= 0 ? t - lastPos[p][d] : t) / 10);
            return 0.8 * def + 0.12 * atr;
          });
          mProbs[3][p] = softmax(sc);
        }

        const w = softmax(hedgeW[p]);
        const ens = new Array(10).fill(0);
        for (let m = 0; m < 4; m++) {
          for (let d = 0; d < 10; d++) ens[d] += w[m] * mProbs[m][p][d];
        }
        mProbs[4][p] = ens;
      }
      return { mProbs, sProbs };
    }

    for (let t = 0; t < n; t++) {
      const yD = crono[t].d;
      const yS = normSignIndex(crono[t].s);

      if (t >= evalStart) {
        const { mProbs, sProbs } = getProbs(t);
        for (let p = 0; p < 4; p++) {
          for (let m = 0; m < 4; m++) {
            hedgeW[p][m] = 0.995 * hedgeW[p][m] + 0.45 * Math.log(Math.max(1e-6, mProbs[m][p][yD[p]]));
          }
        }
        ids.forEach((id, mIdx) => {
          const st = stats[id];
          const predD = [0, 1, 2, 3].map(p => {
            let bi = 0, bv = -1;
            for (let d = 0; d < 10; d++) if (mProbs[mIdx][p][d] > bv) { bv = mProbs[mIdx][p][d]; bi = d; }
            return bi;
          });
          let predS = 0, bsv = -1;
          for (let s = 0; s < 12; s++) if (sProbs[mIdx][s] > bsv) { bsv = sProbs[mIdx][s]; predS = s; }

          for (let p = 0; p < 4; p++) {
            const pv = mProbs[mIdx][p];
            st.ll += -Math.log(Math.max(1e-6, pv[yD[p]]));
            for (let d = 0; d < 10; d++) st.brier += Math.pow(pv[d] - (d === yD[p] ? 1 : 0), 2);
            const dc = Math.min(Math.abs(predD[p] - yD[p]), 10 - Math.abs(predD[p] - yD[p]));
            if (dc === 0) { st.exact++; st.exactPos[p]++; }
            if (dc <= 1) st.near++;
          }
          const m2 = predD[2] === yD[2] && predD[3] === yD[3];
          const m3 = m2 && predD[1] === yD[1];
          const m4 = m3 && predD[0] === yD[0];
          const ms = predS === yS;
          if (m2) st.h2++;
          if (m3) st.h3++;
          if (m4) st.h4++;
          if (ms) st.hs++;
          st.cost += 1000;
          if (ms) st.payDir += m4 ? 42e6 : m3 ? 1e6 : m2 ? 1e5 : 0;
          st.payTod += m4 ? (42e6 / 12) : m3 ? (1e6 / 12) : m2 ? (1e5 / 12) : 0;
        });
      }

      for (let p = 0; p < 4; p++) {
        for (let d = 0; d < 10; d++) bayesPos[p][d] *= gamma;
        bayesPos[p][yD[p]] += 1;
        histPos[p][yD[p]] += 1;
        lastPos[p][yD[p]] = t;
        if (t >= 1) mk1[p][crono[t - 1].d[p]][yD[p]] += 1;
      }
      for (let s = 0; s < 12; s++) bayesSign[s] *= gamma;
      bayesSign[yS] += 1;
    }

    const next = getProbs(n);
    const totalD = evalN * 4;
    const baseLL = Math.log(10);
    const modelos = ids.map((id, idx) => {
      const st = stats[id];
      const ll = st.ll / totalD;
      const z = (st.exact - totalD * 0.1) / Math.sqrt(totalD * 0.09);
      const pick = [0, 1, 2, 3].map(p => next.mProbs[idx][p].indexOf(Math.max(...next.mProbs[idx][p]))).join('');
      const sPick = SIGNOS[next.sProbs[idx].indexOf(Math.max(...next.sProbs[idx]))];
      return {
        id,
        nombre: names[id],
        color: colors[id],
        log_loss: Number(ll.toFixed(4)),
        delta_ll_vs_azar: Number(((baseLL - ll) * 1000).toFixed(2)),
        brier: Number((st.brier / totalD).toFixed(4)),
        exact_pct: Number(((st.exact / totalD) * 100).toFixed(2)),
        near_pct: Number(((st.near / totalD) * 100).toFixed(2)),
        exact_pos_pct: st.exactPos.map(v => Number(((v / evalN) * 100).toFixed(1))),
        hits_2c: st.h2,
        hits_3c: st.h3,
        hits_4c: st.h4,
        sign_pct: Number(((st.hs / evalN) * 100).toFixed(2)),
        pvalue_vs_azar: Number((0.5 * erfc(z / Math.SQRT2)).toFixed(4)),
        roi_directo_pct: Number((((st.payDir - st.cost) / st.cost) * 100).toFixed(1)),
        roi_todos_pct: Number((((st.payTod - st.cost) / st.cost) * 100).toFixed(1)),
        peso_ensamble_pct: idx === 4 ? 100 : 25,
        next_pick: pick,
        next_signo: sPick
      };
    });

    // 3. Cartera de 8 tickets (diversificada vs max_prob)
    const pPos = next.mProbs[4];
    const pSign = next.sProbs[4];
    const topD = [0, 1, 2, 3].map(p =>
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => pPos[p][b] - pPos[p][a]).slice(0, 4)
    );
    const sOrder = SIGNOS.map((_, i) => i).sort((a, b) => pSign[b] - pSign[a]);

    const cands = [];
    for (const d0 of topD[0])
      for (const d1 of topD[1])
        for (const d2 of topD[2])
          for (const d3 of topD[3]) {
            const p4 = pPos[0][d0] * pPos[1][d1] * pPos[2][d2] * pPos[3][d3];
            const p3 = pPos[1][d1] * pPos[2][d2] * pPos[3][d3];
            const p2 = pPos[2][d2] * pPos[3][d3];
            const num = `${d0}${d1}${d2}${d3}`;
            cands.push({ numero: num, p4, p3, p2, t2: num.slice(2, 4), t3: num.slice(1, 4) });
          }
    cands.sort((a, b) => b.p4 - a.p4);

    function buildPortfolio(sel, modo) {
      const t2Map = {}, t3Map = {};
      let evDirTot = 0, evTodTot = 0;
      const tickets = sel.map((c, idx) => {
        const si = sOrder[modo === 'diversificada' ? idx % 3 : 0];
        const ps = pSign[si];
        const evDir = (c.p4 * ps * 42000 + Math.max(0, c.p3 - c.p4) * ps * 1000 + Math.max(0, c.p2 - c.p3) * ps * 100) * 1000;
        const evTod = (c.p4 * 3500 + Math.max(0, c.p3 - c.p4) * (1000 / 12) + Math.max(0, c.p2 - c.p3) * (100 / 12)) * 1000;
        evDirTot += evDir; evTodTot += evTod;
        t2Map[c.t2] = c.p2; t3Map[c.t3] = c.p3;
        return {
          rank: idx + 1, numero: c.numero, signo: SIGNOS[si],
          prob_4c_rel: Number(((c.p4 / 0.0001) * 100).toFixed(1)),
          prob_3c_pct: Number((c.p3 * 100).toFixed(3)),
          prob_2c_pct: Number((c.p2 * 100).toFixed(2)),
          ev_todos_por_1000: Math.round(evTod),
          ev_directo_por_1000: Math.round(evDir),
          t2: c.t2, t3: c.t3
        };
      });
      const cob2 = Math.min(100, Object.values(t2Map).reduce((a, b) => a + b, 0) * 100);
      const cob3 = Math.min(100, Object.values(t3Map).reduce((a, b) => a + b, 0) * 100);
      const costo = tickets.length * 1000;
      return {
        modo, tickets,
        terminales_2c_unicas: Object.keys(t2Map).length,
        terminales_3c_unicas: Object.keys(t3Map).length,
        cobertura_2c_pct: Number(cob2.toFixed(2)),
        cobertura_3c_pct: Number(cob3.toFixed(3)),
        costo_total_cop: costo,
        ev_todos_total_cop: Math.round(evTodTot),
        ev_todos_pct: Number(((evTodTot / costo) * 100).toFixed(1)),
        ev_directo_total_cop: Math.round(evDirTot),
        ev_directo_pct: Number(((evDirTot / costo) * 100).toFixed(1))
      };
    }

    const selDiv = [];
    const u2 = new Set(), u3 = new Set(), uN = new Set();
    for (let k = 0; k < 8; k++) {
      let best = null, bg = -1;
      for (const c of cands) {
        if (uN.has(c.numero)) continue;
        const g = c.p4 * 42000 + (u3.has(c.t3) ? 0 : c.p3 * 1000) + (u2.has(c.t2) ? 0 : c.p2 * 100);
        if (g > bg) { bg = g; best = c; }
      }
      if (!best) break;
      selDiv.push(best); uN.add(best.numero); u2.add(best.t2); u3.add(best.t3);
    }

    const ens = modelos[4];
    const anom = posiciones.filter(p => p.anomalia_significativa).length;

    return {
      ok: true,
      offline: true,
      loteria,
      total_sorteos: n,
      ultimo_sorteo: crono[n - 1],
      edge: {
        nivel: anom > 0 && ens.delta_ll_vs_azar > 0.5 ? 'amarillo' : 'rojo',
        titulo: anom > 0 ? 'Modo Offline — Señal Local Detectada' : 'Sin Ventaja Estadística Significativa (Modo Offline)',
        descripcion: 'Ejecutado en el navegador (fallback JS). Inicia `python run.py` para activar el motor completo NumPy (CTW + LogReg L2 + CUSUM).',
        anomalias_fdr: anom,
        delta_ll_milinats: ens.delta_ll_vs_azar,
        pvalue_ensamble: ens.pvalue_vs_azar
      },
      forense: {
        posiciones,
        signos: { tests: signTests, qvalue_fdr_1000: signTests['1000'].pvalue, anomalia_significativa: signTests['1000'].pvalue < 0.01 },
        dependencias: { lag1_repeat_pct: Number(((lag1M / ((n - 1) * 4)) * 100).toFixed(2)), d1_d4: { chi2: 0, pvalue: 1 }, d3_d4: { chi2: 0, pvalue: 1 }, d1_d2: { chi2: 0, pvalue: 1 }, cross_sol_luna_pct: null, cross_days: 0 }
      },
      arena: {
        eval_window: evalN,
        total_digitos_evaluados: totalD,
        fecha_inicio_eval: crono[evalStart].f,
        fecha_fin_eval: crono[n - 1].f,
        modelos,
        ensamble_probs_pos: pPos,
        ensamble_probs_signo: SIGNOS.map((s, i) => ({ signo: s, prob: pSign[i] }))
      },
      cartera: {
        diversificada: buildPortfolio(selDiv, 'diversificada'),
        max_prob: buildPortfolio(cands.slice(0, 8), 'max_prob'),
        signos_top: sOrder.slice(0, 6).map(i => ({ signo: SIGNOS[i], prob_pct: Number((pSign[i] * 100).toFixed(2)) }))
      }
    };
  }

  // ============================================================================
  // GRÁFICOS SVG (ADAPTABLES A TEMA CLARO / OSCURO)
  // ============================================================================

  function renderSparklineChi2SVG(sparkline, color = '#38bdf8') {
    if (!sparkline || sparkline.length < 2) return '';
    const pal = getPalette();
    const W = 260, H = 68, padL = 24, padR = 8, padT = 8, padB = 14;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxVal = Math.max(25, ...sparkline.map(d => d.chi2 + 2));
    const toX = (i) => padL + (i / (sparkline.length - 1)) * plotW;
    const toY = (v) => padT + plotH - (Math.min(maxVal, v) / maxVal) * plotH;

    const path = sparkline.map((pt, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(pt.chi2).toFixed(1)}`).join(' ');
    const y95 = toY(16.92);
    const y99 = toY(21.67);

    return `
      <svg viewBox="0 0 ${W} ${H}" class="quant-svg-chart" role="img" aria-label="Evolución Chi-Cuadrado móvil">
        <rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="${pal.bg}" />
        <line x1="${padL}" y1="${y95.toFixed(1)}" x2="${W - padR}" y2="${y95.toFixed(1)}" stroke="${pal.refLine2}" stroke-dasharray="3,2" stroke-width="1" opacity="0.7" />
        <text x="${padL - 3}" y="${(y95 + 3).toFixed(1)}" text-anchor="end" fill="${pal.refLine2}" font-size="8" font-family="var(--font-mono)">95%</text>
        <line x1="${padL}" y1="${y99.toFixed(1)}" x2="${W - padR}" y2="${y99.toFixed(1)}" stroke="${pal.refLine}" stroke-dasharray="3,2" stroke-width="1" opacity="0.75" />
        <text x="${padL - 3}" y="${(y99 + 3).toFixed(1)}" text-anchor="end" fill="${pal.refLine}" font-size="8" font-family="var(--font-mono)">99%</text>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" />
        ${sparkline.map((pt, i) => i === sparkline.length - 1 ? `<circle cx="${toX(i).toFixed(1)}" cy="${toY(pt.chi2).toFixed(1)}" r="3.2" fill="${color}"><title>${pt.fecha}: χ²=${pt.chi2}</title></circle>` : '').join('')}
        <text x="${padL}" y="${H - 3}" fill="${pal.muted}" font-size="8" font-family="var(--font-mono)">${sparkline[0].fecha.slice(0, 7)}</text>
        <text x="${W - padR}" y="${H - 3}" text-anchor="end" fill="${pal.muted}" font-size="8" font-family="var(--font-mono)">${sparkline[sparkline.length - 1].fecha.slice(0, 7)}</text>
      </svg>
    `;
  }

  function renderArenaChartSVG(modelos) {
    if (!modelos || !modelos.length) return '';
    const pal = getPalette();
    const W = 600, H = 220, padL = 44, padR = 18, padT = 26, padB = 46;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxPct = Math.max(16, ...modelos.map(m => m.exact_pct + 2.5));
    const toY = (v) => padT + plotH - (v / maxPct) * plotH;
    const yBase10 = toY(10);
    const groupW = plotW / modelos.length;
    const barW = Math.min(44, groupW * 0.55);

    const bars = modelos.map((m, i) => {
      const cx = padL + groupW * i + groupW / 2;
      const x = cx - barW / 2;
      const y = toY(m.exact_pct);
      const h = Math.max(2, padT + plotH - y);
      const shortName = m.nombre.split(' ')[0];
      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${m.color}" opacity="0.9">
            <title>${m.nombre}: ${m.exact_pct}% exacto | Log-Loss ${m.log_loss} (Δ ${m.delta_ll_vs_azar >= 0 ? '+' : ''}${m.delta_ll_vs_azar} mnat)</title>
          </rect>
          <text x="${cx.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" fill="${m.color}" font-size="10.5" font-weight="800" font-family="var(--font-mono)">${m.exact_pct.toFixed(1)}%</text>
          <text x="${cx.toFixed(1)}" y="${H - 22}" text-anchor="middle" fill="${pal.text}" font-size="9.5" font-weight="700">${shortName}</text>
          <text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="${pal.muted}" font-size="8.5" font-family="var(--font-mono)">${m.delta_ll_vs_azar >= 0 ? '+' : ''}${m.delta_ll_vs_azar}mn</text>
        </g>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" class="quant-svg-chart" role="img" aria-label="Comparativa de precisión walk-forward">
        <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="${pal.bg}" />
        <line x1="${padL}" y1="${yBase10.toFixed(1)}" x2="${W - padR}" y2="${yBase10.toFixed(1)}" stroke="${pal.refLine}" stroke-dasharray="4,3" stroke-width="1.3" />
        <text x="${padL - 6}" y="${(yBase10 + 3).toFixed(1)}" text-anchor="end" fill="${pal.refLine}" font-size="9" font-weight="700" font-family="var(--font-mono)">10%</text>
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${pal.axis}" stroke-width="1" />
        ${bars}
        <text x="${padL}" y="15" fill="${pal.muted}" font-size="10" font-weight="600">Precisión Exacta por Dígito (Walk-Forward Out-of-Sample) &bull; Línea roja = 10% azar | Inferior = ΔLog-Loss (milinats)</text>
      </svg>
    `;
  }

  function renderPosteriorPosSVG(posIdx, probs) {
    const pal = getPalette();
    const W = 280, H = 135, padL = 30, padR = 10, padT = 20, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const pcts = probs.map(v => v * 100);
    const maxP = Math.max(14, ...pcts.map(v => v + 1.5));
    const toY = (v) => padT + plotH - (v / maxP) * plotH;
    const y10 = toY(10);
    const stepW = plotW / 10;
    const barW = stepW * 0.68;
    const bestDigit = pcts.indexOf(Math.max(...pcts));

    const bars = pcts.map((v, d) => {
      const cx = padL + stepW * d + stepW / 2;
      const x = cx - barW / 2;
      const y = toY(v);
      const h = Math.max(2, padT + plotH - y);
      const color = d === bestDigit ? '#10b981' : v > 10.3 ? '#38bdf8' : '#6366f1';
      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" opacity="${d === bestDigit ? '0.95' : '0.72'}">
            <title>Pos ${posIdx + 1} — Dígito ${d}: ${v.toFixed(2)}% (vs 10.00% azar)</title>
          </rect>
          <text x="${cx.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="${d === bestDigit ? '#10b981' : pal.text}" font-size="9.5" font-weight="${d === bestDigit ? '800' : '600'}" font-family="var(--font-mono)">${d}</text>
        </g>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" class="quant-svg-chart" role="img" aria-label="Distribución posterior Posición ${posIdx + 1}">
        <rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="${pal.bg}" />
        <line x1="${padL}" y1="${y10.toFixed(1)}" x2="${W - padR}" y2="${y10.toFixed(1)}" stroke="${pal.refLine2}" stroke-dasharray="3,2" stroke-width="1" />
        <text x="${padL - 4}" y="${(y10 + 3).toFixed(1)}" text-anchor="end" fill="${pal.refLine2}" font-size="8.5" font-family="var(--font-mono)">10%</text>
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${pal.axis}" stroke-width="1" />
        ${bars}
        <text x="${padL}" y="13" fill="${pal.muted}" font-size="9.5" font-weight="700">Posición ${posIdx + 1} (Top: ${bestDigit} = ${pcts[bestDigit].toFixed(2)}%)</text>
      </svg>
    `;
  }

  return {
    computeFallbackJS,
    renderSparklineChi2SVG,
    renderArenaChartSVG,
    renderPosteriorPosSVG
  };
})();
