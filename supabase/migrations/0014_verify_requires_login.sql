-- ============ 0014 — Certificate verification is for signed-in visitors ============
--
-- The owner asked for this on 29 Sep: downloads and /verify/[number] should work for
-- logged-in people only. Downloads already were (the file route answers 401 without a
-- session), so this migration and proxy.ts close the other half from both sides:
--
--   * proxy.ts sends a signed-out visitor to /login?next=/verify/<number> before the
--     page ever renders, and
--   * the anon role loses EXECUTE on get_public_certificate(), so the lookup cannot be
--     called around the page through PostgREST either.
--
-- The page runs with the caller's session cookie, i.e. as `authenticated`, so nothing
-- else changes: same fields, same 30 lookups a minute per address, same audit line.
--
-- Re-runnable: revoking a grant that is not held, and granting one that is, are both
-- no-ops. `public` is named as well as `anon`: PostgreSQL gives every function EXECUTE
-- to PUBLIC by default, and that default is what a sessionless caller would use.

revoke execute on function public.get_public_certificate(text) from public, anon;
grant execute on function public.get_public_certificate(text) to authenticated;
