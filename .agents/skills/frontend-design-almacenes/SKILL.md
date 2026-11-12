---
name: frontend-design-almacenes
description: >-
  Directrices de diseño visual, fluidez, micro-interacciones, ergonomía táctil y animaciones
  para sistemas de inventario y gestión de almacenes institucionales (AGBC / Correos de Bolivia).
  Aplica estándares de alta densidad de información, contraste accesible, físicas de animación
  fluidas, componentes glassmórficos y estados visuales intuitivos para operadores de almacén.
---

# Skill: Diseño Frontend, Fluidez y Animaciones para Almacenes

Esta skill define el sistema de diseño visual, transiciones fluidas, ergonomía de escaneo y animaciones
para el sistema de inventario y almacenes de la Agencia Boliviana de Correos (AGBC).

## 1. Identidad Visual y Paleta Cromática

El sistema integra la seriedad institucional postal con modernidad, profundidad y jerarquía:

- **Azul Institucional Postal Principal (`--postal-blue`, `--postal-navy`)**: `#0b3b83` / `#102b4a`. Transmite autoridad, orden y estabilidad.
- **Amarillo Postal Acento (`--postal-yellow`)**: `#ffc400` / `#fecb34` con reflejos ámbar suaves `#f5bc19` y fondos crema atenuados `#fffbf0`.
- **Fondos de Superficie con Profundidad**: Gradientes radiales y lineales suaves (`radial-gradient(ellipse at 50% 0%, #ffffff 0%, #f4f7fb 100%)`) que evitan el blanco plano o fatiga visual en jornadas operativas prolongadas.
- **Micro-Bordes y Elevaciones**: Uso de bordes sutiles `rgba(16, 43, 74, 0.08)` y sombras multicapa difusas `0 4px 20px -2px rgba(16, 43, 74, 0.06), 0 2px 6px -1px rgba(16, 43, 74, 0.04)`.

## 2. Fluidez y Físicas de Animación

Toda transición debe sentirse instantánea pero orgánica:
- **Curva de aceleración natural**: `cubic-bezier(0.16, 1, 0.3, 1)` (spring-like ease-out).
- **Duraciones de micro-interacción**:
  - Hover / Focus: `150ms - 200ms`.
  - Transiciones de pestaña / paneles: `220ms - 300ms`.
  - Apertura de modales / diálogos: `220ms` con escala desde `0.975` a `1.0`.
  - Cierre: `140ms - 180ms`.
- **Efecto háptico visual (Tactile feedback)**:
  - Botones y tarjetas al hacer click (`:active`): `transform: scale(0.985) translateY(1px)`.
  - Elevación al pasar el cursor (`:hover`): `transform: translateY(-2px)` con incremento suave de sombra.
- **Respeto a Accesibilidad**:
  - Soporte estricto para `@media (prefers-reduced-motion: reduce)` desactivando movimientos o reemplazándolos con sutiles desvanecimientos instantáneos de opacidad.

## 3. Ergonomía de Tablas y Datos de Almacén

Los almacenes manejan miles de códigos, referencias y cantidades críticas:
- **Lectura Escaneable**: Tipografía monoespaciada para códigos y comprobantes (`font-mono`, `letter-spacing: 0.04em`).
- **Números Tabulares**: `font-variant-numeric: tabular-nums` para que columnas de cantidades y monedas permanezcan perfectamente alineadas.
- **Indicador de fila activa**: Hover con iluminación suave y borde izquierdo acentuado para evitar saltos de línea visual al verificar pedidos o despachos.
- **Badges de Estado con Indicador de Pulso**:
  - Pendiente / Espera: Amarillo / Ámbar cálido con pulso tenue.
  - Aprobado / Listo para recojo: Azul zafiro nítido con check.
  - Entregado: Verde esmeralda institucional.
  - Rechazado / Sin stock: Rojo frambuesa / carmesí suave.

## 4. Paneles y Modales Glassmórficos

- **Backdrops**: `backdrop-filter: blur(8px)` con oscurecimiento balanceado (`rgba(16, 43, 74, 0.5)`).
- **Diálogos con bordes iluminados**: Esquinas redondeadas (`16px`), cabecera con separación nítida, y botón de acción primario con foco destacado.
- **Barras de herramientas adhesivas (Sticky Toolbars)**: Los controles y búsquedas quedan disponibles sin tapar las primeras filas de datos.

## 5. Referencias y Guías Detalladas

Para directrices de componentes específicos y patrones de CSS, consultar:
- [Patrones UI de Almacenes](./references/warehouse-ui-patterns.md)
