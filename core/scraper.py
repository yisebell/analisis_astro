"""
Módulo scraper para actualizar resultados desde astroluna.co
Extrae sorteos recientes de Astro Sol y Astro Luna y los guarda en Supabase.
"""
import requests
from bs4 import BeautifulSoup
from typing import Dict, Any, List
from core.db import DB_CONFIG, normalizar_signo, insertar_sorteos

MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

URLS = {
    'sol': "https://www.astroluna.co/astro-sol",
    'luna': "https://www.astroluna.co/resultado"
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


def quitar_tildes(cadena: str) -> str:
    replacements = (
        ("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"),
        ("Á", "A"), ("É", "E"), ("Í", "I"), ("Ó", "O"), ("Ú", "U"),
    )
    for a, b in replacements:
        cadena = cadena.replace(a, b)
    return cadena


def devolver_mes(mes_nombre: str) -> str:
    try:
        mes = MESES.index(quitar_tildes(mes_nombre.strip().lower())) + 1
        return f"{mes:02d}"
    except ValueError:
        return "00"


def formatear_fecha(fecha_str: str) -> str:
    """Convierte 'sábado 07 noviembre 2026' a '2026-11-07'."""
    if not fecha_str or 'fecha' in fecha_str.lower():
        return ""
    parts = fecha_str.strip().split()
    if len(parts) >= 4:
        dia = f"{int(parts[1]):02d}"
        mes = devolver_mes(parts[2])
        anio = parts[3]
        if mes != "00" and anio.isdigit() and len(anio) == 4:
            return f"{anio}-{mes}-{dia}"
    return ""


def actualizar_loteria(tipo: str) -> Dict[str, Any]:
    """
    Descarga los resultados de la lotería especificada ('luna' o 'sol'),
    comprueba cuáles faltan en Supabase y los inserta de forma idempotente.
    """
    tipo = tipo.lower()
    if tipo not in DB_CONFIG:
        return {'ok': False, 'mensaje': f"Lotería inválida: {tipo}", 'insertados': 0}

    cfg = DB_CONFIG[tipo]
    url = URLS[tipo]

    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            return {'ok': False, 'mensaje': f"HTTP {res.status_code} al consultar {url}", 'insertados': 0}

        soup = BeautifulSoup(res.content, 'html.parser')
        tabla = soup.find('table', id='tabla-resultados')
        if not tabla:
            return {'ok': False, 'mensaje': "No se encontró la tabla de resultados en la página", 'insertados': 0}

        filas = tabla.find_all('tr')
        nuevos_items: List[Dict[str, str]] = []

        for tr in filas:
            cols = [td.get_text(strip=True) for td in tr.find_all('td')]
            if len(cols) >= 3:
                fecha_f = formatear_fecha(cols[0])
                numero = cols[1].strip()
                signo = normalizar_signo(cols[2])
                if fecha_f and len(numero) == 4 and numero.isdigit():
                    nuevos_items.append({
                        'fecha': fecha_f,
                        'numero': numero,
                        'signo': signo
                    })

        if not nuevos_items:
            return {'ok': True, 'mensaje': "No se encontraron filas con formato válido", 'insertados': 0}

        res_ins = insertar_sorteos(tipo, nuevos_items)
        insertados = res_ins.get('insertados', 0)

        return {
            'ok': True,
            'loteria': tipo,
            'insertados': insertados,
            'mensaje': f"Sincronización {cfg['display_name']}: {insertados} nuevos registros insertados.",
            'nuevos': res_ins.get('nuevos', [])
        }

    except Exception as e:
        return {'ok': False, 'mensaje': f"Error en scraping: {str(e)}", 'insertados': 0}


def actualizar_todas() -> Dict[str, Any]:
    """Actualiza Sol y Luna simultáneamente en Supabase."""
    res_luna = actualizar_loteria('luna')
    res_sol = actualizar_loteria('sol')
    return {
        'ok': res_luna.get('ok', False) and res_sol.get('ok', False),
        'luna': res_luna,
        'sol': res_sol,
        'total_insertados': res_luna.get('insertados', 0) + res_sol.get('insertados', 0)
    }


if __name__ == "__main__":
    print(actualizar_todas())
