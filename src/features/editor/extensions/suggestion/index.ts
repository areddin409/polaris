import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
} from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

import { fetcher } from "./fetcher";

/**
 * StateEffect for setting the AI-generated suggestion text.
 * 
 * StateEffect is CodeMirror's way to send "messages" that update editor state.
 * This effect allows us to dispatch new suggestion text to the editor, which will
 * be stored in the suggestionState field and rendered as ghost text.
 * 
 * @example
 * view.dispatch({
 *   effects: setSuggestionEffect.of("const result = "),
 * });
 */
const setSuggestionEffect = StateEffect.define<string | null>();

/**
 * StateField that holds the current AI suggestion text in the editor state.
 * 
 * StateField is CodeMirror's mechanism for storing custom state that persists
 * across transactions. This field stores the suggestion string that should be
 * displayed as ghost text at the cursor position.
 * 
 * @property {function} create - Returns the initial value (null) when the editor loads
 * @property {function} update - Called on every transaction (keystrokes, selections, etc.)
 *                               to potentially update the suggestion based on effects
 * 
 * The update function checks for setSuggestionEffect in the transaction and updates
 * the state accordingly. If no effect is found, the current value is preserved.
 */
const suggestionState = StateField.define<string | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    // Check each effect in this transaction
    // if we find our setSuggestionEffect, return its value
    // Otherwise, keep the current value unchanged
    for (const effect of transaction.effects) {
      if (effect.is(setSuggestionEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

/**
 * Custom widget that renders AI suggestion text as ghost text in the editor.
 * 
 * Extends CodeMirror's WidgetType to create a custom DOM element that displays
 * the suggestion text inline at the cursor position with reduced opacity.
 * 
 * @extends WidgetType
 */
class SuggestionWidget extends WidgetType {
  /**
   * Creates a new suggestion widget.
   * 
   * @param {string} text - The suggestion text to display
   */
  constructor(readonly text: string) {
    super();
  }

  /**
   * Creates the DOM element for the suggestion widget.
   * 
   * Called by CodeMirror to render the widget in the editor. Returns a span
   * element styled as ghost text (40% opacity, non-interactive).
   * 
   * @returns {HTMLSpanElement} The DOM element to display in the editor
   */
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.text;
    span.style.opacity = "0.4"; // make it look like ghost text
    span.style.pointerEvents = "none"; // make it unselectable
    return span;
  }
}

/** Timer ID for debouncing suggestion requests */
let debounceTimer: number | null = null;

/** Flag indicating whether a suggestion fetch is currently in progress */
let isWaitingForSuggestion = false;

/** Delay in milliseconds before triggering a suggestion request after user stops typing */
const DEBOUNCE_DELAY = 300; // milliseconds

/** Number of lines to include before and after the cursor for context */
const LINES_TO_FETCH = 5;

/** AbortController for canceling in-flight suggestion requests */
let currentAbortController: AbortController | null = null;

/**
 * Generates the payload for an AI suggestion request.
 * 
 * Extracts relevant context from the editor including the current line,
 * surrounding lines, cursor position, and file information to send to the
 * AI suggestion API.
 * 
 * @param {EditorView} view - The CodeMirror editor view instance
 * @param {string} fileName - The name of the file being edited
 * @returns {object | null} Payload object with code context, or null if document is empty
 * @returns {string} .fileName - Name of the file
 * @returns {string} .code - Complete document content
 * @returns {string} .currentLine - Text of the line containing the cursor
 * @returns {string} .previousLines - Lines before the cursor (up to LINES_TO_FETCH)
 * @returns {string} .textBeforeCursor - Text on current line before cursor
 * @returns {string} .textAfterCursor - Text on current line after cursor
 * @returns {string} .nextLines - Lines after the cursor (up to LINES_TO_FETCH)
 * @returns {number} .lineNumber - 1-based line number of cursor position
 */
const generatePayload = (view: EditorView, fileName: string) => {
  const code = view.state.doc.toString();
  if (!code || code.trim().length === 0) return null;

  const cursorPosition = view.state.selection.main.head;
  const currentLine = view.state.doc.lineAt(cursorPosition);
  const cursorInLine = cursorPosition - currentLine.from;

  const previousLines: string[] = [];
  const previousLinesToFetch = Math.min(LINES_TO_FETCH, currentLine.number - 1);
  for (let i = previousLinesToFetch; i > 0; i--) {
    previousLines.push(view.state.doc.line(currentLine.number - i).text);
  }

  const nextLines: string[] = [];
  const totalLines = view.state.doc.lines;
  const nextLinesToFetch = Math.min(
    LINES_TO_FETCH,
    totalLines - currentLine.number
  );
  for (let i = 1; i <= nextLinesToFetch; i++) {
    nextLines.push(view.state.doc.line(currentLine.number + i).text);
  }

  return {
    fileName,
    code,
    currentLine: currentLine.text,
    previousLines: previousLines.join("\n"),
    textBeforeCursor: currentLine.text.slice(0, cursorInLine),
    textAfterCursor: currentLine.text.slice(cursorInLine),
    nextLines: nextLines.join("\n"),
    lineNumber: currentLine.number,
  };
};

/**
 * Creates a CodeMirror ViewPlugin that handles debounced suggestion requests.
 * 
 * This plugin monitors document changes and cursor movements, debouncing requests
 * to the AI suggestion API to avoid excessive calls. It automatically cancels
 * in-flight requests when new changes occur.
 * 
 * @param {string} fileName - The name of the file being edited, passed to the API
 * @returns {ViewPlugin} CodeMirror view plugin that manages suggestion lifecycle
 */
const createDebouncePlugin = (fileName: string) => {
  return ViewPlugin.fromClass(
    class {
      /**
       * Initializes the plugin and triggers an initial suggestion.
       * 
       * @param {EditorView} view - The CodeMirror editor view instance
       */
      constructor(view: EditorView) {
        this.triggerSuggestion(view);
      }

      /**
       * Called on every editor update to check if suggestions should be refetched.
       * 
       * Triggers a new suggestion request if the document changed or cursor moved.
       * 
       * @param {ViewUpdate} update - The update object containing change information
       */
      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
          this.triggerSuggestion(update.view);
        }
      }

      /**
       * Debounces and triggers an AI suggestion request.
       * 
       * Cancels any pending timer and in-flight requests, then starts a new
       * debounced request. After the debounce delay, fetches a suggestion from
       * the API and dispatches it to the editor state.
       * 
       * @param {EditorView} view - The CodeMirror editor view instance
       */
      triggerSuggestion(view: EditorView) {
        if (debounceTimer !== null) clearTimeout(debounceTimer);

        if (currentAbortController !== null) {
          currentAbortController.abort();
        }

        isWaitingForSuggestion = true;

        debounceTimer = window.setTimeout(async () => {
          const payload = generatePayload(view, fileName);
          if (!payload) {
            isWaitingForSuggestion = false;
            view.dispatch({
              effects: setSuggestionEffect.of(null),
            });
            return;
          }

          currentAbortController = new AbortController();

          const suggestion = await fetcher(
            payload,
            currentAbortController.signal
          );

          isWaitingForSuggestion = false;
          view.dispatch({
            effects: setSuggestionEffect.of(suggestion),
          });
        }, DEBOUNCE_DELAY);
      }

      /**
       * Cleanup method called when the plugin is destroyed.
       * 
       * Cancels any pending timers and aborts in-flight requests to prevent
       * memory leaks and unnecessary API calls.
       */
      destroy() {
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }

        if (currentAbortController !== null) {
          currentAbortController.abort();
        }
      }
    }
  );
};

/**
 * ViewPlugin that renders AI suggestions as decorations in the editor.
 * 
 * This plugin maintains a DecorationSet that displays the current suggestion
 * as ghost text at the cursor position. It rebuilds decorations whenever the
 * document changes, cursor moves, or a new suggestion arrives.
 */
const renderPlugin = ViewPlugin.fromClass(
  class {
    /** The set of decorations currently displayed in the editor */
    decorations: DecorationSet;

    /**
     * Initializes the plugin and builds initial decorations.
     * 
     * @param {EditorView} view - The CodeMirror editor view instance
     */
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    /**
     * Called on every editor update to rebuild decorations if needed.
     * 
     * Checks if the suggestion state changed, document changed, or cursor moved,
     * and rebuilds decorations accordingly to keep the ghost text in sync.
     * 
     * @param {ViewUpdate} update - The update object containing change information
     */
    update(update: ViewUpdate) {
      // Rebuild decorations if doc changed, cursor moved, or suggestion state changed
      const suggestionChanged = update.transactions.some((transaction) => {
        return transaction.effects.some((effect) => {
          return effect.is(setSuggestionEffect);
        });
      });

      //Rebuild decorations if doc changed, cursor moved, or suggestion state changed
      const shouldRebuild =
        update.docChanged || update.selectionSet || suggestionChanged;

      if (shouldRebuild) {
        this.decorations = this.build(update.view);
      }
    }

    /**
     * Builds the decoration set for rendering suggestions.
     * 
     * Creates a widget decoration at the cursor position if a suggestion exists
     * and no request is in progress. Returns empty decorations otherwise.
     * 
     * @param {EditorView} view - The CodeMirror editor view instance
     * @returns {DecorationSet} Set of decorations to display in the editor
     */
    build(view: EditorView) {
      if (isWaitingForSuggestion) {
        return Decoration.none;
      }

      // get current suggestion from state
      const suggestion = view.state.field(suggestionState);
      if (!suggestion) {
        return Decoration.none;
      }

      //create a widget decoration at cursor position
      const cursor = view.state.selection.main.head;
      return Decoration.set([
        Decoration.widget({
          widget: new SuggestionWidget(suggestion),
          side: 1, // place after the cursor
        }).range(cursor),
      ]);
    }
  },
  {
    decorations: (plugin) => plugin.decorations, // tells Codemirror to use our decorations
  }
);

/**
 * Keymap that handles accepting AI suggestions with the Tab key.
 * 
 * When Tab is pressed and a suggestion is present, inserts the suggestion
 * text at the cursor position and clears the suggestion. If no suggestion
 * exists, allows Tab to perform its default behavior (indentation).
 */
const acceptSuggestionKeymap = keymap.of([
  {
    key: "Tab",
    /**
     * Tab key handler that accepts the current suggestion.
     * 
     * @param {EditorView} view - The CodeMirror editor view instance
     * @returns {boolean} true if suggestion was accepted, false to allow default Tab behavior
     */
    run: (view) => {
      const suggestion = view.state.field(suggestionState);
      if (!suggestion) {
        return false; // no suggestion? let tab to its normal behavior (indent)
      }

      const cursor = view.state.selection.main.head;
      view.dispatch({
        changes: { from: cursor, insert: suggestion }, // insert suggestion at cursor
        selection: { anchor: cursor + suggestion.length }, // move cursor to end of inserted text
        effects: setSuggestionEffect.of(null), // clear suggestion
      });
      return true; // handled tab, don't indent
    },
  },
]);

/**
 * Creates a CodeMirror extension for AI-powered code suggestions.
 * 
 * This extension provides inline ghost text suggestions similar to GitHub Copilot.
 * It debounces requests as the user types, fetches suggestions from an AI API,
 * and displays them as low-opacity text at the cursor. Users can accept suggestions
 * with the Tab key.
 * 
 * Features:
 * - Debounced API requests (300ms delay) to avoid excessive calls
 * - Context-aware: sends surrounding code lines for better suggestions
 * - Request cancellation: aborts in-flight requests when new changes occur
 * - Non-blocking: suggestions don't interfere with normal typing
 * - Tab to accept: press Tab to insert the suggestion text
 * 
 * @param {string} fileName - The name of the file being edited (sent to AI API for context)
 * @returns {Extension[]} Array of CodeMirror extensions to add to the editor
 * 
 * @example
 * ```typescript
 * import { suggestion } from './suggestion';
 * 
 * const extensions = [
 *   // ... other extensions
 *   suggestion('MyComponent.tsx'),
 * ];
 * ```
 */
export const suggestion = (fileName: string) => [
  suggestionState, // Our state storage
  createDebouncePlugin(fileName), // fetch/update suggestions
  renderPlugin, // render ghost text
  acceptSuggestionKeymap, // tab to accept
];
