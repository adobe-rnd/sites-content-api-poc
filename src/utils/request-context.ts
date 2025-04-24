/**
 * Determines the AEM Program ID and Environment ID based on the Adobe Routing header.
 *
 * @param headersObject An object or Headers instance containing request headers.
 * @returns An object containing the programId and envId, or nulls if not found.
 */
export function determineProgramIdAndEnvId(headersObject: any): { programId: string | null; envId: string | null } {
  let programId: string | null = null;
  let envId: string | null = null;

  let adobeRoutingHeader: string | null = null;

  // Step 1: Try to get the X-ADOBE-ROUTING header first, regardless of environment
  if (headersObject) {
    if (typeof headersObject.get === 'function') {
        // Standard Headers object
        adobeRoutingHeader = headersObject.get('X-ADOBE-ROUTING') || headersObject.get('x-adobe-routing');
    } else if (typeof headersObject === 'object' && headersObject !== null) {
        // Plain object (case-insensitive lookup)
        const lowerCaseHeaders: { [key: string]: string } = {};
        for (const key in headersObject) {
            if (Object.prototype.hasOwnProperty.call(headersObject, key)) {
                const value = headersObject[key];
                lowerCaseHeaders[key.toLowerCase()] = typeof value === 'string' ? value : String(value);
            }
        }
        adobeRoutingHeader = lowerCaseHeaders['x-adobe-routing'];
    } else {
        console.warn("Provided headers object structure is unrecognized. Type:", typeof headersObject);
    }
  }

  if (adobeRoutingHeader) {
    console.log("Found X-ADOBE-ROUTING header:", adobeRoutingHeader);
    try {
      const routingInfo = adobeRoutingHeader.split(',').reduce((acc, part) => {
        const [key, value] = part.trim().split('=');
        if (key && value) {
          acc[key] = value.replace(/^"|"$/g, ''); // Remove surrounding quotes if any
        }
        return acc;
      }, {} as { [key: string]: string });

      programId = routingInfo['program'] || null;
      envId = routingInfo['environment'] || null;

      if (programId && envId) {
        console.log(`Extracted programId: ${programId}, envId: ${envId} from X-ADOBE-ROUTING header.`);
      } else {
        console.warn("Could not extract programId or envId from X-ADOBE-ROUTING header. Header content:", adobeRoutingHeader);
        // Reset IDs if extraction failed partially or completely to allow fallback
        programId = null;
        envId = null;
      }
    } catch (e) {
      console.error("Error parsing X-ADOBE-ROUTING header:", e, adobeRoutingHeader);
      // Reset IDs on error to allow fallback
      programId = null;
      envId = null;
    }
  } else {
    console.log("X-ADOBE-ROUTING header not found.");
  }
  return { programId, envId };
}

/**
 * Extracts the Authorization header value from a headers object.
 *
 * @param headersObject An object or Headers instance containing request headers.
 * @returns The Authorization header value as a string, or null if not found.
 */
export function extractAuthorizationHeader(headersObject: any): string | null {
  let authorizationHeader: string | null = null;

  if (headersObject) {
    if (typeof headersObject.get === 'function') {
        // Standard Headers object
        authorizationHeader = headersObject.get('Authorization') || headersObject.get('authorization');
    } else if (typeof headersObject === 'object' && headersObject !== null) {
        // Plain object (case-insensitive lookup)
        const lowerCaseHeaders: { [key: string]: string } = {};
        for (const key in headersObject) {
            if (Object.prototype.hasOwnProperty.call(headersObject, key)) {
                const value = headersObject[key];
                lowerCaseHeaders[key.toLowerCase()] = typeof value === 'string' ? value : String(value);
            }
        }
        authorizationHeader = lowerCaseHeaders['authorization'];
    } else {
        console.warn("Provided headers object structure is unrecognized. Type:", typeof headersObject);
    }
  }

  if (authorizationHeader) {
      console.log("Found Authorization header.");
  } else {
      console.log("Authorization header not found.");
  }

  return authorizationHeader;
} 