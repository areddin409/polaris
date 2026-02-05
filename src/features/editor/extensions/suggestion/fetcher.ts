import ky from "ky";
import { toast } from "sonner";
import {
  suggestionRequestSchema,
  suggestionResponseSchema,
  type SuggestionRequest,
  type SuggestionResponse,
} from "@/lib/schemas/suggestion";

export const fetcher = async (
  payload: SuggestionRequest,
  signal?: AbortSignal
): Promise<string | null> => {
  try {
    const validatedPayload = suggestionRequestSchema.parse(payload);

    const response = await ky
      .post("/api/suggestion", {
        json: validatedPayload,
        signal,
        timeout: 10000,
        retry: 0,
      })
      .json<SuggestionResponse>();

    const validatedResponse = suggestionResponseSchema.parse(response);

    return validatedResponse.suggestion || null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return null; // Request was aborted
    }

    toast.error("Failed to fetch Ai suggestion");
    return null;
  }
};
