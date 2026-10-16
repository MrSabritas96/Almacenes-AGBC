# Asignaciones de Activos

Desde el inventario, abrir la ficha del bien y usar **Asignaciones del activo**. El resumen e historial general están en `/activos/asignaciones`.

## Reglas implementadas

- **Fija:** responsable habitual y ubicación, sin vencimiento. Una nueva fija reemplaza la anterior y conserva su historial.
- **Momentánea:** receptor y destino temporales, fecha de entrega, fecha prevista de devolución y motivo obligatorios. Puede coexistir con la fija, pero solo una momentánea puede estar activa por registro.
- Mientras existe una momentánea activa, no se puede crear otra asignación ni finalizar la fija.
- Al registrar su devolución, la custodia vuelve a la fija activa o a la referencia original del Excel si no hay fija.
- Devolver una fija finaliza esa asignación y vuelve a la custodia original del Excel. El formulario lo indica antes de confirmar.
- Vencer el plazo no registra una devolución automática. Se muestra **Vencida · pendiente de devolución** hasta que una persona confirme la recepción.
- Se pueden introducir referencias de acta; no se generan documentos firmados.
- Las fechas se interpretan como fechas de calendario de Bolivia. No se permiten entregas futuras, devoluciones futuras ni fechas que contradigan el orden de los movimientos registrados.

## Datos y seguridad

`act_asignaciones` conserva el tipo, situación, receptor, ubicación, custodia anterior, fechas, motivos, referencia de acta y usuarios de creación/cierre. `act_custodia_actual` da prioridad a la momentánea activa, luego a la fija, luego al origen del Excel. El listado y sus filtros usan esta vista; los registros originales y las celdas importadas no se editan.

Cada entrega se vincula al UUID del registro importado. No se fusionan bienes que compartan código ni personas con nombres parecidos. El formulario permite elegir nombres y ubicaciones existentes o escribir nuevos; los receptores todavía no pertenecen a un catálogo de funcionarios.

Las consultas requieren `activos:read`. Crear y devolver requieren además `activos:update`. La verificación se realiza en el servidor, aunque se invoque la acción directamente. El éxito se audita en la misma transacción que el cambio; los errores y rechazos se registran mediante la auditoría del núcleo.

Las operaciones bloquean la fila del bien durante la transacción. La base restringe a una asignación activa por tipo y registro. Un identificador de solicitud evita duplicar una entrega si se repite el envío. Una ficha desactualizada no puede reemplazar una fija que cambió mientras se completaba el formulario.

## Migración y prueba

```powershell
pnpm db:migrate
node --import tsx src/actions/activos/tests/asignaciones.integration.ts
```

La prueba de integración crea un registro sintético temporal, ejecuta el ciclo fijo/momentáneo/devolución, valida concurrencia, fechas, idempotencia, restricciones y auditoría, y retira sus propias filas al finalizar. Utiliza la base local configurada en `.env` y el administrador inicial existente. No utiliza un bien real.

La migración `0003_clever_stephen_strange.sql` agrega la tabla de asignaciones, sus enumeraciones, restricciones e índices y la vista de custodia actual.
