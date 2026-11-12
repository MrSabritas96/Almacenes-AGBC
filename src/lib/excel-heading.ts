import type ExcelJS from 'exceljs';

export const excelBannerPath = '/brand/report-banner.png';

export function addExcelHeading(
  sheet: ExcelJS.Worksheet,
  banner: number,
  title: string,
  { period, monetary = false, context }: { period?: string; monetary?: boolean; context?: string } = {},
) {
  const columns = sheet.columns.length;
  const widths = sheet.columns.map(column => Math.floor((column.width ?? 9) * 7));
  const width = widths.reduce((sum, column) => sum + column, 0);
  const imageWidth = Math.min(width, 1100);
  const imageHeight = imageWidth * 156 / 1740;
  const inline = width >= 1150;
  let left = (width - imageWidth) / 2;
  let col = 0;
  while (left >= widths[col]!) left -= widths[col++]!;
  sheet.addImage(banner, { tl: { col: col + left / widths[col]!, row: 0 }, ext: { width: imageWidth, height: imageHeight } });
  sheet.getRow(1).height = inline ? 30 : Math.ceil(imageHeight * .75);
  const line = (row: number, value: string, bold = false) => {
    sheet.mergeCells(row, 1, row, columns);
    const cell = sheet.getCell(row, 1);
    cell.value = value;
    cell.font = { name: 'Arial Narrow', size: bold ? 12 : 11, bold, underline: bold };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(row).height = 17;
  };
  line(2, '"AGENCIA BOLIVIANA DE CORREOS"', true);
  if (inline) sheet.getRow(2).height = Math.ceil(imageHeight * .75) - 30;
  line(3, title.toUpperCase(), true);
  if (period) line(4, period);
  if (monetary) line(5, '(Expresado en bolivianos)');
  if (context) {
    line(6, context.replace(/\s+/g, ' ').trim());
    const cell = sheet.getCell('A6');
    cell.font = { name: 'Arial', size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getRow(6).height = Math.max(16, Math.ceil(cell.text.length * 6 / width) * 13);
  }
}

export function styleExcelColumns(sheet: ExcelJS.Worksheet, row: number, headers: readonly string[], height = 23) {
  sheet.getRow(row).height = height;
  headers.forEach((header, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0B3B83' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}
