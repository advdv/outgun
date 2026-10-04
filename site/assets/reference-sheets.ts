const viewport = document.querySelector<HTMLElement>('.reference-viewport')!;
const stages = [...document.querySelectorAll<HTMLElement>('.reference-stage')];
const zoom = document.querySelector<HTMLSelectElement>('#reference-zoom')!;

function resize() {
  for (const stage of stages) {
    const sheet = stage.firstElementChild as HTMLElement;
    const scale = zoom.value === 'fit' ? Math.min(1, viewport.clientWidth / sheet.offsetWidth) : 1;
    stage.style.width = `${sheet.offsetWidth * scale}px`;
    stage.style.height = `${sheet.offsetHeight * scale}px`;
    sheet.style.transform = `scale(${scale})`;
  }
}

zoom.addEventListener('change', resize);
new ResizeObserver(resize).observe(viewport);
resize();
document.querySelector<HTMLElement>('.reference-actions')!.hidden = false;
document.querySelector<HTMLButtonElement>('#reference-print')!.addEventListener('click', async () => {
  await document.fonts.ready;
  window.print();
});

export {};
