# Railway Drawer

[![CI/CD Pipeline](https://github.com/marcin/railway-drawer/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/marcin/railway-drawer/actions/workflows/build-and-deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)](https://github.com/marcin/railway-drawer/actions)

A modern, interactive railway diagram editor built with React, TypeScript, and Vite. Create professional railway schematics with drag-and-drop tools, customizable elements, and export capabilities.

## ✨ Features

- **Interactive Drawing Canvas**: Full-featured SVG drawing area with zoom, pan, and grid snapping
- **Drag & Drop Toolbox**: Pre-built railway elements (tracks, signals, switches, ERTMS components)
- **Multi-Tab Support**: Work on multiple diagrams simultaneously
- **Element Styling**: Customize colors, strokes, and visual properties
- **Copy/Paste**: Full clipboard support with cross-tab functionality
- **Export Options**: PNG, JPG, SVG, and PDF export formats
- **Responsive Design**: Works on desktop and tablet devices
- **Debug Mode**: Built-in element state debugger for development

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

- **RailwayDrawerApp**: Main application orchestrator
- **DrawArea**: Interactive SVG canvas with element manipulation
- **Toolbox**: Draggable element library with custom shape support
- **PropertiesPanel**: Element styling and configuration interface
- **TabPanel**: Multi-tab workspace management
- **Elements**: Reusable drawable element components

### Key Technologies

### Key Technologies

- **React 19**: Modern UI framework with hooks and concurrent features
- **TypeScript**: Full type safety and developer experience
- **Vite**: Fast build tool with HMR
- **Vitest**: Modern testing framework
- **React Testing Library**: Component testing utilities
- **Lucide React**: Beautiful icon library
- **HTML-to-Image**: Canvas export functionality
- **jsPDF**: PDF generation capabilities

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

Comprehensive test suite with 61 tests covering:
- Component rendering and interaction
- Element state management
- User event handling
- Styling bug prevention
- Cross-browser compatibility

```bash
npm run test        # Run all tests
npm run test:watch  # Watch mode
npm run test:ui     # Visual test interface
```

## 🔧 Development

### Project Structure
```
src/
├── components/          # React components
│   ├── __tests__/      # Component tests
│   ├── DrawArea.tsx    # Main canvas component
│   ├── Toolbox.tsx     # Element library
│   ├── Elements.tsx    # Drawable elements
│   └── ...
├── styles/             # CSS modules
├── assets/             # Static assets
└── test/              # Test configuration
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
