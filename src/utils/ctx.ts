import { Bindings } from "types";



export interface AEMContext {
  authorHost: string;
  publishHost: string;
  authHeader: string;
}

export function getAEMContext(env: Bindings, programId: string, envId: string, authHeader: string): AEMContext {
  return {
    authorHost: `author-p${programId}-e${envId}.adobeaemcloud.com`,
    publishHost: `publish-p${programId}-e${envId}.adobeaemcloud.com`,
    authHeader: authHeader
  };
}

