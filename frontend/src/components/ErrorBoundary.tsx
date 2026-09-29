import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
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
    console.error("ChainTrace render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 p-6 text-slate-200">
        <div className="glass w-full max-w-lg rounded-2xl p-6">
          <h1 className="text-lg font-bold text-white">Something broke while rendering</h1>
          <p className="mt-2 text-sm text-slate-400">
            The app hit an unexpected error. Reloading usually clears it. If it keeps happening, check the browser console for the stack trace.
          </p>
          <pre className="scrollbar-thin mt-4 max-h-48 overflow-auto rounded-lg bg-base-900 p-3 text-xs text-rose-300">{error.message}</pre>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                this.setState({ error: null });
              }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="btn-gradient rounded-lg px-4 py-2 text-sm font-medium text-white">
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
