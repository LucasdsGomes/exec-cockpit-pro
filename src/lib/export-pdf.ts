import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

export interface PdfColumn<T> {
  key: keyof T | string;
  label: string;
  align?: "left" | "right" | "center";
  format?: (v: unknown, row: T) => string;
}

export interface PdfReportOptions<T> {
  title: string;
  subtitle?: string;
  filename: string;
  rows: T[];
  columns: PdfColumn<T>[];
  /** Optional summary lines printed below the title. */
  summary?: { label: string; value: string }[];
}

export function downloadPdfReport<T extends Record<string, unknown>>({
  title,
  subtitle,
  filename,
  rows,
  columns,
  summary,
}: PdfReportOptions<T>) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 40, 50);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(subtitle, 40, 68);
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    pageWidth - 40,
    50,
    { align: "right" },
  );

  let startY = subtitle ? 90 : 75;

  // Summary block
  if (summary && summary.length) {
    doc.setTextColor(40);
    doc.setFontSize(9);
    summary.forEach((s, i) => {
      const x = 40 + (i % 4) * 130;
      const y = startY + Math.floor(i / 4) * 28;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(s.label.toUpperCase(), x, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      doc.text(s.value, x, y + 12);
    });
    startY += Math.ceil(summary.length / 4) * 28 + 10;
  }

  const head: RowInput[] = [columns.map((c) => c.label)];
  const body: RowInput[] = rows.map((row) =>
    columns.map((c) => {
      const raw = (row as Record<string, unknown>)[c.key as string];
      return c.format ? c.format(raw, row) : raw == null ? "" : String(raw);
    }),
  );

  autoTable(doc, {
    head,
    body,
    startY,
    theme: "grid",
    headStyles: { fillColor: [22, 30, 46], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: 30 },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, { halign: c.align ?? "left" }]),
    ),
    margin: { left: 40, right: 40 },
  });

  doc.save(`${filename}.pdf`);
}