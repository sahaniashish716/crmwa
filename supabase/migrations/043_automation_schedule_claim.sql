-- Atomic schedule claim for time_based automations (prevents double-fire
-- when two cron invocations overlap before last_executed_at is updated).

CREATE OR REPLACE FUNCTION try_claim_automation_schedule(p_automation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE automations
  SET last_executed_at = NOW()
  WHERE id = p_automation_id
    AND (
      last_executed_at IS NULL
      OR last_executed_at < NOW() - INTERVAL '50 seconds'
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION try_claim_automation_schedule(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION try_claim_automation_schedule(UUID) FROM anon;
REVOKE ALL ON FUNCTION try_claim_automation_schedule(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION try_claim_automation_schedule(UUID) TO service_role;
