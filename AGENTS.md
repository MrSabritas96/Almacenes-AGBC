# Antigravity Workspace Guidelines: Almacenes AGBC

Este repositorio cuenta con la skill instalada de diseño frontend para almacenes:
- `.agents/skills/frontend-design-almacenes/SKILL.md`

## Reglas de Diseño Estético, Fluidez y Animaciones
1. **Identidad Visual**: Mantener el azul institucional (`#0b3b83`) y amarillo postal (`#ffc400`) con reflejos modernos, bordes pulidos y sombras multicapa sutiles.
2. **Fluidez & Animaciones**: Utilizar curvas de aceleración elásticas (`cubic-bezier(0.16, 1, 0.3, 1)`), micro-interacciones táctiles en hover y click (`:active`), y entradas suaves con `view-enter`.
3. **Ergonomía de Almacén**: Alta legibilidad en tablas, datos numéricos tabulares (`font-variant-numeric: tabular-nums`), badges de estado contrastados y diálogos glassmórficos con backdrop difuminado.
4. **Respeto a Preferencias de Movimiento**: Todo movimiento debe honrar `@media (prefers-reduced-motion: reduce)`.
