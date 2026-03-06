/**
 * Claude CLI Hook Registration
 * Read/write/register HTTP hooks from Claude CLI config file
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const HOOK_SERVER_PORT = 47821;

function getClaudeConfigPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function readClaudeConfig(debugLog) {
  try {
    const configPath = getClaudeConfigPath();
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    debugLog(`[Hook] Failed to read Claude config: ${error.message}`);
  }
  return {};
}

function writeClaudeConfig(config, debugLog) {
  try {
    const configPath = getClaudeConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    debugLog('[Hook] Claude config file updated');
    return true;
  } catch (error) {
    debugLog(`[Hook] Failed to write Claude config: ${error.message}`);
    return false;
  }
}

function isHookRegistered(debugLog) {
  const config = readClaudeConfig(debugLog);
  const HTTP_HOOK_URL = `http://localhost:${HOOK_SERVER_PORT}/hook`;

  if (!config.hooks) {
    return false;
  }

  const hookEvents = ['SessionStart', 'PreToolUse', 'PostToolUse'];
  for (const event of hookEvents) {
    if (config.hooks[event]) {
      if (!Array.isArray(config.hooks[event])) return false;
      const hookStr = JSON.stringify(config.hooks[event]);
      if (hookStr.includes(HTTP_HOOK_URL) && hookStr.includes('"type":"http"')) {
        return true;
      }
    }
  }

  return false;
}

function registerClaudeHooks(debugLog) {
  debugLog('[Hook] Checking Claude CLI hook registration status...');

  if (isHookRegistered(debugLog)) {
    debugLog('[Hook] Hooks are already registered.');
    return true;
  }

  debugLog('[Hook] Starting hook registration...');

  const config = readClaudeConfig(debugLog);

  config.hooks = config.hooks || {};

  const HTTP_HOOK_URL = `http://localhost:${HOOK_SERVER_PORT}/hook`;
  const hookEvents = [
    'SessionStart', 'SessionEnd', 'UserPromptSubmit',
    'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
    'Stop', 'TaskCompleted', 'PermissionRequest', 'Notification',
    'SubagentStart', 'SubagentStop', 'TeammateIdle',
    'ConfigChange', 'WorktreeCreate', 'WorktreeRemove',
    'PreCompact'
  ];

  for (const event of hookEvents) {
    config.hooks[event] = [
      {
        matcher: "*",
        hooks: [
          {
            type: "http",
            url: HTTP_HOOK_URL
          }
        ]
      }
    ];
  }

  if (writeClaudeConfig(config, debugLog)) {
    debugLog('[Hook] Claude CLI hook registration complete');
    return true;
  }

  debugLog('[Hook] Hook registration failed');
  return false;
}

module.exports = { HOOK_SERVER_PORT, registerClaudeHooks };
