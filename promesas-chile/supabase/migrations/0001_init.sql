-- ============================================================
-- Promesas Chile · Natación — esquema inicial
-- Modelo: doc-por-fila (jsonb) con RLS por owner = auth.uid()
-- ============================================================

-- ---------- Tablas doc-jsonb ----------
create table if not exists public.coach (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  doc   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.swimmers (
  id    text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.trainings (
  id    text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluations (
  id    text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.bajas (
  id    text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Asistencia (filas present-only) ----------
create table if not exists public.attendance (
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  swimmer_id text not null,
  day        date not null,
  primary key (owner, swimmer_id, day)
);

-- ---------- Reportes mensuales ----------
create table if not exists public.reports (
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ym         text not null,
  notas      text not null default '',
  resultados text not null default '',
  primary key (owner, ym)
);

-- ---------- Índices por owner ----------
create index if not exists idx_swimmers_owner    on public.swimmers(owner);
create index if not exists idx_trainings_owner   on public.trainings(owner);
create index if not exists idx_evaluations_owner on public.evaluations(owner);
create index if not exists idx_bajas_owner       on public.bajas(owner);

-- ============================================================
-- Row Level Security: cada usuario sólo ve/edita lo suyo
-- ============================================================
alter table public.coach       enable row level security;
alter table public.swimmers    enable row level security;
alter table public.trainings   enable row level security;
alter table public.evaluations enable row level security;
alter table public.bajas       enable row level security;
alter table public.attendance  enable row level security;
alter table public.reports     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['coach','swimmers','trainings','evaluations','bajas','attendance','reports']
  loop
    execute format('drop policy if exists %I_owner_all on public.%I;', t, t);
    execute format($f$
      create policy %I_owner_all on public.%I
        for all
        using (owner = auth.uid())
        with check (owner = auth.uid());
    $f$, t, t);
  end loop;
end$$;

-- ============================================================
-- Realtime: publicar cambios de todas las tablas
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['coach','swimmers','trainings','evaluations','bajas','attendance','reports']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end$$;
