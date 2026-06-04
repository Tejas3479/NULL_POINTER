-- Add critic_score column to patch_traces table for semantic evaluation scores
alter table patch_traces add column if not exists critic_score integer default 0;
