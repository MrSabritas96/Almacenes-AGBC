"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { authClient } from "@/lib/auth/client";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Form) {
    setLoading(true);
    const { error } = await authClient.signIn.email(v);
    setLoading(false);
    if (error) return toast.error(error.message ?? "Credenciales incorrectas");
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="animate-fade-up w-full max-w-sm space-y-4 rounded-card bg-white p-8 shadow-glow">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <div>
          <input id="email" placeholder="Correo" {...register("email")} className="w-full rounded-xl border border-ink-200 px-4 py-2.5 outline-none focus:border-brand-500" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <input id="password" type="password" placeholder="Contraseña" {...register("password")} className="w-full rounded-xl border border-ink-200 px-4 py-2.5 outline-none focus:border-brand-500" />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <button id="login-submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
