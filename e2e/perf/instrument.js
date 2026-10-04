// Injected in every page of the perf runs (page.addInitScript): timestamps the first row of the
// email list, the clicks, the subject and the body frame of an email, the focus moving to the
// subject or to a row, the end of the view transitions, and records long tasks.
;(() => {
  const perf = {
    firstRow: null,
    bodyShown: null,
    lastClick: null,
    subjectShown: null,
    subjectFocused: null,
    rowFocused: null,
    transitions: 0,
    transitionEnd: null,
    longTasks: []
  }
  window.__perf = perf
  // Counts the view transitions and timestamps their end (when the animation is over)
  if (typeof document.startViewTransition === 'function') {
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = (...args) => {
      const transition = start(...args)
      perf.transitions += 1
      transition.finished.finally(() => {
        perf.transitionEnd = performance.now()
      })
      return transition
    }
  }
  document.addEventListener('focusin', event => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (perf.subjectFocused === null && target.matches('[data-testid="email-view-subject"]')) {
      perf.subjectFocused = performance.now()
    }
    if (perf.rowFocused === null && target.matches('[data-row-focus]')) {
      perf.rowFocused = performance.now()
    }
  }, true)
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
      if (perf.subjectShown === null && document.querySelector('[data-testid="email-view-subject"]')) {
        perf.subjectShown = performance.now()
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
