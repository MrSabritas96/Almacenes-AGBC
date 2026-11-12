# Almacenes AGBC

Acceso administrativo: `/almacenes`, por correo o usuario y contraseña, sin selector de rol. El servidor identifica el rol real y aplica el almacén asignado en cada consulta y operación. El formulario para empleados es `/solicitar-material`, sin cuenta.

## Preparación

1. Configurar PostgreSQL y las variables de `.env.example` en `.env`.
2. Definir `SEED_ADMIN_PASSWORD` y `SEED_WAREHOUSE_PASSWORD` (al menos 8 caracteres para cuentas nuevas).
3. Ejecutar `pnpm db:migrate` y `pnpm db:seed`.
4. Iniciar con `pnpm dev` o con `pnpm build` y `pnpm start`.

El seed es repetible: conserva las cuentas, contraseñas y perfiles existentes. Crea un almacén central y las cuentas que falten. No carga existencias ficticias. Las cuentas iniciales son `admin` y `almacen`. Solo el SuperAdmin administra las cuentas de administradores desde Administradores. Los empleados se registran en fichas sin credenciales. Las contraseñas se guardan como hashes mediante Better Auth; los valores de configuración solo están en `.env`, excluido de Git.

## Roles

- **SuperAdmin:** inventario y solicitudes de todos los almacenes; creación de almacenes; creación y edición de administradores; gestión de fichas sin cuenta; eliminación y reactivación de cuentas. No modifica otras cuentas SuperAdmin desde esta nómina.
- **Administrador de almacén:** materiales de su almacén, categorías, unidades, ubicación, stock mínimo y ajustes con motivo; revisión de solicitudes; registro de entregas; empleados, materiales recibidos e historial; exportación del inventario.
- **Solicitante sin cuenta:** llena el formulario público con nombre, CI y extensión, cargo, unidad, material, cantidad, fecha y motivo. El teléfono es opcional. Recibe un número de comprobante; coordina respuesta y recojo con la administradora. El catálogo no publica stock, fichas ni historiales personales.

## Stock y solicitudes

`stock` representa las unidades disponibles, sin las reservas. Aprobar una solicitud descuenta y reserva la cantidad en una transacción con control de concurrencia. El inventario muestra por separado las unidades reservadas. Registrar una entrega convierte la reserva en material recibido por el empleado, sin descontar dos veces. Un ajuste de inventario modifica solo el disponible; no modifica las reservas existentes.

Estados: pendiente → lista para entrega → entregada; pendiente → aceptada sin stock → lista para entrega o rechazada; pendiente → rechazada. La aprobación exige la fecha de entrega/recojo; el lugar se registra automáticamente con el nombre del almacén del material, sin pedirlo en el formulario. La espera y el rechazo exigen un mensaje. Las solicitudes públicas generan avisos a la administración. Las respuestas se conservan en el historial privado; el solicitante coordina el resultado con la administradora y su comprobante. El dashboard actualiza los datos después de guardar cambios o al pulsar «Actualizar datos». No tiene un refresco periódico de la página.

La eliminación de materiales los retira del inventario activo y conserva sus movimientos. La eliminación de usuarios desactiva la cuenta y revoca las sesiones, conservando entregas y solicitudes. Las solicitudes abiertas bloquean la retirada del material; deben resolverse primero. Las fichas no dependen del acceso de una cuenta administrativa. El administrador solo puede gestionar el almacén asignado. El registro público de cuentas está deshabilitado.

## Verificación

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Con el servidor local iniciado: `node tests/warehouse-integration.mjs`

La prueba de integración usa cuentas administrativas, fichas y materiales temporales; verifica solicitud sin cuenta, reintento idempotente, aislamiento, concurrencia, reservas, entrega con CI, espera, rechazo, actas y materiales previos; luego elimina sus registros temporales. Ejecutarla únicamente contra una base local de desarrollo. La vista Movimientos muestra los últimos 200 registros; el historial completo de solicitudes conserva las fechas y respuestas.

## Identidad institucional

Paleta azul `#0b3b83` y amarillo `#ffc400`, tomada de las referencias oficiales SIGEC y POSTAR. El logotipo y la mascota se conservan localmente en `public/brand`; sus fuentes son `https://sigec.correos.gob.bo/media/logos/LOGO%2019-2-26.png` y `https://sigec.correos.gob.bo/media/monito.png`. Las referencias de diseño son https://sigec.correos.gob.bo/, https://postar.correos.gob.bo/ y https://www.correos.gob.bo/.

Cada administrador puede tener un nombre de usuario único, con entre 3 y 30 letras, números o guiones bajos. Se normaliza a minúsculas. El SuperAdmin lo administra desde la nómina. La contraseña mínima es de 8 caracteres. Para verificar los accesos administrativos y el rechazo de empleados: `node tests/warehouse-access.mjs`.

## Menú y reportes PDF

El menú usa los estilos y estructura de AdminLTE 4, con estado controlado por React. El botón de la captura se retiró del lateral para todos los roles. En escritorio, las flechas de la barra superior alternan entre compacto (82 px) y expandido (254 px); la selección se guarda por usuario en localStorage y la primera visita inicia compacta. En compacto, el hover sobre cualquier parte del lateral o el foco del teclado lo amplía temporalmente sobre el contenido, sin cambiar la selección ni desplazar el área principal. Solo el botón cambia el espacio reservado para el menú. En móviles (menos de 768 px), el icono del encabezado abre un panel superpuesto con bloqueo de foco; se cierra con el icono, Escape, el fondo o al elegir una sección. Su apertura no modifica la selección de escritorio. Las preferencias antiguas de acercamiento se interpretan como compacto.

El botón Descargar PDF está disponible en cada listado autorizado: inventario, Mis materiales, solicitudes, personal/empleados, movimientos y almacenes. Exporta todos los registros de la vista que coincidan con la búsqueda y los filtros actuales, con fecha de Bolivia, usuario, alcance y paginación. Las tablas anchas se dividen conservando la primera columna. No amplía los permisos: los empleados exportan sus materiales recibidos y sus solicitudes, los administradores su almacén y el SuperAdmin todos los almacenes. Movimientos conserva el límite de 200 registros de la vista. Si no hay coincidencias se informa sin descargar un archivo vacío. La exportación CSV existente sigue disponible.

Prueba del generador: `pnpm exec tsx tests/report-pdf.ts`.

Los PDF usan un formato de informe institucional con el logo oficial de Correos de Bolivia, azul y amarillo, encabezado, fecha de emisión, responsable, alcance, filtros, total de registros y pie numerado en todas las páginas. El documento contiene texto seleccionable y tablas; su orientación se adapta a la cantidad de columnas.

## Apertura y cierre de solicitudes

En Solicitudes → Recepción de solicitudes, el administrador de almacén puede habilitar o cerrar el formulario de su almacén. El SuperAdmin puede hacerlo en cualquiera. El estado se guarda en PostgreSQL y comienza habilitado para almacenes existentes y nuevos. El formulario público solo ofrece almacenes habilitados. Si se cierra durante el llenado, el servidor rechaza el envío. El historial anterior sigue disponible para la administradora. El servidor comprueba el estado al enviar y comparte un bloqueo de la fila del almacén con el cierre para evitar pedidos posteriores a un cierre ya confirmado. Cada cambio registra responsable, almacén y estado en auditoría.

La migración `0003_heavy_captain_midlands.sql` añade únicamente `warehouses.requests_enabled`, sin eliminar registros. Para revertir el despliegue, restaurar primero la versión anterior de la aplicación y después, si se necesita, eliminar esa columna; se perderá solo la configuración de apertura/cierre, no las solicitudes. La prueba `node tests/warehouse-integration.mjs` verifica permisos, aislamiento, bloqueo, reapertura y conservación del historial.

## Base de datos local estable

La configuración local usa el servicio de PostgreSQL de Windows en `127.0.0.1:5432`, con la base `Almacenes-AGBC`. No depende de una instancia temporal ni de Docker Desktop. El 13 de octubre de 2026 se conservó una copia de la base anterior y un respaldo completo en `backups/almacenes-before-service-migration-20261013.dump`. La instancia del puerto 5433 deja de ser necesaria. Si cambias DATABASE_URL, reinicia `pnpm dev` para reconstruir la conexión y sus sesiones.

## Materiales por empleado y actas de entrega

Materiales por empleado permite a administradores registrar una ficha de lo que cada empleado ya posee: nombre, categoría, cantidad, unidad, serie, estado físico, ubicación, fecha y observaciones. Se accede también desde Fichas e historial → Ver materiales. Este levantamiento inicial no descuenta inventario. La ficha es privada: la consultan la administradora del almacén y el SuperAdmin. El formulario público no permite consultar ni modificar fichas anteriores. El administrador se limita a su almacén y el SuperAdmin puede gestionar todos.

Las fichas se pueden corregir o eliminar con un motivo obligatorio. La eliminación inicial es lógica y conserva el registro y la auditoría. Las entregas permiten corregir cantidad o destinatario del mismo almacén: la diferencia se ajusta transaccionalmente en el stock y se registra un movimiento. Anular una entrega registrada por error restituye su cantidad una sola vez, marca la solicitud como Entrega anulada y conserva el motivo; no representa consumo ni una devolución física. Para un material equivocado, anular y tramitar la entrega correcta. El almacén de una ficha no se modifica; se conserva el historial de su ubicación original.

En una solicitud entregada, Imprimir acta descarga un PDF institucional de recepción con número de acta, versión, empleado/CI, cargo, unidad, almacén, material, cantidad, fecha y responsable. Incluye líneas para firma manuscrita del empleado y del responsable. Abrir el PDF, imprimirlo y conservar el ejemplar firmado; la aplicación no simula firmas ni almacena un documento firmado automáticamente. El servidor verifica permisos y vuelve a leer la entrega vigente al emitir el acta, por lo que no se certifican entregas anuladas y las reimpresiones reflejan las correcciones.

Migraciones: 0004 añade employee_materials sin alterar entregas existentes; 0005 admite el estado cancelled. Ambas están aplicadas a la base local. Para revertir la aplicación, conservar estas estructuras y los registros; no eliminar la tabla ni restringir el estado mientras haya datos nuevos. Las entregas anteriores se muestran desde material_requests, sin duplicarlas ni descontar stock nuevamente.

## Campana y notificaciones del administrador

La campana del navbar muestra al administrador los avisos de su almacén; el SuperAdmin recibe los de todos. Diferencia stock bajo (ámbar), stock agotado (rojo), solicitudes nuevas (azul), solicitudes urgentes (rojo, con etiqueta propia) y solicitudes en espera que ya tienen stock para reservar (verde). Los iconos y textos identifican el tipo sin depender solo del color.

El contador muestra avisos sin leer. El submenú muestra los últimos 50 activos, permite marcar todos como leídos y al seleccionar un aviso dirige al registro exacto de inventario o solicitudes; Mostrar todos los registros elimina ese filtro. La lectura se guarda por usuario. Después de guardar una operación, la campana consulta inmediatamente los avisos nuevos, incluidos los de stock bajo o agotado al aceptar solicitudes, sin recargar la página. Para cambios de otros usuarios también se consultan cada 15 segundos mientras la página está visible y al regresar a la pestaña. Las comprobaciones de rol, usuario y almacén se realizan en el servidor.

Las solicitudes notifican al crearse. El inventario, reservas y correcciones actualizan los avisos de stock dentro de la misma transacción: un aviso por material y destinatario, sin repetir lecturas mientras persiste el mismo nivel; pasar a agotado o volver a bajar después de reponer lo marca de nuevo como no leído. Reponer por encima del mínimo o retirar un material resuelve el aviso. Los pedidos en espera se notifican cuando hay stock suficiente; dejan de figurar si ese stock se consume o la solicitud se procesa. No se reserva stock automáticamente por tener una notificación.

La migración 0006 amplía notificaciones sin eliminar las existentes y carga los avisos de stock ya bajo/agotado. El índice por usuario y evento evita duplicados. Para revertir la aplicación, conservar las columnas y datos nuevos; no es necesario eliminarlos.

## Tamaños y acceso

Las vistas compartidas usan títulos de 24–26 px, datos de tabla de 12 px y filas con 10 px de relleno vertical. El encabezado, tarjetas y espacios son más compactos. El acceso reduce el logo y la ilustración en escritorio; en móvil prioriza credenciales y el botón de ingreso, sin la sección decorativa. El botón de contraseña tiene un área de interacción de 44 px.

## Sesiones independientes y actualización en vivo

Cada ingreso abre `/dashboard?tab=…` con un identificador aleatorio de pestaña y su propia cookie HttpOnly, SameSite=Lax (Secure en producción). El identificador no contiene credenciales ni concede permisos: todas las consultas, cambios, avisos y actas validan la sesión correspondiente en el servidor. Recargar conserva esa cuenta, y cerrar sesión revoca solo esa sesión. Las pestañas abiertas antes de este cambio deben iniciar sesión una vez por separado; el acceso anterior por cookie general se conserva para compatibilidad, sin migrar ni eliminar usuarios o sesiones existentes.

Socket.IO autentica la cookie de la pestaña y valida cuenta activa, rol y caducidad; ya no permite unirse a salas indicando arbitrariamente un usuario. Tras confirmar una operación se emite una señal sin datos privados, cada pestaña consulta sus datos autorizados y actualiza la campana y las listas sin recarga manual. Una reconexión recupera los cambios pendientes; el sondeo de avisos cada 15 segundos permanece como respaldo. Los formularios abiertos no se cierran con estas actualizaciones.

Verificación local: `node tests/warehouse-tabs-live.mjs` comprueba dos cuentas administrativas simultáneas con rol automático y solicitudes públicas sin sesión con cookie global compartida, recarga, permisos, cierre independiente, conexión no autorizada y recepción de solicitudes/agotamiento en menos de cinco segundos. Usa registros temporales y los elimina al finalizar.

## Fichas sin cuentas — migración 0007

`warehouse_people` separa a los destinatarios de `users` y `accounts`. La identidad de una ficha es CI normalizado a mayúsculas y sin espacios, dentro del almacén. Se conserva el nombre/cargo/unidad/teléfono declarado en cada solicitud como snapshot; una nueva solicitud pública no sobrescribe una ficha ya registrada. La administradora puede corregir sus datos. No se crean usuarios, contraseñas ni permisos para solicitantes.

La migración enlaza solicitudes y materiales previos con las nuevas fichas, conserva las referencias de usuario históricas y deshabilita únicamente las cuentas que solo tenían el rol empleado. Revoca sus sesiones. No elimina usuarios antiguos ni registros de auditoría. Los CI antiguos vacíos se identifican con LEGADO- y deben completarse desde la ficha; no se inventa un CI real.

Fichas e historial reúne solicitudes pendientes, aceptadas, rechazadas, entregadas o anuladas por persona. Materiales por empleado reúne materiales previos y entregas vigentes; aprobar no equivale a entregar. La confirmación de entrega exige marcar la verificación del CI. Las actas siguen consultando la entrega vigente del servidor.

El envío valida datos, fechas, almacén habilitado, material del mismo almacén, cantidades y prioridad. El identificador de envío evita duplicados en reintentos. Se limita a diez solicitudes por CI y almacén por hora y se incluye un campo señuelo contra envíos automatizados. Las solicitudes no autentican la identidad de la persona; la administradora verifica el CI al entregar.

Respaldo previo local: `backups/before-people-1792033716188.dump`. Antes y después de migrar se conservaron las 7 solicitudes, los 5 registros históricos de usuario y el stock de 647 unidades. La migración generó 3 fichas. Los fixtures de pruebas se eliminan al finalizar.

Para revertir, detener escrituras, respaldar la base actual completa y restaurar el respaldo previo en una base separada. Usar esa base con la versión anterior del código; conservar la base nueva y su respaldo, pues contienen las solicitudes públicas recibidas tras el cambio. No eliminar columnas ni restaurar encima de la base actual sin un plan de conciliación de esos registros.

Verificación actual: `node tests/warehouse-access.mjs`, `node tests/warehouse-integration.mjs` y `node tests/warehouse-tabs-live.mjs`. La integración usa `tests/warehouse-public-intake.ts`, que se ejecuta con el runtime tsx ya instalado.

## Consulta pública del estado de solicitudes

En el acceso, Consultar solicitud aparece junto a Solicitar material. `/consultar-solicitud` exige el mismo CI y extensión registrados junto con el número de comprobante recibido al enviar, sin cuenta ni contraseña. Reutiliza la normalización del formulario y recupera únicamente la solicitud que coincide con ambos datos. Conocer el CI no permite enumerar el historial. Muestra material, cantidad solicitada, estado, fechas, respuesta y recojo, sin devolver ficha personal, contactos, motivo interno, stock ni reservas. El CI y comprobante se envían mediante una acción POST; no se incluyen en la URL ni se guardan en almacenamiento persistente del navegador. Conserva tu comprobante para consultar.

Los estados aceptada/lista para recoger, pendiente, en espera de reposición, rechazada, entregada y entrega anulada tienen indicaciones propias. La consulta se actualiza cada 15 segundos mientras está visible y al volver a la pestaña; también permite consultar manualmente. Los formularios cerrados no impiden ver solicitudes anteriores. El comprobante del envío enlaza a esta consulta. No crea usuarios ni modifica solicitudes.

## Comprobantes cortos

Las solicitudes públicas nuevas generan comprobantes como `SOL-7K3M-9P2R`: ocho caracteres aleatorios en dos grupos, excluyendo 0, 1, I y O del segmento aleatorio. La clave primaria de la base garantiza que no se repitan; un choque genera otro candidato dentro de la misma transacción. Los reintentos del mismo envío conservan el comprobante original. No se alteran identificadores de solicitudes anteriores ni sus actas o historial. La consulta sigue exigiendo CI con extensión y comprobante; para los nuevos acepta minúsculas, espacios y ausencia de guiones. El comprobante se puede copiar desde la confirmación.

«Descargar comprobante» está disponible en la confirmación del envío y en los resultados de Consultar solicitud. Genera un PDF A4 institucional con logo, código de comprobante, fecha de solicitud y emisión, solicitante, CI, cargo, unidad, almacén, material y código, cantidad, fecha requerida, prioridad, motivo, estado y respuesta actual. Incluye los datos de recojo o entrega cuando corresponden y las indicaciones de consulta. Cada descarga valida CI y comprobante en el servidor y lee los datos vigentes, sin publicar stock ni contactos. El PDF permite texto seleccionable y paginación para textos largos; acredita el registro de la solicitud y se distingue del acta de entrega con firmas.
