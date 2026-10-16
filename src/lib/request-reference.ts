import { randomBytes } from 'node:crypto';

// 32 caracteres sin 0, 1, I ni O; ocho caracteres aleatorios, sin secuencias predecibles.
const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function createRequestReference() {
  const code=Array.from(randomBytes(8),byte=>alphabet[byte&31]).join('');
  return `SOL-${code.slice(0,4)}-${code.slice(4)}`;
}

export function normalizeRequestReference(value:string) {
  const compact=value.toUpperCase().replace(/[\s-]/g,'');
  if(/^SOL[A-HJ-NP-Z2-9]{8}$/.test(compact))return `SOL-${compact.slice(3,7)}-${compact.slice(7)}`;
  return value.trim(); // Conserva los comprobantes anteriores tal como se emitieron.
}
