/**
 * Animation Manager — rAF 루프, drawFrame, playAnimation
 */

const animationManager = {
  animations: new Map(), // agentId -> { agentId, element, animName, sequence, frameIdx, lastTime, rafId }

  start(agentId, element, animName) {
    // 이미 동일 애니메이션 실행 중이면 재시작하지 않음 (rAF 중단 → 깜빡임 방지)
    const existing = this.animations.get(agentId);
    if (existing && existing.animName === animName) return;

    this.stop(agentId);

    const sequence = ANIM_SEQUENCES[animName];
    if (!sequence) return;

    // Draw first frame immediately
    const firstFrame = sequence.frames[0];
    const col = firstFrame % SHEET.cols;
    const row = Math.floor(firstFrame / SHEET.cols);
    const x = col * -SHEET.width;
    const y = row * -SHEET.height;
    element.style.backgroundPosition = `${x}px ${y}px`;

    const animation = {
      agentId,
      element,
      animName,
      sequence,
      frameIdx: 0,
      lastTime: performance.now(),
      rafId: null
    };

    this.animations.set(agentId, animation);
    this.loop(agentId);
  },

  loop(agentId) {
    const animation = this.animations.get(agentId);
    if (!animation) return;

    animation.rafId = requestAnimationFrame((currentTime) => {
      if (!this.animations.has(agentId)) {
        return;
      }

      const targetFPS = animation.sequence.fps;
      const frameDuration = 1000 / targetFPS;

      if (currentTime - animation.lastTime >= frameDuration) {
        animation.frameIdx++;

        if (animation.frameIdx >= animation.sequence.frames.length) {
          if (animation.sequence.loop) {
            animation.frameIdx = 0;
          } else {
            this.stop(agentId);
            return;
          }
        }

        const frameNum = animation.sequence.frames[animation.frameIdx];
        const col = frameNum % SHEET.cols;
        const row = Math.floor(frameNum / SHEET.cols);
        const x = col * -SHEET.width;
        const y = row * -SHEET.height;
        animation.element.style.backgroundPosition = `${x}px ${y}px`;

        animation.lastTime = currentTime;
      }

      this.loop(agentId);
    });
  },

  stop(agentId) {
    const animation = this.animations.get(agentId);
    if (animation) {
      if (animation.rafId) {
        cancelAnimationFrame(animation.rafId);
      }
      this.animations.delete(agentId);
    }

    const state = agentStates.get(agentId);
    if (state && state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }
};

function drawFrame(element, frameIndex) {
  if (!element) return;
  const col = frameIndex % SHEET.cols;
  const row = Math.floor(frameIndex / SHEET.cols);
  const x = col * -SHEET.width;
  const y = row * -SHEET.height;
  element.style.backgroundPosition = `${x}px ${y}px`;
}

function playAnimation(agentId, element, animName) {
  animationManager.start(agentId, element, animName);

  const state = agentStates.get(agentId) || {};
  state.animName = animName;
  agentStates.set(agentId, state);
}
