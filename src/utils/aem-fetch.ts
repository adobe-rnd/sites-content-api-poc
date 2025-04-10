import { AEMContext } from "./ctx";


export async function fetchAEMJson<T = any>(
  ctx: AEMContext,
  uuid: string,
  depth: number = 1
): Promise<T> {
  const { host, authToken } = ctx;
  
  const url = new URL(`/_jcr_id/${uuid}.${depth}.json`, `https://${host}`);
  
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

export async function determineUuidByPath<T = any>(
  ctx: AEMContext,
  path: string
): Promise<T> {
  const { host, authToken } = ctx;
  
  const url = new URL(`${path}.1.json`, `https://${host}`);
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(`AEM fetch failed: ${response.status} ${response.statusText}`);
  } else if (responseJson.jcr.uuid) {
    return responseJson.jcr.uuid;
  } else {
    return null;
  }
}
