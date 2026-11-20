"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function AtrasHistorialVida() {
  const router = useRouter();
  return <button type="button" onClick={() => {
    if (window.history.length > 1) router.back();
    else router.push("/activos");
  }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    Atrás
  </button>;
}
