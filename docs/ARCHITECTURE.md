# Railway Drawer - Architecture Guide

## Overview

Railway Drawer is a TypeScript-based web application for editing railway diagrams. The architecture emphasizes:
- **Modularity**: Clear separation of concerns via services, contexts, and controllers
- **Type Safety**: Comprehensive TypeScript with 200+ type definitions
- **Testability**: Dependency injection via ServiceRegistry
- **Accessibility**: WCAG 2.1 AA compliance with ARIA support
- **Scalability**: Context-based state management ready for growth

## Core Principles

### 1. Service-Based Architecture
Services encapsulate business logic and are injected via ServiceRegistry.

**Available Services:**
- `GraphCommandService` - Graph operations (undo/redo, copy/paste, etc.)
- `CacheService` - Persistent storage via localStorage
- `ErrorHandler` - Centralized error management
- `ServiceRegistry` - Dependency injection container

### 2. Context-Based Components
Instead of a monolithic TabData interface, the system uses focused contexts:

```typescript
// Graph operations
const graphCtx: GraphContext = {
  id: string;
  graph: Graph;
  graphCommandService: GraphCommandService;
};

// UI state
const uiCtx: UIContext = {
  tabId: string;
  propertiesPanel: PropertiesPanel;
  // ... UI controllers
};

// Editing operations
const editingCtx: EditingContext = {
  tabId: string;
  drawingController: DrawingController;
  // ... editing controllers
};

// Complete context
const tabCtx: TabContext = {
  id: string;
  name: string;
  graph: GraphContext;
  ui: UIContext;
  editing: EditingContext;
  helpers: HelpersContext;
  features: FeaturesContext;
};
```

### 3. UIController Base Class
All UI controllers extend `UIController` with standardized lifecycle:

```typescript
export abstract class UIController {
  abstract destroy(): void;
  protected trackListener(element, event, handler);
  protected removeTrackedListeners();
}
```

This ensures:
- Consistent cleanup patterns
- Event listener tracking
- Proper resource disposal

### 4. State Management
Two-level state store for application and graph state:

```typescript
// Application state
const appStateStore = new StateStore({
  zoom: number;
  selectedCellIds: string[];
  isDarkMode: boolean;
  // ...
});

// Graph state
const graphStateStore = new StateStore({
  cellCount: number;
  canUndo: boolean;
  hasChanges: boolean;
  // ...
});
```

Observers subscribe to state changes:
```typescript
appStateStore.subscribe((newState, oldState) => {
  // React to state changes
});

// Or subscribe to specific properties
appStateStore.subscribeToProperty('zoom', (newZoom, oldZoom) => {
  // Handle zoom change
});
```

## Key Components

### Services (`src/services/`)
- `service-registry.ts` - Dependency injection container (0 window pollution)
- `error-handler.ts` - Categorized error management with recovery
- `error-boundary.ts` - UI section error boundaries with fallback
- `cache-service.ts` - Persistent storage
- `clipboard-service.ts` - Copy/paste operations
- `graph-command-service.ts` - Undo/redo and graph commands

### UI Controllers (`src/ui/`)
All extend `UIController` and implement `destroy()`:

**Core Controllers:**
- `tabs.ts` - Multi-diagram tab management
- `interactive-ui.ts` - User interactions and toolbar
- `properties.ts` - Properties inspector panel
- `menu.ts` - Main menu and file operations
- `context-menu.ts` - Right-click context menu

**Feature Controllers:**
- `drawing.ts` - Freehand drawing tool
- `layers.ts` - Layer management
- `alignment.ts` - Shape alignment and distribution
- `transform.ts` - Rotation and flip operations
- `zoom.ts` - Zoom controls
- `export-image.ts` - PNG/SVG export

### Types (`src/types/index.ts`)
Comprehensive type definitions:
- `ShapeConfig` - Shape configuration
- `CellStyle` - Cell styling options
- `CacheData` - Cache format
- `UIState` - UI state interface
- `CustomShape` - User-created shapes
- `AppContext` - Application context

### Contexts (`src/contexts/`)
Focused context types replacing monolithic TabData:
- `graph-context.ts` - Graph + command service
- `ui-context.ts` - UI controllers and state
- `editing-context.ts` - Editing tools
- `helpers-context.ts` - Utility controllers
- `features-context.ts` - Optional features

## Data Flow

```
User Interaction
    ↓
[Event Listener in UIController]
    ↓
[Service Method] (GraphCommandService, etc.)
    ↓
[Graph Operation] (maxGraph API)
    ↓
[State Update] (StateStore)
    ↓
[Observer Notification]
    ↓
[UI Redraw]
```

## Dependency Injection Pattern

All services and controllers use constructor injection:

```typescript
export class MyController extends UIController {
  constructor(
    private graph: Graph,
    private commandService: GraphCommandService,
    private errorHandler: ErrorHandler
  ) {
    super();
    this.initialize();
  }

  destroy(): void {
    this.removeTrackedListeners();
    // Additional cleanup
  }
}

// Registration
ServiceRegistry.setCommandService(commandService);
```

## Error Handling Strategy

**Three-Level Error Handling:**

1. **Global Error Listeners** (error-handler.ts)
   - Unhandled promise rejections
   - Global error events
   - Automatic user notifications

2. **Service-Level Handling** (graph-command-service.ts)
   - Try-catch in business logic
   - Event notifications
   - Graceful degradation

3. **UI-Level Boundaries** (error-boundary.ts)
   - Component error recovery
   - Fallback UI
   - Retry mechanisms

**Error Categories:**
- `graph` - Graph operations
- `cache` - Storage operations
- `shape` - Shape loading/registration
- `ui` - UI component failures
- `io` - File I/O operations

## Testing Strategy

### Unit Tests
- Services: `src/__tests__/services/`
- Contexts: `src/__tests__/contexts/`
- Utilities: `src/__tests__/utils/`

### Test Infrastructure
- `setup.ts` - Test utilities and factories
- Graph creation helpers
- DOM container management
- Async utilities

### Running Tests
```bash
npm test                    # Run all tests
npm test -- --coverage      # With coverage report
npm test -- --watch         # Watch mode
```

## Accessibility (WCAG 2.1 AA)

**Key Features:**
- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus indicators
- Color contrast compliance
- Skip links for keyboard users

**Enhancement Functions:**
- `initializeAccessibility()` - Apply all enhancements
- `announceAction()` - Announce to screen readers
- `setAriaLabel()` - Add ARIA labels
- `makeAccessibleButton()` - Make buttons keyboard-accessible

## Performance Considerations

### Bundle Optimization
- Lazy load shape groups (not yet implemented)
- SVG shapes use data URLs (not external files)
- CSS variables reduce style duplication

### Runtime Performance
- `graph.batchUpdate()` for bulk operations
- Event listener tracking prevents leaks
- State store with selective subscriptions
- Memoization ready (not yet implemented)

## Future Improvements

### Short-term (Phase 7-8)
- [ ] Complete WCAG 2.1 AA compliance testing
- [ ] Expand state management for graph operations
- [ ] Add performance monitoring

### Medium-term (Phase 9-10)
- [ ] Lazy-load shape groups
- [ ] Implement undo/redo history visualization
- [ ] Add collaborative editing support (WebSocket)
- [ ] Performance profiling and optimization

### Long-term
- [ ] Plugin system for custom shapes
- [ ] Real-time collaboration
- [ ] Advanced analytics
- [ ] Mobile support

## Contributing Guidelines

1. **Extend UIController** for new UI components
2. **Use ServiceRegistry** for dependency injection
3. **Add TypeScript types** for new data structures
4. **Implement destroy()** for proper cleanup
5. **Track listeners** with EventManager
6. **Add tests** for new services
7. **Follow commit conventions** (see COMMIT-CONVENTIONS.md)

## Debugging

**Enable Debug Logging:**
```typescript
// In console
localStorage.setItem('debug', '*');
window.location.reload();
```

**State Inspection:**
```typescript
// In console
appStateStore.getState()
graphStateStore.getState()
appStateStore.getHistory()
```

**Error History:**
```typescript
// In console
globalErrorHandler.getErrors()
```

## Architecture Decision Records (ADRs)

See `docs/adr/` for detailed design decisions:
- [ADR-001: Service Registry over Window Globals](adr/001-service-registry.md)
- [ADR-002: Context System over Monolithic TabData](adr/002-context-system.md)
- [ADR-003: UIController Base Class for Cleanup](adr/003-uicontroller-pattern.md)
- [ADR-004: Observer-Based State Management](adr/004-state-management.md)
