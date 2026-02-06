/**
 * Conversations Convex Functions
 *
 * This module defines all Convex queries and mutations for managing AI chat conversations.
 * Conversations are scoped to projects and contain messages exchanged between users and AI.
 * All operations require authentication and verify project ownership.
 *
 * @module convex/conversations
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

import { verifyAuth } from "./auth";

/**
 * Create Conversation Mutation
 *
 * Creates a new AI chat conversation within a project. The conversation is automatically
 * associated with the project and the authenticated user (via project ownership).
 *
 * @mutation
 * @param {Object} args - Mutation arguments
 * @param {Id<"projects">} args.projectId - The ID of the project this conversation belongs to
 * @param {string} args.title - The title/name of the conversation (e.g., "Add authentication feature")
 * @returns {Promise<Id<"conversations">>} The ID of the newly created conversation
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project with given ID doesn't exist
 * @throws {Error} "Unauthorized access to project" - If project belongs to a different user
 *
 * @example
 * // From React component using Convex hooks
 * const createConversation = useMutation(api.conversations.create);
 *
 * const handleNewChat = async () => {
 *   const conversationId = await createConversation({
 *     projectId,
 *     title: "Implement user authentication"
 *   });
 *   console.log("Created conversation:", conversationId);
 * };
 *
 * @remarks
 * - Requires authentication via verifyAuth
 * - Verifies project exists and user owns it before creating conversation
 * - Sets updatedAt to current timestamp
 * - Conversation titles should be descriptive of the topic or task
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
  },
  handler: async (ctx, { projectId, title }) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", projectId);

    if (!project) throw new Error("Project not found");
    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to project");

    const conversationId = await ctx.db.insert("conversations", {
      projectId,
      title,
      updatedAt: Date.now(),
    });

    return conversationId;
  },
});

/**
 * Get Conversation By ID Query
 *
 * Fetches a single conversation by its ID. Verifies that the authenticated user
 * owns the parent project before returning the conversation, ensuring data security.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"conversations">} args.id - The ID of the conversation to fetch
 * @returns {Promise<Doc<"conversations">>} The requested conversation document
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Conversation not found" - If conversation with given ID doesn't exist
 * @throws {Error} "Project not found" - If the conversation's parent project doesn't exist
 * @throws {Error} "Unauthorized access to project" - If project belongs to a different user
 *
 * @example
 * // From React component using Convex hooks
 * const conversation = useQuery(api.conversations.getById, { id: conversationId });
 *
 * if (!conversation) return <Spinner />;
 *
 * return (
 *   <div>
 *     <h1>{conversation.title}</h1>
 *     <p>Project: {conversation.projectId}</p>
 *     <p>Updated: {new Date(conversation.updatedAt).toLocaleDateString()}</p>
 *   </div>
 * );
 *
 * @remarks
 * - Verifies user authentication before accessing data
 * - Validates conversation exists and user owns the parent project
 * - Useful for conversation detail pages or chat headers
 * - Returns null while loading (handled by Convex hooks)
 */
export const getById = query({
  args: {
    id: v.id("conversations"),
  },
  handler: async (ctx, { id }) => {
    const identity = await verifyAuth(ctx);

    const conversation = await ctx.db.get("conversations", id);

    if (!conversation) throw new Error("Conversation not found");

    const project = await ctx.db.get("projects", conversation.projectId);

    if (!project) throw new Error("Project not found");
    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to project");

    return conversation;
  },
});

/**
 * Get Conversations By Project Query
 *
 * Fetches all conversations for a specific project, ordered by most recently
 * updated. Useful for displaying conversation lists or chat history within
 * a project context.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"projects">} args.projectId - The ID of the project to fetch conversations for
 * @returns {Promise<Doc<"conversations">[]>} Array of all conversations in the project
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Project not found" - If project with given ID doesn't exist
 * @throws {Error} "Unauthorized access to project" - If project belongs to a different user
 *
 * @example
 * // From React component using Convex hooks
 * const conversations = useQuery(api.conversations.getByProject, { projectId });
 *
 * if (!conversations) return <Spinner />;
 *
 * return (
 *   <div>
 *     <h2>Conversations ({conversations.length})</h2>
 *     {conversations.map(conv => (
 *       <ConversationItem key={conv._id} conversation={conv} />
 *     ))}
 *   </div>
 * );
 *
 * @remarks
 * - Returns conversations in descending order (newest first)
 * - Only returns conversations for projects owned by the authenticated user
 * - Uses indexed query (by_project) for optimal performance
 * - Returns empty array if project has no conversations
 * - Validates project ownership before querying conversations
 */
export const getByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", projectId);

    if (!project) throw new Error("Project not found");
    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to project");

    return await ctx.db
      .query("conversations")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();
  },
});

/**
 * Get Messages Query
 *
 * Fetches all messages in a conversation, ordered chronologically (oldest first).
 * Verifies the authenticated user owns the parent project before returning messages.
 * Used to display the conversation thread in chat interfaces.
 *
 * @query
 * @param {Object} args - Query arguments
 * @param {Id<"conversations">} args.conversationId - The ID of the conversation to fetch messages for
 * @returns {Promise<Doc<"messages">[]>} Array of all messages in the conversation, ordered chronologically
 *
 * @throws {Error} "Unauthorized" - If user is not authenticated
 * @throws {Error} "Conversation not found" - If conversation with given ID doesn't exist
 * @throws {Error} "Project not found" - If the conversation's parent project doesn't exist
 * @throws {Error} "Unauthorized access to project" - If project belongs to a different user
 *
 * @example
 * // From React component using Convex hooks
 * const messages = useQuery(api.conversations.getMessages, { conversationId });
 *
 * if (!messages) return <Spinner />;
 *
 * return (
 *   <div className="chat-thread">
 *     {messages.map(message => (
 *       <MessageBubble
 *         key={message._id}
 *         role={message.role}
 *         content={message.content}
 *         status={message.status}
 *       />
 *     ))}
 *   </div>
 * );
 *
 * @remarks
 * - Returns messages in ascending order (chronological, oldest first)
 * - Uses indexed query (by_conversation) for optimal performance
 * - Returns empty array if conversation has no messages
 * - Validates conversation exists and user owns the parent project
 * - Message content may contain markdown for assistant responses
 * - Processing messages may have incomplete content (streaming)
 */
export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const identity = await verifyAuth(ctx);

    const conversation = await ctx.db.get("conversations", conversationId);

    if (!conversation) throw new Error("Conversation not found");

    const project = await ctx.db.get("projects", conversation.projectId);

    if (!project) throw new Error("Project not found");
    if (project.ownerId !== identity.subject)
      throw new Error("Unauthorized access to project");

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("asc")
      .collect();
  },
});
