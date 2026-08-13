import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // In production, you would send this to an error reporting service like Sentry
    if (typeof window !== 'undefined' && (window as any).__SENTRY_DSN__) {
      // Sentry.captureException(error, { extra: errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-white">An error has occurred</h1>
          <p className="mt-2 max-w-md text-slate-400">
            The application encountered an unexpected problem. Please refresh the page or return to home.
          </p>
          {this.state.error && (
            <pre className="mt-4 max-w-lg overflow-auto rounded-lg border border-red-500/20 bg-slate-950 p-4 text-left text-xs text-red-400">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-8 flex gap-4">
            <Button
              onClick={() => window.location.reload()}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link to="/">
              <Button variant="outline" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
