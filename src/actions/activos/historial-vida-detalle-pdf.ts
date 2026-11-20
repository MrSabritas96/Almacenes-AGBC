import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fuenteVera, fuenteVeraBold } from "@/components/modules/activos/pdf-assets";

export type FilaDetalleHistoricoPdf = {
  codigo: string | null;
  codigoHistorico: string | null;
  grupo: string | null;
  grupoCodigo: string | null;
  descripcion: string;
  fechaHistorica: string | null;
  vidaUtil: string | null;
  porcentaje: string | null;
  costoHistorico: string | null;
  costoMigrado: string | null;
  costoActualizado: string | null;
  depreciacionGestion: string | null;
  depreciacionAcumulada: string | null;
  valorNeto: string | null;
  hoja: string;
  vigencia: string;
  archivo: string;
  importadoEn: Date;
  origen: string;
};

const pageWidth = 1190.55;
const pageHeight = 841.89;
const margin = 28;
const columns = [
  { title: "CÓDIGO", width: 70 },
  { title: "GRUPO CONTABLE", width: 95 },
  { title: "DESCRIPCIÓN", width: 160 },
  { title: "FECHA HISTÓRICA", width: 65 },
  { title: "VIDA ÚTIL", width: 48 },
  { title: "COSTO HISTÓRICO", width: 90 },
  { title: "COSTO MIGRADO", width: 76 },
  { title: "COSTO ACTUALIZADO", width: 88 },
  { title: "DEPRECIACIÓN GESTIÓN", width: 83 },
  { title: "DEPRECIACIÓN ACUMULADA", width: 90 },
  { title: "VALOR NETO", width: 72 },
  { title: "HOJA / CORTE", width: 105 },
] as const;
const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
const navy = rgb(0.08, 0.17, 0.36);
const blue = rgb(0.12, 0.27, 0.6);
const gold = rgb(1, 0.78, 0.16);
const ink = rgb(0.1, 0.15, 0.24);
const muted = rgb(0.38, 0.44, 0.54);
const border = rgb(0.86, 0.89, 0.93);
const pale = rgb(0.96, 0.97, 0.99);
const amber = rgb(0.59, 0.35, 0.02);
const green = rgb(0.02, 0.45, 0.32);

function wrap(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
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
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `Bs ${new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
    : "—";
}

export async function generarDetalleHistoricoPdf(
  rows: FilaDetalleHistoricoPdf[],
  logoBytes: Uint8Array,
  options: { total: number; page: number; pages: number; group: string; query: string },
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(Buffer.from(fuenteVera, "base64"), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fuenteVeraBold, "base64"), { subset: true });
  const logo = await pdf.embedPng(logoBytes);
  let page!: PDFPage;
  let y = 0;
  let pageNumber = 0;
  const now = new Date();
  const draw = (text: string, x: number, baseline: number, size: number, font = regular, color = ink) => {
    page.drawText(text, { x, y: baseline, size, font, color });
  };

  const drawTableHeader = () => {
    const top = y;
    const headerHeight = 34;
    page.drawRectangle({ x: margin, y: top - headerHeight, width: tableWidth, height: headerHeight, color: navy });
    let x = margin;
    columns.forEach((column, index) => {
      const lines = wrap(column.title, bold, 5.8, column.width - 8).slice(0, 3);
      lines.forEach((line, lineIndex) => draw(line, x + 4, top - (lines.length === 1 ? 20 : 9 + lineIndex * 8), 5.8, bold, rgb(1, 1, 1)));
      if (index) page.drawLine({ start: { x, y: top }, end: { x, y: top - headerHeight }, color: rgb(0.36, 0.43, 0.59), thickness: 0.5 });
      x += column.width;
    });
    y -= headerHeight;
  };

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    pageNumber += 1;
    page.drawRectangle({ x: 0, y: pageHeight - 5, width: pageWidth, height: 5, color: gold });
    page.drawImage(logo, { x: margin, y: pageHeight - 91, width: 138, height: 64 });
    page.drawText("AGENCIA BOLIVIANA DE CORREOS", { x: 210, y: pageHeight - 43, size: 8, font: bold, color: blue });
    page.drawText("DETALLE CONTABLE E HISTÓRICO DE ACTIVOS", { x: 210, y: pageHeight - 69, size: 15, font: bold, color: navy });
    const meta = [
      `${options.total.toLocaleString("es-BO")} registros · página ${options.page} de ${options.pages}`,
      options.group ? `Grupo: ${options.group}` : "Todos los grupos contables",
      options.query ? `Búsqueda: ${options.query}` : "",
      `Emitido ${new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", dateStyle: "long" }).format(now)}`,
    ].filter(Boolean).join(" · ");
    const metaLines = wrap(meta, regular, 7, pageWidth - margin * 2);
    metaLines.slice(0, 2).forEach((line, index) => draw(line, margin, pageHeight - 111 - index * 11, 7, regular, muted));
    const headerBottom = pageHeight - 139;
    page.drawLine({ start: { x: margin, y: headerBottom }, end: { x: pageWidth - margin, y: headerBottom }, color: border, thickness: 0.7 });
    y = headerBottom - 10;
    drawTableHeader();
  };

  newPage();
  rows.forEach((row, index) => {
    const vigencia = row.vigencia === "vigente" ? "Vigente" : "Histórico";
    const life = row.vidaUtil ? `${row.vidaUtil} años${row.porcentaje ? ` · ${row.porcentaje}%` : ""}` : "—";
    const source = [
      vigencia,
      row.origen,
      row.hoja,
      row.archivo,
      `Importado ${new Intl.DateTimeFormat("es-BO", { dateStyle: "short" }).format(row.importadoEn)}`,
    ].filter(Boolean).join("\n");
    const values = [
      `${row.codigo || row.codigoHistorico || "Sin código"}\n${row.origen}`,
      `${row.grupo || "Sin grupo"}${row.grupoCodigo ? `\n${row.grupoCodigo}` : ""}`,
      row.descripcion,
      row.fechaHistorica ? String(row.fechaHistorica).slice(0, 10) : "—",
      life,
      money(row.costoHistorico),
      money(row.costoMigrado),
      money(row.costoActualizado),
      money(row.depreciacionGestion),
      money(row.depreciacionAcumulada),
      money(row.valorNeto),
      source,
    ];
    const cells = values.map((value, cellIndex) => value.split("\n").flatMap((line) => wrap(line, cellIndex <= 1 ? bold : regular, 6.1, columns[cellIndex]!.width - 8)));
    const maxLines = Math.max(...cells.map((cell) => cell.length));
    const rowHeight = Math.max(24, maxLines * 8 + 10);
    if (y - rowHeight < 44) newPage();
    if (index % 2) page.drawRectangle({ x: margin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: pale });
    let x = margin;
    cells.forEach((cell, cellIndex) => {
      cell.forEach((line, lineIndex) => {
        const color = cellIndex === 11 && lineIndex === 0 ? (row.vigencia === "vigente" ? green : amber) : cellIndex <= 1 ? navy : ink;
        draw(line, x + 4, y - 12 - lineIndex * 8, 6.1, cellIndex <= 1 ? bold : regular, color);
      });
      x += columns[cellIndex]!.width;
    });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: margin + tableWidth, y: y - rowHeight }, color: border, thickness: 0.45 });
    y -= rowHeight;
  });

  pdf.getPages().forEach((current, index) => {
    const label = `Página ${index + 1} de ${pageNumber}`;
    current.drawText("Control contable · Agencia Boliviana de Correos", { x: margin, y: 18, size: 7, font: regular, color: muted });
    current.drawText(label, { x: pageWidth - margin - regular.widthOfTextAtSize(label, 7), y: 18, size: 7, font: regular, color: muted });
  });
  pdf.setTitle("Detalle contable e histórico de activos");
  return Buffer.from(await pdf.save());
}
