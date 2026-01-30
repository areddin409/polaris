/**
 * Inngest Functions
 *
 * This module defines background job functions that are executed by Inngest.
 * These functions handle long-running or resource-intensive tasks asynchronously,
 * preventing API timeouts and improving user experience.
 *
 * @module inngest/functions
 */

import { generateText } from "ai";
import { inngest } from "./client";
import { anthropic } from "@ai-sdk/anthropic";
import { firecrawl } from "@/lib/firecrawl";

/**
 * Regular expression to match HTTP and HTTPS URLs in text.
 * Matches URLs that start with http:// or https:// followed by any non-whitespace characters.
 *
 * @example
 * "Check out https://example.com and http://test.com" => ["https://example.com", "http://test.com"]
 */
const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * Demo Generate Function
 *
 * An Inngest background function that processes user prompts by:
 * 1. Extracting URLs from the prompt
 * 2. Scraping content from those URLs using Firecrawl
 * 3. Generating AI responses with the scraped content as context
 *
 * This function runs asynchronously and can handle long-running operations
 * without blocking the API response. Each step is individually retryable,
 * providing resilience against transient failures.
 *
 * @function demoGenerate
 *
 * @param {Object} config - Function configuration
 * @param {string} config.id - Unique identifier for the function ("demo-generate")
 *
 * @param {Object} trigger - Event trigger configuration
 * @param {string} trigger.event - Event name that triggers this function ("demo/generate")
 *
 * @param {Object} handler - Async handler function parameters
 * @param {Object} handler.event - The triggering event object
 * @param {Object} handler.event.data - Event payload data
 * @param {string} handler.event.data.prompt - User's input prompt (may contain URLs)
 * @param {Object} handler.step - Inngest step utilities for creating retryable steps
 *
 * @returns {Promise<void>} Resolves when all steps complete successfully
 *
 * @example
 * // Trigger this function by sending an event:
 * await inngest.send({
 *   name: "demo/generate",
 *   data: {
 *     prompt: "Summarize https://example.com and explain the main points"
 *   }
 * });
 *
 * @step extract-urls
 * Extracts all HTTP/HTTPS URLs from the user's prompt using regex matching.
 * Returns an empty array if no URLs are found.
 *
 * @step scrape-urls
 * Scrapes content from all extracted URLs in parallel using Firecrawl.
 * Converts each page to markdown format for better AI processing.
 * Filters out failed scrapes and joins successful results with double newlines.
 *
 * @step generate-text
 * Generates AI response using Claude 3 Haiku model.
 * If scraped content exists, it's prepended as context to the original prompt.
 * Otherwise, uses the original prompt directly.
 */
export const demoGenerate = inngest.createFunction(
  { id: "demo-generate" },
  { event: "demo/generate" },
  async ({ event, step }) => {
    // Extract the user's prompt from the event data
    const { prompt } = event.data as { prompt: string };

    /**
     * Step 1: Extract URLs
     * Searches the prompt for any HTTP/HTTPS URLs and returns them as an array.
     * This step is retryable - if it fails, Inngest will automatically retry.
     */
    const urls = (await step.run("extract urls", async () => {
      return prompt.match(URL_REGEX) ?? [];
    })) as string[];

    /**
     * Step 2: Scrape Content
     * Scrapes all discovered URLs in parallel using Firecrawl.
     * Each URL is converted to markdown format for optimal AI processing.
     * Failed scrapes are filtered out, and successful results are concatenated.
     */
    const scrapeContent = await step.run("scrape-urls", async () => {
      const results = await Promise.all(
        urls.map(async (url) => {
          // Scrape each URL and request markdown format
          const result = await firecrawl.scrape(url, { formats: ["markdown"] });
          return result.markdown || "";
        })
      );
      // Filter out empty results and join with double newlines for readability
      return results.filter(Boolean).join("\n\n");
    });

    /**
     * Construct the final prompt:
     * - If content was scraped, prepend it as context before the user's question
     * - Otherwise, use the original prompt as-is
     */
    const finalPrompt = scrapeContent
      ? `Context:\n${scrapeContent}\n\nQuestion:\n${prompt}`
      : prompt;

    /**
     * Step 3: Generate AI Response
     * Uses Claude 3 Haiku to generate a response based on the final prompt.
     * The model receives either the enriched prompt (with scraped context) or
     * the original prompt if no URLs were found or scraping failed.
     */
    await step.run("generate text", async () => {
      return await generateText({
        model: anthropic("claude-3-haiku-20240307"),
        prompt: finalPrompt,
      });
    });
  }
);
