/**
 * Determines the AEM Program ID and Environment ID based on the execution environment,
 * request URL, and request headers.
 *
 * @param environment The current execution environment ('development' or 'production').
 * @param requestUrl The full URL of the incoming request.
 * @param headersObject An object or Headers instance containing request headers.
 * @returns An object containing the programId and envId, or nulls if not found.
 */
export function determineProgramIdAndEnvId(
  environment: string, 
  requestUrl: string | undefined, // Allow undefined URL
  headersObject: any // Keep flexible header type for now
): { programId: string | null; envId: string | null } {
  let programId: string | null = null;
  let envId: string | null = null;

  const displayUrl = requestUrl ?? '[URL not provided]';
  console.log(`Determining IDs. Environment: '${environment}', Request URL: '${displayUrl}'`);

  if (environment === 'production') {
    console.log("Determining IDs in production environment from hostname...");
    try {
      if (requestUrl) { // Check if URL was provided
        const url = new URL(requestUrl);
        const hostname = url.hostname;
        const match = hostname.match(/^author-p(\d+)-e(\d+)\.adobeaemcloud\.com$/);
        if (match && match[1] && match[2]) {
          programId = match[1];
          envId = match[2];
          console.log(`Extracted programId: ${programId}, envId: ${envId} from hostname: ${hostname}`);
        } else {
          console.warn(`Hostname ${hostname} did not match expected production pattern.`);
        }
      } else {
        console.warn("Request URL is missing, cannot determine IDs from hostname.");
      }
    } catch (e) {
        console.error("Error parsing request URL for hostname:", e);
    }
  } else { // Assuming development or other non-production
    console.log("Determining IDs in non-production environment from headers...");
    
    console.log("Headers object received:", headersObject);

    if (!headersObject) {
      console.warn("No headers object provided.");
      // Consider if this should be an error depending on requirements
    } else {
        // Try standard Headers.get method (if headersObject is a Headers instance)
        if (typeof headersObject.get === 'function') {
            console.log("Headers object supports .get() method.");
            programId = headersObject.get('X-CONTENT-API-PROGRAM-ID');
            envId = headersObject.get('X-CONTENT-API-ENV-ID');
        } 
        // Check if headersObject is a plain object (likely from getValidatedData)
        else if (typeof headersObject === 'object' && headersObject !== null) {
             console.log("Accessing headers as plain object properties (case-insensitive).");
             // Normalize keys to lowercase for case-insensitive matching
             const lowerCaseHeaders: { [key: string]: string } = {};
             for (const key in headersObject) {
                 if (Object.prototype.hasOwnProperty.call(headersObject, key)) {
                     // Ensure value is a string before assigning
                     const value = headersObject[key];
                     lowerCaseHeaders[key.toLowerCase()] = typeof value === 'string' ? value : String(value);
                 }
             }
             programId = lowerCaseHeaders['x-content-api-program-id'];
             envId = lowerCaseHeaders['x-content-api-env-id'];
        } else {
            console.warn("Provided headers object structure is unrecognized. Type:", typeof headersObject);
        }
    }

    console.log(`Attempted to read headers. Program ID: ${programId}, Env ID: ${envId}`);
    if (!programId) console.warn("X-CONTENT-API-PROGRAM-ID header not found or is null/empty.");
    if (!envId) console.warn("X-CONTENT-API-ENV-ID header not found or is null/empty.");
  }

  return { programId, envId };
} 