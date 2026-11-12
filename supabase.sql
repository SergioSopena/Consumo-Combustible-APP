-- Tabla única: una fila por usuario con todos tus datos (JSON).
create table if not exists public.datos_usuario (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  datos jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

-- Seguridad: cada usuario solo puede ver y modificar SU fila.
alter table public.datos_usuario enable row level security;

create policy "Ver mis datos"        on public.datos_usuario for select using (auth.uid() = user_id);
create policy "Crear mis datos"      on public.datos_usuario for insert with check (auth.uid() = user_id);
create policy "Actualizar mis datos" on public.datos_usuario for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Borrar mis datos"     on public.datos_usuario for delete using (auth.uid() = user_id);

-- Sin sesión iniciada no se puede acceder a nada.
revoke all on public.datos_usuario from anon;
