"""
Servidor de producción FastAPI para Astro Analytics Pro.
- Respaldado por Supabase (PostgreSQL + Auth + RLS)
- Todos los endpoints de datos y acciones exigen JWT válido de Supabase
- Compresión GZIP, cabeceras de seguridad HTTP, CORS estricto y Rate Limiting
- Sirve la SPA estática desde /web
"""
import os
import json
import datetime
from typing import List
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from api.security import (
    AuthenticatedUser,
    require_active_user,
    require_admin_user,
    verify_cron_secret,
)
from core.data_exporter import construir_dataset_memoria
from core.db import (
    get_status,
    get_supabase_publishable_key,
    get_supabase_url,
    guardar_lista_usuario,
    obtener_lista_usuario,
)
from core.export_excel import generar_excel_bytes
from core.quant_engine import ejecutar_analisis_cuantitativo
from core.scraper import actualizar_todas

load_dotenv()

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(ROOT_DIR, "web")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Astro Analytics Pro API",
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS estricto (normaliza barras finales para evitar fallos por URLs como https://app.onrender.com/)
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000")
allowed_origins = [o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Cron-Secret"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response


class ListaUsuarioPayload(BaseModel):
    numeros: List[str] = Field(default_factory=list, max_length=2000)


# =============================================================================
# ENDPOINTS PÚBLICOS MÍNIMOS (SIN DATOS PRIVADOS)
# =============================================================================

@app.get("/health")
def health_check():
    return {"ok": True, "service": "astro-analytics-pro"}


@app.get("/api/config")
def public_auth_config():
    """Entrega únicamente la URL pública y la publishable key para inicializar Supabase Auth en el navegador."""
    return {
        "supabaseUrl": get_supabase_url(),
        "supabaseKey": get_supabase_publishable_key(),
    }


# =============================================================================
# ENDPOINTS PROTEGIDOS (EXIGEN SESIÓN ACTIVA DE SUPABASE AUTH)
# =============================================================================

@app.get("/api/me")
def get_current_user_info(user: AuthenticatedUser = Depends(require_active_user)):
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "active": user.active,
    }


@app.get("/api/status")
def api_status(user: AuthenticatedUser = Depends(require_active_user)):
    return get_status()


@app.get("/api/datos")
@limiter.limit("30/minute")
def api_datos(
    request: Request,
    user: AuthenticatedUser = Depends(require_active_user),
):
    _, raw_bytes, _ = construir_dataset_memoria()
    return Response(content=raw_bytes, media_type="application/json; charset=utf-8")


def _json_default(obj):
    if hasattr(obj, "item"):
        return obj.item()
    return str(obj)


@app.get("/api/quant")
@limiter.limit("20/minute")
def api_quant(
    request: Request,
    loteria: str = Query(default="luna", pattern="^(luna|sol|combinados)$"),
    window: int = Query(default=300, ge=50, le=1000),
    user: AuthenticatedUser = Depends(require_active_user),
):
    resultado = ejecutar_analisis_cuantitativo(loteria=loteria, eval_window=window)
    raw = json.dumps(resultado, default=_json_default, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return Response(content=raw, media_type="application/json; charset=utf-8")


@app.get("/api/lista_usuario")
def api_get_lista_usuario(user: AuthenticatedUser = Depends(require_active_user)):
    numeros = obtener_lista_usuario(user.id)
    return {"ok": True, "numeros": numeros}


@app.put("/api/lista_usuario")
@limiter.limit("30/minute")
def api_put_lista_usuario(
    request: Request,
    payload: ListaUsuarioPayload,
    user: AuthenticatedUser = Depends(require_active_user),
):
    guardados = guardar_lista_usuario(user.id, payload.numeros)
    return {"ok": True, "numeros": guardados, "total": len(guardados)}


@app.get("/api/exportar_excel")
@limiter.limit("10/minute")
def api_exportar_excel(
    request: Request,
    loteria: str = Query(default="all", pattern="^(all|luna|sol|combinados)$"),
    user: AuthenticatedUser = Depends(require_active_user),
):
    xlsx_bytes = generar_excel_bytes(loteria=loteria)
    fecha = datetime.date.today().isoformat()
    filename = f"astro_resultados_{loteria}_{fecha}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =============================================================================
# ENDPOINTS PRIVILEGIADOS (SOLO ADMIN O CRON SECRET)
# =============================================================================

@app.post("/api/actualizar")
@limiter.limit("2/minute")
def api_actualizar(
    request: Request,
    admin: AuthenticatedUser = Depends(require_admin_user),
):
    res_sc = actualizar_todas()
    payload, _, _ = construir_dataset_memoria(forzar=True)
    return {
        "ok": res_sc.get("ok", False),
        "resultado": res_sc,
        "metadata": payload.get("metadata"),
    }


@app.post("/api/cron/sync")
@limiter.limit("5/minute")
def api_cron_sync(
    request: Request,
    _: bool = Depends(verify_cron_secret),
):
    res_sc = actualizar_todas()
    payload, _, _ = construir_dataset_memoria(forzar=True)
    return {
        "ok": res_sc.get("ok", False),
        "total_insertados": res_sc.get("total_insertados", 0),
        "metadata": {
            "total_luna": payload["metadata"]["total_luna"],
            "total_sol": payload["metadata"]["total_sol"],
            "generado_el": payload["metadata"]["generado_el"],
        },
    }


# =============================================================================
# ARCHIVOS ESTÁTICOS DE LA SPA (SIN EXPONER ARCHIVOS LEGACY NI /data)
# =============================================================================

app.mount("/css", StaticFiles(directory=os.path.join(WEB_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(WEB_DIR, "js")), name="js")


@app.get("/favicon.ico", include_in_schema=False)
def serve_favicon_ico():
    return FileResponse(
        os.path.join(WEB_DIR, "favicon.ico"),
        media_type="image/x-icon",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/favicon.svg", include_in_schema=False)
def serve_favicon_svg():
    return FileResponse(
        os.path.join(WEB_DIR, "favicon.svg"),
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/apple-touch-icon.png", include_in_schema=False)
def serve_apple_touch_icon():
    return FileResponse(
        os.path.join(WEB_DIR, "apple-touch-icon.png"),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/")
def serve_index():
    return FileResponse(os.path.join(WEB_DIR, "index.html"))
