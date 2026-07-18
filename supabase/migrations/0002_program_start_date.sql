-- The reading plan (reading_plan.day_idx, 1..365) needs a calendar anchor
-- to map "today" to a day_idx. Additive column, not in the original
-- handoff schema draft but required for the session builder to function.

alter table settings add column if not exists program_start_date date default current_date;
