export function EstadoActivo({ estado }: { estado: string | null }) {
  const normal = estado?.trim().toUpperCase();
  const color = normal === "BUENO" ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : normal === "REGULAR" ? "bg-amber-50 text-amber-800 ring-amber-200"
    : normal === "MALO" ? "bg-rose-50 text-rose-800 ring-rose-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${color}`}>{estado || "Sin estado"}</span>;
}

export function cantidad(value: number) {
  return value.toLocaleString("es-BO");
}

export function importe(value: string | null) {
  if (value == null) return "Sin dato";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value;
}

export function fecha(value: string | null) {
  if (!value) return "Sin dato";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function hayIncidencias(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export function detalleIncidencias(value: unknown): { campo: string; mensaje: string }[] {
  if (!Array.isArray(value)) return [];
  const messages: Record<string, string> = {
    sin_codigo_identificable: "El registro no tiene un código identificable.",
    codigo_repetido_en_hoja: "El código aparece en más de un registro de la misma hoja.",
    fecha_invalida: "La fecha de origen está incompleta o no es válida.",
    numero_invalido: "El valor de origen no es un importe numérico.",
  };
  return value.map(item => {
    const issue = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const campo = typeof issue.campo === "string" ? issue.campo.replaceAll("_", " ") : "Dato de origen";
    return { campo, mensaje: messages[String(issue.tipo)] ?? "Este dato requiere revisión." };
  });
}
