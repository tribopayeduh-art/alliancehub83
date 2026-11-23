// Keep optional audio out of app initialization, and play only from a real click.
let clickAudio: HTMLAudioElement | undefined;

document.addEventListener('click', (event) => {
  if (!event.isTrusted || event.button !== 0) return;

  try {
    if (!clickAudio) {
      clickAudio = new Audio(import.meta.env.BASE_URL + 'assets/sounds/more-click.mp3');
      clickAudio.volume = 0.25;
    }
    clickAudio.currentTime = 0;
    void clickAudio.play().catch(() => undefined);
  } catch {
    // Audio restrictions must not interfere with navigation.
  }
}, { capture: true, passive: true });
