import { GState, jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { statuses, type RequestReceiptData, type DeliveryReceiptData } from "./warehouse-types";

type ReportImage=string|Uint8Array;
export type ReportLogos={agency:ReportImage;presidency:ReportImage};

export async function loadReportLogos():Promise<ReportLogos> {
  const load=async(path:string)=>{
    const response=await fetch(path);
    if(!response.ok)throw new Error('No se pudieron cargar los logos institucionales.');
    return new Uint8Array(await response.arrayBuffer());
  };
  const [agency,presidency]=await Promise.all([load('/brand/correos-logo-transparent.png'),load('/brand/report-presidency.png')]);
  return {agency,presidency};
}

function drawDocumentHeader(doc:jsPDF,logos:ReportLogos,subtitle:string) {
  const width=doc.internal.pageSize.getWidth();
  doc.saveGraphicsState();
  doc.setGState(new GState({opacity:1}));
  doc.addImage(logos.presidency,'PNG',16,9,28,28,'presidency-watermark');
  doc.addImage(logos.agency,'PNG',width-16-53,13,53,53*359/1099,'agency-watermark');
  doc.restoreGraphicsState();
  doc.setTextColor(11,59,131);doc.setFont('helvetica','bold');doc.setFontSize(9);
  doc.text('AGENCIA BOLIVIANA DE CORREOS',width/2,20,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(7);
  doc.text(doc.splitTextToSize(subtitle,width-148),width/2,27,{align:'center',lineHeightFactor:1.3});
}

export function createReportPdf(title: string, rows: Record<string, unknown>[], context: string, logos: ReportLogos, signatures?: { statement: string; employee: string; responsible: string }, options?: { institutionalSignatures?: boolean; movementLayout?: boolean }) {
  if (!rows.length) throw new Error("No hay registros para exportar.");
  const clean = (value: unknown) => String(value ?? "—").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const columns = Object.keys(rows[0] ?? {});
  const inventory = ['Código','Material','Descripción','Según factura','Costo unitario Bs','Valor disponible Bs','Partida','Unidad','Disponible','Reservado','Mínimo','Ubicación','Almacén'];
  const isInventory = !signatures && columns.length===inventory.length && columns.every((key,index)=>key===inventory[index]);
  const isMovement = options?.movementLayout === true;
  const movementInfoColumns=columns.length-8;
  const movementWeights=[21,44,...(columns.includes('Descripción')?[44]:[]),17,18,23,18,23,18,23,18,23];
  const doc = new jsPDF({ orientation: signatures ? "portrait" : columns.length > 6 ? "landscape" : "portrait", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = isInventory || isMovement ? 10 : 16;
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
  const drawHeader = (firstPage:boolean) => {
    drawDocumentHeader(doc,logos,signatures ? "GESTIÓN DE ALMACENES · CONSTANCIA DE ENTREGA" : "GESTIÓN DE ALMACENES · INFORME INSTITUCIONAL");
    doc.setFillColor(...blue);
    doc.rect(margin, 40, width - margin * 2, 1.2, "F");
    doc.setFillColor(...yellow);
    doc.rect(margin, 41.2, 40, 1.2, "F");
    if (!firstPage && !signatures) return;
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
    head: isMovement ? [
      [
        ...columns.slice(0,movementInfoColumns).map(content=>({content,rowSpan:2})),
        ...['Saldos iniciales','Ingresos','Egresos','Saldo final'].map(content=>({content,colSpan:2})),
      ],
      Array.from({length:4},()=>['Cantidad','Valor Bs']).flat(),
    ] : [isInventory ? ['Código','Material','Descripción','Según factura','Costo unit. Bs','Valor disp. Bs','Partida','Unidad','Disp.','Reserv.','Mín.','Ubicación','Almacén'] : columns], body: rows.map(row => columns.map(key => clean(row[key]))),
    startY: tableTop,
    margin: { top: signatures?tableTop:46, bottom: 22, left: margin, right: margin },
    styles: { font: "helvetica", fontSize: signatures||isInventory||isMovement?7:8, cellPadding: signatures?2:isInventory||isMovement?1:2, overflow: "linebreak", cellWidth: columns.length > 9 && !isInventory && !isMovement ? 28 : "auto" },
    columnStyles: isMovement ? Object.fromEntries(movementWeights.map((weight,index)=>[index,{cellWidth:weight*(width-margin*2)/movementWeights.reduce((sum,w)=>sum+w,0),...(index>=movementInfoColumns?{halign:'right' as const}:{})}])) : isInventory ? Object.fromEntries([18,30,47,24,18,18,23,15,13,13,11,21,22].map((weight,index)=>[index,{cellWidth:weight*(width-margin*2)/273,...(index>=4&&index<=5||index>=8&&index<=10?{halign:'right' as const}:{})}])) : {},
    headStyles: { fillColor: blue, textColor: [255, 255, 255], fontStyle: "bold", cellPadding: isInventory||isMovement?1.5:3, ...(isMovement?{halign:'center',valign:'middle'}:{}) },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    rowPageBreak: "avoid",
    horizontalPageBreak: columns.length > 9 && !isInventory && !isMovement,
    horizontalPageBreakRepeat: 0,
  });
  if (signatures) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const statement: string[] = doc.splitTextToSize(clean(signatures.statement), width - margin * 2);
    doc.setFontSize(8);
    const employeeLines: string[] = doc.splitTextToSize(clean(signatures.employee), 75);
    const responsibleLines: string[] = doc.splitTextToSize(clean(signatures.responsible), 75);
    const requiredHeight = statement.length * 4.5 + 65 + Math.max(employeeLines.length,responsibleLines.length) * 3.8;
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
    doc.line(margin,signatureY+38,margin+75,signatureY+38);
    doc.line(width-margin-75,signatureY+38,width-margin,signatureY+38);
    doc.text("VoBo ALMACENES · FIRMA Y SELLO",margin,signatureY+43);
    doc.text("AUTORIZADO POR · FIRMA Y SELLO",width-margin-75,signatureY+43);
    doc.setTextColor(80,100,120);
    doc.text("Documento pendiente de firma manuscrita. Conservar el ejemplar firmado como constancia de entrega.",margin,signatureY+48+Math.max(employeeLines.length,responsibleLines.length)*3.8);
  }
  if (options?.institutionalSignatures) {
    let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    if (y + 65 > height - 22) { doc.addPage(); y = 56; }
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...blue);
    doc.text('Revisar y adjuntar la documentación de soporte antes de la firma.',margin,y);
    const gap=10, column=(width-margin*2-gap*2)/3;
    for (const [index,label] of ['Firma Contabilidad','Firma Responsable de almacenes','Firma DGAA - DAF'].entries()) {
      const x=margin+index*(column+gap);
      doc.line(x,y+32,x+column,y+32);
      doc.text(label,x+column/2,y+38,{align:'center'});
      doc.text('Nombre, firma y sello',x+column/2,y+44,{align:'center'});
    }
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    drawHeader(page===1);
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

export function createDeliveryReceipt(request: DeliveryReceiptData['request'], recipient: DeliveryReceiptData['recipient'], warehouse: string, issuer: string, logos: ReportLogos) {
  if (!request.delivered_at) throw new Error("La entrega debe estar confirmada antes de emitir el acta.");
  const format = (date: string) => new Intl.DateTimeFormat("es-BO", { timeZone:"America/La_Paz",dateStyle:"short",timeStyle:"short" }).format(new Date(date));
  const cost=request.unit_cost==null?null:Number(request.unit_cost);
  const context = `Acta N° ${request.id} · Versión: ${format(request.updated_at)}
Entidad: Agencia Boliviana de Correos · Regional: ${recipient.regional||'Sin asignar'}${request.fund?.trim()?` · Fondo: ${request.fund}`:''}
Cliente / destino: ${recipient.name} · CI: ${recipient.document || 'Sin registrar'} · Cargo: ${recipient.position || 'Sin registrar'} · Unidad: ${recipient.department || 'Sin registrar'}
Almacén: ${warehouse} · Clase: Egreso (pedido) · Pedido: ${request.id}
Lugar: ${request.delivery_place || warehouse} · Entrega: ${format(request.delivered_at)}
Glosa: ver descripción del producto
Responsable de entrega: ${request.responsible} · Emitido por: ${issuer} · Expresado en bolivianos`;
  const entries=request.allocations?.length?request.allocations:undefined;
  const total=entries?entries.reduce((sum,entry)=>sum+entry.quantity*Number(entry.unit_cost),0):cost==null?null:cost*request.quantity;
  const rows=entries?entries.map((entry,index)=>({'N°':index+1,Ítem:request.code||'Sin código',Descripción:`${request.material}${request.purpose?`\nGlosa: ${request.purpose}`:''}`,Unidad:request.unit,Vencimiento:entry.expires_on||'No especificado',Lote:`${entry.entry_code}${entry.lot?` · ${entry.lot}`:''}`,Cantidad:entry.quantity,'Costo unitario Bs':Number(entry.unit_cost).toFixed(2),'Costo total Bs':(Number(entry.unit_cost)*entry.quantity).toFixed(2)})):[{ 'N°':1,Ítem:request.code||'Sin código',Descripción:`${request.material}${request.purpose?`\nGlosa: ${request.purpose}`:""}`,Unidad:request.unit,Vencimiento:request.expires_on||'No especificado',Lote:request.lot||'No especificado',Cantidad:request.quantity,'Costo unitario Bs':cost==null?'Sin dato histórico':cost.toFixed(2),'Costo total Bs':cost==null?'Sin dato histórico':(cost*request.quantity).toFixed(2) }];
  return createReportPdf("Acta de entrega de productos", rows, context, logos, {
    statement:`Total entregado: ${request.quantity} ${request.unit}. Total Bs: ${total==null?'Sin dato histórico':total.toFixed(2)}. Declaro haber recibido los materiales detallados. Visto bueno de almacenes y autorización: firma y sello al pie.`,
    employee:`${recipient.name} · CI: ${recipient.document || '________________'}`,
    responsible:request.responsible,
  });
}

export function createRequestReceipt(data:RequestReceiptData,logos:ReportLogos) {
  const doc=new jsPDF({format:'a4'});
  const blue:[number,number,number]=[11,59,131];
  const clean=(value:unknown)=>String(value??'—').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const format=(value:string,withTime=false)=>new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'short',...(withTime?{timeStyle:'short' as const}:{})}).format(new Date(value.length===10?`${value}T12:00:00-04:00`:value));
  const issued=format(new Date().toISOString(),true);
  const items=data.items?.length?data.items:[data];
  const multiple=items.length>1;
  const rows:unknown[][]=[
    ['Fecha de solicitud',format(data.created_at,true)],
    ['Solicitante',data.requester.name],['CI y extensión',data.requester.document],
    ['Regional',data.requester.regional||'Sin asignar'],['Cargo',data.requester.position],['Unidad / departamento',data.requester.department],
    ['Almacén',`${data.warehouse} · ${data.warehouse_location}`],
    ['Prioridad',data.priority==='urgent'?'Urgente':'Normal'],['Motivo de la solicitud',data.purpose],
    ['Estado de la solicitud',multiple?'Ver estado de cada material en el detalle.':statuses[data.status]??data.status],
    ...(!multiple&&data.delivery_on?[['Fecha de recojo',format(data.delivery_on)],['Lugar de recojo',data.delivery_place||data.warehouse]]:[]),
    ...(!multiple?[['Respuesta del almacén',data.response||'Pendiente de respuesta.']]:[]),
    ...(!multiple&&data.status==='delivered'&&data.delivered_at?[['Entrega registrada',format(data.delivered_at,true)]]:[]),
  ];
  doc.setProperties({title:`Comprobante de solicitud ${data.reference}`,author:'AGBC',subject:'Registro de solicitud de material'});
  autoTable(doc,{
    startY:91,margin:{top:91,bottom:30,left:16,right:16},
    head:[['N°','Código','Pedido','Autorizado','Unidad de medida','Descripción',...(multiple?['Estado']:[])]],
    body:items.map((item,index)=>[index+1,clean(item.material_code),item.quantity,clean(item.authorized_quantity??(['approved','delivered'].includes(item.status)?item.quantity:item.status==='denied'?0:'Pendiente')),clean(item.unit),clean(item.material)+(multiple?`${item.response?`\nRespuesta: ${clean(item.response)}`:''}${item.delivery_on?`\nRecojo: ${format(item.delivery_on)} · ${clean(item.delivery_place||data.warehouse)}`:''}${item.status==='delivered'&&item.delivered_at?`\nEntregado: ${format(item.delivered_at,true)}`:''}`:''),...(multiple?[statuses[item.status]??item.status]:[])]),
    styles:{font:'helvetica',fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:blue,textColor:[255,255,255]},
  });
  const detailBottom=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY;
  autoTable(doc,{
    startY:detailBottom+5,margin:{top:91,bottom:30,left:16,right:16},head:[['Dato','Detalle']],
    body:rows.map(row=>row.map(clean)),
    rowPageBreak:'avoid',
    styles:{font:'helvetica',fontSize:9,cellPadding:1.5,overflow:'linebreak',lineColor:[223,230,238],lineWidth:.1},
    columnStyles:{0:{cellWidth:44,fontStyle:'bold'}},
    headStyles:{fillColor:blue,textColor:[255,255,255]},alternateRowStyles:{fillColor:[244,247,252]},
  });
  // Reserva espacio de escritura antes de las firmas, sin invadir los datos ni el pie.
  const contentBottom=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY;
  if(contentBottom>222)doc.addPage();
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);
    drawDocumentHeader(doc,logos,'GESTIÓN DE ALMACENES · SOLICITUD DE MATERIAL');
    doc.setFillColor(...blue);doc.rect(16,40,178,1.2,'F');doc.setFillColor(255,196,0);doc.rect(16,41.2,40,1.2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('Pedido interno a almacenes',16,54);
    doc.setFillColor(255,243,192);doc.roundedRect(16,61,178,17,2,2,'F');
    doc.setFontSize(8);doc.text('COMPROBANTE N°',20,67);doc.setFontSize(14);doc.text(clean(data.reference),20,74);
    doc.setFontSize(9);doc.text('Conserve este código para consultar su solicitud.',190,71,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(80,100,120);doc.text(`Fecha de emisión: ${issued} (Bolivia)`,16,85);
    doc.setDrawColor(215,224,238);doc.line(16,273,194,273);
    doc.setFontSize(8);doc.text('Este comprobante acredita el registro de la solicitud. No acredita la entrega del material.',16,279);
    doc.text('AGBC · Gestión responsable de recursos',16,287);doc.text(`Página ${page} de ${pages}`,194,287,{align:'right'});
  }
  doc.setPage(pages);
  doc.setDrawColor(...blue);doc.setTextColor(...blue);doc.setLineWidth(.25);
  doc.line(16,250,96,250);doc.line(114,250,194,250);
  doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('FIRMA DEL SOLICITANTE',56,256,{align:'center'});
  doc.text('VISTO BUENO / AUTORIZADO POR',154,256,{align:'center'});
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);
  doc.text('Firma',56,262,{align:'center'});
  doc.text('Firma y sello',154,262,{align:'center'});
  return doc;
}
