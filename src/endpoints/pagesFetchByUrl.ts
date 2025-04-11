import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { PageSchema, ProblemDetailsSchema } from "../schemas";
import { determineAemSiteNameByOwnerAndRepo, determinePageInfoByAemSiteNameAndPagePath, PageInfo } from "utils/aem-fetch";
import { getAEMContext } from "utils/ctx";

export class PagesFetchByUrl extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Get a Page by URL",
    description: "Retrieves a page resource based on its public URL.",
    request: {
      query: z.object({
        url: Str({ description: "The full public URL of the page" })
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

    let owner: string | undefined;
    let repo: string | undefined;
    let parsedPath: string | undefined;
    let pagePath: string = '/'; // Declare and initialize outside try block

    try {
      const parsedUrl = new URL(url);
      parsedPath = parsedUrl.pathname;
      const pathSegments = parsedPath.split('/').filter(segment => segment.length > 0); // Filter out empty strings

      const deliveryIndex = pathSegments.indexOf('franklin.delivery');

      if (deliveryIndex !== -1 && pathSegments.length > deliveryIndex + 2) {
        owner = pathSegments[deliveryIndex + 1];
        repo = pathSegments[deliveryIndex + 2];
      } else {
        // URL pattern doesn't match expected structure
        console.error("URL pattern mismatch:", url);
        return new Response(
          JSON.stringify({ title: "Bad Request", status: 400, detail: "Invalid URL structure for extracting organization and site IDs." }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Extract the path after the 'main' segment
      const mainIndex = pathSegments.indexOf('main');
      if (mainIndex !== -1) {
          const remainingSegments = pathSegments.slice(mainIndex + 1);
          // Ensure it starts with '/' and handle empty remaining segments (path is just /main)
          pagePath = '/' + (remainingSegments.length > 0 ? remainingSegments.join('/') : '');
      } else {
          console.warn(`'main' segment not found in URL path: ${parsedPath}. Using root path '/' as fallback.`);
          // Fallback already sets pagePath to '/'
      }

      // Remove .html suffix if present
      if (pagePath.endsWith('.html')) {
        pagePath = pagePath.slice(0, -5);
      }

    } catch (error) {
      console.error("Error parsing URL:", error);
      return new Response(
        JSON.stringify({ title: "Bad Request", status: 400, detail: "Invalid URL provided." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log("Page URL:", url);
    console.log("Extracted owner:", owner);
    console.log("Extracted repo:", repo);
    console.log("Page Path:", pagePath);

    const ctx = getAEMContext(c.env);
    const aemSiteName = await determineAemSiteNameByOwnerAndRepo(ctx, owner, repo);
    console.log("AEM Site Name:", aemSiteName);

    if (!aemSiteName) {
      // Handle case where AEM site name couldn't be determined
      console.error(`Could not determine AEM site name for owner: ${owner}, repo: ${repo}`);
      return new Response(
        JSON.stringify({ title: "Bad Request", status: 400, detail: "Could not determine AEM site configuration." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Call the updated function which now returns PageInfo | null
    const pageInfo: PageInfo | null = await determinePageInfoByAemSiteNameAndPagePath(ctx, aemSiteName, pagePath);

    // Check if pageInfo is null (indicates not found or error during fetch)
    if (!pageInfo) {
      console.warn(`Page not found or failed to fetch details for AEM Site: ${aemSiteName}, Path: ${pagePath}`);
      return new Response(
        JSON.stringify({ title: "Not Found", status: 404, detail: `Page with URL ${url} not found or failed to fetch details.` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const responseBody = pageInfo.toJson();
    responseBody.path = pagePath;
    console.log("responseBody", responseBody);
    return responseBody;
  }
} 