/** Case-insensitive, trimmed; the full name or just the first name both count. */
export function nameMatches(typed: unknown, name: string): boolean {
  const value = typeof typed === "string" ? typed.trim().replace(/\s+/g, " ").toLowerCase() : "";
  if (!value) return false;
  const full = name.trim().replace(/\s+/g, " ").toLowerCase();
  const first = full.split(" ")[0] ?? full;
  return value === full || value === first;
}
