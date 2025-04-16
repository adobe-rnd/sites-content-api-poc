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
import { AEMContext } from './ctx';

/**
 * Converts AEM JSON content to HTML
 * @param content The AEM JSON content
 * @returns HTML string representation of the content
 */
export function json2html(content: any, ctx: AEMContext): string {
  const head = createHead(content);
  const main = createMain(content, ctx);
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

function createHead(json: any): Element {
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

function createMain(json: any, ctx: AEMContext): Element {
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
          main.children.push(createSection(value, ctx));
        }
      }
    }
  }

  return main;
}

function createSection(sectionJson: any, ctx: AEMContext): Element {
  if (!sectionJson) return null;

  const section = h('div');
  // add all children to the section
  for (const [key, value] of Object.entries(sectionJson)) {
    if (typeof value === 'object' && value !== null) {
      const type = value['sling:resourceType'];
      switch (type) {
        case 'core/franklin/components/title/v1/title':
          section.children.push(createTitle(value));
          break;
        case 'core/franklin/components/text/v1/text':
          section.children.push(createText(value));
          break;
        case 'core/franklin/components/image/v1/image':
          section.children.push(createImage(value, ctx));
          break;
        case 'core/franklin/components/button/v1/button':
          section.children.push(createButton(value));
          break;
        case 'core/franklin/components/block/v1/block':
          section.children.push(createBlock(value, ctx));
          break;
        case 'core/franklin/components/columns/v1/columns':
          section.children.push(createColumns(value, ctx));
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

function createTitle(jcrJson: any): Element {
  const type = jcrJson.type || jcrJson.titleType || 'h1';
  return h(type, jcrJson.title || jcrJson['jcr:title'] || '');
}

function createText(jcrJson: any): Element {
  return fromHtml(jcrJson.text || '', { fragment: true });
}

function createImage(jcrJson: any, ctx: AEMContext): Element {
  // TODO support image caption via "title"
  let src = jcrJson.image || jcrJson['fileReference'];
  if (src.startsWith('/content/dam/')) {
    src = `https://${ctx.publishHost}${src}`;
  }
  return h('img', { src, alt: jcrJson.imageAlt || jcrJson.alt });
}


function createButton(jcrJson: any, ): Element {
  const buttonType = jcrJson.linkType || 'link';
  let button = h('a', { href: jcrJson.link }, jcrJson.linkText);
  switch (buttonType) {
    case 'primary':
      button = h('strong', h('a', { href: jcrJson.link as string }, jcrJson.linkText as string));
      break;
    case 'secondary':
      button = h('em', h('a', { href: jcrJson.link }, jcrJson.linkText));
      break;
  }
  return button;
}

function createBlock(jsonJson: any, ctx: AEMContext): Element {
  const model = jsonJson.model;
  if (model) {
    const classNames = [model];
    if (jsonJson.classes) {
      classNames.push(...jsonJson.classes.split(','));
    }
    const block = h('div', { class: classNames.join(' ') });
    if (jsonJson.modelFields) {
      // simple blocks
      const groups = groupFields(jsonJson.modelFields);

      groups.forEach((group) => {
        const cell = h('div');
        const row = h('div', cell);
        group.fields.forEach((field) => {
          const fieldElement = createField(jsonJson, field, ctx);
          if (fieldElement) {
            cell.children.push(fieldElement);
          }
        });
        block.children.push(row);
      });
    } else {
      // container blocks
      const blockItems = Object.entries(jsonJson)
        .filter(([key, value]) => typeof value === 'object' && value !== null && value.modelFields)
        .map(([key, value]) => key);

      for (const blockItem of blockItems) {
        const blockItemJson = jsonJson[blockItem];
        const blockRow = h('div');
        const groups = groupFields(blockItemJson.modelFields);
        groups.forEach((group) => {
          const fieldElement = createField(blockItemJson, group.fields[0], ctx);
          if (fieldElement) {
            blockRow.children.push(h('div', fieldElement));
          }
        });
        block.children.push(blockRow);
      }
    }
    return block;
  }
  return null;
}

function createColumns(jcrJson: any, ctx: AEMContext): Element {
  const rows = jcrJson.rows;
  const columns = jcrJson.columns;
  const classNames = ['columns'];
  if (jcrJson.classes) {
    classNames.push(...jcrJson.classes.split(','));
  }
  const block = h('div', { class: classNames.join(' ') });

  Object.entries(jcrJson).filter(([key, value]) => typeof value === 'object' && value !== null).forEach(([key, row]) => {
    const blockRow = h('div'); // the row
    Object.entries(row).filter(([key, value]) => typeof value === 'object' && value !== null).forEach(([key, cell]) => {
      const blockCell = h('div'); // the cell
      Object.entries(cell).filter(([key, value]) => typeof value === 'object' && value !== null).forEach(([key, cellItem]) => {
        const type = cellItem['sling:resourceType'];
        switch (type) {
          case 'core/franklin/components/title/v1/title':
            blockCell.children.push(createTitle(cellItem));
            break;
          case 'core/franklin/components/text/v1/text':
            blockCell.children.push(createText(cellItem));
            break;
          case 'core/franklin/components/image/v1/image':
            blockCell.children.push(createImage(cellItem, ctx));
            break;
        }
      });
      blockRow.children.push(blockCell);
    });
    block.children.push(blockRow);
  });
  return block;
}

