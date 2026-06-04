-- Create ghost_evolution table for tracking self-modified Ghost Engine variants
create table if not exists ghost_evolution (
    id uuid primary key default gen_random_uuid(),
    world_id text not null,
    variant_hash text not null unique,
    source text not null,
    diff text not null,
    fitness double precision not null,
    parent_hash text,
    activated boolean not null default false,
    promoted boolean not null default false,
    created_at timestamptz not null default now()
);

-- Index for locating variants by world and hash
create index if not exists ghost_evolution_world_hash_idx on ghost_evolution (world_id, variant_hash);
