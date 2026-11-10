/**
 * HWW access = same gate as the DABOS board: Clerk signed-in + DABOS_ALLOWED_EMAILS.
 * Founder 2026-11-10: do not keep a second HWW_ALLOWED_CLERK_USER_IDS wall —
 * Clerk already limits who can sign in; email allowlist is enough.
 */

export { isDabosEmailAllowlisted as isHwwAccessAllowed } from '@/lib/dabos/clerk-auth';
