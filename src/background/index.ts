import {
  isWebmateLogRelayMessage,
  type WebmateLogRelayMessage,
  type WebmateLogRelayResponse,
} from '../shared/webmatelog-relay';

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isWebmateLogRelayMessage(message)) {
    return undefined;
  }

  void relayWebmateLog(message).then(sendResponse);
  return true;
});

async function relayWebmateLog(message: WebmateLogRelayMessage): Promise<WebmateLogRelayResponse> {
  try {
    const response = await fetch(message.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message.payload),
      signal: timeoutSignal(message.timeoutMs),
    });

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined') {
    const abortSignal = AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal };
    if (typeof abortSignal.timeout === 'function') {
      return abortSignal.timeout(ms);
    }
  }

  if (typeof AbortController === 'undefined') {
    return undefined;
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
