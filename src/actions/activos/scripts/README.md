# Importación local del inventario de Activos

Desde la raíz del proyecto, después de instalar dependencias y configurar `.env`:

```powershell
pnpm db:migrate
node src/actions/activos/scripts/importar-excel.cjs "C:\ruta\inventario.xlsx" --dry-run
node src/actions/activos/scripts/importar-excel.cjs "C:\ruta\inventario.xlsx"
```

El importador carga en una sola transacción y verifica el número de filas. El hash SHA-256 evita repetir la carga del mismo archivo. Un archivo modificado constituye una nueva importación: antes de cargar otro corte, decidir qué importación debe permanecer vigente para evitar sumar dos cortes del inventario.

Las definiciones de columnas corresponden al libro facilitado por María. Los nombres y encabezados deben revisarse si cambia la plantilla. `--dry-run` permite revisar las cantidades antes de escribir.

## Datos conservados

- `act_importaciones`: nombre, hash, archivo original completo y resumen.
- `act_hojas_importadas`: procedencia y vigencia de cada hoja.
- `act_filas_importadas`: todas las filas con datos, incluidas las hojas auxiliares. Cada celda conserva valor, fórmula, formato y texto mostrado cuando existen.
- `act_activos`: registros estructurados de las hojas de inventario, versiones anteriores y faltantes. No es un conteo de bienes únicos.
- `act_inventario_vigente`: vista que filtra las hojas confirmadas como vigentes.

María confirmó como vigentes `AGBC`, `EXECOBOL 2024`, `UPU`, `PACTA`, `MOPSV` y `UPAEP`. `AGBC ANTERIOR` y `ECOBOL` quedan históricas. Las demás hojas se preservan con vigencia pendiente y no se incluyen en esa vista.

No se fusionan códigos repetidos, bienes sin código ni responsables con nombres parecidos. Las incidencias se guardan en `incidencias_importacion`. Fechas incompletas e importes no numéricos se dejan nulos en la columna tipada, con el original conservado. No se recalcula la depreciación: se importan los valores del corte del Excel.

Para registros nuevos creados desde la aplicación y para consolidar bienes entre cortes, habrá que definir el catálogo maestro y los flujos CRUD. Este importador prepara y conserva la información de origen.

El script es una herramienta local y no se expone como endpoint. No subir el Excel, `.env`, respaldos ni una exportación de los registros a GitHub. Entregar por la rama de Activos el esquema, su exportación en `src/db/schema/index.ts`, las migraciones y este importador. La copia actual proviene de un ZIP y no tiene `.git`; integrar estos cambios en una copia clonada antes de abrir el PR.
