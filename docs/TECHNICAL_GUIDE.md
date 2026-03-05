# Pixel Agent Desk 기술 가이드

## 1. 개요 (Overview)

### 1.1 프로젝트 소개

**Pixel Agent Desk**는 Claude CLI의 멀티 에이전트 활동을 실시간으로 시각화하는 Electron 기반 데스크톱 애플리케이션입니다. 픽셀 아트 스타일의 캐릭터가 각 에이전트의 작업 상태를 직관적으로 표현하며, 여러 프로젝트의 에이전트를 동시에 모니터링할 수 있습니다.

### 1.2 핵심 기능

- **실시간 에이전트 모니터링**: Claude CLI 훅 이벤트를 통해 에이전트 상태 감지
- **멀티 에이전트 지원**: 최대 10개의 에이전트를 동시에 표시
- **자동 세션 복구**: 앱 재시작 시 활성 세션 자동 복구
- **동적 윈도우 크기**: 에이전트 수에 따라 창 크기 자동 조절
- **터미널 포커스**: 에이전트 클릭 시 해당 터미널 창 자동 포커스

### 1.3 기술 스택

| 구성요소 | 기술 | 버전 |
|---------|------|------|
| 프레임워크 | Electron | ^32.0.0 |
| 언어 | JavaScript (Node.js) | - |
| UI | HTML5, CSS3 | - |
| 통신 | IPC, HTTP Server | - |

### 1.4 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                     Pixel Agent Desk                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Renderer   │◄────►│     Main     │◄────►│ AgentManager │  │
│  │  (renderer)  │  IPC │   (main)     │Event │  (agentMgr)  │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         ▲                      │                       ▲        │
│         │                      │                       │        │
│         │                      ▼                       │        │
│         │              ┌──────────────┐               │        │
│         │              │ Hook Server  │               │        │
│         │              │   (HTTP)     │               │        │
│         │              └──────────────┘               │        │
│         │                      ▲                       │        │
│         │                      │                       │        │
│  ┌──────────────┐      ┌──────────────┐               │        │
│  │    Preload   │      │   hook.js    │               │        │
│  │  (preload)   │      │  (CLI Hook)  │               │        │
│  └──────────────┘      └──────────────┘               │        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Claude CLI     │
                    │  (Agent Activity)│
                    └──────────────────┘
```

---

## 2. 아키텍처 (Architecture)

### 2.1 시스템 아키텍처

Pixel Agent Desk는 **Electron의 멀티 프로세스 아키텍처**를 기반으로 동작합니다:

- **Main Process**: 애플리케이션 진입점, 윈도우 관리, 훅 서버 운영
- **Renderer Process**: UI 렌더링, 사용자 인터랙션 처리
- **Preload Script**: 메인과 렌더러 간의 안전한 IPC 브릿지

### 2.2 프로세스 구조

```
┌──────────────────────────────────────────────────────────────┐
│                        Main Process                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Responsibilities:                                      │ │
│  │  • BrowserWindow 생명주기 관리                          │ │
│  │  • HTTP 훅 서버 (PORT 47821)                            │ │
│  │  • Claude CLI settings.json 훅 자동 등록               │ │
│  │  • 프로세스 생사 확인 (PID 모니터링)                    │ │
│  │  • 세션 복구 시스템                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      Renderer Process                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Responsibilities:                                      │ │
│  │  • 에이전트 카드 UI 생성                                 │ │
│  │  • 스프라이트 애니메이션 제어                            │ │
│  │  • 그리드 레이아웃 관리                                 │ │
│  │  • 타이머 및 상태 표시                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 통신 계층

애플리케이션은 세 가지 통신 방식을 사용합니다:

#### 2.3.1 IPC (Inter-Process Communication)
- **용도**: Main ↔ Renderer 간 양방향 통신
- **구현**: `ipcMain`, `ipcRenderer` (preload.js 통해 노출)
- **채널 예시**:
  - `agent-added`: 새 에이전트 추가
  - `agent-updated`: 에이전트 상태 변경
  - `agent-removed`: 에이전트 제거
  - `focus-terminal`: 터미널 포커스 요청

#### 2.3.2 HTTP Server
- **용도**: Claude CLI 훅 이벤트 수신
- **포트**: 47821 (localhost)
- **엔드포인트**: POST `/hook`
- **구현**: `main.js:196-341`

#### 2.3.3 Event Emitter
- **용도**: 내부 모듈 간 느슨한 결합
- **구현**: Node.js EventEmitter
- **이벤트**: `agent-added`, `agent-updated`, `agent-removed`, `agents-cleaned`

### 2.4 데이터 흐름

```
Claude CLI Activity
       │
       ▼
┌──────────────────┐
│   hook.js        │ stdin으로 JSON 수신
│  (CLI Hook)      │
└────────┬─────────┘
         │ HTTP POST
         ▼
┌──────────────────┐
│  Hook Server     │ event parsing
│  (main.js:196)   │
└────────┬─────────┘
         │ AgentManager.updateAgent()
         ▼
┌──────────────────┐
│  AgentManager    │ 상태 관리
│  (agentMgr.js)   │
└────────┬─────────┘
         │ Event emit
         ▼
┌──────────────────┐
│   Main Process   │ IPC send
│   IPC Handler    │
└────────┬─────────┘
         │ IPC
         ▼
┌──────────────────┐
│   Renderer       │ UI update
│  (renderer.js)   │
└──────────────────┘
```

---

## 3. 핵심 모듈 (Core Modules)

### 3.1 main.js

#### 3.1.1 윈도우 관리

**동적 윈도우 크기 계산** (`main.js:21-47`)

```javascript
function getWindowSizeForAgents(count) {
  if (count <= 1) return { width: 220, height: 210 };

  const CARD_W = 90;
  const GAP = 10;
  const OUTER = 120;
  const ROW_H = 160;
  const BASE_H = 210;
  const maxCols = 5;

  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / maxCols);

  const width = Math.max(220, cols * CARD_W + (cols - 1) * GAP + OUTER);
  const height = BASE_H + (rows - 1) * ROW_H;

  return { width, height };
}
```

**윈도우 생성** (`main.js:52-90`)

```javascript
function createWindow() {
  const winSize = getWindowSizeForAgents(0);

  mainWindow = new BrowserWindow({
    width: winSize.width,
    height: winSize.height,
    transparent: true,      // 투명 배경
    frame: false,           // 프레임 없음
    alwaysOnTop: true,      // 항상 위
    skipTaskbar: true,      // 작업표시줄 표시 안 함
    focusable: false,       // 포커스 받지 않음
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
}
```

#### 3.1.2 훅 자동 등록

**settings.json 수정** (`main.js:109-165`)

```javascript
function setupClaudeHooks() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

  if (!settings.hooks) settings.hooks = {};

  const hookScript = path.join(__dirname, 'hook.js').replace(/\\/g, '/');
  const hookCmd = `node "${hookScript}"`;

  const HOOK_EVENTS = [
    'SessionStart', 'SessionEnd',
    'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
    'Stop', 'TaskCompleted', 'SubagentStart', 'SubagentStop',
    'TeammateIdle', 'PermissionRequest', 'Notification'
  ];

  for (const eventName of HOOK_EVENTS) {
    let hooks = settings.hooks[eventName] || [];
    // 기존 훅 제거 (중복 방지)
    hooks = hooks.filter(c => !c.hooks?.some(h =>
      h.type === 'command' && h.command?.includes('hook.js')));
    hooks.push({ matcher: "*", hooks: [{
      type: "command",
      command: hookCmd
    }]});
    settings.hooks[eventName] = hooks;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');
}
```

#### 3.1.3 HTTP 훅 서버

**서버 구조** (`main.js:196-341`)

```javascript
function startHookServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/hook') {
      res.writeHead(404); res.end(); return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));

      const data = JSON.parse(body);
      const event = data.hook_event_name;
      const sessionId = data.session_id || data.sessionId;

      // 이벤트별 처리 로직
      switch (event) {
        case 'SessionStart':
          handleSessionStart(sessionId, data.cwd || '', data._pid || 0);
          break;
        case 'UserPromptSubmit':
          // Working 상태로 전환
          agentManager.updateAgent({ ...agent, state: 'Working' }, 'hook');
          break;
        case 'Stop':
        case 'TaskCompleted':
          // Done 상태로 전환
          agentManager.updateAgent({ ...agent, state: 'Done' }, 'hook');
          break;
        // ... 더 많은 이벤트 처리
      }
    });
  });

  server.listen(47821, '127.0.0.1');
}
```

#### 3.1.4 세션 복구

**활성 세션 복구** (`main.js:345-453`)

```javascript
function recoverExistingSessions() {
  // 1. 실행 중인 Claude 프로세스 PID 조회
  const psCmd = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
                 Where-Object { $_.CommandLine -like '*claude*cli.js*' } |
                 Select-Object -ExpandProperty ProcessId`;

  execFile('powershell.exe', ['-NoProfile', '-Command', psCmd],
    (err, stdout) => {
      const livePids = stdout.trim().split('\n')
        .map(p => parseInt(p.trim(), 10))
        .filter(p => !isNaN(p) && p > 0);

      // 2. ~/.claude/projects/ 스캔
      const projectsDir = path.join(os.homedir(), '.claude', 'projects');
      const candidates = [];

      for (const projectEntry of fs.readdirSync(projectsDir,
           { withFileTypes: true })) {
        if (!projectEntry.isDirectory()) continue;

        // JSONL 파일 스캔
        for (const file of fs.readdirSync(projectPath)) {
          if (!file.endsWith('.jsonl')) continue;
          candidates.push({ filePath, mtime: stat.mtimeMs });
        }
      }

      // 3. 최신 파일부터 복구
      candidates.sort((a, b) => b.mtime - a.mtime);

      for (const candidate of candidates) {
        // JSONL 끝에서 세션 정보 추출
        const buf = Buffer.alloc(Math.min(candidate.size, 8192));
        // ... 파싱 로직

        if (sessionId && !hasSessionEnd) {
          sessionPids.set(sessionId, pid);
          agentManager.updateAgent({
            sessionId, projectPath: cwd,
            displayName, state: 'Waiting'
          }, 'recover');
        }
      }
    });
}
```

#### 3.1.5 생사 확인

**PID 기반 프로세스 체크** (`main.js:461-498`)

```javascript
function startLivenessChecker() {
  const INTERVAL = 3000;   // 3초
  const GRACE_MS = 15000;  // 15초 유예
  const MAX_MISS = 2;      // 2회 연속 실패 → 제거

  setInterval(() => {
    for (const agent of agentManager.getAllAgents()) {
      // Grace 기간 내 스킵
      if (Date.now() - agent.firstSeen < GRACE_MS) continue;

      const pid = sessionPids.get(agent.id);
      if (!pid) continue;

      let alive = false;
      try {
        process.kill(pid, 0);  // 시그널 0으로 생사 확인
        alive = true;
      } catch (e) { }

      if (!alive) {
        const n = (missCount.get(agent.id) || 0) + 1;
        missCount.set(agent.id, n);

        if (n >= MAX_MISS) {
          agentManager.removeAgent(agent.id);
        }
      }
    }
  }, INTERVAL);
}
```

### 3.2 agentManager.js

#### 3.2.1 에이전트 업데이트

**상태 전이 로직** (`agentManager.js:40-101`)

```javascript
updateAgent(entry, source = 'log') {
  const agentId = entry.sessionId || entry.agentId || entry.uuid;
  const existingAgent = this.agents.get(agentId);
  const now = Date.now();

  // 최대 에이전트 수 제한
  if (!existingAgent && this.agents.size >= this.config.maxAgents) {
    return null;
  }

  const prevState = existingAgent ? existingAgent.state : null;
  let newState = entry.state || prevState || 'Done';

  // 활성 상태 진입 시점 기록
  const isPassive = (s) =>
    s === 'Done' || s === 'Help' || s === 'Error' || s === 'Waiting';
  const isActive = (s) => s === 'Working' || s === 'Thinking';

  let activeStartTime = existingAgent ? existingAgent.activeStartTime : now;
  let lastDuration = existingAgent ? existingAgent.lastDuration : 0;

  if (isActive(newState) && (isPassive(prevState) || !existingAgent)) {
    activeStartTime = now;  // 작업 시작 시각 기록
  }

  // Done 전환 시 소요 시간 저장
  if (newState === 'Done' && existingAgent && isActive(prevState)) {
    lastDuration = now - activeStartTime;
  }

  const agentData = {
    id: agentId,
    sessionId: entry.sessionId,
    displayName: this.formatDisplayName(entry.slug, entry.projectPath),
    projectPath: entry.projectPath,
    state: newState,
    activeStartTime,
    lastDuration,
    lastActivity: now,
    firstSeen: existingAgent ? existingAgent.firstSeen : now
  };

  this.agents.set(agentId, agentData);

  // 상태 변경 시에만 이벤트 emit
  if (!existingAgent) {
    this.emit('agent-added', agentData);
  } else if (newState !== prevState) {
    this.emit('agent-updated', agentData);
  }

  return agentData;
}
```

#### 3.2.2 유휴 정리

**자동 제거 타이머** (`agentManager.js:117-131`)

```javascript
cleanupIdleAgents() {
  const now = Date.now();
  const toRemove = [];

  for (const [id, agent] of this.agents.entries()) {
    // 10분 미활동 제거
    if (now - agent.lastActivity > this.config.idleTimeout) {
      toRemove.push(id);
    }
  }

  for (const id of toRemove) {
    this.removeAgent(id);
  }

  if (toRemove.length > 0) {
    this.emit('agents-cleaned', { count: toRemove.length });
  }
}
```

#### 3.2.3 표시 이름 결정

**이름 포맷팅** (`agentManager.js:143-151`)

```javascript
formatDisplayName(slug, projectPath) {
  // 1. slug 우선 (예: "toasty-sparking-lecun" → "Toasty Sparking Lecun")
  if (slug) {
    return formatSlugToDisplayName(slug);
  }
  // 2. projectPath의 basename 사용
  if (projectPath) {
    return path.basename(projectPath);
  }
  // 3. 기본값
  return 'Agent';
}
```

### 3.3 renderer.js

#### 3.3.1 스프라이트 설정

**시트 구성** (`renderer.js:10-14`)

```javascript
const SHEET = {
  cols: 9,      // 스프라이트 시트 열 수
  width: 48,    // 프레임 너비
  height: 64    // 프레임 높이
};
```

**애니메이션 시퀀스** (`renderer.js:17-22`)

```javascript
const ANIM_SEQUENCES = {
  working: {
    frames: [1, 2, 3, 4],      // 작업 중 프레임
    fps: 8,                     // 초당 8프레임
    loop: true                  // 반복 재생
  },
  complete: {
    frames: [20, 21, 22, 23, 24, 25, 26, 27],
    fps: 6,
    loop: true
  },
  waiting: {
    frames: [32],               // 대기 중 단일 프레임
    fps: 1,
    loop: true
  },
  alert: {
    frames: [0, 31],            // 경고/도움 요청
    fps: 4,
    loop: true
  }
};
```

#### 3.3.2 프레임 렌더링

**배경 위치 계산** (`renderer.js:51-58`)

```javascript
function drawFrame(element, frameIndex) {
  const col = frameIndex % SHEET.cols;
  const row = Math.floor(frameIndex / SHEET.cols);
  const x = col * -SHEET.width;   // 음수로 왼쪽 이동
  const y = row * -SHEET.height;  // 음수로 위쪽 이동

  element.style.backgroundPosition = `${x}px ${y}px`;
}
```

#### 3.3.3 애니메이션 제어

**재생 로직** (`renderer.js:60-107`)

```javascript
function playAnimation(agentId, element, animName) {
  const sequence = ANIM_SEQUENCES[animName];
  const state = agentStates.get(agentId) || {};

  // 동일 애니메이션 재생 중이면 스킵
  if (state.animName === animName) return;

  // 이전 인터벌 정리
  if (state.interval) {
    clearInterval(state.interval);
  }

  state.animName = animName;
  state.frameIdx = 0;
  agentStates.set(agentId, state);

  // 첫 프레임 즉시 렌더링
  drawFrame(element, sequence.frames[0]);

  // 애니메이션 루프
  const interval = setInterval(() => {
    const currentState = agentStates.get(agentId);
    if (!currentState) {
      clearInterval(interval);
      return;
    }

    currentState.frameIdx++;

    if (currentState.frameIdx >= sequence.frames.length) {
      if (sequence.loop) {
        currentState.frameIdx = 0;
      } else {
        clearInterval(interval);
        return;
      }
    }

    drawFrame(element, sequence.frames[currentState.frameIdx]);
  }, 1000 / sequence.fps);  // fps 간격 계산

  state.interval = interval;
  agentStates.set(agentId, state);
}
```

#### 3.3.4 에이전트 카드 생성

**카드 구조** (`renderer.js:189-316`)

```javascript
function createAgentCard(agent) {
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.dataset.agentId = agent.id;

  // 서브에이전트 표시
  if (agent.isSubagent) {
    card.classList.add('is-subagent');
  }

  // 말풍선 (상태 표시)
  const bubble = document.createElement('div');
  bubble.className = 'agent-bubble';
  bubble.textContent = 'Waiting...';

  // 캐릭터 (스프라이트)
  const character = document.createElement('div');
  character.className = 'agent-character';

  // 랜덤 아바타 할당
  let assignedAvatar = agentAvatars.get(agent.id);
  if (!assignedAvatar && availableAvatars.length > 0) {
    assignedAvatar = availableAvatars[
      Math.floor(Math.random() * availableAvatars.length)
    ];
    agentAvatars.set(agent.id, assignedAvatar);
  }
  character.style.backgroundImage =
    `url('./public/characters/${assignedAvatar}')`;

  // 타입 태그 (Main/Sub/Team)
  let typeLabel = 'Main';
  let typeClass = 'type-main';
  if (agent.isSubagent) {
    typeLabel = 'Sub';
    typeClass = 'type-sub';
  } else if (agent.isTeammate) {
    typeLabel = 'Team';
    typeClass = 'type-team';
  }

  const header = document.createElement('div');
  header.className = 'agent-header';

  const projectTag = document.createElement('span');
  projectTag.className = 'project-tag';
  projectTag.textContent = agent.projectPath
    ? agent.projectPath.split(/[\\/]/).pop()
    : 'Default';

  const typeTag = document.createElement('span');
  typeTag.className = `type-tag ${typeClass}`;
  typeTag.textContent = typeLabel;

  // 어셈블리
  header.appendChild(projectTag);
  header.appendChild(typeTag);
  card.appendChild(header);
  card.appendChild(bubble);
  card.appendChild(character);

  // 클릭 이벤트 (터미널 포커스)
  character.onclick = (e) => {
    e.stopPropagation();
    if (window.electronAPI?.focusTerminal) {
      window.electronAPI.focusTerminal(agent.id);
    }
  };

  return card;
}
```

#### 3.3.5 그리드 레이아웃

**정렬 및 그룹핑** (`renderer.js:394-472`)

```javascript
function updateGridLayout() {
  const cards = Array.from(agentGrid.querySelectorAll('.agent-card'));

  if (cards.length === 0) {
    agentGrid.classList.remove('has-multiple');
    if (idleContainer) idleContainer.style.display = 'flex';
    return;
  }

  if (idleContainer) idleContainer.style.display = 'none';
  agentGrid.classList.add('has-multiple');

  // 프로젝트 → 타입 순서로 정렬
  cards.sort((a, b) => {
    const dataA = window.lastAgents?.find(ag => ag.id === a.dataset.agentId);
    const dataB = window.lastAgents?.find(ag => ag.id === b.dataset.agentId);

    // 1. 프로젝트명 정렬
    const projA = dataA?.projectPath || '';
    const projB = dataB?.projectPath || '';
    if (projA !== projB) return projA.localeCompare(projB);

    // 2. 타입 정렬 (Main < Sub < Team)
    const score = (d) => d.isSubagent ? 1 : (d.isTeammate ? 2 : 0);
    return score(dataA) - score(dataB);
  });

  // DOM 재배치 및 그룹 분리
  let lastProject = null;
  let mainIndex = 0;

  cards.forEach(card => {
    const data = window.lastAgents?.find(ag => ag.id === card.dataset.agentId);
    const currProject = data?.projectPath;

    // 프로젝트 그룹이 바뀌면 마진 추가
    if (lastProject !== null && currProject !== lastProject) {
      card.classList.add('group-start');
      mainIndex = 0;
    } else {
      card.classList.remove('group-start');
    }

    // 메인 에이전트 넘버링
    if (!data?.isSubagent && !data?.isTeammate) {
      const label = `Main_${mainIndex}`;
      const typeTag = card.querySelector('.type-tag');
      if (typeTag) typeTag.textContent = label;
      mainIndex++;
    }

    agentGrid.appendChild(card);
  });
}
```

### 3.4 hook.js

**훅 이벤트 포워더** (`hook.js:1-35`)

```javascript
const http = require('http');
const PORT = 47821;

const chunks = [];
process.stdin.on('data', d => chunks.push(d));

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    // Claude 프로세스 PID: 부모 프로세스
    data._pid = process.ppid;

    const body = Buffer.from(JSON.stringify(data), 'utf-8');

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/hook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      }
    }, () => process.exit(0));

    req.on('error', () => process.exit(0));
    req.setTimeout(3000, () => {
      req.destroy();
      process.exit(0);
    });

    req.write(body);
    req.end();
  } catch (e) {
    process.exit(0);
  }
});
```

### 3.5 preload.js

**IPC 브릿지** (`preload.js:1-43`)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// 리스너 누적 방지
function safeOn(channel, callback) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (event, data) => callback(data));
}

contextBridge.exposeInMainWorld('electronAPI', {
  // 윈도우 관리
  getWorkArea: () => {
    ipcRenderer.send('get-work-area');
    return new Promise(resolve =>
      ipcRenderer.once('work-area-response', (_, d) => resolve(d))
    );
  },
  rendererReady: () => ipcRenderer.send('renderer-ready'),

  // 에이전트 이벤트 구독
  onAgentAdded: (cb) => safeOn('agent-added', cb),
  onAgentUpdated: (cb) => safeOn('agent-updated', cb),
  onAgentRemoved: (cb) => safeOn('agent-removed', cb),
  onAgentsCleaned: (cb) => safeOn('agents-cleaned', cb),

  // 에이전트 조회
  getAllAgents: () => {
    ipcRenderer.send('get-all-agents');
    return new Promise(resolve =>
      ipcRenderer.once('all-agents-response', (_, d) => resolve(d))
    );
  },
  getAvatars: () => {
    ipcRenderer.send('get-avatars');
    return new Promise(resolve =>
      ipcRenderer.once('avatars-response', (_, d) => resolve(d))
    );
  },

  // 터미널 포커스
  focusTerminal: (agentId) => ipcRenderer.send('focus-terminal', agentId),

  // 에이전트 퇴근
  dismissAgent: (agentId) => ipcRenderer.send('dismiss-agent', agentId)
});
```

### 3.6 utils.js

**공통 유틸리티** (`utils.js:1-92`)

```javascript
// Slug → 표시 이름 변환
function formatSlugToDisplayName(slug) {
  if (!slug) return 'Agent';
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// 상태별 CSS 클래스 반환
function getVisualClassForState(state) {
  const mapping = {
    'Working': 'is-working',
    'Thinking': 'is-working',
    'Done': 'is-complete',
    'Error': 'is-alert',
    'Help': 'is-alert',
    'Offline': 'is-offline'
  };
  return mapping[state] || 'is-complete';
}

// 경과 시간 계산
function getElapsedTime(agent) {
  if (agent.state === 'Done') {
    return agent.lastDuration || 0;
  } else if (agent.state === 'Working' || agent.state === 'Thinking') {
    return agent.activeStartTime ? Date.now() - agent.activeStartTime : 0;
  }
  return 0;
}

// 경로 정규화 (Windows/Unix 호환)
function normalizePath(path) {
  return (path || '')
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\/$/, '');
}
```

---

## 4. 이벤트 시스템 (Event System)

### 4.1 훅 이벤트 종류

Claude CLI에서 발생하는 훅 이벤트와 그 처리 방식:

| 이벤트 | 트리거 시점 | 상태 전이 | 처리 위치 |
|--------|-------------|----------|----------|
| `SessionStart` | 세션 시작 | → Waiting | `main.js:219-221` |
| `SessionEnd` | 세션 종료 | 제거 | `main.js:223-225` |
| `UserPromptSubmit` | 사용자 메시지 제출 | → Working | `main.js:227-246` |
| `PreToolUse` | 도구 사용 전 | → Working | `main.js:263-277` |
| `PostToolUse` | 도구 사용 후 | → Working | `main.js:279-286` |
| `Stop` | 응답 완료 | → Done | `main.js:248-261` |
| `TaskCompleted` | 작업 완료 | → Done | `main.js:248-261` |
| `PostToolUseFailure` | 도구 실패 | → Help | `main.js:288-297` |
| `PermissionRequest` | 권한 요청 | → Help | `main.js:288-297` |
| `Notification` | 알림 | → Help | `main.js:288-297` |
| `SubagentStart` | 서브에이전트 시작 | → Working | `main.js:299-303` |
| `SubagentStop` | 서브에이전트 종료 | 제거 | `main.js:305-309` |
| `TeammateIdle` | 팀원 대기 중 | → Waiting | `main.js:311-319` |

### 4.2 상태 머신

```
                    ┌─────────────────┐
                    │   Waiting       │
                    │   (대기 중)      │
                    └────────┬────────┘
                             │ UserPromptSubmit
                             ▼
                    ┌─────────────────┐
                    │   Working       │◄──────┐
                    │   (작업 중)      │       │
                    └────────┬────────┘       │
                             │                │
                    ┌────────┴────────┐       │
                    │                 │       │
            Stop/TaskCompleted   PreToolUse  │
                    │                 │       │
                    ▼                 │       │
            ┌─────────────────┐      │       │
            │     Done        │      │       │
            │   (완료)         │      │       │
            └─────────────────┘      │       │
                    │                 │       │
                    │                 │       │
                    └─────────────────┘       │
                             │ PostToolUse    │
                             └────────────────┘

                    ┌─────────────────┐
                    │     Help        │
                    │   (도움 필요)    │
                    │ (Permission/    │
                    │  Notification)  │
                    └─────────────────┘
```

### 4.3 이벤트 흐름도

1. **사용자가 Claude CLI에서 작업 시작**
   ```
   User Prompt → Claude CLI → UserPromptSubmit 훅
   ```

2. **훅 이벤트 전달**
   ```
   Claude CLI → hook.js (stdin) → HTTP POST → Hook Server
   ```

3. **상태 업데이트**
   ```
   Hook Server → handleSessionStart() → AgentManager.updateAgent()
   ```

4. **UI 반영**
   ```
   AgentManager → 'agent-added' event → Main IPC → Renderer → addAgent()
   ```

5. **애니메이션 재생**
   ```
   updateAgentState() → playAnimation() → drawFrame() → CSS background-position
   ```

---

## 5. UI/렌더링 (UI/Rendering)

### 5.1 스프라이트 애니메이션 시스템

**스프라이트 시트 구조**

```
┌────────────────────────────────────────────────────────────────┐
│  프레임 0  │  1  │  2  │  3  │  4  │  5  │  6  │  7  │  8  │  ... (Row 0)
├────────────────────────────────────────────────────────────────┤
│  프레임 9  │ 10  │ 11  │ 12  │ 13  │ 14  │ 15  │ 16  │ 17  │  ... (Row 1)
├────────────────────────────────────────────────────────────────┤
│  ...                                                              │
└────────────────────────────────────────────────────────────────┘
  각 프레임: 48×64px
  시트 크기: 432×256px (9열 × 4행)
```

**프레임 계산**

```javascript
// 프레임 인덱스 → col, row 계산
const col = frameIndex % 9;           // 0-8
const row = Math.floor(frameIndex / 9); // 0-3

const x = col * -48;  // 음수로 이동
const y = row * -64;
element.style.backgroundPosition = `${x}px ${y}px`;
```

### 5.2 레이아웃 모드

#### 5.2.1 싱글 모드 (에이전트 0개)

```
┌─────────────────────┐
│                     │
│     [캐릭터]        │
│                     │
│   ┌───────────┐     │
│   │Waiting... │     │
│   └───────────┘     │
│                     │
└─────────────────────┘
```

#### 5.2.2 멀티 모드 (에이전트 1개 이상)

```
┌────────────────────────────────────────────────────────────┐
│  [프로젝트A] [Main_0]     [프로젝트B] [Main_1]             │
│    ┌───┐                  ┌───┐                            │
│    │ ● │                  │ ● │                            │
│    └───┘                  └───┘                            │
│  ┌─────────┐            ┌─────────┐                        │
│  │Working  │            │Done!    │                        │
│  │(01:23)  │            │(02:45)  │                        │
│  └─────────┘            └─────────┘                        │
│                                                            │
│  [프로젝트A] [Sub]   [프로젝트A] [Main_1]                 │
│    ┌───┐                  ┌───┐                            │
│    │ ● │                  │ ● │                            │
│    └───┘                  └───┘                            │
│  ┌─────────┐            ┌─────────┐                        │
│  │Working  │            │Waiting  │                        │
│  └─────────┘            └─────────┘                        │
└────────────────────────────────────────────────────────────┘
```

### 5.3 상태 시각화

**상태별 색상 및 애니메이션**

| 상태 | 말풍선 색상 | 애니메이션 | FPS | 프레임 |
|------|-------------|-----------|-----|--------|
| Working | 주황 (#ff9800) | working | 8 | [1,2,3,4] |
| Thinking | 주황 (#ff9800) | working | 8 | [1,2,3,4] |
| Done | 녹색 (#4caf50) | complete | 6 | [20-27] |
| Waiting | 회색 (#9e9e9e) | waiting | 1 | [32] |
| Error | 빨강 (#f44336) | alert | 4 | [0,31] |
| Help | 빨강 (#f44336) | alert | 4 | [0,31] |

**CSS 정의** (`styles.css:306-367`)

```css
/* Working 상태 */
.agent-card.state-working .agent-bubble {
  border-color: #ff9800;
}

/* Done 상태 */
.agent-card.state-complete .agent-bubble {
  border-color: #4caf50;
}

/* Alert 상태 (Error/Help) */
.agent-card.state-alert .agent-bubble {
  border-color: #f44336;
  color: #d32f2f;
}
```

---

## 6. 생명주기 관리 (Lifecycle)

### 6.1 에이전트 생명주기

```
┌─────────────────────────────────────────────────────────────┐
│                     에이전트 생명주기                          │
└─────────────────────────────────────────────────────────────┘

1. 생성 (Creation)
   │
   ├─ SessionStart 훅 수신
   ├─ handleSessionStart() 호출
   ├─ AgentManager.updateAgent({ state: 'Waiting' })
   ├─ 'agent-added' event emit
   └─ Renderer: addAgent() → createAgentCard()

2. 상태 전이 (State Transition)
   │
   ├─ UserPromptSubmit → Working
   ├─ PreToolUse → Working
   ├─ PostToolUse → Working (with idle timer)
   ├─ Stop/TaskCompleted → Done
   └─ Error/PermissionRequest → Help

3. 활동 모니터링 (Activity Monitoring)
   │
   ├─ lastActivity 타임스탬프 갱신
   ├─ 10분 미활동 시 자동 제거
   └─ 3초 간격 생사 확인 (PID 체크)

4. 제거 (Removal)
   │
   ├─ SessionEnd 훅 수신
   ├─ AgentManager.removeAgent()
   ├─ 'agent-removed' event emit
   ├─ Renderer: removeAgent() → card.remove()
   └─ 인터벌 정리 및 메모리 해제
```

### 6.2 세션 복구 시스템

**복구 프로세스**

1. **앱 시작 시 실행**
   ```javascript
   app.whenReady().then(() => {
     recoverExistingSessions();
   });
   ```

2. **활성 프로세스 발견**
   ```
   PowerShell WMI 조회 → node.exe + claude/cli.js → PID 목록
   ```

3. **JSONL 파일 스캔**
   ```
   ~/.claude/projects/*/*.jsonl → 수정시간 순 정렬
   ```

4. **세션 매칭**
   ```
   JSONL 파싱 → sessionId 추출 → SessionEnd 없음 → 복구 대상
   ```

5. **에이전트 등록**
   ```
   PID 매핑 → AgentManager.updateAgent() → UI 표시
   ```

### 6.3 생사 확인 메커니즘

**PID 추적**

```javascript
// sessionId → PID 매핑
sessionPids.set(sessionId, pid);

// 주기적 확인 (3초 간격)
try {
  process.kill(pid, 0);  // 시그널 0 = 생사 확인만
  alive = true;
} catch (e) {
  alive = false;  // 프로세스 종료
}

// 2회 연속 실패 시 제거 (~6초)
if (!alive && missCount >= 2) {
  agentManager.removeAgent(agent.id);
}
```

---

## 7. 통신 프로토콜 (Communication)

### 7.1 IPC 통신

**채널 정의**

| 채널 | 방향 | 데이터 | 목적 |
|------|------|--------|------|
| `agent-added` | Main → Renderer | AgentObject | 새 에이전트 알림 |
| `agent-updated` | Main → Renderer | AgentObject | 상태 변경 알림 |
| `agent-removed` | Main → Renderer | {id, displayName} | 에이전트 제거 알림 |
| `agents-cleaned` | Main → Renderer | {count} | 일괄 정리 알림 |
| `renderer-ready` | Renderer → Main | - | 렌더러 준비 완료 |
| `get-all-agents` | Renderer → Main | - | 전체 에이전트 요청 |
| `all-agents-response` | Main → Renderer | AgentObject[] | 에이전트 목록 응답 |
| `focus-terminal` | Renderer → Main | agentId | 터미널 포커스 요청 |
| `dismiss-agent` | Renderer → Main | agentId | 에이전트 퇴근 요청 |

**에이전트 객체 구조**

```javascript
{
  id: string,              // 고유 ID (sessionId)
  sessionId: string,       // Claude 세션 ID
  agentId: string,         // 에이전트 ID (optional)
  slug: string,            // Claude slug (optional)
  displayName: string,     // 표시 이름
  projectPath: string,     // 프로젝트 경로
  jsonlPath: string,       // JSONL 파일 경로
  isSubagent: boolean,     // 서브에이전트 여부
  isTeammate: boolean,     // 팀원 여부
  state: 'Working' | 'Done' | 'Waiting' | 'Help' | 'Error',
  activeStartTime: number, // 작업 시작 시각 (timestamp)
  lastDuration: number,    // 마지막 작업 소요 시간 (ms)
  lastActivity: number,    // 마지막 활동 시각 (timestamp)
  firstSeen: number,       // 처음 발견 시각 (timestamp)
  updateCount: number      // 업데이트 횟수
}
```

### 7.2 HTTP 통신

**요청 형식**

```http
POST /hook HTTP/1.1
Host: 127.0.0.1:47821
Content-Type: application/json

{
  "hook_event_name": "UserPromptSubmit",
  "session_id": "abc123...",
  "cwd": "E:/projects/my-app",
  "timestamp": "2025-01-15T10:30:00Z",
  "_pid": 12345
}
```

**응답 형식**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"ok": true}
```

### 7.3 Hook 스크립트 통신

**stdin → JSON**

```javascript
// Claude CLI가 hook.js에 JSON 전달
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  const data = JSON.parse(Buffer.concat(chunks).toString());
  // ... 처리
});
```

**PID 추출**

```javascript
// hook.js의 부모 프로세스 = Claude CLI
data._pid = process.ppid;
```

---

## 8. 보안 및 성능 (Security & Performance)

### 8.1 IPC 보안

**Context Isolation**

```javascript
// main.js
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  nodeIntegration: false,      // Node.js 모듈 직접 접근 금지
  contextIsolation: true       // 컨텍스트 격리 활성화
}
```

**안전한 API 노출**

```javascript
// preload.js - contextBridge로만 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 명시적으로 선언된 API만 접근 가능
  focusTerminal: (agentId) => ipcRenderer.send('focus-terminal', agentId)
});
```

### 8.2 성능 최적화

#### 8.2.1 애니메이션 최적화

```javascript
// GPU 가속 활용
element.style.willChange = 'background-position';
element.style.transform = 'translate3d(0, 0, 0)';

// visibility API로 페이지 숨김 시 애니메이션 중지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 모든 인터벌 정리
    for (const [agentId, state] of agentStates.entries()) {
      if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
      }
    }
  } else {
    // 애니메이션 재개
    // ...
  }
});
```

#### 8.2.2 이벤트 최적화

```javascript
// 상태 변경 시에만 이벤트 emit
if (newState !== prevState) {
  this.emit('agent-updated', agentData);
}

// 리스너 누적 방지
function safeOn(channel, callback) {
  ipcRenderer.removeAllListeners(channel);  // 기존 리스너 제거
  ipcRenderer.on(channel, (event, data) => callback(data));
}
```

#### 8.2.3 메모리 관리

```javascript
// 에이전트 제거 시 인터벌 정리
function removeAgent(data) {
  const state = agentStates.get(data.id);
  if (state) {
    if (state.interval) clearInterval(state.interval);
    if (state.timerInterval) clearInterval(state.timerInterval);
    agentStates.delete(data.id);
  }
  card.remove();
}
```

---

## 9. 개발 가이드 (Development Guide)

### 9.1 새로운 기능 추가

#### 9.1.1 새로운 훅 이벤트 처리

1. **Hook 이벤트 등록** (`main.js:129-139`)

```javascript
const HOOK_EVENTS = [
  // 기존 이벤트...
  'YourNewEvent'  // 새 이벤트 추가
];
```

2. **이벤트 핸들러 구현** (`main.js:196-341`)

```javascript
case 'YourNewEvent': {
  // 처리 로직
  if (agentManager) {
    const agent = agentManager.getAgent(sessionId);
    if (agent) {
      agentManager.updateAgent({
        ...agent,
        state: 'YourState'
      }, 'hook');
    }
  }
  break;
}
```

3. **상태 설정** (`renderer.js:25-32`)

```javascript
const stateConfig = {
  // 기존 상태...
  'YourState': {
    anim: 'working',  // 또는 다른 애니메이션
    class: 'state-working',
    label: 'Your Label...'
  }
};
```

#### 9.1.2 새로운 애니메이션 추가

1. **애니메이션 시퀀스 정의** (`renderer.js:17-22`)

```javascript
const ANIM_SEQUENCES = {
  // 기존 애니메이션...
  yourAnim: {
    frames: [5, 6, 7, 8],  // 프레임 인덱스
    fps: 10,               // 초당 프레임
    loop: true             // 반복 여부
  }
};
```

2. **스프라이트 시트에 프레임 추가**

   - 48×64px 프레임을 스프라이트 시트에 추가
   - 인덱스를 시퀀스에 반영

#### 9.1.3 새로운 상태 추가

1. **AgentManager 상태 처리** (`agentManager.js:40-101`)

```javascript
// 상태 전이 로직에 새 상태 추가
const isPassive = (s) =>
  s === 'Done' || s === 'Help' || s === 'Error' ||
  s === 'Waiting' || s === 'YourState';
```

2. **렌더러 상태 설정** (`renderer.js:25-32`)

```javascript
const stateConfig = {
  'YourState': {
    anim: 'yourAnim',
    class: 'state-your',
    label: 'Your State'
  }
};
```

3. **CSS 스타일 추가** (`styles.css`)

```css
.agent-card.state-your .agent-bubble {
  border-color: #yourcolor;
}
```

### 9.2 트러블슈팅

#### 9.2.1 에이전트가 표시되지 않음

**증상**: Claude CLI를 실행해도 에이전트가 나타나지 않음

**원인 및 해결**:

1. **훅 등록 확인**
   ```bash
   # Windows PowerShell
   Get-Content $env:USERPROFILE\.claude\settings.json | ConvertFrom-Json
   ```

2. **훅 서버 동작 확인**
   ```bash
   # 포트 리스닁 확인
   netstat -an | findstr 47821
   ```

3. **디버그 로그 확인**
   ```bash
   # 프로젝트 루트의 debug.log 확인
   cat debug.log
   ```

#### 9.2.2 세션 복구 실패

**증상**: 앱 재시작 후 에이전트가 복구되지 않음

**원인 및 해결**:

1. **JSONL 파일 확인**
   ```bash
   # 파일 존재 확인
   ls ~/.claude/projects/*/*.jsonl
   ```

2. **PID 조회 실패**
   - PowerShell WMI 권한 확인
   - Claude 프로세스 실행 중인지 확인

3. **Grace 기간 연장** (`main.js:463`)

```javascript
const GRACE_MS = 30000;  // 15초 → 30초로 연장
```

#### 9.2.3 애니메이션 끊김

**증상**: 캐릭터 애니메이션이 부자연스럽게 멈춤

**원인 및 해결**:

1. **visibility 체크**
   ```javascript
   // 페이지 숨김 상태에서 애니메이션이 중지됨
   console.log(document.hidden);  // false여야 함
   ```

2. **인터벌 정리 확인**
   ```javascript
   // removeAgent()에서 인터벌이 정리되는지 확인
   if (state.interval) clearInterval(state.interval);
   ```

#### 9.2.4 터미널 포커스 실패

**증상**: 에이전트 클릭 시 터미널이 포커스되지 않음

**원인 및 해결**:

1. **PID 매핑 확인**
   ```javascript
   console.log(sessionPids.get(agentId));  // PID가 있어야 함
   ```

2. **PowerShell 명령 권한**
   - SetForegroundWindow 호출 권한 확인
   - Windows 방화벽/보안 설정 확인

### 9.3 디버깅

#### 9.3.1 로그 확인

**Main Process 로그**

```bash
# debug.log 파일 확인
tail -f debug.log
```

**Hook Server 로그**

```bash
# hook_debug.log 파일 확인 (존재 시)
tail -f hook_debug.log
```

**Renderer Console**

```javascript
// 개발자 도구 열기
// main.js 수정
mainWindow.webContents.openDevTools();
```

#### 9.3.2 테스트 에이전트

**테스트 모드 활성화** (`main.js:568`)

```javascript
const ENABLE_TEST_AGENTS = true;  // false → true

if (ENABLE_TEST_AGENTS) {
  const testSubagents = [
    { sessionId: 'test-main-1', projectPath: 'E:/projects/test',
      displayName: 'Test Agent', state: 'Working',
      isSubagent: false, isTeammate: false }
  ];
  testSubagents.forEach(agent => agentManager.updateAgent(agent, 'test'));
}
```

---

## 10. 용어 사전 (Glossary)

| 용어 | 영문 | 설명 |
|------|------|------|
| 에이전트 | Agent | Claude CLI에서 작업을 수행하는 AI 개체 |
| 세션 | Session | Claude CLI의 단일 실행 인스턴스 |
| 서브에이전트 | Subagent | 메인 에이전트가 생성한 하위 에이전트 |
| 팀원 | Teammate | Agent Team 기능을 통해 협업하는 에이전트 |
| 훅 | Hook | Claude CLI 이벤트를 가로채는 메커니즘 |
| 스프라이트 | Sprite | 여러 프레임을 하나의 이미지로 합친 시트 |
| JSONL | JSON Lines | JSON을 한 줄씩 기록하는 로그 형식 |
| IPC | Inter-Process Communication | 프로세스 간 통신 |
| PID | Process ID | 운영체제 프로세스 식별자 |
| Slug | Slug | Claude가 생성한 세션 고유 식별자 |
| 상태 | State | 에이전트의 현재 작업 상태 (Working, Done 등) |
| 렌더러 | Renderer | UI를 담당하는 Electron 프로세스 |
| 프리로드 | Preload | 메인과 렌더러 사이의 브릿지 스크립트 |
| 생사 확인 | Liveness Check | 프로세스가 살아있는지 확인하는 작업 |
| 세션 복구 | Session Recovery | 앱 재시작 시 활성 세션 복원 |
| 윈도우 매니저 | Window Manager | 윈도우 크기/위치를 관리하는 시스템 |
| 애니메이션 시퀀스 | Animation Sequence | 스프라이트 프레임 순서 및 속도 정의 |
| 그리드 레이아웃 | Grid Layout | 여러 에이전트를 배열하는 UI 구조 |

---

## 부록: 파일 구조

```
pixel-agent-desk/
├── main.js              # 메인 프로세스 (731줄)
├── agentManager.js      # 에이전트 상태 관리 (169줄)
├── renderer.js          # UI 렌더링 (561줄)
├── preload.js           # IPC 브릿지 (43줄)
├── hook.js              # CLI 훅 스크립트 (35줄)
├── sessionend_hook.js   # 세션 종료 훅
├── utils.js             # 공통 유틸리티 (92줄)
├── styles.css           # 스타일시트 (587줄)
├── index.html           # UI 구조
├── package.json         # 의존성 설정
├── debug.log            # 메인 프로세스 로그
├── hook_debug.log       # 훅 서버 로그
├── public/
│   └── characters/      # 아바타 스프라이트 시트
│       ├── avatar_0.png
│       ├── avatar_1.png
│       └── ...
└── docs/
    └── TECHNICAL_GUIDE.md  # 본 문서
```

---

## 참고 문헌

- [Electron 공식 문서](https://www.electronjs.org/docs)
- [Claude CLI Hooks 가이드](https://docs.anthropic.com/claude/reference/cli-hooks)
- [Node.js EventEmitter](https://nodejs.org/api/events.html)
- [Context Isolation 가이드](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

---

*문서 버전: 1.0.0*
*마지막 수정: 2025-03-05*
*유지보지: Pixel Agent Desk 팀*
