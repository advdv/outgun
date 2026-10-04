const viewport = document.querySelector<HTMLElement>('.cheat-viewport')!;
const stage = document.querySelector<HTMLElement>('.cheat-stage')!;
const sheet = document.querySelector<HTMLElement>('.cheat-sheet')!;
const zoom = document.querySelector<HTMLSelectElement>('#cheat-zoom')!;

function resize() {
  const scale = zoom.value === 'fit' ? Math.min(1, viewport.clientWidth / sheet.offsetWidth) : 1;
  stage.style.width = `${sheet.offsetWidth * scale}px`;
  stage.style.height = `${sheet.offsetHeight * scale}px`;
  sheet.style.transform = `scale(${scale})`;
}

zoom.addEventListener('change', resize);
new ResizeObserver(resize).observe(viewport);
resize();
document.querySelector<HTMLElement>('.cheat-actions')!.hidden = false;
document.querySelector<HTMLButtonElement>('#cheat-print')!.addEventListener('click', async () => {
  await document.fonts.ready;
  window.print();
});
