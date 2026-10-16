"use client";
import { getPublicRequestReceipt } from '@/actions/almacenes/request-status';

export async function downloadRequestReceipt(document:string,reference:string) {
  const result=await getPublicRequestReceipt({document,reference});
  if(!result.ok)throw new Error(result.error);
  const {createRequestReceipt,loadReportLogo}=await import('@/lib/report-pdf');
  const logo=await loadReportLogo();
  const doc=createRequestReceipt(result.data,logo,new URL('/consultar-solicitud',window.location.origin).href);
  await doc.save(`comprobante-${result.data.reference}.pdf`,{returnPromise:true});
}
