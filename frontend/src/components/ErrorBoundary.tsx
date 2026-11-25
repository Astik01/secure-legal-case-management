import { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button } from './ui';

/** Last line of defence: a render error shows a recoverable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Alert kind="error" title="Something went wrong"
          action={<Button size="sm" variant="secondary" onClick={() => window.location.assign('/')}>Reload</Button>}>
          The page could not be displayed. Reload and try again; if it keeps happening, contact an administrator.
        </Alert>
      </div>
    );
  }
}
