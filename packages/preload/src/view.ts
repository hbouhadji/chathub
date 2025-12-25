import {ipcRenderer} from 'electron';

function getHorizontalDelta(event: WheelEvent) {
  if (event.deltaX !== 0) {
    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    if (absY > 0 && absX < absY * 0.5) {
      return 0;
    }

    return event.deltaX;
  }

  if (event.shiftKey && event.deltaY !== 0) {
    return event.deltaY;
  }

  return 0;
}

function getScrollableAncestor(path: EventTarget[] | undefined, deltaX: number) {
  if (!path) {
    return null;
  }

  for (const target of path) {
    if (!(target instanceof Element)) {
      continue;
    }

    const style = getComputedStyle(target);
    const overflowX = style.overflowX;
    if (overflowX === 'hidden' || overflowX === 'visible') {
      continue;
    }

    if (target.scrollWidth <= target.clientWidth) {
      continue;
    }

    const max = target.scrollWidth - target.clientWidth;
    if (deltaX < 0 && target.scrollLeft > 0) {
      return target;
    }

    if (deltaX > 0 && target.scrollLeft < max - 1) {
      return target;
    }
  }

  return null;
}

window.addEventListener(
  'wheel',
  event => {
    const deltaX = getHorizontalDelta(event);
    if (!deltaX) {
      return;
    }

    const scrollable = getScrollableAncestor(event.composedPath?.(), deltaX);
    if (scrollable) {
      return;
    }

    const element = document.scrollingElement;
    if (!element) {
      ipcRenderer.send('webcontents-view:wheel', {deltaX});
      return;
    }

    const max = element.scrollWidth - element.clientWidth;
    if (max <= 0) {
      ipcRenderer.send('webcontents-view:wheel', {deltaX});
      return;
    }

    if (deltaX < 0 && element.scrollLeft <= 0) {
      ipcRenderer.send('webcontents-view:wheel', {deltaX});
      return;
    }

    if (deltaX > 0 && element.scrollLeft >= max - 1) {
      ipcRenderer.send('webcontents-view:wheel', {deltaX});
    }
  },
  {passive: true},
);
