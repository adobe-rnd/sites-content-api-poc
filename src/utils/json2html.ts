import { h } from 'hastscript';
import { toHtml } from 'hast-util-to-html';
import { fromHtml } from 'hast-util-from-html';
import { format } from 'hast-util-format';

/**
 * Converts AEM JSON content to HTML
 * @param content The AEM JSON content
 * @returns HTML string representation of the content
 */
export function json2html(content: any): string {
  const head = createHead(content);
  const main = createMain(content);
  const doc = createDocument(head, main, content.htmlLang);
  format(doc);
  return toHtml(doc as any, {
    upperDoctype: true,
  });
}

function createDocument(head: any, main: any, htmlLang: string) {
  return {
    type: 'root',
    children: [
      { type: 'doctype' },
      h('html', htmlLang ? { lang: htmlLang } : null, [
        h('head', [head]),
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
            case 'core/franklin/components/image/v1/image':
                section.children.push(h('img', { src: value.image, alt: value.imageAlt }));
                break;
            case 'core/franklin/components/button/v1/button':
                const buttonType = value.linkType || 'link';
                switch (buttonType) {
                    case 'primary':
                        section.children.push(h('strong', h('a', { href: value.link as string }, value.linkText as string)));
                        break;
                    case 'secondary':
                        section.children.push(h('em', h('a', { href: value.link }, value.linkText)));
                        break;
                    default:
                        section.children.push(h('a', { href: value.link }, value.linkText));
                        break;
                }
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
