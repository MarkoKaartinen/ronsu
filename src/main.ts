import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/figtree/wght.css';
import './fonts.css';
import './app.css';
import Root from './components/Root.svelte';

// A new version is downloaded and the page updates automatically (otherwise the service worker would keep serving the old one)
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => reg.update(), 30 * 60 * 1000);
  },
});

const app = mount(Root, { target: document.getElementById('app')! });

// The app started, so the start-up guard (static/boot-guard.js) is no longer needed
document.getElementById('boot-guard')?.remove();

export default app;
