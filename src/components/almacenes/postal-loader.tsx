import Image from 'next/image';

/** Una misma animación para esperas de página, paneles y acciones. */
export function PostalLoader({size='inline',label='Cargando…'}:{size?:'inline'|'panel'|'page';label?:string}) {
  return <span className={`postal-loader postal-loader-${size}`} role={size==='inline'?undefined:'status'} aria-live={size==='inline'?undefined:'polite'} aria-hidden={size==='inline'?true:undefined}>
    <span className="postal-loader-track"><span className="postal-loader-rider"><Image src="/brand/correos-delivery-transparent.png" alt="" width={1448} height={1086} sizes={size==='inline'?'40px':size==='panel'?'128px':'180px'}/></span></span>
    {size!=='inline'&&<span className="postal-loader-label">{label}</span>}
  </span>;
}
