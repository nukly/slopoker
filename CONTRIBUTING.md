# Contributing to SLO Poker

Thank you for your interest in contributing to SLO Poker! This guide will help you get started.

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Local Development

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd SLOPoker
```

2. **Install dependencies**
```bash
# Install client dependencies
npm install

# Install server dependencies
cd poker-server
npm install
cd ..
```

3. **Start development servers**
```bash
# Terminal 1: Start the poker server
cd poker-server
npm start

# Terminal 2: Start the client dev server
npm run dev
```

4. **Access the application**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Project Structure

### Frontend (Vue.js 3)
- `src/components/` - Vue components
- `src/stores/` - Pinia state management
- `src/services/` - API and socket services

### Backend (Node.js + Socket.io)
- `poker-server/src/models/` - Core game logic
- `poker-server/src/managers/` - Game management modules
- `poker-server/src/handlers/` - Socket event handlers
- `poker-server/src/utils/` - Utility functions

## Code Guidelines

### JavaScript/Vue.js
- Use ES6+ features
- Follow Vue 3 Composition API patterns
- Use Pinia for state management
- Implement proper error handling

### Backend Architecture
- Keep managers focused and single-responsibility
- Add comprehensive logging for debugging
- Write tests for new features
- Validate all user inputs

### Git Workflow
1. Create feature branches from `main`
2. Write descriptive commit messages
3. Test thoroughly before submitting PRs
4. Keep PRs focused and atomic

## Testing

### Backend Tests
```bash
cd poker-server
node test-settings.js
node test-showdown.js
```

### Manual Testing
1. Start both servers
2. Open multiple browser tabs
3. Test multiplayer scenarios:
   - Player joins/leaves
   - All-in scenarios
   - Showdown logic
   - Settings changes

## Key Areas for Contribution

### High Priority
- Frontend UI/UX improvements
- Additional test coverage
- Performance optimizations
- Mobile responsiveness

### Medium Priority
- Tournament mode implementation
- Spectator mode
- Chat system
- Player statistics

### Low Priority
- AI opponents
- Different poker variants
- Advanced analytics
- Replay system

## Reporting Issues

When reporting bugs, please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/Node.js versions
- Console logs if applicable

## Feature Requests

For new features:
- Describe the use case
- Explain expected behavior
- Consider implementation complexity
- Check existing issues first

## Getting Help

- Check existing documentation
- Review the codebase architecture
- Ask questions in issues
- Refer to the modular design patterns

Thank you for contributing to SLO Poker! 🎮♠️♥️♦️♣️
