/**
 * Error handling utilities with categorized error messages
 */

import { logger } from './logger';

export type ErrorCategory =
  | 'clipboard'
  | 'file'
  | 'export'
  | 'import'
  | 'network'
  | 'validation'
  | 'permission'
  | 'unknown';

export interface ErrorMessage {
  title: string;
  message: string;
  details?: string;
  category: ErrorCategory;
  action?: {
    label: string;
    callback: () => void;
  };
}

/**
 * Categorize and format errors for user display
 */
export const getErrorMessage = (error: unknown, context: string): ErrorMessage => {
  logger.error('ErrorHandling', `Error in ${context}`, { error });

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return {
        title: 'Permission Denied',
        message: 'Clipboard access was denied',
        details: 'Grant clipboard permission in browser settings to use this feature',
        category: 'permission',
      };
    }
    if (error.name === 'NotSupportedError') {
      return {
        title: 'Feature Not Supported',
        message: 'This browser does not support clipboard operations',
        details: 'Try using a modern browser like Chrome, Firefox, Safari, or Edge',
        category: 'permission',
      };
    }
  }

  if (error instanceof SyntaxError) {
    return {
      title: 'Invalid Format',
      message: 'The file or data format is invalid',
      details: error.message,
      category: 'validation',
    };
  }

  if (error instanceof TypeError) {
    if (error.message.includes('NetworkError')) {
      return {
        title: 'Network Error',
        message: 'Failed to complete network operation',
        details: 'Check your internet connection and try again',
        category: 'network',
      };
    }
  }

  if (error instanceof Error) {
    // Generic error
    if (error.message.includes('timeout')) {
      return {
        title: 'Operation Timeout',
        message: 'The operation took too long and was cancelled',
        category: 'unknown',
      };
    }

    if (error.message.includes('QuotaExceeded')) {
      return {
        title: 'Storage Full',
        message: 'Browser storage quota exceeded',
        details: 'Clear some files or data to make space',
        category: 'permission',
      };
    }

    return {
      title: 'Error',
      message: error.message || 'An unexpected error occurred',
      category: 'unknown',
    };
  }

  return {
    title: 'Unknown Error',
    message: 'An unexpected error occurred',
    details: String(error),
    category: 'unknown',
  };
};

/**
 * Safe clipboard read operation with error handling
 */
export const readClipboardSafely = async (): Promise<{
  success: boolean;
  data?: ClipboardItems;
  error?: ErrorMessage;
}> => {
  try {
    if (!navigator.clipboard?.read) {
      throw new DOMException('Clipboard read not supported', 'NotSupportedError');
    }

    const data = await navigator.clipboard.read();
    logger.debug('ErrorHandling', 'Clipboard read successful', {
      itemCount: data.length,
    });
    return { success: true, data };
  } catch (error) {
    const errorMsg = getErrorMessage(error, 'clipboard.read');
    logger.warn('ErrorHandling', 'Clipboard read failed', { errorMsg });
    return { success: false, error: errorMsg };
  }
};

/**
 * Safe file read operation with error handling
 */
export const readFileSafely = async (file: File): Promise<{
  success: boolean;
  content?: string;
  error?: ErrorMessage;
}> => {
  return new Promise(resolve => {
    try {
      if (!file || !(file instanceof File)) {
        throw new TypeError('Invalid file');
      }

      const reader = new FileReader();

      reader.onload = event => {
        try {
          const content = event.target?.result as string;
          if (!content) {
            throw new Error('File is empty');
          }
          logger.debug('ErrorHandling', 'File read successful', {
            fileName: file.name,
            size: file.size,
          });
          resolve({ success: true, content });
        } catch (error) {
          const errorMsg = getErrorMessage(error, 'file.onload');
          resolve({ success: false, error: errorMsg });
        }
      };

      reader.onerror = () => {
        const errorMsg: ErrorMessage = {
          title: 'File Read Error',
          message: `Failed to read file: ${file.name}`,
          category: 'file',
        };
        resolve({ success: false, error: errorMsg });
      };

      reader.readAsText(file);
    } catch (error) {
      const errorMsg = getErrorMessage(error, 'file.read');
      resolve({ success: false, error: errorMsg });
    }
  });
};

/**
 * Safe JSON parse with validation
 */
export const parseJsonSafely = <T = unknown>(
  content: string,
  validator?: (data: any) => data is T
): {
  success: boolean;
  data?: T;
  error?: ErrorMessage;
} => {
  try {
    const data = JSON.parse(content);

    if (validator && !validator(data)) {
      return {
        success: false,
        error: {
          title: 'Invalid Data Format',
          message: 'File does not contain valid application data',
          category: 'validation',
        },
      };
    }

    logger.debug('ErrorHandling', 'JSON parse successful');
    return { success: true, data: data as T };
  } catch (error) {
    const errorMsg = getErrorMessage(error, 'json.parse');
    return { success: false, error: errorMsg };
  }
};

/**
 * Safe dynamic import with error handling
 */
export const importModuleSafely = async <T = any>(
  importFn: () => Promise<T>
): Promise<{
  success: boolean;
  module?: T;
  error?: ErrorMessage;
}> => {
  try {
    const module = await importFn();
    logger.debug('ErrorHandling', 'Module import successful');
    return { success: true, module };
  } catch (error) {
    const errorMsg = getErrorMessage(error, 'module.import');
    return { success: false, error: errorMsg };
  }
};

/**
 * Retry logic for failed operations
 */
export const retryOperation = async <T,>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<{
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}> => {
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      const result = await operation();
      logger.debug('ErrorHandling', 'Operation succeeded', { attempt });
      return { success: true, result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        logger.warn('ErrorHandling', `Operation failed, retrying... (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error('ErrorHandling', 'Operation failed after retries', {
    attempts: maxAttempts,
    error: lastError,
  });
  return { success: false, error: lastError, attempts: maxAttempts };
};
