/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { h } from 'hastscript';
import { toHtml } from 'hast-util-to-html';
import { fromHtml } from 'hast-util-from-html';
import { format } from 'hast-util-format';
import { Element, Root } from 'hast';
import { createField, groupFields } from './blocks';

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

function createDocument(head: Element, main: Element, htmlLang: string): Root {
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
  const head = h('head');
  const contentNode = json['jcr:content'];
  if (contentNode) {
    const title = contentNode['jcr:title'];
    if (title) {
      head.children.push(h('title', title));
    }
    const description = contentNode['jcr:description'];
    if (description) {
      head.children.push(h('meta', { name: 'description', content: description }));
    }
    const modifiedTime = contentNode['jcr:lastModified'];
    if (modifiedTime) {
      head.children.push(h('meta', { name: 'modified-time', content: modifiedTime }));
    }
    
    // add additional metadata
    if (contentNode.modelFields) {
      contentNode.modelFields.forEach((field) => {
        const value = contentNode[field];
        if (value) {
          const content = Array.isArray(value) ? value.join(', ') : value;
          head.children.push(h('meta', { name: field, content }));
        }
      });
    }
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
  // add all children to the section
  for (const [key, value] of Object.entries(sectionJson)) {
    if (typeof value === 'object' && value !== null) {
      const type = value['sling:resourceType'];
      switch (type) {
        case 'core/franklin/components/title/v1/title':
          section.children.push(h('h1', value.title || value['jcr:title'] || ''));
          break;
        case 'core/franklin/components/text/v1/text':
          section.children.push(fromHtml(value.text || '', { fragment: true }));
          break;
        case 'core/franklin/components/image/v1/image':
          section.children.push(h('img', { src: value.image || value['fileReference'], alt: value.imageAlt || value.alt }));
          break;
        case 'core/franklin/components/button/v1/button':
          const buttonType = value.linkType || 'link';
          switch (buttonType) {
            case 'primary':
              section.children.push(
                h('strong', h('a', { href: value.link as string }, value.linkText as string))
              );
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

  // add section metadata
  if (sectionJson.modelFields) {
    const block = h('div', { class: 'section-metadata' });
    sectionJson.modelFields.forEach((field) => {
      const value = sectionJson[field];
      if (value) {
        block.children.push(h('div', h('div', field), h('div', value)));
      }
    });
    section.children.push(block);
  }
  return section;
}

function createBlock(blockJson: any) {
  const model = blockJson.model;
  if (model) {
    const block = h('div', { class: model });
    if (blockJson.modelFields) {
      // simple blocks
      const groups = groupFields(blockJson.modelFields);

      groups.forEach((group) => {
        const cell = h('div');
        const row = h('div', cell);
        group.fields.forEach((field) => {
          const fieldElement = createField(blockJson, field);
          if (fieldElement) {
            cell.children.push(fieldElement);
          }
        });
        block.children.push(row);
      });
    } else {
      // container blocks
      const blockItems = Object.entries(blockJson)
        .filter(([key, value]) => typeof value === 'object' && value !== null && value.modelFields)
        .map(([key, value]) => key);

      for (const blockItem of blockItems) {
        const blockItemJson = blockJson[blockItem];
        const groups = groupFields(blockItemJson.modelFields);

        groups.forEach((group) => {
          const fieldElement = createField(blockItemJson, group.fields[0]);
          if (fieldElement) {
            block.children.push(h('div', h('div', fieldElement)));
          }
        });
      }
    }
    return block;
  }
  return null;
}
