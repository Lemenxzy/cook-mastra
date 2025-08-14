/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NODE_ENV: string
  readonly VITE_LOCAL_FETCH_URL: string
  readonly VITE_FETCH_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}