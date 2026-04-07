/** Cross-browser fullscreen checks (Safari still uses webkit in some versions). */
export function isElementFullscreen(el: HTMLElement): boolean {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement === el || doc.webkitFullscreenElement === el;
}

export async function toggleElementFullscreen(el: HTMLElement): Promise<void> {
  if (isElementFullscreen(el)) {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    await doc.webkitExitFullscreen?.();
    return;
  }

  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  const node = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  await node.webkitRequestFullscreen?.();
}
