# Patrones de UI y Estética para Almacenes

Guía de referencia rápida para componentes de alta fluidez en el ecosistema AGBC.

## 1. Botones y Micro-interacciones
```css
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 650;
  font-size: 13px;
  letter-spacing: -0.01em;
  background: linear-gradient(135deg, #ffc926, #f2b705);
  color: #0b3b83;
  border: 1px solid rgba(227, 179, 43, 0.6);
  box-shadow: 0 2px 6px -1px rgba(242, 183, 5, 0.35), 0 1px 2px rgba(11, 59, 131, 0.08);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.primary-button:hover:not(:disabled) {
  transform: translateY(-1.5px);
  box-shadow: 0 6px 16px -2px rgba(242, 183, 5, 0.45), 0 2px 4px rgba(11, 59, 131, 0.12);
  filter: brightness(1.03);
}
.primary-button:active:not(:disabled) {
  transform: translateY(0.5px) scale(0.985);
  box-shadow: 0 1px 3px rgba(11, 59, 131, 0.15);
}
```

## 2. Tarjetas de Estadísticas (Stat Cards)
- Borde superior sutil con gradiente interior.
- Efecto de elevación al interactuar.
- Iconos contenidos en burbujas con gradiente suave.
- Cifras en fuente tabular con tracking ajustado.

## 3. Tablas de Inventario y Solicitudes
- Cabecera fija o flotante con contraste nítido y radio superior en la tabla.
- Filas alternadas suaves o filas con iluminación de escaneo al cursor (`tr:hover`).
- Badges redondeados con colores semánticos bien contrastados.
- Paginación y scrollbar delgado (`scrollbar-width: thin`) para ergonomía en pantallas industriales o de escritorio.

## 4. Animaciones de Entrada (View Enter)
- Animación suave tipo slide vertical ascendente de 10px con desvanecimiento.
- Duración óptima: 240ms - 280ms con curva `cubic-bezier(0.16, 1, 0.3, 1)`.
