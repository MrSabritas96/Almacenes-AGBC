import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fuenteVera, fuenteVeraBold } from "@/components/modules/activos/pdf-assets";
import type { FilaKardexVehiculo } from "@/actions/activos/vehiculos-excel-consultas";

const pageWidth = 841.89;
const pageHeight = 595.28;
const margin = 32;
const columns = [
  { title: "N°", key: "fila", width: 34 },
  { title: "FECHA", key: "fecha", width: 62 },
  { title: "KILOMETRAJE", key: "kilometraje", width: 68 },
  { title: "DESCRIPCIÓN DEL MANTENIMIENTO", key: "descripcion", width: 202 },
  { title: "TALLER / PROVEEDOR", key: "taller", width: 102 },
  { title: "UNIDAD", key: "unidad", width: 64 },
  { title: "N° FACTURA", key: "factura", width: 64 },
  { title: "IMPORTE", key: "importe", width: 66 },
  { title: "OBSERVACIONES", key: "observaciones", width: 112 },
] as const;
const tableWidth = columns.reduce((total, column) => total + column.width, 0);
const ink = rgb(0.12, 0.18, 0.29);
const muted = rgb(0.36, 0.42, 0.53);
const blue = rgb(0.08, 0.22, 0.48);
const paleBlue = rgb(0.91, 0.95, 0.99);
const line = rgb(0.84, 0.88, 0.93);

function wrapped(text: string, font: PDFFont, size: number, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > width) {
      result.push(current);
      current = word;
    } else current = next;
  }
  if (current) result.push(current);
  return result.length ? result : ["—"];
}

export async function generarKardexVehiculoPdf(ficha: FilaKardexVehiculo) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(Buffer.from(fuenteVera, "base64"), { subset: true });
  const bold = await document.embedFont(Buffer.from(fuenteVeraBold, "base64"), { subset: true });
  const timestamp = new Date().toLocaleString("es-BO", { timeZone: "America/La_Paz" });
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let top = 0;

  const draw = (text: string, x: number, baselineTop: number, size: number, face: PDFFont = font, color = ink) => {
    page.drawText(text, { x, y: baselineTop - size, size, font: face, color, maxWidth: pageWidth - margin * 2 });
  };

  const newPage = () => {
    page = document.addPage([pageWidth, pageHeight]);
    pages.push(page);
    top = pageHeight - margin;
    draw("AGENCIA BOLIVIANA DE CORREOS", margin, top, 10, bold, blue);
    top -= 24;
    draw(`REGISTRO DE MANTENIMIENTOS · ${ficha.placa}`, margin, top, 17, bold, ink);
    top -= 25;
    draw(`${ficha.archivo} · Hoja ${ficha.hoja}`, margin, top, 8.5, font, muted);
    top -= 19;

    const resumen = [
      ficha.regional && `Regional Excel: ${ficha.regional}`,
      ficha.marca && `Marca: ${ficha.marca}`,
      ficha.modelo && `Modelo: ${ficha.modelo}`,
      ficha.anio && `Año: ${ficha.anio}`,
      ficha.chasis && `Chasis: ${ficha.chasis}`,
      ficha.conductor && `Conductor Excel: ${ficha.conductor}`,
    ].filter(Boolean).join("   ·   ");
    if (resumen) {
      const summaryLines = wrapped(resumen, font, 8, tableWidth);
      for (const text of summaryLines) {
        draw(text, margin, top, 8, font, muted);
        top -= 12;
      }
      top -= 5;
    }
    draw(`Emitido: ${timestamp}   ·   ${ficha.servicios.length} registro(s)`, margin, top, 8, font, muted);
    top -= 20;
    drawTableHeader();
  };

  const drawTableHeader = () => {
    const height = 25;
    page.drawRectangle({ x: margin, y: top - height, width: tableWidth, height, color: blue });
    let x = margin;
    for (const column of columns) {
      draw(column.title, x + 5, top - 8, 6.4, bold, rgb(1, 1, 1));
      x += column.width;
    }
    top -= height;
  };

  newPage();
  for (const service of ficha.servicios) {
    const values: Record<(typeof columns)[number]["key"], string> = {
      fila: String(service.fila),
      fecha: service.fecha || "—",
      kilometraje: service.kilometraje || "—",
      descripcion: service.descripcion || "—",
      taller: service.taller || "—",
      unidad: service.unidad || "—",
      factura: service.factura || "—",
      importe: service.importe || "—",
      observaciones: service.observaciones || "—",
    };
    const cells = columns.map(column => wrapped(values[column.key], font, 7.3, column.width - 10));
    const rowHeight = Math.max(24, ...cells.map(lines => lines.length * 9 + 8));
    if (top - rowHeight < margin + 25) {
      newPage();
    }

    if (pages.length % 2 === 0) {
      page.drawRectangle({ x: margin, y: top - rowHeight, width: tableWidth, height: rowHeight, color: paleBlue });
    }
    let x = margin;
    cells.forEach((cellLines, index) => {
      let lineTop = top - 6;
      for (const cellLine of cellLines) {
        draw(cellLine, x + 5, lineTop, 7.3, font, ink);
        lineTop -= 9;
      }
      x += columns[index]!.width;
    });
    page.drawLine({ start: { x: margin, y: top - rowHeight }, end: { x: margin + tableWidth, y: top - rowHeight }, thickness: 0.5, color: line });
    top -= rowHeight;
  }

  if (ficha.servicios.length === 0) {
    draw("La hoja no contiene registros de mantenimiento.", margin + 8, top - 12, 9, font, muted);
  }

  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: margin, y: 22 }, end: { x: margin + tableWidth, y: 22 }, thickness: 0.6, color: line });
    currentPage.drawText(`Documento generado desde el Excel original · Página ${index + 1} de ${pages.length}`, {
      x: margin, y: 10, size: 7, font, color: muted,
    });
  });

  return Buffer.from(await document.save());
}
