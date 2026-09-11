create table public.workspace_items (
  id uuid not null default gen_random_uuid (),
  kind text not null default 'note'::text,
  title text not null default 'Untitled'::text,
  content text null default ''::text,
  tags text[] null default '{}'::text[],
  data jsonb null default '{}'::jsonb,
  pinned boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint workspace_items_pkey primary key (id)
) TABLESPACE pg_default;