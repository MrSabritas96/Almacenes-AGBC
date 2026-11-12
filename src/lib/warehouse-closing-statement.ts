import type ExcelJS from 'exceljs';
import { cellValue, type WarehouseClosing } from './warehouse-closing';
import { WarehouseError } from './warehouse-errors';

export function parseClosingStatement(book: ExcelJS.Workbook, closing: WarehouseClosing) {
  const purchasesSheet = book.getWorksheet('Hoja1');
  const outgoingSheet = book.getWorksheet('Hoja2');
  const balanceSheet = book.getWorksheet('Hoja4');
  const reconciliation = book.getWorksheet('Hoja3');
  if (!purchasesSheet || !outgoingSheet || !balanceSheet || !reconciliation ||
      !String(balanceSheet.getCell('B4').value).includes(`DICIEMBRE DE ${closing.year}`)) {
    throw new WarehouseError('El Excel de EEFF debe corresponder al año del cierre registrado.');
  }
  const number = (cell: ExcelJS.Cell, scale = 1) => {
    const value = cellValue(cell, true);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e10 ||
        (scale === 1 && !Number.isInteger(value))) {
      throw new WarehouseError(`Dato inválido en ${cell.worksheet.name} · ${cell.address}.`);
    }
    return Math.round(value * scale);
  };
  const text = (cell: ExcelJS.Cell) => String(cellValue(cell, true) ?? '').trim();
  function readTable<T>(sheet: ExcelJS.Worksheet, first: number, label: number, read: (row: ExcelJS.Row) => T) {
    const rows: T[] = [];
    for (let i = first; i <= Math.min(sheet.rowCount, 1000); i++) {
      const row = sheet.getRow(i);
      if (text(row.getCell(label)).toUpperCase() === 'TOTAL' && rows.length) return { rows, total: row };
      rows.push(read(row));
    }
    throw new WarehouseError(`Falta el total de ${sheet.name}.`);
  }
  const purchases = readTable(purchasesSheet, 3, 4, row => ({
    order: number(row.getCell(4)), description: text(row.getCell(5)),
    reference: text(row.getCell(6)), amount: number(row.getCell(7), 100),
  }));
  const outgoing = readTable(outgoingSheet, 6, 3, row => ({
    category: text(row.getCell(3)), description: text(row.getCell(4)), amount: number(row.getCell(5), 100),
  }));
  const balances = readTable(balanceSheet, 6, 2, row => [4,5,6,7].map((col,i)=>number(row.getCell(col),i%2?100:1)));
  const purchased = purchases.rows.reduce((sum,row)=>sum+row.amount,0);
  const spent = outgoing.rows.reduce((sum,row)=>sum+row.amount,0);
  const [opening, incoming, withdrawals, final] = closing.detailTotals.slice(4);
  const reported = [12,13,14,15].map(row=>number(reconciliation.getCell(row,5),100));
  const nonzero = (rows: number[][]) => rows.filter(row => row.some(amount => amount !== 0));
  if (purchased !== incoming || spent !== withdrawals ||
      purchased !== number(purchases.total.getCell(7),100) || spent !== number(outgoing.total.getCell(5),100) ||
      ![opening,purchased,spent,final].every((amount,i)=>reported[i]===amount) ||
      opening! + purchased - spent !== final ||
      JSON.stringify(nonzero(balances.rows)) !== JSON.stringify(nonzero(closing.summaryRows.map(row=>row.values))) ||
      !closing.summaryTotals.every((amount,i)=>amount===number(balances.total.getCell(i+4),i%2?100:1) &&
        amount===balances.rows.reduce((sum,row)=>sum+row[i]!,0))) {
    throw new WarehouseError('El respaldo de EEFF presenta diferencias con el cierre registrado.');
  }
  return {
    purchases: purchases.rows,
    outgoing: outgoing.rows,
    totals: { opening: opening!, purchased, spent, final: final! },
    dateHeaderMismatch: [4,5,6,7].some(col=>text(balanceSheet.getCell(5,col)).includes(String(closing.year-1))),
  };
}
export type ClosingStatement = ReturnType<typeof parseClosingStatement>;
