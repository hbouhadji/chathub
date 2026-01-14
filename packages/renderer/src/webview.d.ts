import type {JSX} from 'solid-js'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      webview: JSX.HTMLAttributes<HTMLElement> & {
        src?: string
        preload?: string
      }
    }
  }
}
