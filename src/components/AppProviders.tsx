import React from 'react';
import { type ReactNode } from 'react';
import { UIProvider } from '../contexts/UIContext';
import { ClipboardProvider } from '../contexts/ClipboardContext';
import { DrawingProvider } from '../contexts/DrawingContext';
import { TemplateProvider } from '../contexts/TemplateContext';
import { ShapeLibraryProvider } from '../contexts/ShapeLibraryContext';
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
            <TemplateProvider>
              <ShapeLibraryProvider>
                {children}
              </ShapeLibraryProvider>
            </TemplateProvider>
          </ClipboardProvider>
        </DrawingProvider>
      </UIProvider>
    </ErrorBoundary>
  );
};
