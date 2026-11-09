/** Accent-insensitive matching for Vietnamese admin lists. */
export function matchesSearch(text: string, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  return normalize(text).includes(normalize(query.trim()));
}
/** Quote every cell and neutralize spreadsheet formulas in user supplied text. */
export function csvText(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const cell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[\s\uFEFF]*[=+\-@\t\r]/.test(text) || /^[\t\r]/.test(text))
      text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
  );
}
export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): void {
  const url = URL.createObjectURL(
    new Blob([csvText(headers, rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
