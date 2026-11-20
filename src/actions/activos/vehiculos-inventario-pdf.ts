import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fuenteVera, fuenteVeraBold } from "@/components/modules/activos/pdf-assets";
import type { consultarCategorias } from "./categorias-consultas";

type Vehiculo = Awaited<ReturnType<typeof consultarCategorias>>["registros"][number];
const width = 841.89;
const height = 595.28;
const margin = 30;
const columns = [
  { title: "N°", key: "numero", width: 28 },
  { title: "CÓDIGO", key: "codigo", width: 84 },
  { title: "PLACA", key: "placa", width: 58 },
  { title: "DESCRIPCIÓN DEL VEHÍCULO", key: "descripcion", width: 235 },
  { title: "CHASIS", key: "chasis", width: 105 },
  { title: "REGIONAL / UBICACIÓN", key: "regional", width: 90 },
  { title: "RESPONSABLE", key: "responsable", width: 125 },
  { title: "ESTADO", key: "estado", width: 55 },
] as const;
const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
const ink = rgb(0.12, 0.18, 0.29);
const muted = rgb(0.37, 0.43, 0.54);
const blue = rgb(0.08, 0.22, 0.48);
const pale = rgb(0.93, 0.96, 0.99);
const border = rgb(0.84, 0.88, 0.93);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

export async function generarInventarioVehiculosPdf(registros: Vehiculo[], filtros: { regional: string; q: string }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(Buffer.from(fuenteVera, "base64"), { subset: true });
  const bold = await pdf.embedFont(Buffer.from(fuenteVeraBold, "base64"), { subset: true });
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let top = 0;
  const draw = (text: string, x: number, yTop: number, size: number, font: PDFFont = regular, color = ink) => {
    page.drawText(text, { x, y: yTop - size, size, font, color });
  };

  const drawTableHeader = () => {
    const rowHeight = 25;
    page.drawRectangle({ x: margin, y: top - rowHeight, width: tableWidth, height: rowHeight, color: blue });
    let x = margin;
    for (const column of columns) {
      draw(column.title, x + 4, top - 8, 6.5, bold, rgb(1, 1, 1));
      x += column.width;
    }
    top -= rowHeight;
  };

  const newPage = () => {
    page = pdf.addPage([width, height]);
    pages.push(page);
    top = height - margin;
    draw("AGENCIA BOLIVIANA DE CORREOS", margin, top, 10, bold, blue);
    top -= 22;
    draw("INVENTARIO DE VEHÍCULOS Y MOTOCICLETAS", margin, top, 16, bold);
    top -= 22;
    const criterios = [filtros.regional && `Regional: ${filtros.regional}`, filtros.q && `Búsqueda: ${filtros.q}`].filter(Boolean).join(" · ") || "Todas las regionales y placas";
    for (const line of wrap(criterios, regular, 8, tableWidth)) {
      draw(line, margin, top, 8, regular, muted);
      top -= 12;
    }
    draw(`${registros.length} vehículo(s) · Emitido ${new Date().toLocaleString("es-BO", { timeZone: "America/La_Paz" })}`, margin, top, 8, regular, muted);
    top -= 18;
    drawTableHeader();
  };

  newPage();
  registros.forEach((item, index) => {
    const values: Record<(typeof columns)[number]["key"], string> = {
      numero: String(index + 1),
      codigo: item.codigo || "Sin código",
      placa: item.placa || item.fuentesExcel[0]?.placa || "Sin placa",
      descripcion: item.descripcion,
      chasis: item.chasisInventario || item.fuentesExcel[0]?.chasis || "Sin dato",
      regional: [item.regionalNombre, item.ubicacion].filter(Boolean).join(" / "),
      responsable: item.responsable || "Sin responsable",
      estado: item.estado || "Sin estado",
    };
    const lines = columns.map((column) => wrap(values[column.key], regular, 7.2, column.width - 8));
    const rowHeight = Math.max(24, ...lines.map((cellLines) => cellLines.length * 9 + 8));
    if (top - rowHeight < margin + 26) newPage();
    if (index % 2 === 1) page.drawRectangle({ x: margin, y: top - rowHeight, width: tableWidth, height: rowHeight, color: pale });
    let x = margin;
    lines.forEach((cellLines, columnIndex) => {
      let y = top - 6;
      for (const text of cellLines) {
        draw(text, x + 4, y, 7.2);
        y -= 9;
      }
      x += columns[columnIndex]!.width;
    });
    page.drawLine({ start: { x: margin, y: top - rowHeight }, end: { x: margin + tableWidth, y: top - rowHeight }, thickness: 0.5, color: border });
    top -= rowHeight;
  });

  if (!registros.length) draw("No hay vehículos para los filtros seleccionados.", margin + 8, top - 12, 9, regular, muted);
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: margin, y: 22 }, end: { x: margin + tableWidth, y: 22 }, thickness: 0.6, color: border });
    current.drawText(`Inventario institucional · Página ${index + 1} de ${pages.length}`, { x: margin, y: 10, size: 7, font: regular, color: muted });
  });
  return Buffer.from(await pdf.save());
}
