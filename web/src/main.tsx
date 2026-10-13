import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadDeployment, type Deployment } from './config';
import { buildWagmiConfig, type WagmiConfig } from './wagmi';
import { DeploymentContext } from './deployment-context';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 } },
});

function Root() {
  const [state, setState] = useState<{ dep: Deployment; wagmi: WagmiConfig } | { error: string } | null>(null);
  useEffect(() => {
    loadDeployment()
      .then((dep) => setState({ dep, wagmi: buildWagmiConfig(dep) }))
      .catch((e: Error) => setState({ error: e.message }));
  }, []);
  if (!state) {
    return (
      <main className="shell">
        <p role="status">Loading deployment configuration…</p>
      </main>
    );
  }
  if ('error' in state) {
    return (
      <main className="shell">
        <h1>Swarmlers</h1>
        <p role="alert">Unable to load the deployment configuration: {state.error}. Reload the page; if it persists, the export is incomplete.</p>
      </main>
    );
  }
  return (
    <DeploymentContext.Provider value={state.dep}>
      <WagmiProvider config={state.wagmi}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    </DeploymentContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
