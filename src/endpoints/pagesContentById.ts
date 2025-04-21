import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { ProblemDetailsSchema } from "../schemas";
import { Bindings } from "types";
import { getAEMContext } from "utils/ctx";
import { fetchAEMJson, handleErrors } from "utils/aem-fetch";
import { json2html } from "utils/json2html";
import { determineProgramIdAndEnvId } from "utils/request-context";

export class PagesContentById extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Get the Content of a Page",
    description: "Retrieves the content as an HTML of a specific page.",
    request: {
      params: z.object({
        pageId: Str({ description: "Page identifier" }),
      }),
      headers: z.object({
        'X-ADOBE-ROUTING': z.string().describe('Adobe routing information containing program and environment IDs. Example: ...,program=130360,environment=1272151,...'),
      }),
    },
    responses: {
      "200": {
        description: "The content of the Page.",
        content: {
          "text/html": {
            schema: z.string(),
          },
        },
      },
      "400": {
        description: "Bad Request - Invalid URL format or missing required information",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
      "404": {
        description: "Page not found for the given URL",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
      "502": {
        description: "Bad Gateway - There was an issue with the AEM service",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
    },
  };

  async handle(c: { env: Bindings, req: Request }) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;
    const { programId, envId } = determineProgramIdAndEnvId(data.headers);
    const ctx = getAEMContext(c.env, programId, envId);
    try {
      const page = await fetchAEMJson(ctx, pageId, 7);

      if (!page) {
        return new Response(
          JSON.stringify({ title: "Not Found", status: 404, detail: `Content for page ID ${pageId} not found.` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // make sure the jcr:primaryType is cq:Page and there is a jcr:content node
      if (page['jcr:primaryType'] !== 'cq:Page' || !page['jcr:content'] || page['jcr:content']['sling:resourceType'] !== 'core/franklin/components/page/v1/page') {
        return new Response(
          JSON.stringify({ title: "Not Found", status: 404, detail: `Content for page ID ${pageId} not found.` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const html = json2html(page, ctx);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      return handleErrors(error);
    }
  }
} 