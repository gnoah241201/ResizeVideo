/**
 * AppState component for desktop onboarding UI states
 * Displays the current bootstrap state to the user
 */

import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

// Bootstrap state types (must match server/types)
export type DesktopBootstrapState =
  | { status: 'idle' }
  | { status: 'preparing'; message: string }
  | { status: 'verifying'; message: string }
  | { status: 'ready'; version: string }
  | { status: 'blocked'; error: string; action?: string };

interface AppStateProps {
  /**
   * Initial state - if not provided, will fetch from backend
   */
  initialState?: DesktopBootstrapState;
  /**
   * Called when user clicks action button in blocked state
   */
  onAction?: () => void;
  /**
   * Polling interval for checking state (default: 2000ms)
   */
  pollInterval?: number;
}

export function DesktopState({ initialState, onAction, pollInterval = 2000 }: AppStateProps) {
  const [state, setState] = useState<DesktopBootstrapState | null>(initialState || null);
  const [isLoading, setIsLoading] = useState(!initialState);

  // Poll for state if not provided initially
  useEffect(() => {
    if (initialState) {
      setState(initialState);
      setIsLoading(false);
      return;
    }

    const fetchState = async () => {
      try {
        const res = await fetch('/api/bootstrap/state');
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch {
        // Silently fail - will retry
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();

    const interval = setInterval(fetchState, pollInterval);
    return () => clearInterval(interval);
  }, [initialState, pollInterval]);

  // Render based on state
  if (isLoading || !state) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-neutral-400">Loading...</span>
      </div>
    );
  }

  switch (state.status) {
    case 'idle':
      return <IdleState />;

    case 'preparing':
      return <PreparingState message={state.message} />;

    case 'verifying':
      return <VerifyingState message={state.message} />;

    case 'ready':
      return <ReadyState version={state.version} />;

    case 'blocked':
      return <BlockedState error={state.error} action={state.action} onAction={onAction} />;

    default:
      return <UnknownState />;
  }
}

// Sub-components for each state

function IdleState() {
  return (
    <div className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-xl">
      <Info className="w-5 h-5 text-neutral-400" />
      <span className="text-neutral-400">Initializing...</span>
    </div>
  );
}

function PreparingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
      <div className="relative">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-blue-400 mb-1">Preparing</h3>
        <p className="text-neutral-400">{message}</p>
      </div>
      <div className="w-48 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
      </div>
    </div>
  );
}

function VerifyingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
      <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      <div className="text-center">
        <h3 className="text-lg font-semibold text-amber-400 mb-1">Verifying</h3>
        <p className="text-neutral-400">{message}</p>
      </div>
    </div>
  );
}

function ReadyState({ version }: { version: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
      <CheckCircle className="w-6 h-6 text-emerald-500" />
      <div>
        <span className="text-emerald-400 font-medium">Ready</span>
        {version && <span className="text-neutral-500 ml-2 text-sm">v{version}</span>}
      </div>
    </div>
  );
}

function BlockedState({ error, action, onAction }: { error: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl">
      <div className="flex items-start gap-3">
        <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-400 mb-1">Setup Incomplete</h3>
          <p className="text-neutral-300">{error}</p>
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-3 pt-2 border-t border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-neutral-400">{action}</span>
          {onAction && (
            <button
              onClick={onAction}
              className="ml-auto px-4 py-2 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UnknownState() {
  return (
    <div className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-xl">
      <AlertTriangle className="w-5 h-5 text-amber-500" />
      <span className="text-neutral-400">Unknown state</span>
    </div>
  );
}

export default DesktopState;
