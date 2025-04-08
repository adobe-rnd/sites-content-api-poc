import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PagesList } from "./endpoints/pagesList";
import { PagesFetch } from "endpoints/pagesFetch";

const app = new Hono();


const openapi = fromHono(app, {
	docs_url: "/",
});

openapi.get("/pages", PagesList);
openapi.get("/pages/:pageId", PagesFetch);
openapi.get("/pages/byUrl", PagesFetch);
openapi.get("/pages/:pageId/content", PagesList);

export default app;
