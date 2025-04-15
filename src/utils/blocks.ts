import { Element } from "hast";
import { fromHtml } from "hast-util-from-html";
import { h } from "hastscript";
import { BlockField, BlockFieldGroup } from "types";

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
export function groupFields(modelFields: any): BlockFieldGroup[] {
  const suffixes = ['Alt', 'MimeType', 'Type', 'Text', 'Title'];
  const fields: BlockFieldGroup[] = [];

  modelFields
    .filter((field) => field !== 'classes')
    .forEach((field) => {
      if (field.includes('_')) {
        const groupName = field.split('_')[0];
        const groupObj = fields.find((item) => item.name === groupName) || {
          name: groupName,
          fields: [],
        };

        if (!fields.includes(groupObj)) {
          fields.push(groupObj);
        }

        const suffix = suffixes.find((s) => field.endsWith(s));
        const collapsedName = field.substring(0, field.lastIndexOf(suffix));
        const collapsedField = groupObj.fields.find((item) => item.name === collapsedName);

        if (collapsedField) {
          collapsedField.collapsed = collapsedField.collapsed || [];
          collapsedField.collapsed.push(field);
        } else {
          groupObj.fields.push({name: field, collapsed: []});
        }
      } else {
        const suffix = suffixes.find((s) => field.endsWith(s));
        const groupName = field.substring(0, field.indexOf(suffix));
        let groupObj = fields.find((item) => item.name === groupName);

        if (!groupObj) {
          groupObj = {
            name: field,
            fields: [{name: field, collapsed: []}],
          };
          fields.push(groupObj);
        } else {
          // find the field in the group that has a name that starts with the field.name
          const collapsedField = groupObj.fields.find((item) => field.startsWith(item.name));
          if (!collapsedField) {
            throw new Error(`Unable to find the collapsed field for field: ${field}`);
          }
          collapsedField.collapsed = collapsedField.collapsed || [];
          collapsedField.collapsed.push(field);
        }
      }
    });

  return fields;
}

export function createField(blockJson: any, field: BlockField): Element | null {
  const value = blockJson[field.name];

  if (!value) {
    return null;
  }

  if (value.startsWith('/')) {
    if (value.startsWith('/content/dam/')) {
        const alt = blockJson[`${field.name}Alt`] || '';
        return h('img', { src: value, alt });
    } else {
        const text = blockJson[`${field.name}Text`] || '';
        return h('a', { href: value, text });
    }
  }

  if (value.startsWith('http://') || value.startsWith('https://')|| value.startsWith('mailto:') || value.startsWith('tel:')) {
    const mimeType = field.collapsed.filter((f) => f === `${field.name}MimeType`) ? blockJson[`${field.name}MimeType`] : '';
    if (mimeType?.startsWith('image/')) {
        const alt = blockJson[`${field.name}Alt`] || '';
        return h('img', { src: value, alt });
    } else {
        return h('a', { href: value });
    }
  }

  if (isRichText(value)) {
    return fromHtml(value || '', {fragment: true});
  }


  return h('p', value);
}

function isRichText(value: string) {
  return value.replace(/<[^>]*>/g, '').trim() !== '';
}