"""
Script de migración única (idempotente) de resultados históricos hacia Supabase.
Lee desde web/data/loteria_data.json (rápido y sin requerir MongoDB activo) o desde MongoDB local
si se pasa --source mongo, y sube todos los registros en lotes usando upsert sobre (loteria, fecha).

Uso:
    python scripts/migrar_a_supabase.py
    python scripts/migrar_a_supabase.py --source mongo
"""
import argparse
import json
import os
import sys
from typing import Dict, List

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from dotenv import load_dotenv
load_dotenv()

from core.db import get_client, get_status, normalizar_signo


def cargar_desde_json(json_path: str) -> Dict[str, List[Dict[str, str]]]:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    salida = {"luna": [], "sol": []}
    for lot in ("luna", "sol"):
        for item in data.get(lot, []):
            fecha = str(item.get("f", "")).strip()
            numero = str(item.get("n", "")).strip().zfill(4)
            signo = normalizar_signo(item.get("s", ""))
            if fecha and len(numero) == 4 and numero.isdigit():
                salida[lot].append({
                    "loteria": lot,
                    "fecha": fecha,
                    "numero": numero,
                    "signo": signo,
                })
    return salida


def cargar_desde_mongo() -> Dict[str, List[Dict[str, str]]]:
    import pymongo
    client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=3000)
    salida = {"luna": [], "sol": []}
    mapa = {"luna": "loteria_astro_luna", "sol": "loteria_astro_sol"}
    for lot, db_name in mapa.items():
        for doc in client[db_name]["resultados"].find({}, {"_id": 0}):
            fecha = str(doc.get("fecha", "")).strip()
            numero = str(doc.get("numero", "")).strip().zfill(4)
            signo = normalizar_signo(doc.get("signo", ""))
            if fecha and len(numero) == 4 and numero.isdigit():
                salida[lot].append({
                    "loteria": lot,
                    "fecha": fecha,
                    "numero": numero,
                    "signo": signo,
                })
    client.close()
    return salida


def subir_lotes(registros: Dict[str, List[Dict[str, str]]], batch_size: int = 500):
    client = get_client()
    for lot in ("luna", "sol"):
        # Deduplicar por fecha conservando orden cronológico ascendente
        dedup = {r["fecha"]: r for r in registros[lot]}
        filas = [dedup[f] for f in sorted(dedup.keys())]
        total = len(filas)
        print(f"Subiendo {total} sorteos de Astro {lot.title()} en lotes de {batch_size}...")

        for i in range(0, total, batch_size):
            lote = filas[i:i + batch_size]
            client.table("sorteos").upsert(
                lote,
                on_conflict="loteria,fecha",
                ignore_duplicates=True,
            ).execute()
            procesados = min(i + batch_size, total)
            print(f"  -> {lot}: {procesados}/{total}")


def main():
    parser = argparse.ArgumentParser(description="Migrar históricos de Astro Luna/Sol a Supabase.")
    parser.add_argument(
        "--source",
        choices=["json", "mongo"],
        default="json",
        help="Origen de los datos (por defecto: web/data/loteria_data.json)",
    )
    parser.add_argument("--batch-size", type=int, default=500)
    args = parser.parse_args()

    if args.source == "mongo":
        datos = cargar_desde_mongo()
    else:
        json_path = os.path.join(ROOT_DIR, "web", "data", "loteria_data.json")
        if not os.path.exists(json_path):
            raise FileNotFoundError(f"No se encontró {json_path}. Usa --source mongo.")
        datos = cargar_desde_json(json_path)

    print(f"Leídos {len(datos['luna'])} sorteos Luna y {len(datos['sol'])} sorteos Sol.")
    subir_lotes(datos, batch_size=args.batch_size)

    estado = get_status()
    print("\nEstado final en Supabase:")
    print(json.dumps(estado, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
