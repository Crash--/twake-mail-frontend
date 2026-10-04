// Injected in every page of the perf runs (page.addInitScript): timestamps the first row of the
// email list, the clicks and the load of the email body frame, and records long tasks.
;(() => {
  const perf = { firstRow: null, bodyShown: null, lastClick: null, longTasks: [] }
  window.__perf = perf
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) perf.longTasks.push([entry.startTime, entry.duration])
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    // longtask is Chromium only
  }
  document.addEventListener('click', () => {
    perf.lastClick = performance.now()
  }, true)
  const watch = () => {
    new MutationObserver(() => {
      if (perf.firstRow === null && document.querySelector('[data-testid="email-list-item"]')) {
        perf.firstRow = performance.now()
      }
      const frame = document.querySelector('[data-testid="email-view-body"]')
      if (frame !== null && frame.dataset.perfWatched !== 'true') {
        frame.dataset.perfWatched = 'true'
        frame.addEventListener('load', () => {
          perf.bodyShown = performance.now()
        })
      }
    }).observe(document.documentElement, { childList: true, subtree: true })
  }
  if (document.documentElement !== null) watch()
  else document.addEventListener('DOMContentLoaded', watch)
})()
