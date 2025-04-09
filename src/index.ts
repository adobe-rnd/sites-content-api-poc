import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PagesList } from "./endpoints/pagesList";
import { PagesFetchById } from "./endpoints/pagesFetchById";
import { PagesFetchByUrl } from "./endpoints/pagesFetchByUrl";
import { PagesContentById } from "./endpoints/pagesContentById";

const app = new Hono();

const openapi = fromHono(app, {
	docs_url: "/",
});



openapi.get("/pages", PagesList);
openapi.get("/pages/:pageId", PagesFetchById);
openapi.get("/pages/byUrl", PagesFetchByUrl);
openapi.get("/pages/:pageId/content", PagesContentById);

export default app;
