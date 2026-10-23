import { STORAGE_KEYS } from '../../core/storage-keys';
/** sessionStorage key set while a redirect sign-in is in progress (value = provider id). Shared by all providers. */
export const PENDING_SIGNIN_KEY_NAME = STORAGE_KEYS.remotePendingSignIn;
