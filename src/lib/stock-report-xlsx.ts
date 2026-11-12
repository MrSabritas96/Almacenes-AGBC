import ExcelJS from 'exceljs';
import { addExcelHeading, excelBannerPath, styleExcelColumns } from './excel-heading';
import { institutionalStockReport, stockReportNote, stockReportTitles, type StockReportKind } from './institutional-stock-report';
import { categoryInfo } from './warehouse-reference';
import type { stockSummary } from './stock-report';
import type { Purchase } from './warehouse';

type StockRow = ReturnType<typeof stockSummary>[number];
type WorkbookInput = {
  rows: StockRow[]; purchases: Purchase[]; from: string; to: string; context: string;
  includeEmpty: boolean; selected: StockReportKind | 'detail';
  scope?: 'selected' | 'all' | 'eeff';
  banner: string;
};
const names = { reconciliation: 'Conciliación', purchases: 'Ingresos por compras', outgoing: 'Salidas por partida', balances: 'Saldos por partida', institutional: 'Resumen institucional', detail: 'Detalle de Almacen' };
const headerRow = 7;
const first = headerRow + 1;
const numberFormat = '#,##0.00;[Red](#,##0.00);0.00';

/** Archivo OOXML real. El navegador lo genera con los datos ya autorizados del almacén. */
export function createStockWorkbook(input: WorkbookInput) {
  if (!input.from || !input.to || input.from > input.to) throw new Error('Revisa el intervalo de fechas.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agencia Boliviana de Correos';
  workbook.calcProperties.fullCalcOnLoad = true;
  const banner = workbook.addImage({ base64: input.banner, extension: 'png' });
  const formatDate = (day: string) => new Intl.DateTimeFormat('es-BO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const period = input.from === input.to || (input.from.endsWith('-01-01') && input.to === `${input.from.slice(0, 4)}-12-31`)
    ? `Al ${formatDate(input.to)}` : `Del ${formatDate(input.from)} al ${formatDate(input.to)}`;
  const formula = (sheet: ExcelJS.Worksheet, row: number, column: number, expression: string, result: number) => {
    sheet.getCell(row, column).value = { formula: expression, result };
  };
  function sheet(kind: keyof typeof names, headers: string[], widths: number[]) {
    const ws = workbook.addWorksheet(names[kind], {
      properties: { defaultRowHeight: 23 },
      views: [{ state: 'frozen', ySplit: headerRow, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: headers.length > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `1:${headerRow}`, margins: { left: .25, right: .25, top: .3, bottom: .3, header: .15, footer: .15 } },
    });
    ws.columns = widths.map(width => ({ width }));
    const title = kind === 'detail' ? 'Detalle de almacenes (bienes de consumo)' : stockReportTitles[kind];
    addExcelHeading(ws, banner, title, { period, monetary: true, context: input.context });
    styleExcelColumns(ws, headerRow, headers, kind === 'purchases' || kind === 'detail' ? 31 : kind === 'balances' || kind === 'institutional' ? 31 : 23);
    ws.headerFooter.oddFooter = 'AGBC · &A · Página &P de &N';
    return ws;
  }
  function finish(ws: ExcelJS.Worksheet, total: number, columns: number, signatures = false) {
    for (let row = headerRow; row <= total; row++) {
      ws.getRow(row).eachCell({ includeEmpty: true }, (cell, column) => {
        if (column > columns) return;
        cell.border = { top: { style: 'thin', color: { argb: 'FF8A9DB4' } }, bottom: { style: row === total ? 'double' : 'thin', color: { argb: 'FF8A9DB4' } }, left: { style: 'thin', color: { argb: 'FF8A9DB4' } }, right: { style: 'thin', color: { argb: 'FF8A9DB4' } } };
        if (row < first) return;
        cell.font = { name: 'Arial', size: 10, bold: row === total };
        cell.alignment = { vertical: 'middle', wrapText: true, horizontal: typeof cell.value === 'number' || cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Date ? 'right' : 'left' };
        if (typeof cell.value === 'number' || cell.type === ExcelJS.ValueType.Formula) cell.numFmt = column === 1 ? '0' : numberFormat;
        if (row === total) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      });
    }
    ws.mergeCells(total + 1, 1, total + 1, columns);
    ws.getCell(total + 1, 1).value = stockReportNote;
    ws.getCell(total + 1, 1).alignment = { wrapText: true, vertical: 'top' };
    ws.getCell(total + 1, 1).font = { name: 'Arial', size: 9 };
    ws.getRow(total + 1).height = columns < 4 ? 100 : 72;
    let end = total + 1;
    if (signatures) {
      for (const [row, start, stop, label] of [[total + 4, 1, 3, 'Firma Contabilidad'], [total + 4, 4, 6, 'Firma Responsable'], [total + 7, 2, 5, 'Firma DGAA - DAF']] as const) {
        ws.mergeCells(row, start, row, stop);
        const cell = ws.getCell(row, start); cell.value = label;
        cell.border = { top: { style: 'thin' } }; cell.font = { name: 'Arial', size: 10, bold: true };
        cell.alignment = { horizontal: 'center' };
      }
      end = total + 7;
    }
    ws.pageSetup.printArea = `A1:${ws.getColumn(columns).letter}${end}`;
    if (total > first) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: total - 1, column: columns } };
  }
  const reconciliation = sheet('reconciliation', ['Concepto', 'Monto Bs'], [78, 26]);
  const purchases = sheet('purchases', ['N°', 'Fecha', 'Partida', 'Detalle de compra', 'Factura', 'Entrada PEPS / referencia', 'Proveedor', 'Cantidad', 'Costo unitario Bs', 'Monto Bs'], [7, 15, 15, 48, 20, 24, 28, 15, 20, 22]);
  const outgoing = sheet('outgoing', ['Partida', 'Descripción', 'Monto Bs'], [17, 64, 24]);
  const headers = ['N°', 'Partida', `Cantidad inicial al ${input.from}`, `Saldo inicial Bs al ${input.from}`, `Cantidad final al ${input.to}`, `Saldo final Bs al ${input.to}`];
  const balances = sheet('balances', headers, [7, 57, 22, 24, 22, 24]);
  const institutional = sheet('institutional', headers, [7, 57, 22, 24, 22, 24]);
  const hasDescription=input.rows.some(row=>row.description?.trim());
  const firstQuantity=hasDescription?7:6;
  const detail = sheet('detail', ['N°', 'Código', 'Artículo', 'Unidad', 'Partida', ...(hasDescription?['Descripción']:[]), 'Cantidad inicial', 'Entradas cantidad', 'Salidas / reservas cantidad', 'Cantidad final', 'Saldo inicial Bs', 'Entradas Bs', 'Salidas / reservas Bs', 'Saldo final Bs'], [7, 20, 48, 18, 16, ...(hasDescription?[48]:[]), 18, 18, 20, 18, 22, 22, 22, 22]);
  const detailColumn=(offset:number)=>detail.getColumn(firstQuantity+offset).letter;
  input.rows.forEach((r, index) => {
    const n = first + index;
    detail.getRow(n).values = [index + 1, r.code, r.name, r.unit, categoryInfo(r.category)?.code ?? r.category, ...(hasDescription?[r.description?.trim()||'']:[]), r.opening, r.incoming, r.outgoing, r.closing, r.openingValue, r.incomingValue, r.outgoingValue, r.closingValue];
    detail.getRow(n).height = 38;
    formula(detail, n, firstQuantity+3, `${detailColumn(0)}${n}+${detailColumn(1)}${n}-${detailColumn(2)}${n}`, r.closing);
    formula(detail, n, firstQuantity+7, `${detailColumn(4)}${n}+${detailColumn(5)}${n}-${detailColumn(6)}${n}`, r.closingValue);
  });
  const detailTotal = first + input.rows.length;
  detail.getCell(detailTotal, 3).value = 'TOTAL';
  for (let col = firstQuantity; col <= firstQuantity+7; col++) {
    const letter = detail.getColumn(col).letter;
    const keys = ['opening', 'incoming', 'outgoing', 'closing', 'openingValue', 'incomingValue', 'outgoingValue', 'closingValue'] as const;
    formula(detail, detailTotal, col, detailTotal > first ? `SUM(${letter}${first}:${letter}${detailTotal - 1})` : '0', input.rows.reduce((sum, r) => sum + r[keys[col - firstQuantity]!], 0));
  }
  const orderedPurchases = [...input.purchases].sort((a, b) => a.purchased_on.localeCompare(b.purchased_on) || a.id.localeCompare(b.id));
  orderedPurchases.forEach((p, index) => {
    const n = first + index;
    purchases.getRow(n).values = [index + 1, new Date(`${p.purchased_on}T12:00:00Z`), categoryInfo(p.category ?? '')?.code ?? p.category ?? 'Sin partida', p.invoice_description || p.material, p.invoice_number, p.batch_id ? `E-${String(p.batch_id).padStart(6, '0')}` : p.id, p.supplier, p.quantity, Number(p.unit_cost), p.quantity * Number(p.unit_cost)];
    purchases.getRow(n).height = 42;
    formula(purchases, n, 10, `H${n}*I${n}`, p.quantity * Number(p.unit_cost));
    purchases.getCell(n, 2).numFmt = 'dd/mm/yyyy';
  });
  const purchaseTotal = first + orderedPurchases.length;
  const purchaseAmount = input.purchases.reduce((sum, p) => sum + p.quantity * Number(p.unit_cost), 0);
  purchases.getCell(purchaseTotal, 4).value = 'TOTAL';
  formula(purchases, purchaseTotal, 10, purchaseTotal > first ? `SUM(J${first}:J${purchaseTotal - 1})` : '0', purchaseAmount);
  const grouped = institutionalStockReport('balances', input.rows, input.purchases, input.from, input.to, input.includeEmpty, value => value);
  grouped.records.slice(0, -1).forEach((record, index) => {
    const n = first + index, values = Object.values(record);
    balances.getRow(n).values = values;
    institutional.getRow(n).values = values;
    const group = grouped.groups[index]!, code = group.code;
    outgoing.getRow(n).values = [code, group.name, 0];
    for (const ws of [balances, institutional, outgoing]) ws.getRow(n).height = 42;
    // Escapar comillas y comodines conserva literalmente las etiquetas históricas en SUMIF.
    const criterion = `"${code.replaceAll('~','~~').replaceAll('*','~*').replaceAll('?','~?').replaceAll('"','""')}"`;
    for (const [column, source] of [[3, detailColumn(0)], [4, detailColumn(4)], [5, detailColumn(3)], [6, detailColumn(7)]] as const) {
      formula(balances, n, column, `SUMIF('${names.detail}'!E${first}:E${Math.max(first, detailTotal - 1)},${criterion},'${names.detail}'!${source}${first}:${source}${Math.max(first, detailTotal - 1)})`, Number(values[column - 1]));
      formula(institutional, n, column, `'${names.balances}'!${balances.getColumn(column).letter}${n}`, Number(values[column - 1]));
    }
    const value = group.outgoingValue;
    formula(outgoing, n, 3, `SUMIF('${names.detail}'!E${first}:E${Math.max(first, detailTotal - 1)},${criterion},'${names.detail}'!${detailColumn(6)}${first}:${detailColumn(6)}${Math.max(first, detailTotal - 1)})`, value);
  });
  const groupTotal = first + grouped.records.length - 1;
  for (const ws of [balances, institutional, outgoing]) {
    ws.getCell(groupTotal, 2).value = 'TOTAL';
    for (let col = 3; col <= (ws === outgoing ? 3 : 6); col++) {
      const letter = ws.getColumn(col).letter;
      const value = ws === outgoing ? grouped.totals.outgoing : Number(Object.values(grouped.records.at(-1)!)[col - 1]);
      formula(ws, groupTotal, col, groupTotal > first ? `SUM(${letter}${first}:${letter}${groupTotal - 1})` : '0', value);
    }
    finish(ws, groupTotal, ws === outgoing ? 3 : 6, ws === institutional);
  }
  const amounts = [grouped.totals.opening, purchaseAmount, grouped.totals.incoming - purchaseAmount, grouped.totals.outgoing, grouped.totals.closing];
  ['INVENTARIO INICIAL', 'MÁS: COMPRAS DEL PERIODO', 'MÁS: OTROS INGRESOS', 'MENOS: SALIDAS / RESERVAS / AJUSTES', 'INVENTARIO FINAL DISPONIBLE'].forEach((label, index) => {
    reconciliation.getCell(first + index, 1).value = label;
    const expressions = [`'${names.detail}'!${detailColumn(4)}${detailTotal}`, `'${names.purchases}'!J${purchaseTotal}`, `'${names.detail}'!${detailColumn(5)}${detailTotal}-B${first + 1}`, `'${names.detail}'!${detailColumn(6)}${detailTotal}`, `B${first}+B${first + 1}+B${first + 2}-B${first + 3}`];
    formula(reconciliation, first + index, 2, expressions[index]!, amounts[index]!);
    reconciliation.getRow(first + index).height = 34;
  });
  finish(reconciliation, first + 4, 2); finish(purchases, purchaseTotal, 10); finish(detail, detailTotal, firstQuantity+7);
  if (input.scope === 'eeff') workbook.removeWorksheet(institutional.id);
  if (input.scope === 'selected') {
    const selected = workbook.getWorksheet(names[input.selected])!;
    // Una exportación individual conserva los importes de las hojas que no se incluyen.
    // Las fórmulas internas del cuadro siguen siendo editables y recalculables.
    selected.eachRow(row => row.eachCell(cell => {
      if (cell.type === ExcelJS.ValueType.Formula && cell.formula.includes('!')) {
        const result = cell.result;
        if (typeof result !== 'number') throw new Error('El cuadro contiene una fórmula sin resultado.');
        cell.value = result;
      }
    }));
    for (const ws of [...workbook.worksheets]) if (ws !== selected) workbook.removeWorksheet(ws.id);
  }
  workbook.views = [{ x: 0, y: 0, width: 1200, height: 800, visibility: 'visible', activeTab: !input.scope || input.scope === 'all' ? Object.keys(names).indexOf(input.selected) : 0, firstSheet: 0 }];
  return workbook;
}

export async function stockWorkbookBytes(input: Omit<WorkbookInput, 'banner'>) {
  async function loadBanner(): Promise<string> {
    const response = await fetch(excelBannerPath);
    if (!response.ok) throw new Error('No se pudieron cargar los logos institucionales.');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer el logo institucional.'));
      reader.readAsDataURL(blob);
    });
  }
  return createStockWorkbook({ ...input, banner: await loadBanner() }).xlsx.writeBuffer();
}
