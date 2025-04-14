import { OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { PageSchema, ProblemDetailsSchema } from '../schemas';
import {  getAEMContext } from 'utils/ctx';
import { AEMFetchError, fetchAEMJson } from 'utils/aem-fetch';
import { Bindings } from 'types';

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

  async handle(c: { env: Bindings }) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;

    const ctx = getAEMContext(c.env);
    
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
      console.error("Error in page fetch handler:", error);

      if (error instanceof AEMFetchError) {
          if (error.status === 401) {
              // Specific error for AEM 401 Unauthorized
              return new Response(
                  JSON.stringify({ title: "Bad Gateway", status: 502, detail: "This service is not authorized to access AEM." }),
                  { status: 502, headers: { 'Content-Type': 'application/json' } }
              );
          } else {
              // Other AEM fetch errors (e.g., 404 from AEM, 5xx from AEM)
              // Return 502 Bad Gateway as the downstream service failed
              return new Response(
                  JSON.stringify({ title: "Bad Gateway", status: 502, detail: `Failed to fetch data from AEM. Status: ${error.status}.` }),
                  { status: 502, headers: { 'Content-Type': 'application/json' } }
              );
          }
      } else {
          // Generic internal server error for unexpected issues
          return new Response(
              JSON.stringify({ title: "Internal Server Error", status: 500, detail: "An unexpected error occurred." }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
      }
    }


  }
}
