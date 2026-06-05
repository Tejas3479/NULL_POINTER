-- Create simulation_worlds table to persist world timelines
create table if not exists simulation_worlds (
    world_id text primary key,
    state jsonb not null,
    updated_at timestamptz not null default now()
);

-- Create world_snapshots table for simulation checkpoints/backups
create table if not exists world_snapshots (
    id uuid primary key default gen_random_uuid(),
    world_id text not null,
    tick integer not null,
    state_jsonb jsonb not null,
    created_at timestamptz not null default now()
);

-- Create patch_traces table for storing player patch attempts and sandbox evaluations
create table if not exists patch_traces (
    id uuid primary key default gen_random_uuid(),
    world_id text not null,
    player_id text not null,
    tick integer not null,
    vulnerability text not null,
    patch_code text not null,
    diff text not null,
    score integer not null,
    accepted boolean not null,
    feedback text not null,
    sandbox_trace jsonb not null,
    created_at timestamptz not null default now()
);
