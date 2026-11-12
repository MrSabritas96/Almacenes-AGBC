import Link from "next/link";
import { LayoutDashboard, Landmark, Boxes, Scale, ArrowRight } from "lucide-react";

const modulos = [
  {
    href: "/activos",
    label: "Activos",
    desc: "Inventario de bienes, asignaciones y actas institucionales.",
    icon: Landmark,
    color: "hsl(217 91% 48%)",
    light: "hsl(214 100% 97%)",
    border: "hsl(213 93% 86%)",
  },
  {
    href: "/almacenes",
    label: "Almacenes",
    desc: "Control de stock, ingresos y egresos de almacenes.",
    icon: Boxes,
    color: "hsl(44 96% 46%)",
    light: "hsl(48 100% 96%)",
    border: "hsl(46 95% 76%)",
  },
  {
    href: "/conciliaciones",
    label: "Conciliaciones",
    desc: "Revisión y cierre de conciliaciones de bienes.",
    icon: Scale,
    color: "hsl(222 82% 18%)",
    light: "hsl(220 33% 98%)",
    border: "hsl(220 20% 90%)",
  },
];

export default function Dashboard() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-8">

      {/* ── Saludo institucional ──────────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-2xl shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, hsl(222 82% 12%) 0%, hsl(220 78% 18%) 50%, hsl(218 74% 23%) 100%)",
          borderBottom: "3px solid hsl(44 96% 52%)",
        }}
      >
        {/* Halo dorado */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(44 96% 52% / 0.15) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex items-center gap-5 px-7 py-7">
          {/* Ícono del dashboard */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md"
            style={{
              background:
                "linear-gradient(135deg, hsl(44 96% 54%) 0%, hsl(38 92% 44%) 100%)",
              color: "hsl(222 82% 12%)",
            }}
          >
            <LayoutDashboard className="h-7 w-7" aria-hidden="true" />
          </div>

          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "hsl(44 96% 65%)" }}
            >
              Sistema de Gestión · AGBC
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Bienvenido a Almacenes AGBC
            </h1>
            <p className="mt-1 text-sm" style={{ color: "hsl(214 60% 78%)" }}>
              Gestiona activos, almacenes y conciliaciones institucionales desde un solo lugar.
            </p>
          </div>
        </div>
      </header>

      {/* ── Módulos ───────────────────────────────────────────────────── */}
      <section aria-label="Módulos del sistema">
        <p
          className="mb-4 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "hsl(217 91% 48%)" }}
        >
          Módulos disponibles
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {modulos.map(({ href, label, desc, icon: Icon, color, light, border }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              style={{ borderColor: border }}
            >
              {/* Ícono */}
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                style={{ background: light, color }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>

              {/* Texto */}
              <div className="flex-1">
                <h2 className="font-bold text-slate-800">{label}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>

              {/* CTA */}
              <div className="flex items-center gap-1 text-xs font-semibold transition-colors" style={{ color }}>
                Ir al módulo
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
