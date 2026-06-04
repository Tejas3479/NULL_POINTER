-- Enable pgvector extension
create extension if not exists vector;

-- Create agent_memories table
create table if not exists agent_memories (
    id uuid primary key default gen_random_uuid(),
    agent_id text not null,
    text text not null,
    embedding vector(1536),
    created_at timestamptz not null default now()
);

-- Index for distance similarity queries using IVFFlat
create index if not exists agent_memories_embedding_idx on agent_memories using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- RPC search function to retrieve relevant semantic memories
create or replace function match_agent_memories (
    p_agent_id text,
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
returns table (
    id uuid,
    agent_id text,
    text text,
    similarity float,
    created_at timestamptz
)
language sql stable
as $$
    select
        agent_memories.id,
        agent_memories.agent_id,
        agent_memories.text,
        1 - (agent_memories.embedding <=> query_embedding) as similarity,
        agent_memories.created_at
    from agent_memories
    where agent_memories.agent_id = p_agent_id
      and 1 - (agent_memories.embedding <=> query_embedding) > match_threshold
    order by agent_memories.embedding <=> query_embedding
    limit match_count;
$$;
