import { Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="postal-brand" aria-label="Correos de Bolivia · Inicio"><span className="brand-compact" aria-hidden="true"><Mail size={26}/><span>AGBC</span></span><Image src="/brand/correos-logo-transparent.png" alt="Correos de Bolivia" width={2170} height={725} sizes="(max-width: 760px) 150px, 196px" priority/><span className="brand-caption">AGENCIA BOLIVIANA DE CORREOS</span></Link>;
}
