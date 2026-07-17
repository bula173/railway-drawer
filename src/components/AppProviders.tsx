import React from 'react';
import { type ReactNode } from 'react';
import { UIProvider } from '../contexts/UIContext';
import { ErrorBoundary } from './ErrorBoundary';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Application provider wrapper for maxGraph native app
 * maxGraph handles all editor state natively, so we only need UI context
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <UIProvider>
        {children}
      </UIProvider>
    </ErrorBoundary>
  );
};
