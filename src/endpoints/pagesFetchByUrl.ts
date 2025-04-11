import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { PageSchema, ProblemDetailsSchema } from "../schemas";
import { 
    determineAemSiteNameByOwnerAndRepo, 
    determinePageInfoByAemSiteNameAndPagePath, 
    PageInfo, 
    AEMFetchError
} from "utils/aem-fetch";
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

    const parsedDetails = parseHelixFetchUrl(url);

    if (!parsedDetails) {
      return new Response(
        JSON.stringify({ title: "Bad Request", status: 400, detail: "Invalid URL structure." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.log("parsedDetails:", parsedDetails);

    const { owner, repo, pagePath } = parsedDetails;
    const ctx = getAEMContext(c.env);

    try {
        const aemSiteName = await determineAemSiteNameByOwnerAndRepo(ctx, owner, repo);
        console.log("AEM Site Name:", aemSiteName);
        
        if (!aemSiteName) {
          console.error(`Could not determine AEM site name for owner: ${owner}, repo: ${repo}`);
          // Return 404 as the site config linked to owner/repo wasn't found
          return new Response(
            JSON.stringify({ title: "Not Found", status: 404, detail: "Could not determine AEM site configuration for the given URL." }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // This call can now throw AEMFetchError
        const pageInfo: PageInfo | null = await determinePageInfoByAemSiteNameAndPagePath(ctx, aemSiteName, pagePath);

        // Original logic for pageInfo being null (logical not found, not a fetch error)
        if (!pageInfo) {
          console.warn(`Page not found (logic check) for AEM Site: ${aemSiteName}, Path: ${pagePath}`);
          return new Response(
            JSON.stringify({ title: "Not Found", status: 404, detail: `Page path not found within the determined AEM site for URL ${url}.` }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const responseBody = pageInfo.toJson();
        responseBody.path = pagePath; 
        console.log("responseBody", responseBody);
        return responseBody;

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