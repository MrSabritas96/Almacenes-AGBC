import Link from "next/link";
import { Boxes, Landmark, Scale, ArrowRight } from "lucide-react";

const modules = [
  { href: null, name: "Activos", desc: "Inventario y ciclo de vida de bienes institucionales.", icon: Landmark },
  { href: "/almacenes", name: "Almacenes", desc: "Existencias, entradas, salidas y movimientos.", icon: Boxes },
  { href: null, name: "Conciliaciones", desc: "Cruce y validación de información contable.", icon: Scale },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 px-4 py-16 text-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-brand-600/40 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-accent-500/25 blur-[120px]" />
      <section className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <span className="glass animate-fade-up rounded-full px-4 py-1 text-xs tracking-widest uppercase text-accent-400">AGBC</span>
        <h1 className="animate-fade-up mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Almacenes <span className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">AGBC</span>
        </h1>
        <p className="animate-fade-up mt-4 max-w-xl text-slate-300">Portal unificado para la gestión institucional de activos, almacenes y conciliaciones.</p>
        <div className="mt-14 grid w-full gap-5 sm:grid-cols-3">
          {modules.map(({ href, name, desc, icon: Icon }) => {
            const content = <>
              <Icon className="h-8 w-8 text-accent-400" />
              <h2 className="mt-4 text-xl font-semibold">{name}</h2>
              <p className="mt-2 text-sm text-slate-300">{desc}</p>
              {href ? <ArrowRight className="mt-4 h-4 w-4 text-brand-400 group-hover:translate-x-1" /> : <span className="mt-4 inline-block text-xs text-slate-300">Próximamente</span>}
            </>;
            return href ? <Link key={name} href={href} id={`module-${name.toLowerCase()}`}
              className="glass group rounded-card p-6 text-left hover:-translate-y-1 hover:shadow-glow">{content}</Link>
              : <div key={name} id={`module-${name.toLowerCase()}`} className="glass rounded-card p-6 text-left">{content}</div>;
          })}
        </div>
      </section>
    </main>
  );
}
