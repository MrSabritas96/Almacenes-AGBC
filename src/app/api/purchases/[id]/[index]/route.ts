import { warehouseContext } from '@/lib/warehouse';
import { pool } from '@/db';
export async function GET(request:Request,{params}:{params:Promise<{id:string;index:string}>}) {
  try {
    const {id,index}=await params;
    if(!/^\d$/.test(index))return new Response('No encontrado',{status:404});
    const viewer=await warehouseContext(new URL(request.url).searchParams.get('tabId')??undefined);
    const result=await pool.query(`select p.attachments->$2::int as attachment from purchases p join materials m on m.id=p.material_id
      where p.id=$1 and ($3::text is null or m.warehouse_id=$3)`,[id,Number(index),viewer.role==='superadmin'?null:viewer.warehouse_id]);
    const a=result.rows[0]?.attachment;
    if(!a)return new Response('No encontrado',{status:404});
    const disposition=new URL(request.url).searchParams.get('view')==='1'?'inline':'attachment';
    return new Response(Buffer.from(a.data,'base64'),{headers:{'Content-Type':a.type,'Content-Disposition':`${disposition}; filename*=UTF-8''${encodeURIComponent(a.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Acceso no autorizado',{status:403});}
}
