import { compareMaterialNames, compareNames, materialCodePrefix } from "./material-code";
export const REGIONALS = ["La Paz", "Cochabamba", "Santa Cruz", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Beni", "Pando"] as const;
// Presentaciones y medidas para papelería, vestuario, limpieza, repuestos y otros insumos.
export const MATERIAL_UNITS = [
  'unidad', 'pieza', 'par', 'juego', 'kit', 'conjunto', 'docena',
  'caja', 'paquete', 'bolsa', 'saco', 'fardo', 'rollo',
  'hoja', 'pliego', 'resma', 'block', 'talonario', 'cuaderno', 'libro', 'ejemplar',
  'cartucho', 'frasco', 'botella', 'lata', 'bidón', 'balde', 'tambor', 'tubo', 'envase',
  'litro', 'mililitro', 'galón', 'kilogramo', 'gramo', 'tonelada',
  'metro', 'centímetro', 'metro cuadrado', 'metro cúbico',
] as const;
// Fuente: https://correos.gob.bo/ (mapa oficial de oficinas).
const CATEGORY_DEFINITIONS = [
  {
    "code": "25500",
    "name": "Publicidad",
    "examples": [
      "Afiche de servicios postales",
      "Banner institucional de Correos",
      "Volante de tarifas postales",
      "Tríptico de envíos EMS",
      "Adhesivo de identificación institucional",
      "Pendón de atención al usuario",
      "Calendario institucional",
      "Bolsa promocional de Correos",
      "Señalética de ventanilla",
      "Cartel de horarios de atención"
    ]
  },
  {
    "code": "25600",
    "name": "Servicios de imprenta - fotográficos",
    "examples": []
  },
  {
    "code": "25900",
    "name": "Servicios manuales",
    "examples": []
  },
  {
    "code": "31110",
    "name": "Víveres",
    "examples": []
  },
  {
    "code": "31120",
    "name": "Gastos por alimentación y otros similares",
    "examples": []
  },
  {
    "code": "31300",
    "name": "Productos agrícolas, pecuarios y forestales",
    "examples": []
  },
  {
    "code": "32100",
    "name": "Papel de escritorio",
    "examples": [
      "Papel bond carta",
      "Papel bond oficio",
      "Papel bond A4",
      "Papel reciclado",
      "Papel continuo",
      "Papel autocopiativo",
      "Papel membretado",
      "Papel fotográfico",
      "Papel adhesivo",
      "Papel térmico"
    ]
  },
  {
    "code": "32200",
    "name": "Productos artes gráficas, papel y cartón",
    "examples": [
      "Caja de cartón",
      "Sobre manila",
      "Sobre postal",
      "Carpeta de cartulina",
      "Cartulina blanca",
      "Cartón corrugado",
      "Etiqueta postal",
      "Marbete EMS",
      "Formulario CN-35",
      "Tubo de cartón"
    ]
  },
  {
    "code": "32300",
    "name": "Libros y revistas",
    "examples": [
      "Manual de operaciones postales",
      "Manual de clasificación de correspondencia",
      "Guía de códigos postales",
      "Manual de atención en ventanilla",
      "Catálogo de sellos postales",
      "Guía de envíos internacionales",
      "Manual de manejo de encomiendas",
      "Manual de seguridad del transporte postal",
      "Compendio de normativa postal",
      "Guía de procedimientos de almacén"
    ]
  },
  {
    "code": "33100",
    "name": "Hilados y telas",
    "examples": [
      "Pita de amarre de algodón",
      "Hilo de nylon para sacas",
      "Lona para sacas postales",
      "Tela para protección de paquetes",
      "Arpillera para embalaje",
      "Cordón para cierre de sacas",
      "Hilo de costura de sacas",
      "Tela reflectiva para uniformes",
      "Fieltro protector para embalaje",
      "Cinta textil para identificación de sacas"
    ]
  },
  {
    "code": "33200",
    "name": "Confecciones textiles",
    "examples": [
      "Saca postal nacional",
      "Saca postal internacional",
      "Bolsa textil para correspondencia",
      "Funda protectora de impresora",
      "Funda para balanza postal",
      "Chaleco reflectivo para cartero",
      "Bandera institucional",
      "Paño de limpieza de oficina",
      "Bolso de reparto postal",
      "Mochila de reparto postal"
    ]
  },
  {
    "code": "33300",
    "name": "Prendas de vestir",
    "examples": [
      "Camisa institucional de atención",
      "Pantalón de trabajo para cartero",
      "Chamarra para reparto postal",
      "Polera institucional",
      "Gorra institucional",
      "Impermeable para motociclista",
      "Overol para personal de transporte",
      "Chaleco de identificación postal",
      "Guantes textiles para manipulación de sacas",
      "Uniforme de atención en ventanilla"
    ]
  },
  {
    "code": "33400",
    "name": "Calzados",
    "examples": [
      "Zapato de seguridad para almacén",
      "Bota de lluvia para reparto",
      "Zapato de uniforme institucional",
      "Calzado de trabajo para cartero",
      "Bota de motociclista",
      "Botín de seguridad para transporte",
      "Calzado antideslizante para almacén",
      "Bota impermeable para cartero",
      "Zapato de reparto postal",
      "Bota de protección para carga"
    ]
  },
  {
    "code": "34110",
    "name": "Combustible y lubricantes",
    "examples": [
      "Gasolina",
      "Diésel",
      "Aceite de motor 20W-50",
      "Aceite de motor 15W-50",
      "Aceite de motor 10W-30",
      "Grasa lubricante",
      "Líquido de frenos",
      "Aceite de transmisión",
      "Refrigerante de motor",
      "Lubricante de cadena"
    ]
  },
  {
    "code": "34200",
    "name": "Productos químicos y farmacéuticos",
    "examples": [
      "Alcohol para limpieza de equipos",
      "Desinfectante de superficies de oficina",
      "Detergente para limpieza institucional",
      "Lavandina para limpieza de ambientes",
      "Jabón líquido para dispensador",
      "Gel antibacterial para ventanilla",
      "Limpiador de pantallas",
      "Limpiador de contactos eléctricos",
      "Desengrasante para piezas de transporte",
      "Limpiavidrios para oficina"
    ]
  },
  {
    "code": "34300",
    "name": "Llantas y neumáticos",
    "examples": [
      "Llanta 195 R15",
      "Llanta 185 R14",
      "Llanta 110/90-17",
      "Llanta 90/90-19",
      "Cámara 100/90-17",
      "Cámara 195 R15",
      "Llanta 110/90-16",
      "Llanta 90/90-18",
      "Cámara 90/90-19",
      "Llanta 185/70 R14"
    ]
  },
  {
    "code": "34400",
    "name": "Productos de cuero y caucho",
    "examples": [
      "Correa de sujeción de cuero",
      "Guantes de caucho para limpieza",
      "Empaque de goma para motor",
      "Manguera de caucho para vehículo",
      "Retén de goma para motocicleta",
      "Alfombra de caucho para vehículo",
      "Banda elástica para correspondencia",
      "Goma de apoyo para motocicleta",
      "Funda de cuero para documentos de transporte",
      "Sello de goma para ventanilla"
    ]
  },
  {
    "code": "34500",
    "name": "Productos de minerales no metálicos",
    "examples": []
  },
  {
    "code": "34600",
    "name": "Productos metálicos",
    "examples": [
      "Tornillo para estante metálico",
      "Tuerca para perno de vehículo",
      "Arandela para sujeción de carga",
      "Remache para placa de identificación",
      "Bisagra para casillero postal",
      "Candado para saca postal",
      "Cadena metálica de seguridad",
      "Escuadra metálica para estante",
      "Abrazadera metálica para manguera",
      "Cable de acero para seguridad de carga"
    ]
  },
  {
    "code": "34800",
    "name": "Herramientas menores",
    "examples": [
      "Llave para bujía de motocicleta",
      "Destornillador plano",
      "Destornillador Phillips",
      "Alicate universal",
      "Llave ajustable",
      "Llave combinada de 10 mm",
      "Llave Allen de 5 mm",
      "Cinta métrica para encomiendas",
      "Llave de rueda para vehículo",
      "Cúter para embalaje"
    ]
  },
  {
    "code": "39100",
    "name": "Materiales de limpieza",
    "examples": [
      "Escoba",
      "Trapeador",
      "Recogedor",
      "Balde",
      "Esponja",
      "Cepillo",
      "Franela",
      "Bolsa de basura",
      "Papel higiénico",
      "Toalla de papel"
    ]
  },
  {
    "code": "39300",
    "name": "Utensilios de cocina",
    "examples": []
  },
  {
    "code": "39400",
    "name": "Instrumental menor médico-quirúrgico",
    "examples": []
  },
  {
    "code": "39500",
    "name": "Útiles de escritorio y oficina",
    "examples": [
      "Bolígrafo azul",
      "Bolígrafo negro",
      "Lápiz HB",
      "Marcador permanente",
      "Grapadora",
      "Grapas 24/6",
      "Tijera mediana",
      "Corrector en cinta",
      "Regla",
      "Perforadora"
    ]
  },
  {
    "code": "39700",
    "name": "Útiles y materiales eléctricos",
    "examples": [
      "Cable eléctrico",
      "Enchufe",
      "Tomacorriente",
      "Interruptor",
      "Foco LED",
      "Regleta",
      "Cinta aislante",
      "Disyuntor",
      "Portalámpara",
      "Extensión eléctrica"
    ]
  },
  {
    "code": "39800",
    "name": "Otros repuestos y accesorios",
    "examples": [
      "Rodamiento 6301 para motocicleta",
      "Rodamiento 6203 para motocicleta",
      "Batería YTX7 para motocicleta",
      "Cadena 428 para motocicleta",
      "Piñón para motocicleta",
      "Cable de embrague para motocicleta",
      "Filtro de aire para motocicleta",
      "Bujía para motocicleta",
      "Bomba de gasolina para vehículo",
      "Pastilla de freno para motocicleta"
    ]
  },
  {
    "code": "39900",
    "name": "Otros materiales y suministros",
    "examples": [
      "Cinta de embalaje",
      "Precinto de seguridad",
      "Film de embalaje",
      "Burbuja protectora",
      "Brida plástica",
      "Silicona",
      "Pegamento",
      "Bolsa de seguridad",
      "Sello fechador",
      "Tinta de sello"
    ]
  },
  {
    "code": "43110",
    "name": "Equipo de oficina y muebles",
    "examples": [
      "Escritorio",
      "Silla de oficina",
      "Archivador",
      "Estante metálico",
      "Mesa de trabajo",
      "Gabinete",
      "Mostrador",
      "Casillero",
      "Silla de espera",
      "Pizarra"
    ]
  },
  {
    "code": "43700",
    "name": "Otra maquinaria y equipo",
    "examples": [
      "Balanza digital",
      "Carretilla de carga",
      "Transpaleta manual",
      "Selladora",
      "Flejadora",
      "Clasificadora",
      "Lector de códigos",
      "Impresora de etiquetas",
      "Trituradora",
      "Montacarga manual"
    ]
  }
];
// Los números del archivo original se conservan solo como alias de lectura del historial.
// PAR identifica una partida interna del almacén; los códigos previos siguen siendo alias.
export const ITEM_CATEGORIES = CATEGORY_DEFINITIONS.map((category,index)=>({
  ...category,
  legacyBudgetCode:category.code,
  legacySequenceCode:String(index).padStart(5,'0'),
  legacyCode:`${materialCodePrefix(category.name)}-${String(index+1).padStart(3,'0')}`,
})).sort((a,b)=>compareNames(a.name,b.name)).map((category,index)=>({
  ...category,
  previousCode:`${materialCodePrefix(category.name)}-${String(index+1).padStart(3,'0')}`,
  legacyCategoryCode:`CAT-${String(index+1).padStart(3,'0')}`,
  code:`PAR-${String(index+1).padStart(3,'0')}`,
}));
export const categoryLabel=(category:Pick<typeof ITEM_CATEGORIES[number],'code'|'name'>)=>`${category.code} · ${category.name}`;
export function categoryAliases(category: typeof ITEM_CATEGORIES[number]) {
  return [...new Set([category.name,...[category.code,category.legacyCategoryCode,category.previousCode,category.legacyCode,category.legacySequenceCode,category.legacyBudgetCode].flatMap(code=>[code,`${code} · ${category.name}`])])];
}
const categoriesByAlias=new Map(ITEM_CATEGORIES.flatMap(category=>categoryAliases(category).map(alias=>[alias,category] as const)));
export function categoryInfo(value:string){
  return categoriesByAlias.get(value);
}
export function normalizeCategory(value:string) {
  const category=categoryInfo(value);return category?categoryLabel(category):value;
}
export function compareInventoryMaterials(a:{category:string;name:string;code:string},b:{category:string;name:string;code:string}):number {
  return compareNames(categoryInfo(a.category)?.name??a.category,categoryInfo(b.category)?.name??b.category)||compareMaterialNames(a,b);
}
