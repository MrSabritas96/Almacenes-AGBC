import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actFilasImportadas, actHojasImportadas, actImportaciones, actMantenimientosVehiculos } from "@/db/schema/activos.schema";
import { users } from "@/db/schema/auth.schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";

type Celda = { v?: unknown; w?: unknown; f?: unknown; t?: unknown; z?: unknown };
type Fila = { numero: number; celdas: Record<string, Celda> };

export type FilaKardexVehiculo = {
  id: string;
  importacionId: string;
  archivo: string;
  hoja: string;
  orden: number;
  filas: Fila[];
  placa: string;
  regional: string;
  anio: string;
  chasis: string;
  marca: string;
  modelo: string;
  conductor: string;
  servicios: { fila: number; fecha: string; kilometraje: string; descripcion: string; taller: string; unidad: string; factura: string; importe: string; observaciones: string }[];
};

async function verificarAcceso() {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, "activos:read"))) redirect("/dashboard");
}

const texto = (value: unknown) => value == null ? "" : String(value).replace(/\s+/g, " ").trim();
const placaNormalizada = (value: string) => value.replace(/[^a-z\d]/gi, "").toUpperCase();

let kardexCache: { expiresAt: number; promise: Promise<FilaKardexVehiculo[]> } | null = null;

async function cargarHojasKardexVehiculos(): Promise<FilaKardexVehiculo[]> {
  const rows = await db.select({
    hojaId: actHojasImportadas.id,
    importacionId: actImportaciones.id,
    archivo: actImportaciones.archivoNombre,
    hoja: actHojasImportadas.nombre,
    orden: actHojasImportadas.orden,
    filaExcel: actFilasImportadas.filaExcel,
    celdas: actFilasImportadas.celdas,
  }).from(actHojasImportadas)
    .innerJoin(actImportaciones, eq(actImportaciones.id, actHojasImportadas.importacionId))
    .innerJoin(actFilasImportadas, eq(actFilasImportadas.hojaId, actHojasImportadas.id))
    .where(and(eq(actHojasImportadas.tipo, "kardex_vehiculos"), eq(actHojasImportadas.vigencia, "vigente")))
    .orderBy(asc(actImportaciones.archivoNombre), asc(actHojasImportadas.orden), asc(actFilasImportadas.filaExcel));

  const grupos = new Map<string, { hojaId: string; importacionId: string; archivo: string; hoja: string; orden: number; filas: Fila[] }>();
  for (const row of rows) {
    const group = grupos.get(row.hojaId) ?? { hojaId: row.hojaId, importacionId: row.importacionId, archivo: row.archivo, hoja: row.hoja, orden: row.orden, filas: [] };
    group.filas.push({ numero: row.filaExcel, celdas: row.celdas as Record<string, Celda> });
    grupos.set(row.hojaId, group);
  }

  return [...grupos.values()].map(group => {
    const fila = (numero: number) => group.filas.find(row => row.numero === numero)?.celdas ?? {};
    const valor = (numero: number, columna: string) => texto(fila(numero)[`${columna}${numero}`]?.w ?? fila(numero)[`${columna}${numero}`]?.v);
    const lineaConductor = valor(11, "A");
    const placa = placaNormalizada(valor(9, "B"));
    const servicios = group.filas.filter(row => row.numero > 15).flatMap(row => {
      const cell = (col: string) => texto(row.celdas[`${col}${row.numero}`]?.w ?? row.celdas[`${col}${row.numero}`]?.v);
      const descripcion = cell("C");
      if (!descripcion || /^_+$/.test(descripcion)) return [];
      return [{ fila: row.numero, fecha: cell("A"), kilometraje: cell("B"), descripcion, taller: cell("D"), unidad: cell("E"), factura: cell("F"), importe: cell("G"), observaciones: cell("H") }];
    });
    return {
      id: group.hojaId,
      importacionId: group.importacionId,
      archivo: group.archivo,
      hoja: group.hoja,
      orden: group.orden,
      filas: group.filas,
      placa,
      regional: valor(8, "B"),
      anio: valor(8, "E"),
      chasis: valor(9, "E").replace(/[,\s]/g, "").toUpperCase(),
      marca: valor(10, "B"),
      modelo: valor(10, "E"),
      conductor: lineaConductor.replace(/^CONDUCTOR\s+ASIGNADO\s*:\s*/i, "").trim(),
      servicios,
    };
  }).filter(row => row.placa);
}

export async function consultarHojasKardexVehiculos(): Promise<FilaKardexVehiculo[]> {
  await verificarAcceso();
  if (!kardexCache || kardexCache.expiresAt <= Date.now()) {
    const entry = { expiresAt: Date.now() + 60_000, promise: cargarHojasKardexVehiculos() };
    kardexCache = entry;
    entry.promise.catch(() => { if (kardexCache === entry) kardexCache = null; });
  }
  return kardexCache.promise;
}

export async function consultarKardexVehiculo(hojaId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hojaId)) return null;
  const hojas = await consultarHojasKardexVehiculos();
  return hojas.find(row => row.id === hojaId) ?? null;
}

export async function consultarMantenimientosRegistrados(activoId: string) {
  await verificarAcceso();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activoId)) return [];
  return db.select({
    id: actMantenimientosVehiculos.id,
    fecha: actMantenimientosVehiculos.fecha,
    kilometraje: actMantenimientosVehiculos.kilometraje,
    descripcion: actMantenimientosVehiculos.descripcion,
    taller: actMantenimientosVehiculos.taller,
    unidad: actMantenimientosVehiculos.unidad,
    factura: actMantenimientosVehiculos.factura,
    importe: actMantenimientosVehiculos.importe,
    observaciones: actMantenimientosVehiculos.observaciones,
    registradoPor: users.name,
    creadoEn: actMantenimientosVehiculos.creadoEn,
  }).from(actMantenimientosVehiculos)
    .innerJoin(users, eq(users.id, actMantenimientosVehiculos.registradoPor))
    .where(eq(actMantenimientosVehiculos.activoId, activoId))
    .orderBy(desc(actMantenimientosVehiculos.fecha), desc(actMantenimientosVehiculos.creadoEn));
}
