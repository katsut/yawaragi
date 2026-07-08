// Service worker. S2 swaps the body of handleAnalyze with the Gemini Nano
// (Prompt API) pipeline; the message wiring below stays as-is.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "YAWARAGI_ANALYZE") return;
  handleAnalyze(message.payload)
    .then(sendResponse)
    .catch((err) => {
      console.error("Yawaragi SW: handleAnalyze failed", err);
      sendResponse({
        ok: false,
        error: { code: "generation_failed", message: String(err?.message ?? err) },
      });
    });
  return true; // keep the message channel open for the async response.
});

async function handleAnalyze(payload) {
  return {
    ok: false,
    error: { code: "not_implemented", message: "AI module は S2 で実装" },
  };
}
