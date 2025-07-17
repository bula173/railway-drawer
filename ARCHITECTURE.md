# Railway Drawer Architecture Documentation

## Overview

Railway Drawer is a modern web application built with React 19, TypeScript, and Vite. It provides a comprehensive SVG-based drawing environment specifically designed for creating railway diagrams and schematics.

## Core Architecture Principles

### 1. Component-Based Architecture
- **Modular Design**: Each major feature is encapsulated in its own component
- **Separation of Concerns**: UI, business logic, and state management are clearly separated
- **Reusability**: Components are designed to be reusable and composable

### 2. Type Safety
- **Full TypeScript Coverage**: All components, interfaces, and functions are fully typed
- **Interface Contracts**: Clear interfaces define component boundaries and data flow
- **Compile-Time Validation**: Catch errors before runtime with strict TypeScript configuration

### 3. State Management
- **React State**: Local component state for UI interactions
- **Ref-Based APIs**: Imperative APIs for canvas operations via React refs
- **Event-Driven**: User interactions drive state changes through well-defined event handlers

## Component Hierarchy

```
RailwayDrawerApp (Root)
├── TabPanel (Multi-tab management)
├── Toolbox (Element library)
│   ├── ToolboxItem (Individual elements)
│   └── CustomShapeEditor (Add new elements)
├── DrawArea (Main canvas)
│   ├── Elements (Drawable components)
│   │   ├── RenderElement (Individual element renderer)
│   │   └── ElementSVG (SVG shape renderer)
│   ├── Grid (Background grid)
│   └── SelectionRectangle (Area selection)
├── PropertiesPanel (Element styling)
└── ElementStateDebugger (Development tool)
```

## Data Flow

### 1. Element Creation
```
Toolbox → Drag Event → DrawArea → createElement → Elements Array
```

### 2. Element Modification
```
PropertiesPanel → updateElement → DrawArea → Re-render Elements
```

### 3. Selection Management
```
User Interaction → handlePointerDown → setSelectedElementIds → PropertiesPanel Update
```

## Key Interfaces

### DrawElement
Core data structure representing any drawable element:
```typescript
interface DrawElement {
  id: string;
  name?: string;
  type: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  styles?: ElementStyles;
  // ... additional properties
}
```

### DrawAreaRef
Imperative API for external canvas control:
```typescript
interface DrawAreaRef {
  getElements(): DrawElement[];
  setElements(elements: DrawElement[]): void;
  copySelectedElements(): DrawElement[] | undefined;
  pasteElements(position?: { x: number; y: number }): void;
  // ... additional methods
}
```

### ToolboxItem
Configuration for draggable toolbox elements:
```typescript
interface ToolboxItem {
  id: string;
  name: string;
  type: string;
  shape?: string;
  width: number;
  height: number;
  // ... additional properties
}
```

## State Management Patterns

### 1. Local Component State
- UI-specific state (hover, focus, editing modes)
- Temporary values during user interactions
- Component-specific preferences

### 2. Lifted State
- Selected elements (shared between DrawArea and PropertiesPanel)
- Active tab (shared between TabPanel and main app)
- Global clipboard (shared across all tabs)

### 3. Ref-Based Imperative APIs
- Canvas operations (zoom, pan, export)
- Complex multi-step operations (copy/paste)
- Integration with external libraries (html-to-image, jspdf)

## Event Handling Architecture

### 1. Pointer Events
- **Unified Handling**: Single event system for mouse, touch, and pen input
- **Event Delegation**: SVG elements use event bubbling for efficient handling
- **Gesture Recognition**: Complex interactions (drag, resize, area selection)

### 2. Keyboard Shortcuts
- **Global Handlers**: App-level keyboard shortcuts (Ctrl+C, Ctrl+V)
- **Context-Aware**: Different shortcuts based on focused component
- **Modifier Keys**: Support for Ctrl, Alt, Shift combinations

### 3. Custom Events
- **Element Updates**: Notify parent components of element changes
- **Selection Changes**: Broadcast selection state to interested components
- **Tab Switching**: Coordinate state transfer between tabs

## Performance Optimizations

### 1. SVG Rendering
- **Efficient Updates**: Only re-render changed elements
- **Event Handling**: Minimize event listener attachment
- **Path Optimization**: Use efficient SVG path representations

### 2. State Updates
- **Batch Operations**: Group related state changes
- **Memoization**: Prevent unnecessary re-renders with React.memo
- **Ref Stability**: Use stable refs to avoid stale closures

### 3. Memory Management
- **Cleanup**: Proper cleanup of event listeners and timers
- **Garbage Collection**: Avoid memory leaks in drag operations
- **Resource Management**: Efficient handling of images and large datasets

## Testing Strategy

### 1. Unit Tests
- **Component Isolation**: Test components in isolation with mocks
- **Edge Cases**: Cover error conditions and boundary cases
- **API Contracts**: Verify interface implementations

### 2. Integration Tests
- **User Workflows**: Test complete user interactions
- **Data Flow**: Verify state changes across components
- **Event Handling**: Test complex event sequences

### 3. Visual Testing
- **Snapshot Testing**: Detect unintended visual changes
- **Cross-Browser**: Ensure consistent rendering across browsers
- **Responsive Design**: Test on different screen sizes

## Build and Deployment

### 1. Development Environment
- **Vite**: Fast development server with HMR
- **TypeScript**: Real-time type checking
- **ESLint**: Code quality enforcement

### 2. Production Build
- **Optimization**: Code splitting and tree shaking
- **Minification**: Compressed JavaScript and CSS
- **Source Maps**: Debugging support in production

### 3. Testing Pipeline
- **Automated Tests**: Run on every commit
- **Coverage Reports**: Ensure adequate test coverage
- **Quality Gates**: Block deployment on test failures

## Security Considerations

### 1. Input Validation
- **SVG Sanitization**: Prevent XSS through malicious SVG content
- **File Upload**: Validate uploaded files and configurations
- **User Input**: Sanitize all user-provided text and data

### 2. Content Security Policy
- **Strict CSP**: Prevent execution of unauthorized scripts
- **Inline Restrictions**: Minimize use of inline styles and scripts
- **Third-Party Resources**: Whitelist external dependencies

## Future Architecture Considerations

### 1. Scalability
- **Plugin System**: Allow third-party extensions
- **Microservices**: Consider backend services for collaboration
- **Performance**: Optimize for large diagrams with many elements

### 2. Accessibility
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: Proper ARIA labels and descriptions
- **Color Contrast**: Ensure adequate contrast ratios

### 3. Internationalization
- **Text Externalization**: Prepare for multiple languages
- **RTL Support**: Consider right-to-left language support
- **Cultural Adaptations**: Account for different cultural conventions
