export const CATEGORIAS_ACTIVOS=[
 {id:"muebles",nombre:"Muebles y enseres",detalle:"Escritorios, sillas, mesas, estantes y otros muebles",icono:"muebles"},
 {id:"computacion",nombre:"Equipos de computación",detalle:"Computadoras, monitores y periféricos",icono:"computacion"},
 {id:"comunicacion",nombre:"Equipos de comunicación",detalle:"Telefonía, radios y equipos de red",icono:"comunicacion"},
 {id:"oficina",nombre:"Equipos de oficina y operación",detalle:"Impresoras, balanzas y equipos de apoyo",icono:"oficina"},
 {id:"vehiculos",nombre:"Vehículos",detalle:"Vehículos automotores y motocicletas",icono:"vehiculos"},
 {id:"educacional",nombre:"Equipo educacional y recreativo",detalle:"Equipos de enseñanza, proyección y recreación",icono:"educacional"},
 {id:"instalaciones",nombre:"Equipos e instalaciones",detalle:"Instalaciones identificadas en el grupo contable",icono:"instalaciones"},
 {id:"intangibles",nombre:"Activos intangibles",detalle:"Licencias y otros bienes intangibles",icono:"intangibles"},
 {id:"herramientas",nombre:"Herramientas",detalle:"Herramientas y equipos de trabajo",icono:"herramientas"},
 {id:"por-clasificar",nombre:"Por clasificar",detalle:"Registros que necesitan revisión para asignar categoría",icono:"pendiente"},
] as const;
export type CategoriaActivo=typeof CATEGORIAS_ACTIVOS[number]["id"];
export function textoBusqueda(v:string){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
export function clasificarActivo(grupo:string|null,descripcion:string):{categoria:CategoriaActivo;criterio:"excel"|"sugerida"|"pendiente"}{
 const g=textoBusqueda(grupo||"");
 const grupos:[RegExp,CategoriaActivo][]=[[/mueble|enser/,"muebles"],[/computacion/,"computacion"],[/oficina y operacion/,"oficina"],[/comunicacion/,"comunicacion"],[/educacional|recreativo/,"educacional"],[/vehiculo|automotor/,"vehiculos"],[/intangible/,"intangibles"],[/instalacion/,"instalaciones"],[/herramienta/,"herramientas"]];
 if(g){const match=grupos.find(([r])=>r.test(g));return {categoria:match?.[1]??"por-clasificar",criterio:match?"excel":"pendiente"};}
 const d=textoBusqueda(descripcion).replace(/^[\d\s.,()-]+/,"");
 const reglas:[RegExp,CategoriaActivo][]=[
 [/^(silla|sillon|escritorio|mesa|meson|estante|estanteria|archivador|vitrina|armario|ropero|gavetero|gabinete|banco|banqueta|taburete|pupitre|mueble|mostrador|credenza|cajonera|sofa|comoda|biblioteca)\b/,"muebles"],
 [/^(cpu|computador[a]?|equipo de computacion|equipo de computo|monitor|pantalla de computador|laptop|notebook|portatil|teclado|mouse|raton|ups|estabilizador|disco duro|servidor)\b/,"computacion"],
 [/^(telefono|aparato telefonico|central telefonica|fax|radio|handy|repetidor|antena|transmisor|switch|router|modem|intercomunicador|walkie)\b/,"comunicacion"],
 [/^(vehiculo|camioneta|camion|automovil|vagoneta|motocicleta|motocicleta? marca|motocarro|furgon|jeep|minibus|motorizado)\b/,"vehiculos"],
 [/^(proyector|retroproyector|televisor|television|equipo de sonido|pizarra|data show|datashow)\b/,"educacional"],
 [/^(impresora|fotocopiadora|scanner|escaner|balanza|franqueadora|maquina de escribir|calculadora|sumadora|destructora|guillotina|ventilador|calefactor|refrigerador|reloj|extintor)\b/,"oficina"],
 [/^(taladro|amoladora|soldadora|esmeril|herramienta|martillo|destornillador|alicate)\b/,"herramientas"],
 ];
 const match=reglas.find(([r])=>r.test(d));return {categoria:match?.[1]??"por-clasificar",criterio:match?"sugerida":"pendiente"};
}
