import type { DocumentoArchivo } from "@/actions/activos/archivo-modelo";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { check, customType, date, index, integer, jsonb, numeric, pgEnum, pgTable, pgView, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ActaBien, ActaCabecera } from "@/actions/activos/actas-modelo";
import { users } from "./auth.schema";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Conserva una copia exacta del archivo y permite repetir la carga sin duplicarla. */
export const actImportaciones = pgTable("act_importaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  archivoNombre: text("archivo_nombre").notNull(),
  archivoSha256: text("archivo_sha256").notNull().unique(),
  archivoOriginal: bytea("archivo_original").notNull(),
  resumen: jsonb("resumen").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const actHojasImportadas = pgTable("act_hojas_importadas", {
  id: uuid("id").primaryKey().defaultRandom(),
  importacionId: uuid("importacion_id").notNull().references(() => actImportaciones.id),
  nombre: text("nombre").notNull(),
  orden: integer("orden").notNull(),
  tipo: text("tipo").notNull(), // inventario, historico, faltantes o auxiliar
  vigencia: text("vigencia").notNull().default("pendiente"),
  filasConDatos: integer("filas_con_datos").notNull(),
  registrosActivos: integer("registros_activos").notNull(),
}, (t) => [uniqueIndex("act_hojas_importacion_nombre_uq").on(t.importacionId, t.nombre)]);

/** Celdas originales: valor, texto mostrado, fórmula y formato, incluso en resúmenes. */
export const actFilasImportadas = pgTable("act_filas_importadas", {
  id: uuid("id").primaryKey().defaultRandom(),
  hojaId: uuid("hoja_id").notNull().references(() => actHojasImportadas.id),
  filaExcel: integer("fila_excel").notNull(),
  celdas: jsonb("celdas").notNull(),
}, (t) => [uniqueIndex("act_filas_hoja_numero_uq").on(t.hojaId, t.filaExcel)]);

/** Un registro por fila de inventario. No identifica duplicados por código automáticamente. */
export const actActivos = pgTable("act_activos", {
  id: uuid("id").primaryKey().defaultRandom(),
  filaOrigenId: uuid("fila_origen_id").notNull().references(() => actFilasImportadas.id),
  origen: text("origen").notNull(),
  numeroOrigen: text("numero_origen"),
  codigo: text("codigo"),
  codigoHistorico: text("codigo_historico"),
  descripcion: text("descripcion").notNull(),
  estado: text("estado"),
  ubicacion: text("ubicacion"),
  responsable: text("responsable"),
  acta: text("acta"), // El Excel también contiene MOM6, x y otras referencias textuales.
  observaciones: text("observaciones"),
  comentario: text("comentario"),
  grupoContable: text("grupo_contable"),
  grupoContableCodigo: text("grupo_contable_codigo"),
  auxiliarGrupo: text("auxiliar_grupo"),
  auxiliarGrupoAlterno: text("auxiliar_grupo_alterno"),
  vidaUtil: numeric("vida_util"),
  porcentajeDepreciacion: numeric("porcentaje_depreciacion"),
  costoHistorico: numeric("costo_historico"),
  costoMigrado: numeric("costo_migrado"),
  costoFinalActualizado: numeric("costo_final_actualizado"),
  depreciacionGestion: numeric("depreciacion_gestion"),
  depreciacionAcumulada: numeric("depreciacion_acumulada"),
  valorNeto: numeric("valor_neto"),
  fechaHistorica: date("fecha_historica"),
  fechaMigracion: date("fecha_migracion"),
  indicadorR: text("indicador_r"),
  rube: text("rube"),
  incidenciasImportacion: jsonb("incidencias_importacion").notNull().default([]),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("act_activos_fila_origen_uq").on(t.filaOrigenId),
  index("act_activos_codigo_idx").on(t.codigo),
  index("act_activos_origen_idx").on(t.origen),
  index("act_activos_responsable_idx").on(t.responsable),
]);

/** Consulta de las hojas confirmadas como vigentes, sin mezclar versiones históricas. */
export const actInventarioVigente = pgView("act_inventario_vigente").as((qb) =>
  qb.select({ ...getTableColumns(actActivos), filaExcel: actFilasImportadas.filaExcel, hojaOrigen: actHojasImportadas.nombre })
    .from(actActivos)
    .innerJoin(actFilasImportadas, eq(actActivos.filaOrigenId, actFilasImportadas.id))
    .innerJoin(actHojasImportadas, eq(actFilasImportadas.hojaId, actHojasImportadas.id))
    .where(eq(actHojasImportadas.vigencia, "vigente")),
);

export const actTipoAsignacion = pgEnum("act_tipo_asignacion", ["fija", "momentanea"]);
export const actEstadoAsignacion = pgEnum("act_estado_asignacion", ["activa", "devuelta", "reemplazada"]);

/** Historial de custodia; el registro y las celdas del Excel no se modifican. */
export const actAsignaciones = pgTable("act_asignaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  solicitudId: uuid("solicitud_id").notNull().unique(),
  activoId: uuid("activo_id").notNull().references(() => actActivos.id),
  tipo: actTipoAsignacion("tipo").notNull(),
  estado: actEstadoAsignacion("estado").notNull().default("activa"),
  responsableDestino: text("responsable_destino").notNull(),
  ubicacionDestino: text("ubicacion_destino").notNull(),
  responsableAnterior: text("responsable_anterior"),
  ubicacionAnterior: text("ubicacion_anterior"),
  fechaInicio: date("fecha_inicio").notNull(),
  fechaDevolucionPrevista: date("fecha_devolucion_prevista"),
  fechaCierre: date("fecha_cierre"),
  motivo: text("motivo").notNull(),
  referenciaActa: text("referencia_acta"),
  motivoCierre: text("motivo_cierre"),
  creadoPor: text("creado_por").notNull().references(() => users.id),
  cerradoPor: text("cerrado_por").references(() => users.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("act_asignacion_activa_tipo_uq").on(t.activoId, t.tipo).where(sql`${t.estado} = 'activa'`),
  index("act_asignaciones_activo_idx").on(t.activoId, t.creadoEn),
  index("act_asignaciones_estado_fecha_idx").on(t.estado, t.fechaDevolucionPrevista),
  check("act_asignacion_destino_ck", sql`length(trim(${t.responsableDestino})) > 0 AND length(trim(${t.ubicacionDestino})) > 0 AND length(trim(${t.motivo})) > 0`),
  check("act_asignacion_plazo_ck", sql`(${t.tipo} = 'fija' AND ${t.fechaDevolucionPrevista} IS NULL) OR (${t.tipo} = 'momentanea' AND ${t.fechaDevolucionPrevista} IS NOT NULL AND ${t.fechaDevolucionPrevista} >= ${t.fechaInicio})`),
  check("act_asignacion_cierre_ck", sql`(${t.estado} = 'activa' AND ${t.fechaCierre} IS NULL AND ${t.cerradoPor} IS NULL AND ${t.motivoCierre} IS NULL) OR (${t.estado} <> 'activa' AND ${t.fechaCierre} IS NOT NULL AND ${t.fechaCierre} >= ${t.fechaInicio} AND ${t.cerradoPor} IS NOT NULL AND ${t.motivoCierre} IS NOT NULL AND length(trim(${t.motivoCierre})) > 0)`),
]);

/** La momentánea activa prevalece sobre la fija; devolverla restaura la fija o el origen. */
export const actCustodiaActual = pgView("act_custodia_actual", {
  id: uuid("id").notNull(), codigo: text("codigo"), codigoHistorico: text("codigo_historico"),
  descripcion: text("descripcion").notNull(), origen: text("origen").notNull(), estado: text("estado"),
  responsable: text("responsable"), ubicacion: text("ubicacion"),
  incidenciasImportacion: jsonb("incidencias_importacion").notNull(), filaExcel: integer("fila_excel").notNull(),
  asignacionId: uuid("asignacion_id"), asignacionTipo: text("asignacion_tipo"),
  fechaDevolucionPrevista: date("fecha_devolucion_prevista"),
}).as(sql`
  SELECT v.id, v.codigo, v.codigo_historico, v.descripcion, v.origen, v.estado,
    COALESCE(m.responsable_destino, f.responsable_destino, v.responsable) AS responsable,
    COALESCE(m.ubicacion_destino, f.ubicacion_destino, v.ubicacion) AS ubicacion,
    v.incidencias_importacion, v.fila_excel,
    COALESCE(m.id, f.id) AS asignacion_id, COALESCE(m.tipo, f.tipo)::text AS asignacion_tipo,
    m.fecha_devolucion_prevista
  FROM ${actInventarioVigente} v
  LEFT JOIN ${actAsignaciones} m ON m.activo_id = v.id AND m.tipo = 'momentanea' AND m.estado = 'activa'
  LEFT JOIN ${actAsignaciones} f ON f.activo_id = v.id AND f.tipo = 'fija' AND f.estado = 'activa'
`);

export const actActas = pgTable("act_actas", {
  id:uuid("id").primaryKey().defaultRandom(), solicitudId:uuid("solicitud_id").notNull().unique(),
  solicitudHash:text("solicitud_hash").notNull(), numero:serial("numero").notNull().unique(),
  tipo:text("tipo").$type<"fija"|"momentanea"|"devolucion">().notNull(), fecha:date("fecha").notNull(),
  cabecera:jsonb("cabecera").$type<ActaCabecera>().notNull(), bienes:jsonb("bienes").$type<ActaBien[]>().notNull(),
  documentoPdf:bytea("documento_pdf").notNull(), pdfSha256:text("pdf_sha256").notNull(),
  creadoPor:text("creado_por").notNull().references(()=>users.id), creadoEn:timestamp("creado_en",{withTimezone:true}).notNull().defaultNow(),
},t=>[index("act_actas_fecha_idx").on(t.fecha),check("act_actas_tipo_ck",sql`${t.tipo} IN ('fija','momentanea','devolucion')`)]);

export const actActaBienes=pgTable("act_acta_bienes",{
  id:uuid("id").primaryKey().defaultRandom(), actaId:uuid("acta_id").notNull().references(()=>actActas.id),
  activoId:uuid("activo_id").notNull().references(()=>actActivos.id),
  asignacionId:uuid("asignacion_id").references(()=>actAsignaciones.id),
},t=>[uniqueIndex("act_acta_bien_uq").on(t.actaId,t.activoId),index("act_acta_bien_activo_idx").on(t.activoId)]);

/** Catálogo editable; las claves de origen permiten corregir nombres sin tocar el Excel. */
export const actResponsables = pgTable("act_responsables", {
  id: uuid("id").primaryKey().defaultRandom(), nombre: text("nombre").notNull().unique(),
  cargo: text("cargo"), oficina: text("oficina"), telefono: text("telefono"), correo: text("correo"),
  eliminadoEn: timestamp("eliminado_en", {withTimezone:true}),
  creadoEn: timestamp("creado_en", {withTimezone:true}).notNull().defaultNow(),
}, t=>[check("act_responsable_nombre_ck",sql`length(trim(${t.nombre})) >= 3`)]);
export const actResponsableNombres = pgTable("act_responsable_nombres", {
  clave: text("clave").primaryKey(), responsableId: uuid("responsable_id").notNull().references(()=>actResponsables.id),
});

/** Archivo de documentos Excel, separado de las operaciones de custodia. */
export const actArchivosActas=pgTable("act_archivos_actas",{
 id:uuid("id").primaryKey().defaultRandom(),nombre:text("nombre").notNull(),sha256:text("sha256").notNull().unique(),
 original:bytea("original").notNull(),resumen:jsonb("resumen").notNull(),creadoEn:timestamp("creado_en",{withTimezone:true}).notNull().defaultNow(),
});
export const actDocumentosArchivo=pgTable("act_documentos_archivo",{
 id:uuid("id").primaryKey().defaultRandom(),archivoId:uuid("archivo_id").notNull().references(()=>actArchivosActas.id),
 hoja:text("hoja").notNull(),bloque:text("bloque").notNull(),procedencia:text("procedencia").notNull(),
 tipo:text("tipo").notNull(),numero:text("numero").notNull(),fecha:date("fecha"),
 responsableId:uuid("responsable_id").references(()=>actResponsables.id),
 responsableOriginal:text("responsable_original").notNull(),documento:jsonb("documento").$type<DocumentoArchivo>().notNull(),
},t=>[uniqueIndex("act_documento_archivo_origen_uq").on(t.archivoId,t.hoja,t.bloque),index("act_documentos_responsable_idx").on(t.responsableId)]);
