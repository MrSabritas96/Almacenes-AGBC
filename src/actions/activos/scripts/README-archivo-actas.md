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
