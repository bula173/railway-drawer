/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 *
 * Railway Drawer: replaces js/PreConfig.js of the self-hosted draw.io (scripts/drawio-selfhost).
 * Runs before app.min.js (bootstrap.js loads it first on every host that is not *.diagrams.net /
 * *.draw.io), so the urlParams below are enforced whatever the iframe URL says.
 */
(function () {
  // Folder of this draw.io copy without a trailing slash, e.g. http://host/railway-drawer/drawio
  var base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');

  window.DRAWIO_PUBLIC_BUILD = true;
  window.EXPORT_URL = null; // no export server: PDF export uses the print dialog
  window.DRAWIO_BASE_URL = base;
  window.DRAWIO_VIEWER_URL = base + '/js/viewer-static.min.js';
  window.DRAWIO_LIGHTBOX_URL = base;
  window.DRAW_MATH_URL = 'math4/es5';
  window.DRAWIO_CONFIG = null; // the host sends its configuration (configure=1)

  // Offline / no external services: no Google Drive, OneDrive, Dropbox, GitHub, GitLab, Trello,
  // no plugins, no logging/analytics, no realtime cache, no service worker.
  urlParams['sync'] = 'manual';
  urlParams['offline'] = '1';
  urlParams['stealth'] = '1';
  urlParams['lockdown'] = '1';
  urlParams['pwa'] = '0';
  urlParams['plugins'] = '0';
  urlParams['gapi'] = '0';
  urlParams['picker'] = '0';
  urlParams['db'] = '0';
  urlParams['od'] = '0';
  urlParams['gh'] = '0';
  urlParams['gl'] = '0';
  urlParams['tr'] = '0';
  urlParams['ms365'] = '0';
})();
