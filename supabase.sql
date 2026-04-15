-- Supabase schema for multi-tenant RAG (kb/doc/chunks + chat)
-- Requirements:
-- - vector dims = 1024 (BGE-M3)
-- - RLS on all tables; users can only access their own rows (auth.uid() = user_id)
-- - useful indexes for kb_id/user_id/doc_id on chunks

-- Enable pgvector (Supabase supports this extension)
create extension if not exists vector;

-- Recommended for UUID generation (optional but common)
create extension if not exists pgcrypto;

-- -----------------------------
-- knowledge_bases
-- -----------------------------
create table if not exists public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_bases_user_id_idx on public.knowledge_bases (user_id);

-- -----------------------------
-- documents
-- -----------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum ('uploaded', 'processing', 'ready', 'failed');
  end if;
end
$$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kb_id uuid not null references public.knowledge_bases (id) on delete cascade,
  title text not null,
  source text, -- filename/url/etc
  mime_type text,
  bucket text,
  path text,
  status public.document_status not null default 'uploaded',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If you created this table before bucket/path existed, run:
-- alter table public.documents add column if not exists bucket text;
-- alter table public.documents add column if not exists path text;

create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_kb_id_idx on public.documents (kb_id);
create index if not exists documents_user_kb_idx on public.documents (user_id, kb_id);

-- -----------------------------
-- doc_chunks (vector store)
-- -----------------------------
create table if not exists public.doc_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kb_id uuid not null references public.knowledge_bases (id) on delete cascade,
  doc_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1024),
  created_at timestamptz not null default now()
);

-- Fast filters for multi-tenant retrieval and maintenance
create index if not exists doc_chunks_user_id_idx on public.doc_chunks (user_id);
create index if not exists doc_chunks_kb_id_idx on public.doc_chunks (kb_id);
create index if not exists doc_chunks_doc_id_idx on public.doc_chunks (doc_id);
create index if not exists doc_chunks_user_kb_doc_idx on public.doc_chunks (user_id, kb_id, doc_id);
create unique index if not exists doc_chunks_doc_chunk_uq on public.doc_chunks (doc_id, chunk_index);

-- Vector index for similarity search (tune lists to your scale)
-- Note: vector_cosine_ops matches cosine distance typical for text embeddings
create index if not exists doc_chunks_embedding_ivfflat_idx
on public.doc_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- -----------------------------
-- Vector search RPC (optional but recommended)
-- -----------------------------
-- Fast similarity search with multi-tenant + kb filters.
-- Note: returns `similarity` as (1 - cosine_distance), higher is better.
create or replace function public.match_doc_chunks(
  query_embedding vector(1024),
  match_count int,
  p_user_id uuid,
  p_kb_ids uuid[]
)
returns table (
  id uuid,
  kb_id uuid,
  doc_id uuid,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.kb_id,
    dc.doc_id,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.doc_chunks dc
  where
    dc.user_id = p_user_id
    and (p_kb_ids is null or dc.kb_id = any(p_kb_ids))
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- -----------------------------
-- conversations
-- -----------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  kb_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx on public.conversations (user_id);
create index if not exists conversations_kb_ids_gin_idx on public.conversations using gin (kb_ids);

-- -----------------------------
-- messages
-- -----------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_role') then
    create type public.message_role as enum ('system', 'user', 'assistant', 'tool');
  end if;
end
$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null,
  role public.message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_user_id_idx on public.messages (user_id);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);

-- -----------------------------
-- RLS: enable + policies
-- -----------------------------
alter table public.knowledge_bases enable row level security;
alter table public.documents enable row level security;
alter table public.doc_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- knowledge_bases
drop policy if exists knowledge_bases_select_own on public.knowledge_bases;
create policy knowledge_bases_select_own on public.knowledge_bases
for select using (auth.uid() = user_id);

drop policy if exists knowledge_bases_insert_own on public.knowledge_bases;
create policy knowledge_bases_insert_own on public.knowledge_bases
for insert with check (auth.uid() = user_id);

drop policy if exists knowledge_bases_update_own on public.knowledge_bases;
create policy knowledge_bases_update_own on public.knowledge_bases
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists knowledge_bases_delete_own on public.knowledge_bases;
create policy knowledge_bases_delete_own on public.knowledge_bases
for delete using (auth.uid() = user_id);

-- documents
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own on public.documents
for select using (auth.uid() = user_id);

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own on public.documents
for insert with check (auth.uid() = user_id);

drop policy if exists documents_update_own on public.documents;
create policy documents_update_own on public.documents
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own on public.documents
for delete using (auth.uid() = user_id);

-- doc_chunks
drop policy if exists doc_chunks_select_own on public.doc_chunks;
create policy doc_chunks_select_own on public.doc_chunks
for select using (auth.uid() = user_id);

drop policy if exists doc_chunks_insert_own on public.doc_chunks;
create policy doc_chunks_insert_own on public.doc_chunks
for insert with check (auth.uid() = user_id);

drop policy if exists doc_chunks_update_own on public.doc_chunks;
create policy doc_chunks_update_own on public.doc_chunks
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists doc_chunks_delete_own on public.doc_chunks;
create policy doc_chunks_delete_own on public.doc_chunks
for delete using (auth.uid() = user_id);

-- conversations
drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own on public.conversations
for select using (auth.uid() = user_id);

drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_insert_own on public.conversations
for insert with check (auth.uid() = user_id);

drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own on public.conversations
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own on public.conversations
for delete using (auth.uid() = user_id);

-- messages
drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
for select using (auth.uid() = user_id);

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
for insert with check (auth.uid() = user_id);

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
for delete using (auth.uid() = user_id);

-- -----------------------------
-- Optional: keep updated_at fresh
-- -----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_kbs on public.knowledge_bases;
create trigger set_updated_at_kbs
before update on public.knowledge_bases
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_documents on public.documents;
create trigger set_updated_at_documents
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_conversations on public.conversations;
create trigger set_updated_at_conversations
before update on public.conversations
for each row execute function public.set_updated_at();

