export type FilaDevolucion={activoId:string|null;codigo:string;descripcion:string;placa:string;estado:string;observaciones:string;accesorios:string;asignacionEsperada:string|null;fijaEsperada:string|null};
export type ActaOrigenDevolucion={id:string;fuente:"excel"|"sistema"};
export type BorradorDevolucion={referencia:string;actasOrigen:ActaOrigenDevolucion[];datos:{responsable:string;cargo:string;entidad:string;regional:string;piso:string};bienes:FilaDevolucion[];avisos:string[]};
