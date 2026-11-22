"""
Pruebas automatizadas de seguridad, control de acceso (JWT / Roles / Cron) y endpoints
de Astro Analytics Pro (FastAPI + Supabase).
"""
import os
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
os.environ.setdefault("SUPABASE_SECRET_KEY", "sb_secret_test")
os.environ["CRON_SECRET"] = "test-cron-secret-123"

from api.main import app
import api.security as security_mod
import api.main as main_mod
import core.export_excel as excel_mod


client = TestClient(app)


def _mock_auth(monkeypatch, role="viewer", active=True):
    class DummyAuth:
        def get_user(self, token):
            if token == "valid-token":
                return SimpleNamespace(user=SimpleNamespace(id="user-123", email="user@test.com"))
            return SimpleNamespace(user=None)

    dummy_client = SimpleNamespace(auth=DummyAuth())
    monkeypatch.setattr(security_mod, "get_client", lambda: dummy_client)
    monkeypatch.setattr(
        security_mod,
        "obtener_perfil_usuario",
        lambda uid: {"id": uid, "email": "user@test.com", "role": role, "active": active},
    )


def test_public_endpoints_and_security_headers():
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["ok"] is True
    assert res_health.headers["X-Content-Type-Options"] == "nosniff"
    assert res_health.headers["X-Frame-Options"] == "DENY"

    res_cfg = client.get("/api/config")
    assert res_cfg.status_code == 200
    body = res_cfg.json()
    assert "supabaseUrl" in body and "supabaseKey" in body
    assert "SUPABASE_SECRET_KEY" not in str(body)


def test_protected_endpoints_reject_unauthenticated():
    for method, path in [
        ("GET", "/api/me"),
        ("GET", "/api/status"),
        ("GET", "/api/datos"),
        ("GET", "/api/quant?loteria=luna&window=100"),
        ("GET", "/api/lista_usuario"),
        ("PUT", "/api/lista_usuario"),
        ("GET", "/api/exportar_excel"),
        ("POST", "/api/actualizar"),
    ]:
        res = client.request(method, path)
        assert res.status_code == 401, f"{method} {path} debería devolver 401 y devolvió {res.status_code}"


def test_viewer_can_read_but_cannot_trigger_scraper(monkeypatch):
    _mock_auth(monkeypatch, role="viewer", active=True)
    monkeypatch.setattr(
        main_mod,
        "construir_dataset_memoria",
        lambda forzar=False: (
            {"metadata": {"total_luna": 1, "total_sol": 0}, "luna": [], "sol": []},
            b'{"metadata":{"total_luna":1,"total_sol":0},"luna":[],"sol":[]}',
            "1:2026-11-21|0:",
        ),
    )

    headers = {"Authorization": "Bearer valid-token"}
    res_me = client.get("/api/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["role"] == "viewer"

    res_datos = client.get("/api/datos", headers=headers)
    assert res_datos.status_code == 200
    assert res_datos.json()["metadata"]["total_luna"] == 1

    res_sync = client.post("/api/actualizar", headers=headers)
    assert res_sync.status_code == 403


def test_inactive_user_is_blocked(monkeypatch):
    _mock_auth(monkeypatch, role="admin", active=False)
    res = client.get("/api/me", headers={"Authorization": "Bearer valid-token"})
    assert res.status_code == 403


def test_admin_can_trigger_scraper(monkeypatch):
    _mock_auth(monkeypatch, role="admin", active=True)
    monkeypatch.setattr(main_mod, "actualizar_todas", lambda: {"ok": True, "total_insertados": 2})
    monkeypatch.setattr(
        main_mod,
        "construir_dataset_memoria",
        lambda forzar=False: ({"metadata": {"total_luna": 10, "total_sol": 5}}, b"{}", "sig"),
    )

    res = client.post("/api/actualizar", headers={"Authorization": "Bearer valid-token"})
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert res.json()["resultado"]["total_insertados"] == 2


def test_cron_secret_enforcement(monkeypatch):
    monkeypatch.setattr(main_mod, "actualizar_todas", lambda: {"ok": True, "total_insertados": 0})
    monkeypatch.setattr(
        main_mod,
        "construir_dataset_memoria",
        lambda forzar=False: (
            {"metadata": {"total_luna": 10, "total_sol": 5, "generado_el": "now"}},
            b"{}",
            "sig",
        ),
    )

    res_bad = client.post("/api/cron/sync", headers={"X-Cron-Secret": "wrong"})
    assert res_bad.status_code == 401

    res_ok = client.post("/api/cron/sync", headers={"X-Cron-Secret": "test-cron-secret-123"})
    assert res_ok.status_code == 200
    assert res_ok.json()["ok"] is True


def test_excel_download_in_memory(monkeypatch):
    _mock_auth(monkeypatch, role="viewer", active=True)
    sample = [
        {"fecha": "2026-11-21", "numero": "7745", "signo": "Piscis", "loteria": "luna"},
        {"fecha": "2026-11-20", "numero": "3684", "signo": "Leo", "loteria": "luna"},
    ]
    monkeypatch.setattr(excel_mod, "obtener_resultados", lambda tipo: sample)

    res = client.get("/api/exportar_excel?loteria=luna", headers={"Authorization": "Bearer valid-token"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert res.content[:2] == b"PK"  # Firma de archivo ZIP/XLSX válido


def test_quant_serializes_numpy_scalars(monkeypatch):
    import numpy as np
    _mock_auth(monkeypatch, role="viewer", active=True)
    monkeypatch.setattr(
        main_mod,
        "ejecutar_analisis_cuantitativo",
        lambda loteria="luna", eval_window=300: {
            "ok": np.bool_(True),
            "total_sorteos": np.int64(300),
            "score": np.float64(1.23),
        },
    )
    res = client.get("/api/quant?loteria=luna&window=300", headers={"Authorization": "Bearer valid-token"})
    assert res.status_code == 200
    body = res.json()
    assert body == {"ok": True, "total_sorteos": 300, "score": 1.23}

