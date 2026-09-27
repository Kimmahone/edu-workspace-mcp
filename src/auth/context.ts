import { AsyncLocalStorage } from "node:async_hooks";
import type { google } from "googleapis";

/** A web request must never fall back to the computer owner's Google token. */
export const googleContext = new AsyncLocalStorage<{ client: InstanceType<typeof google.auth.OAuth2> | null; owner: string }>();
