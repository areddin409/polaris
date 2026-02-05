import { z } from "zod";

/**
 * Zod schema for AI suggestion requests.
 *
 * Validates the payload structure sent from the editor to the suggestion API.
 * Used on both client (fetcher) and server (API route) for type safety and validation.
 */
export const suggestionRequestSchema = z.object({
  fileName: z.string(),
  code: z.string(),
  currentLine: z.string(),
  previousLines: z.string(),
  textBeforeCursor: z.string(),
  textAfterCursor: z.string(),
  nextLines: z.string(),
  lineNumber: z.number(),
});

export const editRequestSchema = z.object({
  selectedCode: z.string(),
  fullCode: z.string().optional(),
  instruction: z.string(),
});

/**
 * Zod schema for AI suggestion responses.
 *
 * Validates the response structure returned by the suggestion API.
 */
export const suggestionResponseSchema = z.object({
  suggestion: z.string(),
});

export const editResponseSchema = z.object({
  editedCode: z.string(),
});

export type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;
export type SuggestionResponse = z.infer<typeof suggestionResponseSchema>;
export type EditRequest = z.infer<typeof editRequestSchema>;
export type EditResponse = z.infer<typeof editResponseSchema>;
