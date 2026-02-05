import { Tooltip, showTooltip, keymap, EditorView } from "@codemirror/view";
import { EditorState, StateEffect, StateField } from "@codemirror/state";

import { fetcher } from "./fetcher";

/**
 * StateEffect for toggling the quick edit tooltip visibility.
 *
 * This effect controls whether the quick edit UI (tooltip with input)
 * should be displayed. When dispatched with `true`, the tooltip appears;
 * with `false`, it closes.
 *
 * @example
 * view.dispatch({
 *   effects: showQuickEditEffect.of(true),
 * });
 */
export const showQuickEditEffect = StateEffect.define<boolean>();

/**
 * Reference to the current EditorView instance.
 *
 * Captured by the captureViewExtension to allow the tooltip's event handlers
 * to dispatch changes and effects to the editor.
 */
let editorView: EditorView | null = null;

/**
 * AbortController for canceling in-flight quick edit API requests.
 *
 * Allows cancellation when the user closes the tooltip or submits a new request
 * before the previous one completes.
 */
let currentAbortController: AbortController | null = null;

/**
 * StateField that tracks whether the quick edit tooltip is active.
 *
 * Stores a boolean indicating if the quick edit UI should be visible.
 * Automatically closes when selection becomes empty (no text selected).
 *
 * @property {function} create - Returns initial state (false - tooltip hidden)
 * @property {function} update - Updates state based on effects and selection changes
 */
export const quickEditState = StateField.define<boolean>({
  create() {
    return false;
  },

  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(showQuickEditEffect)) {
        return effect.value;
      }
    }
    if (transaction.selection) {
      const selection = transaction.state.selection.main;
      if (selection.empty) {
        return false;
      }
    }

    return value;
  },
});

/**
 * Creates the quick edit tooltip configuration.
 *
 * Generates a tooltip that appears at the end of the selected text, containing
 * a form with an input field for natural language editing instructions and
 * action buttons (Cancel/Submit).
 *
 * The tooltip includes:
 * - Text input for editing instructions (supports URL detection)
 * - Cancel button to abort and close the tooltip
 * - Submit button to send the edit request to the AI API
 *
 * @param {EditorState} state - The current editor state
 * @returns {readonly Tooltip[]} Array containing the tooltip config, or empty if no selection
 */
const createQuickEditTooltip = (state: EditorState): readonly Tooltip[] => {
  const selection = state.selection.main;

  if (selection.empty) {
    return [];
  }

  const isQuickEditActive = state.field(quickEditState);
  if (!isQuickEditActive) {
    return [];
  }

  return [
    {
      pos: selection.to,
      above: false,
      strictSide: false,
      create() {
        // Create tooltip container with popover styling
        const dom = document.createElement("div");
        dom.className =
          "bg-popover text-popover-foreground z-50 rounded-sm border border-input p-2 shadow-md flex flex-col gap-2 text-sm";

        // Create form structure
        const form = document.createElement("form");
        form.className = "flex flex-col gap-2";

        // Create instruction input field
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Edit selected code...";
        input.className =
          "bg-transparent border-none outline-none px-2 py-1 font-sans w-100";
        input.autofocus = true;

        const buttonContainer = document.createElement("button");
        buttonContainer.className = "flex items-center justify-between gap-2";

        // Cancel button: aborts request and closes tooltip
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel";
        cancelButton.className =
          "font-sans p-1 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-sm";
        cancelButton.onclick = () => {
          // Abort any in-flight request
          if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
          }

          if (editorView) {
            editorView.dispatch({
              effects: showQuickEditEffect.of(false),
            });
          }
        };

        // Submit button: sends edit request to AI API
        const submitButton = document.createElement("button");
        submitButton.type = "submit";
        submitButton.textContent = "Submit";
        submitButton.className =
          "font-sans p-1 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-sm";

        // Handle form submission: send edit request to API
        form.onsubmit = async (e) => {
          e.preventDefault();

          if (!editorView) return;

          const instruction = input.value.trim();
          if (!instruction) return;

          // Extract current selection and document content
          const selection = editorView.state.selection.main;
          const selectedCode = editorView.state.doc.sliceString(
            selection.from,
            selection.to
          );
          const fullCode = editorView.state.doc.toString();

          // Update UI to show loading state
          submitButton.disabled = true;
          submitButton.textContent = "Editing...";

          currentAbortController = new AbortController();

          // Fetch AI-edited code from API
          const editedCode = await fetcher(
            {
              selectedCode,
              fullCode,
              instruction,
            },
            currentAbortController.signal
          );

          // Apply edited code if successful
          if (editedCode) {
            editorView.dispatch({
              changes: {
                from: selection.from,
                to: selection.to,
                insert: editedCode,
              },
              selection: { anchor: selection.from + editedCode.length },
              effects: showQuickEditEffect.of(false),
            });
          } else {
            // Re-enable submit on error
            submitButton.disabled = false;
            submitButton.textContent = "Submit";
          }

          currentAbortController = null;
        };

        // Assemble DOM structure
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(submitButton);

        form.appendChild(input);
        form.appendChild(buttonContainer);

        dom.appendChild(form);

        // Auto-focus input after tooltip renders
        setTimeout(() => {
          input.focus();
        }, 0);

        return { dom };
      },
    },
  ];
};

/**+
 * StateField that manages the quick edit tooltip lifecycle.
 *
 * Creates and updates the tooltip based on editor state changes, including
 * document edits, selection changes, and showQuickEditEffect dispatches.
 * Provides the tooltip to CodeMirror's showTooltip facet for rendering.
 *
 * @property {function} create - Creates initial tooltip state
 * @property {function} update - Updates tooltip when state changes
 * @property {function} provide - Provides tooltip config to showTooltip extension
 */
const quickEditTooltipField = StateField.define<readonly Tooltip[]>({
  create(state) {
    return createQuickEditTooltip(state);
  },

  update(tooltips, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return createQuickEditTooltip(transaction.state);
    }

    for (const effect of transaction.effects) {
      if (effect.is(showQuickEditEffect)) {
        return createQuickEditTooltip(transaction.state);
      }
    }
    return tooltips;
  },

  provide: (field) =>
    showTooltip.computeN([field], (state) => state.field(field)),
});

/**
 * Keymap for quick edit keyboard shortcut.
 *
 * Binds Cmd-K (Mac) / Ctrl-K (Windows/Linux) to trigger the quick edit tooltip.
 * Only activates when text is selected; does nothing on empty selection.
 */
const quickEditKeymap = keymap.of([
  {
    key: "Mod-.",
    run: (view) => {
      const selection = view.state.selection.main;
      if (selection.empty) {
        return false;
      }

      view.dispatch({
        effects: showQuickEditEffect.of(true),
      });
      return true;
    },
  },
]);

/**
 * Extension that captures a reference to the EditorView instance.
 *
 * Stores the view in a module-level variable so tooltip event handlers
 * can dispatch changes and effects without needing direct view access.
 */
const captureViewExtension = EditorView.updateListener.of((update) => {
  editorView = update.view;
});

/**
 * Creates a CodeMirror extension for AI-powered quick code editing.
 *
 * This extension allows users to select code and use natural language instructions
 * to edit it via an AI API. When activated (Cmd/Ctrl-K), a tooltip appears with
 * an input field where users can describe the desired changes.
 *
 * Features:
 * - Keyboard shortcut (Cmd/Ctrl-K) to activate on selected text
 * - Inline tooltip UI for entering edit instructions
 * - Supports URL detection in instructions (scraped for context)
 * - Replaces selected code with AI-generated edits
 * - Cancellable API requests
 * - Loading states and error handling
 *
 * Workflow:
 * 1. User selects code in the editor
 * 2. Presses Cmd/Ctrl-K to open quick edit tooltip
 * 3. Enters natural language instruction (e.g., "add error handling")
 * 4. Extension sends selected code + instruction to AI API
 * 5. AI-edited code replaces the selection
 *
 * @param {string} fileName - The name of the file being edited (currently unused but available for future context)
 * @returns {Extension[]} Array of CodeMirror extensions
 *
 * @example
 * ```typescript
 * import { quickEdit } from './quick-edit';
 *
 * const extensions = [
 *   // ... other extensions
 *   quickEdit('App.tsx'),
 * ];
 * ```
 */
export const quickEdit = (fileName: string) => [
  quickEditState,
  quickEditTooltipField,
  quickEditKeymap,
  captureViewExtension,
];
