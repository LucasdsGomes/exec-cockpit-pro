export function downloadCsv<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  headers?: { key: keyof T; label: string }[],
) {
  if (!rows.length) return;
  const cols = headers ?? Object.keys(rows[0]).map((k) => ({ key: k as keyof T, label: k }));
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[";\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    cols.map((c) => escape(c.label)).join(";"),
    ...rows.map((r) => cols.map((c) => escape(r[c.key])).join(";")),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}