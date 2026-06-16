import React, { ReactNode } from 'react';
import { UIProvider } from '../contexts/UIContext';
import { ClipboardProvider } from '../contexts/ClipboardContext';
import { DrawingProvider } from '../contexts/DrawingContext';
import { ErrorBoundary } from './ErrorBoundary';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Centralized provider wrapper for all application contexts
 * Organized from outer to inner: Error > UI > Drawing > Clipboard
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <UIProvider>
        <DrawingProvider>
          <ClipboardProvider>
            {children}
          </ClipboardProvider>
        </DrawingProvider>
      </UIProvider>
    </ErrorBoundary>
  );
};
