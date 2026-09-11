/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDFLARE_RADAR_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
