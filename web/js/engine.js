/**
 * ==============================================================================
 * ASTRO ENGINE - MOTOR DE CÁLCULO ESTADÍSTICO EN JAVASCRIPT
 * Realiza en el navegador todos los cálculos analíticos de Excel y Python
 * Optimizaciones de alta velocidad (ejecución < 50ms sobre 10,000 sorteos)
 * ==============================================================================
 */

window.AstroEngine = (function () {
  'use strict';

  // Auxiliar para formatear cadenas numéricas con ceros a la izquierda
  function pad(num, size) {
    let s = num + '';
    while (s.length < size) s = '0' + s;
    return s;
  }

  // Normaliza nombres de signos zodiacales (tildes, mayúsculas, espacios)
  const SIGNOS_MAP = {
    aries: 'Aries', tauro: 'Tauro', geminis: 'Geminis', cancer: 'Cancer',
    leo: 'Leo', virgo: 'Virgo', libra: 'Libra', escorpion: 'Escorpion',
    escorpio: 'Escorpion', sagitario: 'Sagitario', capricornio: 'Capricornio',
    acuario: 'Acuario', piscis: 'Piscis'
  };

  function normalizarSigno(raw) {
    if (!raw) return '';
    const clean = (raw + '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return SIGNOS_MAP[clean] || ((raw + '').trim());
  }

  // Diferencia de días entre dos fechas 'YYYY-MM-DD'
  function diffDays(fechaRecienteStr, fechaAntiguaStr) {
    if (!fechaAntiguaStr) return 9999;
    const d1 = new Date(fechaRecienteStr);
    const d2 = new Date(fechaAntiguaStr);
    const diffTime = d1 - d2;
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  return {
    /**
     * Calcula métricas para 4 Cifras (0000 a 9999)
     * Reproduce la hoja '4C' de resultados.xlsx
     */
    computeCifras4: function (sorteos, fechaReferencia) {
      const hoy = fechaReferencia || (sorteos[0] ? sorteos[0].f : new Date().toISOString().slice(0, 10));
      const totalSorteos = sorteos.length;
      
      // Inicializar estructura de 10,000 números
      const data = new Array(10000);
      for (let i = 0; i < 10000; i++) {
        data[i] = {
          num: pad(i, 4),
          freq: 0,
          ultimoIndice: -1,
          ultimaFecha: null,
          sorteosAtraso: totalSorteos,
          diasAtraso: 9999,
          freq10: 0,
          freq100: 0,
          freq1000: 0
        };
      }

      // Recorrer sorteos (sorteos viene en orden descendente: 0 es el más reciente)
      for (let idx = 0; idx < totalSorteos; idx++) {
        const s = sorteos[idx];
        const val = parseInt(s.n, 10);
        if (val >= 0 && val < 10000) {
          const item = data[val];
          item.freq++;
          if (item.ultimoIndice === -1) {
            item.ultimoIndice = idx;
            item.ultimaFecha = s.f;
            item.sorteosAtraso = idx;
            item.diasAtraso = diffDays(hoy, s.f);
          }
          if (idx < 10) item.freq10++;
          if (idx < 100) item.freq100++;
          if (idx < 1000) item.freq1000++;
        }
      }

      return data;
    },

    /**
     * Calcula métricas para 3 Cifras (000 a 999)
     * Reproduce la hoja '3C' (3 Primeros y 3 Últimos)
     */
    computeCifras3: function (sorteos, fechaReferencia) {
      const hoy = fechaReferencia || (sorteos[0] ? sorteos[0].f : new Date().toISOString().slice(0, 10));
      const totalSorteos = sorteos.length;

      const data = new Array(1000);
      for (let i = 0; i < 1000; i++) {
        data[i] = {
          num: pad(i, 3),
          // 3 Primeros
          freqIni: 0,
          ultimoIniIdx: -1,
          atrasoIni: totalSorteos,
          diasIni: 9999,
          // 3 Últimos
          freqFin: 0,
          ultimoFinIdx: -1,
          atrasoFin: totalSorteos,
          diasFin: 9999
        };
      }

      for (let idx = 0; idx < totalSorteos; idx++) {
        const s = sorteos[idx];
        const numStr = s.n;
        const pIni = parseInt(numStr.substring(0, 3), 10);
        const pFin = parseInt(numStr.substring(1, 4), 10);

        // 3 Primeros
        if (!isNaN(pIni)) {
          const itemIni = data[pIni];
          itemIni.freqIni++;
          if (itemIni.ultimoIniIdx === -1) {
            itemIni.ultimoIniIdx = idx;
            itemIni.atrasoIni = idx;
            itemIni.diasIni = diffDays(hoy, s.f);
          }
        }

        // 3 Últimos
        if (!isNaN(pFin)) {
          const itemFin = data[pFin];
          itemFin.freqFin++;
          if (itemFin.ultimoFinIdx === -1) {
            itemFin.ultimoFinIdx = idx;
            itemFin.atrasoFin = idx;
            itemFin.diasFin = diffDays(hoy, s.f);
          }
        }
      }

      return data;
    },

    /**
     * Calcula métricas para 2 Cifras (00 a 99)
     * Reproduce la hoja '2C' (2 Primeros, 2 Centro, 2 Últimos)
     */
    computeCifras2: function (sorteos, fechaReferencia) {
      const hoy = fechaReferencia || (sorteos[0] ? sorteos[0].f : new Date().toISOString().slice(0, 10));
      const totalSorteos = sorteos.length;

      const data = new Array(100);
      for (let i = 0; i < 100; i++) {
        data[i] = {
          num: pad(i, 2),
          // 2 Primeros
          freqIni: 0,
          ultimoIniIdx: -1,
          atrasoIni: totalSorteos,
          diasIni: 9999,
          // 2 Centro
          freqMid: 0,
          ultimoMidIdx: -1,
          atrasoMid: totalSorteos,
          diasMid: 9999,
          // 2 Últimos
          freqFin: 0,
          ultimoFinIdx: -1,
          atrasoFin: totalSorteos,
          diasFin: 9999,
          // Total Frecuencia
          totalFreq: 0
        };
      }

      for (let idx = 0; idx < totalSorteos; idx++) {
        const s = sorteos[idx];
        const numStr = s.n;
        const pIni = parseInt(numStr.substring(0, 2), 10);
        const pMid = parseInt(numStr.substring(1, 3), 10);
        const pFin = parseInt(numStr.substring(2, 4), 10);

        if (!isNaN(pIni)) {
          const it = data[pIni];
          it.freqIni++;
          if (it.ultimoIniIdx === -1) {
            it.ultimoIniIdx = idx;
            it.atrasoIni = idx;
            it.diasIni = diffDays(hoy, s.f);
          }
        }

        if (!isNaN(pMid)) {
          const it = data[pMid];
          it.freqMid++;
          if (it.ultimoMidIdx === -1) {
            it.ultimoMidIdx = idx;
            it.atrasoMid = idx;
            it.diasMid = diffDays(hoy, s.f);
          }
        }

        if (!isNaN(pFin)) {
          const it = data[pFin];
          it.freqFin++;
          if (it.ultimoFinIdx === -1) {
            it.ultimoFinIdx = idx;
            it.atrasoFin = idx;
            it.diasFin = diffDays(hoy, s.f);
          }
        }
      }

      for (let i = 0; i < 100; i++) {
        data[i].totalFreq = data[i].freqIni + data[i].freqMid + data[i].freqFin;
      }

      return data;
    },

    /**
     * Calcula métricas para 1 Cifra (0 a 9) en cada una de las 4 posiciones
     * Reproduce la hoja '1C' y calcula los Scores Ponderados
     */
    computeCifras1: function (sorteos, fechaReferencia) {
      const hoy = fechaReferencia || (sorteos[0] ? sorteos[0].f : new Date().toISOString().slice(0, 10));
      const totalSorteos = sorteos.length;

      const data = new Array(10);
      for (let i = 0; i < 10; i++) {
        data[i] = {
          num: i + '',
          pos: [
            { freq: 0, atraso: totalSorteos, dias: 9999, ultimoIdx: -1, score: 0 },
            { freq: 0, atraso: totalSorteos, dias: 9999, ultimoIdx: -1, score: 0 },
            { freq: 0, atraso: totalSorteos, dias: 9999, ultimoIdx: -1, score: 0 },
            { freq: 0, atraso: totalSorteos, dias: 9999, ultimoIdx: -1, score: 0 }
          ],
          totalFreq: 0
        };
      }

      for (let idx = 0; idx < totalSorteos; idx++) {
        const s = sorteos[idx];
        for (let p = 0; p < 4; p++) {
          const dig = s.d[p];
          if (dig >= 0 && dig <= 9) {
            const it = data[dig].pos[p];
            it.freq++;
            data[dig].totalFreq++;
            if (it.ultimoIdx === -1) {
              it.ultimoIdx = idx;
              it.atraso = idx;
              it.dias = diffDays(hoy, s.f);
            }
          }
        }
      }

      // Cálculo de sumatorias para el Score Ponderado del Excel:
      // score = (dias / sumDias) + (freq / sumFreq)
      for (let p = 0; p < 4; p++) {
        let sumDias = 0;
        let sumFreq = 0;
        for (let d = 0; d < 10; d++) {
          sumDias += data[d].pos[p].dias;
          sumFreq += data[d].pos[p].freq;
        }
        for (let d = 0; d < 10; d++) {
          const itemPos = data[d].pos[p];
          const partDias = sumDias > 0 ? (itemPos.dias / sumDias) : 0;
          const partFreq = sumFreq > 0 ? (itemPos.freq / sumFreq) : 0;
          itemPos.score = (partDias + partFreq) * 100; // Porcentaje
        }
      }

      return data;
    },

    /**
     * Calcula las Matrices de Posición y Frecuencia en múltiples ventanas
     * Reproduce la hoja 'Matrices' (10, 100, 1000 días y pares)
     */
    computeMatrices: function (sorteos) {
      const ventanas = [10, 100, 1000, sorteos.length];
      const res = {};

      ventanas.forEach(tam => {
        const limite = Math.min(tam, sorteos.length);
        const mat = [];
        for (let d = 0; d < 10; d++) {
          mat.push({
            digito: d,
            pos1: 0,
            pos2: 0,
            pos3: 0,
            pos4: 0,
            pct1: 0,
            pct2: 0,
            pct3: 0,
            pct4: 0
          });
        }

        for (let i = 0; i < limite; i++) {
          const s = sorteos[i];
          mat[s.d[0]].pos1++;
          mat[s.d[1]].pos2++;
          mat[s.d[2]].pos3++;
          mat[s.d[3]].pos4++;
        }

        if (limite > 0) {
          for (let d = 0; d < 10; d++) {
            mat[d].pct1 = (mat[d].pos1 / limite) * 100;
            mat[d].pct2 = (mat[d].pos2 / limite) * 100;
            mat[d].pct3 = (mat[d].pos3 / limite) * 100;
            mat[d].pct4 = (mat[d].pos4 / limite) * 100;
          }
        }

        // Matriz de pares (últimos 2 dígitos: Pos3 y Pos4)
        const pares = new Array(100).fill(0);
        for (let i = 0; i < limite; i++) {
          const par = parseInt(sorteos[i].n.substring(2, 4), 10);
          if (!isNaN(par)) pares[par]++;
        }

        const paresRanking = [];
        for (let p = 0; p < 100; p++) {
          paresRanking.push({ par: pad(p, 2), count: pares[p], pct: (pares[p] / limite) * 100 });
        }
        paresRanking.sort((a, b) => b.count - a.count);

        res[tam] = {
          tamano: limite,
          matriz: mat,
          paresRanking: paresRanking
        };
      });

      return res;
    },

    /**
     * Recalcula Calc_Diferencias (c), Distancias modulares (0-5) (dist) y
     * Distancia Base 10 (db10) comparando cada sorteo con el inmediatamente
     * anterior en la secuencia (índice i + 1), sin separar por lotería.
     * Útil en modo Combinado para visualizar el salto entre sorteo y sorteo.
     */
    recalcularMetricasEnConjunto: function (sorteos) {
      if (!Array.isArray(sorteos) || sorteos.length === 0) return [];
      const total = sorteos.length;
      const resultado = new Array(total);

      for (let i = 0; i < total; i++) {
        const curr = sorteos[i];
        const ant = (i + 1 < total) ? sorteos[i + 1] : null;
        const d = curr.d || [0, 0, 0, 0];
        const calcs = [0, 0, 0, 0];
        const dists = [0, 0, 0, 0];

        if (ant && ant.d) {
          const antD = ant.d;
          for (let k = 0; k < 4; k++) {
            // 1. Calc_Digito (Diferencias base 10 con ajuste)
            if (d[k] >= antD[k]) {
              calcs[k] = d[k] - antD[k];
            } else {
              calcs[k] = Math.abs((antD[k] - 10) - d[k]);
            }

            // 2. Distancias mínimas modulares (0 a 5, corregido: diff === 5 es 5)
            const diff = Math.abs(d[k] - antD[k]);
            dists[k] = Math.min(diff, 10 - diff);
          }
        }

        resultado[i] = {
          f: curr.f,
          n: curr.n,
          s: curr.s,
          l: curr.l,
          d: curr.d,
          c: calcs,
          dist: dists,
          db10: calcs.join('')
        };
      }

      return resultado;
    },

    /**
     * Calcula Distancias Modulares, Tuplas y Distancias Base 10
     * Reproduce las hojas 'Distancias', 'DistTotales' y 'DistanciasBase10'
     */
    computeDistancias: function (sorteos) {
      const ventanas = [10, 100, 1000, sorteos.length];
      const distPorVentana = {};

      ventanas.forEach(tam => {
        const limite = Math.min(tam, sorteos.length);
        // Distancias van de 0 a 5
        const tabla = [];
        for (let dist = 0; dist <= 5; dist++) {
          tabla.push({
            distancia: dist,
            pos1: 0, pos2: 0, pos3: 0, pos4: 0,
            pct1: 0, pct2: 0, pct3: 0, pct4: 0
          });
        }

        for (let i = 0; i < limite; i++) {
          const d = sorteos[i].dist;
          for (let p = 0; p < 4; p++) {
            const val = d[p];
            if (val >= 0 && val <= 5) {
              tabla[val]['pos' + (p + 1)]++;
            }
          }
        }

        if (limite > 0) {
          for (let dist = 0; dist <= 5; dist++) {
            for (let p = 1; p <= 4; p++) {
              tabla[dist]['pct' + p] = (tabla[dist]['pos' + p] / limite) * 100;
            }
          }
        }

        distPorVentana[tam] = { limite, tabla };
      });

      // Cálculo de "Mayor Probabilidad" proyectada (promedio ponderado de ventanas 10, 100, 1000, total)
      const mayorProb = [];
      for (let dist = 0; dist <= 5; dist++) {
        const item = { distancia: dist, pos1: 0, pos2: 0, pos3: 0, pos4: 0, promedio: 0 };
        let countV = 0;
        [10, 100, 1000, sorteos.length].forEach(tam => {
          const v = distPorVentana[tam];
          if (v && v.limite > 0) {
            item.pos1 += v.tabla[dist].pct1;
            item.pos2 += v.tabla[dist].pct2;
            item.pos3 += v.tabla[dist].pct3;
            item.pos4 += v.tabla[dist].pct4;
            countV++;
          }
        });
        if (countV > 0) {
          item.pos1 /= countV;
          item.pos2 /= countV;
          item.pos3 /= countV;
          item.pos4 /= countV;
          item.promedio = (item.pos1 + item.pos2 + item.pos3 + item.pos4) / 4;
        }
        mayorProb.push(item);
      }

      // Frecuencia de Tuplas de Distancias (DistTotales)
      const tuplasMap = {};
      const limiteTuplas = Math.min(2000, sorteos.length);
      for (let i = 0; i < limiteTuplas; i++) {
        const clave = sorteos[i].dist.join('-');
        tuplasMap[clave] = (tuplasMap[clave] || 0) + 1;
      }
      const tuplasRanking = Object.keys(tuplasMap).map(k => ({
        tupla: k,
        count: tuplasMap[k],
        pct: (tuplasMap[k] / limiteTuplas) * 100
      })).sort((a, b) => b.count - a.count);

      // Frecuencia de Distancias Base 10 (DistanciasBase10)
      const db10Map = {};
      for (let i = 0; i < sorteos.length; i++) {
        const b10 = sorteos[i].db10;
        if (!db10Map[b10]) {
          db10Map[b10] = { clave: b10, freq: 0, ultimoIdx: i, atraso: i };
        }
        db10Map[b10].freq++;
      }
      const db10Ranking = Object.values(db10Map).sort((a, b) => b.freq - a.freq);

      return {
        distPorVentana,
        mayorProb,
        tuplasRanking: tuplasRanking.slice(0, 30),
        db10Ranking: db10Ranking.slice(0, 50),
        db10RankingAll: db10Ranking
      };
    },

    /**
     * Búsqueda de Vecinos y Análisis de Transiciones
     * Reproduce `analisis_astro.py` y la hoja 'anterior_proximo'
     */
    computeVecinos: function (sorteos, numConsulta) {
      if (!numConsulta) return null;
      const numStr = (numConsulta + '').trim();
      const len = numStr.length;
      if (len === 0 || len > 4) return null;

      const totalSorteos = sorteos.length;
      const coincidencias = [];
      const signosCount = {};

      for (let i = 0; i < totalSorteos; i++) {
        const s = sorteos[i];
        let match = false;

        // Comprobación según longitud (4D exacto, 3D terminación, 2D terminación, 1D terminación)
        if (len === 4 && s.n === numStr) match = true;
        else if (len === 3 && s.n.substring(1, 4) === numStr) match = true;
        else if (len === 2 && s.n.substring(2, 4) === numStr) match = true;
        else if (len === 1 && s.n.substring(3, 4) === numStr) match = true;

        if (match) {
          // Sorteo ANTERIOR (salió antes cronológicamente -> índice i + 1 en arreglo descendente)
          const ant = (i + 1 < totalSorteos) ? sorteos[i + 1] : null;
          // Sorteo POSTERIOR (salió después cronológicamente -> índice i - 1 en arreglo descendente)
          const post = (i - 1 >= 0) ? sorteos[i - 1] : null;

          coincidencias.push({
            indice: i,
            fecha: s.f,
            numero: s.n,
            signo: s.s,
            loteria: s.l,
            db10: s.db10 || '-',
            anterior: ant ? { fecha: ant.f, numero: ant.n, signo: ant.s, db10: ant.db10 || '-' } : null,
            posterior: post ? { fecha: post.f, numero: post.n, signo: post.s, db10: post.db10 || '-' } : null,
            intervaloConSiguiente: 0 // Se calcula abajo
          });

          const signoNorm = normalizarSigno(s.s);
          signosCount[signoNorm] = (signosCount[signoNorm] || 0) + 1;
        }
      }

      // Calcular intervalos entre apariciones
      let sumaIntervalos = 0;
      for (let j = 0; j < coincidencias.length - 1; j++) {
        const intervalo = coincidencias[j + 1].indice - coincidencias[j].indice;
        coincidencias[j].intervaloConSiguiente = intervalo;
        sumaIntervalos += intervalo;
      }

      const totalReps = coincidencias.length;
      const promedioIntervalo = totalReps > 1 ? (sumaIntervalos / (totalReps - 1)) : 0;
      const sorteosDesdeUltimo = coincidencias[0] ? coincidencias[0].indice : totalSorteos;

      // Ranking de signos
      const signosRanking = Object.keys(signosCount).map(k => ({
        signo: k,
        count: signosCount[k],
        pct: (signosCount[k] / (totalReps || 1)) * 100
      })).sort((a, b) => b.count - a.count);

      return {
        numero: numStr,
        longitud: len,
        totalReps,
        sorteosDesdeUltimo,
        promedioIntervalo: promedioIntervalo.toFixed(1),
        signosRanking,
        coincidencias
      };
    },

    /**
     * Búsqueda de Vecinos y Transiciones por Distancia Base 10
     * Analiza el comportamiento cuando ocurre un patrón DB10: qué ocurrió antes y qué ocurre después
     */
    computeVecinosBase10: function (sorteos, db10Consulta) {
      if (db10Consulta === undefined || db10Consulta === null) return null;
      let queryStr = (db10Consulta + '').trim().replace(/[^0-9]/g, '');
      const len = queryStr.length;
      if (len === 0 || len > 4) return null;

      const totalSorteos = sorteos.length;
      const coincidencias = [];
      const signosCount = {};
      const db10PosterioresCount = {};
      const numPosterioresCount = {};

      for (let i = 0; i < totalSorteos; i++) {
        const s = sorteos[i];
        if (!s.db10) continue;
        const target = s.db10 + '';
        let match = false;

        // Comprobación de coincidencia según longitud
        if (len === 4 && target === queryStr) match = true;
        else if (len === 3 && (target.substring(1, 4) === queryStr || target.substring(0, 3) === queryStr)) match = true;
        else if (len === 2 && (target.substring(2, 4) === queryStr || target.substring(0, 2) === queryStr)) match = true;
        else if (len === 1 && target.substring(3, 4) === queryStr) match = true;

        if (match) {
          const ant = (i + 1 < totalSorteos) ? sorteos[i + 1] : null;
          const post = (i - 1 >= 0) ? sorteos[i - 1] : null;

          coincidencias.push({
            indice: i,
            fecha: s.f,
            numero: s.n,
            signo: s.s,
            loteria: s.l,
            db10: target,
            anterior: ant ? { fecha: ant.f, numero: ant.n, signo: ant.s, db10: ant.db10 || '-' } : null,
            posterior: post ? { fecha: post.f, numero: post.n, signo: post.s, db10: post.db10 || '-' } : null,
            intervaloConSiguiente: 0
          });

          const signoNorm = normalizarSigno(s.s);
          signosCount[signoNorm] = (signosCount[signoNorm] || 0) + 1;

          if (post) {
            if (post.db10) {
              db10PosterioresCount[post.db10] = (db10PosterioresCount[post.db10] || 0) + 1;
            }
            if (post.n) {
              // Guardar terminación 2D posterior para estadísticas rápidas
              const t2 = post.n.slice(-2);
              numPosterioresCount[t2] = (numPosterioresCount[t2] || 0) + 1;
            }
          }
        }
      }

      // Intervalos entre apariciones
      let sumaIntervalos = 0;
      for (let j = 0; j < coincidencias.length - 1; j++) {
        const intervalo = coincidencias[j + 1].indice - coincidencias[j].indice;
        coincidencias[j].intervaloConSiguiente = intervalo;
        sumaIntervalos += intervalo;
      }

      const totalReps = coincidencias.length;
      const promedioIntervalo = totalReps > 1 ? (sumaIntervalos / (totalReps - 1)) : 0;
      const sorteosDesdeUltimo = coincidencias[0] ? coincidencias[0].indice : totalSorteos;

      // Ranking de signos
      const signosRanking = Object.keys(signosCount).map(k => ({
        signo: k,
        count: signosCount[k],
        pct: (signosCount[k] / (totalReps || 1)) * 100
      })).sort((a, b) => b.count - a.count);

      // Ranking de DB10 más frecuentes en el sorteo posterior
      const repPostTotal = Math.max(1, coincidencias.length - (coincidencias[0] && coincidencias[0].indice === 0 ? 1 : 0));
      const db10PosterioresRanking = Object.keys(db10PosterioresCount).map(k => ({
        db10: k,
        count: db10PosterioresCount[k],
        pct: (db10PosterioresCount[k] / repPostTotal) * 100
      })).sort((a, b) => b.count - a.count).slice(0, 10);

      // Ranking de terminaciones 2D más frecuentes en sorteo posterior
      const numPosterioresRanking = Object.keys(numPosterioresCount).map(k => ({
        term2D: k,
        count: numPosterioresCount[k],
        pct: (numPosterioresCount[k] / repPostTotal) * 100
      })).sort((a, b) => b.count - a.count).slice(0, 8);

      return {
        db10: queryStr,
        longitud: len,
        totalReps,
        sorteosDesdeUltimo,
        promedioIntervalo: promedioIntervalo.toFixed(1),
        signosRanking,
        db10PosterioresRanking,
        numPosterioresRanking,
        coincidencias
      };
    },

    /**
     * Radiografía / Evaluador de una Lista de Números
     * Reproduce `tabla_analisis_numeros.py`
     */
    computeEvaluadorLista: function (sorteos, listaStr) {
      if (!listaStr) return [];
      const tokens = listaStr.replace(/[\n\r,;]+/g, ' ').split(/\s+/).filter(Boolean);
      const hoy = sorteos[0] ? sorteos[0].f : new Date().toISOString().slice(0, 10);
      const totalSorteos = sorteos.length;

      // Mapas rápidos
      const map4C = {};
      const map3Ini = {}, map3Fin = {};
      const map2Ini = {}, map2Mid = {}, map2Fin = {};

      for (let i = 0; i < totalSorteos; i++) {
        const s = sorteos[i];
        const n = s.n;
        const p3i = n.substring(0, 3);
        const p3f = n.substring(1, 4);
        const p2i = n.substring(0, 2);
        const p2m = n.substring(1, 3);
        const p2f = n.substring(2, 4);

        if (!map4C[n]) map4C[n] = { idx: i, fecha: s.f, freq: 0 };
        map4C[n].freq++;

        if (!map3Ini[p3i]) map3Ini[p3i] = { idx: i, freq: 0 };
        map3Ini[p3i].freq++;

        if (!map3Fin[p3f]) map3Fin[p3f] = { idx: i, freq: 0 };
        map3Fin[p3f].freq++;

        if (!map2Ini[p2i]) map2Ini[p2i] = { idx: i, freq: 0 };
        map2Ini[p2i].freq++;

        if (!map2Mid[p2m]) map2Mid[p2m] = { idx: i, freq: 0 };
        map2Mid[p2m].freq++;

        if (!map2Fin[p2f]) map2Fin[p2f] = { idx: i, freq: 0 };
        map2Fin[p2f].freq++;
      }

      const resultados = [];
      const vistos = new Set();

      tokens.forEach(tok => {
        const numClean = tok.trim().padStart(4, '0');
        if (numClean.length === 4 && !vistos.has(numClean)) {
          vistos.add(numClean);
          const p3i = numClean.substring(0, 3);
          const p3f = numClean.substring(1, 4);
          const p2i = numClean.substring(0, 2);
          const p2m = numClean.substring(1, 3);
          const p2f = numClean.substring(2, 4);

          const c4 = map4C[numClean] || { idx: totalSorteos, fecha: null, freq: 0 };
          const c3i = map3Ini[p3i] || { idx: totalSorteos, freq: 0 };
          const c3f = map3Fin[p3f] || { idx: totalSorteos, freq: 0 };
          const c2i = map2Ini[p2i] || { idx: totalSorteos, freq: 0 };
          const c2m = map2Mid[p2m] || { idx: totalSorteos, freq: 0 };
          const c2f = map2Fin[p2f] || { idx: totalSorteos, freq: 0 };

          // Score ponderado de probabilidad
          // Premia números con terminaciones frecuentes y atrasos cercanos al ciclo estadístico
          const score = Math.round(
            (c2f.freq * 2.5) + (c3f.freq * 5) + (c4.freq * 12) +
            Math.min(50, c2f.idx * 0.2) + Math.min(30, c3f.idx * 0.1)
          );

          resultados.push({
            numero: numClean,
            freq4: c4.freq,
            atraso4: c4.idx,
            dias4: c4.fecha ? diffDays(hoy, c4.fecha) : 9999,
            p3Ini: p3i, atraso3Ini: c3i.idx, freq3Ini: c3i.freq,
            p3Fin: p3f, atraso3Fin: c3f.idx, freq3Fin: c3f.freq,
            p2Ini: p2i, atraso2Ini: c2i.idx,
            p2Mid: p2m, atraso2Mid: c2m.idx,
            p2Fin: p2f, atraso2Fin: c2f.idx, freq2Fin: c2f.freq,
            score
          });
        }
      });

      return resultados.sort((a, b) => b.score - a.score);
    },

    /**
     * Generador de Pronósticos y Proyecciones Estadísticas
     * Combina matrices recientes, saltos modulares de mayor probabilidad
     * y atrasos para generar candidatos altamente fundamentados.
     */
    computePronosticos: function (sorteos) {
      if (!sorteos || sorteos.length < 10) return [];
      const ultimo = sorteos[0];
      const ultDigs = ultimo.d;

      // 1. Obtener matriz de 100 sorteos
      const mat100 = this.computeMatrices(sorteos)[100].matriz;
      // 2. Obtener distancias más probables
      const distInfo = this.computeDistancias(sorteos);
      const topDistancias = distInfo.mayorProb.slice().sort((a, b) => b.promedio - a.promedio);
      const distPredilecta = topDistancias[0] ? topDistancias[0].distancia : 1;
      const distAlterna = topDistancias[1] ? topDistancias[1].distancia : 2;

      // Top 3 dígitos por posición según matriz de calor
      const topDigsPorPos = [[], [], [], []];
      for (let p = 1; p <= 4; p++) {
        const col = 'pos' + p;
        const ordenados = mat100.slice().sort((a, b) => b[col] - a[col]);
        topDigsPorPos[p - 1] = ordenados.slice(0, 3).map(x => x.digito);
      }

      // Proyectar posibles dígitos sumando o restando distancias predilectas
      function saltar(d, dist) {
        return [(d + dist) % 10, (d - dist + 10) % 10];
      }

      const candidatos = [];

      // Calcular compatibilidad de distancias para cada dígito candidato
      // respecto al último sorteo, usando las distancias predilectas
      function factorCompatibilidad(digsCandidato, ultDigs, distPred, distAlt) {
        let compatibles = 0;
        for (let p = 0; p < 4; p++) {
          const distReal = (digsCandidato[p] - ultDigs[p] + 10) % 10;
          const distRealInv = (ultDigs[p] - digsCandidato[p] + 10) % 10;
          const minDist = Math.min(distReal, distRealInv);
          if (minDist === distPred || minDist === distAlt) compatibles++;
        }
        // Factor de 1.0 (0 compatibles) a 1.5 (4 compatibles)
        return 1.0 + (compatibles / 4) * 0.5;
      }

      // Generar todas las combinaciones candidatas y ordenarlas por score descendente
      for (let p1 of topDigsPorPos[0]) {
        for (let p2 of topDigsPorPos[1].slice(0, 2)) {
          for (let p3 of topDigsPorPos[2].slice(0, 2)) {
            for (let p4 of topDigsPorPos[3].slice(0, 2)) {
              const num = `${p1}${p2}${p3}${p4}`;
              const digs = [p1, p2, p3, p4];

              // Score basado en pct de cada dígito en su posición (matriz 100d)
              const promedioPct = (
                mat100[p1].pct1 + mat100[p2].pct2 +
                mat100[p3].pct3 + mat100[p4].pct4
              ) / 4;

              // Factor de compatibilidad con distancias predilectas
              const factor = factorCompatibilidad(digs, ultDigs, distPredilecta, distAlterna);

              // Score final: promedio de pct * factor, limitado entre 0 y 99
              const score = Math.min(99, Math.max(0, Math.round(promedioPct * factor)));

              candidatos.push({
                num,
                score,
                razon: `Dígitos calientes en matriz 100d [${p1}, ${p2}, ${p3}, ${p4}] con saltos compatibles a ${distPredilecta} y ${distAlterna}`
              });
            }
          }
        }
      }

      return candidatos.sort((a, b) => b.score - a.score).slice(0, 12);
    },

    /**
     * Pronósticos JEV - Ley de Equilibrio Vecinal
     * A largo plazo cada par de 2 cifras (últimas 2 posiciones) tiende a salir
     * con la misma frecuencia. Detecta pares con déficit y atraso alto.
     */
    computePronosticosJEV: function (sorteos) {
      if (!sorteos || sorteos.length < 30) return [];
      const totalSorteos = sorteos.length;
      const frecEsperada = totalSorteos / 100;

      // Frecuencia y último atraso de cada par (últimas 2 cifras)
      const pares = new Array(100);
      for (let i = 0; i < 100; i++) {
        pares[i] = { par: pad(i, 2), freq: 0, ultimoIdx: -1, freq100: 0 };
      }

      for (let idx = 0; idx < totalSorteos; idx++) {
        const p2f = parseInt(sorteos[idx].n.substring(2, 4), 10);
        if (p2f >= 0 && p2f < 100) {
          pares[p2f].freq++;
          if (pares[p2f].ultimoIdx === -1) pares[p2f].ultimoIdx = idx;
          if (idx < 100) pares[p2f].freq100++;
        }
      }

      const frecEsperada100 = Math.min(100, totalSorteos) / 100;

      const resultados = pares.map(function (p) {
        const atraso = p.ultimoIdx === -1 ? totalSorteos : p.ultimoIdx;
        const deficit = frecEsperada - p.freq;
        const deficitNorm = deficit / frecEsperada; // -1 a +1 aprox

        // Atraso relativo: cuánto ha tardado vs lo esperado
        const intervaloEsperado = p.freq > 0 ? totalSorteos / p.freq : totalSorteos;
        const atrasoRelativo = atraso / intervaloEsperado;

        // Tendencia reciente: comparar freq en últimos 100 vs lo esperado en 100
        const deficitReciente = frecEsperada100 - p.freq100;
        var tendencia = 'neutro';
        if (p.freq100 > frecEsperada100 * 1.3) tendencia = 'caliente';
        else if (p.freq100 < frecEsperada100 * 0.7) tendencia = 'frío';

        // Score JEV: combina déficit histórico, atraso relativo y tendencia reciente
        const scoreJEV = (
          Math.max(0, deficitNorm) * 40 +          // Déficit histórico (max 40pts)
          Math.min(atrasoRelativo, 3) * 10 +       // Atraso relativo (max 30pts)
          Math.max(0, deficitReciente) * 15         // Déficit reciente (variable)
        );

        // Construir razón textual
        var razon = 'Frecuencia real: ' + p.freq + ' vs esperada: ' + frecEsperada.toFixed(1);
        if (deficit > 0) razon += ' (déficit de ' + deficit.toFixed(1) + ')';
        else razon += ' (superávit de ' + Math.abs(deficit).toFixed(1) + ')';
        razon += '. Atraso: ' + atraso + ' sorteos (' + atrasoRelativo.toFixed(1) + 'x su ciclo).';
        razon += ' Tendencia reciente: ' + tendencia + '.';
        if (tendencia === 'frío' && deficit > 0) razon += ' ⚡ Doble señal de equilibrio pendiente.';

        return {
          par: p.par,
          scoreJEV: Math.round(scoreJEV * 10) / 10,
          deficit: Math.round(deficit * 10) / 10,
          atraso: atraso,
          frecuencia: p.freq,
          esperada: Math.round(frecEsperada * 10) / 10,
          atrasoRelativo: atrasoRelativo.toFixed(1),
          tendencia: tendencia,
          razon: razon
        };
      });

      return resultados.sort(function (a, b) { return b.scoreJEV - a.scoreJEV; }).slice(0, 20);
    },

    /**
     * Pronósticos JEV - Primeras 2 Cifras (Posiciones 1 y 2: 00-99)
     * Aplica la Ley de los Grandes Números al par inicial de cada sorteo.
     */
    computePronosticosJEVPrimeras: function (sorteos) {
      if (!sorteos || sorteos.length < 30) return [];
      const totalSorteos = sorteos.length;
      const frecEsperada = totalSorteos / 100;

      // Frecuencia y último atraso de cada par en primeras 2 cifras
      const pares = new Array(100);
      for (let i = 0; i < 100; i++) {
        pares[i] = { par: pad(i, 2), freq: 0, ultimoIdx: -1, freq100: 0 };
      }

      for (let idx = 0; idx < totalSorteos; idx++) {
        const p2i = parseInt(sorteos[idx].n.substring(0, 2), 10);
        if (p2i >= 0 && p2i < 100) {
          pares[p2i].freq++;
          if (pares[p2i].ultimoIdx === -1) pares[p2i].ultimoIdx = idx;
          if (idx < 100) pares[p2i].freq100++;
        }
      }

      const frecEsperada100 = Math.min(100, totalSorteos) / 100;

      const resultados = pares.map(function (p) {
        const atraso = p.ultimoIdx === -1 ? totalSorteos : p.ultimoIdx;
        const deficit = frecEsperada - p.freq;
        const deficitNorm = deficit / frecEsperada;

        const intervaloEsperado = p.freq > 0 ? totalSorteos / p.freq : totalSorteos;
        const atrasoRelativo = atraso / intervaloEsperado;

        const deficitReciente = frecEsperada100 - p.freq100;
        var tendencia = 'neutro';
        if (p.freq100 > frecEsperada100 * 1.3) tendencia = 'caliente';
        else if (p.freq100 < frecEsperada100 * 0.7) tendencia = 'frío';

        const scoreJEV = (
          Math.max(0, deficitNorm) * 40 +
          Math.min(atrasoRelativo, 3) * 10 +
          Math.max(0, deficitReciente) * 15
        );

        var razon = 'Frecuencia inicial: ' + p.freq + ' vs esperada: ' + frecEsperada.toFixed(1);
        if (deficit > 0) razon += ' (déficit de ' + deficit.toFixed(1) + ')';
        else razon += ' (superávit de ' + Math.abs(deficit).toFixed(1) + ')';
        razon += '. Atraso inicial: ' + atraso + ' sorteos (' + atrasoRelativo.toFixed(1) + 'x su ciclo).';
        razon += ' Tendencia reciente: ' + tendencia + '.';
        if (tendencia === 'frío' && deficit > 0) razon += ' ⚡ Doble señal de reaparición inicial.';

        return {
          par: p.par,
          scoreJEV: Math.round(scoreJEV * 10) / 10,
          deficit: Math.round(deficit * 10) / 10,
          atraso: atraso,
          frecuencia: p.freq,
          esperada: Math.round(frecEsperada * 10) / 10,
          atrasoRelativo: atrasoRelativo.toFixed(1),
          tendencia: tendencia,
          razon: razon
        };
      });

      return resultados.sort(function (a, b) { return b.scoreJEV - a.scoreJEV; }).slice(0, 20);
    },

    /**
     * Pronósticos JEV - Signos Zodiacales (12 Signos)
     * Frecuencia esperada = totalSorteos / 12
     */
    computePronosticosJEVSignos: function (sorteos) {
      if (!sorteos || sorteos.length < 12) return [];
      const totalSorteos = sorteos.length;
      const frecEsperada = totalSorteos / 12;

      const signosConocidos = [
        'Aries', 'Tauro', 'Geminis', 'Cancer',
        'Leo', 'Virgo', 'Libra', 'Escorpion',
        'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
      ];

      // Mapeo inicial
      const mapaSignos = {};
      signosConocidos.forEach(function (s) {
        mapaSignos[s.toLowerCase()] = {
          nombre: s,
          freq: 0,
          ultimoIdx: -1,
          freq100: 0
        };
      });

      // Recorrer sorteos
      for (let idx = 0; idx < totalSorteos; idx++) {
        const rawSigno = (sorteos[idx].s || '').trim();
        // Normalizar acentos
        const normalizado = rawSigno
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        if (mapaSignos[normalizado]) {
          mapaSignos[normalizado].freq++;
          if (mapaSignos[normalizado].ultimoIdx === -1) {
            mapaSignos[normalizado].ultimoIdx = idx;
          }
          if (idx < 100) {
            mapaSignos[normalizado].freq100++;
          }
        }
      }

      const frecEsperada100 = Math.min(100, totalSorteos) / 12;

      const resultados = Object.values(mapaSignos).map(function (item) {
        const atraso = item.ultimoIdx === -1 ? totalSorteos : item.ultimoIdx;
        const deficit = frecEsperada - item.freq;
        const deficitNorm = deficit / frecEsperada;

        const intervaloEsperado = item.freq > 0 ? totalSorteos / item.freq : 12;
        const atrasoRelativo = atraso / intervaloEsperado;

        const deficitReciente = frecEsperada100 - item.freq100;
        var tendencia = 'neutro';
        if (item.freq100 > frecEsperada100 * 1.3) tendencia = 'caliente';
        else if (item.freq100 < frecEsperada100 * 0.7) tendencia = 'frío';

        const scoreJEV = (
          Math.max(0, deficitNorm) * 40 +
          Math.min(atrasoRelativo, 3) * 10 +
          Math.max(0, deficitReciente) * 15
        );

        var razon = 'Frecuencia total: ' + item.freq + ' vs esperada: ' + frecEsperada.toFixed(1);
        if (deficit > 0) razon += ' (déficit de ' + deficit.toFixed(1) + ')';
        else razon += ' (superávit de ' + Math.abs(deficit).toFixed(1) + ')';
        razon += '. Atraso: ' + atraso + ' sorteos (' + atrasoRelativo.toFixed(1) + 'x intervalo esperado).';
        razon += ' En los últimos 100 sorteos ha salido ' + item.freq100 + ' veces (' + tendencia + ').';

        return {
          signo: item.nombre,
          scoreJEV: Math.round(scoreJEV * 10) / 10,
          deficit: Math.round(deficit * 10) / 10,
          atraso: atraso,
          frecuencia: item.freq,
          esperada: Math.round(frecEsperada * 10) / 10,
          atrasoRelativo: atrasoRelativo.toFixed(1),
          tendencia: tendencia,
          razon: razon
        };
      });

      return resultados.sort(function (a, b) { return b.scoreJEV - a.scoreJEV; });
    },

    /**
     * Combina los Top 5 de Primeras 2 Cifras + Top 5 Últimas 2 Cifras + Signos Top
     * Genera combinaciones recomendadas de 4 cifras y signo
     */
    computeCombinacionesTop5: function (sorteos, topPrimeras, topUltimas, topSignos) {
      if (!topPrimeras || !topUltimas || !topPrimeras.length || !topUltimas.length) return [];
      
      const pIniList = topPrimeras.slice(0, 5);
      const pFinList = topUltimas.slice(0, 5);
      const signosTop = (topSignos && topSignos.length) ? topSignos.slice(0, 5) : [{ signo: 'Aries', scoreJEV: 20 }];

      // Histórico de números de 4 cifras para comprobar si han salido
      const mapHist4C = {};
      if (sorteos && sorteos.length) {
        for (let i = 0; i < sorteos.length; i++) {
          const s = sorteos[i];
          if (!mapHist4C[s.n]) {
            mapHist4C[s.n] = { freq: 0, ultimoIdx: i, ultimaFecha: s.f };
          }
          mapHist4C[s.n].freq++;
        }
      }

      const combinaciones = [];
      let rank = 1;

      for (let i = 0; i < pIniList.length; i++) {
        for (let j = 0; j < pFinList.length; j++) {
          const ini = pIniList[i];
          const fin = pFinList[j];
          const num4 = ini.par + fin.par;

          // Asignar signo predilecto según rotación o compatibilidad
          const idxSigno = (i + j) % signosTop.length;
          const signoElegido = signosTop[idxSigno];

          // Score ponderado conjunto
          const scoreBasePares = (ini.scoreJEV * 0.5) + (fin.scoreJEV * 0.5);
          const scoreGlobal = Math.round(((scoreBasePares * 0.75) + (signoElegido.scoreJEV * 0.25)) * 10) / 10;

          const hist = mapHist4C[num4] || { freq: 0, ultimoIdx: -1, ultimaFecha: null };

          combinaciones.push({
            rank: rank++,
            numero: num4,
            parIni: ini.par,
            parFin: fin.par,
            scoreIni: ini.scoreJEV,
            scoreFin: fin.scoreJEV,
            atrasoIni: ini.atraso,
            atrasoFin: fin.atraso,
            signo: signoElegido.signo,
            scoreSigno: signoElegido.scoreJEV,
            atrasoSigno: signoElegido.atraso,
            scoreGlobal: scoreGlobal,
            historia4C: hist.freq === 0 ? 'Sin salidas previas (Inédito)' : `Ha salido ${hist.freq}x (hace ${hist.ultimoIdx} sort.)`,
            esInedito: hist.freq === 0,
            razon: `Par inicial ${ini.par} (Score JEV ${ini.scoreIni || ini.scoreJEV}, atraso ${ini.atraso}) + Par final ${fin.par} (Score JEV ${fin.scoreFin || fin.scoreJEV}, atraso ${fin.atraso}) con Signo ${signoElegido.signo} (Score JEV ${signoElegido.scoreJEV})`
          });
        }
      }

      // Ordenar por scoreGlobal descendente
      return combinaciones.sort(function (a, b) { return b.scoreGlobal - a.scoreGlobal; });
    },

    /**
     * ==============================================================================
     * PREDICTOR SECUENCIAL (N-GRAMAS / CADENAS DE PATRONES HISTÓRICOS)
     * ==============================================================================
     * Rastrea secuencias históricas hacia atrás (desde longitud 2 hasta la más larga)
     * para cada posición (D1, D2, D3, D4), 2 cifras y 3 cifras.
     * Consolida todas las profundidades en porcentajes ponderados para predecir
     * el próximo número con base en lo que históricamente ocurrió tras esa secuencia.
     */
    computePredictorSecuencial: function (sorteos, targetIdx, maxDepth) {
      if (!sorteos || sorteos.length < 5) return null;
      targetIdx = (typeof targetIdx === 'number' && targetIdx >= 0) ? Math.min(targetIdx, sorteos.length - 4) : 0;
      maxDepth = maxDepth || 7;

      const totalSorteos = sorteos.length;
      const sorteoBase = sorteos[targetIdx];
      const esBacktest = targetIdx > 0;
      const sorteoReal = esBacktest ? sorteos[targetIdx - 1] : null;

      // Cadena de sorteos previos para visualización (hasta 6 sorteos)
      const sorteosVisual = [];
      const cantVisual = Math.min(6, totalSorteos - targetIdx);
      for (let k = cantVisual - 1; k >= 0; k--) {
        const s = sorteos[targetIdx + k];
        sorteosVisual.push({
          idx: targetIdx + k,
          fecha: s.f,
          numero: s.n,
          signo: s.s,
          loteria: s.l,
          esActual: (k === 0)
        });
      }

      // Función auxiliar para extraer dígitos seguros [d0, d1, d2, d3]
      function getDigits(s) {
        if (s.d && Array.isArray(s.d) && s.d.length === 4) return s.d;
        const str = pad(s.n || 0, 4);
        return [parseInt(str[0], 10), parseInt(str[1], 10), parseInt(str[2], 10), parseInt(str[3], 10)];
      }

      // ========================================================================
      // 1. ANÁLISIS DE LAS 4 POSICIONES (DÍGITO A DÍGITO)
      // ========================================================================
      const nombresPos = [
        { id: 0, label: 'Posición 1 (Miles)', short: 'D1' },
        { id: 1, label: 'Posición 2 (Centenas)', short: 'D2' },
        { id: 2, label: 'Posición 3 (Decenas)', short: 'D3' },
        { id: 3, label: 'Posición 4 (Unidades)', short: 'D4' }
      ];

      const analisisPosiciones = [];

      for (let pos = 0; pos < 4; pos++) {
        // Extraer los valores recientes de esta posición
        const seqValores = [];
        const limiteSeq = Math.min(maxDepth, totalSorteos - targetIdx);
        for (let k = 0; k < limiteSeq; k++) {
          const d = getDigits(sorteos[targetIdx + k]);
          seqValores.push(d[pos]);
        }

        // Buscar coincidencias históricas para longitudes L = 2 hasta maxDepth
        // Estructura: matchesPorLongitud[L] = [ { histIdx, fecha, num, nextDigit, numSig, fechaSig } ]
        const matchesPorLongitud = {};
        let Lmax = 0;

        for (let L = 2; L <= seqValores.length; L++) {
          const patronBuscado = seqValores.slice(0, L); // [v0, v1, ..., v(L-1)]
          const matchesL = [];

          // Recorrer el histórico estrictamente antes del target (i > targetIdx y debe existir i-1)
          for (let i = targetIdx + 1; i <= totalSorteos - L; i++) {
            let coincide = true;
            for (let k = 0; k < L; k++) {
              const digHist = getDigits(sorteos[i + k])[pos];
              if (digHist !== patronBuscado[k]) {
                coincide = false;
                break;
              }
            }

            if (coincide && (i - 1) >= 0) {
              const sorteoSig = sorteos[i - 1];
              const digSig = getDigits(sorteoSig)[pos];
              matchesL.push({
                histIdx: i,
                fecha: sorteos[i].f,
                num: sorteos[i].n,
                fechaSig: sorteoSig.f,
                numSig: sorteoSig.n,
                nextDigit: digSig,
                longitud: L
              });
            }
          }

          matchesPorLongitud[L] = matchesL;
          if (matchesL.length > 0) {
            Lmax = L;
          }
        }

        // Si no hubo ninguna de L>=2, buscamos coincidencia simple L=1 para tener base estadística
        if (Lmax < 2) {
          const patron1 = [seqValores[0]];
          const matches1 = [];
          for (let i = targetIdx + 1; i < totalSorteos; i++) {
            if (getDigits(sorteos[i])[pos] === patron1[0] && (i - 1) >= 0) {
              matches1.push({
                histIdx: i,
                fecha: sorteos[i].f,
                num: sorteos[i].n,
                fechaSig: sorteos[i - 1].f,
                numSig: sorteos[i - 1].n,
                nextDigit: getDigits(sorteos[i - 1])[pos],
                longitud: 1
              });
            }
          }
          matchesPorLongitud[1] = matches1;
          Lmax = 1;
        }

        // CONSOLIDACIÓN MULTI-NIVEL Y CÁLCULO DE PORCENTAJES
        // Ponderamos con mayor fuerza las secuencias más largas, pero integrando todas
        const scoresDigitos = new Array(10).fill(0);
        const conteoDigitosPorLongitud = {};
        let sumaPesos = 0;

        for (let L = (Lmax >= 2 ? 2 : 1); L <= Lmax; L++) {
          const list = matchesPorLongitud[L] || [];
          if (list.length === 0) continue;

          // Peso proporcional a la profundidad (L^1.5 para premiar patrones largos)
          const pesoL = Math.pow(L, 1.5);
          sumaPesos += pesoL;

          // Contar frecuencias en este nivel L
          const distL = new Array(10).fill(0);
          for (let m = 0; m < list.length; m++) {
            distL[list[m].nextDigit]++;
          }
          conteoDigitosPorLongitud[L] = {
            total: list.length,
            dist: distL
          };

          // Añadir al score consolidado
          for (let d = 0; d < 10; d++) {
            const probL = distL[d] / list.length;
            scoresDigitos[d] += pesoL * probL;
          }
        }

        // Convertir scores a porcentajes (suman 100%)
        const digitosRanking = [];
        const totalScore = scoresDigitos.reduce((a, b) => a + b, 0);

        for (let d = 0; d < 10; d++) {
          const pct = totalScore > 0 ? ((scoresDigitos[d] / totalScore) * 100) : 10;
          digitosRanking.push({
            digit: d,
            score: Math.round(scoresDigitos[d] * 100) / 100,
            pct: Math.round(pct * 10) / 10
          });
        }

        digitosRanking.sort((a, b) => b.pct - a.pct);

        // Secuencia más larga (en orden cronológico para mostrar: más antiguo -> más reciente)
        const patronCronologico = seqValores.slice(0, Lmax).reverse();

        analisisPosiciones.push({
          pos: pos,
          info: nombresPos[pos],
          Lmax: Lmax,
          patronCronologico: patronCronologico,
          matchesLmax: matchesPorLongitud[Lmax] || [],
          matchesPorLongitud: matchesPorLongitud,
          conteoDigitosPorLongitud: conteoDigitosPorLongitud,
          topPick: digitosRanking[0],
          runnerUp: digitosRanking[1],
          thirdPick: digitosRanking[2],
          ranking: digitosRanking
        });
      }

      // ========================================================================
      // 2. ANÁLISIS DE 2 CIFRAS (TERMINALES FINALES: DECENAS Y UNIDADES)
      // ========================================================================
      const seq2C = [];
      const lim2C = Math.min(5, totalSorteos - targetIdx);
      for (let k = 0; k < lim2C; k++) {
        seq2C.push(sorteos[targetIdx + k].n.slice(2, 4));
      }

      const matches2C = [];
      let Lmax2C = 0;

      // Buscar para L=2 (par anterior -> par actual)
      if (seq2C.length >= 2) {
        for (let i = targetIdx + 1; i < totalSorteos - 1; i++) {
          const par1 = sorteos[i].n.slice(2, 4);
          const par2 = sorteos[i + 1].n.slice(2, 4);
          if (par1 === seq2C[0] && par2 === seq2C[1] && (i - 1) >= 0) {
            matches2C.push({
              histIdx: i,
              fecha: sorteos[i].f,
              num: sorteos[i].n,
              fechaSig: sorteos[i - 1].f,
              numSig: sorteos[i - 1].n,
              next2C: sorteos[i - 1].n.slice(2, 4)
            });
          }
        }
        if (matches2C.length > 0) Lmax2C = 2;
      }

      // Si no hubo L=2, buscar L=1 (cuándo ha salido este mismo par terminal y qué siguió)
      if (matches2C.length === 0) {
        for (let i = targetIdx + 1; i < totalSorteos; i++) {
          if (sorteos[i].n.slice(2, 4) === seq2C[0] && (i - 1) >= 0) {
            matches2C.push({
              histIdx: i,
              fecha: sorteos[i].f,
              num: sorteos[i].n,
              fechaSig: sorteos[i - 1].f,
              numSig: sorteos[i - 1].n,
              next2C: sorteos[i - 1].n.slice(2, 4)
            });
          }
        }
        Lmax2C = 1;
      }

      // Contar frecuencias del par terminal siguiente
      const mapa2C = {};
      matches2C.forEach(m => {
        mapa2C[m.next2C] = (mapa2C[m.next2C] || 0) + 1;
      });

      const top2C = Object.keys(mapa2C).map(par => ({
        par: par,
        freq: mapa2C[par],
        pct: Math.round((mapa2C[par] / matches2C.length) * 1000) / 10
      })).sort((a, b) => b.freq - a.freq);

      // ========================================================================
      // 3. ANÁLISIS DE 3 CIFRAS (TERMINALES FINALES: 3 ÚLTIMOS DÍGITOS)
      // ========================================================================
      const curr3C = sorteos[targetIdx].n.slice(1, 4);
      const prev3C = (totalSorteos - targetIdx > 1) ? sorteos[targetIdx + 1].n.slice(1, 4) : null;
      const matches3C = [];
      let Lmax3C = 1;

      // Buscar si la secuencia de 2 sorteos ocurrió (prev3C -> curr3C)
      if (prev3C) {
        for (let i = targetIdx + 1; i < totalSorteos - 1; i++) {
          if (sorteos[i].n.slice(1, 4) === curr3C && sorteos[i + 1].n.slice(1, 4) === prev3C && (i - 1) >= 0) {
            matches3C.push({
              histIdx: i,
              fecha: sorteos[i].f,
              num: sorteos[i].n,
              fechaSig: sorteos[i - 1].f,
              numSig: sorteos[i - 1].n,
              next3C: sorteos[i - 1].n.slice(1, 4)
            });
          }
        }
        if (matches3C.length > 0) Lmax3C = 2;
      }

      // Si no hubo de longitud 2, buscar salidas de curr3C
      if (matches3C.length === 0) {
        for (let i = targetIdx + 1; i < totalSorteos; i++) {
          if (sorteos[i].n.slice(1, 4) === curr3C && (i - 1) >= 0) {
            matches3C.push({
              histIdx: i,
              fecha: sorteos[i].f,
              num: sorteos[i].n,
              fechaSig: sorteos[i - 1].f,
              numSig: sorteos[i - 1].n,
              next3C: sorteos[i - 1].n.slice(1, 4)
            });
          }
        }
        Lmax3C = 1;
      }

      const mapa3C = {};
      matches3C.forEach(m => {
        mapa3C[m.next3C] = (mapa3C[m.next3C] || 0) + 1;
      });

      const top3C = Object.keys(mapa3C).map(trio => ({
        trio: trio,
        freq: mapa3C[trio],
        pct: matches3C.length > 0 ? Math.round((mapa3C[trio] / matches3C.length) * 1000) / 10 : 0
      })).sort((a, b) => b.freq - a.freq);

      // ========================================================================
      // 4. ANÁLISIS DE 4 CIFRAS COMPLETO
      // ========================================================================
      const curr4C = sorteos[targetIdx].n;
      const matches4C = [];
      for (let i = targetIdx + 1; i < totalSorteos; i++) {
        if (sorteos[i].n === curr4C && (i - 1) >= 0) {
          matches4C.push({
            histIdx: i,
            fecha: sorteos[i].f,
            num: sorteos[i].n,
            signo: sorteos[i].s,
            fechaSig: sorteos[i - 1].f,
            numSig: sorteos[i - 1].n,
            signoSig: sorteos[i - 1].s
          });
        }
      }

      // ========================================================================
      // 5. SUPER PRONÓSTICO SECUENCIAL CONSOLIDADO
      // ========================================================================
      const d1 = analisisPosiciones[0].topPick.digit;
      const d2 = analisisPosiciones[1].topPick.digit;
      const d3 = analisisPosiciones[2].topPick.digit;
      const d4 = analisisPosiciones[3].topPick.digit;
      const numeroEstrella = `${d1}${d2}${d3}${d4}`;

      // Fuerza o nivel de confianza promedio (%)
      const confianzaPromedio = Math.round(
        (analisisPosiciones[0].topPick.pct +
         analisisPosiciones[1].topPick.pct +
         analisisPosiciones[2].topPick.pct +
         analisisPosiciones[3].topPick.pct) / 4 * 10
      ) / 10;

      // Profundidad máxima promedio
      const profundidadPromedio = Math.round(
        (analisisPosiciones[0].Lmax +
         analisisPosiciones[1].Lmax +
         analisisPosiciones[2].Lmax +
         analisisPosiciones[3].Lmax) / 4 * 10
      ) / 10;

      // Generar 4 números alternativos cruzando los top 2 de cada posición
      const numsAlternativos = [];
      const r1 = analisisPosiciones[0].runnerUp.digit;
      const r2 = analisisPosiciones[1].runnerUp.digit;
      const r3 = analisisPosiciones[2].runnerUp.digit;
      const r4 = analisisPosiciones[3].runnerUp.digit;

      const altCandidates = [
        `${d1}${d2}${d3}${r4}`,
        `${d1}${d2}${r3}${d4}`,
        `${d1}${r2}${d3}${d4}`,
        `${r1}${d2}${d3}${d4}`,
        `${d1}${r2}${r3}${d4}`
      ];

      altCandidates.forEach((cand, idx) => {
        if (cand !== numeroEstrella && !numsAlternativos.includes(cand)) {
          numsAlternativos.push(cand);
        }
      });

      // Comparación si está en modo Backtest
      let backtestResult = null;
      if (esBacktest && sorteoReal) {
        const dReal = getDigits(sorteoReal);
        backtestResult = {
          fechaReal: sorteoReal.f,
          numReal: sorteoReal.n,
          signoReal: sorteoReal.s,
          aciertoTotal: sorteoReal.n === numeroEstrella,
          acierto3C: sorteoReal.n.slice(1, 4) === numeroEstrella.slice(1, 4),
          acierto2C: sorteoReal.n.slice(2, 4) === numeroEstrella.slice(2, 4),
          aciertoD1: dReal[0] === d1,
          aciertoD2: dReal[1] === d2,
          aciertoD3: dReal[2] === d3,
          aciertoD4: dReal[3] === d4,
          totalDigitosAcertados: (dReal[0] === d1 ? 1 : 0) +
                                 (dReal[1] === d2 ? 1 : 0) +
                                 (dReal[2] === d3 ? 1 : 0) +
                                 (dReal[3] === d4 ? 1 : 0)
        };
      }

      return {
        targetIdx: targetIdx,
        sorteoBase: sorteoBase,
        sorteosVisual: sorteosVisual,
        esBacktest: esBacktest,
        sorteoReal: sorteoReal,
        backtestResult: backtestResult,
        posiciones: analisisPosiciones,
        dosCifras: {
          seqActual: seq2C,
          Lmax: Lmax2C,
          matches: matches2C,
          top: top2C
        },
        tresCifras: {
          curr3C: curr3C,
          prev3C: prev3C,
          Lmax: Lmax3C,
          matches: matches3C,
          top: top3C
        },
        cuatroCifras: {
          curr4C: curr4C,
          matches: matches4C
        },
        consolidado: {
          numeroEstrella: numeroEstrella,
          confianzaPromedio: confianzaPromedio,
          profundidadPromedio: profundidadPromedio,
          alternativos: numsAlternativos.slice(0, 4),
          top2CFinal: top2C.length > 0 ? top2C[0] : null,
          top3CFinal: top3C.length > 0 ? top3C[0] : null
        }
      };
    },

    /**
     * ==============================================================================
     * MOTOR DE CONVERGENCIA ENTRÓPICA — LOS 8 NÚMEROS DE ORO
     * ==============================================================================
     * Cierra la brecha de probabilidad combinando los porcentajes máximos:
     * 1. Momento y viabilidad posicional individual (Secuencial + Matrices + Distancias)
     * 2. Cohesión y probabilidad de acompañamiento multivariado:
     *    - El primer dígito y el último (D1 - D4)
     *    - Pareja inicial (D1 - D2)
     *    - Pareja terminal (D3 - D4)
     *    - Pareja central (D2 - D3)
     * 3. Saltos modulares desde el último sorteo ocurrido
     * 4. Compatibilidad con los signos zodiacales más maduros (Ley de Equilibrio JEV)
     */
    computeConvergenciaEntropica: function (sorteos, targetIdx) {
      if (!sorteos || sorteos.length < 10) return [];
      targetIdx = (typeof targetIdx === 'number' && targetIdx >= 0) ? Math.min(targetIdx, sorteos.length - 4) : 0;
      const total = sorteos.length;
      const base = sorteos[targetIdx];
      const ultDigs = [parseInt(base.n[0], 10), parseInt(base.n[1], 10), parseInt(base.n[2], 10), parseInt(base.n[3], 10)];

      // 1. Obtener modelos base SIN fuga de datos (restringido estrictamente a sorteos >= targetIdx)
      const sorteosSinFuga = targetIdx > 0 ? sorteos.slice(targetIdx) : sorteos;
      const sec = this.computePredictorSecuencial(sorteos, targetIdx, 7);
      const distInfo = this.computeDistancias(sorteosSinFuga);
      const mat100 = this.computeMatrices(sorteosSinFuga)[100].matriz;
      const topDists = distInfo.mayorProb
        .slice()
        .sort((a, b) => b.promedio - a.promedio)
        .map(x => x.distancia)
        .slice(0, 2);

      // Signos más probables según equilibrio JEV (sin fuga de datos)
      let topSignos = [];
      if (typeof this.computePronosticosJEVSignos === 'function') {
        topSignos = this.computePronosticosJEVSignos(sorteosSinFuga).slice(0, 4);
      }
      const signoPrincipal = (topSignos.length > 0) ? topSignos[0].signo : 'Aries';

      // 2. Matrices de co-ocurrencia y acompañamiento entre cifras
      const c14 = Array.from({ length: 10 }, () => new Array(10).fill(0)); // Primero y Último
      const c12 = Array.from({ length: 10 }, () => new Array(10).fill(0)); // Inicial
      const c23 = Array.from({ length: 10 }, () => new Array(10).fill(0)); // Centro
      const c34 = Array.from({ length: 10 }, () => new Array(10).fill(0)); // Terminal

      for (let i = targetIdx + 1; i < total; i++) {
        const n = pad(sorteos[i].n || 0, 4);
        const d0 = parseInt(n[0], 10), d1 = parseInt(n[1], 10), d2 = parseInt(n[2], 10), d3 = parseInt(n[3], 10);
        if (!isNaN(d0) && !isNaN(d1) && !isNaN(d2) && !isNaN(d3)) {
          c14[d0][d3]++;
          c12[d0][d1]++;
          c23[d1][d2]++;
          c34[d2][d3]++;
        }
      }

      const exp = Math.max(1, (total - targetIdx - 1) / 100);

      // 3. Score individual por posición integrando Secuencial + Matriz 100d + Distancias
      const scoresPos = [[], [], [], []];
      for (let p = 0; p < 4; p++) {
        const colPct = 'pct' + (p + 1);
        const posSec = sec ? sec.posiciones[p] : null;
        for (let d = 0; d < 10; d++) {
          const secItem = posSec ? (posSec.ranking.find(x => x.digit === d) || { pct: 10 }) : { pct: 10 };
          const matPct = mat100[d][colPct] || 10;
          const distReal = Math.min((d - ultDigs[p] + 10) % 10, (ultDigs[p] - d + 10) % 10);
          const isTopDist = topDists.includes(distReal);
          const distBonus = isTopDist ? 15 : 0;
          const scoreIndividual = (secItem.pct * 0.55) + (matPct * 0.30) + distBonus;
          scoresPos[p].push({
            digit: d,
            score: scoreIndividual,
            secPct: secItem.pct,
            matPct: matPct,
            distReal: distReal,
            isTopDist: isTopDist
          });
        }
        scoresPos[p].sort((a, b) => b.score - a.score);
      }

      // Tomar los top 3 mejores dígitos por posición (81 combinaciones a evaluar)
      const topCandsPorPos = scoresPos.map(list => list.slice(0, 3));

      // 4. Evaluar la función de convergencia entrópica para todas las combinaciones
      const combinations = [];
      const vistos = new Set();

      for (let d0 of topCandsPorPos[0]) {
        for (let d1 of topCandsPorPos[1]) {
          for (let d2 of topCandsPorPos[2]) {
            for (let d3 of topCandsPorPos[3]) {
              const numStr = `${d0.digit}${d1.digit}${d2.digit}${d3.digit}`;
              if (vistos.has(numStr)) continue;
              vistos.add(numStr);

              // Ratios de acompañamiento respecto a la frecuencia esperada teórica
              const r14 = c14[d0.digit][d3.digit] / exp;
              const r12 = c12[d0.digit][d1.digit] / exp;
              const r23 = c23[d1.digit][d2.digit] / exp;
              const r34 = c34[d2.digit][d3.digit] / exp;

              // Cohesión estructural multivariada (mayor peso a primero-último y parejas extremas)
              const cohesion = (r14 * 1.5 + r12 * 1.2 + r34 * 1.3 + r23 * 0.8) / 4.8;

              // Promedio de fuerza posicional
              const pAvg = (d0.score + d1.score + d2.score + d3.score) / 4;
              const secAvg = (d0.secPct + d1.secPct + d2.secPct + d3.secPct) / 4;

              // Score final compuesto (escala 0 - 100)
              const scoreFinal = Math.min(99.4, Math.round(((pAvg * 0.46) + (cohesion * 48)) * 10) / 10);

              // Signo sugerido alternado de los top signos
              const signoIdx = (d0.digit + d3.digit) % (topSignos.length || 1);
              const signoElegido = topSignos[signoIdx] ? topSignos[signoIdx].signo : signoPrincipal;

              // Nivel de convergencia
              const nivel = scoreFinal >= 66 ? 'Máxima Convergencia ★★★' :
                            scoreFinal >= 60 ? 'Alta Convergencia ★★' : 'Convergencia Sólida ★';

              // Saltos modulares
              const saltos = [d0.distReal, d1.distReal, d2.distReal, d3.distReal];

              // Fundamentación estadística
              const diff14Pct = Math.round((r14 - 1) * 100);
              const diff12Pct = Math.round((r12 - 1) * 100);
              const diff34Pct = Math.round((r34 - 1) * 100);

              const razon14 = diff14Pct >= 0
                ? `Acompañamiento D1-D4 superior a la media (+${diff14Pct}%)`
                : `Acompañamiento D1-D4 estándar (${diff14Pct}%)`;

              combinations.push({
                numero: numStr,
                score: scoreFinal,
                nivel: nivel,
                signo: signoElegido,
                cohesionScore: Math.round(cohesion * 100) / 100,
                secAvg: Math.round(secAvg * 10) / 10,
                r14: Math.round(r14 * 100),
                r12: Math.round(r12 * 100),
                r34: Math.round(r34 * 100),
                r23: Math.round(r23 * 100),
                diff14Pct: diff14Pct,
                diff12Pct: diff12Pct,
                diff34Pct: diff34Pct,
                saltos: saltos,
                digitos: [d0.digit, d1.digit, d2.digit, d3.digit],
                fundamentacion: `${razon14}. Fuerza secuencial promedio de ${Math.round(secAvg)}%. Cohesión de pares inicial ${d0.digit}${d1.digit} (${Math.round(r12*100)}%) y terminal ${d2.digit}${d3.digit} (${Math.round(r34*100)}%).`
              });
            }
          }
        }
      }

      // Ordenar por score convergente descendente y retornar los Top 8
      combinations.sort((a, b) => b.score - a.score);
      const top8 = combinations.slice(0, 8);
      top8.forEach((item, idx) => {
        item.rank = idx + 1;
      });

      return top8;
    },

    /**
     * ==============================================================================
     * ANÁLISIS DE RESULTADOS & UMBRALES (NÚMEROS Y DISTANCIAS BASE 10)
     * ==============================================================================
     * Replica el cuadro de analisis_resultados.py directamente en el navegador y
     * extiende exactamente el mismo análisis a las Distancias Base 10 (db10):
     *  - Top 10 dígitos más frecuentes por posición (1º..10º)
     *  - Combinaciones 2D (últimos 2), 3D (últimos 3) y 4D (completas) que superan
     *    el umbral estadístico dinámico (ceil(N * factor)), con frecuencia y sorteos s/s
     *  - En modo Base 10, calcula el número equivalente proyectado desde el último sorteo
     */
    computeAnalisisResultados: function (sorteos, opts) {
      if (!Array.isArray(sorteos) || sorteos.length === 0) return null;
      opts = opts || {};

      const modo = (opts.modo === 'base10') ? 'base10' : 'numeros';
      const loteria = (opts.loteria || 'luna').toLowerCase();
      const cantidadDias = (typeof opts.cantidadDias === 'number' && !isNaN(opts.cantidadDias)) ? opts.cantidadDias : 3652;
      const ordenarPor = opts.ordenarPor || 'freq_dias';
      const umbralesCustom = opts.umbralesCustom || {};

      // Dataset base: en modo base10 excluimos el sorteo más antiguo sin predecesor
      const totalBD = sorteos.length;
      const maxIdxValido = (modo === 'base10' && totalBD > 1) ? totalBD - 1 : totalBD;

      // Fecha de inicio según cantidadDias (relativa al sorteo más reciente de la BD)
      const fechaUltimo = sorteos[0].f;
      const fechaMasAntigua = sorteos[maxIdxValido - 1] ? sorteos[maxIdxValido - 1].f : fechaUltimo;
      let fechaInicioAnalisis = fechaMasAntigua;

      if (cantidadDias > 0) {
        const dtMax = new Date(fechaUltimo + 'T12:00:00Z');
        dtMax.setUTCDate(dtMax.getUTCDate() - cantidadDias);
        const fCalc = dtMax.toISOString().slice(0, 10);
        fechaInicioAnalisis = fCalc > fechaMasAntigua ? fCalc : fechaMasAntigua;
      }

      // Helper para extraer el código de 4 dígitos según el modo
      const getCodigo = (s) => {
        if (modo === 'base10') {
          if (s.db10 && String(s.db10).length === 4) return String(s.db10);
          if (Array.isArray(s.c) && s.c.length === 4) return s.c.join('');
          return '0000';
        }
        return pad(s.n || 0, 4);
      };

      // Último índice de aparición (sorteos s/s = idx en orden descendente) sobre toda la BD
      const lastSeen2D = Object.create(null);
      const lastSeen3D = Object.create(null);
      const lastSeen4D = Object.create(null);
      const lastFecha2D = Object.create(null);
      const lastFecha3D = Object.create(null);
      const lastFecha4D = Object.create(null);

      // Conteos dentro de la ventana fecha >= fechaInicioAnalisis
      const posCounts = [
        new Array(10).fill(0),
        new Array(10).fill(0),
        new Array(10).fill(0),
        new Array(10).fill(0)
      ];
      const freq2D = Object.create(null);
      const freq3D = Object.create(null);
      const freq4D = Object.create(null);
      let totalVentana = 0;

      for (let i = 0; i < maxIdxValido; i++) {
        const s = sorteos[i];
        const cod = getCodigo(s);
        if (cod.length !== 4) continue;
        const c2 = cod.slice(2, 4);
        const c3 = cod.slice(1, 4);
        const c4 = cod;

        // Como sorteos está en orden descendente (más reciente = índice 0),
        // la primera vez que vemos un código nos da exactamente su atraso en sorteos (i)
        if (lastSeen2D[c2] === undefined) { lastSeen2D[c2] = i; lastFecha2D[c2] = s.f; }
        if (lastSeen3D[c3] === undefined) { lastSeen3D[c3] = i; lastFecha3D[c3] = s.f; }
        if (lastSeen4D[c4] === undefined) { lastSeen4D[c4] = i; lastFecha4D[c4] = s.f; }

        if (s.f >= fechaInicioAnalisis) {
          totalVentana++;
          const d0 = cod.charCodeAt(0) - 48;
          const d1 = cod.charCodeAt(1) - 48;
          const d2 = cod.charCodeAt(2) - 48;
          const d3 = cod.charCodeAt(3) - 48;
          if (d0 >= 0 && d0 <= 9) posCounts[0][d0]++;
          if (d1 >= 0 && d1 <= 9) posCounts[1][d1]++;
          if (d2 >= 0 && d2 <= 9) posCounts[2][d2]++;
          if (d3 >= 0 && d3 <= 9) posCounts[3][d3]++;

          freq2D[c2] = (freq2D[c2] || 0) + 1;
          freq3D[c3] = (freq3D[c3] || 0) + 1;
          freq4D[c4] = (freq4D[c4] || 0) + 1;
        }
      }

      // Top 10 dígitos más frecuentes por posición (1º..10º)
      const topsPosicion = posCounts.map((arr, pos) => {
        const items = arr.map((count, digit) => ({
          digit: String(digit),
          count: count,
          pct: totalVentana > 0 ? Math.round((count / totalVentana) * 1000) / 10 : 0
        }));
        items.sort((a, b) => b.count - a.count || a.digit.localeCompare(b.digit));
        return {
          pos: pos,
          label: modo === 'base10' ? `Salto Δ${pos + 1}` : `Dígito ${pos + 1}`,
          items: items
        };
      });

      // Factores estadísticos calibrados (basados en analisis_resultados.py, calibrados
      // para que Sol, Luna y Combinados arrojen combinaciones útiles en cualquier ventana)
      const factoresPorLot = {
        sol: { f2: 0.008, f3: 0.0008, f4: 0.00004 },
        luna: { f2: 0.008, f3: 0.0008, f4: 0.00004 },
        combinados: { f2: 0.01, f3: 0.0012, f4: 0.0001 }
      };
      const fLot = factoresPorLot[loteria] || factoresPorLot.luna;

      const calcUmbralAuto = (factor) => Math.max(Math.ceil(totalVentana * factor), 2);
      const umbralAuto = {
        u2: calcUmbralAuto(fLot.f2),
        u3: calcUmbralAuto(fLot.f3),
        u4: calcUmbralAuto(fLot.f4)
      };

      const parseUmbral = (val, fallback) => {
        if (val === null || val === undefined || val === '') return fallback;
        const n = parseInt(val, 10);
        return (!isNaN(n) && n >= 0) ? n : fallback;
      };

      const umbral2D = parseUmbral(umbralesCustom.u2, umbralAuto.u2);
      const umbral3D = parseUmbral(umbralesCustom.u3, umbralAuto.u3);
      const umbral4D = parseUmbral(umbralesCustom.u4, umbralAuto.u4);

      // Proyección de número equivalente hoy (solo aplica en modo base10)
      const ultStr = pad(sorteos[0].n || 0, 4);
      const ultDigs = [0, 1, 2, 3].map(k => parseInt(ultStr[k], 10));
      const proyectarDesdeBase10 = (cod, startPos) => {
        if (modo !== 'base10') return null;
        let out = '';
        for (let k = 0; k < cod.length; k++) {
          const delta = parseInt(cod[k], 10);
          out += String((ultDigs[startPos + k] + delta) % 10);
        }
        return out;
      };

      const buildLista = (freqMap, lastMap, fechaMap, umbral, startPos) => {
        const res = [];
        for (const codigo in freqMap) {
          const freq = freqMap[codigo];
          if (freq > umbral) {
            res.push({
              codigo: codigo,
              freq: freq,
              dias: lastMap[codigo] !== undefined ? lastMap[codigo] : totalBD,
              ultimaFecha: fechaMap[codigo] || '',
              equivHoy: proyectarDesdeBase10(codigo, startPos)
            });
          }
        }
        res.sort((a, b) => {
          if (ordenarPor === 'dias') return (b.dias - a.dias) || (b.freq - a.freq) || a.codigo.localeCompare(b.codigo);
          if (ordenarPor === 'freq') return (b.freq - a.freq) || a.codigo.localeCompare(b.codigo);
          return (b.freq - a.freq) || (b.dias - a.dias) || a.codigo.localeCompare(b.codigo);
        });
        return res;
      };

      const data2D = buildLista(freq2D, lastSeen2D, lastFecha2D, umbral2D, 2);
      const data3D = buildLista(freq3D, lastSeen3D, lastFecha3D, umbral3D, 1);
      const data4D = buildLista(freq4D, lastSeen4D, lastFecha4D, umbral4D, 0);

      return {
        modo: modo,
        loteria: loteria,
        ultimoSorteo: sorteos[0],
        fechaInicioAnalisis: fechaInicioAnalisis,
        fechaUltimo: fechaUltimo,
        cantidadDias: cantidadDias,
        totalBD: totalBD,
        totalVentana: totalVentana,
        ordenarPor: ordenarPor,
        umbralAuto: umbralAuto,
        umbral2D: umbral2D,
        umbral3D: umbral3D,
        umbral4D: umbral4D,
        topsPosicion: topsPosicion,
        data2D: data2D,
        data3D: data3D,
        data4D: data4D
      };
    }
  };
})();

