"use client";
import Link from "next/link";
import { Eye, Pencil, Trash2, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarArchivoPapelera } from "@/actions/activos/archivo-gestion";

export function AccionesArchivo({
  id,
  numero,
  version,
  pdfListo,
  gestionar,
  eliminada,
}: {
  id: string;
  numero: string;
  version: number;
  pdfListo: boolean;
  gestionar: boolean;
  eliminada: boolean;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function cambiar() {
    start(async () => {
      try {
        const r = await enviarArchivoPapelera({ id, version, restaurar: eliminada });
        if (!r.ok) {
          setError(r.error ?? "No se pudo guardar.");
          return;
        }
        setConfirmar(false);
        router.refresh();
      } catch {
        setError("No se pudo guardar. Vuelve a intentarlo.");
      }
    });
  }

  const estilo =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!eliminada && (
          <>
            {pdfListo ? (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`/activos/archivo-actas/${id}/pdf`}
                aria-label={`Ver PDF de ${numero}`}
                title={`Ver PDF de ${numero}`}
                className={`${estilo} bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600`}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-xs text-ink-400">PDF en preparación</span>
            )}
            {gestionar && (
              <Link
                href={`/activos/archivo-actas/${id}/editar`}
                aria-label={`Editar ${numero}`}
                title={`Editar ${numero}`}
                className={`${estilo} bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </>
        )}
        {gestionar && (
          <button
            type="button"
            disabled={pending}
            onClick={() => (eliminada ? cambiar() : setConfirmar(true))}
            aria-label={
              pending
                ? "Guardando…"
                : eliminada
                ? `Restaurar ${numero}`
                : `Eliminar ${numero}`
            }
            title={eliminada ? `Restaurar ${numero}` : `Eliminar ${numero}`}
            className={`${estilo} ${
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
      </div>
      {confirmar && (
        <div
          role="group"
          aria-label={`Confirmar eliminación de ${numero}`}
          className="max-w-xs rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-md"
        >
          <p className="text-xs text-rose-800">
            ¿Enviar {numero} a la papelera? Podrás restaurarla.
          </p>
          <div className="mt-2 flex gap-2 justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmar(false)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={cambiar}
              className="rounded-lg bg-brand-900 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-brand-950 disabled:opacity-50"
            >
              {pending ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="max-w-xs text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
