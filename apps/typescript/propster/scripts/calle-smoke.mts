/**
 * CALL-E connectivity smoke test.
 *
 *   npm run calle:smoke
 *
 * Confirms that the configured CALL-E credentials work, WITHOUT placing a
 * call. It only reads: the client is constructed and an obviously non-existent
 * call is fetched, so a 404 proves the key authenticated and a 401 proves it
 * did not.
 *
 * Nothing here dials a telephone number.
 */
import { CalleClient, CalleAPIError, CalleAuthenticationError } from "@call-e/calle";

const apiKey = process.env.CALLE_API_KEY?.trim();
const baseUrl = process.env.CALLE_BASE_URL?.trim() || "https://api.heycall-e.com";

async function main() {
  if (!apiKey) {
    console.log("CALLE_API_KEY is not set.");
    console.log("Propster will run in demo mode with the deterministic call provider.");
    console.log("Set CALLE_API_KEY in .env to place real verification calls.");
    return;
  }

  console.log("Base URL: " + baseUrl);
  console.log("API key:  ..." + apiKey.slice(-4));

  const client = new CalleClient({ apiKey, baseUrl });

  try {
    await client.calls.get("call_propster_smoke_test_does_not_exist");
    console.log("Unexpected: the placeholder call id resolved. Credentials work.");
  } catch (error) {
    if (error instanceof CalleAuthenticationError) {
      console.error("FAILED: CALL-E rejected the API key.");
      process.exitCode = 1;
      return;
    }
    if (error instanceof CalleAPIError) {
      if (error.status === 404 || error.code === "not_found") {
        console.log("OK: credentials authenticated (404 for the placeholder call id).");
        console.log("Propster will place REAL calls when you verify a property.");
        return;
      }
      console.error("CALL-E responded with " + error.code + " (" + error.status + ").");
      process.exitCode = 1;
      return;
    }
    console.error("Could not reach CALL-E:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
