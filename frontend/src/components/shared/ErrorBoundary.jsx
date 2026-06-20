'use client';

import { Component } from 'react';

// Catches render errors in the subtree so one broken panel doesn't blank the
// whole app. Shows a recoverable fallback.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this would go to a logging service (Sentry, etc.).
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">Something went wrong here.</p>
          <p className="mt-1 text-xs text-amber-700">{String(this.state.error.message || this.state.error)}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
