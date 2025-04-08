import { fromHono } from "chanfana";
import { Hono } from "hono";
import {
	PagesList,
	PagesFetchById,
	PagesFetchByUrl,
	PagesContentById,
} from "./endpoints/pages";

const app = new Hono();

const openapi = fromHono(app, {
	docs_url: "/",
});

openapi.get("/pages", PagesList);
openapi.get("/pages/:pageId", PagesFetchById);
openapi.get("/pages/byUrl", PagesFetchByUrl);
openapi.get("/pages/:pageId/content", PagesContentById);

export default app;
