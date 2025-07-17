# Contributing to Railway Drawer

Thank you for your interest in contributing to Railway Drawer! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please treat all contributors with respect and maintain a professional and inclusive environment.

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Git
- Basic knowledge of React, TypeScript, and SVG

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/railway-drawer.git`
3. Install dependencies: `npm install`
4. Start development server: `npm run dev`
5. Run tests: `npm run test`

## Development Workflow

### Branch Naming
- Feature branches: `feature/description-of-feature`
- Bug fixes: `fix/description-of-bug`
- Documentation: `docs/description-of-changes`
- Refactoring: `refactor/description-of-refactor`

### Commit Messages
Use conventional commit format:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(toolbox): add custom shape editor
fix(drawarea): resolve element disappearing bug
docs(readme): update installation instructions
test(elements): add comprehensive element state tests
```

## Code Standards

### TypeScript
- Use strict TypeScript configuration
- Define interfaces for all data structures
- Avoid `any` type unless absolutely necessary
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

### React Components
- Use functional components with hooks
- Follow the single responsibility principle
- Use proper prop types and default values
- Implement proper error boundaries where needed
- Use React.memo for performance optimization when appropriate

### CSS/Styling
- Use CSS modules or styled-components
- Follow BEM naming convention for CSS classes
- Ensure responsive design principles
- Maintain consistent spacing and typography
- Test across different browsers

### Testing
- Write tests for all new features
- Maintain at least 80% code coverage
- Use descriptive test names
- Test both happy path and edge cases
- Include integration tests for complex workflows

## Submitting Changes

### Pull Request Process
1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure all tests pass: `npm run test`
4. Ensure code builds: `npm run build`
5. Run linting: `npm run lint`
6. Commit your changes with conventional commit messages
7. Push to your fork and create a pull request

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if needed
- [ ] No new warnings or errors introduced
```

## Issue Reporting

### Bug Reports
Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser and OS information
- Console errors if any

### Feature Requests
Include:
- Clear description of the feature
- Use case and motivation
- Possible implementation approach
- Alternative solutions considered

## Architecture Guidelines

### Component Design
- Keep components small and focused
- Use composition over inheritance
- Implement proper prop drilling or context for state
- Follow the container/presenter pattern when appropriate

### State Management
- Use local state for component-specific data
- Lift state up when shared between components
- Use refs for imperative operations
- Avoid state duplication

### Performance Considerations
- Minimize re-renders with proper memoization
- Use efficient data structures
- Optimize SVG rendering for large diagrams
- Profile performance for complex operations

## Testing Guidelines

### Unit Tests
- Test component behavior, not implementation
- Mock external dependencies
- Use React Testing Library best practices
- Focus on user interactions and outcomes

### Integration Tests
- Test component interactions
- Verify data flow between components
- Test complex user workflows
- Ensure cross-browser compatibility

### Test Structure
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should handle specific behavior', () => {
    // Test implementation
  });

  describe('when in specific state', () => {
    it('should respond appropriately', () => {
      // Nested test implementation
    });
  });
});
```

## Documentation

### Code Documentation
- Add JSDoc comments for public APIs
- Document complex algorithms and business logic
- Include usage examples for components
- Maintain README and ARCHITECTURE documents

### User Documentation
- Update README for new features
- Create screenshots for visual changes
- Document keyboard shortcuts and usage patterns
- Maintain changelog for releases

## Release Process

### Version Management
- Follow semantic versioning (SemVer)
- Update version in package.json
- Create release notes
- Tag releases in Git

### Pre-release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Performance benchmarks acceptable
- [ ] Cross-browser testing completed
- [ ] Security review if applicable

## Community

### Getting Help
- Check existing issues and documentation
- Ask questions in GitHub Discussions
- Join community chat channels
- Attend virtual meetups when available

### Recognition
Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes for significant contributions
- Annual contributor awards
- Conference speaking opportunities

## License

By contributing to Railway Drawer, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to Railway Drawer! 🚂
