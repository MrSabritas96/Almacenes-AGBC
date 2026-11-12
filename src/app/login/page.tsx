"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { authClient } from "@/lib/auth/client";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Form) {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await authClient.signIn.email(v);
      if (error) {
        toast.error(error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "El correo o la contraseña no son correctos."
          : "No se pudo iniciar sesión. Revisa tus datos e intenta nuevamente.");
        setLoading(false);
        return;
      }
      // Carga el panel con la cookie recién creada, evitando redirecciones
      // de acceso anónimo que puedan permanecer en la caché del navegador.
      window.location.assign("/dashboard");
    } catch {
      toast.error("No se pudo conectar con el sistema. Intenta nuevamente.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="animate-fade-up w-full max-w-sm space-y-4 rounded-card bg-white p-8 shadow-glow">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <div>
          <input id="email" type="email" autoComplete="username" aria-label="Correo electrónico" placeholder="Correo" {...register("email")} className="w-full rounded-xl border border-ink-200 px-4 py-2.5 outline-none focus:border-brand-500" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <input id="password" type="password" autoComplete="current-password" aria-label="Contraseña" placeholder="Contraseña" {...register("password")} className="w-full rounded-xl border border-ink-200 px-4 py-2.5 outline-none focus:border-brand-500" />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <button id="login-submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
