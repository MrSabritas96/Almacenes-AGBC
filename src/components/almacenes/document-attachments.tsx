"use client";
import { Download, ExternalLink, FileText } from 'lucide-react';
import { useWarehouseTab } from './tab-session';

export function DocumentAttachments({kind,id,files}:{kind:'materials'|'purchases';id:string;files:{name:string;type:string}[]}) {
  const tabId=useWarehouseTab();
  return <ul className="attachment-list">{files.map((file,index)=>{
    const query=new URLSearchParams();if(tabId)query.set('tabId',tabId);
    const url=`/api/${kind}/${encodeURIComponent(id)}/${index}`;
    const download=`${url}?${query}`;query.set('view','1');
    return <li key={index}><span className="attachment-name"><FileText size={16} aria-hidden="true"/>{file.name}</span><div className="attachment-actions"><a className="small-button" href={`${url}?${query}`} target="_blank" rel="noopener noreferrer" aria-label={`Visualizar ${file.name} (nueva pestaña)`}><ExternalLink size={15} aria-hidden="true"/>Visualizar</a><a className="small-button" href={download} download aria-label={`Descargar ${file.name}`}><Download size={15} aria-hidden="true"/>Descargar</a></div></li>;
  })}</ul>;
}
