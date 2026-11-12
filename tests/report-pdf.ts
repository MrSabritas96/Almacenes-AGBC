import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createReportPdf, createDeliveryReceipt, createRequestReceipt } from "../src/lib/report-pdf";
import { institutionalStockReport, stockReportNote } from '../src/lib/institutional-stock-report';
const logo = {agency:new Uint8Array(readFileSync(new URL("../public/brand/report-agency.png", import.meta.url))),presidency:new Uint8Array(readFileSync(new URL("../public/brand/report-presidency.png", import.meta.url)))};
const institutional=institutionalStockReport('institutional',[],[],'2025-01-01','2025-12-31');
const institutionalPdf=createReportPdf(institutional.title,institutional.records,`Del 2025-01-01 al 2025-12-31. ${stockReportNote}`,logo,undefined,{institutionalSignatures:true});
for(const label of ['Firma Contabilidad','Firma Responsable de almacenes','Firma DGAA - DAF','2025-01-01','2025-12-31'])assert(institutionalPdf.output().includes(label),`Resumen institucional incluye ${label}`);
assert.equal((institutionalPdf.output().match(/\/I\d+ Do/g)??[]).length,2*institutionalPdf.getNumberOfPages(),'Firmas y continuaciones mantienen logos');
if(process.env.INSTITUTIONAL_REPORT_PREVIEW)writeFileSync(process.env.INSTITUTIONAL_REPORT_PREVIEW,Buffer.from(institutionalPdf.output('arraybuffer')));

const rows = Array.from({ length: 180 }, (_, index) => ({
  Código: `MAT-${index}`, Material: "Bolígrafos y papel de oficina",
  Cantidad: index, Respuesta: "Entrega en almacén central. ".repeat(8),
}));
const doc = createReportPdf("Inventario y solicitudes", rows, "Empleado AGBC · Búsqueda: papel", logo);
assert(doc.getNumberOfPages() > 1, "Los registros largos deben paginarse");
const content = doc.output();
assert(content.startsWith("%PDF-"), "Debe generar un PDF real");
assert(content.includes("MAT-179"), "Debe incluir el último registro");
assert(content.includes("MAT-0"), "Debe incluir el primer registro");
assert(content.includes(`de ${doc.getNumberOfPages()}`), "Debe mostrar el total de páginas");
assert(content.includes("180 registros"), "Debe indicar la cantidad exportada");
assert(content.includes("/Subtype /Image"), "Debe incorporar el logo como imagen en el PDF");
assert(content.includes("AGENCIA BOLIVIANA DE CORREOS"), "Debe identificar a la agencia");
assert.throws(() => createReportPdf("Vacío", [], "Sin filtros", logo), /No hay registros/);
const wide = createReportPdf("Solicitudes", [Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`Campo ${i}`, `Valor ${i}`]))], "Sin filtros", logo);
assert(wide.getNumberOfPages() > 1, "Las tablas anchas deben dividirse sin recortar columnas");
assert(wide.output().includes("Valor 13"), "Debe conservar la última columna");
assert.equal((wide.output().match(/\/I\d+ Do/g) ?? []).length, 2*wide.getNumberOfPages(), "Todas las páginas deben llevar el logo, incluso las columnas divididas");
const inventoryRows=Array.from({length:210},(_,i)=>({Código:`MAT-${String(i+1).padStart(4,'0')}`,Material:'Bota de lluvia para reparto',Descripción:'Ejemplo de catálogo. Completar presentación y características al registrar la compra.','Según factura':'','Costo unitario Bs':'0.000000','Valor disponible Bs':'0.00',Partida:'CAL-001 · Calzados',Unidad:'unidad',Disponible:0,Reservado:0,Mínimo:5,Ubicación:'Sector A · Estante 1',Almacén:'Almacén central'}));
const inventory=createReportPdf('Inventario',inventoryRows,'Administrador de almacén · Almacén central · Regional: Todas',logo);
assert(inventory.getNumberOfPages()>1&&inventory.getNumberOfPages()<20,'El inventario aprovecha las hojas sin separar columnas ni crear páginas por registro');
const inventoryPages=inventory.internal.pages as unknown as string[][];
for(let page=1;page<=inventory.getNumberOfPages();page++){
  const text=inventoryPages[page]!.join('\n');
  assert.equal(text.includes('RESPONSABLE, ALCANCE Y FILTROS'),page===1,'Los datos del informe aparecen solo en la primera página');
  assert.equal(text.includes('Fecha de emisión:'),page===1,'La fecha aparece solo en la primera página');
  assert(text.includes('(Almacén)')&&text.includes('(Disp.)'),'Cada hoja mantiene todas las columnas');
}
for(const row of inventoryRows)assert.equal(inventory.output().split(`(${row.Código})`).length-1,1,'Cada material se imprime completo una sola vez');
assert.equal((inventory.output().match(/\/I\d+ Do/g)??[]).length,2*inventory.getNumberOfPages(),'Conserva ambos logos en las continuaciones');
if(process.env.INVENTORY_REPORT_PREVIEW)writeFileSync(process.env.INVENTORY_REPORT_PREVIEW,Buffer.from(inventory.output('arraybuffer')));
const receiptRequest={id:'ACTA-TEST-001',material:'Sobres institucionales',quantity:3,unit:'unidad',delivered_at:'2026-10-13T14:00:00Z',updated_at:'2026-10-13T14:00:00Z',delivery_place:'Almacén central',responsible:'Responsable de almacén'};
const receipt=createDeliveryReceipt(receiptRequest,{name:'Empleado de prueba',document:'1234567',position:'Auxiliar',department:'Administración'},'Almacén central','Administrador de prueba',logo);
const fifoReceipt=createDeliveryReceipt({...receiptRequest,unit_cost:'13.333333',allocations:[{entry_code:'E-000001',lot:'LOTE-A',expires_on:'2027-12-31',quantity:2,unit_cost:'10'},{entry_code:'E-000002',lot:'LOTE-B',expires_on:null,quantity:1,unit_cost:'20'}]},{name:'Empleado de prueba',document:'1234567',position:'Auxiliar',department:'Administración'},'Almacén central','Administrador de prueba',logo);
for(const text of ['E-000001','E-000002','LOTE-A','LOTE-B','10.00','20.00','40.00'])assert(fifoReceipt.output().includes(text),`El acta PEPS incluye ${text}`);
if(process.env.FIFO_RECEIPT_PREVIEW)writeFileSync(process.env.FIFO_RECEIPT_PREVIEW,Buffer.from(fifoReceipt.output('arraybuffer')));
assert.equal(receipt.getNumberOfPages(),1,'El acta habitual, con cuatro firmas, cabe en una página A4');
const receiptContent=receipt.output();
assert(receiptContent.includes('ACTA-TEST-001'),'El acta tiene una referencia única');
assert(receiptContent.includes('FIRMA DEL EMPLEADO'),'Incluye firma de recepción');
assert(receiptContent.includes('FIRMA DEL RESPONSABLE'),'Incluye firma del responsable');
assert(receiptContent.includes('Empleado de prueba')&&receiptContent.includes('1234567'),'Identifica al empleado');
assert.equal((receiptContent.match(/\/I\d+ Do/g)??[]).length,2*receipt.getNumberOfPages(),'Logos en todas las páginas del acta');
assert.throws(()=>createDeliveryReceipt({...receiptRequest,delivered_at:null},{name:'Empleado',document:'',position:'',department:''},'Almacén','Administrador',logo),/confirmada/,'No se certifica una entrega no confirmada');
console.log("OK: PDF real, registros completos, texto largo, tablas anchas, paginación y rechazo de tabla vacía.");

const requestData={reference:'SOL-7K3M-9P2R',created_at:'2026-10-16T14:00:00Z',needed_on:'2026-10-20',warehouse:'Almacén central',warehouse_location:'La Paz',material:'Papel bond tamaño carta',material_code:'PAP-001',quantity:3,unit:'Resma de 500 hojas',purpose:'Material para actividades administrativas y atención al público.',priority:'normal',status:'pending',delivery_on:null,delivery_place:null,response:'',delivered_at:null,requester:{name:'Solicitante de prueba',document:'1234567-LP',position:'Auxiliar administrativo',department:'Operaciones'}};
const requestReceipt=createRequestReceipt(requestData,logo);
const multiRequest={...requestData,status:'mixed',items:[{...requestData,material:'Papel bond carta',material_code:'PAP-001',quantity:3,status:'approved',authorized_quantity:2,delivery_on:'2026-10-29',response:'Puede recoger dos resmas.'},{...requestData,material:'Bolígrafo azul',material_code:'BOL-002',quantity:10,unit:'unidad',status:'waiting',response:'En espera de reposición.'},{...requestData,material:'Carpeta de archivo',material_code:'CAR-003',quantity:4,unit:'unidad',status:'denied',response:'Solicitud rechazada para este material.'}]};
const multiPdf=createRequestReceipt(multiRequest,logo);
for(const value of ['PAP-001','BOL-002','CAR-003','Puede recoger dos resmas.','En espera de reposición.','Solicitud rechazada','Ver estado de cada material'])assert(multiPdf.output().includes(value),`El comprobante conjunto incluye ${value}`);
assert.equal(multiPdf.getNumberOfPages(),1,'Un pedido habitual de tres materiales conserva las firmas en una sola hoja');
const manyPdf=createRequestReceipt({...multiRequest,items:Array.from({length:20},(_,i)=>({...requestData,material_code:`MULTI-${i+1}`,material:`Material de prueba ${i+1}`,response:'Respuesta larga por material. '.repeat(12)+`FIN-${i+1}`}))},logo);
assert(manyPdf.getNumberOfPages()>1,'El comprobante de muchos materiales se pagina');
for(let i=1;i<=20;i++)assert(manyPdf.output().includes(`FIN-${i}`),'No pierde respuestas de materiales en páginas adicionales');
const manyPages=manyPdf.internal.pages as unknown as string[][];
assert.equal(Object.values(manyPages).filter(page=>page.join('\n').includes('FIRMA DEL SOLICITANTE')).length,1,'Un comprobante conjunto conserva una sola sección de firmas');
assert(manyPages[manyPdf.getNumberOfPages()]!.join('\n').includes('FIRMA DEL SOLICITANTE'),'Firmas al pie de la última página del comprobante conjunto');
if(process.env.MULTI_REQUEST_PREVIEW){writeFileSync(`${process.env.MULTI_REQUEST_PREVIEW}.pdf`,Buffer.from(multiPdf.output('arraybuffer')));writeFileSync(`${process.env.MULTI_REQUEST_PREVIEW}-largo.pdf`,Buffer.from(manyPdf.output('arraybuffer')));}
const requestContent=requestReceipt.output();
assert.equal(requestReceipt.getNumberOfPages(),1,'El comprobante habitual cabe en una página A4');
for(const value of ['SOL-7K3M-9P2R','Solicitante de prueba','1234567-LP','PAP-001','No acredita la entrega del material'])assert(requestContent.includes(value),`Comprobante incluye ${value}`);
for(const value of ['Consulta del estado','Ingrese su CI con extensión','/consultar-solicitud','localhost:3000'])assert(!requestContent.includes(value),`Comprobante omite ${value}`);
assert(requestContent.includes('/Subtype /Image'),'El comprobante lleva logo institucional');
assert(!requestContent.includes('FIRMA DEL EMPLEADO'),'No se confunde una solicitud con el acta de entrega');
const acceptedReceipt=createRequestReceipt({...requestData,status:'approved',delivery_on:'2026-10-20',delivery_place:'Almacén central',response:'Puede pasar a recoger su material.'},logo);
assert.equal(acceptedReceipt.getNumberOfPages(),1,'El comprobante con fecha y respuesta de recojo cabe en una página A4');
const longRequest=createRequestReceipt({...requestData,purpose:'Justificación detallada de la solicitud. '.repeat(50)+'FIN-MOTIVO',response:'Respuesta detallada del almacén. '.repeat(60)+'FIN-RESPUESTA',requester:{...requestData.requester,name:'Nombre de solicitante extenso '.repeat(6),department:'Unidad institucional extensa '.repeat(6)}},logo);
assert(longRequest.getNumberOfPages()>1,'Los textos extensos se paginan');
assert(longRequest.output().includes('FIN-MOTIVO')&&longRequest.output().includes('FIN-RESPUESTA'),'No se pierde el final de los textos');
assert.equal((longRequest.output().match(/\/I\d+ Do/g)??[]).length,2*longRequest.getNumberOfPages(),'Logos en todas las páginas del comprobante');
for(const pdf of [requestReceipt,acceptedReceipt,longRequest]){
  const renderedPages=pdf.internal.pages as unknown as string[][];
  const signaturePages=Object.values(renderedPages).filter(page=>page.join('\n').includes('FIRMA DEL SOLICITANTE'));
  assert.equal(signaturePages.length,1,'Las firmas se muestran una sola vez');
  const lastPage=renderedPages[pdf.getNumberOfPages()]!.join('\n');
  assert(lastPage.includes('FIRMA DEL SOLICITANTE')&&lastPage.includes('VISTO BUENO / AUTORIZADO POR'),'Ambas firmas están en la última página');
  assert(!pdf.output().includes('__________________________________'),'Las firmas ya no forman parte de las filas de la tabla');
}
if(process.env.REQUEST_RECEIPT_STANDARD_PREVIEW)writeFileSync(process.env.REQUEST_RECEIPT_STANDARD_PREVIEW,Buffer.from(requestReceipt.output('arraybuffer')));
for(const pdf of [doc,wide,receipt,requestReceipt,longRequest]){
  assert(pdf.output().includes('/ca 1'),'Los logos deben conservar su color original al 100 %');
  assert(!pdf.output().includes('/ca 0.25'),'No debe atenuar los logos');
  assert.equal((pdf.output().match(/\/I\d+ Do/g)??[]).length,2*pdf.getNumberOfPages(),'Cada página debe incluir Presidencia y agencia');
}
if(process.env.REPORT_BRANDING_PREVIEW){
  writeFileSync(`${process.env.REPORT_BRANDING_PREVIEW}-informe.pdf`,Buffer.from(doc.output('arraybuffer')));
  writeFileSync(`${process.env.REPORT_BRANDING_PREVIEW}-acta.pdf`,Buffer.from(receipt.output('arraybuffer')));
  writeFileSync(`${process.env.REPORT_BRANDING_PREVIEW}-comprobante.pdf`,Buffer.from(requestReceipt.output('arraybuffer')));
}
if(process.env.REQUEST_RECEIPT_PREVIEW)writeFileSync(process.env.REQUEST_RECEIPT_PREVIEW,Buffer.from(longRequest.output('arraybuffer')));
console.log('OK: comprobante A4, datos completos, logo, solicitud diferenciada de entrega y textos largos sin recorte.');
