import 'virtual:uno.css'
import {createSignal, onMount} from 'solid-js'

type PanelItem = {
  title: string
  url: string
  inputSelector: string
  sendButtonSelector?: string
}

type WebviewElement = HTMLElement & {
  reload?: () => void
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<unknown>
}

const items: PanelItem[] = [
  {title: 'ChatGPT', url: 'https://chatgpt.com', inputSelector: '#prompt-textarea', sendButtonSelector: "#composer-submit-button"},
  {title: 'Gemini', url: 'https://gemini.google.com', inputSelector: '.ql-editor'},
  {title: 'Claude', url: 'https://claude.ai', inputSelector: 'div[contenteditable=true]', sendButtonSelector: 'button[aria-label="Send message"]'},
]

type PanelProps = {
  item: PanelItem
  index: number
  widthOptions: number[]
  widthClasses: Record<number, string>
  onWebviewRef: (index: number, element: WebviewElement | undefined) => void
  onReload: (index: number) => void
}

function Panel(props: PanelProps) {
  const [widthPercent, setWidthPercent] = createSignal(50)

  return (
    <div
      class={`shrink-0 flex flex-col border border-white/10 overflow-hidden h-full ${props.widthClasses[widthPercent()]}`}
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
              props.onReload(props.index)
            }}
          >
            Reload
          </button>
        </div>
      </div>
      <webview
        ref={element => props.onWebviewRef(props.index, element)}
        src={props.item.url}
        class="flex-1 w-full bg-black"
      />
    </div>
  )
}

function App() {
  const widthOptions = [25, 33, 50, 75, 100]
  const widthClasses: Record<number, string> = {
    25: 'w-[25vw]',
    33: 'w-[33vw]',
    50: 'w-[50vw]',
    75: 'w-[75vw]',
    100: 'w-[100vw]',
  }
  const webviewRefs: WebviewElement[] = []
  let textareaRef: HTMLTextAreaElement | undefined

  onMount(() => {
    resizeTextarea()
  })

  const resizeTextarea = () => {
    if (!textareaRef) {
      return
    }

    const maxHeight = 160
    textareaRef.style.height = 'auto'
    const nextHeight = Math.min(textareaRef.scrollHeight, maxHeight)
    textareaRef.style.height = `${nextHeight}px`
    textareaRef.style.overflowY = textareaRef.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  return (
    <div class="h-screen bg-black p-2 flex flex-col gap-2">
      <div class="flex-1 min-h-0 overflow-auto">
        <div class="flex gap-2 h-full min-h-0">
          {items.map((item, index) => (
            <Panel
              item={item}
              index={index}
              widthOptions={widthOptions}
              widthClasses={widthClasses}
              onWebviewRef={(panelIndex, element) => {
                if (element) {
                  webviewRefs[panelIndex] = element
                }
              }}
              onReload={panelIndex => {
                const webview = webviewRefs[panelIndex]
                if (webview?.reload) {
                  webview.reload()
                }
              }}
            />
          ))}
        </div>
      </div>

      <div class="border border-white/20 flex items-stretch">
        <textarea
          ref={element => {
            if (element) {
              textareaRef = element
            }
          }}
          placeholder="Ask anything"
          class="flex-1 bg-black text-white resize-none outline-none leading-6 p-2"
          onInput={resizeTextarea}
        />
        <button
          type="button"
          class="px-3 border-l border-white/20 text-[10px] tracking-wide uppercase text-white/70 hover:text-white/90"
          onClick={() => {
            if (!textareaRef) {
              return
            }
            const text = textareaRef.value
            const scriptBody = `
              const nodes = Array.from(document.querySelectorAll(selector));
              if (nodes.length === 0) return 0;
              const target = nodes[0];
              for (const node of nodes) {
                if ('value' in node) {
                  node.value = text;
                  node.dispatchEvent(new InputEvent('input', {bubbles: true}));
                  node.dispatchEvent(new Event('change', {bubbles: true}));
                  continue;
                }
                if (node.isContentEditable) {
                  node.textContent = text;
                  node.dispatchEvent(new InputEvent('input', {bubbles: true}));
                  node.dispatchEvent(new Event('change', {bubbles: true}));
                }
              }
              const delayMs = 120;
              if (sendButtonSelector) {
                const button = document.querySelector(sendButtonSelector);
                if (button && 'click' in button) {
                  setTimeout(() => button.click(), delayMs);
                  return nodes.length;
                }
              }
              if (target && 'focus' in target) {
                target.focus();
                const eventInit = {bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13};
                setTimeout(() => {
                  target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
                  target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
                  target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
                }, delayMs);
              }
              return nodes.length;
            `

            items.forEach((item, index) => {
              const webview = webviewRefs[index]
              if (!webview?.executeJavaScript) {
                return
              }
              const perViewScript = `(function(text, selector, sendButtonSelector) {${scriptBody}})(${JSON.stringify(
                text,
              )}, ${JSON.stringify(item.inputSelector)}, ${JSON.stringify(item.sendButtonSelector ?? null)});`
              void webview.executeJavaScript(perViewScript, true).catch(() => undefined)
            })
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default App
