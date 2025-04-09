import { Env } from "types";



export interface AEMContext {
  host: string;
  authToken: string;
}

export function getAEMContext(env: Env): AEMContext {
  return {
    host: env.AEM_AUTHOR_HOST,
    authToken: env.AEM_API_KEY
    ,
  };
}

