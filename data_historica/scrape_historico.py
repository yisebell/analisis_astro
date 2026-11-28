"""
Extractor de registros históricos faltantes de Astro Sol y Astro Luna
desde la fuente oficial https://superastro.com.co/historico.php.

NO inserta nada en Supabase ni modifica la base de datos local.
Genera archivos CSV en data_historica/ listos para revisión manual.
"""
import csv
import datetime as dt
import json
import os
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Set, Tuple

import requests
from bs4 import BeautifulSoup

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_JSON = os.path.join(ROOT_DIR, "web", "data", "loteria_data.json")

URL_OFICIAL = "https://superastro.com.co/historico.php"
INICIO_OFICIAL = dt.date(2010, 6, 2)  # Primera fecha disponible en superastro.com.co/historico.php

SIGNOS_CANONICOS = {
    "aries": "Aries",
    "tauro": "Tauro",
    "geminis": "Geminis",
    "cancer": "Cancer",
    "leo": "Leo",
    "virgo": "Virgo",
    "libra": "Libra",
    "escorpion": "Escorpion",
    "escorpio": "Escorpion",
    "sagitario": "Sagitario",
    "capricornio": "Capricornio",
    "acuario": "Acuario",
    "piscis": "Piscis",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def normalizar_signo(raw: str) -> str:
    if not raw:
        return ""
    limpio = unicodedata.normalize("NFD", str(raw).strip())
    sin_tildes = "".join(ch for ch in limpio if unicodedata.category(ch) != "Mn")
    clave = sin_tildes.lower().strip()
    return SIGNOS_CANONICOS.get(clave, sin_tildes.strip().title())


def cargar_fechas_existentes() -> Dict[str, Tuple[Set[str], dt.date, dt.date]]:
    with open(DATA_JSON, encoding="utf-8") as fh:
        data = json.load(fh)
    out = {}
    for lot in ("luna", "sol"):
        fechas = {row["f"] for row in data.get(lot, []) if row.get("f")}
        min_f = dt.date.fromisoformat(min(fechas))
        max_f = dt.date.fromisoformat(max(fechas))
        out[lot] = (fechas, min_f, max_f)
    return out


def consultar_fecha(session: requests.Session, lot: str, fecha_iso: str) -> Optional[Dict[str, str]]:
    field = "fecha_sol" if lot == "sol" else "fecha_luna"
    table_idx = 0 if lot == "sol" else 1
    for intento in range(3):
        try:
            r = session.post(URL_OFICIAL, data={field: fecha_iso}, timeout=15)
            if r.status_code != 200:
                time.sleep(0.5 * (intento + 1))
                continue
            r.encoding = "utf-8"
            soup = BeautifulSoup(r.text, "html.parser")
            tables = soup.find_all("table")
            if len(tables) <= table_idx:
                return None
            for tr in tables[table_idx].find_all("tr")[1:]:
                cols = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
                if len(cols) >= 3 and cols[0] == fecha_iso:
                    numero = cols[1].strip().zfill(4)
                    signo = normalizar_signo(cols[2])
                    sorteo = cols[3].strip() if len(cols) >= 4 else ""
                    if len(numero) == 4 and numero.isdigit() and signo:
                        return {
                            "loteria": lot,
                            "fecha": fecha_iso,
                            "numero": numero,
                            "signo": signo,
                            "sorteo": sorteo,
                            "fuente": "superastro.com.co/historico.php",
                        }
            return None
        except Exception:
            time.sleep(0.6 * (intento + 1))
    return None


def generar_fechas_objetivo(lot: str, existentes: Set[str], min_f: dt.date, max_f: dt.date) -> List[Tuple[str, str]]:
    """
    Devuelve lista de (fecha_iso, categoria) a consultar:
    - 'anterior_inicio': fechas desde INICIO_OFICIAL hasta min_f - 1
    - 'hueco_interno': fechas entre max(INICIO_OFICIAL, min_f) y max_f que faltan en existentes.
      Para Sol se omiten domingos porque Astro Sol históricamente juega lunes a sábado (excepto algún festivo/especial);
      para fechas anteriores a min_f de Sol consultamos todos los días para no perder ninguno.
    """
    objetivos: List[Tuple[str, str]] = []
    cur = INICIO_OFICIAL
    while cur <= max_f:
        iso = cur.isoformat()
        if iso not in existentes:
            if cur < min_f:
                objetivos.append((iso, "anterior_inicio"))
            else:
                # En Sol, los domingos no hay sorteo normalmente (weekday 6)
                if lot == "sol" and cur.weekday() == 6:
                    cur += dt.timedelta(days=1)
                    continue
                # En pandemia (2020-03-25..2020-04-27) los sorteos estuvieron suspendidos por decreto;
                # igualmente la consulta oficial confirmará si hubo o no sorteo.
                objetivos.append((iso, "hueco_interno"))
        cur += dt.timedelta(days=1)
    return objetivos


def recolectar_loteria(lot: str, objetivos: List[Tuple[str, str]], max_workers: int = 4) -> List[Dict[str, str]]:
    print(f"[{lot.upper()}] Consultando {len(objetivos)} fechas faltantes en superastro.com.co...")
    resultados: List[Dict[str, str]] = []
    cat_map = dict(objetivos)

    def worker(fechas_chunk: List[str]) -> List[Dict[str, str]]:
        sess = requests.Session()
        sess.headers.update(HEADERS)
        encontrados = []
        for f_iso in fechas_chunk:
            rec = consultar_fecha(sess, lot, f_iso)
            if rec:
                rec["categoria"] = cat_map[f_iso]
                encontrados.append(rec)
            time.sleep(0.08)
        return encontrados

    # Dividir en chunks para reutilizar sesiones HTTP
    fechas_solo = [f for f, _ in objetivos]
    chunks = [fechas_solo[i::max_workers] for i in range(max_workers)]
    chunks = [c for c in chunks if c]

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futs = [pool.submit(worker, c) for c in chunks]
        for fut in as_completed(futs):
            resultados.extend(fut.result())

    # Deduplicar y ordenar cronológicamente
    por_fecha = {r["fecha"]: r for r in resultados}
    ordenados = [por_fecha[f] for f in sorted(por_fecha.keys())]
    print(f"[{lot.upper()}] Encontrados {len(ordenados)} registros oficiales faltantes.")
    return ordenados


def guardar_csv(path: str, rows: List[Dict[str, str]]) -> None:
    campos = ["loteria", "fecha", "numero", "signo", "sorteo", "categoria", "fuente"]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=campos)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in campos})


def main():
    existentes_info = cargar_fechas_existentes()
    resumen = {}
    for lot in ("sol", "luna"):
        existentes, min_f, max_f = existentes_info[lot]
        objetivos = generar_fechas_objetivo(lot, existentes, min_f, max_f)
        print(f"{lot.upper()}: existentes={len(existentes)} ({min_f}..{max_f}), objetivos={len(objetivos)}")
        encontrados = recolectar_loteria(lot, objetivos, max_workers=4)
        out_csv = os.path.join(OUT_DIR, f"historico_faltante_{lot}.csv")
        guardar_csv(out_csv, encontrados)
        ant = [r for r in encontrados if r["categoria"] == "anterior_inicio"]
        hue = [r for r in encontrados if r["categoria"] == "hueco_interno"]
        resumen[lot] = {
            "consultadas": len(objetivos),
            "encontrados": len(encontrados),
            "anteriores": len(ant),
            "huecos": len(hue),
            "min_encontrada": encontrados[0]["fecha"] if encontrados else None,
            "max_encontrada": encontrados[-1]["fecha"] if encontrados else None,
            "csv": out_csv,
        }
    print("\n=== RESUMEN FINAL ===")
    print(json.dumps(resumen, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
