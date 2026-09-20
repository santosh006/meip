create table public.document_index (
  doc_id text not null,
  r2_object_key text not null,
  file_size_bytes bigint not null,
  mime_type text null,
  status text not null default 'discovered'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  file_name text null,
  created_by text null,
  constraint document_index_pkey primary key (doc_id),
  constraint document_index_status_check check (
    (
      status = any (
        array[
          'discovered'::text,
          'uploading'::text,
          'available'::text,
          'duplicate'::text,
          'failed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_document_index_status on public.document_index using btree (status) TABLESPACE pg_default;