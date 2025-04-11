import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { PageSchema, ProblemDetailsSchema } from "../schemas";
import { determineAemSiteNameByOwnerAndRepo, determinePageInfoByAemSiteNameAndPagePath, PageInfo } from "utils/aem-fetch";
import { getAEMContext } from "utils/ctx";

// Helper function to parse the Helix Fetch URL
function parseHelixFetchUrl(url: string): { owner: string; repo: string; pagePath: string } | null {
  try {
    const parsedUrl = new URL(url);
    const parsedPath = parsedUrl.pathname;
    const pathSegments = parsedPath.split('/').filter(segment => segment.length > 0);

    const deliveryIndex = pathSegments.indexOf('franklin.delivery');
    let owner: string | undefined;
    let repo: string | undefined;

    if (deliveryIndex !== -1 && pathSegments.length > deliveryIndex + 2) {
      owner = pathSegments[deliveryIndex + 1];
      repo = pathSegments[deliveryIndex + 2];
    } else {
      console.error("URL pattern mismatch for owner/repo extraction:", url);
      return null; // Indicate failure
    }

    let pagePath = '/';
    const mainIndex = pathSegments.indexOf('main');
    if (mainIndex !== -1) {
        const remainingSegments = pathSegments.slice(mainIndex + 1);
        pagePath = '/' + (remainingSegments.length > 0 ? remainingSegments.join('/') : '');
    } else {
        console.warn(`'main' segment not found in URL path: ${parsedPath}. Using root path '/' as fallback.`);
        // Fallback already sets pagePath to '/'
    }

    // Remove .html suffix if present
    if (pagePath.endsWith('.html')) {
      pagePath = pagePath.slice(0, -5);
    }

    if (!owner || !repo) { // Should have been caught earlier, but double-check
        console.error("Failed to extract owner or repo despite passing initial checks.");
        return null;
    }

    return { owner, repo, pagePath };

  } catch (error) {
    console.error("Error parsing URL:", error);
    return null; // Indicate failure due to parsing error
  }
}


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
      "400": {
        description: "Bad Request - Invalid URL format or missing required information",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
    },
  };


  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { url } = data.query;
    console.log("Incoming Page URL:", url);

    // Use the new parsing function
    const parsedDetails = parseHelixFetchUrl(url);

    if (!parsedDetails) {
      // Handle parsing failure
      return new Response(
        JSON.stringify({ title: "Bad Request", status: 400, detail: "Invalid URL structure." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.log("parsedDetails:", parsedDetails);

    const { owner, repo, pagePath } = parsedDetails;
    const ctx = getAEMContext(c.env);
    const aemSiteName = await determineAemSiteNameByOwnerAndRepo(ctx, owner, repo);
    console.log("AEM Site Name:", aemSiteName);
    
    if (!aemSiteName) {
      console.error(`Could not determine AEM site name for owner: ${owner}, repo: ${repo}`);
      return new Response(
        JSON.stringify({ title: "Bad Request", status: 400, detail: "Could not determine AEM site configuration." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const pageInfo: PageInfo | null = await determinePageInfoByAemSiteNameAndPagePath(ctx, aemSiteName, pagePath);

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