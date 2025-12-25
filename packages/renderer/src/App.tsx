import 'virtual:uno.css'
import {createSignal, onCleanup, onMount} from 'solid-js'

type PanelItem = {
  title: string
  url: string
}

const items: PanelItem[] = [
  {title: 'ChatGPT', url: 'https://chatgpt.com'},
  {title: 'Gemini', url: 'https://gemini.google.com'},
  {title: 'Claude', url: 'https://claude.ai'},
]

type PanelProps = {
  item: PanelItem
  index: number
  widthOptions: number[]
  widthClasses: Record<number, string>
  onContentRef: (index: number, element: HTMLDivElement | undefined) => void
}

function Panel(props: PanelProps) {
  const [widthPercent, setWidthPercent] = createSignal(50)

  return (
    <div
      class={`shrink-0 flex flex-col border border-white/10 rounded overflow-hidden h-full ${props.widthClasses[widthPercent()]}`}
    >
      <div class="h-9 bg-white/5 text-white text-xs uppercase tracking-wide px-3 flex items-center justify-between gap-2">
        <span>{props.item.title}</span>
        <div class="flex items-center gap-1">
          {props.widthOptions.map(option => (
            <button
              type="button"
              class={`h-6 px-2 rounded border text-[10px] tracking-wide uppercase ${
                widthPercent() === option
                  ? 'border-white/70 text-white'
                  : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white/80'
              }`}
              onClick={() => setWidthPercent(option)}
            >
              {option}%
            </button>
          ))}
          <button
            type="button"
            class="h-6 px-2 rounded border border-white/20 text-[10px] tracking-wide uppercase text-white/70 hover:border-white/40 hover:text-white/90"
            onClick={() => {
              const send = (window as unknown as Record<string, unknown>)[btoa('send')] as
                | ((channel: string, message: unknown) => Promise<unknown>)
                | undefined
              if (send) {
                void send('webcontents-view:reload', {id: String(props.index)})
              }
            }}
          >
            Reload
          </button>
        </div>
      </div>
      <div
        ref={element => props.onContentRef(props.index, element)}
        class="flex-1 bg-black"
      />
    </div>
  )
}

function App() {
  const send = (window as unknown as Record<string, unknown>)[btoa('send')] as
    | ((channel: string, message: unknown) => Promise<unknown>)
    | undefined
  const onMessage = (window as unknown as Record<string, unknown>)[btoa('on')] as
    | ((channel: string, listener: (message: unknown) => void) => () => void)
    | undefined
  const widthOptions = [25, 33, 50, 75, 100]
  const widthClasses: Record<number, string> = {
    25: 'w-[25vw]',
    33: 'w-[33vw]',
    50: 'w-[50vw]',
    75: 'w-[75vw]',
    100: 'w-[100vw]',
  }
  const contentRefs: HTMLDivElement[] = []
  let scrollRef: HTMLDivElement | undefined
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
    scrollRef?.addEventListener('scroll', syncViews)
    const unsubscribe =
      onMessage?.('webcontents-view:scroll-x', message => {
        const deltaX = (message as {deltaX?: number} | undefined)?.deltaX
        if (typeof deltaX !== 'number' || !scrollRef) {
          return
        }

        scrollRef.scrollBy({left: deltaX, behavior: 'auto'})
      }) ?? undefined

    const resizeObserver = new ResizeObserver(syncViews)
    for (const element of contentRefs) {
      if (element) {
        resizeObserver.observe(element)
      }
    }

    onCleanup(() => {
      window.removeEventListener('resize', syncViews)
      scrollRef?.removeEventListener('scroll', syncViews)
      if (unsubscribe) {
        unsubscribe()
      }
      resizeObserver.disconnect()
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId)
      }
    })
  })

  return (
    <div ref={scrollRef} class="h-screen bg-black p-2 overflow-auto">
      <div class="flex gap-2 h-[calc(100vh-16px)]">
        {items.map((item, index) => (
          <Panel
            item={item}
            index={index}
            widthOptions={widthOptions}
            widthClasses={widthClasses}
            onContentRef={(panelIndex, element) => {
              if (element) {
                contentRefs[panelIndex] = element
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default App
