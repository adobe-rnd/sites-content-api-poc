import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { ProblemDetailsSchema } from "../schemas";
import { Bindings } from "types";
import { getAEMContext } from "utils/ctx";
import { fetchAEMJson } from "utils/aem-fetch";
import { json2html } from "utils/json2html";

export class PagesContentById extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Get the Content of a Page",
    description: "Retrieves the content as an HTML of a specific page.",
    request: {
      params: z.object({
        pageId: Str({ description: "Page identifier" }),
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
      "404": { // Kept for consistency, though the current logic doesn't use pageId to check existence
        description: "Page/Content not found (or fetch error)",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
    },
  };

  async handle(c: { env: Bindings }) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;
    const path = atob(pageId);

    const ctx = getAEMContext(c.env);
    const page = await fetchAEMJson(ctx, path, 6);

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

    const html = json2html(page);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
} 