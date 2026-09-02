/**
 * Public desktop OAuth client used by the npm distribution.
 *
 * Google treats installed applications as unable to keep a client secret.
 * Set these values once after creating the production Desktop OAuth client.
 * Until then, developers can use credentials.json or environment variables.
 */
export const BUNDLED_GOOGLE_OAUTH_CLIENT = {
  clientId: "749884149912-4nl430614qdfm27clnqtj0imvvfr7j5g.apps.googleusercontent.com",
  clientSecret: "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"
} as const;
