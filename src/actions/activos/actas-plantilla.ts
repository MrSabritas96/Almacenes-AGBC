export const REGIONALES_ACTA = ["La Paz", "Santa Cruz", "Cochabamba", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Beni", "Pando", "El Alto"] as const;
export const PISOS_LA_PAZ = ["Piso mezzanine", "Planta baja", "Subsuelo"] as const;
export const FIRMANTE_ACTIVOS = "ANALY BAZÁN CÁRDENAS";
export const CARGO_ACTIVOS = "AUXILIAR DE ACTIVOS FIJOS";
export const NOTA_ACTA = "La asignación de bienes genera en el servidor público la responsabilidad sobre el debido uso, custodia y mantenimiento de los mismos; la pérdida, destrucción o maltrato por negligencia será imputado a su persona. Asimismo, el funcionario que tiene a su cargo dichos bienes, por ningún concepto podrá efectuar préstamos y/o transferencias por cuenta propia, lo que generaría procesos administrativos, civiles y/o penales.\nPara la liberación de responsabilidad, imprescindiblemente deberá solicitar la conformidad escrita de la Unidad de Activos Fijos (según art. 14, 146, 147, 148, 154 y 157 del D.S. 0181).\nCabe destacar que el presente documento no invalida las Actas de Asignación de Activos de gestiones pasadas de las cuales no se emitió el Acta de Devolución correspondiente.";

export function nombreProcedencia(entidad: string,nombre?:string) { return nombre || (entidad === "EXECOBOL 2024" ? "EX-ECOBOL" : entidad); }
export function ciudadRegional(regional: string) { return ({ Chuquisaca: "Sucre", Beni: "Trinidad", Pando: "Cobija" } as Record<string,string>)[regional] ?? regional; }
export function oficinaRegional(regional: string, piso?: string) {
  if (regional === "La Paz") return `${piso === "Piso mezzanine" ? "piso mezzanine" : piso === "Planta baja" ? "planta baja" : "subsuelo"} del edificio CCLP`;
  return `oficina de la Regional ${regional === "Chuquisaca" ? "Sucre" : regional}`;
}
export function fechaActaLarga(fecha: string) {
  return new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(fecha + "T00:00:00Z"));
}
export function textoInstitucional(c: { ciudad: string; fecha: string; oficina: string; entidad: string; procedenciaNombre?:string }, tipo: string) {
  return `En la ciudad de ${c.ciudad.toUpperCase()}, en fecha ${fechaActaLarga(c.fecha)}, en instalaciones de la Agencia Boliviana de Correos, ${c.oficina}, dando cumplimiento al D.S. 181 de fecha 28 de junio de 2009 Normas Básicas del Sistema de Administración de Bienes y Servicios (Vigente), Título II - Artículo N° 116 - Responsabilidad por el manejo de Bienes - III Parágrafo "Todos los servidores públicos son responsables por el debido uso, custodia, preservación y solicitud de servicios de mantenimiento de los bienes que les fueran asignados, de acuerdo al régimen de la Responsabilidad por la función pública establecido en la Ley 1178 y sus reglamentos", se procede a la ${tipo === "devolucion" ? "DEVOLUCIÓN" : "ASIGNACIÓN"} de Activos Fijos de ${nombreProcedencia(c.entidad,c.procedenciaNombre)}, bajo el siguiente detalle:`;
}
