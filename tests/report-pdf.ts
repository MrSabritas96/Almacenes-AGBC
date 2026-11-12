import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createReportPdf, createDeliveryReceipt, createRequestReceipt } from "../src/lib/report-pdf";
const logo = new Uint8Array(readFileSync(new URL("../public/brand/correos-logo.png", import.meta.url)));

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
assert.equal((wide.output().match(/\/I\d+ Do/g) ?? []).length, wide.getNumberOfPages(), "Todas las páginas deben llevar el logo, incluso las columnas divididas");
const receiptRequest={id:'ACTA-TEST-001',material:'Sobres institucionales',quantity:3,unit:'unidad',delivered_at:'2026-10-13T14:00:00Z',updated_at:'2026-10-13T14:00:00Z',delivery_place:'Almacén central',responsible:'Responsable de almacén'};
const receipt=createDeliveryReceipt(receiptRequest,{name:'Empleado de prueba',document:'1234567',position:'Auxiliar',department:'Administración'},'Almacén central','Administrador de prueba',logo);
const receiptContent=receipt.output();
assert(receiptContent.includes('ACTA-TEST-001'),'El acta tiene una referencia única');
assert(receiptContent.includes('FIRMA DEL EMPLEADO'),'Incluye firma de recepción');
assert(receiptContent.includes('FIRMA DEL RESPONSABLE'),'Incluye firma del responsable');
assert(receiptContent.includes('Empleado de prueba')&&receiptContent.includes('1234567'),'Identifica al empleado');
assert.equal((receiptContent.match(/\/I\d+ Do/g)??[]).length,receipt.getNumberOfPages(),'Logo en todas las páginas del acta');
assert.throws(()=>createDeliveryReceipt({...receiptRequest,delivered_at:null},{name:'Empleado',document:'',position:'',department:''},'Almacén','Administrador',logo),/confirmada/,'No se certifica una entrega no confirmada');
console.log("OK: PDF real, registros completos, texto largo, tablas anchas, paginación y rechazo de tabla vacía.");

const requestData={reference:'SOL-7K3M-9P2R',created_at:'2026-10-16T14:00:00Z',needed_on:'2026-10-20',warehouse:'Almacén central',warehouse_location:'La Paz',material:'Papel bond tamaño carta',material_code:'PAP-001',quantity:3,unit:'Resma de 500 hojas',purpose:'Material para actividades administrativas y atención al público.',priority:'normal',status:'pending',delivery_on:null,delivery_place:null,response:'',delivered_at:null,requester:{name:'Solicitante de prueba',document:'1234567-LP',position:'Auxiliar administrativo',department:'Operaciones'}};
const requestReceipt=createRequestReceipt(requestData,logo,'https://agbc.example/consultar-solicitud');
const requestContent=requestReceipt.output();
assert.equal(requestReceipt.getNumberOfPages(),1,'El comprobante habitual cabe en una página A4');
for(const value of ['SOL-7K3M-9P2R','Solicitante de prueba','1234567-LP','PAP-001','No acredita la entrega del material','https://agbc.example/consultar-solicitud'])assert(requestContent.includes(value),`Comprobante incluye ${value}`);
assert(requestContent.includes('/Subtype /Image'),'El comprobante lleva logo institucional');
assert(!requestContent.includes('FIRMA DEL EMPLEADO'),'No se confunde una solicitud con el acta de entrega');
const acceptedReceipt=createRequestReceipt({...requestData,status:'approved',delivery_on:'2026-10-20',delivery_place:'Almacén central',response:'Puede pasar a recoger su material.'},logo);
assert.equal(acceptedReceipt.getNumberOfPages(),1,'El comprobante con fecha y respuesta de recojo cabe en una página A4');
const longRequest=createRequestReceipt({...requestData,purpose:'Justificación detallada de la solicitud. '.repeat(50)+'FIN-MOTIVO',response:'Respuesta detallada del almacén. '.repeat(60)+'FIN-RESPUESTA',requester:{...requestData.requester,name:'Nombre de solicitante extenso '.repeat(6),department:'Unidad institucional extensa '.repeat(6)}},logo);
assert(longRequest.getNumberOfPages()>1,'Los textos extensos se paginan');
assert(longRequest.output().includes('FIN-MOTIVO')&&longRequest.output().includes('FIN-RESPUESTA'),'No se pierde el final de los textos');
assert.equal((longRequest.output().match(/\/I\d+ Do/g)??[]).length,longRequest.getNumberOfPages(),'Logo en todas las páginas del comprobante');
if(process.env.REQUEST_RECEIPT_PREVIEW)writeFileSync(process.env.REQUEST_RECEIPT_PREVIEW,Buffer.from(longRequest.output('arraybuffer')));
console.log('OK: comprobante A4, datos completos, logo, solicitud diferenciada de entrega y textos largos sin recorte.');
