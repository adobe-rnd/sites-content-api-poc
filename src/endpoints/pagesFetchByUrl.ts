import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { PageSchema, ProblemDetailsSchema } from "../schemas";
import { 
    determineAemSiteNameBySiteId, 
    determinePageInfoByAemSiteNameAndPagePath, 
    handleErrors
} from "utils/aem-fetch";
import { getAEMContext } from "../utils/ctx";
import { PageInfo } from "../PageInfo";
import { determineProgramIdAndEnvId } from "../utils/request-context";
import { Bindings } from "types";

export class PagesFetchByUrl extends OpenAPIRoute {
  schema = {
    tags: ["Pages"],
    summary: "Get a Page by URL",
    description: "Retrieves a page resource based on its public URL.",
    request: {
      query: z.object({
        url: Str({ description: "The full public URL of the page, e.g. https://xwalk-renderer.adobeaem.workers.dev/xwalkpages/130360:1272151:1534567d-9937-4e40-85ff-369a8ed45367/main/index.html" })
      }),
      headers: z.object({
        'X-ADOBE-ROUTING': z.string().describe('Adobe routing information containing program and environment IDs. Example: ...,program=130360,environment=1272151,...'),
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
    const { url } = data.query;
    console.log("Incoming Page URL:", url);

    // an xwalk page url looks like this: https://xwalk-renderer.adobeaem.workers.dev/xwalkpages/1534567d-9937-4e40-85ff-369a8ed45367/main/foobar/index.html
    const xwalkPageDetails = parseXWalkPageFetchUrl(url);
    console.log("xwalkPageDetails:", xwalkPageDetails);

    if (!xwalkPageDetails) {
      return new Response(
        JSON.stringify({ title: "Bad Request", status: 400, detail: "Invalid XWalkPage URL structure." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { siteId, pagePath } = xwalkPageDetails;

    const { programId, envId } = determineProgramIdAndEnvId(data.headers);
    console.log("programId:", programId);
    console.log("envId:", envId);
    const ctx = getAEMContext(c.env, programId, envId);
    try {
        const aemSiteName = await determineAemSiteNameBySiteId(ctx, siteId);
        console.log("AEM Site Name:", aemSiteName);
        
        if (!aemSiteName) {
          console.error(`Could not determine AEM site name for siteId: ${siteId}`);
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
        return handleErrors(error);
    }
  }
}

// Path is like this: https://xwalk-renderer.adobeaem.workers.dev/xwalkpagesss/1534567d-9937-4e40-85ff-369a8ed45367/main/foobar/index.html
function parseXWalkPageFetchUrl(url: string): { siteId: string; pagePath: string } | null {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const pathSegments = pathname.split('/').filter(segment => segment.length > 0);

    const xwalkPageIndex = pathSegments.indexOf('xwalkpages');
    if (xwalkPageIndex === -1 || pathSegments.length <= xwalkPageIndex + 1) {
      console.error("URL pattern mismatch: 'xwalkpages' segment not found or no siteId present.", url);
      return null;
    }

    // Site ID is the segment immediately after 'xwalkpages'
    const siteIdSegment = pathSegments[xwalkPageIndex + 1];
    // Extract the UUID part, expected after the last colon if present, or the whole segment
    const siteIdParts = siteIdSegment.split(':');
    const siteId = siteIdParts.length > 0 ? siteIdParts[siteIdParts.length - 1] : ''; // Get the last part

    // Validate UUID format for the extracted siteId
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(siteId)) {
        console.error(`Extracted siteId "${siteId}" from segment "${siteIdSegment}" is not a valid UUID format.`);
        // Fail if the extracted part is not a valid UUID
        return null;
    }


    // Branch segment is after siteId
    if (pathSegments.length <= xwalkPageIndex + 2) {
        console.error("URL pattern mismatch: Branch segment expected after siteId.", url);
        return null;
    }
    const branchIndex = xwalkPageIndex + 2;

    // The rest of the path segments form the pagePath
    const pagePathSegments = pathSegments.slice(branchIndex + 1);
    let pagePath = ''; // Initialize as empty string

    if (pagePathSegments.length > 0) {
        let rawPath = pagePathSegments.join('/'); // Join without leading slash

        // Check if the last segment has an extension
        const lastSegment = pagePathSegments[pagePathSegments.length - 1];
        const lastDotIndex = lastSegment.lastIndexOf('.');

        if (lastDotIndex > 0) { // Ensure dot is not the first character and exists
             // Remove extension from the last segment only
             const lastSegmentWithoutExtension = lastSegment.substring(0, lastDotIndex);
             // Reconstruct the path
             if (pagePathSegments.length > 1) {
                 pagePath = pagePathSegments.slice(0, -1).join('/') + '/' + lastSegmentWithoutExtension;
             } else {
                 pagePath = lastSegmentWithoutExtension;
             }
        } else {
             pagePath = rawPath; // No extension found in the last segment
        }

    } else {
        // No path segments after branch, pagePath remains ''
        console.warn(`No page path segments found after branch segment in URL: ${url}. Using empty path ''.`);
    }


    return { siteId, pagePath };

  } catch (error) {
    console.error("Error parsing XWalkPage URL:", error, url);
    return null; // Indicate failure due to parsing error
  }
}
