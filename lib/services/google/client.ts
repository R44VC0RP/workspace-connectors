import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

/**
 * Create an authenticated Google OAuth2 client from tokens.
 */
export function createGoogleClient(accessToken: string): OAuth2Client {
  const oauth2Client = new OAuth2Client();

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

/**
 * Get a Gmail API client.
 */
export function getGmailClient(accessToken: string) {
  const auth = createGoogleClient(accessToken);
  return google.gmail({ version: "v1", auth });
}

/**
 * Get a Calendar API client.
 */
export function getCalendarClient(accessToken: string) {
  const auth = createGoogleClient(accessToken);
  return google.calendar({ version: "v3", auth });
}
