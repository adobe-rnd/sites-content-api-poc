import { h } from 'hastscript';
import { toHtml } from 'hast-util-to-html';
import { fromHtml } from 'hast-util-from-html';

/**
 * Converts AEM JSON content to HTML
 * @param content The AEM JSON content
 * @returns HTML string representation of the content
 */
export function json2html(content: any): string {
  const head = createHead(content);
  const main = createMain(content);
  const doc = createDocument(head, main, content.htmlLang);
  return toHtml(doc, {
    upperDoctype: true,
  });
}

function createDocument(head: any, main: any, htmlLang: string) {
  return {
    type: 'root',
    children: [
      { type: 'doctype' },
      h('html', htmlLang ? { lang: htmlLang } : null, [
        head,
        h('body', [h('header', []), main, h('footer', [])]),
      ]),
    ],
  };
}

function createHead(json: any) {
  const head = [];
  const contentNode = json['jcr:content'];
  if (contentNode) {
    const title = contentNode['jcr:title'];
    if (title) {
      head.push(h('title', title));
    }
    const description = contentNode['jcr:description'];
    if (description) {
      head.push(h('meta', { name: 'description', content: description }));
    }

    // TODO add other meta tags
  }
  return head;
}

function createMain(json: any) {
  const main = h('main');
  const contentNode = json['jcr:content'];

  if (contentNode) {
    const root = contentNode['root'];
    if (root) {
      // Loop through all child objects of root
      for (const [key, value] of Object.entries(root)) {
        // Skip properties that aren't child components
        if (key.startsWith('jcr:') || key === 'sling:resourceType') {
          continue;
        }
        if (typeof value === 'object' && value !== null) {
          main.children.push(createSection(value));
        }
      }
    }
  }

  return main;
}

function createSection(sectionJson: any) {
  if (!sectionJson) return null;

  const section = h('div');

  console.log(sectionJson);
  // section.push(h('div'));

  for (const [key, value] of Object.entries(sectionJson)) {
    if (typeof value === 'object' && value !== null) {
        const type = value['sling:resourceType'];

        switch (type) {
            case 'core/franklin/components/title/v1/title':
                section.children.push(h('h1', value.title || ''));
                break;
            case 'core/franklin/components/text/v1/text':
                section.children.push(fromHtml(value.text || '', {fragment: true}));
                break;
            case 'core/franklin/components/block/v1/block':
                section.children.push(createBlock(value));
                break;
        }

        
    
    }
    
  }
  return section;
}

function createBlock(blockJson: any) {
  const model = blockJson.model;
  if (model) {
    const block = h('div', { class: model });
    return block;
  }
  return null;
}

/**
 * Recursively converts AEM JSON structure to HAST
 * @param node The AEM JSON node to convert
 * @returns HAST node representation
 */
function convertToHast(node: any): any {
  // Handle null or undefined nodes
  if (!node) {
    return null;
  }

  // Handle text content with HTML
  if (node.text && typeof node.text === 'string') {
    return h('div', { innerHTML: node.text });
  }

  // Handle container components
  if (node['sling:resourceType']?.includes('container')) {
    const children = [];

    // Process child components
    for (const [key, value] of Object.entries(node)) {
      // Skip properties that aren't child components
      if (key.startsWith('jcr:') || key === 'sling:resourceType' || key === 'layout') {
        continue;
      }

      if (typeof value === 'object') {
        const childNode = convertToHast(value);
        if (childNode) {
          children.push(childNode);
        }
      }
    }

    return h('div', { class: 'container' }, children);
  }

  // Handle text components
  if (node['sling:resourceType']?.includes('text')) {
    return h('div', { class: 'text-component', innerHTML: node.text });
  }

  // Handle image components
  if (node['sling:resourceType']?.includes('image')) {
    return h('img', {
      src: node.fileReference || '',
      alt: node.alt || '',
      class: 'image-component',
    });
  }

  // Handle root page content
  if (node['jcr:primaryType'] === 'cq:PageContent') {
    // Process the root container if it exists
    if (node.root) {
      return convertToHast(node.root);
    }
  }

  // Default case: create a div with available properties
  const children = [];
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'object') {
      const childNode = convertToHast(value);
      if (childNode) {
        children.push(childNode);
      }
    }
  }

  return children.length > 0 ? h('div', {}, children) : null;
}
