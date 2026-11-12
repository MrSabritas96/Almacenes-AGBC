import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { hoyBolivia } from "@/actions/activos/asignaciones-modelo";
import { FormularioActa } from "@/components/modules/activos/formulario-acta";
import { gestionActiva } from "@/actions/activos/gestion-consultas";
import { db } from "@/db";
import { actResponsables } from "@/db/schema/activos.schema";
import { asc, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
export default async function NuevaActa(){const session=await requireSession();if(!(await hasPermission(session.user.id,"activos:read"))||!(await hasPermission(session.user.id,"activos:update")))redirect("/activos/asignaciones");const responsables=await db.select({nombre:actResponsables.nombre,cargo:actResponsables.cargo}).from(actResponsables).where(isNull(actResponsables.eliminadoEn)).orderBy(asc(actResponsables.nombre));const gestion=await gestionActiva();return <div className="mx-auto max-w-6xl space-y-6"><header className="rounded-2xl border border-ink-200 bg-white p-6 shadow-2xs"><Link href="/activos/asignaciones" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-2xs hover:bg-slate-50"><ArrowLeft className="h-4 w-4"/>Volver a Asignaciones</Link><h1 className="text-3xl font-bold">Nueva acta de activos · Gestión {gestion.gestion}</h1><p className="mt-2 text-sm text-ink-500">Completa el formulario, selecciona los bienes y guarda el PDF para imprimir.</p></header><FormularioActa hoy={hoyBolivia()} gestionActiva={gestion.gestion} fechaInicial={gestion.fechaInicial} fechaMinima={gestion.fechaMinima} fechaMaxima={gestion.fechaMaxima} solicitudId={randomUUID()} responsables={responsables}/></div>;}
