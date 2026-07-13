import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-semibold text-neutral-800">Terjadi kesalahan</p>
          <p className="max-w-sm text-sm text-neutral-500">{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Muat Ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
