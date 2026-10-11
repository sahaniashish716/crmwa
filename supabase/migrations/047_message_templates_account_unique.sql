-- ============================================================
-- 047_message_templates_account_unique.sql
--
-- Templates are account-scoped (017) but the unique index from 014
-- is still (user_id, name, language), so teammates shadow each other.
-- Switch conflict target to (account_id, name, language).
--
-- Idempotent — safe to re-run.
-- ============================================================

DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT account_id, name, language
    FROM message_templates
    GROUP BY account_id, name, language
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE(account_id, name, language) — % duplicate combination(s). Merge or delete extras, then re-run.',
      dup_count;
  END IF;
END $$;

DROP INDEX IF EXISTS message_templates_user_name_language_key;

CREATE UNIQUE INDEX IF NOT EXISTS message_templates_account_name_language_key
  ON message_templates (account_id, name, language);
