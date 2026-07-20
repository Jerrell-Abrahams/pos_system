-- A shop can take card on more than one speedpoint (different acquirers, a petro terminal, a
-- phone-app device). "method = card" alone can't be reconciled against each machine's own
-- settlement report at end of day, so record which one took the money.

-- Free text, not a foreign key to a terminals table: the list lives in settings (card_terminals),
-- and renaming or retiring a machine there must not rewrite what old sales say happened. NULL is
-- every card payment taken before this migration, and any taken while no terminals are configured.
ALTER TABLE payments ADD COLUMN terminal TEXT;
