/**
 * Firecrawl Client
 *
 * Firecrawl client instance for web scraping and content extraction.
 * Configured with API key from environment variables.
 *
 * @module lib/firecrawl
 */

import Firecrawl from "@mendable/firecrawl-js";

/**
 * Firecrawl Client Instance
 *
 * Pre-configured Firecrawl client for scraping web content and converting
 * to various formats (markdown, HTML, etc.). Used for URL content extraction
 * in background jobs and AI context gathering.
 *
 * @constant {Firecrawl}
 *
 * @example
 * // Scrape a URL to markdown
 * const result = await firecrawl.scrape('https://example.com', {
 *   formats: ['markdown']
 * });
 * console.log(result.markdown);
 *
 * @example
 * // Used in Inngest functions
 * const results = await Promise.all(
 *   urls.map(url => firecrawl.scrape(url, { formats: ['markdown'] }))
 * );
 *
 * @remarks
 * Configuration:
 * - API key loaded from `process.env.FIRECRAWL_API_KEY`
 * - Requires valid Firecrawl account and API key
 * - Used for asynchronous web content extraction
 *
 * Common Use Cases:
 * - Scraping documentation pages for AI context
 * - Converting web content to markdown for LLM processing
 * - Extracting structured data from web pages
 * - Batch URL processing in background jobs
 *
 * Environment Variable:
 * - `FIRECRAWL_API_KEY`: Your Firecrawl API key (required)
 */
export const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});
