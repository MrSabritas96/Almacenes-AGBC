import type { DocumentoArchivo, BienArchivo } from "./archivo-modelo";

export type ActaArchivoVinculable = {
  id: string;
  numero: string;
  fecha: Date | string | null;
  procedencia: string;
  responsableId: string | null;
  responsableOriginal: string;
  documento: DocumentoArchivo;
};

export type CoberturaDevolucion = {
  referencias: string[];
  devueltos: number;
  total: number;
  pendientes: BienArchivo[];
};

const normal = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function persona(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).sort().join(" ");
}

function gestion(acta: Pick<ActaArchivoVinculable,"numero"|"fecha">) {
  const year = acta.numero.match(/(?:\/|\s|-)(20\d{2})$/)?.[1];
  if (year) return Number(year);
  if (!acta.fecha) return null;
  const date = acta.fecha instanceof Date ? acta.fecha : new Date(acta.fecha);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}

function codigos(bien: BienArchivo) {
  return bien.codigos.map(normal).filter(Boolean);
}

function coincideBien(asignado: BienArchivo, devuelto: BienArchivo) {
  const a = codigos(asignado);
  const d = codigos(devuelto);
  if (a.length && d.length) return a.some((codigo) => d.includes(codigo));
  if (a.length || d.length) return false;
  const descripcion = normal(asignado.descripcion);
  return descripcion.length >= 16 && descripcion === normal(devuelto.descripcion);
}

export function coberturaDevolucion(
  asignacion: ActaArchivoVinculable,
  devoluciones: ActaArchivoVinculable[]
): CoberturaDevolucion {
  const year = gestion(asignacion);
  const posibles = devoluciones.filter((devolucion) => {
    if (devolucion.procedencia !== asignacion.procedencia || gestion(devolucion) !== year) return false;
    const mismaPersona = Boolean(
      (asignacion.responsableId && devolucion.responsableId && asignacion.responsableId === devolucion.responsableId) ||
      (persona(asignacion.responsableOriginal) && persona(asignacion.responsableOriginal) === persona(devolucion.responsableOriginal))
    );
    return mismaPersona;
  });

  const devueltas = asignacion.documento.bienes.filter((bien) =>
    posibles.some((devolucion) => devolucion.documento.bienes.some((item) => coincideBien(bien, item)))
  );
  const refs = new Set<string>();
  for (const devolucion of posibles) {
    if (asignacion.documento.bienes.some((bien) => devolucion.documento.bienes.some((item) => coincideBien(bien, item)))) {
      refs.add(devolucion.numero);
    }
  }
  const devueltasFilas = new Set(devueltas.map((bien) => bien.fila));
  return {
    referencias: [...refs],
    devueltos: devueltas.length,
    total: asignacion.documento.bienes.length,
    pendientes: asignacion.documento.bienes.filter((bien) => !devueltasFilas.has(bien.fila)),
  };
}
