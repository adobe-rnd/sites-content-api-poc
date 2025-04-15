import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PagesList } from "./endpoints/pagesList";
import { PagesFetchById } from "./endpoints/pagesFetchById";
import { PagesFetchByUrl } from "./endpoints/pagesFetchByUrl";
import { PagesContentById } from "./endpoints/pagesContentById";
import { Bindings } from "types";

const app = new Hono<{ Bindings: Bindings }>()

const openapi = fromHono(app, {
	docs_url: "/",
});

// Define specific route before parameterized one
openapi.get(`/adobe/pages/byUrl`, PagesFetchByUrl);
openapi.get(`/adobe/pages/:pageId`, PagesFetchById);
openapi.get(`/adobe/pages/:pageId/content`, PagesContentById);
openapi.get(`/adobe/pages`, PagesList);

export default app;
