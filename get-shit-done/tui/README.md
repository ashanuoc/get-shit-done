# GSD Autopilot TUI

A beautiful, React-based terminal user interface for the GSD Autopilot system.

## Features

- **Rich Visual Components**: Professional layouts with borders, spacing, and typography
- **Real-time Updates**: Live activity feed showing file operations, commits, and test runs
- **Phase Progress Tracking**: Visual progress bars and stage completion indicators
- **Cost & Time Analytics**: Real-time token usage, cost calculation, and time tracking
- **Beautiful Graphics**: ASCII art header, emoji icons, and smooth animations

## Architecture

The TUI is built with:
- **Ink 4.x** - React renderer for terminal UIs
- **React 18** - Component-based architecture
- **Yoga Layout** - Flexbox-like layout system
- **TypeScript** - Type-safe development

### Components

- `App.tsx` - Main application layout and state management
- `PhaseCard.tsx` - Phase progress display with stage tracking
- `ActivityFeed.tsx` - Real-time activity stream with icons
- `StatsBar.tsx` - Cost, time, and progress statistics
- `pipeReader.ts` - Named pipe reader for activity events

## Installation

The TUI is automatically installed when you install GSD. It requires:

- Node.js 16+ 
- npm or yarn

### Manual Installation

```bash
cd get-shit-done/tui
npm install
npm run build
```

This creates a `dist/` directory with the built TUI binary.

## Usage

The TUI is automatically launched by the autopilot script when available. It listens to activity events via a named pipe and renders the UI in real-time.

### Running Standalone

```bash
gsd-autopilot-tui
```

### Environment Variables

- `GSD_ACTIVITY_PIPE` - Path to activity pipe (default: `.planning/logs/activity.pipe`)
- `GSD_PROJECT_DIR` - Project directory path
- `GSD_LOG_DIR` - Log directory path

## Message Format

The TUI reads activity messages from the named pipe in the format:

```
STAGE:subagent-type:description
FILE:operation:path
COMMIT:message
TEST:test
INFO:message
ERROR:message
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run build -- --watch
```

### Project Structure

```
tui/
├── components/          # React components
│   ├── PhaseCard.tsx
│   ├── ActivityFeed.tsx
│   └── StatsBar.tsx
├── utils/              # Utilities
│   └── pipeReader.ts
├── App.tsx             # Main application
├── index.tsx           # Entry point
├── build.js            # Build script
└── package.json        # Dependencies
```

## License

MIT - Part of GSD (Get Shit Done) project
