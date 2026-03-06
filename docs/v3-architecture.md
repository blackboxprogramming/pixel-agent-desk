# Pixel Agent Desk v3.0 — Comprehensive Architecture & Implementation Guide

**Date:** 2026-03-05
**Author:** Antigravity (Architecture Review)
**Purpose:** Design document ready for implementation models (Sonnet/GLM etc.) to start working immediately

**Progress Status (2026-03-06 Update):**
- ✅ **Phase 3A:** Data pipeline overhaul completed (2026-03-05)
- ✅ **Phase 3B-1:** Dashboard server enhancement (SSE, API) completed (2026-03-05)
- ✅ **Phase 3B-2:** REST API extension completed (2026-03-05)
- ✅ **Phase 3B-3:** Dashboard UI redesign completed (2026-03-05)
- ✅ **Refactoring:** src/ folder structure, main.js split into 7 modules, renderer.js split into 7 modules (2026-03-06)
- ✅ **Virtual Office:** Added 2D pixel art virtual office tab to dashboard (2026-03-06)
  - 9 JS modules (`src/office/*`): config, layers, coords, pathfinder, sprite, character, renderer, ui, init
  - A* pathfinding (collision.webp-based 32px grid)
  - State-to-zone mapping (working→desk, idle→break area), seat assignment, Y-sort rendering
  - Sprite animations (sit/walk/dance/idle), speech bubbles, name tags, effects (confetti/warning/focus)
  - Taskbar pet ↔ office avatar synchronization (deterministic hash `avatarIndexFromId()`)
- ✅ **Legacy code cleanup** (2026-03-06)
  - Dead code removal (utils.js, dashboardAdapter.js, errorConstants.js, dashboardPreload.js)
  - MODEL_PRICING consolidation (`src/pricing.js`), install.js ↔ hookRegistration.js deduplication
  - hooks.jsonl legacy code removal (hook.js, sessionPersistence.js)
  - Office module var→const/let conversion, pixel_office/ directory deletion

---

## 1. Project Overview

### 1.1 Current State (As-Is)

Pixel Agent Desk is an **Electron-based desktop app** that visualizes Claude Code CLI status in real-time as pixel avatars.

**Core Components:**

| Component | File | Role |
|---------|------|------|
| Main Orchestrator | `src/main.js` (~230 lines) | Module initialization, event wiring, app lifecycle |
| Hook Registration | `src/main/hookRegistration.js` | Claude CLI settings read/write/hook registration |
| Hook Server | `src/main/hookServer.js` | HTTP hook server (schema, AJV) |
| Hook Processor | `src/main/hookProcessor.js` | processHookEvent() switch + helpers |
| Liveness Checker | `src/main/livenessChecker.js` | PID detection, 2-second interval check |
| Session Persistence | `src/main/sessionPersistence.js` | state.json save/restore |
| Window Manager | `src/main/windowManager.js` | Main/dashboard window management |
| IPC Handlers | `src/main/ipcHandlers.js` | All IPC handlers |
| Renderer (7 modules) | `src/renderer/*.js` | Pixel avatar, grid, keyboard, error UI |
| Hook Script | `src/hook.js` | Claude CLI stdin → HTTP POST bridge (fallback for command type) |
| Agent Manager | `src/agentManager.js` (218 lines) | Agent state management, event emitting |
| Dashboard Server | `src/dashboard-server.js` (497 lines) | REST API + WebSocket dashboard |
| Dashboard UI | `dashboard.html` (18KB) | Web dashboard (plain HTML) |
| Virtual Office | `src/office/*.js` (9 modules) | 2D pixel art virtual office (Canvas) |

**Current State Flow:**
```
Claude CLI ──HTTP hook──▶ POST(:47821) ──▶ hookProcessor.processHookEvent()
                                                    │
                                    ┌────────────────┤
                                    ▼                ▼
                            agentManager       dashboard-server
                                │                    │
                                ▼                    ▼
                          renderer/*           dashboard.html
                        (pixel avatar)       (web dashboard + Office view)
```

### 1.2 Reference Project: Mission Control (Deleted)

> Mission Control (reffer/ directory) was deleted after reference. Below is the list of key features referenced.

| Feature | Mission Control Implementation | Our Project Adoption Status |
|---------|-------------------------------|---------------------------|
| **Claude session scanning** | `claude-sessions.ts` — JSONL parsing | ✅ `sessionScanner.js` implemented |
| **Real-time events** | SSE (`/api/events`) + EventBus | ✅ SSE stream implemented |
| **Office visualization** | `office-panel.tsx` — 2D tilemap, A* | ✅ `src/office/*` 9 modules implemented |
| **Token/cost tracking** | `token_usage` table | ✅ PostToolUse + JSONL scan dual tracking |
| **State management** | Zustand store | ✅ EventEmitter + SSE-based synchronization |

### 1.3 Claude Code Hooks Latest Specification (Based on Official Documentation)

**Common Input Fields (All Hook Events):**
```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

**Newly Added/Confirmed Fields:**
- `source` (SessionStart): `"startup"`, `"resume"`, `"clear"`, `"compact"`
- `model` (SessionStart): Model name in use
- `agent_type` (SessionStart): Agent type when using `--agent`
- `agent_id`: Agent identifier in `--agent` mode

**4 Hook Types:**
1. `command` — Shell command (our existing approach)
2. `http` — HTTP POST (our hybrid approach currently in use)
3. `prompt` — LLM evaluation (new)
4. `agent` — Sub-agent creation (new)

---

## 2. Previous Code Issues & Resolution Status

> All items below have been resolved in Phase 3A/3B work.

### 2.1 Hook Data Processing — ✅ Resolved
- Schema corrected in `hookServer.js` with proper field names (`hook_event_name`, `session_id`, `tool_name`, etc.)
- `additionalProperties: true` maintained (since Claude may add new fields)

### 2.2 transcript_path Utilization — ✅ Resolved
- `hookProcessor.js` saves `data.transcript_path` as `jsonlPath`
- `sessionScanner.js` parses JSONL every 60 seconds to supplement token/cost data

### 2.3 Dual sessionId — ✅ Resolved
- `session_id` (Claude CLI, snake_case) used with priority, `sessionId` (JSONL, camelCase) as fallback
- Unified with `const sessionId = data.session_id || data.sessionId;` pattern

---

## 3. Final Product Architecture (To-Be)

### 3.1 Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Claude Code CLI                             │
│  (SessionStart, PreToolUse, PostToolUse, Stop, SubagentStart...) │
└──────────┬──────────────────────────────────────┬────────────────┘
           │ hook.js (command)                     │ ~/.claude/projects/
           │ stdin → HTTP POST                     │ JSONL session logs
           ▼                                       ▼
┌──────────────────────┐              ┌────────────────────────┐
│  Hook HTTP Server    │              │  Session Scanner       │
│  :47821/hook         │              │  (60s interval polling) │
│  Real-time event rx  │              │  transcript_path parse  │
└──────────┬───────────┘              └────────────┬───────────┘
           │                                       │
           ▼                                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    State Manager (Unified)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ AgentState   │  │ SessionData  │  │ TokenUsage          │ │
│  │ Map<id,agent>│  │ JSONL analysis│  │ Input/output/cost   │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Pixel Avatar    │ │  Web Dashboard   │ │  SSE Event       │
│  (Electron)      │ │  (localhost:3000) │ │  Stream          │
│  renderer.js     │ │  dashboard.html   │ │  /api/events     │
│  Sprite animation │ │  Charts/stats/    │ │  Real-time push   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 3.2 State Lifecycle

```
                    ┌──────────────────────────────────────────┐
                    │           SessionStart                    │
                    │  source: startup/resume/clear/compact     │
                    └──────────────┬───────────────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │         Waiting               │
                    │  (Session started, awaiting   │
                    └──────────────┬───────────────┘
                                   │ UserPromptSubmit
                                   ▼
                    ┌──────────────────────────────┐
              ┌────▶│         Thinking              │◀────────┐
              │     │  (Input received, generating   │         │
              │     └──────────────┬───────────────┘         │
              │                    │ PreToolUse (from 2nd)    │
              │                    ▼                          │
              │     ┌──────────────────────────────┐         │
              │     │         Working               │         │
              │     │  (Tool execution in progress)  │         │
              │     └──────────────┬───────────────┘         │
              │                    │ PostToolUse              │
              │                    ├─────────────────────────┘
              │                    │ (2.5s idle → Done)
              │                    ▼
              │     ┌──────────────────────────────┐
              │     │         Done                  │
              │     │  (Stop/TaskCompleted)          │
              │     └──────────────┬───────────────┘
              │                    │ UserPromptSubmit
              │                    │ (next turn)
              └────────────────────┘

  * PostToolUseFailure/Notification/PermissionRequest → Help
  * SubagentStart → Child agent creation (Working)
  * SubagentStop → Child agent removal
  * TeammateIdle → Waiting (team member)
  * SessionEnd → Agent removal
```

### 3.3 Avatar ↔ Dashboard State Synchronization

**Synchronization Strategy: Single Source of Truth**

```
AgentManager (SSoT)
    │
    ├── emit('agent-added')    ──▶ renderer.js (IPC)  ──▶ Avatar creation
    ├── emit('agent-updated')  ──▶ renderer.js (IPC)  ──▶ Animation change
    ├── emit('agent-removed')  ──▶ renderer.js (IPC)  ──▶ Avatar removal
    │
    ├── broadcastUpdate()      ──▶ SSE stream          ──▶ Dashboard real-time
    └── REST API (/api/agents) ──▶ Dashboard polling fallback
```

**State Mapping (Avatar ↔ Dashboard):**

| AgentManager State | Avatar Animation | Dashboard Display | Color |
|-------------------|-----------------|-------------|------|
| `Waiting` | idle_blink | 🟡 Waiting | `#f59e0b` |
| `Thinking` | thinking_dots | 💭 Thinking | `#8b5cf6` |
| `Working` | typing_fast | 💻 Working | `#3b82f6` |
| `Done` | celebration | ✅ Done | `#22c55e` |
| `Help` | alert_bounce | ⚠️ Help | `#ef4444` |
| `Error` | error_shake | 🔴 Error | `#dc2626` |

### 3.4 Real-time Guarantee Strategy

**Hybrid Approach: Hook (Push) + Log Scan (Poll)**

| Channel | Method | Latency | Purpose |
|---------|--------|---------|---------|
| HTTP Hook | Push (immediate) | <100ms | State transitions (Working, Done, Help) |
| JSONL Scan | Poll (60s) | ~60s | Token usage, session metadata, cost |
| PID Liveness | Poll (10s) | ~10s | Process liveness check, ghost agent cleanup |
| SSE Stream | Push (immediate) | <50ms | Dashboard UI real-time updates |

```javascript
// Real-time layer structure
// Layer 1: HTTP Hook (immediate) — Primary channel for state changes
processHookEvent(data) → agentManager.updateAgent() → emit events

// Layer 2: JSONL Scanner (60s) — Supplementary data enrichment
scanTranscripts() → token usage, conversation stats, cost calculation

// Layer 3: Liveness Checker (10s) — Stability guarantee
checkLiveness() → process termination detection, ghost agent cleanup

// Layer 4: SSE/WebSocket (immediate) — UI propagation
agentManager.on('*') → SSE broadcast → dashboard refresh
```

---

## 4. Implementation Roadmap

### Phase 3A: Data Pipeline Overhaul (Completed ✅)

#### Task 3A-1: Hook Schema Fix (Completed ✅)
**File:** `main.js:startHookServer()` (lines 491-580)

```javascript
// Target for modification: hookSchema object
const hookSchema = {
  type: 'object',
  required: ['hook_event_name'],
  properties: {
    hook_event_name: {
      type: 'string',
      enum: [
        'SessionStart', 'SessionEnd', 'UserPromptSubmit',
        'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
        'Stop', 'TaskCompleted', 'PermissionRequest', 'Notification',
        'SubagentStart', 'SubagentStop', 'TeammateIdle',
        'ConfigChange', 'WorktreeCreate', 'WorktreeRemove',
        'PreCompact', 'InstructionsLoaded'
      ]
    },
    session_id: { type: 'string' },
    transcript_path: { type: 'string' },
    cwd: { type: 'string' },
    permission_mode: { type: 'string' },
    tool_name: { type: 'string' },
    tool_input: { type: 'object' },
    tool_response: { type: 'object' },
    source: { type: 'string' },
    model: { type: 'string' },
    agent_type: { type: 'string' },
    agent_id: { type: 'string' },
    _pid: { type: 'number' },
    _timestamp: { type: 'number' }
  },
  additionalProperties: true  // Maintained since Claude may add new fields
};
```

#### Task 3A-2: transcript_path Utilization (Completed ✅)
**File:** `main.js:processHookEvent()` (lines 369-489), `agentManager.js`

```javascript
// main.js — SessionStart handler modification
case 'SessionStart':
  handleSessionStart(sessionId, data.cwd || '', data._pid || 0);
  // Added: metadata storage
  if (agentManager) {
    agentManager.updateAgent({
      sessionId,
      projectPath: data.cwd,
      jsonlPath: data.transcript_path,     // ★ Key addition
      model: data.model,                    // ★ Model info
      permissionMode: data.permission_mode,  // ★ Permission mode
      source: data.source,                   // ★ startup/resume
      agentType: data.agent_type,            // ★ Agent type
      state: 'Waiting'
    }, 'hook');
  }
  break;
```

```javascript
// agentManager.js — New fields added
const agentData = {
  // ... existing fields
  model: entry.model || (existingAgent ? existingAgent.model : null),
  permissionMode: entry.permissionMode || (existingAgent ? existingAgent.permissionMode : null),
  source: entry.source || (existingAgent ? existingAgent.source : null),
  agentType: entry.agentType || (existingAgent ? existingAgent.agentType : null),
  // Token usage tracking
  tokenUsage: {
    inputTokens: existingAgent?.tokenUsage?.inputTokens || 0,
    outputTokens: existingAgent?.tokenUsage?.outputTokens || 0,
    estimatedCost: existingAgent?.tokenUsage?.estimatedCost || 0,
  },
};
```

#### Task 3A-3: Token Usage Extraction (Completed ✅)
**File:** `main.js:processHookEvent()` — PostToolUse handler

```javascript
case 'PostToolUse': {
  if (agentManager && firstPreToolUseDone.has(sessionId)) {
    const agent = agentManager.getAgent(sessionId);
    if (agent) {
      // ★ Token usage extraction
      const tokenUsage = data.tool_response?.token_usage;
      if (tokenUsage) {
        const currentUsage = agent.tokenUsage || { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
        const inputTokens = currentUsage.inputTokens + (tokenUsage.input_tokens || 0);
        const outputTokens = currentUsage.outputTokens + (tokenUsage.output_tokens || 0);
        const pricing = MODEL_PRICING[agent.model] || DEFAULT_PRICING;
        const estimatedCost = inputTokens * pricing.input + outputTokens * pricing.output;
        
        agentManager.updateAgent({
          ...agent, sessionId,
          state: 'Thinking',
          tokenUsage: { inputTokens, outputTokens, estimatedCost }
        }, 'hook');
      } else {
        agentManager.updateAgent({ ...agent, sessionId, state: 'Thinking' }, 'hook');
      }
    }
  }
  scheduleIdleDone(sessionId);
  break;
}
```

#### Task 3A-4: JSONL Session Scanner (Completed ✅)
**New file:** `sessionScanner.js`

```javascript
/**
 * Session Scanner — Implementation referencing Mission Control's claude-sessions.ts
 * Reads JSONL files via transcript_path and extracts session statistics
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODEL_PRICING = {
  'claude-opus-4-6': { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  'claude-sonnet-4-6': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  'claude-haiku-4-5': { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
};
const DEFAULT_PRICING = { input: 3 / 1_000_000, output: 15 / 1_000_000 };

class SessionScanner {
  constructor(agentManager) {
    this.agentManager = agentManager;
    this.scanInterval = null;
    this.lastScanResults = new Map(); // sessionId → stats
  }

  start(intervalMs = 60000) {
    this.scanInterval = setInterval(() => this.scanAll(), intervalMs);
    this.scanAll(); // Execute once immediately
  }

  stop() {
    if (this.scanInterval) clearInterval(this.scanInterval);
  }

  scanAll() {
    const agents = this.agentManager.getAllAgents();
    for (const agent of agents) {
      if (agent.jsonlPath) {
        try {
          const stats = this.parseSessionFile(agent.jsonlPath);
          if (stats) {
            this.lastScanResults.set(agent.id, stats);
            // Update token usage (supplement what hooks missed)
            if (stats.inputTokens > (agent.tokenUsage?.inputTokens || 0)) {
              this.agentManager.updateAgent({
                ...agent,
                tokenUsage: {
                  inputTokens: stats.inputTokens,
                  outputTokens: stats.outputTokens,
                  estimatedCost: stats.estimatedCost,
                }
              }, 'scanner');
            }
          }
        } catch (e) { /* log */}
      }
    }
  }

  parseSessionFile(filePath) {
    // Referenced Mission Control's parseSessionFile() pattern
    const resolvedPath = filePath.replace(/^~/, os.homedir());
    if (!fs.existsSync(resolvedPath)) return null;
    
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    
    let model = null, userMessages = 0, assistantMessages = 0;
    let toolUses = 0, inputTokens = 0, outputTokens = 0;
    let cacheReadTokens = 0, cacheCreationTokens = 0;
    let firstMessageAt = null, lastMessageAt = null;
    
    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      
      if (entry.timestamp) {
        if (!firstMessageAt) firstMessageAt = entry.timestamp;
        lastMessageAt = entry.timestamp;
      }
      if (entry.isSidechain) continue;
      
      if (entry.type === 'user') userMessages++;
      if (entry.type === 'assistant' && entry.message) {
        assistantMessages++;
        if (entry.message.model) model = entry.message.model;
        const usage = entry.message.usage;
        if (usage) {
          inputTokens += (usage.input_tokens || 0);
          cacheReadTokens += (usage.cache_read_input_tokens || 0);
          cacheCreationTokens += (usage.cache_creation_input_tokens || 0);
          outputTokens += (usage.output_tokens || 0);
        }
        if (Array.isArray(entry.message.content)) {
          for (const block of entry.message.content) {
            if (block.type === 'tool_use') toolUses++;
          }
        }
      }
    }
    
    const pricing = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
    const totalInputTokens = inputTokens + cacheReadTokens + cacheCreationTokens;
    const estimatedCost =
      inputTokens * pricing.input +
      cacheReadTokens * pricing.input * 0.1 +
      cacheCreationTokens * pricing.input * 1.25 +
      outputTokens * pricing.output;
    
    return {
      model, userMessages, assistantMessages, toolUses,
      inputTokens: totalInputTokens, outputTokens,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000,
      firstMessageAt, lastMessageAt,
    };
  }

  getSessionStats(agentId) {
    return this.lastScanResults.get(agentId) || null;
  }

  getAllStats() {
    return Object.fromEntries(this.lastScanResults);
  }
}

module.exports = SessionScanner;
```

### Phase 3B: Dashboard Enhancement (Completed ✅)

#### Task 3B-1: SSE Event Stream Addition (Completed ✅)
**File:** `dashboard-server.js` — SSE endpoint addition

```javascript
// /api/events — SSE stream (Mission Control's event-bus.ts pattern)
if (url.pathname === '/api/events') {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  
  // Initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  
  // AgentManager event listeners
  const onAgentAdded = (agent) =>
    res.write(`data: ${JSON.stringify({ type: 'agent.created', data: adaptAgentToDashboard(agent), timestamp: Date.now() })}\n\n`);
  const onAgentUpdated = (agent) =>
    res.write(`data: ${JSON.stringify({ type: 'agent.updated', data: adaptAgentToDashboard(agent), timestamp: Date.now() })}\n\n`);
  const onAgentRemoved = (data) =>
    res.write(`data: ${JSON.stringify({ type: 'agent.removed', data, timestamp: Date.now() })}\n\n`);
  
  agentManager.on('agent-added', onAgentAdded);
  agentManager.on('agent-updated', onAgentUpdated);
  agentManager.on('agent-removed', onAgentRemoved);
  
  // Keep-alive
  const keepAlive = setInterval(() =>
    res.write(`: keepalive\n\n`), 15000);
  
  req.on('close', () => {
    clearInterval(keepAlive);
    agentManager.off('agent-added', onAgentAdded);
    agentManager.off('agent-updated', onAgentUpdated);
    agentManager.off('agent-removed', onAgentRemoved);
  });
  return;
}
```

#### Task 3B-2: REST API Extension (Completed ✅)
**File:** `dashboard-server.js`

```javascript
// Additional API endpoints
// GET /api/agents — Agent list (with adapter applied)
// GET /api/agents/:id — Agent details (including token usage)
// GET /api/stats — Overall statistics (by status, project, cost)
// GET /api/timeline — Task timeline (chronological state change history)
// GET /api/health — System status (uptime, memory, connection count)
// POST /api/agents/:id/dismiss — Manual agent removal
// GET /api/sessions — JSONL scan results (tokens, cost, session metadata)
```

#### Task 3B-3: Dashboard UI Redesign (Completed ✅)
**File:** `dashboard.html` (complete rewrite based on SSE)

**Implemented Features:**
- SSE connection using EventSource (`/api/events`)
- Real-time agent status updates (flicker-free DOM updates)
- 3 views: Overview, Agents, Tokens
- Stats Grid: Total agents, active agents, completed tasks, total cost
- Agent Cards: Status badge, project name, model, work duration, token usage
- Token Chart: Per-agent token usage visualization (CSS bar chart)
- Live Feed: Real-time event log (sidebar)
- Per-project agent grouping
- Responsive design (mobile support)

**Dashboard Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ 📊 Pixel Agent Desk — Mission Control                    │
├─────────┬───────────────────────────────────────────────┤
│         │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│ Side    │  │ Active │ │ Total  │ │ Tokens │ │  Cost  │ │
│  bar    │  │   3    │ │   5    │ │  45.2K │ │ $1.23  │ │
│         │  └────────┘ └────────┘ └────────┘ └────────┘ │
│ ● Overview│                                              │
│ ○ Agents │  ┌──────────────────────────────────────────┐ │
│ ○ Timeline│  │         Agent card grid                  │ │
│ ○ Tokens │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │ │
│ ○ Settings│  │  │ 🟢 Alice│ │ 💻 Bob  │ │ ⚠️ Carol│    │ │
│          │  │  │ Done    │ │ Working │ │  Help   │    │ │
│          │  │  │ 12.3K ¢ │ │ 8.1K ¢  │ │ 5.2K ¢  │    │ │
│          │  │  └─────────┘ └─────────┘ └─────────┘    │ │
│          │  └──────────────────────────────────────────┘ │
│          │                                               │
│ ● Events │  ┌──────────────────────────────────────────┐ │
│ (Live)   │  │      Timeline / token chart area           │ │
│  12:01   │  │  ████████████░░░░░░ Working: 60%         │ │
│  12:00   │  │  ████░░░░░░░░░░░░░ Done: 20%             │ │
│  11:59   │  └──────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────┘
```

**Key UI Components:**

1. **Stats Grid** — Active agent count, total tokens, cost, error count
2. **Agent Cards** — Status badge, project name, model, work duration, token usage
3. **Timeline** — Time-axis-based per-agent state change visualization (CSS bar chart)
4. **Live Feed** — SSE-based real-time event log
5. **Token Chart** — Per-agent/per-model token usage bar chart

---

## 5. Implementation Stack & Technical Decisions

### 5.1 Technology Stack

| Layer | Current | Changes/Additions |
|-------|---------|-------------------|
| Runtime | Electron + Node.js | Maintained |
| Avatar Rendering | Canvas sprites | Maintained (requestAnimationFrame) |
| Dashboard UI | Plain HTML/CSS/JS | Maintained (no framework needed) |
| Real-time Communication | WebSocket (manual) | **SSE added** (for dashboard) |
| State Management | EventEmitter | Maintained + event type enhancement |
| Data Storage | JSON (state.json) | Maintained (soft limit 50, no blocking) |
| Session Analysis | None | **JSONL scanner added** |
| Validation | AJV | AJV schema modified |
| Charts | None | **CSS-only bar charts** |

### 5.2 What We Did NOT Adopt from Mission Control

| Feature | Reason |
|---------|--------|
| Next.js/React | Our project uses Electron + vanilla JS, would be overkill |
| SQLite | JSON is sufficient for typical usage (revisit if exceeding 50) |
| Zustand | Electron IPC-based state management is sufficient |
| Auth/RBAC | Local desktop app, authentication unnecessary |
| Tailwind CSS | Keeping existing vanilla CSS |

---

## 6. Per-File Modification Guide (For Implementation Models)

### Files to Modify

| File | Task | Priority | Estimated Time |
|------|------|----------|----------------|
| `main.js` | hookSchema fix, add metadata to processHookEvent | P0 | 4h |
| `agentManager.js` | Add new fields (model, tokenUsage, etc.) | P0 | 3h |
| `hook.js` | Add JSON parsing error logging | P0 | 1h |
| `dashboardAdapter.js` | Add token/cost/model field mapping | P0 | 2h |
| `dashboard-server.js` | SSE endpoint, API extension | P1 | 6h |
| `dashboard.html` | UI redesign (Stats, Cards, Timeline) | P1 | 12h |
| **`sessionScanner.js`** | **New** — JSONL session analyzer | P1 | 8h |

### Cautions

1. **`main.js` is 1266 lines** — Modify precisely at the function level
2. **IPC channel compatibility** — Do not change channel names registered in `preload.js`
3. **renderer.js state mapping** — When adding new states to the `updateAgentState()` switch statement, preserve existing animations
4. **Windows paths** — `transcript_path` may contain `~`, must convert with `os.homedir()`
5. **Async I/O** — JSONL file reading must be async, do not block the main thread

---

## 7. Validation Checklist

### Phase 3A Completion Criteria (Completed ✅)

- [x] `transcript_path`, `model`, `source` received correctly from Claude CLI hooks
- [x] Model info accessible via `agentManager.getAgent(id).model`
- [x] Token usage accessible via `agentManager.getAgent(id).tokenUsage`
- [x] JSONL scanner refreshes session statistics every 60 seconds
- [x] Schema fix confirmed for `tool_name` field name
- [x] `session_id` vs `sessionId` dual field cleanup (convention unified)

### Phase 3B Completion Criteria (Completed ✅)

- [x] `GET /api/events` SSE stream working correctly
- [x] Agent state changes reflected in real-time on dashboard (<1 second)
- [x] Token usage and cost displayed
- [x] Token chart visualization rendering correctly
- [x] Agent cards showing model name, project name, work duration

---

> **This document is designed so that implementation models (Sonnet/GLM) can start working immediately.**
> Refer to each Task's file names, line numbers, and code snippets to implement sequentially.
