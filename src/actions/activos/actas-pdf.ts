import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { cabeceraPng, fuenteVera, fuenteVeraBold } from "@/components/modules/activos/pdf-assets";
import { referenciaActa, type DocumentoActa } from "./actas-modelo";

const NOTA="La asignación de bienes genera en el servidor público la responsabilidad sobre el debido uso, custodia y mantenimiento de los mismos; la pérdida, destrucción o maltrato por negligencia será imputado a su persona. Asimismo el funcionario que tiene a su cargo dichos bienes, por ningún concepto podrá efectuar préstamos y/o transferencias por cuenta propia. Para la liberación de responsabilidad deberá solicitar la conformidad escrita de la Unidad de Activos Fijos. El presente documento no invalida las actas de gestiones pasadas de las cuales no se emitió el acta de devolución correspondiente.";
function lines(text:string,font:PDFFont,size:number,width:number){
  const out:string[]=[];
  for(const paragraph of text.replace(/\r/g,"").split("\n")){
    let line="";
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      if(font.widthOfTextAtSize(word,size)>width){
        if(line){out.push(line);line="";} let part="";
        for(const c of word){if(part && font.widthOfTextAtSize(part+c,size)>width){out.push(part);part="";}part+=c;}line=part;
      }else if(line && font.widthOfTextAtSize(line+" "+word,size)>width){out.push(line);line=word;}else line=line?line+" "+word:word;
    }
    out.push(line);
  }return out;
}
export type PlantillaArchivo={titulo:string;referencia:string;texto:string;numeros:string[];pie:string};
export async function generarActaPdf(a:DocumentoActa,archivo?:PlantillaArchivo):Promise<Buffer>{
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  const font=await doc.embedFont(Buffer.from(fuenteVera,"base64"),{subset:true});
  const bold=await doc.embedFont(Buffer.from(fuenteVeraBold,"base64"),{subset:true});
  const logo=await doc.embedPng(Buffer.from(cabeceraPng,"base64"));
  const ref=archivo?.referencia??referenciaActa(a),c=a.cabecera;
  const title=archivo?.titulo??`${a.tipo==="devolucion"?"ACTA DE DEVOLUCIÓN":a.tipo==="momentanea"?"ACTA DE ASIGNACIÓN MOMENTÁNEA":"ACTA DE ASIGNACIÓN"} DE ACTIVOS FIJOS ${c.entidad.toUpperCase()}`;
  const blue=rgb(.55,.65,.83),ink=rgb(.23,.23,.23);let page!:PDFPage,y=0;
  const draw=(text:string,x:number,top:number,size=9,weight=false)=>page.drawText(text,{x,y:top-size,font:weight?bold:font,size,color:ink});
  const centered=(text:string,top:number,size:number,weight=false,x=40,width=515)=>draw(text,x+(width-(weight?bold:font).widthOfTextAtSize(text,size))/2,top,size,weight);
  const block=(text:string,size=9,weight=false,width=515,x=40)=>{const ls=lines(text,weight?bold:font,size,width);for(const line of ls){draw(line,x,y,size,weight);y-=size+2;}return ls.length;};
  function newPage(first:boolean){
    page=doc.addPage([595.28,841.89]);y=806;
    page.drawImage(logo,{x:52,y:y-53,width:491,height:59});y-=61;
    const agency="AGENCIA BOLIVIANA DE CORREOS";
    page.drawText(agency,{x:40+(515-font.widthOfTextAtSize(agency,16))/2,y:y-16,font,size:16,color:rgb(.31,.59,.86)});y-=20;
    page.drawRectangle({x:40,y:y-21,width:515,height:21,color:blue});
    const size=Math.min(15,515*14/bold.widthOfTextAtSize(title,14));
    page.drawText(title,{x:40+(515-bold.widthOfTextAtSize(title,size))/2,y:y-16,font:bold,size,color:rgb(1,1,1)});y-=24;
    centered(archivo?ref:`N° ${ref} · ${c.entidad.toUpperCase()}`,y,12,true);y-=24;
    if(first){
      const markTop=y;
      draw(a.tipo==="devolucion"?"D":"A",425,markTop+5,70,true);
      block("RESPONSABLE:",10,true,365);block(c.responsable.toUpperCase(),10,false,365);y-=2;
      block("CARGO:",10,true,365);block(c.cargo.toUpperCase(),10,false,365);
      if(c.ci)block(`C.I.: ${c.ci}`,8,false,365);
      y=Math.min(y-6,markTop-65);
      const date=c.fecha.split("-").reverse().join("/");
      if(archivo)block(archivo.texto||"Texto de origen no identificado. Consultar el Excel original.",7.5);
      else block(`En la ciudad de ${c.ciudad}, en fecha ${date}, en instalaciones de la Agencia Boliviana de Correos, ${c.oficina}, dando cumplimiento al D.S. 181 de fecha 28 de junio de 2009, Normas Básicas del Sistema de Administración de Bienes y Servicios, Título II, Artículo Nº 116, Responsabilidad por el manejo de Bienes: "Todos los servidores públicos son responsables por el debido uso, custodia, preservación y solicitud de servicios de mantenimiento de los bienes que les fueran asignados", se procede a la ${a.tipo==="devolucion"?"DEVOLUCIÓN":a.tipo==="momentanea"?"ASIGNACIÓN MOMENTÁNEA":"ASIGNACIÓN"} de los activos de ${c.entidad}, bajo el siguiente detalle:`,7.5);
      if(c.fechaDevolucion)block(`Fecha prevista de devolución: ${c.fechaDevolucion.split("-").reverse().join("/")}`,8,true);
    }else block(`Responsable: ${c.responsable} · Continuación del detalle`,8);
    y-=7;
  }
  const vehiculo=a.bienes.every(b=>b.placa.trim());
  const mixta=!vehiculo&&a.bienes.some(b=>b.placa.trim());
  const widths=vehiculo?[26,207,60,50,172]:mixta?[24,180,67,55,50,139]:[26,210,90,50,139];
  const headers=vehiculo?["NRO.","DESCRIPCIÓN DEL ACTIVO","N° DE PLACA","ESTADO","OBSERVACIONES"]:mixta?["NRO.","DESCRIPCIÓN DEL ACTIVO","CÓDIGO","PLACA","ESTADO","OBSERVACIONES"]:["NRO.","DESCRIPCIÓN DEL ACTIVO","CÓDIGO","ESTADO","OBSERVACIONES"];
  function tableHeader(){let x=40;headers.forEach((h,i)=>{const w=widths[i]!;page.drawRectangle({x,y:y-22,width:w,height:22,color:blue,borderColor:rgb(0,0,0),borderWidth:.7});const ls=lines(h,bold,6.5,w-6);ls.forEach((l,j)=>page.drawText(l,{x:x+(w-bold.widthOfTextAtSize(l,6.5))/2,y:y-10-j*8,font:bold,size:6.5,color:rgb(1,1,1)}));x+=w;});y-=22;}
  newPage(true);tableHeader();
  for(const [index,b]of a.bienes.entries()){
    const obs=[b.observaciones,b.accesorios?`Accesorios: ${b.accesorios}`:""].filter(Boolean).join("\n")||"-";
    const numero=archivo?.numeros[index]??String(index+1);
    const cells=vehiculo?[numero,b.descripcion,b.placa,b.estado,obs]:mixta?[numero,b.descripcion,b.codigo||"SIN CÓDIGO",b.placa||"-",b.estado,obs]:[numero,b.descripcion,b.codigo||"SIN CÓDIGO",b.estado,obs];
    const arrays=cells.map((t,i)=>lines(t,font,7.5,widths[i]!-8));let offset=0;const total=Math.max(...arrays.map(ls=>ls.length));
    while(offset<total){
      if(y<250){newPage(false);tableHeader();}
      const capacity=Math.max(1,Math.floor((y-220-12)/10.5));const count=Math.min(capacity,total-offset);const height=Math.max(vehiculo?90:32,count*10.5+12);
      let x=40;arrays.forEach((ls,i)=>{const w=widths[i]!;page.drawRectangle({x,y:y-height,width:w,height,borderColor:ink,borderWidth:.7});const shown=offset>0&&i!==1&&i!==arrays.length-1?ls.slice(0,count):ls.slice(offset,offset+count);shown.forEach((l,j)=>draw(l,x+4,y-(height-shown.length*10.5)/2-j*10.5,7.5));x+=w;});y-=height;offset+=count;
      if(offset<total){newPage(false);tableHeader();}
    }
  }
  y-=14;
  const extra=archivo?[]:[`Motivo: ${c.motivo}`,`Ubicación de destino: ${c.ubicacionDestino}`,c.observacionesGenerales?`Observaciones generales: ${c.observacionesGenerales}`:""].filter(Boolean);
  for(const text of extra)for(const l of lines(text,font,8.5,515)){if(y<245){newPage(false);}draw(l,40,y,8.5);y-=11.5;}
  const signatures=[{title:"ENTREGUÉ CONFORME",name:c.entregadoPor,cargo:c.cargoEntrega,ci:c.ciEntrega},{title:"VoBo",name:"",cargo:"",ci:""},{title:"RECIBÍ CONFORME",name:c.recibidoPor,cargo:c.cargoRecepcion,ci:c.ciRecepcion}];
  const sigWidths=[162,65,162],sigLeft=103;
  const signHeight=Math.max(86,...signatures.map((s,i)=>64+[s.name,s.cargo,s.ci?`C.I.: ${s.ci}`:""].filter(Boolean).reduce((n,t)=>n+lines(t,font,6.5,sigWidths[i]!-12).length*8,0)));
  const noteWidth=418;
  const required=lines(`Nota: ${NOTA}`,bold,7,noteWidth).length*9+signHeight+62;
  if(y<required+40)newPage(false);y-=8;
  block(`Nota: ${NOTA}`,7,true,noteWidth,108);y-=8;block("*c.c.: Archivo Activos Fijos/Funcionario",7,false,418,108);
  y-=5;page.drawLine({start:{x:103,y},end:{x:520,y},thickness:.5,color:ink});
  const signTop=y-10;let signX=sigLeft;
  signatures.forEach((s,i)=>{const x=signX,w=sigWidths[i]!;signX+=w;page.drawRectangle({x,y:signTop-signHeight,width:w,height:signHeight,borderColor:ink,borderWidth:.5,borderDashArray:[1,1]});
    if(i===1){centered("VoBo",signTop-signHeight+15,11,true,x,w);return;}
    page.drawLine({start:{x,y:signTop-47},end:{x:x+w,y:signTop-47},thickness:.5,color:ink,dashArray:[1,1]});
    centered(s.title,signTop-49,6.5,true,x,w);let top=signTop-58;
    for(const text of [s.name,s.cargo,s.ci?`C.I.: ${s.ci}`:""].filter(Boolean))for(const l of lines(text,font,6.5,w-12)){centered(l,top,6.5,false,x,w);top-=8;}
  });
  const pages=doc.getPages();for(const [i,p]of pages.entries())p.drawText(`${archivo?"COPIA DEL EXCEL · PENDIENTE DE REVISIÓN · ":""}${ref} · Página ${i+1} de ${pages.length}`,{x:40,y:26,font,size:7,color:ink});
  doc.setTitle(`${title} ${ref}`);doc.setAuthor("Agencia Boliviana de Correos");doc.setSubject("Acta de activos generada con los datos guardados");
  return Buffer.from(await doc.save());
}


