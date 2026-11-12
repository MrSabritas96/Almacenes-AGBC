import ExcelJS from 'exceljs';
import { inflateRawSync } from 'node:zlib';
import { WarehouseError } from './warehouse-errors';
import { todayInBolivia } from './warehouse-validation';

export const maxWorkbookBytes = 2 * 1024 * 1024;
const expandedLimit = 16 * 1024 * 1024;

// Inspect ZIP entries before ExcelJS allocates their expanded XML.
function checkZip(bytes: Buffer) {
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < Math.max(0, bytes.length - 65557)) throw new Error();
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  let remaining = expandedLimit;
  if (count > 256 || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) throw new Error();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error();
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const size = bytes.readUInt32LE(offset + 24);
    const local = bytes.readUInt32LE(offset + 42);
    if (size > remaining || local + 30 > end || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error();
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressed > end || ![0, 8].includes(method)) throw new Error();
    const actual = method === 0 ? compressed :
      inflateRawSync(bytes.subarray(start, start + compressed), { maxOutputLength: Math.max(1, size) }).length;
    if (actual !== size) throw new Error();
    remaining -= actual;
    offset += 46 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  if (offset !== end) throw new Error();
}

export async function readWarehouseWorkbook(bytes: Buffer) {
  if (!bytes.length || bytes.length > maxWorkbookBytes) throw new WarehouseError('Selecciona un Excel .xlsx de hasta 2 MB.');
  const book = new ExcelJS.Workbook();
  try {
    checkZip(bytes);
    await book.xlsx.load(Uint8Array.from(bytes).buffer);
    return book;
  } catch {
    throw new WarehouseError('No se pudo leer el archivo. Guarda una copia en formato Excel .xlsx y vuelve a intentarlo.');
  }
}

export function cellValue(cell: ExcelJS.Cell, allowFormula = false) {
  const value = cell.value;
  if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
    if (allowFormula && value.result != null) return value.result;
    throw new WarehouseError(`Celda ${cell.address}: guarda un valor calculado o pega el valor directamente.`);
  }
  if (value && typeof value === 'object' && 'richText' in value) return value.richText.map(part => part.text).join('');
  return value;
}

function historicalText(cell: ExcelJS.Cell) {
  const value = cellValue(cell, true);
  if (value == null) return '';
  if (typeof value === 'string' && value.length <= 500) return value.trim();
  throw new WarehouseError(`Texto inválido en ${cell.address}.`);
}

function historicalNumber(cell: ExcelJS.Cell, kind: 'quantity' | 'money' | 'price', blank = false) {
  const value = cellValue(cell, true);
  if (value == null && blank) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e10 ||
      (kind === 'quantity' && !Number.isInteger(value))) {
    throw new WarehouseError(`Número inválido en ${cell.address}.`);
  }
  return kind === 'money' ? Math.round((value + Number.EPSILON) * 100) : value;
}

function historicalRows(sheet: ExcelJS.Worksheet, first: number, width: number, totalColumn: number) {
  if (sheet.rowCount > 5000 || sheet.columnCount > 40) throw new WarehouseError(`${sheet.name} excede el tamaño admitido.`);
  const rows: ExcelJS.Row[] = [];
  let total: ExcelJS.Row | undefined;
  for (let i = first; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (String(cellValue(row.getCell(totalColumn), true)).trim().toUpperCase() === 'TOTAL') {
      total = row;
      break;
    }
    if (Array.from({ length: width }, (_, index) => row.getCell(index + 1).value).some(value => value != null && value !== '')) rows.push(row);
  }
  if (!total || !rows.length) throw new WarehouseError(`${sheet.name} debe incluir registros y una fila TOTAL.`);
  return { rows, total };
}

export function parseWarehouseClosing(book: ExcelJS.Workbook) {
  const summary = book.getWorksheet('Cuadro 5');
  const detail = book.getWorksheet('Cuadro 6');
  if (!summary || !detail || book.worksheets.length !== 2 ||
      !historicalText(summary.getCell('B10')).toLowerCase().includes('partida') ||
      !historicalText(detail.getCell('B8')).toLowerCase().includes('descripción')) {
    throw new WarehouseError('Usa un Excel con las hojas Cuadro 5 y Cuadro 6 y sus encabezados institucionales.');
  }
  const period = /^(?:al\s+)?31 de diciembre(?: de)?\s+(\d{4})$/i;
  const year = Number(period.exec(historicalText(summary.getCell('A7')))?.[1]);
  if (year < 1900 || year !== Number(period.exec(historicalText(detail.getCell('A5')))?.[1]) ||
      `${year}-12-31` > todayInBolivia()) {
    throw new WarehouseError('Ambos cuadros deben indicar el mismo cierre anual al 31 de diciembre.');
  }

  const summaryTable = historicalRows(summary, 11, 6, 2);
  const detailTable = historicalRows(detail, 10, 12, 1);
  const summaryRows = summaryTable.rows.map(row => {
    const item = historicalNumber(row.getCell(1), 'quantity');
    const category = historicalText(row.getCell(2));
    if (!item || !category) throw new WarehouseError(`Cuadro 5, fila ${row.number}: falta el número o la partida.`);
    return { row: row.number, item, category, values: [3, 4, 5, 6].map((col, i) => historicalNumber(row.getCell(col), i % 2 ? 'money' : 'quantity')) };
  });
  let item = 0, description = '', unit = '';
  const detailRows = detailTable.rows.map(row => {
    const index = row.getCell(1).value;
    if (index != null && index !== '') {
      const next = historicalNumber(row.getCell(1), 'quantity');
      if (!next) throw new WarehouseError(`Cuadro 6, fila ${row.number}: revisa la numeración de ítems.`);
      item = next;
      description = historicalText(row.getCell(2));
      unit = historicalText(row.getCell(3));
    } else if (row.getCell(2).value != null || row.getCell(3).value != null) {
      throw new WarehouseError(`Cuadro 6, fila ${row.number}: falta el número del ítem.`);
    }
    if (!item || !description) throw new WarehouseError(`Cuadro 6, fila ${row.number}: falta el ítem o la descripción.`);
    const price = historicalNumber(row.getCell(4), 'price', true);
    const values: number[] = [];
    for (let i = 0; i < 8; i++) {
      const cell = row.getCell(i + 5);
      const value = cell.value;
      // ExcelJS can omit a cached zero. Verify zero from the three inputs.
      const verifiedZero = (i === 3 || i === 7) && value && typeof value === 'object' &&
        ('formula' in value || 'sharedFormula' in value) && value.result == null &&
        values[i - 3]! + values[i - 2]! === values[i - 1]!;
      values.push(verifiedZero ? 0 : historicalNumber(cell, i < 4 ? 'quantity' : 'money', i !== 3 && i !== 7));
    }
    if (values[0]! + values[1]! - values[2]! !== values[3]!) {
      throw new WarehouseError(`Cuadro 6, fila ${row.number}: las cantidades no concilian.`);
    }
    if (Math.abs(values[4]! + values[5]! - values[6]! - values[7]!) > 1) {
      throw new WarehouseError(`Cuadro 6, fila ${row.number}: los importes no concilian.`);
    }
    return { row: row.number, item, description, unit, continuation: index == null || index === '', price, values };
  });

  const summaryTotals = [3, 4, 5, 6].map((col, i) => historicalNumber(summaryTable.total.getCell(col), i % 2 ? 'money' : 'quantity'));
  const detailTotals = Array.from({ length: 8 }, (_, i) => historicalNumber(detailTable.total.getCell(i + 5), i < 4 ? 'quantity' : 'money'));
  const reconciles = (rows: { values: number[] }[], totals: number[]) =>
    totals.every((total, index) => total === rows.reduce((sum, row) => sum + row.values[index]!, 0));
  if (!reconciles(summaryRows, summaryTotals) || !reconciles(detailRows, detailTotals) ||
      [0, 4, 3, 7].some((index, i) => detailTotals[index] !== summaryTotals[i])) {
    throw new WarehouseError('Los totales declarados y los saldos de ambos cuadros deben coincidir.');
  }
  return { year, summaryRows, detailRows, summaryTotals, detailTotals };
}
export type WarehouseClosing = ReturnType<typeof parseWarehouseClosing>;
