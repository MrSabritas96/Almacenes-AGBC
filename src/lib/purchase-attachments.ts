import { WarehouseError } from './warehouse-errors';

export async function readPurchaseAttachments(form: FormData) {
  const files=form.getAll('attachments').filter((f):f is File=>f instanceof File&&f.size>0);
  if(files.length>4)throw new WarehouseError('Adjunta hasta 4 respaldos (PDF, JPG o PNG, máximo 2 MB cada uno).');
  const attachments=[];
  for(const file of files){
    if(file.size>2*1024*1024)throw new WarehouseError('Cada respaldo admite hasta 2 MB.');
    const buffer=Buffer.from(await file.arrayBuffer());
    const type=buffer.subarray(0,5).toString()==='%PDF-'?'application/pdf':buffer.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':'';
    if(!type)throw new WarehouseError('Solo se permiten archivos PDF, JPG y PNG válidos.');
    attachments.push({name:file.name.replace(/[^\p{L}\p{N} ._-]/gu,'_').slice(0,180),type,data:buffer.toString('base64')});
  }
  return attachments;
}
