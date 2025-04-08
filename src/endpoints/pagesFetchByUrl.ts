import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { PageSchema, ProblemDetailsSchema } from "../schemas";

export class PagesFetchByUrl extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Get a Page by URL",
    description: "Retrieves a page resource based on its public URL.",
    request: {
       // Assuming a 'url' query parameter is needed. Adjust if different.
      query: z.object({
        url: Str({ description: "The full public URL of the page" }),
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
        description: "Page not found for the given URL",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { url } = data.query;
    console.log("Page URL:", url);

    // TODO: Implement actual logic to fetch page by URL
    const pageExists = true; // Replace with actual check

    if (!pageExists) {
      return new Response(
        JSON.stringify({ title: "Not Found", status: 404, detail: `Page with URL ${url} not found.` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract path or derive details from URL if needed for the response
    const path = new URL(url).pathname;
    const name = path.substring(path.lastIndexOf('/') + 1) || 'index';

    return {
      id: `page-for-${name}`,
      versionInfo: { label: "v1.0", description: "Live version", created: { at: new Date().toISOString(), by: "system" } },
      siteId: "site-abc",
      path: path,
      title: `Page for URL ${url}`,
      name: name,
      description: `Details for page at ${url}.`,
    };
  }
} 