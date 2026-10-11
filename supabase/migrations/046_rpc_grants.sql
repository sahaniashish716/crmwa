-- ============================================================
-- 046_rpc_grants.sql — EXECUTE grants for SECURITY DEFINER RPCs
--
-- Same class of bug as 031 (claim_ai_reply_slot): functions run
-- with elevated privileges but callers still need EXECUTE. On
-- hardened Supabase, service_role / authenticated cannot invoke
-- these without explicit grants.
--
-- Idempotent — safe to re-run.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.record_webhook_failure(uuid, int) TO service_role;

GRANT EXECUTE ON FUNCTION public.touch_presence(text) TO authenticated;
