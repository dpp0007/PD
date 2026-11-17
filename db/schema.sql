-- PortalDump schema (Postgres / Supabase). users = auth.users; no raw credentials or TOTP seeds are stored anywhere.
create table portals (
  id uuid primary key default gen_random_uuid(),
  slug text unique, name text not null, base_url text, category text,
  integration_type text not null check (integration_type in ('supported','custom')),
  created_at timestamptz not null default now()
);

create table user_portals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  portal_id uuid not null references portals,
  tinyfish_profile_id_enc text,          -- app-level encrypted TinyFish profile_id (a reference, not a credential)
  connection_status text not null default 'disconnected',
  last_authenticated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, portal_id)
);

create table extraction_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  portal_id uuid not null references portals,
  tinyfish_run_id text,
  mode text not null default 'incremental' check (mode in ('full','incremental','retry')),
  status text not null default 'pending',
  started_at timestamptz, completed_at timestamptz,
  records_found int default 0, records_new int default 0, records_updated int default 0,
  records_unchanged int default 0, records_failed int default 0,
  documents_downloaded int default 0, error_summary text
);

create table extracted_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  portal_id uuid not null references portals,
  last_run_id uuid references extraction_runs on delete set null,
  category text not null,
  source_record_id text not null,        -- stable id or composite key; never timestamp-only
  record_hash text not null,             -- change detection
  status text not null default 'valid' check (status in ('valid','incomplete')),
  issues jsonb,
  normalized_data jsonb not null,
  source_updated_at timestamptz,
  extracted_at timestamptz not null default now(),
  unique (user_id, portal_id, category, source_record_id)
);
create index on extracted_records (user_id, portal_id, category);

create table export_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  extraction_run_id uuid references extraction_runs on delete cascade,
  file_type text not null, storage_path text not null, file_size bigint,
  created_at timestamptz not null default now()
);

create table portal_schemas (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portals,
  category text not null, schema_version int not null default 1, schema_definition jsonb not null,
  unique (portal_id, category, schema_version)
);

-- Row-level security: users only ever see their own rows.
alter table user_portals enable row level security;
alter table extraction_runs enable row level security;
alter table extracted_records enable row level security;
alter table export_files enable row level security;
create policy own on user_portals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on extraction_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on extracted_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on export_files for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table portals enable row level security;
create policy read_all on portals for select using (true);
alter table portal_schemas enable row level security;
create policy read_all on portal_schemas for select using (true);
