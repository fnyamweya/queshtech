import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'

function toUploadErrorMessage(error: unknown): string {
  if (!error) return 'Request failed'
  if (typeof error === 'string') return error
  if (typeof error === 'object') {
    const maybeMessage = (error as any)?.message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage

    const maybeBodyMessage = (error as any)?.body?.message
    if (typeof maybeBodyMessage === 'string' && maybeBodyMessage.trim()) return maybeBodyMessage

    const maybeBodyError = (error as any)?.body?.error
    if (typeof maybeBodyError === 'string' && maybeBodyError.trim()) return maybeBodyError
  }
  return 'Request failed'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeStatus(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value.trim().toLowerCase()
  return String(value).trim().toLowerCase()
}

function isTerminalStatus(status: string): boolean {
  const s = normalizeStatus(status)
  return ['completed', 'complete', 'done', 'success', 'succeeded', 'failed', 'error', 'cancelled', 'canceled'].includes(s)
}

function isSuccessStatus(status: string): boolean {
  const s = normalizeStatus(status)
  return ['completed', 'complete', 'done', 'success', 'succeeded'].includes(s)
}

function extractJobId(payload: unknown): string | null {
  const p = (payload as any)?.data ?? payload
  const direct = (p as any)?.jobId ?? (p as any)?.uploadJobId ?? (p as any)?.id
  if (isNonEmptyString(direct)) return direct

  const nested = (p as any)?.job?.id ?? (p as any)?.uploadJob?.id
  if (isNonEmptyString(nested)) return nested

  return null
}

function extractJobStatus(payload: unknown): string {
  const p = (payload as any)?.data ?? payload
  return (
    (p as any)?.status ??
    (p as any)?.state ??
    (p as any)?.jobStatus ??
    (p as any)?.uploadStatus ??
    ''
  )
}

function extractJobError(payload: unknown): string | null {
  const p = (payload as any)?.data ?? payload
  const candidates = [
    (p as any)?.error,
    (p as any)?.message,
    (p as any)?.failureReason,
    (p as any)?.result?.error,
    (p as any)?.result?.message,
  ]
  const found = candidates.find(isNonEmptyString)
  return found ? found : null
}

function extractUrls(payload: unknown): string[] {
  const p = (payload as any)?.data ?? payload

  // Upload job contract: URLs are returned in uploaded[] items.
  const fromUploadedItems = (items: unknown): string[] => {
    if (!Array.isArray(items)) return []
    return (items as any[])
      .map((f: any) => f?.url ?? f?.publicUrl ?? f?.signedUrl ?? f?.location ?? f?.path)
      .filter(isNonEmptyString)
  }

  const resultUploaded = (p as any)?.result?.uploaded
  const resultUrls = fromUploadedItems(resultUploaded)
  if (resultUrls.length) return resultUrls

  const uploaded = (p as any)?.uploaded
  const uploadedUrls = fromUploadedItems(uploaded)
  if (uploadedUrls.length) return uploadedUrls

  const directArray = (p as any)?.urls
  if (Array.isArray(directArray)) return directArray.filter(isNonEmptyString)

  const filesArray = (p as any)?.files
  if (Array.isArray(filesArray)) {
    const urls = filesArray
      .map((f: any) => f?.url ?? f?.publicUrl ?? f?.signedUrl ?? f?.location ?? f?.path)
      .filter(isNonEmptyString)
    if (urls.length) return urls
  }

  const directUrl = (p as any)?.url ?? (p as any)?.publicUrl ?? (p as any)?.signedUrl ?? (p as any)?.location ?? (p as any)?.fileUrl
  if (isNonEmptyString(directUrl)) return [directUrl]

  if (Array.isArray(p)) return (p as any[]).filter(isNonEmptyString)
  if (isNonEmptyString(p)) return [p]

  return []
}

function moveInArray<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return list
  if (fromIndex < 0 || fromIndex >= list.length) return list
  if (toIndex < 0 || toIndex >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export type CommonUploadHandle = {
  upload: () => Promise<{ urls: string[]; rawResponse: unknown }>
  clear: () => void
  getFiles: () => File[]
}

export type CommonUploadProps = {
  folder: string
  token?: string | null
  label?: string
  description?: string
  accept?: string
  multiple?: boolean
  disabled?: boolean
  mode?: 'immediate' | 'deferred'
  endpoint?: string
  jobEndpoint?: (jobId: string) => string
  folderFieldName?: string
  fileFieldName?: string
  isPublic?: boolean
  isPublicFieldName?: string
  imagesOnly?: boolean
  pollJob?: boolean
  pollIntervalMs?: number
  pollTimeoutMs?: number
  onFilesChange?: (files: File[]) => void
  onUploaded: (urls: string[], rawResponse: unknown) => void
}

export const CommonUpload = forwardRef<CommonUploadHandle, CommonUploadProps>(function CommonUpload(props, ref) {
  const api = useMemo(() => createApiClient({ token: props.token }), [props.token])

  const endpoint = props.endpoint || endpoints.commonUploads.upload
  const jobEndpoint = props.jobEndpoint || endpoints.commonUploads.job
  const folderFieldName = props.folderFieldName || 'folder'
  const fileFieldName = props.fileFieldName || 'files'
  const isPublicFieldName = props.isPublicFieldName || 'isPublic'
  const imagesOnly = Boolean(props.imagesOnly)
  const pollJob = props.pollJob !== false
  const mode = props.mode ?? 'immediate'
  const pollIntervalMs = props.pollIntervalMs ?? 1200
  const pollTimeoutMs = props.pollTimeoutMs ?? 2 * 60_000

  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const [previews, setPreviews] = useState<Array<{ name: string; url: string }>>([])

  const inputRef = useRef<HTMLInputElement | null>(null)

  const pollAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    props.onFilesChange?.(files)
  }, [files, props])

  useEffect(() => {
    if (!imagesOnly) {
      setPreviews([])
      return
    }

    const next = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))
    setPreviews(next)
    return () => {
      next.forEach((p) => URL.revokeObjectURL(p.url))
    }
  }, [files, imagesOnly])

  const onPickFiles = (next: FileList | null) => {
    if (!next || !next.length) {
      setFiles([])
      return
    }

    const list = Array.from(next)
    const selected = props.multiple ? list : [list[0]]

    if (imagesOnly) {
      const nonImages = selected.filter((f) => !(typeof f.type === 'string' && f.type.startsWith('image/')))
      if (nonImages.length) {
        toast.error('Only images are allowed', {
          description: nonImages.length === 1 ? nonImages[0].name : `${nonImages.length} non-image files selected`,
        })
        setFiles([])
        return
      }
    }

    setFiles(selected)
  }

  const clear = () => setFiles([])

  const clearJob = () => {
    pollAbortRef.current?.abort()
    pollAbortRef.current = null
  }

  const pollJobUntilDone = async (nextJobId: string) => {
    const startedAt = Date.now()
    pollAbortRef.current?.abort()
    const abort = new AbortController()
    pollAbortRef.current = abort

    while (!abort.signal.aborted) {
      if (Date.now() - startedAt > pollTimeoutMs) {
        throw new Error('Upload job timed out. Please refresh the job status.')
      }

      const resp = await api.requestRaw<unknown>(jobEndpoint(nextJobId), {
        method: 'GET',
        token: props.token ?? null,
        signal: abort.signal,
      })

      const statusRaw = extractJobStatus(resp)
      const status = normalizeStatus(statusRaw)

      if (isTerminalStatus(status)) {
        return resp
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }

    throw new Error('Upload job cancelled')
  }

  const uploadSelected = async (): Promise<{ urls: string[]; rawResponse: unknown }> => {
    if (!files.length) throw new Error('No files selected')

    if (imagesOnly) {
      const nonImages = files.filter((f) => !(typeof f.type === 'string' && f.type.startsWith('image/')))
      if (nonImages.length) {
        throw new Error(nonImages.length === 1 ? `${nonImages[0].name} is not an image` : 'Only images are allowed')
      }
    }

    setIsUploading(true)
    clearJob()
    try {
      const form = new FormData()
      form.append(folderFieldName, props.folder)
      if (typeof props.isPublic === 'boolean') {
        form.append(isPublicFieldName, String(props.isPublic))
      }
      files.forEach((file) => form.append(fileFieldName, file))

      const uploadResp = await api.requestRaw<unknown>(endpoint, {
        method: 'POST',
        body: form,
        token: props.token ?? null,
      })

      // New contract: upload creates a background job.
      const nextJobId = extractJobId(uploadResp)
      if (nextJobId && pollJob) {
        const jobResp = await pollJobUntilDone(nextJobId)
        const status = normalizeStatus(extractJobStatus(jobResp))

        if (!isSuccessStatus(status)) {
          throw new Error(extractJobError(jobResp) || 'Upload job failed')
        }

        const urls = extractUrls(jobResp)
        if (!urls.length) throw new Error('Upload completed, but no URL returned')

        props.onUploaded(urls, jobResp)
        clear()
        if (inputRef.current) inputRef.current.value = ''
        return { urls, rawResponse: jobResp }
      }

      // Back-compat: endpoint returns URLs directly.
      const urls = extractUrls(uploadResp)
      if (!urls.length) throw new Error('Upload succeeded, but no URL returned')

      props.onUploaded(urls, uploadResp)
      clear()
      if (inputRef.current) inputRef.current.value = ''
      return { urls, rawResponse: uploadResp }
    } finally {
      setIsUploading(false)
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      upload: uploadSelected,
      clear: () => {
        setFiles([])
        if (inputRef.current) inputRef.current.value = ''
      },
      getFiles: () => files,
    }),
    [files]
  )

  const onUploadClick = async () => {
    try {
      setIsUploading(true)
      clearJob()
      const { urls } = await uploadSelected()
      toast.success('Upload complete', { description: `${urls.length} file${urls.length === 1 ? '' : 's'} uploaded.` })
    } catch (e) {
      toast.error('Upload failed', { description: toUploadErrorMessage(e) })
    } finally {
      setIsUploading(false)
    }
  }

  const selectionSummary = useMemo(() => {
    if (!files.length) return ''
    if (files.length === 1) return files[0].name
    return `${files.length} files selected`
  }, [files])

  return (
    <div className="space-y-2">
      {props.label ? <Label>{props.label}</Label> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          ref={inputRef}
          type="file"
          accept={props.accept}
          multiple={Boolean(props.multiple)}
          disabled={props.disabled || isUploading}
          onChange={(e) => onPickFiles(e.target.files)}
          className="sm:flex-1"
        />
        <div className="flex items-center gap-2">
          {mode === 'immediate' ? (
            <Button type="button" onClick={onUploadClick} disabled={props.disabled || isUploading || !files.length}>
              {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {isUploading ? 'Uploading…' : 'Upload'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clear()
              if (inputRef.current) inputRef.current.value = ''
            }}
            disabled={props.disabled || isUploading || !files.length}
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {props.description ? <div className="text-xs text-muted-foreground">{props.description}</div> : null}

      {imagesOnly && previews.length ? (
        <div className="flex flex-wrap gap-3">
          {previews.map((p, idx) => (
            <div
              key={`${p.url}-${idx}`}
              draggable={!props.disabled}
              onDragStart={(e) => {
                if (props.disabled) return
                e.dataTransfer.setData('text/plain', String(idx))
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (props.disabled) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                if (props.disabled) return
                e.preventDefault()
                const from = Number(e.dataTransfer.getData('text/plain'))
                if (!Number.isFinite(from) || from === idx) return
                setFiles((curr) => moveInArray(curr, from, idx))
              }}
              className={props.disabled ? 'relative h-20 w-20 overflow-hidden rounded-md border opacity-70' : 'relative h-20 w-20 overflow-hidden rounded-md border cursor-move'}
              title={props.disabled ? undefined : 'Drag to reorder'}
            >
              <img src={p.url} alt={p.name} className="h-full w-full object-cover" loading="lazy" draggable={false} />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => setFiles((curr) => curr.filter((_, i) => i !== idx))}
                disabled={props.disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : selectionSummary ? (
        <div className="text-xs text-muted-foreground truncate">{selectionSummary}</div>
      ) : null}
    </div>
  )
})
