(() => {
  const CONTACT = {
    wechat: 'zxj1122ll',
    phone: '18058358351',
    phoneDisplay: '180 5835 8351',
    email: 'jun2026z@163.com',
  };

  const triggers = document.querySelectorAll('[data-contact-trigger]');
  if (!triggers.length) return;

  const copyButton = (value, label) => `
    <button class="contact-copy" type="button" data-copy="${value}" data-label="${label}" aria-label="${label}" title="${label}">
      <svg class="contact-copy-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
      </svg>
      <svg class="contact-check-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m20 6-11 11-5-5"></path>
      </svg>
    </button>
  `;

  const dialog = document.createElement('dialog');
  dialog.className = 'contact-dialog';
  dialog.setAttribute('aria-labelledby', 'contact-dialog-title');
  dialog.innerHTML = `
    <div class="contact-dialog-panel">
      <header class="contact-dialog-head">
        <div>
          <p>LET'S CONNECT</p>
          <h2 id="contact-dialog-title">联系我</h2>
        </div>
        <button class="contact-dialog-close" type="button" aria-label="关闭联系方式弹窗">×</button>
      </header>
      <div class="contact-list">
        <div class="contact-row">
          <span class="contact-label">微信</span>
          <strong>${CONTACT.wechat}</strong>
          ${copyButton(CONTACT.wechat, '复制微信号')}
        </div>
        <div class="contact-row">
          <span class="contact-label">电话</span>
          <strong>${CONTACT.phoneDisplay}</strong>
          ${copyButton(CONTACT.phone, '复制电话号码')}
        </div>
        <div class="contact-row">
          <span class="contact-label">邮箱</span>
          <strong>${CONTACT.email}</strong>
          ${copyButton(CONTACT.email, '复制邮箱地址')}
        </div>
      </div>
      <p class="contact-status" role="status" aria-live="polite"></p>
    </div>
  `;
  document.body.append(dialog);

  const closeButton = dialog.querySelector('.contact-dialog-close');
  const status = dialog.querySelector('.contact-status');
  let activeTrigger = null;
  let statusTimer = null;

  const openDialog = (trigger) => {
    activeTrigger = trigger;
    status.textContent = '';
    dialog.showModal();
    closeButton.focus();
  };

  const closeDialog = () => {
    dialog.close();
    activeTrigger?.focus();
  };

  const copyText = async (value, button) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }

    clearTimeout(statusTimer);
    dialog.querySelectorAll('.contact-copy').forEach((item) => {
      item.classList.remove('is-copied');
      item.setAttribute('aria-label', item.dataset.label);
      item.setAttribute('title', item.dataset.label);
    });
    button.classList.add('is-copied');
    button.setAttribute('aria-label', '已复制');
    button.setAttribute('title', '已复制');
    status.textContent = '联系方式已复制到剪贴板';
    statusTimer = window.setTimeout(() => {
      button.classList.remove('is-copied');
      button.setAttribute('aria-label', button.dataset.label);
      button.setAttribute('title', button.dataset.label);
      status.textContent = '';
    }, 1800);
  };

  triggers.forEach((trigger) => {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openDialog(trigger);
    });
  });

  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', () => clearTimeout(statusTimer));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) {
      event.preventDefault();
      closeDialog();
    }
  });
  dialog.querySelectorAll('.contact-copy').forEach((button) => {
    button.addEventListener('click', () => copyText(button.dataset.copy, button));
  });
})();
