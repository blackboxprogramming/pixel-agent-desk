# Known Issues

## 1. Zombie/Ghost Avatars When Multiple Sessions Are Active Simultaneously

**Symptom**
- When multiple Claude CLI instances are open and you start chatting one at a time:
  - Zombie avatar: Gets assigned the wrong PID from another session, persisting indefinitely
  - Ghost avatar: Fails to capture PID, gets removed after ~20 seconds → re-created on next chat → repeats

**Root Cause**
- Fundamental limitations of the PID detection chain:
  1. `transcript_path → PID` (lsof/Restart Manager): On Windows, Claude does not keep JSONL files open, causing detection failure
  2. `detectClaudePidsFallback` (collects all claude processes): With multiple sessions, cannot determine which PID belongs to which session → mis-mapping
- No means to directly obtain the PID:
  - Hook `_pid` field: Defined in schema but **not actually sent** (verified via logging 2026-03-06 — `_pid=undefined` on all events)
  - JSONL transcript: This is Claude Code's conversation log file and does not record hook payloads, so verification is impossible
- There is currently no reliable way to map sessions to PIDs

**Alternatives Considered**
| Approach | Issue |
|----------|-------|
| `_pid` hook field | Not sent (unsupported by Claude Code) |
| transcript → lsof | Detection fails on Windows due to file not being held open |
| Fallback (all processes) | Mis-mapping with multiple sessions |
| Event activity (`lastActivity`) | Cannot distinguish between long waits (user input, long responses) and actual termination |

**Definitive Fix**
- Claude Code needs to include PID in hook payloads — this is currently the only reliable solution

**Reproduction Steps**
- Open 3+ Claude CLI instances (without chatting)
- Start chatting one at a time
- More easily reproduced on Windows (higher transcript→PID detection failure rate)

**Impact**
- Does not occur with normal usage (1-2 sessions)
- Even when it occurs, there is no functional impact — only avatar display instability
