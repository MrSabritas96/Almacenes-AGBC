"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { openWarehouseTab } from "@/actions/almacenes/tab-session";
import Link from "next/link";
import { Brand, WarehouseIllustration, BackToPortal } from "./brand";

export default function WarehouseAccess() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const pending = busy || navigating;
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const identifier = String(data.get("identifier")).trim();
      const password = String(data.get("password"));
      const result = identifier.includes("@")
        ? await authClient.signIn.email({ email: identifier, password })
        : await authClient.signIn.username({ username: identifier, password });
      if (result.error) {
        setError(result.error.status >= 500
          ? "El servicio de acceso no está disponible. Verifica que el servidor y la base de datos estén iniciados."
          : result.error.status === 429
            ? "Hay demasiados intentos. Espera unos segundos e intenta nuevamente."
            : "No se pudo ingresar. Revisa tu correo o usuario y contraseña.");
        return;
      }
      const session = await openWarehouseTab(result.data?.token);
      startNavigation(() => { router.push(`/dashboard?tab=${session.tabId}`); router.refresh(); });
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo conectar. Intenta nuevamente."); }
    finally { setBusy(false); }
  }
  return <main className="warehouse-access warehouse-login"><header className="access-header"><Brand/><BackToPortal/></header><div className="access-grid">
    <section className="access-story"><span className="eyebrow">ALMACENES · AGBC</span><h1>Los materiales que nos ayudan a <em>conectar Bolivia.</em></h1><p>Un espacio para cuidar nuestros recursos, organizar el almacén y acompañar el trabajo de cada persona.</p><WarehouseIllustration/><div className="story-note"><span className="note-dot"/><span>Un equipo conectado. Un almacén organizado.</span></div></section>
    <section className="access-panel"><h2>Bienvenido al almacén</h2><p className="muted">Ingresa con tu cuenta administrativa. El sistema identifica tus permisos automáticamente.</p><form onSubmit={login} className="access-form login-form" aria-busy={pending}><label>Correo o nombre de usuario<input id="identifier" name="identifier" type="text" maxLength={200} autoCapitalize="none" spellCheck={false} autoComplete="username" placeholder="Tu usuario o correo institucional" required disabled={pending}/></label><label>Contraseña<div className="password-field"><input id="password" name="password" type={show ? 'text':'password'} minLength={8} autoComplete="current-password" placeholder="Introduce tu contraseña" required disabled={pending}/><button type="button" onClick={()=>setShow(!show)} aria-label={show ? 'Ocultar contraseña':'Mostrar contraseña'}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button id="login-submit" className="primary-button" disabled={pending}>{pending ? 'Ingresando…':'Ingresar a mi dashboard'}{pending ? <LoaderCircle size={18} className="motion-spin" aria-hidden="true"/> : <ArrowRight size={18}/>}</button></form><div className="public-request-link"><p>¿Necesitas materiales?</p><div className="public-request-actions"><Link href="/solicitar-material" className="secondary-button">Solicitar material <ArrowRight size={16}/></Link><Link href="/consultar-solicitud" className="secondary-button">Consultar solicitud <ArrowRight size={16}/></Link></div></div><p className="access-security"><LockKeyhole size={14}/> Acceso exclusivo para SuperAdmin y administración de almacén.</p></section>
  </div><footer className="access-footer">Agencia Boliviana de Correos <span>Gestión de materiales · Bolivia</span></footer></main>;
}
