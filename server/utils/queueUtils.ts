/**
 * Returns today's date as "YYYY-MM-DD" in the server's local timezone.
 *
 * Queue entries are partitioned by calendar date so that the queue resets
 * at midnight local time, matching clinic operational hours.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Redacts a patient name for public display (waiting-room OSD).
 *
 * Each word is reduced to its first character followed by bullets so that
 * staff can verify the right patient is being called without exposing full
 * identities on a shared screen.
 *
 * @example
 * redactName("Budi Santoso") // → "B•••• S••••"
 * redactName("A")            // → "A"
 * redactName("")             // → ""
 */
export function redactName(fullName: string): string {
  if (!fullName || fullName.trim().length === 0) return fullName;
  return fullName
    .trim()
    .split(/\s+/)
    .map(word => (word.length <= 1 ? word : word[0] + "••••"))
    .join(" ");
}
