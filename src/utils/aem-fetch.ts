import { AEMContext } from "./ctx";


export async function fetchAEMJson<T = any>(
  ctx: AEMContext,
  path: string,
  depth: number = 1
): Promise<T> {
  const { host, authToken } = ctx;

  const url = new URL(`${path}.${depth}.json`, `https://${host}`);
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`AEM fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
