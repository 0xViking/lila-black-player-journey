import { Component, type ReactNode } from "react";

interface State { error: Error | null; }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      // User-facing message in production; full stack only in dev.
      return (
        <div className="err-box" style={{ padding: 24, color: "#e8edf6", fontSize: 14, lineHeight: 1.6 }}>
          <b style={{ color: "#f88" }}>Something went wrong rendering the map.</b>
          <div style={{ color: "#8d97ab", marginTop: 6 }}>Try reloading the page or clearing the current filters.</div>
          {import.meta.env.DEV && (
            <pre style={{ marginTop: 14, color: "#f88", fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
              {this.state.error.message}{"\n\n"}{this.state.error.stack?.split("\n").slice(0, 6).join("\n")}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
