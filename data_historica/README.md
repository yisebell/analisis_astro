# Registros Históricos Faltantes — Astro Sol y Astro Luna

> **Estado:** Guardados únicamente en archivos CSV para revisión manual. **No se ha insertado ni modificado nada en Supabase.**

## Resumen de registros recuperados

Fuente principal oficial: **`https://superastro.com.co/historico.php`** (portal oficial de Súper Astro Colombia).
Reproducible ejecutando `python data_historica/scrape_historico.py`.

| Lotería | Archivo CSV | Total recuperados | Anteriores a tu inicio | Huecos internos | Rango de fechas recuperado |
|---|---|---:|---:|---:|---|
| **Astro Sol** | `historico_faltante_sol.csv` | **148** | **147** (`2010-06-02` a `2010-11-30`) | **1** (`2025-09-15`, sorteo `5236`) | `2010-06-02` – `2025-09-15` |
| **Astro Luna** | `historico_faltante_luna.csv` | **6** | **0** | **6** (`2023-05-11` a `2023-05-16`, sorteos `7021`–`7026`) | `2023-05-11` – `2023-05-16` |

### Columnas de los CSV
`loteria,fecha,numero,signo,sorteo,categoria,fuente`
- `numero`: siempre 4 dígitos con ceros a la izquierda (p. ej. `0122`).
- `signo`: normalizado al formato canónico de tu proyecto (sin tildes: `Aries`, `Tauro`, `Geminis`, `Cancer`, `Leo`, `Virgo`, `Libra`, `Escorpion`, `Sagitario`, `Capricornio`, `Acuario`, `Piscis`).
- `categoria`: `anterior_inicio` (anterior a la fecha más antigua de tu BD) o `hueco_interno` (días faltantes en medio de tu histórico).

### Validación cruzada (calidad)
Todos los registros recientes recuperados (**7 de 7**: los 6 huecos de Astro Luna de mayo 2023 y el hueco de Astro Sol del `2025-09-15`) fueron contrastados contra una segunda fuente pública independiente (`resultadosloteriascol.com/api/download/super_astro.csv`) con **100% de coincidencia exacta** en fecha, número de 4 cifras, signo zodiacal y número de sorteo.
Además, el rango `2010-06-02` a `2010-11-29` de Astro Sol coincide con la copia archivada del 29 de noviembre de 2010 en Wayback Machine (`superastro.com.co/anteriores.php`).

---

## ¿Qué pasó con los sorteos aún más antiguos?

Tu histórico actual en JSON comienza en:
- **Astro Luna:** `2008-02-01` (6,741 registros en JSON / 6,746 en Supabase vs sorteo oficial `#8317` al `2026-11-27`).
- **Astro Sol:** `2010-12-01` (4,706 registros en JSON / 4,711 en Supabase vs sorteo oficial `#5590` al `2026-11-27`).

Durante la búsqueda se auditaron todas las fuentes públicas abiertas y archivos locales (`unused/`):
1. **`superastro.com.co/historico.php` (oficial):** su base digital consultable inicia exactamente el **`2010-06-02`** tanto para Sol como para Luna. Por eso fue posible recuperar los **147 sorteos oficiales de Astro Sol** entre `2010-06-02` y `2010-11-30`, más todos los huecos internos posteriores a esa fecha.
2. **`astroluna.co`:** solo expone sorteos recientes.
3. **`resultadosloteriascol.com`:** su CSV completo inicia en `2023-02-19` (2,488 registros).
4. **`loteriasdehoy.co`:** su archivo consultable cubre años recientes (p. ej. 2023+) pero no 2004–2010.
5. **`resultadodelaloteria.com`:** su buscador histórico está protegido por reCAPTCHA (no automatizado por respeto a las políticas del sitio) y sus URLs directas de 2007–2010 redirigen al último sorteo vigente.
6. **`datos.gov.co`, GitHub, Kaggle, Wayback Machine (`web.archive.org`) y excels en `unused/`:** no contienen registros anteriores a `2008-02-01` (Luna) ni anteriores a `2010-06-02` (Sol).

### Explicación de la diferencia con el número de sorteo oficial
- En **Astro Luna**, el `2011-06-15` corresponde oficialmente al sorteo `#2717`, lo que sitúa el sorteo `#1` aproximadamente a comienzos de **2004**. Los ~1,500 sorteos anteriores a `2008-02-01` (años **2004–2007**) no están publicados en bases digitales abiertas; solo figuran en actas físicas/internas del operador (*Corredor Empresarial S.A.* / *Coljuegos*) o compilaciones privadas (p. ej. documentos de pago en Scribd).
- En **Astro Sol**, con los **147 registros** recuperados ahora cubres desde **`2010-06-02`**. Los ~720 sorteos anteriores (`2008-02` a `2010-06-01`) tampoco están expuestos en la consulta pública de `superastro.com.co`.
- Adicionalmente, en ambos juegos existió la suspensión oficial por pandemia entre el **`2020-03-25` y el `2020-04-27`** (34 días sin sorteos), que no son registros faltantes sino días sin operación.

## Cómo insertarlos cuando los revises

Una vez revises los archivos `historico_faltante_sol.csv` y `historico_faltante_luna.csv`, podrás cargarlos a Supabase usando la función idempotente `insertar_sorteos(tipo, items)` de `core/db.py` (ignora automáticamente cualquier fecha ya existente).
