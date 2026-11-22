# Astro Analytics Pro - Cloud & Supabase Edition

Plataforma web interactiva para análisis estadístico, proyecciones probabilísticas y Laboratorio Cuantitativo (ML + Auditoría Forense) de **Astro Luna** y **Astro Sol**, respaldada por **Supabase (PostgreSQL + Auth + RLS)** y **FastAPI**.

---

## Arquitectura y Seguridad

- **Base de datos**: Supabase PostgreSQL (`public.sorteos`, `public.profiles`, `public.listas_usuario`) con **Row Level Security (RLS)** obligatorio y acceso anónimo revocado.
- **Autenticación privada**: Inicio de sesión obligatorio con **Supabase Auth** (Email + Contraseña) y registro público desactivado (acceso solo por invitación).
- **Control de roles**:
  - `admin`: acceso completo + botón **Sincronizar Web** (`POST /api/actualizar`).
  - `viewer`: lectura de histórico, análisis, Lab Cuantitativo, descarga de Excel/TXT y guardado de sus propias listas en la nube.
- **Automatización diaria**: Workflow de GitHub Actions ([sync-sorteos.yml](.github/workflows/sync-sorteos.yml)) que llama a `POST /api/cron/sync` con `X-Cron-Secret`.

---

## Configuración Local

1. Instala dependencias ligeras:
   ```bash
   pip install -r requirements.txt
   ```
2. Crea `.env` a partir de `.env.example` y completa tus claves de Supabase (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`).
3. Migra tus históricos a Supabase (una sola vez, idempotente):
   ```bash
   python scripts/migrar_a_supabase.py
   ```
4. Inicia la aplicación:
   ```bash
   python run.py
   # o directamente:
   uvicorn api.main:app --reload --port 8000
   ```

---

## Despliegue en Internet (Railway / Render / Fly.io)

El proyecto incluye [Dockerfile](Dockerfile) y [requirements.txt](requirements.txt) listos para despliegue automático desde GitHub:

1. Crea un servicio Web en **Railway** (\$5/mes, siempre encendido) o **Render** (plan gratis o \$7/mes) conectado a tu repositorio.
2. Configura las variables de entorno en la plataforma:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `CRON_SECRET`
   - `ALLOWED_ORIGINS=https://tu-dominio.up.railway.app`
3. En Supabase Dashboard -> **Authentication -> Providers -> Email**, desactiva **Allow new users to sign up** y crea/invita únicamente tus usuarios autorizados.
4. Para promover tu cuenta a administrador en Supabase SQL Editor:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'tu@correo.com';
   ```
5. En GitHub -> **Settings -> Secrets -> Actions**, agrega `APP_URL` y `CRON_SECRET` para activar el scraping automático diario.
