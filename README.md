# Pixel Agent Desk

An Electron desktop app that receives Claude Code CLI hook events in real time and visualizes agent states as pixel avatars.

## Features

- **Pixel Avatar** — Displays agent states (Waiting / Thinking / Working / Done / Help / Error) as sprite animations
- **Virtual Office** — Characters walk around a 2D pixel art virtual office, visualizing state changes (A* pathfinding)
- **Activity Heatmap** — GitHub-style daily activity heatmap
- **Dashboard** — Web dashboard for monitoring overall status (REST API + SSE)
- **Terminal Focus** — Click an avatar to bring the corresponding Claude session's terminal window to the foreground
- **Auto Recovery** — Automatically restores running Claude sessions on app restart
- **Sub-agent & Team** — Supports sub-agents and team mode, with no limit on agent count

## Tech Stack

- **Runtime:** Electron 32+ / Node.js
- **Language:** JavaScript (no TypeScript, no framework)
- **Rendering:** Canvas sprite animation (requestAnimationFrame)
- **Validation:** AJV (JSON Schema)
- **Test:** Jest 30

## Quick Start

```bash
npm install   # Install dependencies + auto-register Claude CLI hooks
npm start     # Launch the Electron app
```

> Running `npm install` automatically registers HTTP hooks in `~/.claude/settings.json`.
> On app startup, hooks are re-registered if not already present (double guarantee).

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch the Electron app |
| `npm run dev` | Development mode (with DevTools) |
| `npm run dashboard` | Run dashboard server only (http://localhost:3000) |
| `npm test` | Run tests |
| `npm run test:coverage` | Coverage report |

## Architecture

```
Claude CLI ──HTTP hook──> POST(:47821) ──hookProcessor
                                            │
                              ┌─────────────┤
                              v             v
                        AgentManager   Dashboard Server
                          (SSoT)       (:3000, SSE/REST)
                            │               │
                  ┌─────────┼─────────┐     ├── Office Tab (Canvas 2D)
                  v         v         v     ├── Dashboard Tab
            renderer/*  dashboard  scanner  └── Tokens Tab
           (pixel avatar) (web UI) (JSONL)
```

## Project Structure

```
src/
├── main.js                    # App orchestrator
├── main/
│   ├── hookServer.js          # HTTP hook server (:47821)
│   ├── hookProcessor.js       # Event processing logic
│   ├── hookRegistration.js    # Claude CLI hook auto-registration
│   ├── livenessChecker.js     # PID-based liveness checking
│   ├── windowManager.js       # Electron window management
│   ├── ipcHandlers.js         # IPC handlers
│   └── sessionPersistence.js  # State persistence
├── renderer/                  # Pixel avatar UI (7 modules)
├── office/                    # Virtual office view (9 modules)
├── agentManager.js            # Agent state management (SSoT)
├── sessionScanner.js          # JSONL token/cost analysis
├── heatmapScanner.js          # Daily activity heatmap aggregation
├── dashboard-server.js        # Dashboard web server
└── pricing.js                 # Per-model token pricing
```

## State Model

```
SessionStart       → Waiting
UserPromptSubmit   → Thinking
PreToolUse (2nd+)  → Working
PostToolUse        → Thinking (2.5s idle → Done)
Stop/TaskCompleted → Done
Notification       → Help
SessionEnd         → Remove
```

## Hook Registration

Hooks are registered as HTTP type in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "*", "hooks": [{ "type": "http", "url": "http://localhost:47821/hook" }] }]
  }
}
```

If auto-registration fails, you can manually register using the format above.

## License

MIT
