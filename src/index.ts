import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PagesList } from "./endpoints/pagesList";
import { PagesFetchById } from "./endpoints/pagesFetchById";
import { PagesFetchByUrl } from "./endpoints/pagesFetchByUrl";
import { PagesContentById } from "./endpoints/pagesContentById";
import { Bindings } from "types";

const API_BASE_PATH = "/adobe/experimental/aspm-expires-20251231";

const app = new Hono<{ Bindings: Bindings }>()

const openapi = fromHono(app, {
	docs_url: "/",
});

// Define specific route before parameterized one
openapi.get(`${API_BASE_PATH}/pages/byUrl`, PagesFetchByUrl);
openapi.get(`${API_BASE_PATH}/pages/:pageId`, PagesFetchById);
openapi.get(`${API_BASE_PATH}/pages/:pageId/content`, PagesContentById);
openapi.get(`${API_BASE_PATH}/pages`, PagesList);

export default app;
