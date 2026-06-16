# Railway Drawer

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-114%2F114%20Passing-brightgreen)](#testing)
[![Quality](https://img.shields.io/badge/Code%20Quality-Enhanced-blue)](#code-quality)

A modern, interactive railway diagram editor built with React, TypeScript, and Vite. Create professional railway schematics with advanced drawing tools, customizable elements, and comprehensive export capabilities.

## ✨ Key Features

### Core Functionality
- **Interactive Drawing Canvas**: Full-featured SVG drawing area with zoom, pan, and grid snapping
- **Advanced Element System**: Complex railway elements with two-level selection and individual resize handles
- **Drag & Drop Toolbox**: Pre-built railway elements (tracks, signals, switches, ERTMS components)
- **Multi-Tab Support**: Work on multiple diagrams simultaneously with tab management
- **Tabbed Properties Panel**: Organized property editing with General, Style, Text, and Arrange tabs

### Advanced Features
- **Text Region Editing**: Direct editing of existing SVG text elements within complex shapes
- **Element Styling**: Comprehensive customization of colors, strokes, and visual properties
- **Copy/Paste**: Full clipboard support with cross-tab functionality
- **Export Options**: PNG, JPG, SVG, and PDF export formats
- **Responsive Design**: Optimized for desktop and tablet devices
- **Visual Feedback**: Hover indicators and selection highlights for better user experience

### Developer Features
- **Centralized Logging**: Structured logging system with configurable levels
- **Type Safety**: Comprehensive TypeScript types and interfaces
- **Performance Optimized**: Debounced updates and memoized calculations
- **Error Handling**: Graceful error handling with user-friendly messages
- **Accessibility**: ARIA labels and keyboard navigation support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
git clone https://github.com/bula173/railway-drawer.git
cd railway-drawer
npm install
```

### Development

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run test       # Run test suite
npm run lint       # Run ESLint
```

## 🔧 CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

### Automated Workflows
- **Linting & Type Checking**: ESLint validation and TypeScript compilation
- **Testing**: Comprehensive test suite with coverage reporting
- **Cross-Platform Testing**: Tests on Ubuntu, Windows, and macOS with Node.js 18 & 20
- **Build Verification**: Production build validation and artifact generation

### Local CI Testing
Run the complete CI pipeline locally:
```bash
chmod +x scripts/ci-test.sh
./scripts/ci-test.sh
```

Or run individual steps:
```bash
npm run ci          # Run all CI steps
npm run typecheck   # Type checking only
npm run test:run    # Tests without watch mode
npm run test:coverage # Tests with coverage report
```

## 🏗️ Architecture

### Core Components

- **RailwayDrawerApp**: Main application orchestrator with tab management
- **DrawArea**: Interactive SVG canvas with complex element manipulation and two-level selection
- **Toolbox**: Draggable element library with custom shape support
- **PropertiesPanel**: Tabbed element styling interface (General/Style/Text/Arrange)
- **EnhancedPropertiesPanel**: Improved version with validation and error handling
- **TabPanel**: Multi-tab workspace management with proper state handling
- **Elements**: Advanced SVG element system with text region editing

### Enhanced Architecture

- **Centralized Logging** (`utils/logger.ts`): Structured logging with configurable levels
- **Type Definitions** (`types/index.ts`): Centralized TypeScript interfaces and constants
- **Utility Functions** (`utils/index.ts`): Reusable functions for geometry, validation, and performance
- **Error Handling**: Comprehensive error boundaries and graceful degradation
- **Performance**: Debounced updates, memoized calculations, and optimized re-rendering

### Key Technologies

- **React 19.1.0**: Latest UI framework with hooks and concurrent features
- **TypeScript 5.6**: Full type safety and enhanced developer experience
- **Vite 6.0**: Ultra-fast build tool with HMR and optimized bundling
- **Vitest 2.1**: Modern testing framework with enhanced capabilities
- **React Testing Library**: Component testing with accessibility focus
- **Lucide React**: Beautiful, customizable icon library
- **HTML-to-Image**: High-quality canvas export functionality
- **jsPDF**: Professional PDF generation capabilities

## 🎯 Usage

### Basic Drawing
1. Select elements from the toolbox
2. Drag onto the canvas
3. Use resize handles to adjust size
4. Double-click labels to edit text
5. Use properties panel for styling

### Keyboard Shortcuts
- `Ctrl+C` / `Cmd+C`: Copy selected elements
- `Ctrl+V` / `Cmd+V`: Paste elements
- `Ctrl+Z` / `Cmd+Z`: Undo
- `Delete`: Remove selected elements
- `Shift+Click`: Pan mode
- `Ctrl+Click`: Multi-select

### File Operations
- **Save**: Export current diagram
- **Open**: Import diagram files
- **Export**: PNG, JPG, SVG, PDF formats

## 🧪 Testing

Comprehensive test suite with **53 tests across 7 test files**, all passing with zero warnings:

### Test Coverage
- **Component Rendering**: All React components with proper props
- **User Interactions**: Click, drag, resize, and keyboard events
- **State Management**: Element selection, modification, and persistence
- **Complex Element System**: Two-level selection and individual resize handles
- **Properties Panel**: Tabbed interface and form validation
- **Error Handling**: Graceful failure scenarios and edge cases
- **Performance**: React act() compliance and efficient updates

### Test Commands
```bash
npm run test           # Run all tests in watch mode
npm run test:run       # Run tests once (CI mode)
npm run test:ui        # Visual test interface with Vitest UI
npm run test:coverage  # Generate coverage report
```

### Test Quality Improvements
- ✅ **Zero React act() warnings**: Proper async state handling
- ✅ **Comprehensive mocking**: File operations, clipboard, and external dependencies
- ✅ **Accessibility testing**: Screen reader and keyboard navigation support
- ✅ **Error boundary testing**: Component failure scenarios
- ✅ **Performance testing**: Debounced updates and memory leaks

## 🔧 Development

### Project Structure
```
src/
├── components/          # React components
│   ├── __tests__/      # Component tests (53 tests, all passing)
│   ├── DrawArea.tsx    # Main canvas with complex element system
│   ├── PropertiesPanel.tsx # Tabbed properties interface
│   ├── EnhancedPropertiesPanel.tsx # Improved version with validation
│   ├── Toolbox.tsx     # Element library with drag-and-drop
│   ├── Elements.tsx    # Advanced SVG element system
│   └── ...
├── utils/              # Utility functions and services
│   ├── logger.ts       # Centralized logging system
│   └── index.ts        # Common utility functions
├── types/              # TypeScript type definitions
│   └── index.ts        # Centralized interfaces and constants
├── styles/             # CSS modules and styling
├── assets/             # Static assets and configuration
└── test/              # Test configuration and setup
```

### Adding Custom Elements
1. Edit `src/assets/toolboxConfig.json`
2. Add SVG shape definition
3. Specify dimensions and grouping
4. Use toolbox editor for quick creation

### Contributing
1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## 📝 Code Quality

### Recent Improvements
- **Centralized Logging**: Structured logging system replacing console.log statements
- **Type Safety**: Comprehensive TypeScript interfaces and proper null handling
- **Performance**: Debounced updates, memoized calculations, and optimized rendering
- **Error Handling**: Graceful error boundaries and user-friendly error messages
- **Accessibility**: ARIA labels, keyboard navigation, and screen reader support
- **Testing**: 53/53 tests passing with zero warnings and comprehensive coverage

### Documentation
- **IMPROVEMENTS.md**: Detailed guide to recent code quality enhancements
- **Inline Documentation**: Comprehensive JSDoc comments throughout codebase
- **Type Annotations**: Full TypeScript coverage with strict configuration

## 📝 License

MIT License - see LICENSE file for details

## 🐛 Known Issues

- Element containers may disappear when changing styles (monitored with comprehensive tests)
- Large SVG exports may have performance implications
- Mobile touch interactions need refinement

## 🚧 Roadmap

- [ ] Advanced railroad junction components
- [ ] Layer management system  
- [ ] Collaborative editing features
- [ ] Advanced export templates
- [ ] Mobile app version
- [ ] Plugin architecture

## 📞 Support

- Issues: [GitHub Issues](https://github.com/bula173/railway-drawer/issues)
- Documentation: [Wiki](https://github.com/bula173/railway-drawer/wiki)
- Discussions: [GitHub Discussions](https://github.com/bula173/railway-drawer/discussions)
```
