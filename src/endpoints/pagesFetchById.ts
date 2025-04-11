import { OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { PageSchema, ProblemDetailsSchema } from '../schemas';
import {  getAEMContext } from 'utils/ctx';
import { fetchAEMJson } from 'utils/aem-fetch';
import { Bindings } from 'types';

export class PagesFetchById extends OpenAPIRoute {
  schema = {
    tags: ['Pages'],
    summary: 'Get a Page by ID',
    request: {
      params: z.object({
        pageId: Str({ description: 'Page identifier' }),
      }),
    },
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: PageSchema,
          },
        },
      },
      '404': {
        description: 'Page not found',
        content: { 'application/json': { schema: ProblemDetailsSchema } },
      },
    },
  };

  async handle(c: { env: Bindings }) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { pageId } = data.params;

    const ctx = getAEMContext(c.env);
    const page = await fetchAEMJson(ctx, pageId);

    console.log('Page:', page);

    if (!page) {
      return new Response(
        JSON.stringify({
          title: 'Not Found',
          status: 404,
          detail: `Page with ID ${pageId} not found.`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetPage = mapAemPageToTarget(page, 'site-abc', null);

    return targetPage;
  }
}

/**
 * Interface representing the relevant parts of the input AEM page JSON.
 */
interface AemPageContent {
  'jcr:path': string;
  'jcr:uuid': string;
  'jcr:title': string;
  'cq:template': string;
  'jcr:description': string;
  [key: string]: any; // Allow other properties
}

/**
 * Interface representing a single metadata item.
 */
interface MetadataItem {
  key: string;
  value: string;
}

/**
 * Interface representing the target page structure.
 */
interface TargetPage {
  id: string;
  siteId: string;
  parentPageId: string | null;
  path: string;
  title: string;
  name: string;
  description?: string;
  templateId: string;
  metadata: MetadataItem[]; // Add the optional metadata property
}

/**
 * Maps an AEM page content JSON object to the target page structure.
 *
 * @param aemPage - The input AEM page content object.
 * @param siteId - The ID of the site this page belongs to.
 * @param parentPageId - The ID of the parent page, or null if it's a root page.
 * @returns The mapped page object conforming to the TargetPage interface.
 */
function mapAemPageToTarget(
  aemPage: AemPageContent,
  siteId: string,
  parentPageId: string | null
): TargetPage {
  if (!aemPage || typeof aemPage !== 'object') {
    throw new Error('Invalid input: aemPage must be an object.');
  }

  // Individually check for required AEM properties
  const requiredKeys: (keyof AemPageContent)[] = ['jcr:uuid', 'jcr:title', 'jcr:description', 'cq:template'];
  for (const key of requiredKeys) {
    if (!aemPage[key]) {
      throw new Error(`Invalid input: Missing required AEM property '${key}'.`);
    }
  }

  const pagePathWithContent = aemPage['jcr:path'];
  const pagePath = pagePathWithContent.replace(/\/jcr:content$/, ''); // Remove trailing /jcr:content

  // Extract the page name (last segment of the path)
  const name = pagePath.substring(pagePath.lastIndexOf('/') + 1);

  // Derive the relative path within the site
  // Assumes path structure like /content/<siteName>/<actual/path>
  let relativePath = '/'; // Default for site root
  const contentSlashIndex = pagePath.indexOf('/'); // Should be 0
  const siteNameSlashIndex = pagePath.indexOf('/', contentSlashIndex + 1); // Index of slash after /content
  if (siteNameSlashIndex !== -1) {
      const siteRootPathIndex = pagePath.indexOf('/', siteNameSlashIndex + 1); // Index of slash after /content/<siteName>
      if (siteRootPathIndex !== -1) {
          relativePath = pagePath.substring(siteRootPathIndex);
      }
      // If siteRootPathIndex is -1, it means the path is just /content/<siteName>,
      // so the relative path remains '/' which is correct.
  } else {
      console.warn(`Could not determine site root structure from path: ${pagePath}. Defaulting relative path to '/'.`);
  }


  const mappedPage: TargetPage = {
    id: aemPage['jcr:uuid'],
    siteId: siteId,
    parentPageId: parentPageId,
    path: relativePath,
    title: aemPage['jcr:title'],
    name: name,
    templateId: aemPage['cq:template'],
  };

  // Add description if it exists in the source
  if (aemPage['jcr:description']) {
    mappedPage.description = aemPage['jcr:description'];
  }

  return mappedPage;
}

// Example Usage with your provided snippet data:
const aemPageData: AemPageContent = {
  'jcr:path': '/content/aem-boilerplate/index/jcr:content',
  'cq:lastModified': 'Tue Nov 12 2024 07:44:48 GMT+0000',
  'sling:resourceType': 'core/franklin/components/page/v1/page',
  'jcr:baseVersion': '6e27159e-6574-41d2-9e01-0155d91d1d59',
  'jcr:primaryType': 'cq:PageContent',
  'jcr:title': 'Index',
  'cq:lastReplicatedBy': 'workflow-process-service',
  'cq:lastReplicated_publish': 'Thu Mar 27 2025 13:38:51 GMT+0000',
  'jcr:uuid': 'b775564f-af20-4d64-8ea4-2d3ce0c8f788', // Example UUID
  'cq:lastModifiedBy': 'drudolph@adobe.com',
  'cq:lastReplicationAction_publish': 'Activate',
  'jcr:mixinTypes': [ 'mix:versionable', 'cq:ReplicationStatus2' ],
  'jcr:isCheckedOut': true,
  'jcr:createdBy': 'drudolph@adobe.com',
  'jcr:created': 'Fri Mar 08 2024 11:32:54 GMT+0000',
  'cq:lastReplicationAction': 'Activate',
  'jcr:predecessors': [ '6e27159e-6574-41d2-9e01-0155d91d1d59' ],
  'cq:lastReplicatedBy_publish': 'workflow-process-service',
  'jcr:versionHistory': '4c6403f6-2f8e-476d-8086-6ec5f8517962',
  'cq:isDelivered': false,
  'cq:template': '/libs/core/franklin/templates/page', // Example Template
  'cq:lastReplicated': 'Thu Mar 27 2025 13:38:51 GMT+0000',
  root: {
    'sling:resourceType': 'core/franklin/components/root/v1/root',
    'jcr:primaryType': 'nt:unstructured'
  }
  // 'jcr:description': 'Optional description field' // Uncomment to test description
};

const exampleSiteId = 'aem-boilerplate-site-id'; // Example Site ID
const exampleParentId = 'parent-page-uuid-123'; // Example Parent ID or null

try {
    const targetPageData = mapAemPageToTarget(aemPageData, exampleSiteId, exampleParentId);
    console.log(JSON.stringify(targetPageData, null, 2));
} catch (error) {
    console.error("Error mapping page:", error);
}

// Example with a deeper path
const aemPageDataDeep: AemPageContent = {
    ...aemPageData, // Reuse common properties
    'jcr:path': '/content/aem-boilerplate/articles/travel-2025/jcr:content',
    'jcr:uuid': 'e7b8a6d2-4c3b-4f8b-9b2e-8f2b6a1d3e4f', // From your target example
    'jcr:title': 'Travel Diaries of 2025', // From your target example
    'jcr:description': 'Indulge yourself in the lasted fascinating travel topics.', // From your target example
    'cq:template': '123e4567-e89b-12d3-a456-117711000000', // From your target example
};

try {
    const targetPageDataDeep = mapAemPageToTarget(aemPageDataDeep, exampleSiteId, 'index-page-uuid'); // Parent is now 'index'
    console.log(JSON.stringify(targetPageDataDeep, null, 2));
} catch (error) {
    console.error("Error mapping deep page:", error);
}

// Example with site root path
const aemPageDataRoot: AemPageContent = {
    ...aemPageData, // Reuse common properties
    'jcr:path': '/content/aem-boilerplate/jcr:content', // Path representing the site root content node
    'jcr:uuid': 'site-root-uuid-456',
    'jcr:title': 'AEM Boilerplate Site Root',
    'cq:template': '/libs/core/franklin/templates/site',
};

try {
    const targetPageDataRoot = mapAemPageToTarget(aemPageDataRoot, exampleSiteId, null); // Root page has no parent
    console.log(JSON.stringify(targetPageDataRoot, null, 2));
} catch (error) {
    console.error("Error mapping root page:", error);
}
