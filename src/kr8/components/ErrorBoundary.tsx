import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("KR8 Digitals ErrorBoundary caught an exception:", error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack?.slice(0, 1000) });
    try {
      const msg = `${error.message}\n${error.stack?.slice(0, 2000)}\n${errorInfo.componentStack?.slice(0, 2000)}`;
      if (typeof window !== "undefined" && (window as any).localStorage) {
        localStorage.setItem("kr8_last_error", JSON.stringify({ message: error.message, stack: error.stack, componentStack: errorInfo.componentStack, time: Date.now() }));
      }
      console.error(msg);
    } catch {}
  }

  handleReload = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("kr8_last_error");
        window.location.href = "/";
      }
    } catch {
      if (typeof window !== "undefined") window.location.reload();
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const isDev = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d0118] px-6 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-pink text-3xl shadow-xl">
            ⚡
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">KR8 Digitals — We Make It Happen</h1>
          <p className="mt-2 max-w-md text-sm text-[#cabfe0] leading-relaxed">
            Something unexpected happened, but your progress is safe. Our team has been notified. Tap below to continue building.
          </p>
          {isDev && this.state.error && (
            <div className="mt-4 max-w-2xl w-full text-left rounded-xl bg-red-950/50 border border-red-500/30 p-4 overflow-auto max-h-64">
              <p className="text-xs font-bold text-red-300 mb-1">Debug Info (dev only):</p>
              <p className="text-[11px] font-mono text-red-200 break-all whitespace-pre-wrap">{this.state.error.message}</p>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all"
            >
              <span>↻</span>
              <span>Try Again</span>
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-pink px-6 py-2.5 text-xs font-bold text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <span>↻</span>
              <span>Reload KR8</span>
            </button>
          </div>
          <p className="mt-4 text-[10px] text-[#8a7ba8]">If this persists, clear cache or contact support@kr8digitals.com</p>
        </div>
      );
    }

    return this.props.children;
  }
}
