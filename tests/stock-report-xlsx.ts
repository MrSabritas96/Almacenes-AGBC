import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { parseWarehouseImport, templateBytes } from '../src/lib/warehouse-import';
import { createStockWorkbook } from '../src/lib/stock-report-xlsx';
import type { stockSummary } from '../src/lib/stock-report';
import type { Purchase } from '../src/lib/warehouse';

const banner=readFileSync('public/brand/report-banner.png').toString('base64');
const rows:ReturnType<typeof stockSummary>=[{id:'paper',code:'PAP-001',name:'=HYPERLINK("https://example.com","texto literal")',description:'Detalle escrito del artículo',unit:'resma',category:'32100',unitCost:180/13,opening:10,openingValue:100,incoming:7,incomingValue:120,outgoing:4,outgoingValue:40,closing:13,closingValue:180}];
const purchases=[{id:'p1',material_id:'paper',category:'32100',invoice_number:'00123',invoice_description:'Papel bond tamaño carta',purchased_on:'2026-01-01',quantity:5,unit_cost:'20',supplier:'Proveedor',material:'Papel'}] as Purchase[];
const input={rows,purchases,from:'2026-01-01',to:'2026-12-31',context:'Prueba con datos ficticios · no representa existencias reales',includeEmpty:false,selected:'institutional' as const,banner};
async function main(){
const workbook=createStockWorkbook(input), buffer=await workbook.xlsx.writeBuffer();
const saved=new ExcelJS.Workbook();await saved.xlsx.load(buffer);
assert.equal(saved.worksheets.length,6);
assert.equal(saved.views[0]?.activeTab,4);
const detail=saved.getWorksheet('Detalle de Almacen')!, summary=saved.getWorksheet('Resumen institucional')!, reconciliation=saved.getWorksheet('Conciliación')!, entries=saved.getWorksheet('Ingresos por compras')!;
assert.equal(detail.getCell('A3').value,'DETALLE DE ALMACENES (BIENES DE CONSUMO)');
assert.equal(detail.getCell('C8').type,ExcelJS.ValueType.String,'El texto del usuario no se convierte en fórmula');
assert.equal(detail.getCell('G8').value,10,'Cantidades son números, no cadenas localizadas');
assert.equal(detail.getCell('K8').value,100);
assert.equal(detail.getCell('E8').value,'PAR-015');
assert.equal(entries.getCell('C8').value,'PAR-015');
assert.equal(summary.getCell('B8').value,'PAR-015 · Papel de escritorio');
assert.equal(detail.getCell('N8').formula,'K8+L8-M8');
assert.equal(detail.getCell('N8').result,180);
assert.equal(detail.getCell('F8').value,'Detalle escrito del artículo');
assert.equal(detail.getCell('C7').value,'Artículo');
assert.equal(detail.getCell('F7').value,'Descripción');
assert(!JSON.stringify(detail.getRow(7).values).includes('Costo unitario'));
const noDescriptions=createStockWorkbook({...input,rows:rows.map(row=>({...row,description:''}))}).getWorksheet('Detalle de Almacen')!;
assert.equal(noDescriptions.columnCount,13);
assert(!noDescriptions.getRow(7).values.toString().includes('Descripción'));
assert.equal(noDescriptions.getCell('M8').formula,'J8+K8-L8');
assert.equal(noDescriptions.getCell('M8').result,180);
assert.equal(summary.getCell('F8').formula,"'Saldos por partida'!F8");
assert.equal(summary.getCell('F9').result,180);
assert.equal(entries.getCell('E8').value,'00123','La factura conserva ceros iniciales');
assert.equal(entries.getCell('B8').type,ExcelJS.ValueType.Date);
assert.equal(entries.getCell('J8').formula,'H8*I8');
assert.deepEqual([8,9,10,11,12].map(row=>reconciliation.getCell(row,2).result),[100,100,20,40,180]);
assert.equal(reconciliation.getCell('B12').formula,'B8+B9+B10-B11');
for(const sheet of saved.worksheets){
  assert.equal(sheet.getImages().length,1,'Todos los cuadros tienen el banner con ambos logos');
  assert.equal(sheet.getCell('A2').value,'"AGENCIA BOLIVIANA DE CORREOS"');
  assert.equal(sheet.getCell('A4').value,'Al 31 de diciembre de 2026');
  assert.equal(sheet.getCell('A5').value,'(Expresado en bolivianos)');
  assert(sheet.pageSetup.printArea&&sheet.pageSetup.fitToWidth===1);
  const view=sheet.views[0];assert(view?.state==='frozen'&&view.ySplit===7);
  sheet.eachRow(row=>row.eachCell(cell=>{
    if(typeof cell.value==='string')assert(!/^(32100|34300|25600)(\s|$)/.test(cell.value),'Ninguna hoja exporta los códigos presupuestarios anteriores');
  }));
}
for(const label of ['Firma Contabilidad','Firma Responsable','Firma DGAA - DAF'])assert(summary.getSheetValues().some(row=>row&&Object.values(row).includes(label)));
const selectedSheets={reconciliation:'Conciliación',purchases:'Ingresos por compras',outgoing:'Salidas por partida',balances:'Saldos por partida',institutional:'Resumen institucional',detail:'Detalle de Almacen'} as const;
const eeff = new ExcelJS.Workbook();
await eeff.xlsx.load(await createStockWorkbook({...input,scope:'eeff'}).xlsx.writeBuffer());
assert.deepEqual(eeff.worksheets.map(sheet=>sheet.name),[
  selectedSheets.reconciliation,selectedSheets.purchases,selectedSheets.outgoing,selectedSheets.balances,selectedSheets.detail,
]);
assert.equal(eeff.views[0]?.activeTab,0);
assert.deepEqual([8,9,10,11,12].map(row=>eeff.getWorksheet(selectedSheets.reconciliation)!.getCell(row,2).result),[100,100,20,40,180]);
assert.match(eeff.getWorksheet(selectedSheets.reconciliation)!.getCell('B9').formula,/^'Ingresos por compras'!/);
assert.match(eeff.getWorksheet(selectedSheets.balances)!.getCell('F8').formula,/'Detalle de Almacen'!/);
for(const selected of Object.keys(selectedSheets) as (keyof typeof selectedSheets)[]){
  for(const isEmpty of [false,true]){
    const source=createStockWorkbook({...input,selected,...(isEmpty?{rows:[],purchases:[],includeEmpty:false}:{}),scope:'all'});
    assert.equal(source.worksheets.length,6,'Todos conserva los seis cuadros');
    const individual=createStockWorkbook({...input,selected,...(isEmpty?{rows:[],purchases:[],includeEmpty:false}:{}),scope:'selected'});
    const reloaded=new ExcelJS.Workbook();await reloaded.xlsx.load(await individual.xlsx.writeBuffer());
    assert.equal(reloaded.worksheets.length,1,`${selected} se descarga sin los otros cuadros`);
    assert.equal(reloaded.views[0]?.activeTab,0);
    const only=reloaded.worksheets[0]!;
    assert.equal(only.name,selectedSheets[selected]);
    assert.equal(only.getImages().length,1);
    assert.equal(only.pageSetup.printArea,source.getWorksheet(only.name)!.pageSetup.printArea);
    source.getWorksheet(only.name)!.eachRow(row=>row.eachCell(cell=>{
      const actual=only.getCell(cell.address);
      const value=(c:ExcelJS.Cell)=>c.type===ExcelJS.ValueType.Formula?c.result:c.value;
      assert.deepEqual(value(actual),value(cell),`${selected}: ${cell.address} conserva el dato y su importe`);
      if(actual.type===ExcelJS.ValueType.Formula)assert(!actual.formula.includes('!'),'No hay referencias a hojas eliminadas');
    }));
    if(!isEmpty&&selected==='detail')assert.equal(only.getCell('N8').formula,'K8+L8-M8');
    if(!isEmpty&&selected==='purchases')assert.equal(only.getCell('J8').formula,'H8*I8');
  }
}
const empty=createStockWorkbook({...input,rows:[],purchases:[],includeEmpty:false});
assert.equal(empty.getWorksheet('Detalle de Almacen')!.getCell('M8').formula,'0');
assert.equal(empty.getWorksheet('Resumen institucional')!.getCell('F8').result,0);
assert.throws(()=>createStockWorkbook({...input,from:'2027-01-01'}),/intervalo/);
for (const [kind, values] of [
  ['Materiales', ['Papel bond', 'PAR-015 · Papel de escritorio', 'unidad', 5, '', '']],
  ['Proveedores', ['Proveedor de prueba', '00123', '', '', '', '', '', '']],
  ['Empleados', ['Persona de prueba', '00123', 'Auxiliar', 'Almacén', '', 'La Paz']],
] as const) {
  const branded = new ExcelJS.Workbook();
  await branded.xlsx.load(Uint8Array.from(await templateBytes(kind)).buffer);
  const sheet = branded.getWorksheet(kind)!;
  assert.equal(sheet.getImages().length, 1);
  assert.equal(sheet.getCell('A3').value, `PLANTILLA DE IMPORTACIÓN DE ${kind.toUpperCase()}`);
  assert.equal(branded.worksheets.every(item=>item.getImages().length===1), true);
  sheet.addRow([...values]);
  const legacy = new ExcelJS.Workbook();
  const legacySheet = legacy.addWorksheet(kind);
  legacySheet.addRow(sheet.getRow(4).values);
  legacySheet.addRow([...values]);
  const current = await parseWarehouseImport(kind, Buffer.from(await branded.xlsx.writeBuffer()));
  const previous = await parseWarehouseImport(kind, Buffer.from(await legacy.xlsx.writeBuffer()));
  assert(current.rows && previous.rows);
  assert.equal(current.rows[0]?.row, 5);
  assert.equal(previous.rows[0]?.row, 2);
  assert.deepEqual(current.rows[0]?.values, previous.rows[0]?.values);
}
if(process.env.STOCK_XLSX_PREVIEW)writeFileSync(process.env.STOCK_XLSX_PREVIEW,Buffer.from(buffer));
console.log('OK: XLSX de un cuadro o seis; cada selección conserva importes, fórmulas válidas, firmas, logos, impresión, ceros y texto literal.');
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
