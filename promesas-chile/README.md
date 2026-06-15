# Promesas Chile · Natación

Plataforma de gestión deportiva para natación: nadadores, asistencia, entrenamientos, evaluaciones por niveles y reportes mensuales imprimibles (A4).

**Stack:** Vite + React 18 + Supabase (Postgres + Auth + Realtime). Arquitectura **offline-first**: la app funciona sin conexión (caché local) y sincroniza con Supabase al recuperar internet.

---

## 1. Requisitos

- Node.js 18+ y npm
- Una cuenta en [Supabase](https://supabase.com) (gratis)
- Una cuenta en [GitHub](https://github.com) y otra en [Vercel](https://vercel.com)

---

## 2. Configurar Supabase

1. Crea un proyecto nuevo en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Ve a **SQL Editor → New query**, pega el contenido de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) y ejecútalo.
   Esto crea las tablas, activa **RLS** (cada usuario sólo ve sus datos) y habilita **Realtime**.
3. Ve a **Authentication → Providers → Email** y verifica que esté habilitado.
   - Para pruebas rápidas, en **Authentication → Sign In / Providers** puedes desactivar
     *"Confirm email"* para no requerir confirmación por correo.
4. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

---

## 3. Ejecutar en local

```bash
cp .env.example .env.local   # luego edita .env.local con tus credenciales
npm install
npm run dev
```

Abre la URL que muestra Vite (por defecto `http://localhost:5173`).

1. **Crea tu cuenta** con email + contraseña en la pantalla de acceso.
2. Entra a **Ajustes** y usa **"Cargar datos de demostración"** para poblar el plantel de ejemplo.
3. El **PIN de dispositivo** (por defecto `1234`) es un bloqueo local opcional; se cambia en Ajustes.

> Si dejas las variables de entorno vacías, la app arranca en **modo local** (sólo este navegador, sin nube). Útil para probar sin Supabase.

---

## 4. Subir a GitHub

```bash
git init
git add .
git commit -m "Promesas Chile · Natación — app inicial"
git branch -M main
git remote add origin https://github.com/jeanpaulvitta/promesas-chile.git
git push -u origin main
```

> Crea primero el repositorio vacío `promesas-chile` en GitHub (sin README), y reemplaza la URL si usas otro nombre. El archivo `.gitignore` ya excluye `node_modules`, `dist` y `.env.local`, así que tus credenciales **no** se suben.

---

## 5. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio `promesas-chile`.
2. Vercel detecta Vite automáticamente (`vercel.json` ya define build y rewrites SPA).
3. En **Environment Variables**, agrega las dos variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Pulsa **Deploy**.
5. Cuando termine, copia la URL del despliegue (ej. `https://promesas-chile.vercel.app`) y agrégala en
   Supabase → **Authentication → URL Configuration → Site URL / Redirect URLs**.

Cada `git push` a `main` redepliega automáticamente.

---

## Estructura

```
promesas-chile/
├─ index.html                 # carga fuentes (Sora + Manrope) y main.jsx
├─ vite.config.js
├─ vercel.json                # framework Vite + rewrites SPA
├─ .env.example               # plantilla de credenciales
├─ public/logo.png
├─ supabase/migrations/
│  └─ 0001_init.sql           # esquema + RLS + realtime
└─ src/
   ├─ main.jsx                # punto de entrada React
   ├─ styles.css              # sistema de diseño + reglas de impresión A4
   ├─ lib/
   │  ├─ domain.js            # lógica pura (categorías, niveles, parseo de volumen, protocolos)
   │  ├─ supabase.js          # cliente Supabase
   │  └─ db.js                # capa de datos offline-first (caché + cola de sync + realtime)
   └─ ui/
      ├─ app.jsx              # auth + bloqueo PIN + shell + ajustes
      ├─ components.jsx       # primitivas de UI, iconos, hooks
      ├─ stopwatch.jsx        # cronómetro
      ├─ dashboard.jsx  swimmers.jsx  attendance.jsx
      ├─ trainings.jsx  evaluations.jsx  reports.jsx  eval-report.jsx
```

---

## Cómo funciona offline-first

- Toda mutación se aplica **al instante** en memoria y en una caché local (`localStorage`), y emite a la UI.
- En paralelo se encola una operación remota; si hay conexión se envía a Supabase, si no, espera.
- Al recuperar internet, la cola se vacía automáticamente y se vuelve a hidratar desde la nube.
- **Realtime** mantiene sincronizados otros dispositivos del mismo usuario.
