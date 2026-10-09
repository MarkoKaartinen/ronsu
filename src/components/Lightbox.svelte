<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import X from '@lucide/svelte/icons/x';
  import { tick } from 'svelte';
  import { t } from '../lib/stores/i18n.svelte';
  import { lightbox } from '../lib/stores/lightbox.svelte';

  let dialog: HTMLDialogElement | undefined = $state();
  let track: HTMLElement | undefined = $state();
  let current = $state(0);
  let zoomed = $state(false);
  let raf = 0;
  // The picture the last button / key press scrolled towards. `current` is rounded from the scroll position
  // and lags behind a smooth scroll, so stepping from it would skip a picture when pressed again mid-animation
  let target = 0;
  let stepping = false;

  const items = $derived(lightbox.items);
  const caption = $derived(items[current]?.description ?? '');

  // Open and close the native <dialog>: it takes care of focus, inertness of the page and the Esc key
  $effect(() => {
    if (!dialog) return;
    if (lightbox.open && !dialog.open) {
      zoomed = false;
      current = target = lightbox.index;
      dialog.showModal();
      tick().then(() => track?.scrollTo({ left: lightbox.index * track.clientWidth, behavior: 'instant' }));
    } else if (!lightbox.open && dialog.open) {
      dialog.close();
    }
  });

  /** The swipe is the browser's own scroll-snap; this only keeps `current` in step with it. */
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!track || !track.clientWidth) return;
      current = Math.round(track.scrollLeft / track.clientWidth);
      if (Math.abs(track.scrollLeft - current * track.clientWidth) >= 1) return; // still moving
      // The browser stops a scroll at every picture, so a press made mid-scroll only got one step: carry on
      // towards the target. A swipe by hand moves the track without go(): follow it instead
      if (stepping && current !== target) track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
      else target = current, stepping = false;
    });
  }

  function go(delta: number) {
    if (!track || zoomed) return;
    stepping = true;
    target = Math.min(Math.max(target + delta, 0), items.length - 1);
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  }

  async function toggleZoom() {
    zoomed = !zoomed;
    await tick();
    const slide = track?.children[current] as HTMLElement | undefined;
    if (!slide) return;
    // Zoom in on the middle of the picture
    slide.scrollLeft = zoomed ? (slide.scrollWidth - slide.clientWidth) / 2 : 0;
    slide.scrollTop = zoomed ? (slide.scrollHeight - slide.clientHeight) / 2 : 0;
  }

  // Listened on the window: when a button disappears (e.g. "Next" on the last picture) the focus falls out of
  // the dialog, and the arrow keys must keep working
  function onKeydown(e: KeyboardEvent) {
    if (!lightbox.open) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    // The browser would also scroll the track by itself with the arrow keys (Firefox does), a second step on top of ours
    e.preventDefault();
    go(e.key === 'ArrowLeft' ? -1 : 1);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<dialog
  bind:this={dialog}
  class="lightbox"
  class:zoomed
  aria-label={t('lightbox.counter', { current: current + 1, total: items.length })}
  oncancel={(e) => {
    e.preventDefault();
    lightbox.close();
  }}
  onclose={() => lightbox.open && lightbox.close()}
>
  {#if lightbox.open}
    <div class="track" bind:this={track} onscroll={onScroll}>
      {#each items as m, i (m.id)}
        <!-- A tap on the dark area around the picture closes the viewer; Esc and the close button do the same -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="slide" class:zoomed={zoomed && i === current} onclick={(e) => e.target === e.currentTarget && lightbox.close()}>
          <span class="wait">{t('common.loading')}</span>
          <!-- Only the current picture is interactive; the others are just waiting off screen -->
          <button class="picture" inert={i !== current} aria-hidden={i !== current} onclick={toggleZoom} title={zoomed ? t('lightbox.zoomOut') : t('lightbox.zoomIn')} aria-label={zoomed ? t('lightbox.zoomOut') : t('lightbox.zoomIn')}>
            <img src={m.url} alt={m.description ?? ''} draggable="false" loading={i === lightbox.index ? 'eager' : 'lazy'} />
          </button>
        </div>
      {/each}
    </div>

    <header>
      <span class="count" aria-hidden="true">{items.length > 1 ? t('lightbox.counter', { current: current + 1, total: items.length }) : ''}</span>
      <button class="round" onclick={() => lightbox.close()} aria-label={t('common.close')} title={t('common.close')}><X size={22} aria-hidden="true" /></button>
    </header>

    {#if items.length > 1 && !zoomed}
      {#if current > 0}
        <button class="round nav prev" onclick={() => go(-1)} aria-label={t('lightbox.previous')} title={t('lightbox.previous')}><ChevronLeft size={24} aria-hidden="true" /></button>
      {/if}
      {#if current < items.length - 1}
        <button class="round nav next" onclick={() => go(1)} aria-label={t('lightbox.next')} title={t('lightbox.next')}><ChevronRight size={24} aria-hidden="true" /></button>
      {/if}
    {/if}

    {#if caption && !zoomed}
      <p class="caption">{caption}</p>
    {/if}
  {/if}
</dialog>

<style>
  /* The viewer is always dark, whatever the theme: pictures are easiest to look at on black */
  .lightbox { width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: 0; border: 0; overflow: hidden; background: rgb(0 0 0 / 0.96); color: #fff; color-scheme: dark; }
  .track { position: absolute; inset: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior: contain; }
  .track::-webkit-scrollbar { display: none; }
  /* While zoomed the picture is panned inside its slide, so the swipe between slides is switched off */
  .lightbox.zoomed .track { overflow-x: hidden; scroll-snap-type: none; }
  .slide { position: relative; flex: 0 0 100%; height: 100%; display: flex; overflow: auto; scroll-snap-align: center; scroll-snap-stop: always; scrollbar-width: none; }
  .slide.zoomed { scrollbar-width: thin; }
  .wait { position: absolute; inset: 0; display: grid; place-items: center; color: rgb(255 255 255 / 0.5); pointer-events: none; }
  .picture { position: relative; margin: auto; padding: 0; border: 0; background: none; cursor: zoom-in; display: block; }
  .slide.zoomed .picture { cursor: zoom-out; }
  img { display: block; max-width: 100vw; max-height: 100dvh; object-fit: contain; user-select: none; -webkit-user-drag: none; }
  .slide.zoomed img { max-width: none; max-height: none; }

  header { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: max(0.6rem, env(safe-area-inset-top)) 0.8rem 0.6rem; pointer-events: none; }
  .count { padding: 0.3rem 0.7rem; border-radius: 999px; background: rgb(0 0 0 / 0.5); font-size: 0.9rem; font-weight: 600; }
  .count:empty { display: none; }
  header .round { margin-left: auto; }
  .round { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border: 0; border-radius: 50%; background: rgb(0 0 0 / 0.5); color: #fff; pointer-events: auto; cursor: pointer; }
  .round:hover { background: rgb(0 0 0 / 0.75); }
  .nav { position: absolute; top: 50%; transform: translateY(-50%); }
  .prev { left: 0.8rem; }
  .next { right: 0.8rem; }
  .caption { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 2.5rem 1rem calc(1rem + env(safe-area-inset-bottom)); max-height: 40dvh; overflow-y: auto; background: linear-gradient(transparent, rgb(0 0 0 / 0.75)); text-align: center; font-size: 0.95rem; line-height: 1.45; overflow-wrap: anywhere; pointer-events: none; }
</style>
