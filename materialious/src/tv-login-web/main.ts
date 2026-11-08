import 'beercss/dist/cdn/beer.min.css';
import { mount } from 'svelte';
import App from './App.svelte';

// Phone/PC side of the TV QR login. Built into one self-contained HTML file
// (scripts/buildTvLoginWeb.mjs) that the Android Node listener serves; the
// listener injects the session state into #state.
export default mount(App, { target: document.getElementById('app')! });
