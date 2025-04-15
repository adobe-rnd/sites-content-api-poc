import { Bindings } from "types";



export interface AEMContext {
  host: string;
  authToken: string;
}

export function getAEMContext(env: Bindings, programId: string, envId: string): AEMContext {
  return {
    host: `author-p${programId}-e${envId}.adobeaemcloud.com`,
    authToken: env.AEM_API_KEY
  };
}

