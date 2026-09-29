export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function redactName(fullName: string): string {
  if (!fullName || fullName.length <= 1) return fullName;
  return fullName[0] + "••••";
}
