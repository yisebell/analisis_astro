"""
Módulo de construcción y caché del dataset para el Dashboard Web.
Transforma los resultados históricos de Supabase en el formato compacto esperado
por el navegador web (con pre-cálculo de distancias y diferencias) directamente en memoria.
"""
import os
import json
import datetime
import threading
from typing import List, Dict, Any, Optional, Tuple
from core.db import (
    obtener_resultados,
    normalizar_signo,
    get_cache_version,
    LISTA_DEFAULT_NUMEROS,
)

_DATASET_LOCK = threading.Lock()
_DATASET_CACHE: Optional[Tuple[int, Dict[str, Any], bytes]] = None


def calcular_metricas_sorteos(sorteos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Toma una lista de sorteos ordenados descendentemente por fecha
    y calcula las diferencias aritméticas y distancias mínimas modulares
    respecto al sorteo inmediatamente anterior (índice i + 1).
    """
    total = len(sorteos)
    enriquecidos = []

    for i in range(total):
        curr = sorteos[i]
        num_str = str(curr.get('numero', '')).zfill(4)
        d = [int(c) for c in num_str]

        anterior = None
        curr_lot = curr.get('loteria')
        for j in range(i + 1, total):
            if curr_lot is None or sorteos[j].get('loteria') == curr_lot:
                anterior = sorteos[j]
                break

        calcs = [0, 0, 0, 0]
        dists = [0, 0, 0, 0]

        if anterior:
            ant_num_str = str(anterior.get('numero', '')).zfill(4)
            ant_d = [int(c) for c in ant_num_str]

            # 1. Calc_Digito (Diferencias base 10 con ajuste)
            for k in range(4):
                if d[k] >= ant_d[k]:
                    calcs[k] = d[k] - ant_d[k]
                else:
                    calcs[k] = abs((ant_d[k] - 10) - d[k])

            # 2. Distancias mínimas modulares (0 a 5)
            for k in range(4):
                diff = abs(d[k] - ant_d[k])
                dists[k] = min(diff, 10 - diff)

        dist_b10 = "".join(str(c) for c in calcs)

        enriquecidos.append({
            'f': curr['fecha'],
            'n': num_str,
            's': normalizar_signo(curr.get('signo', '')),
            'l': curr.get('loteria', ''),
            'd': d,
            'c': calcs,
            'dist': dists,
            'db10': dist_b10
        })

    return enriquecidos


def construir_dataset_memoria(forzar: bool = False) -> Tuple[Dict[str, Any], bytes, str]:
    """
    Construye (o devuelve desde caché en memoria) el payload compacto JSON y su firma.
    Evita escritura en disco para despliegue cloud seguro y sin estado.
    """
    global _DATASET_CACHE
    version_actual = get_cache_version()

    with _DATASET_LOCK:
        if not forzar and _DATASET_CACHE is not None and _DATASET_CACHE[0] == version_actual:
            _, payload, raw_bytes = _DATASET_CACHE
            firma = _firma_dataset(payload)
            return payload, raw_bytes, firma

    luna_raw = obtener_resultados('luna', usar_cache=not forzar)
    sol_raw = obtener_resultados('sol', usar_cache=not forzar)

    luna_enriquecida = calcular_metricas_sorteos(luna_raw)
    sol_enriquecida = calcular_metricas_sorteos(sol_raw)

    ahora = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    payload = {
        'metadata': {
            'generado_el': ahora,
            'total_luna': len(luna_enriquecida),
            'total_sol': len(sol_enriquecida),
            'total_combinados': len(luna_enriquecida) + len(sol_enriquecida),
            'ultimo_luna': luna_enriquecida[0] if luna_enriquecida else None,
            'ultimo_sol': sol_enriquecida[0] if sol_enriquecida else None,
            'lista_default': list(LISTA_DEFAULT_NUMEROS)
        },
        'luna': luna_enriquecida,
        'sol': sol_enriquecida
    }

    raw_bytes = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    firma = _firma_dataset(payload)

    with _DATASET_LOCK:
        _DATASET_CACHE = (get_cache_version(), payload, raw_bytes)

    return payload, raw_bytes, firma


def _firma_dataset(payload: Dict[str, Any]) -> str:
    meta = payload.get('metadata', {})
    ult_l = (meta.get('ultimo_luna') or {}).get('f', '')
    ult_s = (meta.get('ultimo_sol') or {}).get('f', '')
    return f"{meta.get('total_luna', 0)}:{ult_l}|{meta.get('total_sol', 0)}:{ult_s}"


def exportar_dataset(dest_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Exportación opcional a disco (`loteria_data.json` y `loteria_data.js`) para uso offline local.
    """
    if dest_dir is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        dest_dir = os.path.join(base_dir, "web", "data")

    os.makedirs(dest_dir, exist_ok=True)
    payload, raw_bytes, _ = construir_dataset_memoria(forzar=True)

    json_path = os.path.join(dest_dir, "loteria_data.json")
    with open(json_path, 'wb') as f:
        f.write(raw_bytes)

    js_path = os.path.join(dest_dir, "loteria_data.js")
    with open(js_path, 'wb') as f:
        f.write(b"window.LOTERIA_DATA=")
        f.write(raw_bytes)
        f.write(b";\n")

    peso_kb = round(len(raw_bytes) / 1024, 1)
    return {
        'ok': True,
        'json_path': json_path,
        'js_path': js_path,
        'peso_kb': peso_kb,
        'metadata': payload['metadata']
    }
