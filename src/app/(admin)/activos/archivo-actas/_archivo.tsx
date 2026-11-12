import Link from "next/link";
import {
  Globe2,
  MapPin,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Search,
  X,
  RotateCcw,
  ChevronLeft,
  Layers,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { actDocumentosArchivo as archivos, actGestionesHistorial, actResponsables as responsables } from "@/db/schema/activos.schema";
import { actListadoActas as actas, actListadoPdfs as originales } from "@/actions/activos/archivo-listado";
import { coberturaDevolucion } from "@/actions/activos/actas-vinculo";
import { accesoArchivo } from "@/actions/activos/archivo-consultas";
import { hasPermission } from "@/lib/rbac";
import { AccionesArchivo } from "@/components/modules/activos/acciones-archivo";
import { DevolucionConjunta } from "@/components/modules/activos/devolucion-conjunta";
import { NuevaActaModal } from "@/components/modules/activos/nueva-acta-modal";
import { filtrosArchivo } from "@/actions/activos/archivo-filtros";
import { hoyBolivia } from "@/actions/activos/asignaciones-modelo";
import { gestionActiva } from "@/actions/activos/gestion-consultas";

export default async function ArchivoPage({
  searchParams,
  sede,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  sede?: { slug: string; nombre: string; valor: string };
}) {
  const session=await accesoArchivo();
  const gestionar=await hasPermission(session.user.id,"activos:update");
  const gestion=await gestionActiva();
  const recibidos = await searchParams;
  const params = sede?.valor
    ? { ...recibidos, regional: sede.valor, departamento: "" }
    : recibidos;
  const {
    q,
    tipo,
    responsable,
    procedencia,
    departamento,
    regional,
    categoria,
    gestion: gestionFiltro,
    mes,
    numero,
    fecha,
    where,
    dondeTarjetas,
    orden,
  } = filtrosArchivo(params);

  const valor = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string).trim().slice(0, 200) : "";

  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(actas)
    .leftJoin(responsables, eq(actas.responsableId, responsables.id))
    .leftJoin(originales, eq(actas.id, originales.documentoId))
    .where(where);
  const gestionesDisponibles=await db.select({gestion:actGestionesHistorial.gestion,estado:actGestionesHistorial.estado}).from(actGestionesHistorial).orderBy(sql`${actGestionesHistorial.gestion} desc`);

  const paginas = Math.max(1, Math.ceil((count?.n ?? 0) / 25));
  const raw = Number(valor("pagina"));
  const pagina = Math.min(
    paginas,
    Number.isSafeInteger(raw) && raw > 0 ? raw : 1
  );

  const rowsBase = await db
    .select({
      id: actas.id,
      fuente: actas.fuente,
      version: actas.version,
      eliminadoEn: actas.eliminadoEn,
      archivo: sql<string>`(select nombre from act_archivos_actas where id=${actas.archivoId})`,
      procedencia: actas.procedencia,
      numero,
      tipo: actas.tipo,
      devolucionReferencia: actas.devolucionReferencia,
      documento: actas.documento,
      fecha,
      hoja: actas.hoja,
      bloque: actas.bloque,
      original: actas.responsableOriginal,
      responsableOriginal: actas.responsableOriginal,
      nombre: responsables.nombre,
      responsableId: actas.responsableId,
      bienes: sql<number>`jsonb_array_length(${actas.documento}->'bienes')`,
      departamento: originales.departamento,
      regional: originales.regional,
      ciudad: originales.ciudad,
      observaciones: originales.observaciones,
      motor: originales.motor,
      pdfListo: sql<boolean>`${originales.pdfOriginal} is not null`,
    })
    .from(actas)
    .leftJoin(responsables, eq(actas.responsableId, responsables.id))
    .leftJoin(originales, eq(actas.id, originales.documentoId))
    .where(where)
    .orderBy(...orden)
    .limit(25)
    .offset((pagina - 1) * 25);

  const procedenciasPagina = [...new Set(rowsBase.filter((row) => row.fuente === "excel" && ["asignacion", "actualizacion"].includes(row.tipo)).map((row) => row.procedencia))];
  const devolucionesExcel = procedenciasPagina.length ? await db
    .select({
      id: archivos.id,
      numero: archivos.numero,
      fecha: archivos.fecha,
      procedencia: archivos.procedencia,
      responsableId: archivos.responsableId,
      responsableOriginal: archivos.responsableOriginal,
      documento: archivos.documento,
    })
    .from(archivos)
    .where(and(eq(archivos.tipo, "devolucion"), isNull(archivos.eliminadoEn), inArray(archivos.procedencia, procedenciasPagina))) : [];

  const rows = rowsBase.map((row) => {
    if (!["asignacion", "actualizacion"].includes(row.tipo)) {
      return { ...row, devolucionEstado: null, devolucionBienes: { devueltos: 0, total: 0 } };
    }
    if (row.fuente === "sistema") {
      const total = row.documento.bienes.length;
      return {
        ...row,
        devolucionEstado: row.devolucionReferencia ? "completa" : null,
        devolucionBienes: { devueltos: row.devolucionReferencia ? total : 0, total },
      };
    }
    const cobertura = coberturaDevolucion(row, devolucionesExcel);
    return {
      ...row,
      devolucionReferencia: cobertura.referencias.join(", ") || row.devolucionReferencia,
      devolucionEstado: cobertura.devueltos === 0
        ? null
        : cobertura.devueltos === cobertura.total ? "completa" : "parcial",
      devolucionBienes: { devueltos: cobertura.devueltos, total: cobertura.total },
    };
  });

  const normalizarResponsable = (texto: string) =>
    texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const palabrasResponsable = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(normalizarResponsable);
  const responsablesCoincidentes = [...new Set(rows
    .filter((row) => ["asignacion", "actualizacion"].includes(row.tipo) && row.devolucionEstado !== "completa")
    .map((row) => row.nombre || row.responsableOriginal)
    .filter((nombre): nombre is string => typeof nombre === "string" && palabrasResponsable.length > 0 && palabrasResponsable.every((palabra) => normalizarResponsable(nombre).includes(palabra))))];
  const responsableParaDevolucion = !/\d/.test(q) && responsablesCoincidentes.length === 1
    ? responsablesCoincidentes[0]
    : "";

  const [procedencias, totales, conteosRegionales, responsablesActa] = await Promise.all([
    db
      .selectDistinct({ nombre: actas.procedencia })
      .from(actas)
      .orderBy(asc(actas.procedencia)),
    db
      .select({
        todas: sql<number>`count(*)::int`,
        central: sql<number>`count(*) filter(where ${originales.ambito}='oficina_central')::int`,
        regionales: sql<number>`count(*) filter(where ${originales.ambito}='regional')::int`,
        devoluciones: sql<number>`count(*) filter(where ${actas.tipo}='devolucion')::int`,
        revision: sql<number>`count(*) filter(where jsonb_array_length(${originales.observaciones})>0)::int`,
        pdfs: sql<number>`count(*) filter(where ${originales.pdfOriginal} is not null)::int`,
      })
      .from(actas)
      .leftJoin(originales, eq(actas.id, originales.documentoId)).where(isNull(actas.eliminadoEn)),
    db
      .select({ regional: originales.regional, n: sql<number>`count(*)::int` })
      .from(actas)
      .leftJoin(responsables, eq(actas.responsableId, responsables.id))
      .leftJoin(originales, eq(actas.id, originales.documentoId))
      .where(dondeTarjetas)
      .groupBy(originales.regional),
    db
      .select({ nombre: responsables.nombre, cargo: responsables.cargo })
      .from(responsables)
      .where(isNull(responsables.eliminadoEn))
      .orderBy(asc(responsables.nombre)),
  ]);

  const enlace = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      q,
      tipo,
      responsable,
      procedencia,
      departamento,
      regional,
      categoria,
      gestion: gestionFiltro,
      mes,
      ...cambios,
    })) {
      if (v) p.set(k, v);
    }
    return `${
      sede
        ? `/activos/archivo-actas/regional/${sede.slug}`
        : "/activos/archivo-actas"
    }?${p}`;
  };

  const parametrosImpresion = new URLSearchParams();
  for (const [key, value] of Object.entries({
    q,
    tipo,
    responsable,
    procedencia,
    departamento,
    regional,
    categoria,
    gestion: gestionFiltro,
    mes,
  })) {
    if (value) parametrosImpresion.set(key, value);
  }
  const imprimirTodas = `/activos/archivo-actas/imprimir?${parametrosImpresion}`;

  const tipos: Record<string, string> = {
    asignacion: "Asignación",
    actualizacion: "Asignación",
    devolucion: "Devolución",
  };
  const tiposFiltro = [
    { value: "asignacion", label: "Asignación" },
    { value: "devolucion", label: "Devolución" },
  ];
  const resumen = totales[0] ?? {
    todas: 0,
    central: 0,
    regionales: 0,
    devoluciones: 0,
    revision: 0,
    pdfs: 0,
  };
  const cantidades = new Map(
    conteosRegionales.map((r) => [r.regional ?? "Por clasificar", r.n])
  );

  const sedes = [
    { valor: "Oficina Central", nombre: "La Paz", detalle: "Oficina Central" },
    { valor: "Santa Cruz", nombre: "Santa Cruz", detalle: "Regional" },
    { valor: "Cochabamba", nombre: "Cochabamba", detalle: "Regional" },
    { valor: "Oruro", nombre: "Oruro", detalle: "Regional" },
    { valor: "Potosí", nombre: "Potosí", detalle: "Regional" },
    { valor: "Sucre", nombre: "Chuquisaca", detalle: "Regional Sucre" },
    { valor: "Tarija", nombre: "Tarija", detalle: "Regional" },
    { valor: "Beni", nombre: "Beni", detalle: "Regional" },
    { valor: "Pando", nombre: "Pando", detalle: "Regional" },
    { valor: "El Alto", nombre: "El Alto", detalle: "Regional" },
  ];
  for (const nombre of cantidades.keys()) {
    if (!sedes.some((s) => s.valor === nombre)) {
      sedes.push({ valor: nombre, nombre, detalle: "Regional / sede" });
    }
  }
  const tarjetas = [
    { valor: "", nombre: "Todas las regionales", detalle: "Consulta general" },
    ...sedes,
  ];
  const totalTarjetas = conteosRegionales.reduce((n, r) => n + r.n, 0);
  const rutaSede = (valor: string) =>
    `/activos/archivo-actas/regional/${encodeURIComponent(
      valor === ""
        ? "todas"
        : valor === "Oficina Central"
        ? "la-paz"
        : valor === "Sucre"
        ? "chuquisaca"
        : valor
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/ /g, "-")
    )}`;
  const categoriaRegional =
    categoria === "central" || categoria === "regionales";

  const tituloPrincipal = q
    ? "Buscar actas"
    : sede
    ? sede.nombre.includes("·")
      ? `Actas de ${(sede.nombre.split("·")[0]??sede.nombre).trim()}`
      : `Actas de ${sede.nombre}`
    : "Archivo General de Actas";

  const subtituloRegional = sede
    ? sede.nombre.includes("·")
      ? (sede.nombre.split("·")[1]??"").trim()
      : sede.valor || "Regional"
    : null;

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6 animate-fade-up">
      {categoria==="papelera"&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Papelera de actas. Estos documentos no aparecen en las búsquedas ni en la impresión general. Puedes restaurarlos.</p>}
      {/* 2. Encabezado Principal Institucional (Azul y Amarillo AGBC) */}
      <header className="relative overflow-hidden rounded-2xl border border-ink-200/90 bg-white p-6 shadow-2xs border-t-4 border-t-amber-400">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
                {sede ? "Archivo Regional" : "Archivo Institucional"} · Custodia y Asignaciones
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
                {tituloPrincipal}
              </h1>

              {subtituloRegional && !q && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 shadow-2xs">
                  <MapPin className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                  {subtituloRegional}
                </span>
              )}

              {q && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800 shadow-2xs">
                  <Globe2 className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                  Todas las regionales
                </span>
              )}
            </div>

            <p className="text-sm text-ink-500 max-w-3xl leading-relaxed">
              Consulta las actas originales de 2026 y las actas digitales de la gestión {gestion.gestion} por número, departamento y regional.
              Las asignaciones y devoluciones conservan su respaldo documental original.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            {gestionar && categoria !== "papelera" && (
              <NuevaActaModal
                hoy={hoyBolivia()}
                gestionActiva={gestion.gestion}
                fechaInicial={gestion.fechaInicial}
                fechaMinima={gestion.fechaMinima}
                fechaMaxima={gestion.fechaMaxima}
                responsables={responsablesActa}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              />
            )}
            {/* Tarjeta de métricas con distintivo AGBC */}
            <div className="flex items-center gap-3.5 rounded-xl border border-brand-100 bg-brand-50/50 p-3.5 shadow-2xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-amber-300 shadow-2xs">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-brand-900/80">Actas en este listado</p>
              <p className="text-xl font-bold tracking-tight text-brand-900 tabular-nums">
                {(count?.n ?? 0).toLocaleString("es-BO")}{" "}
                <span className="text-xs font-medium text-brand-700">
                  {(count?.n ?? 0) === 1 ? "acta" : "actas"}
                </span>
              </p>
            </div>
          </div>
          </div>
        </div>

        {/* 3. Barra de Control de Tipo y Regional Activa */}
        {sede && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            {/* Filtros de Tipo (Segmented Control moderno) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-brand-900">Consultar tipo:</span>
              <div className="inline-flex items-center rounded-xl border border-ink-200 bg-slate-100/80 p-1">
                {(
                  [
                    ["", "Todos los tipos", Layers],
                    ["devoluciones", "Devoluciones", RotateCcw],
                    ["revision", "Datos por revisar", AlertTriangle],
                  ] as const
                ).map(([key, label, Icon]) => {
                  const activo = categoria === key;
                  return (
                    <Link
                      key={key}
                      href={enlace({ categoria: key, pagina: "" })}
                      aria-current={activo ? "page" : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        activo
                          ? "bg-brand-600 text-white shadow-2xs"
                          : "text-ink-600 hover:text-brand-900 hover:bg-white/60"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Píldora de ubicación seleccionada en tono amarillo institucional */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-2xs">
                <MapPin className="h-3.5 w-3.5 text-amber-600" />
                <span>
                  Regional activa:{" "}
                  <strong>
                    {regional ||
                      departamento ||
                      (categoria === "central"
                        ? "Oficina Central"
                        : sede.nombre)}
                  </strong>
                </span>
              </div>
              <Link
                href="/activos/archivo-actas"
                className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50 hover:border-brand-200 transition-colors"
              >
                <span>Ver todas las regionales</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 4. Banner interactivo si hay búsqueda activa (q) */}
      {q && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-white to-brand-50/40 p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-amber-300 shadow-2xs">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-brand-900">
                Búsqueda global activa:{" "}
                <span className="inline-block rounded-md bg-white px-2 py-0.5 text-xs font-extrabold text-brand-700 border border-brand-200 shadow-2xs">
                  «{q}»
                </span>
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                Resultados coincidentes por nombre de responsable o número de acta en todas las regionales.
              </p>
            </div>
          </div>
          <Link
            href={
              sede
                ? `/activos/archivo-actas/regional/${sede.slug}`
                : "/activos/archivo-actas"
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50 shadow-2xs transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Limpiar búsqueda</span>
          </Link>
        </div>
      )}

      {/* 5. Selector de Regionales (si no hay sede seleccionada) */}
      {!sede && (
        <section
          aria-labelledby="regionales-actas"
          className="rounded-2xl border border-ink-200 bg-white p-5 shadow-2xs border-t-2 border-t-brand-600"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2
              id="regionales-actas"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-900"
            >
              <span className="rounded-lg bg-brand-600 p-1.5 text-amber-300">
                <Globe2 className="h-4 w-4" aria-hidden="true" />
              </span>
              Departamentos y Regionales
            </h2>
            <p className="text-xs text-ink-500">
              Selecciona una regional para consultar sus actas y expedientes
            </p>
          </div>
          <nav
            aria-label="Regionales del archivo de actas"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            {tarjetas.map((t) => {
              const seleccionada =
                regional === t.valor && !departamento && !categoriaRegional;
              const cantidad = t.valor
                ? cantidades.get(t.valor) ?? 0
                : totalTarjetas;
              return (
                <Link
                  key={t.valor}
                  href={rutaSede(t.valor)}
                  aria-current={seleccionada ? "page" : undefined}
                  className={`group flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                    seleccionada
                      ? "border-brand-500 bg-brand-50 text-brand-900 shadow-2xs ring-1 ring-amber-400"
                      : "border-ink-200 bg-white hover:border-brand-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`shrink-0 rounded-lg p-2 ${
                      seleccionada
                        ? "bg-brand-600 text-amber-300"
                        : "bg-slate-100 text-ink-500 group-hover:bg-brand-50 group-hover:text-brand-600"
                    }`}
                  >
                    {t.valor ? (
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Globe2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink-900 group-hover:text-brand-700 transition-colors">
                      {t.nombre}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-500">
                      {cantidad.toLocaleString("es-BO")}{" "}
                      {cantidad === 1 ? "acta" : "actas"} · {t.detalle}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-ink-400 group-hover:text-brand-600 transition-colors"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </nav>
        </section>
      )}

      {/* 6. Formulario de Búsqueda y Filtros */}
      <form className="grid gap-3.5 rounded-2xl border border-ink-200 bg-white p-5 shadow-2xs sm:grid-cols-2 lg:grid-cols-4">
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        {regional && <input type="hidden" name="regional" value={regional} />}
        {departamento && (
          <input type="hidden" name="departamento" value={departamento} />
        )}

        <div className="lg:col-span-2">
          <label className="block text-xs font-bold text-ink-700">
            Nombre del responsable o número de acta
          </label>
          <div className="relative mt-1">
            <Search
              className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-brand-600"
              aria-hidden="true"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por responsable o número de acta..."
              className="w-full rounded-xl border border-ink-200 bg-slate-50/50 py-2.5 pr-3 pl-9 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-700">
            Procedencia institucional
          </label>
          <select
            name="procedencia"
            defaultValue={procedencia}
            className="mt-1 w-full rounded-xl border border-ink-200 bg-slate-50/50 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200 transition-colors"
          >
            <option value="">Todas las procedencias</option>
            {procedencias.map((p) => (
              <option key={p.nombre}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-700">
            Tipo de acta
          </label>
          <select
            name="tipo"
            defaultValue={tipo}
            className="mt-1 w-full rounded-xl border border-ink-200 bg-slate-50/50 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200 transition-colors"
          >
            <option value="">Todos los tipos</option>
            {tiposFiltro.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-700">Gestión / historial</label>
          <select name="gestion" defaultValue={gestionFiltro} className="mt-1 w-full rounded-xl border border-ink-200 bg-slate-50/50 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200">
            <option value="">Todas las gestiones</option>
            {gestionesDisponibles.map((item)=><option key={item.gestion} value={item.gestion}>{item.gestion}{item.estado==="cerrada"?" · Cerrada":" · Activa"}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-700">Mes</label>
          <select name="mes" defaultValue={mes} className="mt-1 w-full rounded-xl border border-ink-200 bg-slate-50/50 px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:bg-white focus:outline-2 focus:outline-amber-200">
            <option value="">Todos los meses</option>
            {[
              "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
              "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
            ].map((nombre, indice) => (
              <option key={nombre} value={String(indice + 1).padStart(2, "0")}>{nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-700 active:scale-[0.98] transition-all"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Buscar actas</span>
          </button>
          <Link
            href={
              sede
                ? `/activos/archivo-actas/regional/${sede.slug}`
                : "/activos/archivo-actas"
            }
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink-600 hover:bg-ink-100 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpiar filtros</span>
          </Link>
        </div>
      </form>

      {/* 7. Tabla Principal de Actas */}
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xs">
        {/* Cabecera de la tabla */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-ink-900">Listado de actas</h2>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-800 border border-brand-200">
              {(count?.n ?? 0).toLocaleString("es-BO")}{" "}
              {(count?.n ?? 0) === 1 ? "acta encontrada" : "actas encontradas"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          {gestionar && categoria!=="papelera" && responsableParaDevolucion && <DevolucionConjunta responsableInicial={responsableParaDevolucion} />}
          {categoria!=="papelera" && (count?.n ?? 0) > 0 && (
            <a
              href={imprimirTodas}
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir un PDF con las ${count?.n} actas encontradas y sus anexos`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-all hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Printer className="h-3.5 w-3.5 text-accent-400" aria-hidden="true" />
              <span>Imprimir todas las actas</span>
            </a>
          )}
          </div>
        </div>

        {/* Tabla de Registros */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-auto text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
              <tr>
                {[
                  "Acta / Tipo",
                  "Responsable",
                  "Departamento / Regional",
                  "Fecha",
                  "Bienes",
                  "Documento y PDF",
                ].map((h) => (
                  <th className="px-5 py-3.5" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="group align-top hover:bg-brand-50/40 transition-colors"
                >
                  {/* Acta / Tipo */}
                  <td className="px-5 py-3.5">
                    <Link
                      className="font-bold text-brand-700 hover:text-brand-900 hover:underline"
                      href={`/activos/archivo-actas/${a.id}`}
                    >
                      {a.numero || "Sin número"}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {tipos[a.tipo] || a.tipo}
                      </span>
                      <span className="text-xs text-ink-500">· {a.procedencia}</span>
                    </div>
                    {a.devolucionReferencia && a.devolucionEstado === "completa" && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Devuelta · {a.devolucionBienes.devueltos}/{a.devolucionBienes.total} bienes · Acta {a.devolucionReferencia}</p>}
                    {a.devolucionReferencia && a.devolucionEstado === "parcial" && <p className="mt-1 text-[11px] font-semibold text-amber-700">Devolución parcial · {a.devolucionBienes.devueltos}/{a.devolucionBienes.total} bienes · Acta {a.devolucionReferencia}</p>}
                    {a.devolucionReferencia && !a.devolucionEstado && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Devolución registrada · Acta {a.devolucionReferencia}</p>}
                    <p className="mt-1 max-w-xs text-[11px] text-ink-400">
                      {a.archivo}
                      <br />
                      Hoja {a.hoja} · Bloque {a.bloque}
                    </p>
                  </td>

                  {/* Responsable */}
                  <td className="max-w-56 px-5 py-3.5">
                    <span className="font-bold text-ink-900 block">
                      {a.nombre || a.original || "Por identificar"}
                    </span>
                    {a.nombre && a.nombre !== a.original && (
                      <p className="mt-1 text-xs text-ink-500">
                        En documento:{" "}
                        <span className="italic">{a.original}</span>
                      </p>
                    )}
                  </td>

                  {/* Departamento / Regional */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                      <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>{a.departamento || "Por clasificar"}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500 pl-5">
                      {a.regional}
                    </p>
                  </td>

                  {/* Fecha */}
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-ink-700">
                    {a.fecha?.split("-").reverse().join("/") || "Por revisar"}
                  </td>

                  {/* Bienes */}
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-ink-800">
                      {a.bienes}
                    </span>
                  </td>

                  {/* Documento y PDF */}
                  <td className="px-5 py-3.5">
                    <div className="space-y-2">
                      {a.fuente==="sistema"?<a href={`/activos/asignaciones/actas/${a.id}/pdf?ver=1`} target="_blank" rel="noopener noreferrer" aria-label={`Ver PDF de ${a.numero}`} title={`Ver PDF de ${a.numero}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"><Eye className="h-4 w-4" aria-hidden="true"/></a>:<AccionesArchivo id={a.id} numero={a.numero} version={a.version} pdfListo={a.pdfListo} gestionar={gestionar} eliminada={!!a.eliminadoEn}/>}

                      {!a.eliminadoEn && a.motor?.includes("anexo original del vehículo") && (
                        <p className="text-[11px] font-bold text-brand-800">
                          Incluye ficha original del vehículo
                        </p>
                      )}

                      {(a.observaciones?.length ?? 0) > 0 && (
                        <p className="text-[11px] font-bold text-amber-800">
                          Datos del original por revisar
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!rows.length && (
            <div className="py-12 text-center text-sm text-ink-500">
              No hay actas que coincidan con los criterios seleccionados.
            </div>
          )}
        </div>

        {/* Paginación */}
        <nav
          aria-label="Paginación de actas"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5 bg-slate-50/50 text-xs text-ink-600"
        >
          <span>
            Página <strong>{pagina}</strong> de <strong>{paginas}</strong>
          </span>
          <div className="flex items-center gap-2">
            {pagina > 1 ? (
              <Link
                href={enlace({ pagina: String(pagina - 1) })}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-ink-100 bg-slate-50 px-2.5 py-1.5 text-xs text-ink-300">
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </span>
            )}

            {pagina < paginas ? (
              <Link
                href={enlace({ pagina: String(pagina + 1) })}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs transition-colors"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-ink-100 bg-slate-50 px-2.5 py-1.5 text-xs text-ink-300">
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </nav>
      </section>
    </div>
  );
}
