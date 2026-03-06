# Known Issues

## 1. 다중 세션 동시 활성화 시 좀비/유령 아바타

**현상**
- Claude CLI를 여러 개 열어둔 상태에서 하나씩 채팅을 시작하면:
  - 좀비 아바타: 다른 세션의 PID를 잘못 할당받아 영구 생존
  - 유령 아바타: PID를 못 잡아 ~20초 후 제거됨 → 다시 채팅하면 재생성 → 반복

**원인**
- PID 탐지 체인의 근본적 한계:
  1. `transcript_path → PID` (lsof/Restart Manager): Windows에서 Claude가 JSONL 파일을 상시 열어두지 않아 탐지 실패
  2. `detectClaudePidsFallback` (모든 claude 프로세스 수집): 다중 세션 시 어떤 PID가 어떤 세션인지 구분 불가 → 오매핑
- Claude Code 훅에 `_pid` 필드가 있지만 비공식(`_` prefix)이라 항상 오는지 보장 안 됨

**근본 해결**
- Claude Code가 `_pid`를 모든 훅 이벤트에 안정적으로 포함시키거나
- Liveness checker를 PID 의존에서 이벤트 활성도 기반(`lastActivity`)으로 전환

**재현 조건**
- Claude CLI 인스턴스 3개 이상 열기 (채팅 안 한 상태)
- 하나씩 채팅 시작
- Windows 환경에서 더 잘 재현됨 (transcript→PID 탐지 실패율 높음)

**영향**
- 일반 사용(1~2개 세션)에서는 발생하지 않음
- 발생해도 기능적 문제는 없고 아바타 표시만 불안정
