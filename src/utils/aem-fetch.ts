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
    throw new Error(`AEM fetch failed: ${response.status} ${response.statusText}`);
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
): Promise<string | null> { // Return type explicitly includes null
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
       // Log the error response body for debugging
       const errorBody = await response.text();
       console.error(`AEM fetch failed for UUID determination: ${response.status} ${response.statusText}. Path: ${path}. Response: ${errorBody}`);
       // Throwing an error might be too disruptive, returning null might be preferred
       // throw new Error(`AEM fetch failed: ${response.status} ${response.statusText}`);
       return null;
    }

    const responseJson = await response.json() as DetermineUuidResponse;

    // Check if jcr object and uuid exist using optional chaining
    if (responseJson?.jcr?.uuid) {
      return responseJson.jcr.uuid;
    } else {
      console.warn(`Could not determine UUID for path ${path}. 'jcr.uuid' not found in response:`, responseJson);
      return null;
    }
  } catch (error) {
     console.error(`Error during fetch operation for UUID determination at path ${path}:`, error);
     return null; // Return null on fetch or JSON parsing errors
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
 * @returns The AEM site name (e.g., "aem-boilerplate") or null if not found or an error occurs.
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
          console.error(`Error fetching data from AEM QueryBuilder: ${response.status} ${response.statusText}`);
          // Log response body for more details if possible
          try {
              const errorBody = await response.text();
              console.error("Error body:", errorBody);
          } catch (e) {
              // Ignore if reading body fails
          }
          return null;
      }

      // Add type assertion for the response JSON
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
      console.error(`Failed to execute AEM QueryBuilder search for owner=${owner}, repo=${repo}:`, error);
      return null;
  }
}

// Basic type for the page node structure within the site JSON
interface AemPageNode {
  "jcr:uuid": string;
  // other potential properties...
}

// Basic type for the site JSON structure fetched by path
interface AemSiteJson {
  "jcr:uuid": string;
  [pageName: string]: AemPageNode | any; // Allow indexing by pageName, 'any' for simplicity here
}

/**
 * Fetches site and specific page UUIDs from AEM based on site name and page name.
 * @deprecated Use determineSiteIdPageIdByAemSiteNameAndPagePath for a more efficient approach.
 * @param ctx - The AEM context.
 * @param aemSiteName - The name of the AEM site (e.g., "aem-boilerplate").
 * @param pageName - The name of the page within the site (e.g., "index").
 * @returns An object containing the siteId and pageId, or null if an error occurs or data is missing.
 */
export async function determineSiteIdPageIdByAemSiteNameAndPageName(
  ctx: AEMContext,
  aemSiteName: string,
  pageName: string
): Promise<{ siteId: string; pageId: string } | null> {
  const sitePath = `content/${aemSiteName}`;
  try {
    // Fetch the site JSON, assuming depth 1 is sufficient
    // Note: This fetches potentially large JSON just for UUIDs.
    const siteJson = await fetchAEMJsonByPath<AemSiteJson>(ctx, sitePath, 1);

    const siteId = siteJson?.["jcr:uuid"];
    // Access nested page node safely
    const pageNode = siteJson?.[pageName] as AemPageNode | undefined;
    const pageId = pageNode?.["jcr:uuid"];


    if (siteId && pageId) {
      console.log(`(Legacy) Found siteId: ${siteId}, pageId: ${pageId} for site=${aemSiteName}, page=${pageName}`);
      return { siteId, pageId };
    } else {
       // Log more specific reasons for failure
      if (!siteId) console.warn(`(Legacy) Could not determine siteId for site=${aemSiteName}. Missing 'jcr:uuid' at site level.`);
      if (!pageId) console.warn(`(Legacy) Could not determine pageId for page=${pageName} within site=${aemSiteName}. Missing or invalid page node or 'jcr:uuid'.`);
      console.log("(Legacy) Received site JSON:", siteJson); // Log for debugging
      return null;
    }
  } catch (error) {
    console.error(`(Legacy) Failed to fetch or process site/page data for ${sitePath}, page ${pageName}:`, error);
    return null;
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

// Define the PageInfo class
export class PageInfo {
  siteId: string;
  pageId: string;
  title: string | null;
  description: string | null;
  created: { at: string | null; by: string | null } | null;
  modified: { at: string | null; by: string | null } | null;
  published: { at: string | null; by: string | null } | null;

  constructor(data: {
    siteId: string;
    pageId: string;
    title?: string | null;
    description?: string | null;
    created?: { at: string | null; by: string | null } | null;
    modified?: { at: string | null; by: string | null } | null;
    published?: { at: string | null; by: string | null } | null;
  }) {
    this.siteId = data.siteId;
    this.pageId = data.pageId;
    this.title = data.title ?? null;
    this.description = data.description ?? null;
    this.created = data.created ?? null;
    this.modified = data.modified ?? null;
    this.published = data.published ?? null;
  }

  // Method to generate JSON representation, conditionally omitting null properties
  toJson(): { [key: string]: any } { 
    const json: { [key: string]: any } = {
      id: this.pageId, // Map pageId to id
      siteId: this.siteId,
      title: this.title,
    };

    if (this.description !== null) {
      json.description = this.description;
    }
    if (this.created !== null) {
      json.created = this.created;
    }
    if (this.modified !== null) {
      json.modified = this.modified;
    }
    if (this.published !== null) {
      json.published = this.published;
    }

    return json;
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


  // Construct the QueryBuilder query
  const queryParams = new URLSearchParams({
    'p.limit': '3',             // we fetch 3 results, the site root uuid and the page with its jcr:content node for title and description
    'p.hits': 'selective',      // Only return specified properties
    'p.properties': 'jcr:path jcr:uuid jcr:title jcr:description jcr:created jcr:createdBy cq:lastModified cq:lastModifiedBy cq:lastReplicatedBy_publish cq:lastReplicated_publish', // We need path to identify and uuid
    'group.p.or': 'true',       // Combine the following path conditions with OR

    // Condition 1: Match the site root path exactly
    'group.1_path': siteContentPath,
    'group.1_path.exact': 'true',

    // Condition 2: Match the full page path exactly
    'group.2_path': fullPagePath,
    'group.2_path.exact': 'true',
    'group.3_path': fullPagePath + '/jcr:content',
    'group.3_path.exact': 'true',
  });

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
          console.error(`Error fetching site/page UUIDs from AEM QueryBuilder: ${response.status} ${response.statusText}`);
          try {
              const errorBody = await response.text();
              console.error("QueryBuilder Error body:", errorBody);
          } catch (e) { /* Ignore body read error */ }
          return null;
      }

      const data = await response.json() as UuidQueryResponse;

      if (!data || !data.success || !data.hits) {
          console.error(`QueryBuilder query for site/page UUIDs failed or returned unexpected data. Success: ${data?.success}`);
          console.log("QueryBuilder Response:", data);
          return null;
      }

      let siteId: string | null = null;
      let pageId: string | null = null;
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
              siteId = hitUuid || null; // Assign null if uuid is missing
          }
          else if (hitPath === fullPagePath) {
              pageId = hitUuid || null; // Assign null if uuid is missing
          }
          else if (hitPath === fullPagePath + '/jcr:content') {
              title = hitTitle || null; // Assign null if title is missing
              description = hitDescription || null; // Assign null if description is missing
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
              title,
              description,
              created,    
              modified,   
              published 
          });
      } else {
          if (!siteId) console.warn(`Could not determine Site ID for path: ${siteContentPath}.`);
          if (!pageId) console.warn(`Could not determine Page ID for path: ${fullPagePath}.`);
          console.log("QueryBuilder Hits Received:", data.hits); // Log hits for debugging
          return null;
      }

  } catch (error) {
      console.error(`Failed to execute or parse AEM QueryBuilder search for site/page UUIDs (Site: ${aemSiteName}, Page Path: ${pagePath}):`, error);
      return null;
  }
}
