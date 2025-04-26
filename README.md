# Sites Content API PoC

This project implements a Proof-of-Concept (PoC) for a Content API focusing on specific page retrieval endpoints:

*   `/pages/byUrl`: Retrieves page data based on its URL.
*   `/pages/{pageId}/content`: Retrieves the content for a specific page identified by its ID.

The primary goal of this PoC is to demonstrate the feasibility of offloading the HTML rendering by reading the Crosswalk specific JCR. This is done by implementing a [Cloudflare Worker](https://workers.cloudflare.com/).

A related Cloudflare Worker responsible for the translation of the external Helix Path into the Content API Path can be found in the [`xwalk-renderer-poc`](https://github.com/adobe-rnd/xwalk-renderer-poc) repository.

This API sits behind the Adobe API Router and handles the endpoints:
* `author-p{programId}-e{envId}.adobeaemcloud.com/adobe/sites`
* `author-p{programId}-e{envId}.adobeaemcloud.com/adobe/pages`

It takes the Authorization token and simply forwards it to the AEM instance. 

## Get started

1. Sign up for [Cloudflare Workers](https://workers.dev). The free tier is more than enough for most use cases.
2. Clone this project and install dependencies with `npm install`
3. Run `wrangler login` to login to your Cloudflare account in wrangler
4. Run `wrangler dev` to start the Content API service locally on port 8787
5. You will need a local development token to access the AEMaaCS instance. You can retrieve one via https://my.cloudmanager.adobe.com/
6. in your `fstab.yaml` (github project) you need to define the mountpoint as follows, with the UUID being the jcr uuid of your /content/{siteName}:
   
   ```
   mountpoints:
     /:
         url: "https://xwalk-renderer-poc.adobeaem.workers.dev/xwalkpages/p<programId>_e<envId>_<UUID of your /content/{siteName}>/main"
         type: "markup"   
   ```
6. You can then use this Content API Service locally by specifying programId, envId and the token. ProgramId & envId need to be set in the url as well as in the header part:

    ```
    curl -X 'GET' \
    'http://localhost:8787/adobe/pages/byUrl?url=https%3A%2F%2Fxwalk-renderer.adobeaem.workers.dev%2Fxwalkpages%2Fp130360_e1272151_1534567d-9937-4e40-85ff-369a8ed45367%2Fmain%2F' \
    -H 'Accept: application/json' \
    -H 'X-Adobe-Routing: program=130360,environment=1272151' \
    -H 'Authorization: Bearer <token>'
    ```

5. When you want to deploy, it to Cloudflare, simply run `wrangler deploy` to publish the API to Cloudflare Workers.

## Project structure

1. Main router is defined in `src/index.ts`.
2. Each endpoint has its own file in `src/endpoints/`.
3. For more information read the [chanfana documentation](https://chanfana.pages.dev/) and [Hono documentation](https://hono.dev/docs).

## Development

1. Run `wrangler dev` to start a local instance of the API.
2. Open `http://localhost:8787/` in your browser to see the Swagger interface where you can try the endpoints.
3. Changes made in the `src/` folder will automatically trigger the server to reload, you only need to refresh the Swagger interface.
