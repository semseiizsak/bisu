-- The adaptive-variant write path now goes through a server Route Handler
-- (src/app/api/adaptive/variant/route.ts) using the service role key, so
-- the client no longer needs direct insert/update on `cards` (confirmed no
-- remaining browser code path writes to `cards`). Reverts 0003 back to the
-- original 0001 intent: cards is a content table, written only by trusted
-- server code.

drop policy if exists cards_insert_authenticated on cards;
drop policy if exists cards_update_authenticated on cards;
