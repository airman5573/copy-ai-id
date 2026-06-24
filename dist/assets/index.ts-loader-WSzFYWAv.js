(function () {
  'use strict';

  const injectTime = performance.now();
  (async () => {
    const { onExecute } = await import(
      /* @vite-ignore */
      chrome.runtime.getURL("assets/index.ts-CW2YJYLH.js")
    );
    onExecute?.({ perf: { injectTime, loadTime: performance.now() - injectTime } });
  })().catch(console.error);

})();
