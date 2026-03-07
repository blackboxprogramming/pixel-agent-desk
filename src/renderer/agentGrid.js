/**
 * Agent Grid — add/update/remove Agent, updateGridLayout, resize
 */

function addAgent(agent) {
  if (document.querySelector(`[data-agent-id="${agent.id}"]`)) {
    return;
  }

  const card = createAgentCard(agent);
  agentGrid.appendChild(card);

  if (!window.lastAgents) window.lastAgents = [];
  if (!window.lastAgents.some(a => a.id === agent.id)) {
    window.lastAgents.push(agent);
  }

  updateAgentState(agent.id, card, agent);
  updateGridLayout();
  requestDynamicResize();
}

function updateAgent(agent) {
  const card = document.querySelector(`[data-agent-id="${agent.id}"]`);
  if (!card) return;

  // Capture previous data BEFORE updating lastAgents
  const prevData = window.lastAgents?.find(a => a.id === agent.id);

  if (window.lastAgents) {
    const idx = window.lastAgents.findIndex(a => a.id === agent.id);
    if (idx > -1) {
      window.lastAgents[idx] = agent;
    } else {
      window.lastAgents.push(agent);
    }
  }

  // Detect agent type change (e.g., Main created via auto-create then switched to Sub via SubagentStart)
  const wasSubagent = card.classList.contains('is-subagent');
  const wasTeammate = card.classList.contains('is-teammate');
  const typeChanged = (!!agent.isSubagent !== wasSubagent) || (!!agent.isTeammate !== wasTeammate);

  const relationshipChanged = prevData && (
    prevData.parentId !== agent.parentId ||
    prevData.teamName !== agent.teamName
  );

  updateAgentState(agent.id, card, agent);

  if (typeChanged || relationshipChanged) {
    updateGridLayout();
    requestDynamicResize();
  }
}

function removeAgent(data) {
  const card = document.querySelector(`[data-agent-id="${data.id}"]`);
  if (!card) return;

  // Clean up animation memory
  animationManager.stop(data.id);

  const state = agentStates.get(data.id);
  if (state) {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }
  agentStates.delete(data.id);
  agentAvatars.delete(data.id);

  // Remove DOM element after exit animation
  card.classList.add('removing');
  setTimeout(() => {
    card.remove();
    updateGridLayout();
    requestDynamicResize();
  }, 250);
}

function cleanupAgents(data) {
  updateGridLayout();
}

// --- Idle avatar for empty state (0 agents) ---
const idleContainer = document.getElementById('container');
const idleCharacter = document.getElementById('character');
const idleBubble = document.getElementById('speech-bubble');

function startIdleAnimation() {
  if (!idleCharacter) return;
  const seq = ANIM_SEQUENCES.waiting;
  drawFrameOn(idleCharacter, seq.frames[0]);
  idleBubble.textContent = 'Waiting...';
}

function drawFrameOn(el, frameIndex) {
  if (!el) return;
  const col = frameIndex % SHEET.cols;
  const row = Math.floor(frameIndex / SHEET.cols);
  // Single character at 1x native (48x64, bg 432x256)
  const fw = 48;
  const fh = 64;
  el.style.backgroundPosition = `${col * -fw}px ${row * -fh}px`;
}

function updateGridLayout() {
  const cards = Array.from(agentGrid.querySelectorAll('.agent-card'));
  if (cards.length === 0) {
    agentGrid.classList.remove('has-multiple');
    agentGrid.querySelectorAll('.agent-party-bg').forEach(el => el.remove());
    if (idleContainer) {
      if (!idleContainer.parentNode) {
        agentGrid.appendChild(idleContainer);
      }
      idleContainer.style.display = 'flex';
    }
    return;
  }

  if (idleContainer) idleContainer.style.display = 'none';
  agentGrid.classList.add('has-multiple');

  const cardDataList = cards.map(c => {
    return {
      card: c,
      data: window.lastAgents?.find(ag => ag.id === c.dataset.agentId) || { id: c.dataset.agentId }
    };
  });

  const mains = cardDataList.filter(item => !item.data.isSubagent && !item.data.isTeammate);
  const others = cardDataList.filter(item => item.data.isSubagent || item.data.isTeammate);
  const fallbackSubList = [...others];

  mains.sort((a, b) => (a.data.projectPath || '').localeCompare(b.data.projectPath || ''));

  Array.from(agentGrid.children).forEach(child => {
    if (child !== idleContainer) {
      agentGrid.removeChild(child);
    }
  });

  const needsDisambiguation = mains.length > 1;

  let col = 1;
  let currentRow = 1;
  let maxRowInBatch = 1;

  mains.forEach(mainItem => {
    const proj = mainItem.data.projectPath;

    const typeTag = mainItem.card.querySelector('.type-tag');
    let label = 'Main';
    if (needsDisambiguation) {
      const basename = proj ? proj.replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '?';
      const sameProjMains = mains.filter(m => m.data.projectPath === proj);
      if (sameProjMains.length > 1) {
        label = `Main:${basename}:${(mainItem.data.id || '').slice(0, 4)}`;
      } else {
        label = `Main:${basename}`;
      }
    }
    if (typeTag) typeTag.textContent = label;

    const mySubs = [];
    for (let i = fallbackSubList.length - 1; i >= 0; i--) {
      const sub = fallbackSubList[i];
      if (sub.data.parentId === mainItem.data.id) {
        mySubs.push(sub);
        fallbackSubList.splice(i, 1);
      }
    }

    mySubs.reverse();

    if (col > 10) {
      col = 1;
      currentRow = maxRowInBatch + 1;
      maxRowInBatch = currentRow;
    }

    const bgBox = document.createElement('div');
    bgBox.className = 'agent-party-bg';
    bgBox.style.gridColumn = col;
    bgBox.style.gridRow = `${currentRow} / span ${1 + mySubs.length}`;
    agentGrid.appendChild(bgBox);

    mainItem.card.classList.remove('group-start');
    mainItem.card.style.gridColumn = col;
    mainItem.card.style.gridRow = currentRow;
    agentGrid.appendChild(mainItem.card);

    mySubs.forEach((s, sIdx) => {
      const subRow = currentRow + 1 + sIdx;
      s.card.classList.remove('group-start');
      s.card.style.gridColumn = col;
      s.card.style.gridRow = subRow;
      agentGrid.appendChild(s.card);
      if (subRow > maxRowInBatch) maxRowInBatch = subRow;
    });

    col++;
  });

  // Group remaining items by teamName, including subs whose parent has a teamName
  const teamGroups = new Map();
  const noTeam = [];
  fallbackSubList.forEach(s => {
    let tn = s.data.teamName;
    if (!tn && s.data.parentId) {
      const parent = window.lastAgents?.find(a => a.id === s.data.parentId);
      if (parent && parent.teamName) tn = parent.teamName;
    }
    if (tn) {
      if (!teamGroups.has(tn)) teamGroups.set(tn, []);
      teamGroups.get(tn).push(s);
    } else {
      noTeam.push(s);
    }
  });

  // Sort within teams: teammates first, then subs
  teamGroups.forEach((members) => {
    members.sort((a, b) => {
      const aIsSub = !!a.data.isSubagent;
      const bIsSub = !!b.data.isSubagent;
      if (aIsSub !== bIsSub) return aIsSub ? 1 : -1;
      return 0;
    });
  });

  // Render team groups (same layout as main+subs)
  teamGroups.forEach((members) => {
    if (col > 10) {
      col = 1;
      currentRow = maxRowInBatch + 1;
      maxRowInBatch = currentRow;
    }

    const bgBox = document.createElement('div');
    bgBox.className = 'agent-party-bg';
    bgBox.style.gridColumn = col;
    bgBox.style.gridRow = `${currentRow} / span ${members.length}`;
    agentGrid.appendChild(bgBox);

    members.forEach((m, idx) => {
      const row = currentRow + idx;
      m.card.classList.remove('group-start');
      m.card.style.gridColumn = col;
      m.card.style.gridRow = row;
      agentGrid.appendChild(m.card);
      if (row > maxRowInBatch) maxRowInBatch = row;
    });

    col++;
  });

  // Remaining standalone cards (no team)
  noTeam.forEach(s => {
    if (col > 10) {
      col = 1;
      currentRow = maxRowInBatch + 1;
      maxRowInBatch = currentRow;
    }
    s.card.classList.remove('group-start');
    s.card.style.gridColumn = col;
    s.card.style.gridRow = currentRow;
    agentGrid.appendChild(s.card);
    col++;
  });

}

// Window resize (called only on agent add/remove, 500ms throttle)
let _resizeTimer = null;
function requestDynamicResize() {
  if (!window.electronAPI || !window.electronAPI.resizeWindow) return;
  if (_resizeTimer) return;
  _resizeTimer = setTimeout(() => {
    _resizeTimer = null;
    const grid = document.getElementById('agent-grid');
    if (!grid) return;
    const width = grid.scrollWidth;
    const height = grid.scrollHeight;
    if (width < 100 || height < 100) return;
    window.electronAPI.resizeWindow({ width, height });
  }, 500);
}
