/**
 * @fileoverview Inngest background function for processing conversation messages.
 *
 * This module handles the asynchronous processing of user messages in conversations,
 * including AI response generation, automatic title generation, and conversation
 * history management. It uses the Inngest Agent Kit for AI operations and integrates
 * with Convex for database operations.
 *
 * Key responsibilities:
 * - Process incoming user messages from the "message/sent" event
 * - Generate conversation titles for new conversations using Claude 3.5 Haiku
 * - Build context from recent message history
 * - Generate AI responses using Claude Opus 4 with project-aware tools
 * - Provide file reading capabilities via the readFiles tool
 * - Handle cancellation via "message/cancel" events
 * - Provide graceful error handling with user-friendly messages
 *
 * AI Agents:
 * - **Title Generator**: Claude 3.5 Haiku with temperature 0 for consistent, concise titles
 * - **Coding Assistant**: Claude Opus 4 with temperature 0.3, equipped with:
 *   - File reading tool for accessing project files
 *   - Context-aware system prompts with conversation history
 *   - Up to 16K token responses for comprehensive answers
 *
 * @module process-message
 */

import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { convex } from "@/lib/convex-client";
import { createAgent, anthropic, createNetwork } from "@inngest/agent-kit";
import {
  DEFAULT_CONVERSATION_TITLE,
  RECENT_MESSAGES_LIMIT,
} from "../constants";
import {
  CODING_AGENT_SYSTEM_PROMPT,
  TITLE_GENERATOR_SYSTEM_PROMPT,
} from "./constants";
import { createReadFilesTool } from "@/inngest/tools/read-files";
import { createListFilesTool } from "@/inngest/tools/list-files";

/**
 * Event payload structure for message processing.
 *
 * This interface defines the data structure passed to the processMessage function
 * when a "message/sent" event is triggered.
 *
 * @interface MessageEvent
 * @property {Id<"messages">} messageId - Unique identifier for the message being processed
 * @property {Id<"conversations">} conversationId - ID of the conversation this message belongs to
 * @property {Id<"projects">} projectId - ID of the project context for this conversation
 * @property {string} message - The actual text content of the user's message
 */
interface MessageEvent {
  messageId: Id<"messages">;
  conversationId: Id<"conversations">;
  projectId: Id<"projects">;
  message: string;
}

/**
 * Inngest background function for processing conversation messages with AI.
 *
 * This function handles the complete lifecycle of processing a user message:
 * 1. Validates authentication via internal key
 * 2. Retrieves conversation and recent message history
 * 3. Generates a descriptive title for new conversations (Claude 3.5 Haiku)
 * 4. Builds context-aware system prompts with conversation history
 * 5. Creates a coding agent with file access tools (Claude Opus 4)
 * 6. Generates AI responses (TODO: implement agent execution and response streaming)
 *
 * @function processMessage
 *
 * @param {Object} config - Inngest function configuration
 * @param {string} config.id - Unique identifier for this function ("process-message")
 * @param {Array} config.cancelOn - Cancellation rules (responds to "message/cancel" events)
 * @param {Function} config.onFailure - Error handler that updates message with user-friendly error
 *
 * @event message/sent - Triggers this function with MessageEvent payload
 * @event message/cancel - Cancels execution if messageId matches
 *
 * @throws {NonRetriableError} When POLARIS_CONVEX_INTERNAL_KEY is not configured
 * @throws {NonRetriableError} When conversation is not found in database
 *
 * @remarks
 * **Title Generation:**
 * - Only occurs for conversations with default titles
 * - Uses Claude 3.5 Haiku (temperature 0, 50 token limit) for consistency and speed
 * - Extracts and normalizes text content from agent response
 *
 * **Coding Agent Configuration:**
 * - Model: Claude Opus 4 (claude-opus-4-20250514)
 * - Temperature: 0.3 for balanced creativity and accuracy
 * - Max tokens: 16,000 for comprehensive responses
 * - Tools: readFiles (access to project files via Convex)
 * - System prompt: Includes conversation history and context instructions
 *
 * **Context Management:**
 * - Filters out the current processing message from history to avoid duplication
 * - Excludes empty messages
 * - Formats history as "ROLE: content" pairs for clarity
 * - Instructs agent not to repeat previous responses
 *
 * **Infrastructure:**
 * - Uses Inngest's step.run() for automatic retry and idempotency
 * - All database operations go through Convex system API with internal key authentication
 * - 1-second sync delay after message creation (TODO: verify necessity)
 *
 * @example
 * // Trigger this function by sending an Inngest event:
 * await inngest.send({
 *   name: "message/sent",
 *   data: {
 *     messageId: "msg_123",
 *     conversationId: "conv_456",
 *     projectId: "proj_789",
 *     message: "Can you explain the authentication flow in auth.ts?"
 *   }
 * });
 *
 * // The agent can then use the readFiles tool to access the file:
 * // readFiles({ fileIds: ["file_auth_ts_id"] })
 */
export const processMessage = inngest.createFunction(
  {
    id: "process-message",
    // Allow users to cancel long-running message processing
    cancelOn: [
      {
        event: "message/cancel",
        if: "event.data.messageId == async.data.messageId",
      },
    ],
    // Gracefully handle errors by updating the message with a user-friendly error
    onFailure: async ({ event, step }) => {
      const { messageId } = event.data.event.data as MessageEvent;
      const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
      if (internalKey) {
        await step.run("update-message-on-failure", async () => {
          await convex.mutation(api.system.updateMessageContent, {
            internalKey,
            messageId,
            content:
              "Sorry, I encountered an error while processing your request. Let me know if you need anything else!",
          });
        });
      }
    },
  },
  { event: "message/sent" },
  async ({ event, step }) => {
    const { messageId, conversationId, projectId, message } =
      event.data as MessageEvent;

    // Validate internal authentication key for system-level Convex operations
    const internalKey = process.env.POLARIS_CONVEX_INTERNAL_KEY;
    if (!internalKey) {
      throw new NonRetriableError("Internal Key not configured");
    }

    // Brief delay to ensure database consistency after message creation
    // TODO: Investigate if this is still needed with Convex's strong consistency
    await step.sleep("wait-for-db-sync", "1s");

    // Retrieve conversation metadata for title generation check
    const conversation = await step.run("get-conversation", async () => {
      return await convex.query(api.system.getConversationById, {
        conversationId,
        internalKey,
      });
    });

    if (!conversation) {
      throw new NonRetriableError("Conversation not found");
    }

    // Fetch recent message history to provide context for AI response generation
    const recentMessages = await step.run("get-recent-messages", async () => {
      return await convex.query(api.system.getRecentMessages, {
        conversationId,
        internalKey,
        limit: RECENT_MESSAGES_LIMIT,
      });
    });

    // Build system prompt with conversation history for context-aware responses
    let systemPrompt = CODING_AGENT_SYSTEM_PROMPT;

    // Filter out the current processing message to avoid duplication in context
    // Also exclude any empty messages that might have been created
    const contextMessages = recentMessages.filter(
      (msg) => msg._id !== messageId && msg.content.trim() !== ""
    );

    if (contextMessages.length > 0) {
      const historyText = contextMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n");

      systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond ONLY to the user's new message below. Do not repeat or reference your previous responses.`;
    }

    // Generate a descriptive conversation title for new conversations
    // Only runs if the conversation still has the default placeholder title
    const shouldGenerateTitle =
      conversation.title === DEFAULT_CONVERSATION_TITLE;

    if (shouldGenerateTitle) {
      // Use a lightweight, fast model for title generation
      const titleAgent = createAgent({
        name: "title-generator",
        system: TITLE_GENERATOR_SYSTEM_PROMPT,
        model: anthropic({
          model: "claude-3-5-haiku-20241022",
          defaultParameters: {
            temperature: 0, // Deterministic output for consistent titles
            max_tokens: 50, // Short, concise titles only
          },
        }),
      });

      const { output } = await titleAgent.run(message, { step });

      // Extract text content from agent response
      const textMessage = output.find(
        (m) => m.type === "text" && m.role === "assistant"
      );

      if (textMessage?.type === "text") {
        // Handle both string and array content formats
        const title =
          typeof textMessage.content === "string"
            ? textMessage.content.trim()
            : textMessage.content
                .map((c) => c.text)
                .join("")
                .trim();

        if (title) {
          await step.run("update-conversation-title", async () => {
            await convex.mutation(api.system.updateConversationTitle, {
              internalKey,
              conversationId,
              title,
            });
          });
        }
      }
    }

    // Create the coding agent with file access capabilities
    const codingAgent = createAgent({
      name: "polaris",
      system: systemPrompt,
      model: anthropic({
        model: "claude-opus-4-20250514",
        defaultParameters: {
          temperature: 0.3, // Balanced creativity for coding tasks
          max_tokens: 16000, // Support comprehensive responses
        },
      }),
      tools: [
        createReadFilesTool({ internalKey }),
        createListFilesTool({ internalKey, projectId }),
      ],
    });

    // create a network with single agent
    const network = createNetwork({
      name: "polaris-network",
      agents: [codingAgent],
      maxIter: 20,
      router: ({ network }) => {
        const lastResult = network.state.results.at(-1);
        const hasTextResponse = lastResult?.output.some(
          (m) => m.type === "text" && m.role === "assistant"
        );
        const hasToolCalls = lastResult?.output.some(
          (m) => m.type === "tool_call"
        );

        //only stop if there's text WITHOUT tool calls (final response)
        if (hasTextResponse && !hasToolCalls) {
          return undefined; // stop execution
        }

        return codingAgent;
      },
    });

    // run the agent
    const result = await network.run(message);

    // Extract the assistant's text response from the last agent result
    const lastResult = result.state.results.at(-1);
    const textMessage = lastResult?.output.find(
      (m) => m.type === "text" && m.role === "assistant"
    );
    let assistantResponse =
      "I processed your request. Let me know if you need anything else!";

    if (textMessage?.type === "text") {
      assistantResponse =
        typeof textMessage.content === "string"
          ? textMessage.content
          : textMessage.content.map((c) => c.text).join("");
    }

    await step.run("update-assistant-message", async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: assistantResponse,
      });
    });

    return { success: true, messageId: conversationId };
  }
);
