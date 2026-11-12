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
- **Solicitante:** llena el formulario público con nombre, CI y extensión, cargo, unidad, material, cantidad, fecha y motivo. El teléfono es opcional. Recibe un número de comprobante; coordina respuesta y recojo con la administradora. El catálogo no publica stock ni historiales personales.

## Stock y solicitudes

«Añadir material» y «Editar material» permiten buscar materiales del almacén para completar categoría, unidad, ubicación y stock mínimo. Se pueden escribir nombres y valores nuevos en todos estos campos; categoría, unidad y ubicación también ofrecen sugerencias existentes. Seleccionar una sugerencia no cambia el identificador del registro, el código único ni las existencias ingresadas. El almacén mantiene su selección entre las opciones autorizadas y todas las validaciones del servidor siguen vigentes.

Los materiales usan letras del nombre y un correlativo global de al menos cuatro dígitos: `PBC-0001` (Papel bond carta), `BA-0002` (Bolígrafo azul). Se excluyen tildes y conectores como «de», «del» o «y». Para un nombre de una sola palabra se usan sus primeras tres letras. El número continúa desde el mayor sufijo de todos los almacenes, incluidos los materiales archivados. Un bloqueo transaccional y la restricción única impiden duplicados en altas simultáneas. Los listados y reportes se ordenan por el número del código, independientemente del prefijo. Editar el nombre no renumera el material ni altera sus referencias históricas.

La actualización del catálogo existente se realizó con `scripts/recode-materials.mts --apply`, sin modificar identificadores, existencias ni relaciones. El script conserva un respaldo completo y un archivo JSON de correspondencia de códigos anteriores/nuevos en `backups/`, además de la auditoría. Es una corrección puntual; no debe repetirse para renumerar operaciones nuevas. Las altas normales mantienen sus códigos estables.

El formulario permite escribir para buscar y seleccionar empleados activos del almacén. La selección autocompleta nombre, CI, cargo, unidad y teléfono, y los campos permanecen editables para la solicitud; el envío público no sobrescribe la ficha institucional. También admite nombres nuevos. El directorio del formulario público incluye estos datos de empleados de almacenes con solicitudes habilitadas, sin credenciales, solicitudes ni materiales asignados. Los selectores de almacén, material y prioridad permiten escribir para filtrar y abrir todas las opciones. Los materiales se eligen del catálogo, sin mostrar existencias. La solicitud no pide fecha requerida: registra automáticamente su fecha de creación. La regional es obligatoria y se valida contra el catálogo de nueve departamentos de Correos de Bolivia.

`stock` representa las unidades disponibles, sin las reservas. Aprobar una solicitud descuenta y reserva la cantidad en una transacción con control de concurrencia. El inventario muestra por separado las unidades reservadas. Registrar una entrega convierte la reserva en material recibido por el empleado, sin descontar dos veces. Un ajuste de inventario modifica solo el disponible; no modifica las reservas existentes.

Estados: pendiente → lista para entrega → entregada; pendiente → aceptada sin stock → lista para entrega o rechazada; pendiente → rechazada. La aprobación exige la fecha de entrega/recojo; el lugar se registra automáticamente con el nombre del almacén del material, sin pedirlo en el formulario. La espera y el rechazo exigen un mensaje. Las solicitudes públicas generan avisos a la administración. Las respuestas se conservan en el historial privado; el solicitante coordina el resultado con la administradora y su comprobante. El dashboard actualiza los datos después de guardar cambios o al pulsar «Actualizar datos». No tiene un refresco periódico de la página.

La eliminación de materiales los retira del inventario activo y conserva sus movimientos. La eliminación de usuarios desactiva la cuenta y revoca las sesiones, conservando entregas y solicitudes. Las solicitudes abiertas bloquean la retirada del material; deben resolverse primero. Las fichas no dependen del acceso de una cuenta administrativa. El administrador solo puede gestionar el almacén asignado. El registro público de cuentas está deshabilitado.

## Verificación

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Con el servidor local iniciado: `node tests/warehouse-integration.mjs`

La prueba de integración usa cuentas administrativas, fichas y materiales temporales; verifica solicitud sin cuenta, reintento idempotente, aislamiento, concurrencia, reservas, entrega con CI, espera, rechazo, actas y materiales previos; luego elimina sus registros temporales. Ejecutarla únicamente contra una base local de desarrollo. La vista Movimientos utiliza todos los registros; el historial completo de solicitudes conserva las fechas y respuestas.

## Identidad institucional

Paleta azul `#0b3b83` y amarillo `#ffc400`, tomada de las referencias oficiales SIGEC y POSTAR. El logotipo y la mascota se conservan localmente en `public/brand`; sus fuentes son `https://sigec.correos.gob.bo/media/logos/LOGO%2019-2-26.png` y `https://sigec.correos.gob.bo/media/monito.png`. Las referencias de diseño son https://sigec.correos.gob.bo/, https://postar.correos.gob.bo/ y https://www.correos.gob.bo/.

Cada administrador puede tener un nombre de usuario único, con entre 3 y 30 letras, números o guiones bajos. Se normaliza a minúsculas. El SuperAdmin lo administra desde la nómina. La contraseña mínima es de 8 caracteres. Para verificar los accesos administrativos y el rechazo de empleados: `node tests/warehouse-access.mjs`.

## Menú y reportes PDF

Los indicadores del dashboard son botones completos accesibles por teclado: Tipos de material abre el inventario; Solicitudes por atender abre las pendientes y en espera; Stock bajo abre el inventario con los materiales cuyo disponible es menor o igual al mínimo; Fichas de empleados abre Fichas e historial. Los filtros se pueden quitar desde la pestaña de destino. Las exportaciones respetan estos filtros.

Las esperas de navegación y las operaciones con carga utilizan `PostalLoader`, con la imagen institucional del mensajero en motocicleta avanzando de izquierda a derecha. El componente se adapta a página, panel y botón, conserva los mensajes de estado y detiene el movimiento si el dispositivo solicita reducir animaciones. La imagen original se sirve desde `public/brand/correos-delivery-loading.jpg` mediante Next Image.

Cada recorrido dura 1.5 segundos. `withMinimumLoading` mantiene las cargas de operaciones visibles durante un mínimo de 1.5 segundos, también ante errores, ejecutando el trabajo y el plazo en paralelo; si el trabajo tarda más, se espera su finalización sin sumar otros 1.5 segundos. El acceso espera ese mínimo antes de mostrar el resultado o navegar. Las consultas automáticas mantienen su actualización inmediata; el indicador inicial y los filtros conservan el tiempo visual sin detener las actualizaciones de datos.

El menú usa los estilos y estructura de AdminLTE 4, con estado controlado por React. El botón de la captura se retiró del lateral para todos los roles. En escritorio, las flechas de la barra superior alternan entre compacto (82 px) y expandido (254 px); la selección se guarda por usuario en localStorage y la primera visita inicia compacta. En compacto, el hover sobre cualquier parte del lateral o el foco del teclado lo amplía temporalmente sobre el contenido, sin cambiar la selección ni desplazar el área principal. Solo el botón cambia el espacio reservado para el menú. En móviles (menos de 768 px), el icono del encabezado abre un panel superpuesto con bloqueo de foco; se cierra con el icono, Escape, el fondo o al elegir una sección. Su apertura no modifica la selección de escritorio. Las preferencias antiguas de acercamiento se interpretan como compacto.

El botón Descargar PDF está disponible en cada listado autorizado: inventario, Mis materiales, solicitudes, personal/empleados, movimientos y almacenes. Exporta todos los registros de la vista que coincidan con la búsqueda y los filtros actuales, con fecha de Bolivia, usuario, alcance y paginación. Las tablas anchas se dividen conservando la primera columna. No amplía los permisos: los empleados exportan sus materiales recibidos y sus solicitudes, los administradores su almacén y el SuperAdmin todos los almacenes. Movimientos exporta los saldos y operaciones del intervalo seleccionado, sin límite de 200 registros. Si no hay coincidencias se informa sin descargar un archivo vacío. La exportación CSV existente sigue disponible.

Prueba del generador: `pnpm exec tsx tests/report-pdf.ts`.

Los PDF usan un formato de informe institucional, azul y amarillo, encabezado, fecha de emisión, responsable, alcance, filtros, total de registros y pie numerado en todas las páginas. Todos los informes, actas y comprobantes incluyen las imágenes proporcionadas de Presidencia en la esquina superior izquierda y de Correos de Bolivia en la superior derecha al 100 % de opacidad, conservando sus colores originales. La cabecera común conserva la proporción de ambos logos en cada página, incluso en orientación horizontal, tablas divididas y páginas de firmas. Los archivos se sirven desde `public/brand/report-presidency.png` y `public/brand/report-agency.png`; si alguno no carga, la exportación informa el error. El documento contiene texto seleccionable y tablas; su orientación se adapta a la cantidad de columnas.

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


## Proveedores, compras y valoración (20/10/2026)

Proveedores permite registrar tipo de proveedor, razón social, NIT, contacto, dirección, correo, teléfono, estado y observaciones; su historial conserva compras y respaldos. El tipo permite seleccionar sugerencias (tienda, almacén, distribuidora, etc.) o escribir un valor propio, y aparece en la tabla, búsqueda y PDF. El almacén se vincula automáticamente al del administrador (o al primero disponible para SuperAdmin) y se conserva al editar. La administración solo puede operar en su almacén.

La migración `0011_acoustic_lila_cheney` añade `suppliers.business_type` con valor vacío para registros anteriores, sin alterar sus datos ni compras. Los clientes anteriores pueden seguir guardando y no borran un tipo existente. Para revertir la aplicación puede conservarse esta columna: la versión anterior simplemente la ignora, sin perder los tipos registrados.

Inventario → Registrar compra / reposición exige material, proveedor activo del mismo almacén, factura, descripción literal, fecha, cantidad, costo unitario positivo y entre 1 y 4 respaldos PDF/JPG/PNG de hasta 2 MB cada uno. Lote, vencimiento y observaciones son opcionales. Los archivos se validan por su contenido y se guardan en PostgreSQL; la descarga requiere sesión y permiso sobre el almacén. La operación guarda compra, respaldo, movimiento y stock en una transacción. Los reintentos del mismo formulario no duplican el ingreso. Los ingresos se registran en orden cronológico respecto al último movimiento del material.

PEPS (primero en entrar, primero en salir) asigna entradas según recepción y correlativo por material y almacén. Cada ingreso tiene un código global inmutable E-000001, E-000002, etc.; el código del material identifica el producto y se conserva. Las reservas consumen las entradas más antiguas, combinando varias cuando hace falta. La entrega confirma la reserva sin otro descuento. Los ajustes negativos y aumentos por corrección también aplican PEPS; las reducciones y anulaciones devuelven unidades a sus entradas de origen, liberando primero las últimas asignadas. Los movimientos se desglosan por entrada y su costo original; el costo visible del material es el valor medio de las unidades disponibles, mientras las salidas se valoran por su entrada. Las actas detallan cada entrada, lote, vencimiento, cantidad y costo. Un saldo inicial exige fecha, descripción y costo; se registra como movimiento inicial. Los ejemplos del catálogo tienen stock cero y no representan compras realizadas.

La descripción general, la descripción exacta de factura y las características visibles se guardan separadas. Los movimientos muestran cantidades y valores iniciales, entradas, salidas/reservas y saldo final; periodos diario, semanal (lunes a domingo), mensual, bimestral, trimestral, anual y personalizado. La impresión y el PDF respetan periodo, categoría y búsqueda. Los saldos corresponden al stock disponible: una reserva se contabiliza como salida al aprobar y no se vuelve a descontar al entregar.

Las regionales son La Paz, Cochabamba, Santa Cruz, Oruro, Potosí, Chuquisaca, Tarija, Beni y Pando, según el mapa oficial https://correos.gob.bo/. Las fichas admiten baja y rehabilitación con motivo, conservando el historial. Las personas de baja no pueden enviar nuevas solicitudes ni recibir nuevas autorizaciones/entregas. Solicitudes, fichas y materiales por empleado incluyen filtros por regional.

La autorización puede ser parcial: se conserva la cantidad pedida y se reserva solo la autorizada. Fondo, lote y vencimiento se registran al aprobar, cuando corresponden. Los comprobantes incluyen regional y cantidades pedida/autorizada, sin fecha requerida. El acta incorpora código, glosa, fondo, lote, vencimiento, costos unitario/total y líneas para recepción, entrega, visto bueno y autorización. Los campos históricos desconocidos se identifican como tales.

Migraciones 0008 y 0009: estructuras nuevas, costos, regionales, instantánea de movimientos y autorización parcial. No borran datos existentes. La limpieza local solicitada se ejecutó aparte mediante scripts/reset-warehouse-examples.mts --apply, con respaldo completo obligatorio: retiró 42 materiales, 6 fichas, 14 solicitudes y 3 cuentas exclusivamente de empleado; conservó administradores y auditoría. El catálogo quedó con 29 categorías y 290 ejemplos sin existencias. El script es destructivo y no debe repetirse sobre compras reales.

Verificación adicional: `pnpm exec tsx tests/stock-report.ts`, `node --experimental-vm-modules tests/warehouse-purchasing.mjs` y `node tests/warehouse-integration.mjs`. Las pruebas de base usan fixtures temporales y los retiran al finalizar. Para restaurar una copia completa, usar pg_restore sobre una base nueva; conservar respaldos fuera de public y de Git.


## Categorías y submenús del inventario (21/10/2026)

Las categorías tienen código interno abreviado y correlativo (`PUB-001`, `SIF-002`, etc.). La partida original de las imágenes se conserva como referencia separada (`25500`, `25600`, etc.) en el catálogo y en el encabezado de cada submenú. `scripts/recode-categories.mts --apply` actualizó las etiquetas de los 290 materiales con respaldo completo, correspondencia anterior/nuevo y auditoría; no cambia códigos de materiales, stock ni relaciones.

Inventario muestra categorías plegadas inicialmente, con nombre, código, partida y número de materiales. Un clic abre sus objetos y otro clic en el mismo encabezado los oculta. Pueden abrirse varias categorías a la vez. «Mostrar todos los objetos» abre todos los grupos de los resultados actuales; «Ocultar todos» los cierra. La búsqueda encuentra nombre, código de material, categoría y partida, y abre automáticamente las coincidencias. «Solo stock bajo» conserva la agrupación. Los campos extensos de descripción y factura se consultan mediante «Ver descripción y factura» en cada fila. El historial de compras también inicia plegado.

PDF y CSV exportan todos los resultados de búsqueda/stock, incluidas las categorías cerradas, manteniendo la categoría en cada registro. Plegar un grupo es solo una acción visual. Las operaciones de editar, eliminar y comprar mantienen los permisos del almacén.


### Catálogo de ejemplos de oficina y transporte (21/10/2026)

El catálogo local ahora contiene 210 ejemplos físicos en 21 categorías: oficina, operación postal, transporte, uniformes, limpieza y equipos. Las 29 categorías de referencia conservan sus códigos; las de alimentos, servicios, agricultura, construcción, cocina e instrumental médico quedan sin ejemplos precargados. No se asignan existencias, precios ni facturas ficticias.

`pnpm exec tsx scripts/refresh-warehouse-examples.mts --apply` crea un respaldo completo y reemplaza exclusivamente los ejemplos originales sin existencias, costos, cambios manuales ni historial. Conserva materiales operativos y cuentas; repetirlo con el catálogo ya actualizado no cambia los registros. Los códigos de los ejemplos usan iniciales y números consecutivos. El script general de reinicio también utiliza este catálogo, pero sigue siendo una limpieza destructiva independiente.

## Transición a PEPS (22/10/2026)

La migración 0012 añade entradas, asignaciones y referencias en movimientos, sin renumerar materiales ni modificar saldos, costos o movimientos históricos. El stock existente se conserva como «Saldo previo a PEPS», sin atribuirle lotes que no se conocen. Las reservas y entregas vigentes anteriores reciben asignaciones de transición a su costo histórico para poder corregirlas o anularlas. Los informes anteriores conservan su valoración original. Los correlativos pueden tener saltos si una transacción se revierte; nunca se reutilizan ni se renumeran entradas.

Inventario → Entradas y saldo por orden PEPS permite revisar recepción, origen, disponibilidad y costo. El lote del proveedor y el código interno de entrada son datos distintos. La fecha de factura se conserva para informes; las compras posteriores se ordenan por su recepción real. Los registros de bienes previos de empleados no representan entradas/salidas del almacén y no descuentan stock.

Se verifican aislamiento por almacén, entradas concurrentes/reintentos, salidas con varias entradas, reservas simultáneas, correcciones, anulaciones, ajustes y preservación del legado. Para revertir antes de usar PEPS puede mantenerse el esquema adicional sin borrarlo. Después de registrar operaciones PEPS, detener las escrituras y conservar entradas/asignaciones: no desplegar el escritor anterior sin reconciliar sus saldos y movimientos; la reversión debe preservar la trazabilidad y las valoraciones históricas.

## Orden alfabético y recodificación (22/10/2026)

Las categorías se ordenan por nombre en español antes de asignar sus códigos internos: CAL-001 · Calzados, CL-002 · Combustible y lubricantes, etc. Las partidas de referencia permanecen vinculadas a su categoría original. Se reconocen tanto las etiquetas anteriores como las actuales. Dentro de cada categoría, los materiales se muestran por nombre; las búsquedas públicas también se ordenan por nombre y los informes siguen el orden categoría/nombre.

Se recodificaron los 210 materiales existentes después de ordenar por categoría y nombre, con correlativo global único. Las nuevas altas toman el siguiente correlativo y no renumeran los códigos ya asignados; la presentación se mantiene alfabética. La recodificación explícita se ejecuta con scripts/recode-materials.mts --apply, respaldando PostgreSQL y guardando la correspondencia anterior/nueva y categorías anteriores de bienes registrados. Verifica que solo cambien códigos y etiquetas; conserva IDs, saldos, PEPS, compras, solicitudes y movimientos. Para revertir, usar la correspondencia del respaldo en una transacción con bloqueo, liberar códigos temporalmente para evitar colisiones y restaurar códigos/categorías por sus IDs; no borrar ni recrear materiales.

## Menú y perfil (22/10/2026)

Se elimina la tarjeta «Cada material cuenta» del lateral. El perfil al pie del menú abre un desplegable con identidad, rol y Cerrar sesión; conserva el cierre de sesión por pestaña y sus errores. Funciona mediante clic, Enter y Escape, con foco visible y vista móvil superpuesta. Los iconos del lateral se simplifican sin fondos adicionales. El amarillo base de la interfaz es #FECB34 (RGB 254, 203, 52), muestreado del fondo dominante de public/brand/correos-logo-official.png; barras y botones principales comparten el mismo token. Los estados de hover y fondos suaves usan variantes del color. Se corrigen la prioridad del lateral sobre su fondo móvil y el ancho compacto de 82 px. El indicador de desarrollo se configura abajo a la derecha para evitar que cubra el perfil; el cambio requiere el siguiente inicio del servidor.

## Firmas del comprobante de solicitud (22/10/2026)

El comprobante coloca «Firma del solicitante» y «Visto bueno / autorizado por» en dos columnas al pie de la última página, con líneas independientes y espacio para firma y sello. No aparecen como filas de la tabla. Si el contenido invade el espacio de firma, se agrega una página conservando encabezado, referencia y paginación. El comprobante habitual y el aprobado caben en una hoja A4; los textos extensos se paginan sin superposición.

## Fichas sin materiales en Materiales por empleado (23/10/2026)

La vista incluye todas las fichas de empleados recibidas para el almacén y regional seleccionados, aunque no tengan materiales previos ni entregas confirmadas. Muestra «Sin materiales registrados» con cantidad cero y permite abrir el formulario con ese empleado preseleccionado. Las fichas inactivas siguen visibles, pero requieren rehabilitación antes de registrar material. Las solicitudes pendientes no se cuentan como materiales recibidos. La búsqueda por nombre, CI, regional, cargo o unidad y el filtro de empleado se aplican también a estas fichas. Una búsqueda que no coincide con un material existente no convierte a su propietario en un empleado sin materiales. El PDF exporta las mismas fichas vacías como estado informativo; no se crean asignaciones ni movimientos de stock.
# Impresión compacta de inventario (23/10/2026)

- El informe de inventario conserva todas las columnas en una tabla A4 horizontal, con anchos según el contenido y menos espacio interno en las celdas.
- Título, fecha, cantidad de registros y filtros aparecen solo en la primera página. Las continuaciones mantienen logos institucionales, encabezados de columnas y numeración, y comienzan la tabla debajo de los logos.
- Las actas con firmas y los comprobantes de solicitud conservan su estructura. La prueba de PDF incluye 210 materiales, comprueba que ninguno se duplique o se pierda y que las continuaciones conserven todas las columnas.

# Compras y reposiciones con varios materiales (26/10/2026)

- Una compra permite de 1 a 50 líneas del mismo almacén, con proveedor activo, número de factura, fecha, observaciones y respaldos comunes. Cada línea conserva material, cantidad, costo, descripción facturada, lote y vencimiento; muestra subtotal y total general.
- El selector de cada línea empieza vacío, permite buscar escribiendo y mantiene el listado de materiales. Se pueden añadir o quitar líneas y repetir un material con lotes o costos diferentes.
- El servidor valida todas las líneas y bloquea los materiales en orden estable. Compra, existencias, entradas PEPS y auditoría se guardan en una transacción; un error revierte todo. La clave de envío evita duplicar la compra completa durante reintentos concurrentes.
- No requiere cambios de esquema: el historial conserva una compra por línea, con su factura, proveedor y respaldo. Se mantiene compatibilidad con formularios anteriores de un material.
- Verificación: `node --experimental-vm-modules tests/warehouse-purchasing.mjs`, con datos temporales y limpieza, comprueba múltiples materiales, lotes repetidos, costos, respaldos, autorización, límite de líneas, rollback, reintentos y concurrencia, además de las pruebas PEPS existentes.

# Proveedores ocasionales en compras (26/10/2026)

- En compra/reposición se elige un proveedor registrado o se escriben los datos de uno nuevo u ocasional. El nombre o razón social del vendedor es obligatorio. NIT, teléfono y tipo se conservan con la compra; el NIT es opcional para una compra ocasional, y obligatorio si se marca «Guardar este proveedor para futuras compras».
- Sin marcar la casilla no se crea ninguna fila en Proveedores. Al marcarla, proveedor y todas las líneas de la compra se guardan en una sola transacción. Reintentos no duplican proveedor ni ingresos, y un NIT ya registrado solicita seleccionar su ficha existente.
- El historial incluye compras ocasionales y muestra los datos del vendedor, con sus respaldos privados. Las compras nuevas conservan una copia de su identificación, incluso si después se edita la ficha del proveedor registrado.
- Migración `0013_next_thor_girl`: agrega `purchases.supplier_details` y permite `supplier_id` nulo solo con vendedor identificado. Las filas anteriores conservan su proveedor, sin modificar compras, existencias, lotes ni movimientos. Respaldo previo: `backups/before-occasional-suppliers-2026-10-26T13-12-47-836Z.dump`; integridad de las seis tablas operativas verificada antes/después.
- Reversión: conservar el lector compatible mientras existan compras ocasionales. No restaurar `NOT NULL` ni quitar los datos del vendedor con compras sin ficha. Para una reversión completa, usar el respaldo previo en una base separada y verificarla antes de sustituir la base en uso.
- Prueba: `node --experimental-vm-modules tests/warehouse-purchasing.mjs` cubre ambas opciones, guardado opcional, NIT duplicado, identidad histórica, autorización, descarga privada, reintentos, rollback y compras de varios materiales.


## Cuadros de conciliación y resumen presupuestario (28/10/2026)

En **Movimientos → Cuadro / reporte**, además de **Detalle de almacenes (Cuadro 6)**, están disponibles:

1. **Conciliación de inventario**: inicial + compras + otros ingresos − salidas/reservas/ajustes negativos = final disponible. Otros ingresos se muestran separados para no atribuir devoluciones o aperturas a compras.
2. **Ingresos al almacén por compras**: una línea por material de factura, con fecha, descripción, proveedor, partida original, factura, entrada PEPS y total. Las compras de varios materiales conservan sus líneas y respaldos en Inventario → Compra/reposición e historial.
3. **Salidas de almacén por partida presupuestaria**: importes agrupados por partida original (32100, 34300, etc.), independiente del código interno de categoría.
4. **Bienes de consumo por partida presupuestaria**: cantidad y valor inicial/final con las fechas del periodo elegido en las columnas.
5. **Resumen de almacenes (bienes de consumo)**: el mismo resumen con PDF que incluye firmas de Contabilidad, Responsable de almacenes y DGAA - DAF. No incorpora código ni versión de formulario no verificados.

Todos respetan periodo, categoría y búsqueda, y los botones Descargar PDF e Imprimir generan el cuadro seleccionado. Sin filtros se incluyen las partidas de referencia sin movimiento con cero; con filtro solo se muestran los resultados pertinentes. Los encabezados y periodos son dinámicos, evitando la mezcla de 2024/2025 de las imágenes. La nota explica que agregar cantidades de unidades diferentes es solo una referencia de conteo.

**Alcance contable**: estos cuadros mantienen el registro vigente de stock disponible: aprobar una reserva ya descuenta existencias; entregar no vuelve a descontar. Las salidas incluyen reservas y ajustes negativos y se explicita en pantalla/PDF. No equivalen a un cierre de existencias físicas ni a una certificación contable firmada. Las categorías son las vinculadas actualmente a cada material. PEPS rige desde su activación; la valoración anterior conserva su historia.

El ODS suministrado es referencia de estructura y cálculo; no se importó como movimientos reales. Sus totales conciliados son 190.151,23 + 287.733,35 − 301.860,80 = 176.023,78 Bs. El archivo contiene referencias externas a otra ubicación y sus cifras no se presumen existentes en la base local.

Verificación: `pnpm typecheck`, ESLint de archivos afectados, `pnpm test`. La prueba `tests/institutional-stock-report.ts` cubre conciliación con devolución separada, partidas originales, filas sin movimiento, filtro, fechas y totales de referencia. Las pruebas PDF cubren firmas y logos en todas las páginas.

## Categorías internas CAT y retiro de partidas de los cuadros (28/10/2026)

Esta sección reemplaza la clasificación operativa descrita anteriormente como partidas de referencia. Por instrucción del usuario, los números de los adjuntos (25600, 32100, 34300, etc.) dejan de aparecer en Inventario, formularios y reportes. También se retira la serie artificial 00000–00028. No se asignan nuevos números como si fueran partidas presupuestarias.

El catálogo contiene 29 categorías internas ordenadas alfabéticamente y numeradas CAT-001 a CAT-029. Ejemplos: CAT-001 · Calzados, CAT-002 · Combustible y lubricantes, CAT-010 · Llantas y neumáticos, CAT-015 · Papel de escritorio. CAT identifica un grupo de materiales del sistema; no representa una partida presupuestaria oficial. Las categorías personalizadas existentes se conservan como texto sin atribuirles una homologación.

Inventario y los selectores muestran las etiquetas CAT. Movimientos ofrece Salidas de almacén por categoría y Bienes de consumo por categoría. PDF y Excel utilizan Categoría; las hojas del libro se llaman Salidas por categoría y Saldos por categoría, con sus fórmulas vinculadas actualizadas. Se mantienen los filtros y cálculos de conciliación, compras y saldos. Los antiguos números y prefijos solo se reconocen como alias de compatibilidad para leer el historial y normalizar formularios antiguos.

La actualización local `pnpm exec tsx scripts/recode-categories.mts --apply` cambió únicamente las categorías de 210 materiales; no había etiquetas de materiales por empleado que actualizar. Respaldo: `backups/before-category-recode-2026-10-28T04-56-39-065Z.dump`. La correspondencia completa y la verificación están en los archivos category-code-mapping y category-recode-verification con la misma fecha. La operación bloquea las tablas y verifica huellas antes/después de siete tablas, excluyendo exclusivamente el campo categoría. Se conservaron códigos e IDs de materiales, existencias, precios, compras, movimientos, pedidos, lotes y asignaciones. Un fallo de preservación revierte la transacción. Repetir el script con todas las categorías ya actualizadas no modifica sus etiquetas.

Las pruebas cubren códigos correlativos, todos los alias, agrupación de etiquetas antiguas/nuevas sin duplicaciones, ausencia de números anteriores en Excel y conservación de totales. No se requiere una migración de esquema.

## Nombre operativo definitivo: partidas PAR (28/10/2026)

Por preferencia expresa del usuario, la denominación visible en todo el sistema es **Partidas**. Este cambio sustituye la denominación Categorías/CAT del apartado anterior. Se conserva el orden alfabético del catálogo y el correlativo: PAR-001 a PAR-029. Ejemplos: PAR-001 · Calzados, PAR-002 · Combustible y lubricantes, PAR-003 · Confecciones textiles, PAR-010 · Llantas y neumáticos y PAR-015 · Papel de escritorio. Son identificadores internos del almacén.

Se actualizan títulos, etiquetas, accesibilidad, filtros, formularios, inventario, materiales por empleado, exportación CSV, PDF y las seis hojas de Excel. Las fórmulas usan las nuevas hojas Salidas por partida y Saldos por partida. Los antiguos códigos CAT y las etiquetas históricas se reconocen como alias y se normalizan a PAR; no crean grupos duplicados. Se mantienen los nombres técnicos de campos y tablas para evitar cambios de esquema innecesarios.

La recodificación utiliza el mismo script con respaldo completo, transacción y comprobación de integridad de siete tablas. Cambia solo el campo de clasificación; no modifica IDs, códigos de materiales, cantidades, costos, compras, lotes, pedidos ni movimientos. Verificación: pnpm typecheck, pnpm test y ESLint de los archivos afectados.
# Solicitud pública de varios materiales (28/10/2026)

- El formulario permite añadir o quitar hasta 20 materiales con cantidades independientes. Los datos del empleado, prioridad y motivo se completan una sola vez. La búsqueda editable y el menú de materiales se mantienen; un material repetido debe reunirse en una sola línea.
- Cada envío genera un comprobante compartido (`group_reference`) y una solicitud por material para que el almacén responda y reserve existencias por separado. El envío completo es transaccional, los reintentos conservan el mismo comprobante y no crean usuarios de empleados ni modifican fichas existentes. Solicitar no descuenta existencias.
- La consulta exige CI y comprobante, devuelve únicamente los materiales de ese envío y conserva la respuesta de cada uno. El PDF incluye todas las líneas, cantidades, estados y respuestas, con firmas al pie de la última página. Los comprobantes anteriores siguen siendo válidos.
- El límite horario conserva 10 envíos por CI y almacén; cada envío admite hasta 20 líneas. El servidor valida cantidades, duplicados, almacén, materiales activos y cierre del formulario antes de registrar las líneas.
- Migración aditiva `0014_yummy_warbound`: columna nullable `group_reference` e índice, sin modificar datos anteriores. Respaldo: `backups/before-multi-material-request-2026-10-28T14-10-07-364Z.dump`. Para revertir la aplicación, mantener el lector compatible con los grupos existentes; no eliminar la agrupación mientras existan comprobantes compartidos. Verificar un respaldo en una base separada antes de cualquier restauración.
- Verificación: pruebas de solicitudes múltiples añadidas a `tests/warehouse-purchasing.mjs` (datos temporales), consulta y privacidad, estados y entregas independientes, rollback, reintentos, límite horario y PEPS; pruebas PDF de 3 y 20 materiales, más la suite habitual.

# Nombres de descarga de cuadros y reportes (28/10/2026)

- PDF y Excel usan el título del cuadro seleccionado, seguido de fecha y hora de generación en Bolivia (hasta segundos): `Conciliación de inventario - 2026-10-28_12-15-12.pdf`. El periodo consultado no se confunde con la fecha de generación.
- La vista de impresión conserva un título legible y ofrece una descarga explícita con el mismo nombre, evitando que el nombre del archivo dependa del identificador temporal de la URL del PDF. Mantiene la impresión automática y permite volver a imprimir desde su cabecera.
- `tests/report-filename.ts` verifica los seis títulos, ambas extensiones, el cambio de fecha por zona horaria, medianoche y nombres compatibles con Windows. Descargas PDF y Excel verificadas en navegador con datos de prueba.

# Rango de fechas y todo el historial (30/10/2026)

- En Movimientos, «Periodo» incluye «Rango de fechas», con calendario/manual para fecha inicial y final, y «Todo el historial». Ambos extremos del rango se incluyen. Fechas vacías o invertidas desactivan descargas e impresión y muestran un aviso.
- Todo el historial toma las fechas reales de movimientos y compras autorizados; no aplica un año inicial arbitrario. Si no hay operaciones, usa la fecha actual de Bolivia. Mantiene los filtros de búsqueda y partida, y el alcance del almacén.
- Pantalla, PDF, impresión y Excel (cuadro seleccionado o todos los cuadros) usan las mismas fechas. Los saldos previos a un rango personalizado siguen contando como apertura, sin alterar las existencias.
- Verificación: pruebas de periodos/saldos, cuadros institucionales y Excel; en navegador se comprobó un rango con una operación, el bloqueo de fechas invertidas y el historial completo con sus tres operaciones de prueba.
