/**
 * Error UI — P0-3: Error Recovery UI
 */

const errorQueue = [];
const MAX_ERRORS = 3;

function createErrorUI(errorContext) {
  errorQueue.push(errorContext);
  if (errorQueue.length > MAX_ERRORS) {
    errorQueue.shift();
  }

  const existing = document.querySelectorAll('.error-toast');
  existing.forEach(el => el.remove());

  errorQueue.forEach((err, index) => {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.setAttribute('data-error-id', err.id);
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const severityClass = err.severity === 'fatal' ? 'error-fatal' :
      err.severity === 'error' ? 'error-error' :
        err.severity === 'warning' ? 'error-warning' : 'error-info';
    toast.classList.add(severityClass);

    const icon = err.severity === 'fatal' ? '💀' :
      err.severity === 'error' ? '❌' :
        err.severity === 'warning' ? '⚠️' : 'ℹ️';

    toast.innerHTML = `
      <div class="error-header">
        <span class="error-icon">${icon}</span>
        <span class="error-code">${err.code}</span>
        <button class="error-close" aria-label="Close">×</button>
      </div>
      <div class="error-body">
        <div class="error-title">${err.userMessage}</div>
        <div class="error-explanation">${err.explanation}</div>
      </div>
      <div class="error-actions">
        ${err.recovery.map(action => `
          <button class="error-action-btn" data-action="${action.type}">
            ${action.label}
          </button>
        `).join('')}
      </div>
    `;

    toast.style.top = `${10 + index * 120}px`;
    toast.style.right = '10px';

    const closeBtn = toast.querySelector('.error-close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
      const idx = errorQueue.findIndex(e => e.id === err.id);
      if (idx > -1) errorQueue.splice(idx, 1);
    });

    const actionBtns = toast.querySelectorAll('.error-action-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
          if (window.electronAPI && window.electronAPI.executeRecoveryAction) {
            const result = await window.electronAPI.executeRecoveryAction(err.id, action);
            if (result.success) {
              btn.textContent = '✓ Done';
              setTimeout(() => {
                toast.remove();
                const idx = errorQueue.findIndex(e => e.id === err.id);
                if (idx > -1) errorQueue.splice(idx, 1);
              }, 1500);
            } else {
              btn.textContent = '✗ Failed';
              setTimeout(() => {
                btn.disabled = false;
                btn.textContent = action;
              }, 2000);
            }
          }
        } catch (e) {
          console.error('[ErrorUI] Failed to execute recovery action:', e);
          btn.textContent = '✗ Error';
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = action;
          }, 2000);
        }
      });
    });

    document.body.appendChild(toast);
  });
}
