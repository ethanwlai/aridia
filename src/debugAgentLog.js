// Debug-mode logger: ingest + local Vite sink (writes debug-f391a9.log)
export function agentLog({ hypothesisId, location, message, data, runId = 'pre-fix' }) {
  const payload = {
    sessionId: 'f391a9',
    runId,
    hypothesisId,
    location,
    message,
    data: data || {},
    timestamp: Date.now(),
  };
  const body = JSON.stringify(payload);
  // #region agent log
  fetch('http://127.0.0.1:7371/ingest/2eed45bb-2200-47aa-912e-5e702c03d5d8', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f391a9' },
    body,
  }).catch(() => {});
  fetch('/__debug_agent_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
  // #endregion
}
