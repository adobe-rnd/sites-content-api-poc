import { OpenAPIRoute, Str, Num, Enumeration } from "chanfana";
import { z } from "zod";
import { PaginatedPagesListSchema, ProblemDetailsSchema } from "../schemas";
import { determineProgramIdAndEnvId } from "utils/request-context";
import { determineAemSiteNameBySiteId, determinePageInfoByAemSiteNameAndPagePath } from "utils/aem-fetch";
import { handleErrors } from "utils/aem-fetch";
import { getAEMContext } from "utils/ctx";
import { PageInfo } from "PageInfo";

export class PagesList extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "List Pages",
    description: "Lists the Pages of a Site, or the children of a specific Page.",
    request: {
      query: z.object({
        parentPageId: Str({ description: "Filter by parent page identifier", required: false }),
        siteId: Str({ description: "Filter by site identifier. Example: 1534567d-9937-4e40-85ff-369a8ed45367", required: false }),
        path: Str({ description: "Filter by path. The type of matching is controlled by `pathMatchType`.", required: false }),
        pathMatchType: Enumeration({ description: "How to match the `path`. 'exact' for exact match, 'prefix' for prefix match.", values: ['exact', 'prefix'], default: 'exact', required: false }),
        cursor: Str({ description: "Pagination cursor", required: false }),
        limit: Num({
          description: "Maximum number of items per page",
          default: 50,
          required: false,
        }),
      }),
      headers: z.object({
        'X-CONTENT-API-PROGRAM-ID': z.string().optional().describe('Required for local development. The AEM Cloud Manager Program ID. Example: 130360'),
        'X-CONTENT-API-ENV-ID': z.string().optional().describe('Required for local development. The AEM Cloud Manager Environment ID. Example: 1272151'),
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
    console.log("Validated Data (Query):", data.query);
    console.log("Validated Data (Headers):", data.headers);
    
    const { parentPageId, siteId, path, pathMatchType, cursor, limit } = data.query;

    const { programId, envId } = determineProgramIdAndEnvId(
      c.env.ENVIRONMENT, 
      c.request?.url,
      data.headers
    );
    console.log("programId:", programId);
    console.log("envId:", envId);
    const ctx = getAEMContext(c.env, programId, envId);

    try {
        const aemSiteName = await determineAemSiteNameBySiteId(ctx, siteId);
        const pageInfo: PageInfo | null = await determinePageInfoByAemSiteNameAndPagePath(ctx, aemSiteName, path);

        if (!pageInfo) {
          console.warn(`Page not found (logic check) for AEM Site: ${siteId}, Path: ${path}`);
          return new Response(JSON.stringify({ items: []}));
        }

        const responseBody = pageInfo.toJson();
        responseBody.path = path; 
        console.log("responseBody", responseBody);
        return responseBody;

    } catch (error) {
        return handleErrors(error);
    }

    
    // TODO: Implement actual logic to fetch pages based on query params,
    // using `path` and `pathMatchType` for filtering.
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