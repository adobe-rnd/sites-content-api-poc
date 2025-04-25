import { PageInfo } from "../PageInfo";
import { AEMContext } from "./ctx";

export async function fetchAEMJson<T = any>(
  ctx: AEMContext,
  uuid: string,
  depth: number = 1
): Promise<T> {
  const { authorHost, publishHost, authHeader } = ctx;

  const url = new URL(`/_jcr_id/${uuid}.${depth}.json`, `https://${authorHost}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorStatus = response.status;
    const errorStatusText = response.statusText;
    let errorBody = '';
    try {
        errorBody = await response.text();
    } catch (e) {/* ignore */}
    console.error(`AEM fetch failed: ${errorStatus} ${errorStatusText}. UUID: ${uuid}. Response: ${errorBody}`);
    // Throw custom error on fetch failure
    throw new AEMFetchError(`AEM fetch failed: ${errorStatus} ${errorStatusText}`, errorStatus);
  }
  return response.json();
}

export async function fetchAEMJsonByPath<T = any>(
  ctx: AEMContext,
  path: string,
  depth: number = 1
): Promise<T> {
  const { authorHost, authHeader } = ctx;

  const url = new URL(`/${path}.${depth}.json`, authorHost);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`AEM fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Type definition for the JSON response expected by determineUuidByPath
interface DetermineUuidResponse {
  jcr?: {
    uuid?: string;
  };
  // Allow other properties
  [key: string]: any;
}


export async function determineUuidByPath(
  ctx: AEMContext,
  path: string
): Promise<string | null> { // Return type explicitly includes null for 'not found' cases
  const { authorHost, authHeader } = ctx;

  // Ensure path starts with a slash for consistency, unless it's empty
  const normalizedPath = path && !path.startsWith('/') ? `/${path}` : path;
  const url = new URL(`${normalizedPath}.1.json`, `https://${authorHost}`);


  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    // Check response status before attempting to parse JSON
    if (!response.ok) {
       const errorStatus = response.status;
       const errorStatusText = response.statusText;
       let errorBody = '';
       try {
           errorBody = await response.text();
       } catch (e) {/* ignore */} // Avoid hiding original error if body read fails
       console.error(`AEM fetch failed for UUID determination: ${errorStatus} ${errorStatusText}. Path: ${path}. Response: ${errorBody}`);
       // Throw custom error on fetch failure
       throw new AEMFetchError(`AEM fetch failed for UUID determination: ${errorStatus} ${errorStatusText}`, errorStatus);
    }

    const responseJson = await response.json() as DetermineUuidResponse;

    // Check if jcr object and uuid exist using optional chaining
    if (responseJson?.jcr?.uuid) {
      return responseJson.jcr.uuid;
    } else {
      // UUID not found in a successful response - return null as per original logic
      console.warn(`Could not determine UUID for path ${path}. 'jcr.uuid' not found in response:`, responseJson);
      return null;
    }
  } catch (error) {
     // Re-throw AEMFetchError if it's already the correct type
     if (error instanceof AEMFetchError) {
         throw error;
     }
     // Handle other errors (e.g., network issues, JSON parsing)
     console.error(`Error during fetch or processing for UUID determination at path ${path}:`, error);
     // Throw a generic error for unexpected issues
     throw new Error(`An unexpected error occurred during UUID determination: ${error instanceof Error ? error.message : String(error)}`);
  }
}


// Type definitions for AEM QueryBuilder response structures
interface QueryBuilderHit {
  'jcr:path': string;
  // Allow other properties like jcr:uuid potentially
  [key: string]: any;
}

interface QueryBuilderResponse {
  success: boolean;
  results: number;
  total: number;
  offset: number;
  hits: QueryBuilderHit[];
  // Allow other properties
}


// Type definitions for the new QueryBuilder response
interface UuidHit {
  'jcr:path': string;
  'jcr:uuid'?: string; // UUID might be missing in some cases
}

interface UuidQueryResponse extends QueryBuilderResponse { // Inherits base structure
  hits: UuidHit[]; // Specific hit type
}

export class AEMFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AEMFetchError';
    this.status = status;
  }
}

export function handleErrors(error: unknown): Response {
  console.error("Error occurred:", error);

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

/**
 * Determines the site ID (jcr:uuid of the site root) and page ID (jcr:uuid of the page node)
 * using a single AEM QueryBuilder request.
 *
 * @param ctx - The AEM context, containing host and authentication details.
 * @param aemSiteName - The name of the AEM site (e.g., "aem-boilerplate").
 * @param pagePath - The relative path of the page within the site (e.g., "index" or "products/cool-widget"). Must not start with a slash.
 * @returns An object containing siteId and a page object with pageId, title, and description, or null if either cannot be determined or an error occurs.
 * @throws {AEMFetchError} If the fetch operation fails with a non-2xx status code.
 */
export async function determinePageInfoByAemSiteNameAndPagePath(
  ctx: AEMContext,
  aemSiteName: string,
  pagePath: string
): Promise<PageInfo | null> {
  const { authorHost, authHeader } = ctx;

  // Validate inputs
  if (!aemSiteName) {
      console.error("AEM site name is required.");
      return null;
  }
  if (!pagePath) { // Simplified validation: pagePath just needs to exist
      console.error(`Invalid page path provided: "${pagePath}". Path cannot be empty.`);
      return null;
  }

  const queryBuilderUrl = `https://${authorHost}/bin/querybuilder.json`;

  // Normalize pagePath: remove leading slashes and ensure it starts with exactly one slash for concatenation
  let normalizedPagePath = pagePath;
  while (normalizedPagePath.startsWith('/')) {
    normalizedPagePath = normalizedPagePath.substring(1);
  }
  normalizedPagePath = '/' + normalizedPagePath; // Ensure it starts with a single slash

  // Define the exact paths we need the UUIDs for
  const siteContentPath = `/content/${aemSiteName}`;
  // Ensure the final page path doesn't have double slashes
  const fullPagePath = `${siteContentPath}${normalizedPagePath}`.replace('//','/'); // Basic double slash removal
  // Calculate parent path based on the normalized path
  const parentPathSegments = normalizedPagePath.split('/').slice(1, -1); // remove leading empty string and last segment
  const parentRelativePath = parentPathSegments.length > 0 ? '/' + parentPathSegments.join('/') : '';
  const fullParentPath = `${siteContentPath}${parentRelativePath}`.replace('//','/'); // Basic double slash removal

  // Construct the QueryBuilder query
  const queryParams = new URLSearchParams({
    'p.limit': '4',             // we fetch 4 results, the site root uuid and the page with its jcr:content node for title and description
    'p.hits': 'selective',      // Only return specified properties
    'p.properties': 'jcr:path jcr:uuid jcr:title jcr:description jcr:created jcr:createdBy cq:lastModified cq:lastModifiedBy cq:lastReplicatedBy_publish cq:lastReplicated_publish',
    'group.p.or': 'true',       // Combine the following path conditions with OR

    // Condition 1: needed to fetch the uuid for siteId
    'group.1_path': siteContentPath,
    'group.1_path.exact': 'true',

    // Condition 2: needed to fetch the uuid for pageId
    'group.2_path': fullPagePath,
    'group.2_path.exact': 'true',
    // Condition 3: needed to fetch the title and description for accessed page
    'group.3_path': fullPagePath + '/jcr:content',
    'group.3_path.exact': 'true',
  });

  // Conditionally add the parent path condition if it's different from the site root and not empty
  if (fullParentPath !== siteContentPath && parentRelativePath) {
    queryParams.append('group.4_path', fullParentPath);
    queryParams.append('group.4_path.exact', 'true');
  }


  const headers: HeadersInit = {
      'Accept': 'application/json',
  };
  if (authHeader) {
      headers['Authorization'] = authHeader;
  }

  console.log(`Executing QueryBuilder query for site/page UUIDs. Site: ${siteContentPath}, Page: ${fullPagePath}`);
  const queryBuilderUrlWithParams = `${queryBuilderUrl}?${queryParams.toString()}`;
  console.log(`QueryBuilder URL with params: ${queryBuilderUrlWithParams}`);
  try {
      const response = await fetch(queryBuilderUrlWithParams, {
          method: 'GET',
          headers: headers,
      });

      if (!response.ok) {
          const errorStatus = response.status;
          const errorStatusText = response.statusText;
          console.error(`Error fetching site/page UUIDs from AEM QueryBuilder: ${errorStatus} ${errorStatusText}`);
          let errorBody = '';
          try {
              errorBody = await response.text();
              console.error("QueryBuilder Error body:", errorBody);
          } catch (e) { /* Ignore body read error */ }
          // Throw custom error with status
          throw new AEMFetchError(`AEM QueryBuilder fetch failed: ${errorStatus} ${errorStatusText}. Body: ${errorBody}`, errorStatus);
      }

      const data = await response.json() as UuidQueryResponse;

      if (!data || !data.success || !data.hits) {
          console.error(`QueryBuilder query for site/page UUIDs failed or returned unexpected data. Success: ${data?.success}`);
          console.log("QueryBuilder Response:", data);
          return null;
      }

      let pageId: string | null = null;
      let siteId: string | null = null;
      let parentPageId: string | null = null;
      let title: string | null = null;
      let description: string | null = null;
      let createdAt: string | null = null;
      let createdBy: string | null = null;
      let modifiedAt: string | null = null;
      let modifiedBy: string | null = null;
      let publishedAt: string | null = null;
      let publishedBy: string | null = null;

      // Process hits to find the UUIDs for the specific paths
      for (const hit of data.hits) {
          // Ensure properties exist before accessing
          const hitPath = hit['jcr:path'];
          const hitUuid = hit['jcr:uuid'];
          const hitTitle = hit['jcr:title'];
          const hitDescription = hit['jcr:description'];
          const hitCreatedAt = hit['jcr:created'];
          const hitCreatedBy = hit['jcr:createdBy'];
          const hitModifiedAt = hit['cq:lastModified'];
          const hitModifiedBy = hit['cq:lastModifiedBy'];
          const hitPublishedAt = hit['cq:lastReplicated_publish'];
          const hitPublishedBy = hit['cq:lastReplicatedBy_publish'];

          if (hitPath === siteContentPath) {
              siteId = hitUuid || null;
          }
          else if (fullParentPath !== siteContentPath && hitPath === fullParentPath) { // Check parent path only if it's different
              parentPageId = hitUuid || null;
          }
          else if (hitPath === fullPagePath) { // Use normalized fullPagePath
              pageId = hitUuid || null;
          }
          else if (hitPath === fullPagePath + '/jcr:content') { // Use normalized fullPagePath
              title = hitTitle || null;
              description = hitDescription || null;
              createdAt = hitCreatedAt || null;
              createdBy = hitCreatedBy || null;
              modifiedAt = hitModifiedAt || null;
              modifiedBy = hitModifiedBy || null;
              publishedAt = hitPublishedAt || null;
              publishedBy = hitPublishedBy || null;
          }
      }

      // Validate that both IDs were found
      if (siteId && pageId) {
          console.log(`Successfully determined Site ID: ${siteId}, Page ID: ${pageId}, Title: ${title}, Description: ${description} for Site: ${aemSiteName}, Page Path: ${normalizedPagePath}`); // Log normalized path

          // Construct the created object conditionally
          const created = createdAt ? { at: createdAt, by: createdBy } : null;
          const modified = modifiedAt ? { at: modifiedAt, by: modifiedBy } : null;
          const published = publishedAt ? { at: publishedAt, by: publishedBy } : null;


          // Return an instance of PageInfo
          return new PageInfo({
              pageId,
              siteId,
              parentPageId,
              title,
              description,
              created,    
              modified,   
              published 
          });
      } else {
          if (!siteId) console.warn(`Could not determine Site ID for path: ${siteContentPath}.`);
          if (!pageId) console.warn(`Could not determine Page ID for path: ${fullPagePath}.`); // Use normalized fullPagePath
          if (fullParentPath !== siteContentPath && !parentPageId) console.warn(`Could not determine Parent Page ID for path: ${fullParentPath}.`); // Check only if relevant
          console.log("QueryBuilder Hits Received:", data.hits); // Log hits for debugging
          return null;
      }

  } catch (error) {
      // Re-throw AEMFetchError if it's already the correct type
      if (error instanceof AEMFetchError) {
          throw error;
      }
      // Handle other errors (e.g., network issues, JSON parsing)
      console.error(`Failed to execute or parse AEM QueryBuilder search for site/page UUIDs (Site: ${aemSiteName}, Page Path: ${pagePath}):`, error); // Log original path in error
      // Optionally, wrap other errors in a generic AEMFetchError or handle differently
      // For now, let's throw a generic error for non-fetch related issues
      throw new Error(`An unexpected error occurred during AEM fetch for site/page info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Determines the AEM site name using the site root's JCR UUID (siteId).
 * Uses AEM QueryBuilder to find the node by UUID and retrieve its path.
 *
 * @param ctx - The AEM context.
 * @param siteId - The JCR UUID of the site root node (e.g., /content/site-name).
 * @returns The AEM site name (e.g., "aem-boilerplate") or null if not found or an error occurs.
 * @throws {AEMFetchError} If the AEM QueryBuilder request fails.
 */
export async function determineAemSiteNameBySiteId(
  ctx: AEMContext,
  siteId: string
): Promise<string | null> {
  if (!siteId) {
    console.error("Site ID (UUID) is required.");
    return null;
  }

  const { authorHost, authHeader } = ctx;
  const queryBuilderUrl = `https://${authorHost}/bin/querybuilder.json`;

  // Construct query parameters to find the node by UUID under /content
  const queryParams = new URLSearchParams({
      'path': '/content', // Search under /content, assuming site roots are there
      'property': 'jcr:uuid',
      'property.value': siteId,
      'p.limit': '1',
      'p.hits': 'selective',
      'p.properties': 'jcr:path',
  });

  const headers: HeadersInit = {
      'Accept': 'application/json',
  };
  if (authHeader) {
      headers['Authorization'] = authHeader;
  }
  console.log('headers', headers);
  console.log(`Executing QueryBuilder query to find path for siteId: ${siteId}`);
  const queryBuilderUrlWithParams = `${queryBuilderUrl}?${queryParams.toString()}`;

  try {
      const response = await fetch(queryBuilderUrlWithParams, {
          method: 'GET',
          headers: headers,
      });

      if (!response.ok) {
          const errorStatus = response.status;
          const errorStatusText = response.statusText;
          console.error(`Error fetching path for siteId from AEM QueryBuilder: ${errorStatus} ${errorStatusText}`);
          let errorBody = '';
          try {
              errorBody = await response.text();
              console.error("QueryBuilder Error body:", errorBody);
          } catch (e) { /* Ignore body read error */ }
          throw new AEMFetchError(`AEM QueryBuilder fetch failed for siteId lookup: ${errorStatus} ${errorStatusText}`, errorStatus);
      }

      const data = await response.json() as QueryBuilderResponse; // Reusing existing type

      if (data && data.success && data.hits && data.hits.length > 0) {
          const nodePath: string | undefined = data.hits[0]?.['jcr:path'];

          if (nodePath) {
              // Expected path format: /content/site-name
              const pathSegments = nodePath.split('/');
              // Check if path starts with /content/ and has at least 3 segments ('', 'content', 'site-name')
              if (pathSegments.length >= 3 && pathSegments[0] === '' && pathSegments[1] === 'content') {
                  const aemSiteName = pathSegments[2];
                  console.log(`Determined AEM site name: ${aemSiteName} for site ID: ${siteId}`);
                  return aemSiteName;
              } else {
                  console.warn(`Unexpected path format received from QueryBuilder: ${nodePath} for site ID: ${siteId}`);
                  return null;
              }
          } else {
               console.warn(`QueryBuilder found node for site ID ${siteId}, but 'jcr:path' was missing in the hit.`);
               console.log("QueryBuilder Hit:", data.hits[0]);
               return null;
          }
      } else {
          console.log(`No node found with siteId (UUID): ${siteId} via QueryBuilder. Query Success: ${data?.success}, Hits: ${data?.hits?.length}`);
          return null;
      }
  } catch (error) {
     // Re-throw AEMFetchError if it's already the correct type
     if (error instanceof AEMFetchError) {
         console.error(`AEM QueryBuilder fetch failed while determining site name for site ID ${siteId}:`, error.message, `Status: ${error.status}`);
         throw error; // Re-throw to allow caller to handle specific fetch errors
     }
     // Handle other errors (e.g., network issues, JSON parsing)
     console.error(`Failed to determine AEM site name for site ID ${siteId} via QueryBuilder:`, error);
     // Return null for non-AEMFetch errors, indicating determination failed
     return null;
  }
}
