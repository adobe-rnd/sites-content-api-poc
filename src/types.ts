export type Bindings = {
  AEM_API_KEY: string,
  ENVIRONMENT: string
}

export type BlockField = { name: string; collapsed: string[] };

export type BlockFieldGroup = {
  name: string;
  fields: BlockField[];
};
