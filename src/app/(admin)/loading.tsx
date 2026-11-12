import { PostalLoader } from '@/components/almacenes/postal-loader';

export default function Loading() {
  return <main className="postal-loading-page" aria-busy="true"><PostalLoader size="page" label="Cargando tu espacio de trabajo…"/></main>;
}
