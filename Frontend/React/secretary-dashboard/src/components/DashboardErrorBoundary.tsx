import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Secretary dashboard crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-base font-bold text-neutral-900">
            The schedule could not be displayed
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            An appointment on this day had incomplete data. Reload the page to
            continue.
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-[#0066ff] px-4 py-2 text-sm font-bold text-white"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
