"use client";

import { Printer } from "lucide-react";

export function ImprimirHistorialVida({ pdfHref }: { pdfHref?: string }) {
  const className = "print:hidden inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
  if (pdfHref) return <a href={pdfHref} target="_blank" rel="noreferrer" className={className}>
    <Printer className="h-4 w-4" aria-hidden="true" />
    Imprimir
  </a>;
  return <button type="button" onClick={() => window.print()} className={className}>
    <Printer className="h-4 w-4" aria-hidden="true" />
    Imprimir
  </button>;
}
