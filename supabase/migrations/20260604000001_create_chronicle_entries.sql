-- Create chronicle_entries table for persistent lore timeline
create table if not exists chronicle_entries (
    id uuid primary key default gen_random_uuid(),
    world_id text not null,
    tick integer not null,
    title text not null,
    body text not null,
    faction text not null,
    created_at timestamptz not null default now()
);

-- Index for ordering chronicle entries per simulation tick
create index if not exists chronicle_entries_world_tick_idx on chronicle_entries (world_id, tick desc, created_at desc);
