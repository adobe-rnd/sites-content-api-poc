import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { ProblemDetailsSchema } from "../schemas";

export class PagesContentById extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Get the Content of a Page",
    description: "Retrieves the JSON content structure of a specific page.",
    request: {
      params: z.object({
        pageId: Str({ description: "Page identifier" }),
      }),
    },
    responses: {
      "200": {
        description: "The content of the Page.",
        content: {
          // Using a generic object schema as defined in the spec
          "application/json": {
            schema: z.object({}).passthrough().describe("Arbitrary JSON content structure of the page"),
          },
        },
      },
      "404": {
        description: "Page not found",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;
    console.log("Page ID for Content:", pageId);

    // TODO: Implement actual logic to fetch page content by ID
    const pageExists = true; // Replace with actual check

    if (!pageExists) {
       return new Response(
        JSON.stringify({ title: "Not Found", status: 404, detail: `Content for page ID ${pageId} not found.` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return example JSON content
    return {
      "jcr:primaryType": "cq:PageContent",
      "jcr:title": `Content for Page ${pageId}`,
      "sling:resourceType": "core/components/page",
      "root": {
        "jcr:primaryType": "nt:unstructured",
        "sling:resourceType": "core/components/container",
        "layout": "responsiveGrid",
        "container": {
           "jcr:primaryType": "nt:unstructured",
           "sling:resourceType": "core/components/container",
           "text": {
               "jcr:primaryType": "nt:unstructured",
               "sling:resourceType": "core/components/text",
               "text": `<p>This is the example content for page ${pageId}.</p>`,
           }
        }
      }
    };
  }
} 