/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string
	readonly VITE_PAYSTACK_PUBLIC_KEY?: string
	readonly VITE_TINGG_ENV?: string
	readonly VITE_TINGG_SCRIPT_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}