-- Phase 7 (adaptive layer): card variation is triggered live from the
-- client when a card gets 3 consecutive Easy ratings. The new variant is a
-- deterministic reformulation of an already-verified fact (not new
-- unvalidated content — principle #4 is about facts, not card phrasing),
-- so it's consistent with this app's single-user "auth.uid() is not null"
-- security model to let the authenticated client insert/update these two
-- tables directly, same as every other table already does.

-- card_states already has insert/update policies from migration 0001
-- (it was already a user-state table). Only `cards` needs new policies.
create policy cards_insert_authenticated on cards
  for insert with check (auth.uid() is not null);
create policy cards_update_authenticated on cards
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
