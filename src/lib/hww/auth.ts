/**
 * HWW is Logan-only by Clerk user id (stricter than DABOS email allowlist).
 * Empty HWW_ALLOWED_CLERK_USER_IDS = deny all (fail closed).
 */

export function hwwAllowedClerkUserIds(): Set<string> {
  const raw = process.env.HWW_ALLOWED_CLERK_USER_IDS?.trim() ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isHwwClerkUserAllowed(userId: string | undefined | null): boolean {
  const allowed = hwwAllowedClerkUserIds();
  if (allowed.size === 0) return false;
  if (!userId) return false;
  return allowed.has(userId);
}
