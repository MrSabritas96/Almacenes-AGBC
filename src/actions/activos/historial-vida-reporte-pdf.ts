import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fuenteVera, fuenteVeraBold } from "@/components/modules/activos/pdf-assets";

export type FilaReporteContable = {
  grupo: string;
  cantidad: number;
  vidaMin: string | null;
  vidaMax: string | null;
  costoHistorico: string | null;
  costoActualizado: string | null;
  depreciacionGestion: string | null;
  depreciacionAcumulada: string | null;
  valorNeto: string | null;
};

const width = 841.89;
const height = 595.28;
const margin = 28;
const columns = [
  { title: "GRUPO CONTABLE", width: 170 },
  { title: "CANT.", width: 40 },
  { title: "VIDA ÚTIL", width: 54 },
  { title: "COSTO HISTÓRICO", width: 83 },
  { title: "COSTO ACTUALIZADO", width: 91 },
  { title: "DEPRECIACIÓN GESTIÓN", width: 91 },
  { title: "DEPRECIACIÓN ACUMULADA", width: 104 },
  { title: "VALOR NETO", width: 85 },
] as const;
const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
const ink = rgb(0.1, 0.15, 0.24);
const muted = rgb(0.38, 0.44, 0.54);
const navy = rgb(0.08, 0.17, 0.36);
const blue = rgb(0.12, 0.27, 0.6);
const gold = rgb(1, 0.78, 0.16);
const border = rgb(0.86, 0.89, 0.93);
const pale = rgb(0.96, 0.97, 0.99);

function wrap(value: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of value.replace(/[\x00-\x1F\x7F]/g, " ").split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function money(value: string | null) {
  if (!value) return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `Bs ${new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)}`
    : "—";
}

export async function generarReporteConjuntoPdf(
  rows: FilaReporteContable[],
  logoBytes: Uint8Array,
  options: { listado: string; emitido: string; total: number },
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(Buffer.from(fuenteVera, "base64"), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fuenteVeraBold, "base64"), { subset: true });
  const logo = await pdf.embedPng(logoBytes);
  let page!: PDFPage;
  let y = 0;
  let pageNumber = 0;

  const draw = (text: string, x: number, baseline: number, size: number, font = regular, color = ink) => {
    page.drawText(text, { x, y: baseline, size, font, color, maxWidth: width - x - margin });
  };

  const drawTableHeader = () => {
    const rowHeight = 31;
    const top = y;
    page.drawRectangle({ x: margin, y: top - rowHeight, width: tableWidth, height: rowHeight, color: navy });
    let x = margin;
    columns.forEach((column, index) => {
      const lines = wrap(column.title, bold, 6.2, column.width - 8);
      lines.slice(0, 2).forEach((line, lineIndex) => draw(line, x + 4, top - (lines.length === 1 ? 18 : 10 + lineIndex * 9), 6.2, bold, rgb(1, 1, 1)));
      if (index) page.drawLine({ start: { x, y: top }, end: { x, y: top - rowHeight }, color: rgb(0.36, 0.43, 0.59), thickness: 0.5 });
      x += column.width;
    });
    y -= rowHeight;
  };

  const newPage = () => {
    page = pdf.addPage([width, height]);
    pageNumber += 1;
    page.drawRectangle({ x: 0, y: height - 5, width, height: 5, color: gold });
    page.drawImage(logo, { x: margin, y: height - 94, width: 138, height: 64 });
    const centerStart = 180;
    const title = "RESUMEN DE ACTIVOS FIJOS POR GRUPO CONTABLE";
    const titleSize = 15;
    const titleWidth = bold.widthOfTextAtSize(title, titleSize);
    page.drawText("AGENCIA BOLIVIANA DE CORREOS", {
      x: centerStart,
      y: height - 45,
      size: 8,
      font: bold,
      color: blue,
    });
    page.drawText(title, {
      x: Math.max(centerStart, (width + centerStart - titleWidth) / 2),
      y: height - 70,
      size: titleSize,
      font: bold,
      color: navy,
    });
    page.drawLine({ start: { x: margin, y: height - 108 }, end: { x: width - margin, y: height - 108 }, color: border, thickness: 0.8 });
    draw("ENTIDAD", margin, height - 128, 7, bold, muted);
    draw("Agencia Boliviana de Correos", margin + 48, height - 128, 7, regular);
    draw("LISTADO", 290, height - 128, 7, bold, muted);
    draw(options.listado, 337, height - 128, 7, regular);
    draw("EMITIDO", 566, height - 128, 7, bold, muted);
    draw(options.emitido, 614, height - 128, 7, regular);
    draw(`${options.total.toLocaleString("es-BO")} registros fuente`, margin, height - 147, 7, regular, muted);
    y = height - 166;
    drawTableHeader();
  };

  newPage();
  rows.forEach((row, index) => {
    const years = row.vidaMin
      ? row.vidaMin === row.vidaMax ? `${row.vidaMin} años` : `${row.vidaMin}–${row.vidaMax} años`
      : "—";
    const values = [
      row.grupo || "Sin grupo contable",
      row.cantidad.toLocaleString("es-BO"),
      years,
      money(row.costoHistorico),
      money(row.costoActualizado),
      money(row.depreciacionGestion),
      money(row.depreciacionAcumulada),
      money(row.valorNeto),
    ];
    const cells = values.map((value, cellIndex) => wrap(value, cellIndex === 0 ? bold : regular, 7, columns[cellIndex]!.width - 9));
    const lines = Math.max(...cells.map((cell) => cell.length));
    const rowHeight = Math.max(26, lines * 9 + 12);
    if (y - rowHeight < 44) newPage();
    if (index % 2) page.drawRectangle({ x: margin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: pale });
    let x = margin;
    cells.forEach((cell, cellIndex) => {
      cell.forEach((line, lineIndex) => draw(line, x + 4, y - 13 - lineIndex * 9, 7, cellIndex === 0 ? bold : regular, cellIndex === 0 ? navy : ink));
      x += columns[cellIndex]!.width;
    });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: margin + tableWidth, y: y - rowHeight }, color: border, thickness: 0.45 });
    y -= rowHeight;
  });

  pdf.getPages().forEach((current, index) => {
    const label = `Página ${index + 1} de ${pageNumber}`;
    current.drawText("Reporte contable · Agencia Boliviana de Correos", { x: margin, y: 18, size: 7, font: regular, color: muted });
    current.drawText(label, { x: width - margin - regular.widthOfTextAtSize(label, 7), y: 18, size: 7, font: regular, color: muted });
  });
  pdf.setTitle("Resumen de activos fijos por grupo contable");
  pdf.setSubject("Reporte conjunto de inventario y vida histórica de activos");
  return Buffer.from(await pdf.save());
}
