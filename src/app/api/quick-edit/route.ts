import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { anthropic } from "@ai-sdk/anthropic";
import { NextResponse } from "next/server";
import { generateText, Output } from "ai";

import { firecrawl } from "@/lib/firecrawl";
import { editRequestSchema } from "@/lib/schemas/suggestion";

/**
 * Zod schema for the quick edit response.
 *
 * Validates the AI-generated edited code structure returned by the model.
 * The editedCode field contains the modified version of the selected code
 * with the user's instruction applied.
 */
const quickEditSchema = z.object({
  editedCode: z
    .string()
    .describe(
      "The edited version of the selected code based on the instruction"
    ),
});

/**
 * Regular expression for detecting URLs in user instructions.
 *
 * Matches http:// and https:// URLs in the instruction text. When URLs are found,
 * they are scraped using Firecrawl to provide additional documentation context
 * to the AI model.
 *
 * @example
 * "Add type hints from https://docs.python.org/3/library/typing.html"
 * // Matches: ["https://docs.python.org/3/library/typing.html"]
 */
const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

/**
 * Prompt template for the AI code editing assistant.
 *
 * This prompt instructs the AI to edit selected code based on user instructions
 * while maintaining formatting and context awareness. It includes:
 * - Selected code to edit
 * - Full file context for understanding scope
 * - Optional documentation from scraped URLs
 * - User instruction for the edit
 *
 * The AI is instructed to preserve indentation and return only the edited code
 * without explanations, making the output directly usable in the editor.
 *
 * Template variables:
 * - {selectedCode}: The code selection to modify
 * - {fullCode}: Complete file content for context
 * - {documentation}: Scraped docs from URLs (if any)
 * - {instruction}: User's natural language instruction
 */
const QUICK_EDIT_PROMPT = `You are a code editing assistant. Edit the selected code based on the user's instruction.

<context>
<selected_code>
{selectedCode}
</selected_code>
<full_code_context>
{fullCode}
</full_code_context>
</context>

{documentation}

<instruction>
{instruction}
</instruction>

<instructions>
Return ONLY the edited version of the selected code.
Maintain the same indentation level as the original.
Do not include any explanations or comments unless requested.
If the instruction is unclear or cannot be applied, return the original code unchanged.
</instructions>`;

/**
 * Request body structure for the quick edit endpoint.
 */
interface QuickEditRequest {
  /** The code selection to edit (required) */
  selectedCode: string;
  /** Complete file content for context (optional) */
  fullCode?: string;
  /** Natural language editing instruction (required) */
  instruction: string;
}

/**
 * POST endpoint for AI-powered quick code editing.
 *
 * This API route handles inline code editing requests from the editor. It takes
 * a code selection, user instruction, and optional full file context, then uses
 * Claude AI to generate an edited version of the code.
 *
 * Features:
 * - Authenticated via Clerk (requires logged-in user)
 * - URL detection and scraping: Extracts URLs from instructions and fetches
 *   documentation using Firecrawl to provide additional context to the AI
 * - Context-aware editing: Uses full file context to understand scope
 * - Structured output: Returns validated edited code via Zod schema
 *
 * @example Request body:
 * ```json
 * {
 *   "selectedCode": "function add(a, b) { return a + b; }",
 *   "fullCode": "// Full file content...",
 *   "instruction": "Add TypeScript types from https://typescriptlang.org/docs"
 * }
 * ```
 *
 * @example Success response:
 * ```json
 * {
 *   "editedCode": "function add(a: number, b: number): number { return a + b; }"
 * }
 * ```
 *
 * Status codes:
 * - 200: Successfully generated edited code
 * - 400: Missing required fields (selectedCode or instruction)
 * - 401: User not authenticated
 * - 500: AI generation failed or server error
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body using Zod schema
    const parseResult = editRequestSchema.safeParse(await request.json());

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { selectedCode, fullCode, instruction } = parseResult.data;

    // Extract URLs from instruction and scrape documentation if present
    const urls: string[] = instruction.match(URL_REGEX) || [];
    let documentationContent = "";

    if (urls.length > 0) {
      // Scrape all URLs in parallel using Firecrawl
      const scrapedResults = await Promise.all(
        urls.map(async (url) => {
          try {
            const result = await firecrawl.scrape(url, {
              formats: ["markdown"],
            });

            if (result.markdown) {
              return `<doc url="${url}">\n${result.markdown}\n</doc>`;
            }

            return null;
          } catch (error) {
            return null;
          }
        })
      );

      // Filter out failed scrapes and format valid documentation
      const validResults = scrapedResults.filter(Boolean);

      if (validResults.length > 0) {
        documentationContent = `<documentation>\n${validResults.join("\n\n")}\n</documentation>`;
      }
    }

    // Replace template variables in the prompt with actual values
    const prompt = QUICK_EDIT_PROMPT.replace("{selectedCode}", selectedCode)
      .replace("{fullCode}", fullCode || "")
      .replace("{instruction}", instruction)
      .replace("{documentation}", documentationContent || "");

    // Generate edited code using Claude with structured output
    const { output } = await generateText({
      model: anthropic("claude-3-7-sonnet-20250219"),
      output: Output.object({ schema: quickEditSchema }),
      prompt,
    });

    return NextResponse.json({ editedCode: output.editedCode });
  } catch (error) {
    console.error("Error generating quick edit:", error);
    return NextResponse.json(
      { error: "Failed to generate quick edit" },
      { status: 500 }
    );
  }
}
