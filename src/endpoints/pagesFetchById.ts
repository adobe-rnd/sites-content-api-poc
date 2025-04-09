import { OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { PageSchema, ProblemDetailsSchema } from '../schemas';
import { AEMContext, getAEMContext } from 'utils/ctx';
import { fetchAEMJson } from 'utils/aem-fetch';
import { Env } from 'types';

export class PagesFetchById extends OpenAPIRoute {
  schema = {
    tags: ['Pages'],
    summary: 'Get a Page by ID',
    request: {
      params: z.object({
        pageId: Str({ description: 'Page identifier' }),
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

  async handle(c: { env: Env }) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;
    const path = atob(pageId);

    const ctx = getAEMContext(c.env);
    const page = await fetchAEMJson(ctx, path);

    // console.log('Page:', page);

    if (!page) {
      return new Response(
        JSON.stringify({
          title: 'Not Found',
          status: 404,
          detail: `Page with ID ${pageId} not found.`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return {
      id: pageId,
      versionInfo: {
        label: 'v1.1',
        description: 'Updated version',
        created: { at: new Date().toISOString(), by: 'editor' },
      },
      siteId: 'site-abc',
      path: `/example/${pageId}`,
      title: `Page ${pageId}`,
      name: pageId,
      description: `Details for page ${pageId}.`,
    };
  }
}
