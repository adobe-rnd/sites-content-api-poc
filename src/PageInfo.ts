export class PageInfo {
  pageId: string;
  siteId: string;
  parentPageId: string | null;
  title: string | null;
  description: string | null;
  created: { at: string | null; by: string | null } | null;
  modified: { at: string | null; by: string | null } | null;
  published: { at: string | null; by: string | null } | null;

  constructor(data: {
    pageId: string;
    siteId: string;
    parentPageId?: string | null;
    title?: string | null;
    description?: string | null;
    created?: { at: string | null; by: string | null } | null;
    modified?: { at: string | null; by: string | null } | null;
    published?: { at: string | null; by: string | null } | null;
  }) {
    this.pageId = data.pageId;
    this.siteId = data.siteId;
    this.parentPageId = data.parentPageId ?? null;
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

    if (this.parentPageId !== null) {
      json.parentPageId = this.parentPageId;
    }
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