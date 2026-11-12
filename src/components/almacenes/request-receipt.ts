"use client";
import { withMinimumLoading } from '@/lib/loading-time';
import { getPublicRequestReceipt } from '@/actions/almacenes/request-status';

export async function downloadRequestReceipt(document:string,reference:string) {
  return withMinimumLoading(async()=>{
  const result=await getPublicRequestReceipt({document,reference});
  if(!result.ok)throw new Error(result.error);
  const {createRequestReceipt,loadReportLogos}=await import('@/lib/report-pdf');
  const logos=await loadReportLogos();
  const doc=createRequestReceipt(result.data,logos);
  await doc.save(`comprobante-${result.data.reference}.pdf`,{returnPromise:true});
  });
}
