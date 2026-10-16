declare module '*.css' {
  const content: string;
  export default content;
}

declare module '@maxgraph/core/css/*' {
  const content: string;
  export default content;
}

declare module '*.xml?raw' {
  const content: string;
  export default content;
}

/** Build-time configuration (vite.config.ts `define`; empty string when unset). */
interface ImportMetaEnv {
  readonly VITE_MSAL_CLIENT_ID?: string;
  readonly VITE_MSAL_TENANT_ID?: string;
  readonly VITE_SHAREPOINT_DEFAULT_SITE?: string;
  readonly VITE_GITLAB_URL?: string;
  readonly VITE_GITLAB_CLIENT_ID?: string;
  readonly VITE_GITLAB_DEFAULT_PROJECT?: string;
}
