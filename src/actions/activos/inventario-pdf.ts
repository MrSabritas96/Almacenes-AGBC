import { catalogoProcedencias } from "./procedencias-consultas";
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { fuenteVera, fuenteVeraBold } from "@/components/modules/activos/pdf-assets";
import { cabeceraActualPng } from "@/components/modules/activos/pdf-cabecera-actual";
import type { FiltrosActivos } from "./consultas";

type BienInventario = { codigo: string | null; origen: string; descripcion: string; regional: string | null; estado: string | null; ubicacion: string | null; responsable: string | null };
function envolver(value: string, font: PDFFont, size: number, width: number) {
 const result:string[]=[];let line="";
 for(const word of value.replace(/[\x00-\x1F\x7F]/g," ").split(/\s+/).filter(Boolean)){
  if(line&&font.widthOfTextAtSize(line+" "+word,size)>width){result.push(line);line="";}
  if(font.widthOfTextAtSize(word,size)>width){if(line){result.push(line);line="";}for(const letter of word){if(line&&font.widthOfTextAtSize(line+letter,size)>width){result.push(line);line="";}line+=letter;}}
  else line=line?line+" "+word:word;
 }
 if(line)result.push(line);return result.length?result:[""];
}
export async function generarInventarioPdf(bienes:BienInventario[],filtros:FiltrosActivos){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const normal=await doc.embedFont(Buffer.from(fuenteVera,"base64"),{subset:true});
 const bold=await doc.embedFont(Buffer.from(fuenteVeraBold,"base64"),{subset:true});
 const logos=await doc.embedPng(Buffer.from(cabeceraActualPng,"base64"));
 const ink=rgb(.08,.12,.2),muted=rgb(.38,.44,.52),navy=rgb(.13,.17,.38),border=rgb(.88,.9,.94),light=rgb(.97,.98,.99),green=rgb(.02,.48,.36);
 const widths=[28,110,245,80,130,197],padding=[5,6,8,15,15,27];
 const headers=["N°","CÓDIGO /\nPROCEDENCIA","DESCRIPCIÓN DEL ACTIVO","REGIONAL","UBICACIÓN","RESPONSABLE ASIGNADO"];
 const stamp=new Intl.DateTimeFormat("es-BO",{timeZone:"America/La_Paz",dateStyle:"short",timeStyle:"short"}).format(new Date());
 const procedencias=await catalogoProcedencias();
 const nombreOrigen=(value:string)=>procedencias.find(p=>p.clave===value)?.nombre||value;
 const conditions=[filtros.origen?`Procedencia: ${nombreOrigen(filtros.origen)}`:"Todas las procedencias",filtros.q?`Búsqueda: ${filtros.q}`:"",filtros.ubicacion?`Ubicación: ${filtros.ubicacion}`:"",filtros.responsable?`Responsable: ${filtros.responsable}`:"",filtros.revision?"Solo registros que requieren revisión":""].filter(Boolean).join(" | ");
 let page!:PDFPage,y=0,badgeY=0;
 const centered=(text:string,baseline:number,size:number,font=bold,color=ink)=>page.drawText(text,{x:(841.89-font.widthOfTextAtSize(text,size))/2,y:baseline,font,size,color});
 function logoLateral(x:number,width:number,sourceOffset:number){
  // Recorte de composición en PDF: el PNG institucional permanece intacto.
  page.pushOperators(pushGraphicsState(),rectangle(x,493,width,76),clip(),endPath());
  page.drawImage(logos,{x:x-sourceOffset*.7,y:493,width:505*.7,height:99*.7});
  page.pushOperators(popGraphicsState());
 }
 function nuevaPagina(){
  page=doc.addPage([841.89,595.28]);y=568;
  if(doc.getPageCount()===1){
   logoLateral(40,145,0);logoLateral(697,103,360);
   centered("ESTADO PLURINACIONAL DE BOLIVIA",565,7,bold,muted);
   centered("AGENCIA BOLIVIANA DE CORREOS",549,10,bold,navy);
   centered("INVENTARIO DE ACTIVOS",523,19);centered("FIJOS",500,19);
   page.drawLine({start:{x:26,y:479},end:{x:816,y:479},thickness:.6,color:border});
   const criteria=envolver(conditions,normal,7,310);const boxHeight=Math.max(36,23+criteria.length*10),boxY=471-boxHeight;
   page.drawRectangle({x:26,y:boxY,width:790,height:boxHeight,color:light,borderColor:border,borderWidth:.6});
   for(const x of [123,278])page.drawLine({start:{x,y:boxY+9},end:{x,y:boxY+boxHeight-9},thickness:.6,color:border});
   const labelY=boxY+boxHeight-12,valueY=labelY-11;
   page.drawText("TOTAL DE BIENES",{x:37,y:labelY,font:bold,size:7,color:ink});
   page.drawText(`${bienes.length.toLocaleString("es-BO")} registros`,{x:37,y:valueY,font:normal,size:7,color:muted});
   page.drawText("FECHA Y HORA DE EMISIÓN",{x:135,y:labelY,font:bold,size:7,color:ink});
   page.drawText(stamp,{x:135,y:valueY,font:normal,size:7,color:muted});
   page.drawText("CRITERIO / FILTRO",{x:290,y:labelY,font:bold,size:7,color:ink});
   criteria.forEach((line,i)=>page.drawText(line,{x:290,y:valueY-i*10,font:normal,size:7,color:muted}));
   const estado=filtros.estado||"TODOS";
   const colores=estado==="BUENO"?{fondo:rgb(.85,.96,.91),texto:green}:estado==="REGULAR"?{fondo:rgb(1,.94,.75),texto:rgb(.58,.35,.02)}:estado==="MALO"?{fondo:rgb(1,.88,.88),texto:rgb(.7,.12,.15)}:{fondo:rgb(.92,.94,.97),texto:muted};
   page.drawText("ESTADO",{x:615,y:labelY,font:bold,size:7,color:ink});
   page.drawRectangle({x:615,y:valueY-4,width:72,height:15,color:colores.fondo});
   page.drawText(estado,{x:651-bold.widthOfTextAtSize(estado,7)/2,y:valueY,font:bold,size:7,color:colores.texto});
   badgeY=boxY+(boxHeight-19)/2;y=boxY-9;
  }
  const top=y;page.drawRectangle({x:26,y:top-34,width:790,height:34,color:navy});let x=26;
  headers.forEach((h,i)=>{const lines=h.split("\n");lines.forEach((line,k)=>page.drawText(line,{x:x+7,y:top-(lines.length===1?20:13+k*11),font:bold,size:6.8,color:rgb(1,1,1)}));if(i)page.drawLine({start:{x,y:top},end:{x,y:top-34},color:rgb(.45,.5,.64),thickness:.5});x+=widths[i]!;});y-=34;
 }
 nuevaPagina();
 for(let i=0;i<bienes.length;i++){
  const b=bienes[i]!,estado=b.estado?.trim().toUpperCase()||"Sin dato";
  const descripcion=b.descripcion+(!filtros.estado?`\nEstado: ${estado}`:"");
  const values=[String(i+1),`${b.codigo||"Sin código"}\n${nombreOrigen(b.origen)}`,descripcion,(b.regional||"Sin regional").toUpperCase(),b.ubicacion||"Sin ubicación",(b.responsable||"Sin responsable").toUpperCase()];
  const cells=values.map((v,j)=>v.split("\n").flatMap(t=>envolver(t,j===1?bold:normal,j===1?6.8:7,widths[j]!-padding[j]!-7)));
  const max=Math.max(...cells.map(c=>c.length));let offset=0;
  while(offset<max){
   if(y-45<34)nuevaPagina();const available=Math.max(1,Math.floor((y-34-16)/10)),count=Math.min(max-offset,available),height=Math.max(36,count*10+16);
   if(i%2===1)page.drawRectangle({x:26,y:y-height,width:790,height,color:light});
   let x=26;
   for(let j=0;j<cells.length;j++){
    if(j===0&&offset===0){page.drawCircle({x:x+13,y:y-15,size:7,color:rgb(.93,.95,.97)});const n=String(i+1);page.drawText(n,{x:x+13-normal.widthOfTextAtSize(n,6.5)/2,y:y-17.4,font:normal,size:6.5,color:muted});}
    else{
     if(offset===0&&j===3){page.drawCircle({x:x+7,y:y-13,size:3,borderColor:rgb(.65,.7,.77),borderWidth:.8});page.drawLine({start:{x:x+4.8,y:y-15.5},end:{x:x+7,y:y-19},color:rgb(.65,.7,.77),thickness:.8});page.drawLine({start:{x:x+9.2,y:y-15.5},end:{x:x+7,y:y-19},color:rgb(.65,.7,.77),thickness:.8});}
     if(offset===0&&j===4){page.drawRectangle({x:x+5,y:y-18,width:6,height:8,color:rgb(.75,.79,.84)});}
     if(offset===0&&j===5){const initials=(b.responsable||"SR").split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join("").toUpperCase();page.drawCircle({x:x+13,y:y-15,size:8,color:b.responsable?rgb(.9,.93,1):rgb(1,.95,.82)});page.drawText(initials,{x:x+13-bold.widthOfTextAtSize(initials,5.5)/2,y:y-17,font:bold,size:5.5,color:navy});}
     for(let k=0;k<count;k++){const line=cells[j]![offset+k];if(line)page.drawText(line,{x:x+padding[j]!,y:y-15-k*10,font:j===1?bold:normal,size:j===1?6.8:7,color:j===1&&offset+k===cells[j]!.length-1?muted:ink});}
    }
    x+=widths[j]!;
   }
   page.drawLine({start:{x:26,y:y-height},end:{x:816,y:y-height},thickness:.3,color:border});y-=height;offset+=count;if(offset<max)nuevaPagina();
  }
 }
 const pages=doc.getPages(),first=pages[0]!;
 first.drawRectangle({x:714,y:badgeY,width:90,height:19,color:rgb(.91,.93,.96)});
 const badge=`Página 1 de ${pages.length}`;first.drawText(badge,{x:759-bold.widthOfTextAtSize(badge,7)/2,y:badgeY+6,font:bold,size:7,color:muted});
 pages.forEach((p,i)=>{p.drawText("Inventario vigente - AGBC",{x:26,y:17,font:normal,size:7,color:muted});const label=`Página ${i+1} de ${pages.length}`;p.drawText(label,{x:816-normal.widthOfTextAtSize(label,7),y:17,font:normal,size:7,color:muted});});
 doc.setTitle("Inventario de activos fijos - AGBC");return Buffer.from(await doc.save());
}
