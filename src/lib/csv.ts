/** Quotes a CSV field and neutralizes spreadsheet formula prefixes in user data. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\t\r\n]|^\s*[=+@\-＝＋＠－]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
