<script lang="ts">
  let { checked, label, disabled = false, onchange }: { checked: boolean; label: string; disabled?: boolean; onchange: (on: boolean) => void } = $props();
</script>

<!-- A switch: a real checkbox (keyboard, screen reader) drawn as a track and a knob -->
<label class="toggle">
  <input type="checkbox" role="switch" {checked} {disabled} aria-label={label} onchange={(e) => onchange(e.currentTarget.checked)} />
  <span class="track" aria-hidden="true"></span>
</label>

<style>
  .toggle { position: relative; display: inline-flex; flex: none; width: 3rem; height: 1.75rem; }
  input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  input:disabled { cursor: default; }
  .track { width: 100%; height: 100%; border-radius: 1rem; background: var(--border); transition: background 0.15s ease; pointer-events: none; }
  .track::after { content: ''; position: absolute; top: 0.2rem; left: 0.2rem; width: 1.35rem; height: 1.35rem; border-radius: 50%; background: var(--bg); box-shadow: 0 1px 3px rgb(0 0 0 / 0.3); transition: transform 0.15s ease; }
  input:checked + .track { background: var(--accent); }
  input:checked + .track::after { transform: translateX(1.25rem); }
  input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
  input:disabled + .track { opacity: 0.5; }
  @media (prefers-reduced-motion: reduce) { .track, .track::after { transition: none; } }
</style>
