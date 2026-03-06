# CLAUDE.md — Pixel Agent Desk

Electron app that visualizes Claude Code CLI status as pixel avatars. Pure JS, Canvas rendering, HTTP hooks (:47821).
Do not change IPC channel names, hookSchema `additionalProperties: true`, or AVATAR_FILES sync between `renderer/config.js` and `office/office-config.js`.
See `docs/v3-architecture.md`. Tests: `npm test`. Run: `npm start`.
