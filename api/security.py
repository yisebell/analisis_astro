"""
Módulo de autenticación y autorización para la API de Astro Analytics Pro.
Valida JWT emitidos por Supabase Auth y verifica el perfil/rol activo en public.profiles.
"""
import hmac
import os
from dataclasses import dataclass
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.db import get_client, obtener_perfil_usuario

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthenticatedUser:
    id: str
    email: str
    role: str
    active: bool


def require_active_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> AuthenticatedUser:
    """Verifica el JWT de Supabase Auth y que el usuario esté activo en public.profiles."""
    if not credentials or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación requerido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    try:
        client = get_client()
        user_resp = client.auth.get_user(token)
        supa_user = getattr(user_resp, "user", None)
    except Exception:
        supa_user = None

    if not supa_user or not getattr(supa_user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada. Inicia sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = str(supa_user.id)
    email = str(getattr(supa_user, "email", "") or "")
    perfil = obtener_perfil_usuario(user_id)

    if not perfil:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no autorizado en el sistema.",
        )

    if not perfil.get("active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta ha sido desactivada por el administrador.",
        )

    return AuthenticatedUser(
        id=user_id,
        email=perfil.get("email") or email,
        role=perfil.get("role", "viewer"),
        active=True,
    )


def require_admin_user(
    user: AuthenticatedUser = Depends(require_active_user),
) -> AuthenticatedUser:
    """Exige que el usuario autenticado tenga rol 'admin'."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción requiere permisos de administrador.",
        )
    return user


def verify_cron_secret(
    x_cron_secret: Optional[str] = Header(default=None, alias="X-Cron-Secret"),
) -> bool:
    """Valida el secreto compartido para tareas automáticas (GitHub Actions / Cron)."""
    expected = (os.getenv("CRON_SECRET") or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRON_SECRET no está configurado en el servidor.",
        )
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret.strip(), expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Secreto de cron inválido.",
        )
    return True
