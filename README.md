# RAG Chat

Chatbot de documentación con recuperación semántica. Permite indexar documentos y hacer preguntas en lenguaje natural sobre su contenido.

## Demo

[Ver demo en producción](https://rag-basic-chat.vercel.app)

## ¿Cómo funciona?

1. El usuario pega un documento y lo indexa
2. El texto se divide en chunks y se convierte en vectores con Xenova/all-MiniLM-L6-v2
3. Los vectores se almacenan en Supabase con pgvector
4. Cuando el usuario hace una pregunta, se buscan los chunks más relevantes por similitud semántica
5. Claude recibe solo los chunks relevantes como contexto y genera la respuesta en streaming
6. Langfuse registra cada interacción con métricas de latencia, tokens y costo

## Stack

- **Framework**: Next.js 16 (App Router)
- **LLM**: Claude Sonnet via Vercel AI SDK
- **Embeddings**: Xenova/Transformers.js (local, sin API externa)
- **Base de datos vectorial**: Supabase + pgvector
- **Observabilidad**: Langfuse
- **Deploy**: Vercel

## Variables de entorno

```env
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASEURL=
```

## Setup local

```bash
npm install
npm run dev
```

### Base de datos

Ejecuta estas queries en el SQL Editor de Supabase:

```sql
create extension if not exists vector;

create table documents (
  id bigserial primary key,
  content text not null,
  embedding vector(384),
  metadata jsonb,
  created_at timestamp with time zone default now()
);

create index on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
```