# Pixel Agent Desk v2.0 - Implementation Summary

## Overview
Pixel Agent Desk v2.0는 Claude CLI의 Hook 시스템을 통해 실시간 이벤트를 수신하여 여러 개의 에이전트(서브에이전트 포함)를 픽셀 아바타로 시각화하는 앱입니다. 내장 HTTP 서버와 Claude CLI의 자동 훅 등록을 통해 별도 설정 없이 동작합니다.

## Core Components

### 1. `hook.js` - 범용 훅 스크립트
- Claude CLI의 모든 훅 이벤트를 수신하는 범용 스크립트
- `stdin`에서 JSON 데이터를 읽어 내장 HTTP 서버로 POST 전송
- 서버 다운 시에도 훅 실행을 막지 않음 (fail-silent)
- 3초 타임아웃으로 CLI 블로킹 방지

### 2. `main.js` - Electron 메인 프로세스 & HTTP 훅 서버
- **HTTP 훅 서버** (Port 47821):
  - 수신 이벤트: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `TaskCompleted`, `PermissionRequest`, `Notification`, `SubagentStart`, `SubagentStop`
  - 상태머신: 이벤트에 따라 `Working`, `Done`, `Waiting`, `Help`, `Error` 실시간 전환
- **PID 기반 생사 확인 (Liveness Checker)**: 
  - `process.kill(pid, 0)`을 통해 3초마다 실제 프로세스 생존 확인. 죽은 프로세스 즉시 제거.
- **세션 복구 (Recovery)**: 앱 시작 시 WMI를 통해 현재 실행 중인 Claude PID 목록을 확보하고 최신 세션 실시간 복구.
- **자동 훅 등록**: 앱 시작 시 `~/.claude/settings.json`에 훅 자동 등록.

### 3. `agentManager.js` - 멀티 에이전트 데이터 관리자
- `sessionId` 기반 에이전트 생명주기 관리
- 상태 관리: `Working`, `Done`, `Waiting`, `Help`, `Thinking`
- 활성 시간 추적 (`activeStartTime`, `lastDuration`)
- EventEmitter 기반 `agent-added`, `agent-updated`, `agent-removed`, `agents-cleaned` 이벤트 발송
- 10분 유휴 타임아웃 및 자동 정리

### 4. `utils.js` - 유틸리티 및 윈도우 관리
- `focusTerminal(pid)`: PowerShell 스크립트를 통해 특정 PID를 소유한 터미널 창을 최상단으로 호출
- `formatSlugToDisplayName`: Claude 세션 슬러그를 읽기 좋게 변환

### 5. `renderer.js` & `styles.css` - UI 렌더러
- **빈 상태 (0 agents) 표출**: 에이전트가 없으면 대기 아바타를 표시
- **멀티 에이전트 그리드**: 1명 이상 시 카드 뷰로 전환
- **애니메이션 최적화**: `requestAnimationFrame`을 사용한 CSS sprite 애니메이션

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude CLI                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Hook Events (All Types)                │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        │                                    │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      hook.js                                │
│  (stdin → JSON → HTTP POST to localhost:47821)              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    main.js (HTTP Hook Server)               │
│  ┌──────────────┐  ┌──────────────────┐                    │
│  │ AgentManager │◄─┤  Event Handlers  │                    │
│  │  (Events)    │  │  (Session/Tool)  │                    │
│  └──────┬───────┘  └──────────────────┘                    │
│         │                 │                                │
│         └─────────────────┘ (30m timeout check)            │
│                           │                                 │
│                    IPC (Renderer)                           │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   renderer.js                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Multi-Agent  │  │  Subagents   │  │ 0-Agent Idle │     │
│  │ (Cards Grid) │  │  (Distinct)  │  │ (Wait Pose)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. PID-Centric Life-cycle
- 단순 시간 기반 정리를 넘어 `process.kill(pid, 0)` 신호로 실제 프로세스 종료 즉시 감지 (3초 주기)
- 앱 재시작 시에도 살아있는 프로세스를 찾아 세션을 복구하는 높은 회복성

### 2. Full-Event Coverage
- `UserPromptSubmit`(시작), `Stop`(완료), `Notification`(알림) 등 모든 CLI 액션에 대응하는 정교한 상태 전이

### 3. Interactive UX
- 캐릭터 클릭 시 해당 터미널로 포커스 이동
- 에이전트가 없을 때의 Idle 아바타 유지
- 2.5초 Idle 감지 시 자동 Done 전환으로 훅 유실 대응

## Testing

1. **기본 작동 테스트**: 아무 터미널 창에서나 `claude` CLI를 켜면 대기 아바타에서 메인 에이전트가 튀어나옵니다.
2. **상태 전환 테스트**: 대화 진행 → `Working` 애니메이션 확인 → 응답 완료 시 `Done` 애니메이션 확인
3. **서브에이전트 테스트**: 복잡한 태스크를 요청하면 서브에이전트가 별도로 추가됨
4. **권한 요청 테스트**: 권한이 필요한 작업을 요청하면 `Help` 상태로 전환됨
5. **타임아웃 감시**: 30분 동안 활동이 없으면 에이전트가 자동 제거됨

---

**Version**: 2.0.0
**Refactored**: 2026-03-04 (Hook-Only Architecture)
