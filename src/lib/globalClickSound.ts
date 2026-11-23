// Listen in capture so dialogs, links and controls that stop propagation all use the same effect.
const clickAudio = new Audio(import.meta.env.BASE_URL + 'assets/sounds/more-click.mp3');
clickAudio.preload = 'auto';
clickAudio.volume = 0.25;

document.addEventListener('click', (event) => {
  if (!event.isTrusted || event.button !== 0) return;

  // Playback must start in the user's click handler on browsers that block autoplay.
  clickAudio.currentTime = 0;
  void clickAudio.play().catch(() => undefined);
}, { capture: true, passive: true });
