/**
 * Editor Store
 *
 * Global Zustand store for managing file editor tabs across multiple projects.
 * Implements VS Code-style preview/pinned tab behavior where single-clicking
 * opens files in preview mode (italic) and double-clicking pins them.
 *
 * @module features/projects/store/use-editor-store
 */

import { create } from "zustand";

import { Id } from "../../../../convex/_generated/dataModel";

/**
 * Tab State Interface
 *
 * Represents the tab state for a single project, tracking which tabs are open,
 * which tab is active, and which tab is in preview mode.
 */
interface TabState {
  /** Array of file IDs for all open tabs (both pinned and preview) */
  openTabs: Id<"files">[];
  /** ID of the currently active/focused tab, or null if no tabs open */
  activeTabId: Id<"files"> | null;
  /** ID of the tab in preview mode (italic text), or null if no preview tab */
  previewTabId: Id<"files"> | null;
}

/**
 * Default tab state for projects with no open tabs
 */
const defaultTabState: TabState = {
  openTabs: [],
  activeTabId: null,
  previewTabId: null,
};

/**
 * Editor Store Interface
 *
 * Defines the shape of the editor store, including state and actions
 * for managing tabs across multiple projects.
 */
interface EditorStore {
  /** Map of project IDs to their respective tab states */
  tabs: Map<Id<"projects">, TabState>;

  /**
   * Get Tab State
   *
   * Retrieves the tab state for a specific project. Returns default state
   * if the project has no tabs.
   *
   * @param projectId - The ID of the project
   * @returns The tab state for the project
   */
  getTabState: (projectId: Id<"projects">) => TabState;

  /**
   * Open File
   *
   * Opens a file in the editor, either as a preview tab or pinned tab.
   * Implements VS Code-style behavior:
   * - Preview tabs (single-click): Replace existing preview or add new
   * - Pinned tabs (double-click): Add permanently to tab bar
   * - Opening an existing tab: Just set it as active
   *
   * @param projectId - The ID of the project
   * @param fileId - The ID of the file to open
   * @param options - Configuration options
   * @param options.pinned - Whether to open as pinned (true) or preview (false)
   *
   * @example
   * // Open file as preview (single-click)
   * openFile(projectId, fileId, { pinned: false });
   *
   * @example
   * // Open file as pinned (double-click)
   * openFile(projectId, fileId, { pinned: true });
   */
  openFile: (
    projectId: Id<"projects">,
    fileId: Id<"files">,
    options: { pinned: boolean }
  ) => void;

  /**
   * Close Tab
   *
   * Closes a specific tab for a project. Automatically manages active tab
   * selection, moving to an adjacent tab if the closed tab was active.
   *
   * @param projectId - The ID of the project
   * @param fileId - The ID of the file to close
   *
   * @example
   * closeTab(projectId, fileId);
   */
  closeTab: (projectId: Id<"projects">, fileId: Id<"files">) => void;

  /**
   * Close All Tabs
   *
   * Closes all tabs for a specific project, resetting its state to default.
   *
   * @param projectId - The ID of the project
   *
   * @example
   * closeAllTabs(projectId);
   */
  closeAllTabs: (projectId: Id<"projects">) => void;

  /**
   * Set Active Tab
   *
   * Sets a specific tab as the active/focused tab for a project.
   *
   * @param projectId - The ID of the project
   * @param fileId - The ID of the file to make active
   *
   * @example
   * setActiveTab(projectId, fileId);
   */
  setActiveTab: (projectId: Id<"projects">, fileId: Id<"files">) => void;
}

/**
 * useEditorStore Hook
 *
 * Zustand store hook for managing file editor tabs across multiple projects.
 * Provides state and actions for opening, closing, and managing tabs with
 * VS Code-style preview/pinned behavior.
 *
 * @returns Editor store with state and actions
 *
 * @example
 * // Access store state
 * const { tabs, getTabState } = useEditorStore();
 * const tabState = getTabState(projectId);
 *
 * @example
 * // Open a file as preview
 * const { openFile } = useEditorStore();
 * openFile(projectId, fileId, { pinned: false });
 *
 * @example
 * // Close a tab
 * const { closeTab } = useEditorStore();
 * closeTab(projectId, fileId);
 *
 * @remarks
 * Preview vs Pinned Tabs:
 * - Preview tabs appear in italic and get replaced when opening another file
 * - Pinned tabs remain open and don't get replaced
 * - Double-clicking a preview tab converts it to pinned
 * - Only one preview tab can exist per project at a time
 *
 * Tab Activation:
 * - When closing the active tab, the store automatically selects an adjacent tab
 * - Priority is given to the next tab, falling back to the previous tab
 * - If no tabs remain, activeTabId becomes null
 */

export const useEditorStore = create<EditorStore>()((set, get) => ({
  tabs: new Map(),

  getTabState: (projectId) => {
    return get().tabs.get(projectId) ?? defaultTabState;
  },

  openFile: (projectId, fileId, { pinned }) => {
    const tabs = new Map(get().tabs);
    const state = tabs.get(projectId) ?? defaultTabState;
    const { openTabs, previewTabId } = state;
    const isOpen = openTabs.includes(fileId);

    // Case 1: Opening as preview - replace existing preview or add new
    if (!isOpen && !pinned) {
      const newTabs = previewTabId
        ? openTabs.map((id) => (id === previewTabId ? fileId : id))
        : [...openTabs, fileId];

      tabs.set(projectId, {
        openTabs: newTabs,
        activeTabId: fileId,
        previewTabId: fileId,
      });
      set({ tabs });
      return;
    }

    // Case 2: Opening as pinned - add to tabs, removing preview if needed
    if (!isOpen && pinned) {
      tabs.set(projectId, {
        ...state,
        openTabs: [...openTabs, fileId],
        activeTabId: fileId,
      });
      set({ tabs });
      return;
    }

    // Case 3: File is already open - just set active (and pin if double-clicked)
    const shouldPin = pinned && previewTabId === fileId;
    tabs.set(projectId, {
      ...state,
      activeTabId: fileId,
      previewTabId: shouldPin ? null : previewTabId,
    });
    set({ tabs });
  },

  closeTab: (projectId, fileId) => {
    const tabs = new Map(get().tabs);
    const state = tabs.get(projectId) ?? defaultTabState;
    const { openTabs, activeTabId, previewTabId } = state;
    const tabIndex = openTabs.indexOf(fileId);

    if (tabIndex === -1) {
      // Tab is not open; nothing to do
      return;
    }

    const newTabs = openTabs.filter((id) => id !== fileId);

    let newActiveTabId = activeTabId;
    if (activeTabId === fileId) {
      // If the closed tab was active, set a new active tab
      if (newTabs.length > 0) {
        newActiveTabId = null;
      } else if (tabIndex >= newTabs.length) {
        newActiveTabId = newTabs[newTabs.length - 1];
      } else {
        newActiveTabId = newTabs[tabIndex];
      }
    }

    tabs.set(projectId, {
      openTabs: newTabs,
      activeTabId: newActiveTabId,
      previewTabId: previewTabId === fileId ? null : previewTabId,
    });
    set({ tabs });
  },

  closeAllTabs: (projectId) => {
    const tabs = new Map(get().tabs);
    tabs.set(projectId, defaultTabState);
    set({ tabs });
  },

  setActiveTab: (projectId, fileId) => {
    const tabs = new Map(get().tabs);
    const state = tabs.get(projectId) ?? defaultTabState;
    tabs.set(projectId, {
      ...state,
      activeTabId: fileId,
    });
    set({ tabs });
  },
}));
