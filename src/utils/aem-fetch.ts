import { PageInfo } from "../PageInfo";
import { AEMContext } from "./ctx";

export async function fetchAEMJson<T = any>(
  ctx: AEMContext,
  uuid: string,
  depth: number = 1
): Promise<T> {
  const { host, authToken } = ctx;

  const url = new URL(`/_jcr_id/${uuid}.${depth}.json`, `https://${host}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${authToken}`,
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
  const { host, authToken } = ctx;

  const url = new URL(`/${path}.${depth}.json`, `https://${host}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${authToken}`,
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
  const { host, authToken } = ctx;

  // Ensure path starts with a slash for consistency, unless it's empty
  const normalizedPath = path && !path.startsWith('/') ? `/${path}` : path;
  const url = new URL(`${normalizedPath}.1.json`, `https://${host}`);


  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${authToken}`,
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

/**
 * Queries AEM to find the site configuration path based on owner and repo,
 * and extracts the AEM site name from it.
 *
 * @param ctx - The AEM context.
 * @param owner - The value of the 'owner' property to search for.
 * @param repo - The value of the 'repo' property to search for.
 * @returns The AEM site name (e.g., "aem-boilerplate") or null if not found.
 * @throws {AEMFetchError} If the AEM QueryBuilder request fails.
 */
export async function determineAemSiteNameByOwnerAndRepo(
  ctx: AEMContext,
  owner: string,
  repo: string
): Promise<string | null> {
  const { host, authToken } = ctx;

  // Ensure host doesn't end with a slash
  const normalizedAemHost = host.endsWith('/') ? host.slice(0, -1) : host;
  const queryBuilderUrl = `${normalizedAemHost}/bin/querybuilder.json`;

  // Construct query parameters
  const queryParams = new URLSearchParams({
      'path': '/conf',
      'nodename': 'edge-delivery-service-configuration',
      'p.limit': '1',
      'p.hits': 'selective',
      'p.properties': 'jcr:path',
      '1_property': 'jcr:content/owner',
      '1_property.value': owner,
      '2_property': 'jcr:content/repo',
      '2_property.value': repo
  });


  const headers: HeadersInit = {
      'Accept': 'application/json',
  };
  if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
      const response = await fetch(`https://${queryBuilderUrl}?${queryParams.toString()}`, {
          method: 'GET',
          headers: headers,
      });

      if (!response.ok) {
          const errorStatus = response.status;
          const errorStatusText = response.statusText;
          console.error(`Error fetching data from AEM QueryBuilder: ${errorStatus} ${errorStatusText}`);
          let errorBody = '';
          try {
              errorBody = await response.text();
              console.error("QueryBuilder Error body:", errorBody);
          } catch (e) { /* Ignore if reading body fails */ }
          // Throw custom error on fetch failure
          throw new AEMFetchError(`AEM QueryBuilder fetch failed: ${errorStatus} ${errorStatusText}`, errorStatus);
      }

      const data = await response.json() as QueryBuilderResponse;

      if (data && data.success && data.hits && data.hits.length > 0) {
           // Access hit properties safely
          const nodePath: string | undefined = data.hits[0]?.['jcr:path'];
          if (!nodePath) {
             console.warn(`Query successful but 'jcr:path' missing in the first hit for owner=${owner}, repo=${repo}`);
             return null;
          }

          // Expected path format: /conf/aem-boilerplate/settings/cloudconfigs/edge-delivery-service-configuration
          const pathSegments = nodePath.split('/');
          if (pathSegments.length > 2 && pathSegments[0] === '' && pathSegments[1] === 'conf') {
              const aemSiteName = pathSegments[2];
              console.log(`Found AEM site name: ${aemSiteName} for owner=${owner}, repo=${repo}`);
              return aemSiteName;
          } else {
              console.warn(`Unexpected path format received: ${nodePath} for owner=${owner}, repo=${repo}`);
              return null;
          }
      } else {
          console.log(`No AEM site configuration found for owner=${owner}, repo=${repo}. Query Success: ${data?.success}, Hits: ${data?.hits?.length}`);
          return null;
      }
  } catch (error) {
      // Re-throw AEMFetchError if it's already the correct type
      if (error instanceof AEMFetchError) {
          throw error;
      }
      // Handle other errors (e.g., network issues, JSON parsing)
      console.error(`Failed to execute or parse AEM QueryBuilder search for owner=${owner}, repo=${repo}:`, error);
      // Throw a generic error for unexpected issues
      throw new Error(`An unexpected error occurred during AEM site name determination: ${error instanceof Error ? error.message : String(error)}`);
  }
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

/**
 * Determines the site ID (jcr:uuid of the site root) and page ID (jcr:uuid of the page node)
 * using a single AEM QueryBuilder request.
 *
 * @param ctx - The AEM context, containing host and authentication details.
 * @param aemSiteName - The name of the AEM site (e.g., "aem-boilerplate").
 * @param pagePath - The relative path of the page within the site (e.g., "/index" or "/products/cool-widget"). Should start with a slash.
 * @returns An object containing siteId and a page object with pageId, title, and description, or null if either cannot be determined or an error occurs.
 * @throws {AEMFetchError} If the fetch operation fails with a non-2xx status code.
 */
export async function determinePageInfoByAemSiteNameAndPagePath(
  ctx: AEMContext,
  aemSiteName: string,
  pagePath: string
): Promise<PageInfo | null> {
  const { host, authToken } = ctx;

  // Validate inputs
  if (!aemSiteName) {
      console.error("AEM site name is required.");
      return null;
  }
  if (!pagePath || !pagePath.startsWith('/')) {
      console.error(`Invalid page path provided: "${pagePath}". It must start with a '/'.`);
      return null;
  }


  // Ensure host doesn't end with a slash
  const normalizedAemHost = host.endsWith('/') ? host.slice(0, -1) : host;
  const queryBuilderUrl = `${normalizedAemHost}/bin/querybuilder.json`;

  // Define the exact paths we need the UUIDs for
  const siteContentPath = `/content/${aemSiteName}`;
  // Ensure the final page path doesn't have double slashes if aemSiteName already contains parts of the path
  const fullPagePath = `${siteContentPath}${pagePath}`.replace('//','/'); // Basic double slash removal
  const fullParentPath = `${siteContentPath}${pagePath.split('/').slice(0, -1).join('/')}`.replace('//','/'); // Basic double slash removal

  // Construct the QueryBuilder query
  const queryParams = new URLSearchParams({
    'p.limit': '4',             // we fetch 3 results, the site root uuid and the page with its jcr:content node for title and description
    'p.hits': 'selective',      // Only return specified properties
    'p.properties': 'jcr:path jcr:uuid jcr:title jcr:description jcr:created jcr:createdBy cq:lastModified cq:lastModifiedBy cq:lastReplicatedBy_publish cq:lastReplicated_publish', // We need path to identify and uuid
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

  // Conditionally add the parent path condition if it's different from the site root
  if (fullParentPath !== siteContentPath) {
    queryParams.append('group.4_path', fullParentPath);
    queryParams.append('group.4_path.exact', 'true');
  }


  const headers: HeadersInit = {
      'Accept': 'application/json',
  };
  if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
  }

  console.log(`Executing QueryBuilder query for site/page UUIDs. Site: ${siteContentPath}, Page: ${fullPagePath}`);
  const queryBuilderUrlWithParams = `https://${queryBuilderUrl}?${queryParams.toString()}`;
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
          else if (hitPath === fullParentPath) {
              parentPageId = hitUuid || null;
          }
          else if (hitPath === fullPagePath) {
              pageId = hitUuid || null;
          }
          else if (hitPath === fullParentPath) {
              parentPageId = hitUuid || null;
          }
          else if (hitPath === fullPagePath + '/jcr:content') {
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
          console.log(`Successfully determined Site ID: ${siteId}, Page ID: ${pageId}, Title: ${title}, Description: ${description} for Site: ${aemSiteName}, Page Path: ${pagePath}`);

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
          if (!pageId) console.warn(`Could not determine Page ID for path: ${fullPagePath}.`);
          if (!parentPageId) console.warn(`Could not determine Parent Page ID for path: ${fullParentPath}.`);
          console.log("QueryBuilder Hits Received:", data.hits); // Log hits for debugging
          return null;
      }

  } catch (error) {
      // Re-throw AEMFetchError if it's already the correct type
      if (error instanceof AEMFetchError) {
          throw error;
      }
      // Handle other errors (e.g., network issues, JSON parsing)
      console.error(`Failed to execute or parse AEM QueryBuilder search for site/page UUIDs (Site: ${aemSiteName}, Page Path: ${pagePath}):`, error);
      // Optionally, wrap other errors in a generic AEMFetchError or handle differently
      // For now, let's throw a generic error for non-fetch related issues
      throw new Error(`An unexpected error occurred during AEM fetch for site/page info: ${error instanceof Error ? error.message : String(error)}`);
  }
}
