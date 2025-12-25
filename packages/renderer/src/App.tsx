import 'virtual:uno.css'
import {onCleanup, onMount} from 'solid-js'

const items = [
  {title: 'ChatGPT', url: 'https://chatgpt.com'},
  {title: 'Gemini', url: 'https://gemini.google.com'},
  {title: 'Claude', url: 'https://claude.ai'},
];

function App() {
  const send = (window as unknown as Record<string, unknown>)[btoa('send')] as
    | ((channel: string, message: unknown) => Promise<unknown>)
    | undefined
  const contentRefs: HTMLDivElement[] = []
  let frameId: number | undefined

  const syncViews = () => {
    if (!send) {
      return
    }

    if (frameId !== undefined) {
      cancelAnimationFrame(frameId)
    }

    frameId = requestAnimationFrame(() => {
      const layout = items
        .map((item, index) => {
          const element = contentRefs[index]
          if (!element) {
            return null
          }

          const rect = element.getBoundingClientRect()
          return {
            id: String(index), // @todo:
            url: item.url,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

      void send('webcontents-view:sync', layout)
    })
  }

  onMount(() => {
    syncViews()
    window.addEventListener('resize', syncViews)

    const resizeObserver = new ResizeObserver(syncViews)
    for (const element of contentRefs) {
      if (element) {
        resizeObserver.observe(element)
      }
    }

    onCleanup(() => {
      window.removeEventListener('resize', syncViews)
      resizeObserver.disconnect()
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId)
      }
    })
  })

  return (
    <div class="h-screen bg-black flex p-2 gap-2">
      {items.map((item, index) => (
        <div class="flex-1 flex flex-col border border-white/10 rounded overflow-hidden">
          <div class="h-9 bg-white/5 text-white text-xs uppercase tracking-wide px-3 flex items-center">
            {item.title}
          </div>
          <div
            ref={element => {
              if (element) {
                contentRefs[index] = element
              }
            }}
            class="flex-1 bg-black"
          />
        </div>
      ))}
    </div>
  )
}

export default App
