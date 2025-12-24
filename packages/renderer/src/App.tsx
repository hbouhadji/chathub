import 'virtual:uno.css'
import {onCleanup, onMount} from 'solid-js'

const items = [
  {url: 'https://chatgpt.com'},
  {url: 'https://gemini.google.com'},
  {url: 'https://claude.ai'},
];

function App() {
  const send = (window as unknown as Record<string, unknown>)[btoa('send')] as
    | ((channel: string, message: unknown) => Promise<unknown>)
    | undefined
  const itemRefs: HTMLDivElement[] = []
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
          const element = itemRefs[index]
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
    for (const element of itemRefs) {
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
    <div class="h-screen bg-black flex">
      {items.map((item, index) => (
        <div
          ref={element => {
            if (element) {
              itemRefs[index] = element
            }
          }}
          class="flex-1"
        ></div>
      ))}
    </div>
  )
}

export default App
