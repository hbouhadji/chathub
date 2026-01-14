import {createMemo, createSignal, onMount} from 'solid-js'

type MentionTextareaProps = {
  value: string
  onValueChange: (value: string) => void
  onRef?: (element: HTMLTextAreaElement | undefined) => void
  options: string[]
  placeholder?: string
  maxHeight?: number
  class?: string
  containerClass?: string
}

export default function MentionTextarea(props: MentionTextareaProps) {
  let textareaRef: HTMLTextAreaElement | undefined
  const [mentionOpen, setMentionOpen] = createSignal(false)
  const [mentionQuery, setMentionQuery] = createSignal('')
  const [mentionStart, setMentionStart] = createSignal<number | null>(null)
  const [mentionIndex, setMentionIndex] = createSignal(0)

  const filterMentions = (query: string, list: string[]) => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return list
    }
    return list.filter(option => {
      return (
        option.toLowerCase().includes(normalized)
      )
    })
  }

  const filteredMentions = createMemo(() => filterMentions(mentionQuery(), props.options))

  onMount(() => {
    resizeTextarea()
  })

  const resizeTextarea = () => {
    if (!textareaRef) {
      return
    }

    const maxHeight = props.maxHeight ?? 160
    textareaRef.style.height = 'auto'
    const nextHeight = Math.min(textareaRef.scrollHeight, maxHeight)
    textareaRef.style.height = `${nextHeight}px`
    textareaRef.style.overflowY = textareaRef.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  const closeMentions = () => {
    setMentionOpen(false)
    setMentionQuery('')
    setMentionStart(null)
    setMentionIndex(0)
  }

  const updateMentions = (value: string, cursorIndex: number) => {
    const slice = value.slice(0, cursorIndex)
    const atIndex = slice.lastIndexOf('@')
    if (atIndex < 0) {
      closeMentions()
      return
    }

    if (atIndex > 0 && !/\s/.test(slice[atIndex - 1])) {
      closeMentions()
      return
    }

    const query = slice.slice(atIndex + 1)
    if (/\s/.test(query)) {
      closeMentions()
      return
    }

    setMentionStart(atIndex)
    setMentionQuery(query)
    const matches = filterMentions(query, props.options)
    if (matches.length === 0) {
      closeMentions()
      return
    }
    setMentionOpen(true)
    setMentionIndex(0)
  }

  const insertMention = (option: string) => {
    if (!textareaRef) {
      return
    }

    const start = mentionStart()
    const cursorIndex = textareaRef.selectionStart ?? 0
    if (start === null || start > cursorIndex) {
      closeMentions()
      return
    }

    const value = textareaRef.value
    const before = value.slice(0, start)
    const after = value.slice(cursorIndex)
    const insertion = `@${option}`
    const nextValue = `${before}${insertion} ${after}`
    props.onValueChange(nextValue)
    closeMentions()
    requestAnimationFrame(() => {
      if (!textareaRef) {
        return
      }
      const nextCursor = before.length + insertion.length + 1
      textareaRef.selectionStart = nextCursor
      textareaRef.selectionEnd = nextCursor
      textareaRef.focus()
      resizeTextarea()
    })
  }

  return (
    <div class={`relative flex-1 ${props.containerClass ?? ''}`}>
      <textarea
        ref={element => {
          textareaRef = element
          props.onRef?.(element)
        }}
        value={props.value}
        placeholder={props.placeholder}
        class={`w-full bg-black text-white resize-none outline-none leading-6 p-2 ${props.class ?? ''}`}
        onInput={event => {
          const nextValue = event.currentTarget.value
          props.onValueChange(nextValue)
          updateMentions(nextValue, event.currentTarget.selectionStart ?? nextValue.length)
          resizeTextarea()
        }}
        onKeyUp={event => {
          if (
            event.key === 'ArrowLeft' ||
            event.key === 'ArrowRight' ||
            event.key === 'Home' ||
            event.key === 'End'
          ) {
            updateMentions(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
          }
        }}
        onClick={event => {
          updateMentions(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
        }}
        onBlur={() => {
          closeMentions()
        }}
        onKeyDown={event => {
          if (!mentionOpen()) {
            return
          }

          const matches = filteredMentions()
          if (matches.length === 0) {
            closeMentions()
            return
          }

          switch (event.key) {
            case 'ArrowDown': {
              event.preventDefault()
              setMentionIndex(index => (index + 1) % matches.length)
              break
            }
            case 'ArrowUp': {
              event.preventDefault()
              setMentionIndex(index => (index - 1 + matches.length) % matches.length)
              break
            }
            case 'Enter':
            case 'Tab': {
              event.preventDefault()
              const option = matches[mentionIndex()]
              if (option) {
                insertMention(option)
              }
              break
            }
            case 'Escape': {
              event.preventDefault()
              closeMentions()
              break
            }
            default:
              break
          }
        }}
      />
      {mentionOpen() && (
        <div class="absolute left-2 bottom-full mb-2 w-64 rounded border border-white/15 bg-black/95 text-white shadow-lg">
          <div class="px-3 py-2 text-[10px] uppercase tracking-wide text-white/50">Mentions</div>
          <div class="max-h-40 overflow-auto">
            {filteredMentions().map((option, index) => (
              <button
                type="button"
                class={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${
                  index === mentionIndex() ? 'bg-white/10' : ''
                }`}
                onMouseDown={event => {
                  event.preventDefault()
                  insertMention(option)
                }}
              >
                <div class="flex items-center justify-between gap-2">
                  <span>@{option}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
