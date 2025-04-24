export type Bindings = {
  WORKER_ENV: string,
  AEM_AUTH_TOKEN: string
}

export type BlockField = { name: string; collapsed: string[] };

export type BlockFieldGroup = {
  name: string;
  fields: BlockField[];
};
