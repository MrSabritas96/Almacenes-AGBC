export const REGIONES_RESPONSABLES = ["La Paz", "El Alto", "Santa Cruz", "Cochabamba", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Beni", "Pando"] as const;
export function regionesDeResponsable(registro: { oficina: string | null; ubicaciones: string[]; regionales?: string[] }): string[] {
  const regiones = new Set<string>();
  for (const valor of [registro.oficina ?? "", ...registro.ubicaciones, ...(registro.regionales ?? [])]) {
    const texto = valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
    const contiene = (nombre: string) => (" " + texto + " ").includes(" " + nombre + " ");
    for (const region of REGIONES_RESPONSABLES) {
      const clave = region.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      if (region === "La Paz" && contiene("EL ALTO")) continue;
      if (contiene(clave) || (region === "La Paz" && contiene("REGIONAL CENTRAL")) || (region === "Chuquisaca" && contiene("SUCRE"))) regiones.add(region);
    }
  }
  return [...regiones];
}
