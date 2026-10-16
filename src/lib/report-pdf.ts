import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { statuses, type RequestReceiptData } from "./warehouse-types";

export async function loadReportLogo() {
  const response = await fetch("/brand/correos-logo.png");
  if (!response.ok) throw new Error("No se pudo cargar el logo institucional.");
  return new Uint8Array(await response.arrayBuffer());
}

export function createReportPdf(title: string, rows: Record<string, unknown>[], context: string, logo: string | Uint8Array, signatures?: { statement: string; employee: string; responsible: string }) {
  if (!rows.length) throw new Error("No hay registros para exportar.");
  const clean = (value: unknown) => String(value ?? "—").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const columns = Object.keys(rows[0] ?? {});
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;
  const blue: [number, number, number] = [11, 59, 131];
  const yellow: [number, number, number] = [255, 196, 0];
  const date = new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz", dateStyle: "short", timeStyle: "short",
  }).format(new Date());
  doc.setFontSize(8);
  const contextLines: string[] = doc.splitTextToSize(clean(context), width - margin * 2 - 8);
  doc.setFont("helvetica", "bold");
  const titleLines: string[] = doc.setFontSize(20).splitTextToSize(clean(title), width - margin * 2 - 45);
  const titleBottom = 55 + (titleLines.length - 1) * 8;
  const contextTop = titleBottom + 14;
  const contextHeight = 13 + contextLines.length * 3.8;
  const tableTop = contextTop + contextHeight + 13;
  doc.setProperties({ title: clean(title), author: "AGBC", subject: "Gestión de almacenes" });
  const drawHeader = () => {
    doc.addImage(logo, "PNG", margin, 13, 53, 53 * 94 / 236, "agbc-logo");
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("AGENCIA BOLIVIANA DE CORREOS", width - margin, 21, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(signatures ? "GESTIÓN DE ALMACENES · CONSTANCIA DE ENTREGA" : "GESTIÓN DE ALMACENES · INFORME INSTITUCIONAL", width - margin, 28, { align: "right" });
    doc.setFillColor(...blue);
    doc.rect(margin, 40, width - margin * 2, 1.2, "F");
    doc.setFillColor(...yellow);
    doc.rect(margin, 41.2, 40, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(titleLines, margin, 55, { lineHeightFactor: 1.13 });
    doc.setFillColor(...yellow);
    doc.roundedRect(width - margin - 36, 47, 36, 14, 1.5, 1.5, "F");
    doc.setFontSize(10);
    doc.text(`${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`, width - margin - 18, 55.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 100, 120);
    doc.text(`Fecha de emisión: ${date} (Bolivia)`, margin, titleBottom + 8);
    doc.setFillColor(244, 247, 252);
    doc.rect(margin, contextTop, width - margin * 2, contextHeight, "F");
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.text(signatures ? "DATOS DE LA ENTREGA" : "RESPONSABLE, ALCANCE Y FILTROS", margin + 4, contextTop + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(65, 80, 100);
    doc.text(contextLines, margin + 4, contextTop + 11, { lineHeightFactor: 1.3 });
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.text("DETALLE DE REGISTROS", margin, tableTop - 4);
    doc.setFont("helvetica", "normal");
  };
  autoTable(doc, {
    head: [columns], body: rows.map(row => columns.map(key => clean(row[key]))),
    margin: { top: tableTop, bottom: 22, left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, overflow: "linebreak", cellWidth: columns.length > 9 ? 28 : "auto" },
    headStyles: { fillColor: blue, textColor: [255, 255, 255], fontStyle: "bold", cellPadding: 3 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    rowPageBreak: "avoid",
    horizontalPageBreak: columns.length > 9,
    horizontalPageBreakRepeat: 0,
  });
  if (signatures) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const statement: string[] = doc.splitTextToSize(clean(signatures.statement), width - margin * 2);
    doc.setFontSize(8);
    const employeeLines: string[] = doc.splitTextToSize(clean(signatures.employee), 75);
    const responsibleLines: string[] = doc.splitTextToSize(clean(signatures.responsible), 75);
    const requiredHeight = statement.length * 4.5 + 45 + Math.max(employeeLines.length,responsibleLines.length) * 3.8;
    let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    if (y + requiredHeight > height - 24) { doc.addPage(); y = tableTop; }
    doc.setFontSize(10);
    doc.setTextColor(...blue);
    doc.text(statement, margin, y, { lineHeightFactor: 1.25 });
    const signatureY = y + statement.length * 4.5 + 28;
    doc.setDrawColor(...blue);
    doc.line(margin,signatureY,margin+75,signatureY);
    doc.line(width-margin-75,signatureY,width-margin,signatureY);
    doc.setFontSize(8);
    doc.text("FIRMA DEL EMPLEADO · RECIBÍ CONFORME",margin,signatureY+5);
    doc.text(employeeLines,margin,signatureY+10);
    doc.text("FIRMA DEL RESPONSABLE · ENTREGUÉ",width-margin-75,signatureY+5);
    doc.text(responsibleLines,width-margin-75,signatureY+10);
    doc.setTextColor(80,100,120);
    doc.text("Documento pendiente de firma manuscrita. Conservar el ejemplar firmado como constancia de entrega.",margin,signatureY+20+Math.max(employeeLines.length,responsibleLines.length)*3.8);
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    drawHeader();
    doc.setDrawColor(215, 224, 238);
    doc.setLineWidth(0.3);
    doc.line(margin, height - 17, width - margin, height - 17);
    doc.setFontSize(8);
    doc.setTextColor(80, 100, 120);
    doc.text("AGBC · Gestión responsable de recursos", margin, height - 11);
    doc.text(`Página ${page} de ${pages}`, width - margin, height - 11, { align: "right" });
  }
  return doc;
}

export function createDeliveryReceipt(request: { id: string; material: string; quantity: number; unit: string; delivered_at: string | null; delivery_place: string | null; updated_at: string; responsible: string }, recipient: { name: string; document: string; position: string; department: string }, warehouse: string, issuer: string, logo: string | Uint8Array) {
  if (!request.delivered_at) throw new Error("La entrega debe estar confirmada antes de emitir el acta.");
  const format = (date: string) => new Intl.DateTimeFormat("es-BO", { timeZone:"America/La_Paz",dateStyle:"short",timeStyle:"short" }).format(new Date(date));
  const context = `Acta N° ${request.id} · Versión: ${format(request.updated_at)}\nEmpleado: ${recipient.name} · CI: ${recipient.document || 'Sin registrar'} · Cargo: ${recipient.position || 'Sin registrar'} · Unidad: ${recipient.department || 'Sin registrar'}\nAlmacén: ${warehouse} · Lugar: ${request.delivery_place || warehouse} · Entrega: ${format(request.delivered_at)}\nResponsable de entrega: ${request.responsible} · Emitido por: ${issuer}`;
  return createReportPdf("Acta de entrega", [{ Material:request.material,Cantidad:request.quantity,Unidad:request.unit }], context, logo, {
    statement:"Declaro haber recibido los materiales detallados en esta acta. La conformidad de la entrega se acredita con las firmas manuscritas del empleado y del responsable.",
    employee:`${recipient.name} · CI: ${recipient.document || '________________'}`,
    responsible:request.responsible,
  });
}

export function createRequestReceipt(data:RequestReceiptData,logo:string|Uint8Array,consultationUrl='/consultar-solicitud') {
  const doc=new jsPDF({format:'a4'});
  const blue:[number,number,number]=[11,59,131];
  const clean=(value:unknown)=>String(value??'—').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const format=(value:string,withTime=false)=>new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'short',...(withTime?{timeStyle:'short' as const}:{})}).format(new Date(value.length===10?`${value}T12:00:00-04:00`:value));
  const issued=format(new Date().toISOString(),true);
  const rows:unknown[][]=[
    ['Fecha de solicitud',format(data.created_at,true)],
    ['Solicitante',data.requester.name],['CI y extensión',data.requester.document],
    ['Cargo',data.requester.position],['Unidad / departamento',data.requester.department],
    ['Almacén',`${data.warehouse} · ${data.warehouse_location}`],
    ['Código del material',data.material_code],['Material solicitado',data.material],
    ['Cantidad / unidad',`${data.quantity} ${data.unit}`],['Fecha requerida',format(data.needed_on)],
    ['Prioridad',data.priority==='urgent'?'Urgente':'Normal'],['Motivo de la solicitud',data.purpose],
    ['Estado de la solicitud',statuses[data.status]??data.status],
    ...(data.delivery_on?[['Fecha de recojo',format(data.delivery_on)],['Lugar de recojo',data.delivery_place||data.warehouse]]:[]),
    ['Respuesta del almacén',data.response||'Pendiente de respuesta.'],
    ...(data.status==='delivered'&&data.delivered_at?[['Entrega registrada',format(data.delivered_at,true)]]:[]),
    ['Consulta del estado',`${consultationUrl}\nIngrese su CI con extensión y el comprobante. Conserve este código.`],
  ];
  doc.setProperties({title:`Comprobante de solicitud ${data.reference}`,author:'AGBC',subject:'Registro de solicitud de material'});
  autoTable(doc,{
    startY:91,margin:{top:91,bottom:30,left:16,right:16},head:[['Dato','Detalle']],
    body:rows.map(row=>row.map(clean)),
    rowPageBreak:'avoid',
    styles:{font:'helvetica',fontSize:9,cellPadding:2,overflow:'linebreak',lineColor:[223,230,238],lineWidth:.1},
    columnStyles:{0:{cellWidth:44,fontStyle:'bold'}},
    headStyles:{fillColor:blue,textColor:[255,255,255]},alternateRowStyles:{fillColor:[244,247,252]},
  });
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);
    doc.addImage(logo,'PNG',16,13,53,53*94/236,'agbc-logo');
    doc.setTextColor(...blue);doc.setFont('helvetica','bold');doc.setFontSize(11);
    doc.text('AGENCIA BOLIVIANA DE CORREOS',194,21,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('GESTIÓN DE ALMACENES · SOLICITUD DE MATERIAL',194,28,{align:'right'});
    doc.setFillColor(...blue);doc.rect(16,40,178,1.2,'F');doc.setFillColor(255,196,0);doc.rect(16,41.2,40,1.2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('Comprobante de solicitud',16,54);
    doc.setFillColor(255,243,192);doc.roundedRect(16,61,178,17,2,2,'F');
    doc.setFontSize(8);doc.text('COMPROBANTE N°',20,67);doc.setFontSize(14);doc.text(clean(data.reference),20,74);
    doc.setFontSize(9);doc.text('Conserve este código para consultar su solicitud.',190,71,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(80,100,120);doc.text(`Fecha de emisión: ${issued} (Bolivia)`,16,85);
    doc.setDrawColor(215,224,238);doc.line(16,273,194,273);
    doc.setFontSize(8);doc.text('Este comprobante acredita el registro de la solicitud. No acredita la entrega del material.',16,279);
    doc.text('AGBC · Gestión responsable de recursos',16,287);doc.text(`Página ${page} de ${pages}`,194,287,{align:'right'});
  }
  return doc;
}
