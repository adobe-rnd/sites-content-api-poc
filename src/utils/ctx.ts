import { Bindings } from "types";



export interface AEMContext {
  host: string;
  publishHost: string;
  authToken: string;
}

export function getAEMContext(env: Bindings, programId: string, envId: string): AEMContext {
  return {
    host: `author-p${programId}-e${envId}.adobeaemcloud.com`,
    publishHost: `publish-p${programId}-e${envId}.adobeaemcloud.com`,
    authToken: env.AEM_AUTH_TOKEN
  };
}

