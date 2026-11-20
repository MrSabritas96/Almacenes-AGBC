"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BotonAtras() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Volver a la página anterior"
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:bg-blue-100"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Atrás
    </button>
  );
}
