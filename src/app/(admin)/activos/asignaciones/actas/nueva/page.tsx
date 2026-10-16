import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { hoyBolivia } from "@/actions/activos/asignaciones-modelo";
import { FormularioActa } from "@/components/modules/activos/formulario-acta";
export default async function NuevaActa(){const session=await requireSession();if(!(await hasPermission(session.user.id,"activos:read"))||!(await hasPermission(session.user.id,"activos:update")))redirect("/activos/asignaciones");return <div className="mx-auto max-w-6xl space-y-6"><Link href="/activos/asignaciones" className="text-sm font-medium text-brand-600 hover:underline">← Volver a Asignaciones</Link><header><h1 className="text-3xl font-bold">Nueva acta de activos</h1><p className="mt-2 text-sm text-ink-500">Completa el formulario, selecciona los bienes y guarda el PDF para imprimir.</p></header><FormularioActa hoy={hoyBolivia()} solicitudId={randomUUID()}/></div>;}
