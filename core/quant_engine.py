"""
Motor Cuantitativo & Forense para Super Astro (Luna, Sol, Combinados).
======================================================================
Implementa técnicas estadísticas y de Machine Learning rigurosas sin fuga de datos:
  1. Auditoría Forense de Aleatoriedad & Cambio de Régimen:
     - Pruebas Chi-Cuadrado (p-valor exacto vía función gamma incompleta)
     - Corrección Benjamini-Hochberg (FDR) contra falsos positivos
     - Factor de Bayes (Dirichlet-Multinomial vs Uniforme)
     - Detector de Cambio de Régimen Page-Hinkley / CUSUM por posición
     - Entropía de Shannon normalizada e Información Mutua (D1-D4, D3-D4, Lag-1, Sol->Luna)
  2. Arena Walk-Forward Out-of-Sample (6 modelos):
     - M0: Baseline Uniforme (referencia teórica 10% dígito / 8.33% signo)
     - M1: Bayesiano Dirichlet-Multinomial con decaimiento exponencial (gamma)
     - M2: Context Tree Weighting (CTW) / Markov de orden variable (L=0..3)
     - M3: Regresión Logística Multinomial Online con Regularización L2 (features circulares + calendario)
     - M4: Contrarian / Reversión a la Media (JEV regularizado, para auditoría empírica)
     - M5: Meta-Ensamble Hedge (ponderación exponencial por Log-Loss out-of-sample)
  3. Optimizador de Cartera de 8 Tickets (Covering Design / Cobertura Submodular 2C/3C) + EV real.
"""
import os
import json
import math
import datetime
from typing import Dict, Any, List, Tuple, Optional
import numpy as np

SIGNOS_LISTA = [
    'Aries', 'Tauro', 'Geminis', 'Cancer',
    'Leo', 'Virgo', 'Libra', 'Escorpion',
    'Sagitario', 'Capricornio', 'Acuario', 'Piscis'
]
SIGNO_TO_IDX = {s.lower(): i for i, s in enumerate(SIGNOS_LISTA)}

# Cache en memoria indexado por (firma_dataset, loteria, eval_window)
_QUANT_CACHE: Dict[Tuple[str, str, int], Dict[str, Any]] = {}


# ============================================================================
# FUNCIONES MATEMÁTICAS DE DISTRIBUCIONES (SIN DEPENDENCIA DE SCIPY)
# ============================================================================

def _gammaincc_series(a: float, x: float) -> float:
    """Complemento de gamma incompleta regularizada Q(a, x) vía serie para x < a + 1."""
    gln = math.lgamma(a)
    if x <= 0.0:
        return 1.0
    ap = a
    term = 1.0 / a
    total = term
    for _ in range(200):
        ap += 1.0
        term *= x / ap
        total += term
        if abs(term) < abs(total) * 1e-12:
            break
    p = total * math.exp(-x + a * math.log(x) - gln)
    return max(0.0, min(1.0, 1.0 - p))


def _gammaincc_cf(a: float, x: float) -> float:
    """Complemento de gamma incompleta regularizada Q(a, x) vía fracción continua de Lentz."""
    gln = math.lgamma(a)
    fpmin = 1e-300
    b = x + 1.0 - a
    c = 1.0 / fpmin
    d = 1.0 / b if abs(b) > fpmin else 1.0 / fpmin
    h = d
    for i in range(1, 200):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < fpmin:
            d = fpmin
        c = b + an / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-12:
            break
    val = math.exp(-x + a * math.log(x) - gln) * h
    return max(0.0, min(1.0, val))


def chi2_pvalue(chi2_stat: float, df: int) -> float:
    """Calcula p-valor exacto P(X >= chi2_stat) para X ~ Chi2(df)."""
    if chi2_stat <= 0.0:
        return 1.0
    a = df / 2.0
    x = chi2_stat / 2.0
    if x < a + 1.0:
        return _gammaincc_series(a, x)
    return _gammaincc_cf(a, x)


def normal_one_sided_pvalue(z: float) -> float:
    """P(Z >= z) para Z ~ N(0, 1)."""
    return 0.5 * math.erfc(z / math.sqrt(2.0))


def log10_bayes_factor_dirichlet(counts: np.ndarray, alpha: float = 1.0) -> float:
    """
    Calcula log10(BF_10) comparando H1: p ~ Dirichlet(alpha, ..., alpha)
    frente a H0: p_i = 1/K (uniforme).
    BF_10 > 1 (log10 > 0) favorece no-uniformidad; log10 > 1 es evidencia fuerte.
    """
    k = len(counts)
    n = float(np.sum(counts))
    if n <= 0:
        return 0.0
    # log P(data | H0) = -n * ln(k)
    log_p0 = -n * math.log(k)
    # log P(data | H1) = lgamma(k*alpha) - k*lgamma(alpha) + sum(lgamma(c_i + alpha)) - lgamma(n + k*alpha)
    log_p1 = (
        math.lgamma(k * alpha)
        - k * math.lgamma(alpha)
        + sum(math.lgamma(float(c) + alpha) for c in counts)
        - math.lgamma(n + k * alpha)
    )
    return (log_p1 - log_p0) / math.log(10.0)


def benjamini_hochberg(pvals: List[float]) -> List[float]:
    """Corrección Benjamini-Hochberg (FDR) que retorna q-valores ajustados."""
    m = len(pvals)
    if m == 0:
        return []
    indexed = sorted(enumerate(pvals), key=lambda x: x[1])
    qvals = [1.0] * m
    prev_q = 1.0
    for rank_rev in range(m - 1, -1, -1):
        orig_idx, p = indexed[rank_rev]
        rank = rank_rev + 1
        q = min(prev_q, (p * m) / rank)
        qvals[orig_idx] = min(1.0, max(0.0, q))
        prev_q = qvals[orig_idx]
    return qvals


def normalize_sign_index(sign_str: str) -> int:
    if not sign_str:
        return 0
    s = sign_str.strip().lower()
    for a, b in (('á', 'a'), ('é', 'e'), ('í', 'i'), ('ó', 'o'), ('ú', 'u')):
        s = s.replace(a, b)
    if s == 'escorpio':
        s = 'escorpion'
    return SIGNO_TO_IDX.get(s, 0)


# ============================================================================
# CARGA DE DATASET
# ============================================================================

def _cargar_dataset_memoria() -> Tuple[Dict[str, Any], str]:
    from core.data_exporter import construir_dataset_memoria
    data, _, firma = construir_dataset_memoria()
    return data, firma


def _construir_lista_cronologica(data: Dict[str, Any], loteria: str) -> List[Dict[str, Any]]:
    lot = loteria.lower()
    if lot == 'luna':
        arr = data.get('luna', [])
    elif lot == 'sol':
        arr = data.get('sol', [])
    else:
        if 'combinados' in data and data['combinados']:
            arr = data['combinados']
        else:
            arr = data.get('luna', []) + data.get('sol', [])
            arr.sort(key=lambda r: (r['f'], 2 if r.get('l') == 'luna' else 1), reverse=True)
    # Invertir a orden cronológico ascendente (más antiguo -> más reciente)
    return list(reversed(arr))


# ============================================================================
# 1. AUDITORÍA FORENSE DE SESGO FÍSICO Y CAMBIO DE RÉGIMEN
# ============================================================================

def _detectar_cambio_regimen_cusum(digits_arr: np.ndarray, fechas: List[str]) -> Dict[str, Any]:
    """
    Aplica detector Page-Hinkley / CUSUM multivariado sobre ventanas móviles de 100 sorteos
    para identificar si hubo un cambio estructural reciente (ej. cambio de balotas).
    """
    n = len(digits_arr)
    if n < 200:
        return {'detectado': False, 'score_max': 0.0, 'fecha_cambio': None, 'sparkline': []}

    # Calcular estadístico chi2 móvil en bloques cada 25 sorteos (ventana 200) sobre los últimos 1,200 sorteos
    start_idx = max(0, n - 1200)
    win = 200
    step = 25
    sparkline = []
    max_chi2 = 0.0
    max_fecha = None

    for end in range(start_idx + win, n + 1, step):
        sub = digits_arr[end - win:end]
        cnt = np.bincount(sub, minlength=10).astype(np.float64)
        exp = win / 10.0
        chi2 = float(np.sum((cnt - exp) ** 2 / exp))
        sparkline.append({'fecha': fechas[end - 1], 'chi2': round(chi2, 2)})
        if chi2 > max_chi2:
            max_chi2 = chi2
            max_fecha = fechas[end - 1]

    # También último punto exacto si no coincidió con step
    if not sparkline or sparkline[-1]['fecha'] != fechas[-1]:
        sub = digits_arr[-win:]
        cnt = np.bincount(sub, minlength=10).astype(np.float64)
        exp = win / 10.0
        chi2 = float(np.sum((cnt - exp) ** 2 / exp))
        sparkline.append({'fecha': fechas[-1], 'chi2': round(chi2, 2)})
        if chi2 > max_chi2:
            max_chi2 = chi2
            max_fecha = fechas[-1]

    # CUSUM de la desviación máxima de algún dígito respecto a 0.10 en últimos 600 sorteos
    sub_recent = digits_arr[max(0, n - 600):]
    fechas_recent = fechas[max(0, n - 600):]
    best_cusum = 0.0
    best_digit = 0
    best_cp_fecha = None
    drift = 0.015  # tolerancia de deriva

    for d in range(10):
        indicators = (sub_recent == d).astype(np.float64) - 0.10
        cs = 0.0
        min_cs = 0.0
        min_idx = 0
        peak = 0.0
        peak_cp = 0
        for idx, val in enumerate(indicators):
            cs += val - drift
            if cs < min_cs:
                min_cs = cs
                min_idx = idx
            diff = cs - min_cs
            if diff > peak:
                peak = diff
                peak_cp = min_idx
        if peak > best_cusum:
            best_cusum = peak
            best_digit = d
            best_cp_fecha = fechas_recent[peak_cp] if peak_cp < len(fechas_recent) else None

    return {
        'detectado': best_cusum > 7.5 or max_chi2 > 21.67,
        'score_cusum': round(best_cusum, 2),
        'digito_impulsor': int(best_digit),
        'fecha_cambio': best_cp_fecha if best_cusum > 7.5 else max_fecha,
        'chi2_ventana_max': round(max_chi2, 2),
        'sparkline': sparkline[-28:]
    }


def analizar_forense(
    digits_mat: np.ndarray,
    sign_idx: np.ndarray,
    fechas: List[str],
    data_full: Dict[str, Any]
) -> Dict[str, Any]:
    n = len(fechas)
    posiciones_report = []
    raw_pvals_recent = []

    ventanas = [('historico', n), ('1000', min(1000, n)), ('300', min(300, n)), ('100', min(100, n))]

    for p in range(4):
        col = digits_mat[:, p]
        tests = {}
        for label, w in ventanas:
            sub = col[-w:]
            cnt = np.bincount(sub, minlength=10).astype(np.float64)
            exp = w / 10.0
            chi2 = float(np.sum((cnt - exp) ** 2 / exp))
            pval = chi2_pvalue(chi2, 9)
            probs = cnt / max(1.0, float(w))
            nonzero = probs[probs > 0]
            entropy_norm = float(-np.sum(nonzero * np.log2(nonzero)) / math.log2(10.0))
            log10_bf = log10_bayes_factor_dirichlet(cnt, alpha=1.0)
            tests[label] = {
                'n': int(w),
                'chi2': round(chi2, 2),
                'pvalue': round(pval, 4),
                'entropia_norm': round(entropy_norm, 4),
                'log10_bf': round(log10_bf, 2),
                'top_digito': int(np.argmax(cnt)),
                'top_pct': round(float(np.max(probs) * 100.0), 2),
                'min_digito': int(np.argmin(cnt)),
                'min_pct': round(float(np.min(probs) * 100.0), 2)
            }

        raw_pvals_recent.append(tests['1000']['pvalue'])
        regimen = _detectar_cambio_regimen_cusum(col, fechas)
        posiciones_report.append({
            'pos': p,
            'label': f'Dígito {p + 1}',
            'tests': tests,
            'regimen': regimen
        })

    # Test para Signos Zodiacales
    sign_tests = {}
    for label, w in ventanas:
        sub = sign_idx[-w:]
        cnt = np.bincount(sub, minlength=12).astype(np.float64)
        exp = w / 12.0
        chi2 = float(np.sum((cnt - exp) ** 2 / exp))
        pval = chi2_pvalue(chi2, 11)
        probs = cnt / max(1.0, float(w))
        nonzero = probs[probs > 0]
        entropy_norm = float(-np.sum(nonzero * np.log2(nonzero)) / math.log2(12.0))
        log10_bf = log10_bayes_factor_dirichlet(cnt, alpha=1.0)
        sign_tests[label] = {
            'n': int(w),
            'chi2': round(chi2, 2),
            'pvalue': round(pval, 4),
            'entropia_norm': round(entropy_norm, 4),
            'log10_bf': round(log10_bf, 2),
            'top_signo': SIGNOS_LISTA[int(np.argmax(cnt))],
            'top_pct': round(float(np.max(probs) * 100.0), 2)
        }
    raw_pvals_recent.append(sign_tests['1000']['pvalue'])

    # Corrección Benjamini-Hochberg (FDR) sobre los 5 canales (D1..D4 + Signo) en ventana 1,000
    qvals = benjamini_hochberg(raw_pvals_recent)
    for p in range(4):
        posiciones_report[p]['qvalue_fdr_1000'] = round(qvals[p], 4)
        posiciones_report[p]['anomalia_significativa'] = bool(qvals[p] < 0.05)
    sign_qval = round(qvals[4], 4)

    # Dependencias estructurales (Lag-1, D1-D4, D3-D4, Cross-lottery Sol->Luna)
    lag1_matches = int(np.sum(digits_mat[1:] == digits_mat[:-1]))
    lag1_total = max(1, (n - 1) * 4)
    lag1_pct = lag1_matches / lag1_total * 100.0

    # Chi2 de independencia intra-sorteo D1-D4 y D3-D4
    def pair_chi2(pa: int, pb: int) -> Dict[str, Any]:
        joint = digits_mat[:, pa] * 10 + digits_mat[:, pb]
        cnt = np.bincount(joint, minlength=100).astype(np.float64)
        exp = n / 100.0
        chi2 = float(np.sum((cnt - exp) ** 2 / exp))
        return {'chi2': round(chi2, 1), 'pvalue': round(chi2_pvalue(chi2, 99), 4)}

    # Cross-lottery Sol -> Luna mismo día
    cross_pct = None
    cross_days = 0
    luna_arr = data_full.get('luna', [])
    sol_arr = data_full.get('sol', [])
    if luna_arr and sol_arr:
        sol_map = {x['f']: x['d'] for x in sol_arr}
        m_cross = 0
        t_cross = 0
        for x in luna_arr:
            sd = sol_map.get(x['f'])
            if sd:
                cross_days += 1
                for k in range(4):
                    t_cross += 1
                    if x['d'][k] == sd[k]:
                        m_cross += 1
        if t_cross > 0:
            cross_pct = round(m_cross / t_cross * 100.0, 2)

    return {
        'posiciones': posiciones_report,
        'signos': {
            'tests': sign_tests,
            'qvalue_fdr_1000': sign_qval,
            'anomalia_significativa': bool(sign_qval < 0.05)
        },
        'dependencias': {
            'lag1_repeat_pct': round(lag1_pct, 2),
            'd1_d4': pair_chi2(0, 3),
            'd3_d4': pair_chi2(2, 3),
            'd1_d2': pair_chi2(0, 1),
            'cross_sol_luna_pct': cross_pct,
            'cross_days': cross_days
        }
    }


# ============================================================================
# 2. ARENA WALK-FORWARD OUT-OF-SAMPLE (6 MODELOS + META-ENSAMBLE HEDGE)
# ============================================================================

def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exps = np.exp(shifted)
    return exps / np.sum(exps)


def _extraer_features_paso(
    digits_mat: np.ndarray,
    weekdays: np.ndarray,
    t: int
) -> np.ndarray:
    """
    Construye vector de features estrictamente con información hasta t-1 (sin fuga):
    - Sesgo (1)
    - Codificación circular sin/cos de los 4 dígitos en t-1 (8)
    - Codificación circular sin/cos de los 4 dígitos en t-2 (8)
    - Suma de dígitos t-1 normalizada y paridad (2)
    - Día de la semana circular sin/cos (2)
    Total = 21 features.
    """
    prev1 = digits_mat[t - 1]
    prev2 = digits_mat[t - 2] if t >= 2 else prev1
    two_pi_10 = 2.0 * math.pi / 10.0

    feats = np.empty(21, dtype=np.float64)
    feats[0] = 1.0
    for k in range(4):
        ang1 = prev1[k] * two_pi_10
        feats[1 + 2 * k] = math.sin(ang1)
        feats[2 + 2 * k] = math.cos(ang1)
    for k in range(4):
        ang2 = prev2[k] * two_pi_10
        feats[9 + 2 * k] = math.sin(ang2)
        feats[10 + 2 * k] = math.cos(ang2)

    s1 = float(np.sum(prev1))
    feats[17] = (s1 - 18.0) / 10.0
    feats[18] = 1.0 if (int(s1) % 2 == 0) else -1.0
    wd = weekdays[t] * (2.0 * math.pi / 7.0)
    feats[19] = math.sin(wd)
    feats[20] = math.cos(wd)
    return feats


def ejecutar_arena_walk_forward(
    digits_mat: np.ndarray,
    sign_idx: np.ndarray,
    fechas: List[str],
    eval_window: int = 300
) -> Dict[str, Any]:
    """
    Ejecuta evaluación walk-forward estricta (sin fuga de datos) sobre los últimos
    `eval_window` sorteos y produce las distribuciones calibradas para el próximo sorteo.
    """
    n = len(fechas)
    eval_n = min(max(50, eval_window), max(50, n - 120))
    eval_start = n - eval_n

    # Días de semana (0=Lunes..6=Domingo) con posición extra n para el próximo sorteo
    weekdays = np.zeros(n + 1, dtype=np.int32)
    for i, fstr in enumerate(fechas):
        try:
            weekdays[i] = datetime.date.fromisoformat(fstr).weekday()
        except Exception:
            weekdays[i] = i % 7
    weekdays[n] = (weekdays[n - 1] + 1) % 7 if n > 0 else 0

    # --- Estados incrementales de cada modelo (para las 4 posiciones y 12 signos) ---
    # M1: Bayesiano Dirichlet-Multinomial con decaimiento exponencial
    gamma = 0.996
    alpha_pos = 35.0   # prior conservador: solo se aleja de 10% con evidencia real
    alpha_sign = 24.0
    bayes_pos = np.zeros((4, 10), dtype=np.float64)
    bayes_sign = np.zeros(12, dtype=np.float64)

    # M2: Context Tree Weighting / Markov de Orden Variable (L=1, L=2, L=3)
    markov1 = np.zeros((4, 10, 10), dtype=np.float64)
    markov2 = np.zeros((4, 100, 10), dtype=np.float64)
    markov3 = [{} for _ in range(4)]  # dict (d_{t-3}, d_{t-2}, d_{t-1}) -> np.ndarray(10)
    markov_sign1 = np.zeros((12, 12), dtype=np.float64)
    # Pesos log-likelihood online de cada profundidad L=0,1,2,3 por posición
    ctw_log_w = np.zeros((4, 4), dtype=np.float64)

    # M3: Regresión Logística Multinomial Online (L2) por posición
    n_feats = 21
    logreg_W = np.zeros((4, 10, n_feats), dtype=np.float64)
    lr = 0.015
    l2_reg = 0.08

    # M4: Contrarian / JEV (conteos históricos acumulados + atraso)
    hist_pos = np.zeros((4, 10), dtype=np.float64)
    last_seen_pos = np.full((4, 10), -1, dtype=np.int32)
    hist_sign = np.zeros(12, dtype=np.float64)
    last_seen_sign = np.full(12, -1, dtype=np.int32)

    # M5: Meta-Ensamble Hedge (pesos sobre M0..M4, actualizados solo por log-loss out-of-sample)
    model_ids = ['m0_uniforme', 'm1_bayesiano', 'm2_ctw', 'm3_logreg', 'm4_jev', 'm5_ensamble']
    model_names = {
        'm0_uniforme': 'Baseline Uniforme (Azar)',
        'm1_bayesiano': 'Bayesiano Dirichlet (γ)',
        'm2_ctw': 'Markov CTW (Orden Variable)',
        'm3_logreg': 'Regresión Logística L2',
        'm4_jev': 'Contrarian / Equilibrio JEV',
        'm5_ensamble': 'Meta-Ensamble Hedge (IA)'
    }
    model_colors = {
        'm0_uniforme': '#94a3b8',
        'm1_bayesiano': '#38bdf8',
        'm2_ctw': '#a855f7',
        'm3_logreg': '#10b981',
        'm4_jev': '#f43f5e',
        'm5_ensamble': '#f59e0b'
    }

    # Pesos Hedge sobre los 5 modelos base (M0..M4) por posición y para signo
    hedge_log_w_pos = np.zeros((4, 5), dtype=np.float64)
    hedge_log_w_sign = np.zeros(5, dtype=np.float64)
    eta_hedge = 0.45

    # Acumuladores de métricas en ventana walk-forward [eval_start .. n-1]
    metrics = {
        mid: {
            'log_loss': 0.0,
            'brier': 0.0,
            'exact_hits': 0,
            'near_hits': 0,
            'exact_pos': [0, 0, 0, 0],
            'hits_2c': 0,
            'hits_3c': 0,
            'hits_4c': 0,
            'sign_hits': 0,
            'roi_payout_directo': 0.0,
            'roi_payout_todos': 0.0,
            'cost': 0.0
        }
        for mid in model_ids
    }

    uniform_p10 = np.full(10, 0.1, dtype=np.float64)
    uniform_p12 = np.full(12, 1.0 / 12.0, dtype=np.float64)

    def predict_step(t: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Retorna:
          probs_pos: shape (6, 4, 10) -> probabilidades por modelo, posición, dígito
          probs_sign: shape (6, 12)   -> probabilidades por modelo, signo
        """
        probs_pos = np.zeros((6, 4, 10), dtype=np.float64)
        probs_sign = np.zeros((6, 12), dtype=np.float64)

        # M0: Uniforme
        probs_pos[0] = uniform_p10
        probs_sign[0] = uniform_p12

        # M1: Bayesiano Dirichlet-Multinomial con decaimiento
        for p in range(4):
            num = bayes_pos[p] + (alpha_pos / 10.0)
            probs_pos[1, p] = num / np.sum(num)
        num_s = bayes_sign + (alpha_sign / 12.0)
        probs_sign[1] = num_s / np.sum(num_s)

        # M2: CTW / Markov de Orden Variable (L=0, 1, 2, 3)
        for p in range(4):
            p_l0 = probs_pos[1, p]
            if t >= 1:
                c1 = markov1[p, digits_mat[t - 1, p]]
                p_l1 = (c1 + 2.0) / (np.sum(c1) + 20.0)
            else:
                p_l1 = uniform_p10
            if t >= 2:
                idx2 = digits_mat[t - 2, p] * 10 + digits_mat[t - 1, p]
                c2 = markov2[p, idx2]
                p_l2 = (c2 + 1.5) / (np.sum(c2) + 15.0)
            else:
                p_l2 = p_l1
            if t >= 3:
                key3 = (int(digits_mat[t - 3, p]), int(digits_mat[t - 2, p]), int(digits_mat[t - 1, p]))
                c3 = markov3[p].get(key3)
                p_l3 = (c3 + 1.0) / (np.sum(c3) + 10.0) if c3 is not None else p_l2
            else:
                p_l3 = p_l2

            w_ctw = _softmax(ctw_log_w[p])
            probs_pos[2, p] = (
                w_ctw[0] * p_l0 + w_ctw[1] * p_l1 + w_ctw[2] * p_l2 + w_ctw[3] * p_l3
            )
            probs_pos[2, p] /= np.sum(probs_pos[2, p])

        if t >= 1:
            cs1 = markov_sign1[sign_idx[t - 1]]
            probs_sign[2] = (cs1 + 3.0) / (np.sum(cs1) + 36.0)
        else:
            probs_sign[2] = uniform_p12

        # M3: Regresión Logística Multinomial Online (L2)
        if t >= 2:
            feats = _extraer_features_paso(digits_mat, weekdays, t)
            for p in range(4):
                logits = logreg_W[p] @ feats
                probs_pos[3, p] = _softmax(logits)
        else:
            probs_pos[3] = uniform_p10
        probs_sign[3] = probs_sign[1]

        # M4: Contrarian / JEV (premia déficit histórico + atraso, con temperatura suave)
        if t >= 30:
            exp_p = t / 10.0
            for p in range(4):
                deficit = np.maximum(0.0, (exp_p - hist_pos[p]) / max(1.0, exp_p))
                atraso = np.where(last_seen_pos[p] >= 0, t - last_seen_pos[p], t) / 10.0
                score = 0.8 * deficit + 0.12 * np.minimum(atraso, 3.0)
                probs_pos[4, p] = _softmax(score)
            exp_s = t / 12.0
            def_s = np.maximum(0.0, (exp_s - hist_sign) / max(1.0, exp_s))
            atr_s = np.where(last_seen_sign >= 0, t - last_seen_sign, t) / 12.0
            probs_sign[4] = _softmax(0.8 * def_s + 0.12 * np.minimum(atr_s, 3.0))
        else:
            probs_pos[4] = uniform_p10
            probs_sign[4] = uniform_p12

        # M5: Meta-Ensamble Hedge (combinación convexa de M0..M4 por Log-Loss out-of-sample)
        for p in range(4):
            w_h = _softmax(hedge_log_w_pos[p])
            comb = np.tensordot(w_h, probs_pos[0:5, p], axes=(0, 0))
            probs_pos[5, p] = comb / np.sum(comb)
        w_hs = _softmax(hedge_log_w_sign)
        comb_s = np.tensordot(w_hs, probs_sign[0:5], axes=(0, 0))
        probs_sign[5] = comb_s / np.sum(comb_s)

        return probs_pos, probs_sign

    # Recorrido cronológico estricto t = 0 .. n-1
    # Entrenamos LogReg online desde los últimos ~2,500 sorteos para eficiencia + frescura
    logreg_start = max(2, n - 2500)
    hedge_warmup_start = max(50, eval_start - 150)

    for t in range(n):
        y_digs = digits_mat[t]
        y_sign = int(sign_idx[t])

        # Solo predecimos antes de actualizar cuando t >= hedge_warmup_start o t >= logreg_start
        need_eval = (t >= eval_start)
        need_hedge = (t >= hedge_warmup_start)
        need_logreg = (t >= logreg_start)

        if need_eval or need_hedge:
            probs_pos, probs_sign = predict_step(t)

            # Actualizar pesos CTW (profundidades L=0..3) con log-prob del dígito real
            if t >= 3:
                for p in range(4):
                    d_true = int(y_digs[p])
                    p_l0 = probs_pos[1, p, d_true]
                    c1 = markov1[p, digits_mat[t - 1, p]]
                    p_l1 = (c1[d_true] + 2.0) / (np.sum(c1) + 20.0)
                    idx2 = digits_mat[t - 2, p] * 10 + digits_mat[t - 1, p]
                    c2 = markov2[p, idx2]
                    p_l2 = (c2[d_true] + 1.5) / (np.sum(c2) + 15.0)
                    key3 = (int(digits_mat[t - 3, p]), int(digits_mat[t - 2, p]), int(digits_mat[t - 1, p]))
                    c3 = markov3[p].get(key3)
                    p_l3 = (c3[d_true] + 1.0) / (np.sum(c3) + 10.0) if c3 is not None else p_l2
                    ctw_log_w[p] = 0.995 * ctw_log_w[p] + np.log(np.clip([p_l0, p_l1, p_l2, p_l3], 1e-6, 1.0))

            # Actualizar pesos Hedge (estrictamente con error out-of-sample)
            for p in range(4):
                d_true = int(y_digs[p])
                ll_models = -np.log(np.clip(probs_pos[0:5, p, d_true], 1e-6, 1.0))
                hedge_log_w_pos[p] = 0.995 * hedge_log_w_pos[p] - eta_hedge * ll_models
            ll_sign = -np.log(np.clip(probs_sign[0:5, y_sign], 1e-6, 1.0))
            hedge_log_w_sign = 0.995 * hedge_log_w_sign - eta_hedge * ll_sign

            # Evaluar en ventana walk-forward oficial
            if need_eval:
                for m_idx, mid in enumerate(model_ids):
                    st = metrics[mid]
                    pred_d = [int(np.argmax(probs_pos[m_idx, p])) for p in range(4)]
                    pred_s = int(np.argmax(probs_sign[m_idx]))

                    # Log-loss y Brier score
                    for p in range(4):
                        d_true = int(y_digs[p])
                        p_vec = probs_pos[m_idx, p]
                        st['log_loss'] += -math.log(max(1e-6, float(p_vec[d_true])))
                        one_hot = np.zeros(10, dtype=np.float64)
                        one_hot[d_true] = 1.0
                        st['brier'] += float(np.sum((p_vec - one_hot) ** 2))

                        dist_c = min(abs(pred_d[p] - d_true), 10 - abs(pred_d[p] - d_true))
                        if dist_c == 0:
                            st['exact_hits'] += 1
                            st['exact_pos'][p] += 1
                        if dist_c <= 1:
                            st['near_hits'] += 1

                    match_2c = (pred_d[2] == int(y_digs[2]) and pred_d[3] == int(y_digs[3]))
                    match_3c = match_2c and (pred_d[1] == int(y_digs[1]))
                    match_4c = match_3c and (pred_d[0] == int(y_digs[0]))
                    match_sign = (pred_s == y_sign)

                    if match_2c:
                        st['hits_2c'] += 1
                    if match_3c:
                        st['hits_3c'] += 1
                    if match_4c:
                        st['hits_4c'] += 1
                    if match_sign:
                        st['sign_hits'] += 1

                    # Simulación ROI (apuesta fija de 1,000 COP por sorteo al pick #1 del modelo)
                    st['cost'] += 1000.0
                    # Premio directo (1 signo)
                    if match_sign:
                        if match_4c:
                            st['roi_payout_directo'] += 42000.0 * 1000.0
                        elif match_3c:
                            st['roi_payout_directo'] += 1000.0 * 1000.0
                        elif match_2c:
                            st['roi_payout_directo'] += 100.0 * 1000.0
                    # Premio TODOS (divide apuesta en 12 signos)
                    if match_4c:
                        st['roi_payout_todos'] += (42000.0 / 12.0) * 1000.0
                    elif match_3c:
                        st['roi_payout_todos'] += (1000.0 / 12.0) * 1000.0
                    elif match_2c:
                        st['roi_payout_todos'] += (100.0 / 12.0) * 1000.0

        # --- Actualización online de modelos con observación real t ---
        if need_logreg:
            feats = _extraer_features_paso(digits_mat, weekdays, t)
            for p in range(4):
                p_lr = _softmax(logreg_W[p] @ feats)
                grad_y = p_lr.copy()
                grad_y[y_digs[p]] -= 1.0
                # SGD con regularización L2 (sin penalizar sesgo col 0)
                logreg_W[p] -= lr * (np.outer(grad_y, feats) + l2_reg * logreg_W[p])

        # Bayesiano exponencial
        bayes_pos *= gamma
        bayes_sign *= gamma
        for p in range(4):
            d_t = int(y_digs[p])
            bayes_pos[p, d_t] += 1.0
            hist_pos[p, d_t] += 1.0
            last_seen_pos[p, d_t] = t
            if t >= 1:
                markov1[p, digits_mat[t - 1, p], d_t] += 1.0
            if t >= 2:
                idx2 = digits_mat[t - 2, p] * 10 + digits_mat[t - 1, p]
                markov2[p, idx2, d_t] += 1.0
            if t >= 3:
                key3 = (int(digits_mat[t - 3, p]), int(digits_mat[t - 2, p]), int(digits_mat[t - 1, p]))
                arr3 = markov3[p].get(key3)
                if arr3 is None:
                    arr3 = np.zeros(10, dtype=np.float64)
                    markov3[p][key3] = arr3
                arr3[d_t] += 1.0

        bayes_sign[y_sign] += 1.0
        hist_sign[y_sign] += 1.0
        last_seen_sign[y_sign] = t
        if t >= 1:
            markov_sign1[sign_idx[t - 1], y_sign] += 1.0

    # --- Predicción calibrada para el PRÓXIMO sorteo (t = n) ---
    next_probs_pos, next_probs_sign = predict_step(n)

    # Pesos finales del Meta-Ensamble (promedio sobre las 4 posiciones)
    hedge_weights_avg = np.mean([_softmax(hedge_log_w_pos[p]) for p in range(4)], axis=0)

    # Consolidar resultados del Arena
    total_digitos = eval_n * 4
    baseline_ll = math.log(10.0)
    arena_modelos = []

    for m_idx, mid in enumerate(model_ids):
        st = metrics[mid]
        ll_avg = st['log_loss'] / total_digitos
        brier_avg = st['brier'] / total_digitos
        exact_pct = (st['exact_hits'] / total_digitos) * 100.0
        near_pct = (st['near_hits'] / total_digitos) * 100.0
        sign_pct = (st['sign_hits'] / eval_n) * 100.0

        # Test binomial unilateral vs azar (10% exacto por dígito)
        std_bin = math.sqrt(total_digitos * 0.1 * 0.9)
        z_exact = (st['exact_hits'] - total_digitos * 0.1) / max(1e-9, std_bin)
        pval_exact = normal_one_sided_pvalue(z_exact)

        roi_dir = ((st['roi_payout_directo'] - st['cost']) / max(1.0, st['cost'])) * 100.0
        roi_tod = ((st['roi_payout_todos'] - st['cost']) / max(1.0, st['cost'])) * 100.0

        # Pick principal para próximo sorteo
        pick_digits = [int(np.argmax(next_probs_pos[m_idx, p])) for p in range(4)]
        pick_sign = SIGNOS_LISTA[int(np.argmax(next_probs_sign[m_idx]))]

        arena_modelos.append({
            'id': mid,
            'nombre': model_names[mid],
            'color': model_colors[mid],
            'log_loss': round(ll_avg, 4),
            'delta_ll_vs_azar': round((baseline_ll - ll_avg) * 1000.0, 2),  # positivo = mejor que azar (en milinats)
            'brier': round(brier_avg, 4),
            'exact_pct': round(exact_pct, 2),
            'near_pct': round(near_pct, 2),
            'exact_pos_pct': [round((x / eval_n) * 100.0, 1) for x in st['exact_pos']],
            'hits_2c': st['hits_2c'],
            'hits_3c': st['hits_3c'],
            'hits_4c': st['hits_4c'],
            'sign_pct': round(sign_pct, 2),
            'pvalue_vs_azar': round(pval_exact, 4),
            'roi_directo_pct': round(roi_dir, 1),
            'roi_todos_pct': round(roi_tod, 1),
            'peso_ensamble_pct': round(float(hedge_weights_avg[m_idx]) * 100.0, 1) if m_idx < 5 else 100.0,
            'next_pick': ''.join(str(d) for d in pick_digits),
            'next_signo': pick_sign
        })

    return {
        'eval_window': eval_n,
        'total_digitos_evaluados': total_digitos,
        'fecha_inicio_eval': fechas[eval_start],
        'fecha_fin_eval': fechas[-1],
        'modelos': arena_modelos,
        'ensamble_probs_pos': [[round(float(x), 5) for x in next_probs_pos[5, p]] for p in range(4)],
        'ensamble_probs_signo': [
            {'signo': SIGNOS_LISTA[i], 'prob': round(float(next_probs_sign[5, i]), 5)}
            for i in range(12)
        ],
        'bayes_probs_pos': [[round(float(x), 5) for x in next_probs_pos[1, p]] for p in range(4)],
        'next_probs_pos_raw': next_probs_pos[5],
        'next_probs_sign_raw': next_probs_sign[5]
    }


# ============================================================================
# 3. OPTIMIZADOR DE CARTERA DE 8 TICKETS (COVERING DESIGN + EV)
# ============================================================================

def optimizar_cartera_tickets(
    probs_pos: np.ndarray,
    probs_sign: np.ndarray,
    n_tickets: int = 8
) -> Dict[str, Any]:
    """
    Genera 2 carteras de N tickets usando las probabilidades calibradas del Meta-Ensamble:
      1. `diversificada`: Maximización submodular de cobertura (evita repetir terminales 2C
         y tríos 3C para maximizar probabilidad de recuperación de inversión por sorteo).
      2. `max_prob`: Top N por verosimilitud conjunta pura P(d1)*P(d2)*P(d3)*P(d4).
    Calcula Valor Esperado (EV) y probabilidad de acierto >=1 en 2C y 3C.
    """
    # Tomar top 4 dígitos por posición -> 256 candidatos
    top_d = [np.argsort(probs_pos[p])[::-1][:4] for p in range(4)]
    sign_order = np.argsort(probs_sign)[::-1]
    top_signos = [SIGNOS_LISTA[int(i)] for i in sign_order[:4]]
    top_sign_probs = [float(probs_sign[int(i)]) for i in sign_order[:4]]

    candidatos = []
    for d0 in top_d[0]:
        for d1 in top_d[1]:
            for d2 in top_d[2]:
                for d3 in top_d[3]:
                    p4 = float(probs_pos[0, d0] * probs_pos[1, d1] * probs_pos[2, d2] * probs_pos[3, d3])
                    p3 = float(probs_pos[1, d1] * probs_pos[2, d2] * probs_pos[3, d3])
                    p2 = float(probs_pos[2, d2] * probs_pos[3, d3])
                    num = f"{d0}{d1}{d2}{d3}"
                    candidatos.append({
                        'numero': num,
                        'digitos': [int(d0), int(d1), int(d2), int(d3)],
                        'p4': p4,
                        'p3': p3,
                        'p2': p2,
                        't2': num[2:4],
                        't3': num[1:4]
                    })

    candidatos.sort(key=lambda x: x['p4'], reverse=True)

    def enriquecer_cartera(seleccion: List[Dict[str, Any]], modo: str) -> Dict[str, Any]:
        tickets = []
        t2_vistos = {}
        t3_vistos = {}
        ev_directo_total = 0.0
        ev_todos_total = 0.0

        for idx, c in enumerate(seleccion):
            s_idx = idx % min(3, len(top_signos)) if modo == 'diversificada' else 0
            signo = top_signos[s_idx]
            ps = top_sign_probs[s_idx]

            # Esperanza matemática por cada $1,000 COP (Premios oficiales Super Astro)
            # 4C exacto: 42,000x | 3C exacto (no 4C): 1,000x | 2C exacto (no 3C): 100x
            p4_s = c['p4'] * ps
            p3_only_s = max(0.0, c['p3'] - c['p4']) * ps
            p2_only_s = max(0.0, c['p2'] - c['p3']) * ps
            ev_dir = (p4_s * 42000.0 + p3_only_s * 1000.0 + p2_only_s * 100.0) * 1000.0

            # Modalidad TODOS (divide por 12, pero acierta con cualquier signo -> ps_eff = 1)
            p4_t = c['p4']
            p3_only_t = max(0.0, c['p3'] - c['p4'])
            p2_only_t = max(0.0, c['p2'] - c['p3'])
            ev_tod = (p4_t * (42000.0 / 12.0) + p3_only_t * (1000.0 / 12.0) + p2_only_t * (100.0 / 12.0)) * 1000.0

            ev_directo_total += ev_dir
            ev_todos_total += ev_tod

            t2_vistos[c['t2']] = c['p2']
            t3_vistos[c['t3']] = c['p3']

            tickets.append({
                'rank': idx + 1,
                'numero': c['numero'],
                'signo': signo,
                'prob_4c_rel': round((c['p4'] / 0.0001) * 100.0, 1),  # 100% = base uniforme
                'prob_3c_pct': round(c['p3'] * 100.0, 3),
                'prob_2c_pct': round(c['p2'] * 100.0, 2),
                'ev_todos_por_1000': round(ev_tod, 0),
                'ev_directo_por_1000': round(ev_dir, 0),
                't2': c['t2'],
                't3': c['t3']
            })

        # Cobertura total de 2C y 3C (eventos disjuntos entre terminales distintas -> suma directa)
        cobertura_2c_pct = min(100.0, sum(t2_vistos.values()) * 100.0)
        cobertura_3c_pct = min(100.0, sum(t3_vistos.values()) * 100.0)
        costo_total = len(tickets) * 1000.0

        return {
            'modo': modo,
            'tickets': tickets,
            'terminales_2c_unicas': len(t2_vistos),
            'terminales_3c_unicas': len(t3_vistos),
            'cobertura_2c_pct': round(cobertura_2c_pct, 2),
            'cobertura_3c_pct': round(cobertura_3c_pct, 3),
            'costo_total_cop': int(costo_total),
            'ev_todos_total_cop': round(ev_todos_total, 0),
            'ev_todos_pct': round((ev_todos_total / max(1.0, costo_total)) * 100.0, 1),
            'ev_directo_total_cop': round(ev_directo_total, 0),
            'ev_directo_pct': round((ev_directo_total / max(1.0, costo_total)) * 100.0, 1)
        }

    # Cartera 1: Máxima verosimilitud pura
    sel_max = candidatos[:n_tickets]

    # Cartera 2: Cobertura submodular diversificada (maximiza ganancia marginal de 2C + 3C + 4C)
    sel_div = []
    used_t2 = set()
    used_t3 = set()
    used_nums = set()
    for _ in range(n_tickets):
        best_c = None
        best_gain = -1.0
        for c in candidatos:
            if c['numero'] in used_nums:
                continue
            # Valor marginal esperado (pesos proporcionales a premios de Super Astro)
            gain_4 = c['p4'] * 42000.0
            gain_3 = (c['p3'] * 1000.0) if c['t3'] not in used_t3 else 0.0
            gain_2 = (c['p2'] * 100.0) if c['t2'] not in used_t2 else 0.0
            total_gain = gain_4 + gain_3 + gain_2
            if total_gain > best_gain:
                best_gain = total_gain
                best_c = c
        if best_c is None:
            break
        sel_div.append(best_c)
        used_nums.add(best_c['numero'])
        used_t2.add(best_c['t2'])
        used_t3.add(best_c['t3'])

    return {
        'diversificada': enriquecer_cartera(sel_div, 'diversificada'),
        'max_prob': enriquecer_cartera(sel_max, 'max_prob'),
        'signos_top': [
            {'signo': SIGNOS_LISTA[int(i)], 'prob_pct': round(float(probs_sign[int(i)]) * 100.0, 2)}
            for i in sign_order[:6]
        ]
    }


# ============================================================================
# PUNTO DE ENTRADA PRINCIPAL
# ============================================================================

def ejecutar_analisis_cuantitativo(loteria: str = 'luna', eval_window: int = 300) -> Dict[str, Any]:
    """Ejecuta el pipeline cuantitativo completo con caché por firma del dataset en Supabase."""
    lot = loteria.lower() if loteria else 'luna'
    if lot not in ('luna', 'sol', 'combinados'):
        lot = 'luna'
    eval_win = max(50, min(1000, int(eval_window)))

    data, firma = _cargar_dataset_memoria()
    cache_key = (firma, lot, eval_win)
    if cache_key in _QUANT_CACHE:
        return _QUANT_CACHE[cache_key]

    crono = _construir_lista_cronologica(data, lot)
    if len(crono) < 60:
        return {'ok': False, 'error': 'Datos insuficientes para análisis cuantitativo (mínimo 60 sorteos).'}

    n = len(crono)
    digits_mat = np.array([r['d'] for r in crono], dtype=np.int32)
    sign_idx = np.array([normalize_sign_index(r.get('s', '')) for r in crono], dtype=np.int32)
    fechas = [r['f'] for r in crono]

    # 1. Auditoría Forense
    forense = analizar_forense(digits_mat, sign_idx, fechas, data)

    # 2. Arena Walk-Forward Out-of-Sample
    arena = ejecutar_arena_walk_forward(digits_mat, sign_idx, fechas, eval_window=eval_win)

    # 3. Optimizador de Cartera
    cartera = optimizar_cartera_tickets(
        arena['next_probs_pos_raw'],
        arena['next_probs_sign_raw'],
        n_tickets=8
    )

    # Semáforo honesto de Edge estadístico
    anomalias_fdr = sum(1 for p in forense['posiciones'] if p['anomalia_significativa'])
    if forense['signos']['anomalia_significativa']:
        anomalias_fdr += 1

    ensamble_row = next(m for m in arena['modelos'] if m['id'] == 'm5_ensamble')
    mejor_ll_delta = ensamble_row['delta_ll_vs_azar']
    pval_ens = ensamble_row['pvalue_vs_azar']

    if anomalias_fdr >= 1 and mejor_ll_delta > 2.0 and pval_ens < 0.05:
        edge_nivel = 'verde'
        edge_titulo = 'Sesgo Estadístico Detectado y Validado Out-of-Sample'
        edge_desc = (
            f'Se detectaron {anomalias_fdr} canal(es) con desviación FDR < 0.05 y el Meta-Ensamble '
            f'supera al azar fuera de muestra (+{mejor_ll_delta} milinats, p={pval_ens}).'
        )
    elif anomalias_fdr >= 1 or mejor_ll_delta > 0.5:
        edge_nivel = 'amarillo'
        edge_titulo = 'Señal Débil / En Observación (Posible Cambio de Régimen)'
        edge_desc = (
            f'Hay señales locales ({anomalias_fdr} alerta(s) FDR en ventana 1,000; '
            f'ΔLog-Loss={mejor_ll_delta:+.2f} milinats), pero aún insuficiente para garantizar EV positivo.'
        )
    else:
        edge_nivel = 'rojo'
        edge_titulo = 'Sin Ventaja Estadística Significativa (Proceso Cercano al Azar)'
        edge_desc = (
            'Las pruebas forenses (χ², FDR, Factor de Bayes) y el backtesting walk-forward indican '
            'comportamiento consistente con azar uniforme. El Meta-Ensamble se regula hacia el prior '
            'y la cartera prioriza cobertura diversificada 2C/3C para minimizar pérdida esperada.'
        )

    # Limpiar arrays numpy antes de serializar
    arena_clean = {k: v for k, v in arena.items() if not k.endswith('_raw')}

    resultado = {
        'ok': True,
        'loteria': lot,
        'total_sorteos': n,
        'ultimo_sorteo': crono[-1],
        'edge': {
            'nivel': edge_nivel,
            'titulo': edge_titulo,
            'descripcion': edge_desc,
            'anomalias_fdr': anomalias_fdr,
            'delta_ll_milinats': mejor_ll_delta,
            'pvalue_ensamble': pval_ens
        },
        'forense': forense,
        'arena': arena_clean,
        'cartera': cartera
    }

    # Mantener caché acotada
    if len(_QUANT_CACHE) > 12:
        _QUANT_CACHE.clear()
    _QUANT_CACHE[cache_key] = resultado
    return resultado


if __name__ == '__main__':
    res = ejecutar_analisis_cuantitativo('luna', 300)
    print("EDGE:", res['edge'])
    for m in res['arena']['modelos']:
        print(f"  {m['nombre']:28s} | LL={m['log_loss']:.4f} (Δ={m['delta_ll_vs_azar']:+5.2f}) | Exact={m['exact_pct']:5.2f}% | ±1={m['near_pct']:5.2f}% | 2C={m['hits_2c']} | ROI_todos={m['roi_todos_pct']:+6.1f}% | Next={m['next_pick']} {m['next_signo']}")
    print("CARTERA DIV:", res['cartera']['diversificada']['cobertura_2c_pct'], "% 2C,", [t['numero'] for t in res['cartera']['diversificada']['tickets']])
