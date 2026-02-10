/*
 * ProjectionLab Assistant - Side Panel Script
 * Copyright (c) 2026 cahenesy
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const historyDiv = document.getElementById('chat-history');
const input = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const noTabMessage = document.getElementById('no-tab-message');
const inputArea = document.getElementById('input-area');
const resetBtn = document.getElementById('reset-btn');

// Storage key for persistent chat
const STORAGE_KEY = 'pla_chat_history';

// ── Simplified theme mirroring ──
async function applyProjectionLabTheme() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith('https://app.projectionlab.com/')) {
      console.log("[PLA:SidePanel] Not on ProjectionLab tab → using fallback light theme");
      document.body.classList.add('fallback-light');
      return false;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        const style = getComputedStyle(document.documentElement);
        const themeVars = {};

        for (const prop of style) {
          if (prop.startsWith('--v-')) {  // Expanded to capture all --v- vars, including opacities
            const value = style.getPropertyValue(prop).trim();
            if (value) themeVars[prop] = value;
          }
        }

        return themeVars;
      }
    });

    const themeVars = results[0]?.result || {};
    if (Object.keys(themeVars).length < 10) {
      console.warn("[PLA:SidePanel] Too few theme variables found – using fallback light");
      document.body.classList.add('fallback-light');
      return true;
    }

    // Apply variables to side panel :root (no fallbacks needed here)
    const root = document.documentElement;
    Object.entries(themeVars).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    // Remove any fallback class
    document.body.classList.remove('fallback-light');

    console.log("[PLA:SidePanel] Applied", Object.keys(themeVars).length, "theme variables");
    return true;
  } catch (err) {
    console.warn("[PLA:SidePanel] Theme mirroring failed:", err);
    document.body.classList.add('fallback-light');
    return false;
  }
}

// ── Chat persistence ──
async function loadHistory() {
  const { [STORAGE_KEY]: saved } = await chrome.storage.local.get(STORAGE_KEY);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    saved.forEach(msg => addMessage(msg.sender, msg.text, false));
  } else {
    addMessage('bot', 'Hi! Ask me to analyze or update your ProjectionLab plan.');
  }
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

async function saveHistory() {
  const messages = [];
  historyDiv.querySelectorAll('.message').forEach(el => {
    const isUser = el.classList.contains('user');
    messages.push({
      sender: isUser ? 'user' : 'bot',
      text: el.textContent.trim()
    });
  });
  await chrome.storage.local.set({ [STORAGE_KEY]: messages });
}

// ── Message rendering ──
function addMessage(sender, text, shouldSave = true) {
  const div = document.createElement('div');
  div.className = `message ${sender}`;

  if (sender === 'bot') {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'bot-content';
    contentDiv.innerHTML = marked.parse(text, {
      breaks: true,
      gfm: true,
      headerIds: false
    });
    div.appendChild(contentDiv);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    };
    div.appendChild(copyBtn);
  } else {
    div.textContent = text;
  }

  historyDiv.appendChild(div);
  historyDiv.scrollTop = historyDiv.scrollHeight;

  if (shouldSave) saveHistory();
}

// ── Reset ──
function resetChat() {
  historyDiv.innerHTML = '';
  addMessage('bot', 'New chat started. How can I help you today?');
  chrome.storage.local.remove(STORAGE_KEY);
}

// ── Send ──
async function send() {
  const query = input.value.trim();
  if (!query) return;

  addMessage('user', query);
  input.value = '';

  showTypingDots();

  chrome.runtime.sendMessage({ action: 'processQuery', query }, response => {
    hideTypingDots();

    if (response?.success && response?.answer) {
      addMessage('bot', response.answer);
    } else {
      addMessage('bot', 'Something went wrong. Please try again.');
      console.log("[PLA:SidePanel] Query failed — full response:", response);
    }
  });
}

sendBtn.addEventListener('click', send);
input.addEventListener('keypress', e => {
  if (e.key === 'Enter') send();
});

// ── Typing indicator ──
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "showTypingIndicator") showTypingDots();
  if (request.action === "hideTypingIndicator") hideTypingDots();
});

function showTypingDots() {
  hideTypingDots();
  const dots = document.createElement('div');
  dots.id = 'typing-dots';
  dots.innerHTML = '<span>.</span><span>.</span><span>.</span>';
  dots.className = 'message bot';
  historyDiv.appendChild(dots);
  historyDiv.scrollTop = historyDiv.scrollHeight;
}

function hideTypingDots() {
  document.getElementById('typing-dots')?.remove();
}

// Bounce animation
const style = document.createElement('style');
style.textContent = `
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }
  #typing-dots span { animation: bounce 1.4s infinite; }
  #typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  #typing-dots span:nth-child(3) { animation-delay: 0.4s; }
`;
document.head.appendChild(style);

// ── Buttons ──
document.getElementById('settings-btn')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "openOptionsPage" });
});

document.getElementById('reset-btn')?.addEventListener('click', resetChat);

document.getElementById('open-pl-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://app.projectionlab.com' });
});

// ── Dynamic tab detection & UI refresh ──
async function updateUI() {
  const isProjectionLabTab = await applyProjectionLabTheme();
  if (isProjectionLabTab) {
    noTabMessage.classList.add('hidden');
    historyDiv.classList.remove('hidden');
    inputArea.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
    if (historyDiv.children.length === 0) {
      await loadHistory();
    }
  } else {
    noTabMessage.classList.remove('hidden');
    historyDiv.classList.add('hidden');
    inputArea.classList.add('hidden');
    resetBtn.classList.add('hidden');
  }
}

// Initial load
updateUI();

// Listen for tab changes
chrome.tabs.onActivated.addListener(() => updateUI());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateUI();
  }
});