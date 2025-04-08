import { OpenAPIRoute, Str, Num } from "chanfana";
import { z } from "zod";
import { PaginatedPagesListSchema, ProblemDetailsSchema } from "../schemas";

export class PagesList extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "List Pages",
    description: "Lists the Pages of a Site, or the children of a specific Page.",
    request: {
      query: z.object({
        parentPageId: Str({ description: "Filter by parent page identifier", required: false }),
        siteId: Str({ description: "Filter by site identifier", required: false }),
        cursor: Str({ description: "Pagination cursor", required: false }),
        limit: Num({
          description: "Maximum number of items per page",
          default: 50,
          required: false,
        }),
      }),
    },
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: PaginatedPagesListSchema,
          },
        },
      },
       "400": {
         description: "Bad Request (e.g., invalid limit or cursor)",
         content: { "application/json": { schema: ProblemDetailsSchema } },
       },
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    console.log("Query Params:", data.query);
    // TODO: Implement actual logic to fetch pages based on query params
    return {
      cursor: "next-cursor-string", // Provide a cursor if more items exist
      items: [
        {
          id: "page-123",
          versionInfo: { label: "v1.0", description: "Initial version", created: { at: new Date().toISOString(), by: "admin" } },
          siteId: data.query?.siteId || "site-abc",
          parentPageId: data.query?.parentPageId,
          path: "/example/page",
          title: "Example Page",
          name: "page",
          description: "This is a sample page.",
        },
      ],
    };
  }
} 