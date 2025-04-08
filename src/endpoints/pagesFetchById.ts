import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { PageSchema, ProblemDetailsSchema } from "../schemas";

export class PagesFetchById extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Get a Page by ID",
    request: {
      params: z.object({
        pageId: Str({ description: "Page identifier" }),
      }),
    },
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: PageSchema,
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
    console.log("Page ID:", pageId);

    // TODO: Implement actual logic to fetch page by ID
    const pageExists = true; // Replace with actual check

    if (!pageExists) {
      return new Response(
        JSON.stringify({ title: "Not Found", status: 404, detail: `Page with ID ${pageId} not found.` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return {
      id: pageId,
      versionInfo: { label: "v1.1", description: "Updated version", created: { at: new Date().toISOString(), by: "editor" } },
      siteId: "site-abc",
      path: `/example/${pageId}`,
      title: `Page ${pageId}`,
      name: pageId,
      description: `Details for page ${pageId}.`,
    };
  }
} 