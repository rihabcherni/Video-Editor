/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_SUBTITLE_DEFAULT_SIZE?: string
  readonly VITE_SUBTITLE_DEFAULT_COLOR?: string
  readonly VITE_SUBTITLE_DEFAULT_POSITION?: 'bottom' | 'middle' | 'top'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

