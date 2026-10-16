"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, RefreshCw } from "lucide-react";

export default function DashboardUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <main className="access-panel error-page" aria-busy={pending}>
    <h1>No se pudo cargar tu espacio</h1>
    <p className="muted">Comprueba tu conexión y que tu cuenta tenga un rol de almacenes activo. Puedes intentar nuevamente.</p>
    <div className="error-actions">
      <button className="primary-button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? <LoaderCircle size={16} className="motion-spin" /> : <RefreshCw size={16} />}
        {pending ? "Reintentando…" : "Intentar nuevamente"}
      </button>
      <Link href="/almacenes" className="secondary-button">Volver al acceso</Link>
    </div>
  </main>;
}
