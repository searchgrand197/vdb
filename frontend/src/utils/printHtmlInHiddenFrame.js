/**
 * Write standalone HTML into a hidden iframe and print from the same tab.
 */
export function createSameTabPrintWindow(options = {}) {
  const { onComplete } = options
  let html = ''
  return {
    document: {
      write(chunk) {
        html += String(chunk || '')
      },
      close() {
        const iframe = document.createElement('iframe')
        iframe.setAttribute('aria-hidden', 'true')
        iframe.style.position = 'fixed'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        iframe.style.opacity = '0'
        iframe.style.pointerEvents = 'none'
        iframe.style.left = '-9999px'
        iframe.style.bottom = '0'
        document.body.appendChild(iframe)

        let cleaned = false
        let completed = false
        const notifyComplete = () => {
          if (completed) return
          completed = true
          if (typeof onComplete === 'function') {
            try { onComplete() } catch { /* ignore */ }
          }
        }
        const cleanup = () => {
          if (cleaned) return
          cleaned = true
          try { iframe.remove() } catch { /* ignore */ }
          notifyComplete()
        }

        const onFrameLoad = () => {
          const cw = iframe.contentWindow
          if (!cw) {
            cleanup()
            return
          }
          cw.addEventListener('afterprint', () => setTimeout(cleanup, 100), { once: true })
          window.addEventListener('focus', () => setTimeout(cleanup, 300), { once: true })
          setTimeout(cleanup, 120000)
        }

        iframe.addEventListener('load', onFrameLoad, { once: true })

        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) {
          cleanup()
          return
        }
        doc.open('text/html')
        doc.write(html)
        doc.close()
      },
    },
  }
}

export function writeHtmlInHiddenIframe(html, options = {}) {
  const w = createSameTabPrintWindow(options)
  w.document.write(html)
  w.document.close()
}
