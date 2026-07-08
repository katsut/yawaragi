// Injects the 🛡️ affordance on hover, extracts message/thread text,
// and hands off to the service worker. DOM selectors are tuned live in S3.
(() => {
  const SELECTORS = {
    slack: {
      container: '[data-qa="message_container"]',
      body: ".c-message_kit__blocks",
      sender: '[data-qa="message_sender_name"]',
    },
    backlog: {
      // best-effort: body/sender resolved from the container itself.
      container: ".comment-item, .comment",
      body: null,
      sender: null,
    },
  };

  const CONTAINER_SELECTOR = [SELECTORS.slack.container, SELECTORS.backlog.container].join(", ");
  const THREAD_LIMIT = 5;

  let currentContainer = null;
  let shieldBtn = null;

  function platformConfig(container) {
    return container.matches(SELECTORS.slack.container) ? SELECTORS.slack : SELECTORS.backlog;
  }

  function textOf(scope, selector) {
    if (!selector) return (scope.textContent ?? "").trim();
    const el = scope.querySelector(selector);
    return (el?.textContent ?? "").trim();
  }

  function collectThread(container, cfg) {
    const thread = [];
    let el = container.previousElementSibling;
    while (el && thread.length < THREAD_LIMIT) {
      if (el.matches(cfg.container)) {
        thread.push({
          sender: cfg.sender ? textOf(el, cfg.sender) : "",
          text: cfg.body ? textOf(el, cfg.body) : (el.textContent ?? "").trim(),
        });
      }
      el = el.previousElementSibling;
    }
    // preceding siblings collected nearest-first; return chronological order.
    return thread.reverse();
  }

  function extract(container) {
    const cfg = platformConfig(container);
    return {
      targetText: cfg.body ? textOf(container, cfg.body) : (container.textContent ?? "").trim(),
      thread: collectThread(container, cfg),
      sender: cfg.sender ? textOf(container, cfg.sender) : "",
    };
  }

  function ensureButton() {
    if (shieldBtn) return shieldBtn;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Yawaragi";
    btn.textContent = "🛡️";
    Object.assign(btn.style, {
      position: "absolute",
      zIndex: "2147483647",
      display: "none",
      width: "24px",
      height: "24px",
      padding: "0",
      lineHeight: "22px",
      fontSize: "14px",
      textAlign: "center",
      border: "1px solid rgba(0,0,0,0.15)",
      borderRadius: "6px",
      background: "#fff",
      cursor: "pointer",
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    });
    btn.addEventListener("click", onShieldClick);
    btn.addEventListener("mouseleave", (e) => {
      if (currentContainer && currentContainer.contains(e.relatedTarget)) return;
      hideButton();
    });
    document.body.appendChild(btn);
    shieldBtn = btn;
    return btn;
  }

  function showButtonFor(container) {
    const btn = ensureButton();
    currentContainer = container;
    const rect = container.getBoundingClientRect();
    btn.style.top = `${window.scrollY + rect.top + 4}px`;
    btn.style.left = `${window.scrollX + rect.right - 28}px`;
    btn.style.display = "block";
  }

  function hideButton() {
    if (shieldBtn) shieldBtn.style.display = "none";
    currentContainer = null;
  }

  async function onShieldClick(e) {
    e.stopPropagation();
    e.preventDefault();
    const container = currentContainer;
    const anchor = shieldBtn;
    if (!container) return;
    try {
      const { targetText, thread, sender } = extract(container);
      const capacity = (await globalThis.Yawaragi?.storage?.getCapacity?.()) ?? "普通";
      const popover = globalThis.Yawaragi?.popover;
      if (popover && typeof popover.open === "function") {
        popover.open(anchor);
      } else {
        console.warn("Yawaragi: popover 未実装のため open をスキップ");
      }
      const res = await chrome.runtime.sendMessage({
        type: "YAWARAGI_ANALYZE",
        payload: { targetText, thread, sender, capacity },
      });
      if (res && res.ok) {
        popover?.render?.(res.data);
      } else {
        popover?.renderError?.(res?.error ?? { code: "generation_failed", message: "応答がありません" });
      }
    } catch (err) {
      console.error("Yawaragi: 解析リクエストに失敗しました", err);
    }
  }

  // Delegated hover detection. mouseenter/mouseleave don't bubble, but the
  // capture phase still reaches a document-level listener for every element.
  function onEnter(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const container = target.closest(CONTAINER_SELECTOR);
    if (!container || container === currentContainer) return;
    showButtonFor(container);
  }

  function onLeave(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const container = target.closest(CONTAINER_SELECTOR);
    if (!container || container !== currentContainer) return;
    const to = e.relatedTarget;
    if (to && (to === shieldBtn || shieldBtn?.contains(to) || container.contains(to))) return;
    hideButton();
  }

  document.addEventListener("mouseenter", onEnter, true);
  document.addEventListener("mouseleave", onLeave, true);

  // Slack/Backlog recycle message DOM; drop the button if its anchor is gone.
  const observer = new MutationObserver(() => {
    if (currentContainer && !document.contains(currentContainer)) {
      hideButton();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
