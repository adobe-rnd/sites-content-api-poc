import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { ProblemDetailsSchema } from "../schemas";
import { Context } from 'hono';

// Define the environment type, referencing the global Env interface from worker-configuration.d.ts
type HonoEnv = {
  Bindings: Env;
}

// Environment variables will be accessed via the context object `c` in the handler

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
          // Using a generic object schema as defined in the spec
          "application/json": {
            schema: z.object({}).passthrough().describe("Arbitrary JSON content structure of the page"),
          },
        },
      },
      "404": { // Kept for consistency, though the current logic doesn't use pageId to check existence
        description: "Page/Content not found (or fetch error)",
        content: { "application/json": { schema: ProblemDetailsSchema } },
      },
      "500": { // Added for server/fetch errors
         description: "Failed to fetch content from AEM",
         content: { "application/json": { schema: ProblemDetailsSchema } },
      }
    },
  };

  async handle(c: Context<HonoEnv>) { // Use Context with the defined environment type
    // Access environment variables/secrets from the context
    const AEM_BEARER_TOKEN = c.env.AEM_BEARER_TOKEN;
    const AEM_CONTENT_URL = "https://author-p130360-e1272151.adobeaemcloud.com/content/aem-boilerplate/index.7.json";

     if (!AEM_BEARER_TOKEN) {
       console.error("AEM_BEARER_TOKEN environment variable not set.");
       return new Response(
         JSON.stringify({ title: "Configuration Error", status: 500, detail: "Server configuration incomplete." }),
         { status: 500, headers: { 'Content-Type': 'application/json' } }
       );
     }
     if (!AEM_CONTENT_URL) {
      console.error("AEM_CONTENT_URL environment variable not set.");
      return new Response(
        JSON.stringify({ title: "Configuration Error", status: 500, detail: "Server configuration incomplete." }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;
    console.log("Requested Page ID for Content:", pageId); // Log the requested ID

    try {
      console.log(`Fetching content from: ${AEM_CONTENT_URL}`);
      const response = await fetch(AEM_CONTENT_URL, {
        headers: {
          'Authorization': `Bearer ${AEM_BEARER_TOKEN}`
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch AEM content. Status: ${response.status} ${response.statusText}`);
        // Attempt to read error body if possible
        let errorDetail = `Failed to fetch content from AEM. Status: ${response.status}`;
        try {
          const errorBody = await response.text();
          console.error("AEM Response Body:", errorBody);
          errorDetail += ` - ${errorBody.substring(0, 100)}`; // Add snippet of body
        } catch (e) {
          console.error("Could not read error response body", e);
        }

        // Decide on appropriate error code. 404 if AEM returned 404, otherwise 500
        const status = response.status === 404 ? 404 : 500;
        const title = response.status === 404 ? "Not Found" : "Internal Server Error";

        return new Response(
          JSON.stringify({ title: title, status: status, detail: errorDetail }),
          { status: status, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const fetchedJson = await response.json();
      console.log("Fetched AEM JSON:", JSON.stringify(fetchedJson, null, 2)); // Log the fetched JSON

      // Return the fetched JSON content
      return new Response(JSON.stringify(fetchedJson), {
         headers: { 'Content-Type': 'application/json' }
      });

    } catch (error: any) {
      console.error("Error fetching or processing AEM content:", error);
      return new Response(
        JSON.stringify({ title: "Internal Server Error", status: 500, detail: `Failed to fetch content: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
} 