/** Comma-separated `adgen_users.id` values. Empty means nobody. */
export function ownerUserIds(): Set<string> {
  return new Set(
    (process.env.OWNER_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function isOwnerUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return ownerUserIds().has(userId);
}
