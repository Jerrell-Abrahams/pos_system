-- Combos gain a category. 'Specials' keeps the free-form builder; 'Brandy'/'Rum'/'Whiskey' are
-- guided spirit combos (bottle + always-included ice + mixer, priced bottle + charge_extra_cents).
-- These categories are the tabs on the POS combo view. combo_items.role records which item is the
-- bottle/ice/mixer so a spirit combo can be reopened and edited; NULL for Specials' free-form items.
--
-- Numbered 016, not 015: an earlier (reverted) attempt shipped a different 015 that some dev DBs
-- already recorded, which would make the runner skip a second 015. These drops clean up that
-- attempt's now-unused tables where they exist (no-op on installs that never applied it).
DROP TABLE IF EXISTS combo_choices;
DROP TABLE IF EXISTS combo_choice_groups;

ALTER TABLE combos ADD COLUMN category TEXT NOT NULL DEFAULT 'Specials';
ALTER TABLE combos ADD COLUMN charge_extra_cents INTEGER;
ALTER TABLE combo_items ADD COLUMN role TEXT;
