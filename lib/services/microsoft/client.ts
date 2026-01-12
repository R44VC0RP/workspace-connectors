/**
 * Microsoft Graph API Client
 * 
 * Provides authenticated access to Microsoft Graph API for Outlook and Calendar.
 */

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export interface GraphRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Make an authenticated request to Microsoft Graph API.
 */
export async function graphRequest<T>(
  accessToken: string,
  endpoint: string,
  options: GraphRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft Graph API error: ${response.status} - ${error}`);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Microsoft Graph client wrapper for making API calls.
 */
export class GraphClient {
  constructor(private accessToken: string) {}

  async get<T>(endpoint: string): Promise<T> {
    return graphRequest<T>(this.accessToken, endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return graphRequest<T>(this.accessToken, endpoint, { method: "POST", body });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return graphRequest<T>(this.accessToken, endpoint, { method: "PATCH", body });
  }

  async delete(endpoint: string): Promise<void> {
    await graphRequest(this.accessToken, endpoint, { method: "DELETE" });
  }
}

/**
 * Create a Microsoft Graph client with the given access token.
 */
export function getGraphClient(accessToken: string): GraphClient {
  return new GraphClient(accessToken);
}
