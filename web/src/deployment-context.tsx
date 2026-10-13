import { createContext, useContext } from 'react';
import type { Deployment } from './config';

export const DeploymentContext = createContext<Deployment | null>(null);

export function useDeployment(): Deployment {
  const dep = useContext(DeploymentContext);
  if (!dep) throw new Error('Deployment not loaded');
  return dep;
}
