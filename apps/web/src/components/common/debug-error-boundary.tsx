import { Component, type ReactNode } from 'react'

type DebugErrorBoundaryProps = {
  children: ReactNode
}

type DebugErrorBoundaryState = {
  error: Error | null
  componentStack: string
}

export class DebugErrorBoundary extends Component<DebugErrorBoundaryProps, DebugErrorBoundaryState> {
  state: DebugErrorBoundaryState = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<DebugErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Keep this extremely lightweight; it helps identify the component tree causing runtime loops.
    // eslint-disable-next-line no-console
    console.error('[DebugErrorBoundary]', error)
    // eslint-disable-next-line no-console
    console.error(info.componentStack)
    this.setState({ componentStack: info.componentStack || '' })
  }

  render() {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1200px] py-10">
          <h1 className="text-2xl font-bold">Runtime error</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message}
          </p>

          <div className="mt-6 rounded-xl border bg-card p-4">
            <div className="text-sm font-semibold">Component stack</div>
            <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {componentStack || '(no component stack available)'}
            </pre>
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            Fix target: a component that triggers repeated ref attach/detach (often Radix <code>asChild</code> composition).
          </div>
        </div>
      </div>
    )
  }
}
