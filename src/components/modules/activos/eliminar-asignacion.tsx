"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw } from "lucide-react";
import { guardarPapeleraAsignacion } from "@/actions/activos/asignaciones-papelera";

export function EliminarAsignacion({ id, eliminada }: { id: string; eliminada: boolean }) {
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function cambiar() {
    start(async () => {
      setError("");
      const r = await guardarPapeleraAsignacion({ id, restaurar: eliminada });
      if (!r.ok) {
        setError(r.error ?? "No se pudo actualizar la asignación.");
        return;
      }
      setConfirmar(false);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-block text-left">
      {confirmar ? (
        <div className="absolute right-0 top-0 z-30 w-72 rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-lg">
          <p className="mb-2 text-xs leading-relaxed text-rose-900">
            ¿Mover esta asignación a Eliminadas? El historial y las actas se conservan.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmar(false)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={cambiar}
              className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
            >
              {pending ? "Eliminando…" : "Confirmar"}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-rose-800">{error}</p>}
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => (eliminada ? cambiar() : setConfirmar(true))}
          aria-label={eliminada ? "Restaurar asignación" : "Eliminar asignación"}
          title={eliminada ? "Restaurar asignación" : "Eliminar asignación"}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
            eliminada
              ? "bg-amber-500 text-slate-950 hover:bg-amber-600 focus-visible:outline-amber-500"
            : "bg-brand-900 text-accent-400 hover:bg-brand-950 focus-visible:outline-accent-400"
          }`}
        >
          {eliminada ? (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
      {error && !confirmar && (
        <p role="alert" className="mt-1 text-xs text-rose-800">{error}</p>
      )}
    </div>
  );
}
