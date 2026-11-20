"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import styles from "./login.module.css";

export function LoginPanel({ name }: { name?: string }) {
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const signedIn = name !== undefined;

  async function run(action: () => Promise<void>, fallback: string) {
    setPending(true);
    setError("");
    try {
      await action();
    } catch {
      setError(fallback);
      setPending(false);
    }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier")).trim();
    const password = String(form.get("password"));
    void run(async () => {
      const result = await (identifier.includes("@")
        ? authClient.signIn.email({ email: identifier.toLowerCase(), password })
        : authClient.signIn.username({ username: identifier, password }));
      if (result.error) {
        setError(result.error.status === 429 ? "Demasiados intentos. Espera unos segundos e intenta de nuevo."
          : result.error.status >= 500 ? "El servicio de acceso no está disponible. Intenta de nuevo."
          : "No se pudo ingresar. Revisa tu correo o usuario y contraseña.");
        setPending(false);
        return;
      }
      window.location.replace("/login");
    }, "No se pudo conectar. Intenta de nuevo.");
  }

  function logout() {
    void run(async () => {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      window.location.replace("/login");
    }, "No se pudo cerrar la sesión. Intenta de nuevo.");
  }

  return (
    <section className={styles.panel} aria-labelledby="access-title">
      <h2 id="access-title">{signedIn ? "Acceso a SIBA" : "Iniciar sesión"}</h2>
      <p className={styles.description}>{signedIn ? `Sesión de ${name}` : "Usa tu cuenta institucional para entrar a SIBA."}</p>
      {signedIn ? (
        <div>
          <p role="status">Tu cuenta no tiene módulos habilitados. Consulta con administración.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className={styles.signOut} onClick={logout} disabled={pending}>Cerrar sesión</button>
        </div>
      ) : (
        <form onSubmit={login} className={styles.form} aria-busy={pending}>
          <label htmlFor="identifier">Correo o usuario</label>
          <input id="identifier" name="identifier" autoComplete="username" maxLength={200} autoCapitalize="none" spellCheck={false} required disabled={pending} />
          <label htmlFor="password">Contraseña</label>
          <div className={styles.password}>
            <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required disabled={pending} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
              {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button id="login-submit" className={styles.submit} disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
        </form>
      )}
      <nav className={styles.publicLinks} aria-label="Solicitudes de materiales">
        <Link href="/solicitar-material">Solicitar material</Link>
        <Link href="/consultar-solicitud">Consultar solicitud</Link>
      </nav>
    </section>
  );
}
