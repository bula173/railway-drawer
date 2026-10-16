/**
 * @file store/index.ts
 * @brief Central state management for the application
 * @details Implements a simple observer-based state store
 */

/**
 * State store observer callback
 */
export type StateObserver<T> = (newState: T, oldState: T) => void;

/**
 * Simple centralized state store
 * Uses observer pattern for reactive updates
 */
export class StateStore<T> {
  private state: T;
  private observers: Set<StateObserver<T>> = new Set();
  private history: T[] = [];
  private maxHistory = 50;

  constructor(initialState: T) {
    this.state = initialState;
    this.history.push(JSON.parse(JSON.stringify(initialState)));
  }

  /**
   * Get current state
   */
  getState(): T {
    return this.state;
  }

  /**
   * Update state with partial or complete new state
   */
  setState(updates: Partial<T> | ((prev: T) => Partial<T>)): void {
    const oldState = JSON.parse(JSON.stringify(this.state));

    const newUpdates = typeof updates === 'function' ? updates(this.state) : updates;
    this.state = { ...this.state, ...newUpdates };

    // Add to history
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Notify observers
    this.observers.forEach((observer) => observer(this.state, oldState));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(observer: StateObserver<T>): () => void {
    this.observers.add(observer);

    // Return unsubscribe function
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Get state history
   */
  getHistory(): T[] {
    return [...this.history];
  }

  /**
   * Clear state history
   */
  clearHistory(): void {
    this.history = [JSON.parse(JSON.stringify(this.state))];
  }

  /**
   * Compute derived state (selector pattern)
   */
  select<R>(selector: (state: T) => R): R {
    return selector(this.state);
  }

  /**
   * Subscribe to specific property changes
   */
  subscribeToProperty<K extends keyof T>(
    property: K,
    observer: (newValue: T[K], oldValue: T[K]) => void
  ): () => void {
    return this.subscribe((newState, oldState) => {
      if (newState[property] !== oldState[property]) {
        observer(newState[property], oldState[property]);
      }
    });
  }
}

/**
 * Application state store instance
 */
export const appStateStore = new StateStore({
  zoom: 1,
  panX: 0,
  panY: 0,
  selectedCellIds: [] as string[],
  isDarkMode: false,
  gridEnabled: true,
  gridSize: 10,
  isSaving: false,
  lastSaveTime: 0,
  errorCount: 0,
  currentTool: 'select' as string,
});

/**
 * Type for app state
 */
export type AppState = ReturnType<typeof appStateStore.getState>;

/**
 * Global state actions
 */
export const appActions = {
  setZoom: (zoom: number) => appStateStore.setState({ zoom }),
  setPan: (panX: number, panY: number) => appStateStore.setState({ panX, panY }),
  setSelectedCells: (cellIds: string[]) => appStateStore.setState({ selectedCellIds: cellIds }),
  setDarkMode: (isDarkMode: boolean) => appStateStore.setState({ isDarkMode }),
  setGridEnabled: (gridEnabled: boolean) => appStateStore.setState({ gridEnabled }),
  setGridSize: (gridSize: number) => appStateStore.setState({ gridSize }),
  setIsSaving: (isSaving: boolean) => appStateStore.setState({ isSaving }),
  setSaveTime: (time: number) => appStateStore.setState({ lastSaveTime: time }),
  incrementErrors: () => {
    const state = appStateStore.getState();
    appStateStore.setState({ errorCount: state.errorCount + 1 });
  },
  resetErrors: () => appStateStore.setState({ errorCount: 0 }),
  setCurrentTool: (tool: string) => appStateStore.setState({ currentTool: tool }),
};

/**
 * Graph-specific state store
 */
export const graphStateStore = new StateStore({
  cellCount: 0,
  edgeCount: 0,
  isDirty: false,
  canUndo: false,
  canRedo: false,
  selectedCount: 0,
  hasChanges: false,
});

/**
 * Type for graph state
 */
export type GraphState = ReturnType<typeof graphStateStore.getState>;

/**
 * Graph state actions
 */
export const graphActions = {
  setCellCount: (count: number) => graphStateStore.setState({ cellCount: count }),
  setEdgeCount: (count: number) => graphStateStore.setState({ edgeCount: count }),
  setIsDirty: (isDirty: boolean) => graphStateStore.setState({ isDirty }),
  setCanUndo: (canUndo: boolean) => graphStateStore.setState({ canUndo }),
  setCanRedo: (canRedo: boolean) => graphStateStore.setState({ canRedo }),
  setSelectedCount: (count: number) => graphStateStore.setState({ selectedCount: count }),
  setHasChanges: (hasChanges: boolean) => graphStateStore.setState({ hasChanges }),
};
