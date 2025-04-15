import { OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { PageSchema, ProblemDetailsSchema } from '../schemas';
import {  getAEMContext } from 'utils/ctx';
import { fetchAEMJson, handleErrors } from 'utils/aem-fetch';
import { Bindings } from 'types';
import { determineProgramIdAndEnvId } from 'utils/request-context';

export class PagesFetchById extends OpenAPIRoute {
  schema = {
    tags: ['Pages'],
    summary: 'Get a Page by ID',
    request: {
      params: z.object({
        pageId: Str({ description: 'Page identifier' }),
      }),
      headers: z.object({
        'X-ADOBE-ROUTING': z.string().describe('Adobe routing information containing program and environment IDs. Example: ...,program=130360,environment=1272151,...'),
      }),
    },
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: PageSchema,
          },
        },
      },
      '404': {
        description: 'Page not found',
        content: { 'application/json': { schema: ProblemDetailsSchema } },
      },
    },
  };

  async handle(c: { env: Bindings, req: Request }) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;

    const { programId, envId } = determineProgramIdAndEnvId(data.headers);
    console.log("programId:", programId);
    console.log("envId:", envId);
    const ctx = getAEMContext(c.env, programId, envId);
    try {
      const page = await fetchAEMJson(ctx, pageId);

      console.log('Page:', page);

      // if (!page) {
      //   return new Response(
      //     JSON.stringify({
      //       title: 'Not Found', 
      //       status: 404,
      //       detail: `Page with ID ${pageId} not found.`,
      //     }),
      //     { status: 404, headers: { 'Content-Type': 'application/json' } }
      //   );
      // }
      
      return new Response(
        JSON.stringify({
          title: 'Not implemented', 
          status: 501,
          detail: `Page with ID ${pageId} not implemented.`,
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      return handleErrors(error);
    }
  }
}
