"""
Módulo de base de datos para Lotería Astro (Sol y Luna) usando Supabase (PostgreSQL).
Gestiona el cliente singleton de servidor, paginación automática (>1,000 filas),
upsert idempotente, caché en memoria y listas de apuestas por usuario.
"""
import os
import threading
import unicodedata
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

DB_CONFIG = {
    'luna': {
        'loteria': 'luna',
        'display_name': 'Astro Luna'
    },
    'sol': {
        'loteria': 'sol',
        'display_name': 'Astro Sol'
    }
}

SIGNOS_CANONICOS = {
    'aries': 'Aries',
    'tauro': 'Tauro',
    'geminis': 'Geminis',
    'cancer': 'Cancer',
    'leo': 'Leo',
    'virgo': 'Virgo',
    'libra': 'Libra',
    'escorpion': 'Escorpion',
    'escorpio': 'Escorpion',
    'sagitario': 'Sagitario',
    'capricornio': 'Capricornio',
    'acuario': 'Acuario',
    'piscis': 'Piscis',
}

LISTA_DEFAULT_NUMEROS = [
    "0859", "0539", "8370", "3614", "5842", "4874", "0610", "7147", "5173",
    "9105", "0517", "1051", "9032", "8344", "3502", "8071", "1793", "8428",
    "0470", "4104", "8621", "9159", "9684", "0542", "6868", "6435", "8450",
    "8318", "8737", "0802", "0208", "5637", "9580", "8624", "8122", "0869",
    "5341", "5340", "8047", "8078", "8362", "8363", "8155", "2645"
]

_CLIENT_LOCK = threading.Lock()
_CACHE_LOCK = threading.Lock()
_SERVICE_CLIENT: Optional[Client] = None
_CACHE_VERSION: int = 1
_RESULTADOS_CACHE: Dict[Tuple[str, Optional[str]], List[Dict[str, Any]]] = {}


def normalizar_signo(signo: Optional[str]) -> str:
    """Normaliza tildes, espacios y capitalización de un signo zodiacal."""
    if not signo:
        return ''
    limpio = unicodedata.normalize('NFD', str(signo).strip())
    sin_tildes = ''.join(ch for ch in limpio if unicodedata.category(ch) != 'Mn')
    clave = sin_tildes.lower().strip()
    return SIGNOS_CANONICOS.get(clave, sin_tildes.strip().title())


def get_supabase_url() -> str:
    return (os.getenv("SUPABASE_URL") or "").strip()


def get_supabase_publishable_key() -> str:
    return (
        os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()


def get_supabase_secret_key() -> str:
    return (
        os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    ).strip()


def get_client() -> Client:
    """Devuelve el cliente singleton de Supabase con clave de servidor (secret/service_role)."""
    global _SERVICE_CLIENT
    with _CLIENT_LOCK:
        if _SERVICE_CLIENT is None:
            url = get_supabase_url()
            key = get_supabase_secret_key()
            if not url or not key:
                raise RuntimeError(
                    "Faltan variables de entorno SUPABASE_URL y SUPABASE_SECRET_KEY "
                    "(o SUPABASE_SERVICE_ROLE_KEY)."
                )
            _SERVICE_CLIENT = create_client(url, key)
        return _SERVICE_CLIENT


def get_cache_version() -> int:
    return _CACHE_VERSION


def invalidar_cache() -> None:
    """Limpia la caché de resultados en memoria tras insertar o modificar sorteos."""
    global _CACHE_VERSION
    with _CACHE_LOCK:
        _RESULTADOS_CACHE.clear()
        _CACHE_VERSION += 1


def _fetch_all_rows(loteria: str, fecha_min: Optional[str] = None, page_size: int = 1000) -> List[Dict[str, Any]]:
    """Pagina automáticamente sobre PostgREST para traer todos los sorteos sin límite de 1,000 filas."""
    client = get_client()
    registros: List[Dict[str, Any]] = []
    start = 0

    while True:
        query = (
            client.table("sorteos")
            .select("fecha,numero,signo,loteria")
            .eq("loteria", loteria)
            .order("fecha", desc=True)
            .range(start, start + page_size - 1)
        )
        if fecha_min:
            query = query.gte("fecha", fecha_min)

        resp = query.execute()
        lote = resp.data or []
        if not lote:
            break

        for row in lote:
            registros.append({
                "fecha": str(row["fecha"]),
                "numero": str(row["numero"]).strip().zfill(4),
                "signo": normalizar_signo(row.get("signo", "")),
                "loteria": loteria,
            })

        if len(lote) < page_size:
            break
        start += page_size

    return registros


def obtener_resultados(tipo: str = 'luna', fecha_min: Optional[str] = None, usar_cache: bool = True) -> List[Dict[str, Any]]:
    """
    Obtiene los resultados de la lotería especificada ('luna', 'sol', o 'combinados')
    ordenados cronológicamente descendente (más reciente primero).
    """
    tipo = tipo.lower()

    if tipo in ('luna', 'sol'):
        cache_key = (tipo, fecha_min)
        if usar_cache:
            with _CACHE_LOCK:
                if cache_key in _RESULTADOS_CACHE:
                    return list(_RESULTADOS_CACHE[cache_key])

        registros = _fetch_all_rows(tipo, fecha_min=fecha_min)
        if usar_cache:
            with _CACHE_LOCK:
                _RESULTADOS_CACHE[cache_key] = registros
        return list(registros)

    if tipo in ('combinado', 'combinados', 'ambos'):
        luna = obtener_resultados('luna', fecha_min, usar_cache=usar_cache)
        sol = obtener_resultados('sol', fecha_min, usar_cache=usar_cache)
        todos = luna + sol
        todos.sort(key=lambda r: (r['fecha'], 2 if r['loteria'] == 'luna' else 1), reverse=True)
        return todos

    raise ValueError(f"Tipo de lotería no reconocido: {tipo}")


def insertar_sorteos(tipo: str, items: List[Dict[str, str]], batch_size: int = 500) -> Dict[str, Any]:
    """
    Inserta sorteos en Supabase de forma idempotente (ignora fechas ya existentes).
    Retorna cuántos registros nuevos se insertaron realmente.
    """
    tipo = tipo.lower()
    if tipo not in DB_CONFIG:
        raise ValueError(f"Lotería inválida: {tipo}")
    if not items:
        return {"insertados": 0, "nuevos": []}

    client = get_client()

    # Deduplicar por fecha dentro del mismo lote
    por_fecha: Dict[str, Dict[str, str]] = {}
    for item in items:
        fecha = str(item.get("fecha", "")).strip()
        numero = str(item.get("numero", "")).strip().zfill(4)
        signo = normalizar_signo(item.get("signo", ""))
        if fecha and len(numero) == 4 and numero.isdigit():
            por_fecha[fecha] = {
                "loteria": tipo,
                "fecha": fecha,
                "numero": numero,
                "signo": signo,
            }

    if not por_fecha:
        return {"insertados": 0, "nuevos": []}

    fechas = list(por_fecha.keys())
    existentes = set()
    for i in range(0, len(fechas), 200):
        chunk_fechas = fechas[i:i + 200]
        resp = (
            client.table("sorteos")
            .select("fecha")
            .eq("loteria", tipo)
            .in_("fecha", chunk_fechas)
            .execute()
        )
        for row in (resp.data or []):
            existentes.add(str(row["fecha"]))

    a_insertar = [por_fecha[f] for f in sorted(por_fecha.keys()) if f not in existentes]
    if not a_insertar:
        return {"insertados": 0, "nuevos": []}

    for i in range(0, len(a_insertar), batch_size):
        lote = a_insertar[i:i + batch_size]
        client.table("sorteos").upsert(
            lote,
            on_conflict="loteria,fecha",
            ignore_duplicates=True,
        ).execute()

    invalidar_cache()
    return {"insertados": len(a_insertar), "nuevos": a_insertar}


def get_status() -> Dict[str, Any]:
    """Retorna el estado de conexión a Supabase y métricas de Luna y Sol."""
    try:
        client = get_client()
        estado: Dict[str, Any] = {
            'conectado': True,
            'motor': 'supabase',
            'loterias': {}
        }

        for k, cfg in DB_CONFIG.items():
            count_resp = (
                client.table("sorteos")
                .select("id", count="exact")
                .eq("loteria", k)
                .limit(1)
                .execute()
            )
            total = count_resp.count or 0

            latest_resp = (
                client.table("sorteos")
                .select("fecha,numero,signo")
                .eq("loteria", k)
                .order("fecha", desc=True)
                .limit(1)
                .execute()
            )
            oldest_resp = (
                client.table("sorteos")
                .select("fecha,numero,signo")
                .eq("loteria", k)
                .order("fecha", desc=False)
                .limit(1)
                .execute()
            )

            latest = latest_resp.data[0] if latest_resp.data else None
            oldest = oldest_resp.data[0] if oldest_resp.data else None
            if latest and 'signo' in latest:
                latest['signo'] = normalizar_signo(latest['signo'])
            if oldest and 'signo' in oldest:
                oldest['signo'] = normalizar_signo(oldest['signo'])

            estado['loterias'][k] = {
                'nombre': cfg['display_name'],
                'total': total,
                'ultimo': latest,
                'primero': oldest
            }

        return estado
    except Exception as e:
        return {
            'conectado': False,
            'motor': 'supabase',
            'error': str(e),
            'loterias': {}
        }


def obtener_perfil_usuario(user_id: str) -> Optional[Dict[str, Any]]:
    """Consulta el perfil (rol y estado activo) del usuario en public.profiles."""
    client = get_client()
    resp = (
        client.table("profiles")
        .select("id,email,role,active")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]
    return None


def obtener_lista_usuario(user_id: str, nombre: str = "Principal") -> List[str]:
    """Obtiene la lista personalizada guardada por el usuario o la predeterminada."""
    client = get_client()
    resp = (
        client.table("listas_usuario")
        .select("numeros")
        .eq("user_id", user_id)
        .eq("nombre", nombre)
        .limit(1)
        .execute()
    )
    if resp.data and resp.data[0].get("numeros"):
        return list(resp.data[0]["numeros"])
    return list(LISTA_DEFAULT_NUMEROS)


def guardar_lista_usuario(user_id: str, numeros: List[str], nombre: str = "Principal") -> List[str]:
    """Guarda/actualiza la lista de números de 4 cifras del usuario en Supabase."""
    limpios: List[str] = []
    vistos = set()
    for n in numeros:
        val = str(n).strip()
        if len(val) == 4 and val.isdigit() and val not in vistos:
            vistos.add(val)
            limpios.append(val)

    client = get_client()
    client.table("listas_usuario").upsert(
        {
            "user_id": user_id,
            "nombre": nombre,
            "numeros": limpios,
        },
        on_conflict="user_id,nombre",
    ).execute()
    return limpios
