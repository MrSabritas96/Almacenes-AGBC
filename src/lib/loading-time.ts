export const MINIMUM_LOADING_MS=1500;

/** La operación y el tiempo visual transcurren a la vez, también cuando falla. */
export async function withMinimumLoading<T>(operation:()=>PromiseLike<T>|T):Promise<T> {
  const [result]=await Promise.allSettled([
    Promise.resolve().then(operation),
    new Promise<void>(resolve=>setTimeout(resolve,MINIMUM_LOADING_MS)),
  ]);
  if(result.status==='rejected')throw result.reason;
  return result.value;
}
