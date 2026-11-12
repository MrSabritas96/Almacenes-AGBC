// Conserva el comando de integración para el modelo de solicitudes sin cuentas de empleados.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
try {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./warehouse-public-intake.ts', import.meta.url))], { stdio: 'inherit' });
} catch (error) { process.exitCode = error.status ?? 1; }
