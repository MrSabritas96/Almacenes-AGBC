import "server-only";
import { requireSession } from "@/lib/auth/activos-session";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
export async function accesoArchivo(){const s=await requireSession();if(!(await hasPermission(s.user.id,"activos:read")))redirect("/");return s;}
export const uuidArchivo=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
