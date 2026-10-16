import { ArrowUpRight, Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function Brand() {
  return <Link href="/" className="postal-brand" aria-label="Correos de Bolivia · Portal institucional"><span className="brand-compact" aria-hidden="true"><Mail size={26}/><span>AGBC</span></span><Image src="/brand/correos-logo-yellow.png" alt="Correos de Bolivia" width={1099} height={359} sizes="(max-width: 760px) 150px, 196px" priority/><span className="brand-caption">AGENCIA BOLIVIANA DE CORREOS</span></Link>;
}
export function WarehouseIllustration() {
  return <div className="warehouse-illustration"><Image src="/brand/correos-mascot.png" alt="Mensajero de Correos de Bolivia saludando y sosteniendo un sobre" width={1440} height={1100} sizes="(max-width: 760px) 280px, 420px" priority/></div>;
}
export function BackToPortal() { return <Link href="/" className="text-link">Portal institucional <ArrowUpRight size={15}/></Link>; }
