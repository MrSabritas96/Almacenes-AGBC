import assert from 'node:assert/strict';
import { reportFilename } from '../src/lib/report-filename';
import { stockReportTitles } from '../src/lib/institutional-stock-report';

const generated=new Date('2026-10-29T02:03:04Z');
for(const title of ['Detalle de Almacen',...Object.values(stockReportTitles)]){
  for(const format of ['pdf','xlsx'] as const){
    const name=reportFilename(title,format,generated);
    assert.equal(name,`${title} - 2026-10-28_22-03-04.${format}`,'Usa el nombre seleccionado y la fecha/hora de generación en Bolivia');
    assert(!/[<>:"/\\|?*]/.test(name),'El nombre se puede guardar en Windows');
  }
}
assert.equal(reportFilename('Reporte: compras / salidas?','pdf',generated),'Reporte compras salidas - 2026-10-28_22-03-04.pdf');
assert.equal(reportFilename('Detalle','pdf',new Date('2026-10-28T04:00:00Z')),'Detalle - 2026-10-28_00-00-00.pdf','Medianoche local sin hora 24');
console.log('OK: nombres de los seis reportes, PDF/Excel, fecha y hora de Bolivia, medianoche y caracteres válidos para Windows.');
