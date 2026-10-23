// Theme before first paint (src/drawio-shapes/theme/dark-mode.ts owns it afterwards). A classic,
// render-blocking script file instead of an inline one: the CSP allows no inline scripts.
(function () {
  var dark = false;
  try {
    var pref = localStorage.getItem('rd.theme');
    dark = pref === 'dark' || (pref !== 'light' && !!window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) { /* storage blocked: light */ }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
