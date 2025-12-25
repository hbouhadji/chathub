import {ipcRenderer} from 'electron';

function getHorizontalDelta(event: WheelEvent) {
  if (event.deltaX !== 0) {
    return event.deltaX;
  }

  if (event.shiftKey && event.deltaY !== 0) {
    return event.deltaY;
  }

  return 0;
}

window.addEventListener(
  'wheel',
  event => {
    const deltaX = getHorizontalDelta(event);
    if (!deltaX) {
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
