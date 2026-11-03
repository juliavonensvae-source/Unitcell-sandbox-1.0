/* CrystalWorkspace methods: the ⋯ menu and the controls dialog. */
import { icon } from '../icons.js';
import { openModal } from '../components/modal.js';
import { Popover } from '../components/popover.js';
import { txt } from '../../text.js';

export const moreMenuMethods = {
  createMoreMenu(anchor) {
    return new Popover({
      anchor,
      className: 'more-menu',
      placement: 'bottom-end',
      label: txt('moreOptions'),
      render: () => `<button type="button" class="mm-item" data-mm="controls">${icon('mouse')}<span>${txt('moreControls')}</span></button>
          <button type="button" class="mm-item mm-danger" data-mm="clear"${this.viewItems().length ? '' : ' disabled'}>${icon('trash')}<span>${txt('moreClear')}</span></button>`,
      onClick: {
        '[data-mm]': b => {
          if (b.dataset.mm === 'controls') this.showControls();
          else if (b.dataset.mm === 'clear') this.clearItems();
        },
      },
    });
  },

  showControls() {
    openModal({
      title: txt('controlsTitle'),
      body: `<dl class="facts controls-list">
        <div><dt>${txt('controlsRotate')}</dt><dd>${txt('controlsRotateHow')}</dd></div>
        <div><dt>${txt('controlsZoom')}</dt><dd>${txt('controlsZoomHow')}</dd></div>
        <div><dt>${txt('controlsPan')}</dt><dd>${txt('controlsPanHow')}</dd></div>
        <div><dt>${txt('controlsLook')}</dt><dd>${txt('controlsLookHow')}</dd></div>
        <div><dt>${txt('controlsRename')}</dt><dd>${txt('controlsRenameHow')}</dd></div>
        <div><dt>${txt('controlsCloseMenu')}</dt><dd>${txt('controlsCloseMenuHow')}</dd></div>
        <div><dt>${txt('controlsCloseDrawer')}</dt><dd>${txt('controlsCloseDrawerHow')}</dd></div>
      </dl>`,
    });
  },
};
