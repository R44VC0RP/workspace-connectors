/**
 * Generate Markdown documentation from OpenAPI spec
 * 
 * Usage: bun run scripts/generate-api-docs.ts
 */

import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import { writeFileSync } from "fs";

const OPENAPI_URL = process.env.NEXT_PUBLIC_SITE_URL 
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/v1/docs/json`
  : "http://localhost:3000/api/v1/docs/json";

async function main() {
  console.log(`Fetching OpenAPI spec from: ${OPENAPI_URL}`);
  
  const response = await fetch(OPENAPI_URL);
  if (!response.ok) {
    console.error(`Failed to fetch OpenAPI spec: ${response.status}`);
    process.exit(1);
  }
  
  const spec = await response.json();
  console.log(`Loaded spec: ${spec.info?.title} v${spec.info?.version}`);
  
  const markdown = await createMarkdownFromOpenApi(spec);
  
  const outputPath = "public/llms.txt";
  writeFileSync(outputPath, markdown);
  
  console.log(`Generated: ${outputPath}`);
}

main().catch(console.error);
