# Archivo de actas AGBC: primera fase de revisión

Se conserva cada Excel completo por SHA-256 y cada documento por archivo, hoja y celda de título. La carga es idempotente y transaccional. No registra asignaciones ni devoluciones y comprueba que la custodia actual permanezca idéntica.

Desde el proyecto, con dependencias instaladas y .env configurado:

1. Ejecutar `pnpm db:migrate`.
2. Con Python y openpyxl: `python src/actions/activos/scripts/extraer-archivo-agbc.py "D:/asignaciones pdf/ACTAS" "RUTA_LOCAL/actas.json"`.
3. Ejecutar `node src/actions/activos/scripts/cargar-archivo-agbc.cjs "RUTA_LOCAL/actas.json"`.
4. Revisar `/activos/archivo-actas`.

La primera carga abarca solo ASIGNACIONES - 2026 - AGBC.xlsx y DEVOLUCIONES 2026 - AGBC.xlsx. No incluye los libros regionales, que requieren separar bloques mixtos y revisar duplicados contra los libros centrales.

Las coincidencias de bienes usan códigos actuales o históricos exactos y procedencia AGBC. Los códigos antiguos, sin código y ambiguos requieren revisión humana. Una coincidencia no equivale a confirmar custodia o vigencia. El responsable se resuelve contra las equivalencias del catálogo, sin crear personas por semejanza. El cargo se conserva como dato histórico de la fecha del documento y no sobrescribe el catálogo.

La vista imprimible es una transcripción pendiente de revisión, no un acta firmada ni un PDF oficial. El Excel original conserva formatos, imágenes y firmas que pudiera contener; la vista no reproduce firmas. Se requiere una siguiente fase de validación para emitir copias PDF por acta y vincular devoluciones totales o parciales. Se distinguen actas de actualización de asignaciones nuevas.

No subir los Excel, JSON extraídos, datos de inventario ni .env al repositorio.


## Carga de todas las procedencias

`extraer-archivo-actas.py CARPETA_ACTAS SALIDA_JSON` procesa los libros de actas centrales y regionales, excluyendo el inventario base y los archivos temporales de Excel (~$). `cargar-archivo-actas.cjs SALIDA_JSON` conserva cada documento por archivo/hoja/bloque, sin fusionarlo por responsable. La procedencia se lee del título del documento, no del nombre del archivo. La vinculación por código se restringe a su misma procedencia. Las copias o versiones se mantienen separadas y requieren revisión. Las hojas sin título de acta se registran en el resumen del archivo original para revisión y no se convierten automáticamente en actas.

La búsqueda /activos/archivo-actas incluye todas las procedencias por defecto. Cada documento tiene un PDF individual en /activos/archivo-actas/[id]/pdf, con su número, fecha y bienes de origen. No usa el correlativo de las nuevas actas ni reúne los bienes de todas las actas del responsable. Los PDF de archivo son copias para revisión sin firmas verificadas.


## PDF exportados del Excel original (21/10/2026)

El archivo Base AF se excluye de este archivo documental: pertenece al inventario.
Los 18 libros de actas contienen 605 bloques independientes. Los PDF se guardan en
`act_archivo_pdf`, asociados al UUID del bloque, con huella SHA-256 del Excel y del PDF.
La ruta de impresión sirve esos bytes guardados y no reconstruye una plantilla.
El archivo de actas permite consultar departamento, regional, procedencia, tipo y responsable.

Se conservan las copias y los correlativos originales. Los datos incompletos,
las diferencias entre año y fecha y los números repetidos dentro de la misma
regional/procedencia/tipo aparecen en Datos por revisar. Cuatro bloques estaban
ocultos en los libros: se generaron PDF de consulta revelando ese contenido en
copias temporales y se identifican como material para revisión. Los Excel fuente
no se modificaron. Las operaciones de custodia y el inventario no se alteran.

Para cargar una exportación previamente revisada:

```powershell
node src/actions/activos/scripts/guardar-pdf-originales.cjs plan.json carpeta-pdf control.json
```

El plan relaciona UUID, ruta y SHA-256 de la fuente, área y visibilidad del bloque.
El control exige un registro de verificación y SHA-256 por PDF, sin incidencias de
separación de documentos. La carga comprueba cada fuente, guarda los PDF en una
transacción y verifica que la custodia y las transcripciones previas sigan iguales.
No se utiliza un servicio externo para convertir los documentos.


## Anexos originales de vehículos (21 de octubre de 2026)

Se revisaron los 18 libros: 14 fichas de accesorios están fuera de las columnas del acta principal, en las mismas hojas. Se exportaron los rangos originales con logos, tablas y firmas y se añadieron como última página a 16 PDFs. En Beni y Sucre cada ficha está junto a una pareja de asignación/devolución del mismo vehículo y acompaña a ambas actas. No se reutiliza una ficha en otro vehículo ni se generan anexos inexistentes.

El campo `motor` termina en `+ anexo original del vehículo` y `area_impresion` conserva el rango principal seguido de `; ANEXO VEHICULO: rango`. La pantalla identifica estos PDFs. Una regeneración general debe conservar o volver a incorporar los anexos: no sustituirlos por el PDF principal sin ficha. Los Excel y las transcripciones se mantienen intactos.

## Ajuste de actas cortas (21 de octubre de 2026)
Se ajustaron 25 PDFs de dos páginas a una hoja, conservando las celdas, los logotipos, las tablas, las notas y las firmas. En dos documentos UPU se restituyeron también las alturas de fila del Excel sobre copias temporales para evitar la expansión de títulos. Los Excel originales y los datos permanecen intactos. Se conservaron las actas extensas y los anexos de vehículos separados. El campo motor identifica la impresión ajustada; las regeneraciones deben conservar esta corrección.

## Recuperación de observaciones (22 de octubre de 2026)
Se contrastaron las líneas archivadas con los 18 Excel originales, comprobando sus SHA-256 y la descripción de cada fila. Se recuperaron 359 observaciones vacías y se corrigieron 8 lecturas de columnas desplazadas: 367 líneas en 154 actas. Se conservaron literalmente los textos S/O y Sin observaciones del Excel. Las actas sin columna identificable no se alteraron.
Los extractores identifican ahora el encabezado OBS u OBSERVACIONES en vez de suponer una posición fija. Se mantienen los 605 PDFs originales, anexos, inventario y custodia. El respaldo y el plan de esta ejecución están en la carpeta work del chat: observaciones-antes.json y observaciones-plan.json. recuperar-observaciones.cjs valida fuentes, versiones y filas, registra auditoría y comprueba los hashes de todos los PDFs; por defecto simula con rollback y exige --aplicar para confirmar.
