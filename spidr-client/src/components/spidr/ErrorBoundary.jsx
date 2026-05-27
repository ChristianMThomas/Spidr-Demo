import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('Spidr ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900 p-8 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-900/30 border border-red-500/30 flex items-center justify-center text-2xl">⚠️</div>
          <div className="text-center max-w-lg">
            <p className="text-white font-bold text-lg mb-2">Something crashed</p>
            <p className="text-zinc-400 text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <pre className="text-left bg-black/50 border border-red-900/30 rounded-xl p-4 text-xs text-red-400 overflow-auto max-h-48 mb-4">
              {this.state.error?.stack?.slice(0, 500)}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null, info: null })}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
