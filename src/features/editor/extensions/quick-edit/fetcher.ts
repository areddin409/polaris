import ky from "ky";
import { toast } from "sonner";
import {
  editRequestSchema,
  editResponseSchema,
  type EditRequest,
  type EditResponse,
} from "@/lib/schemas/suggestion";

export const fetcher = async (
  payload: EditRequest,
  signal?: AbortSignal
): Promise<string | null> => {
  try {
    const validatedPayload = editRequestSchema.parse(payload);
    const response = await ky
      .post("/api/quick-edit", {
        json: validatedPayload,
        signal,
        timeout: 30_000,
        retry: 0,
      })
      .json<EditResponse>();

    const validatedResponse = editResponseSchema.parse(response);

    return validatedResponse.editedCode || null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return null; // Request was aborted
    }

    toast.error("Failed to fetch AI quick edit");
    return null;
  }
};
