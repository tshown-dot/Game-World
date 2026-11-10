/**
 * Realm of Numeria - Universal Cartridge Harness
 * 
 * Embeds cartridges inside an isolated iframe viewport with a unified top-bar HUD,
 * handles postMessage communication, and manages session completion & exit.
 */

import { hubAudio } from '../../../shared/audio.js';

export class CartridgeHarness {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('cartridgeHarnessModal');
    this.iframe = options.iframe || document.getElementById('cartridgeIframe');
    this.titleEl = options.titleEl || document.getElementById('harnessQuestTitle');
    this.lessonBadgeEl = options.lessonBadgeEl || document.getElementById('harnessLessonBadge');
    this.retreatBtn = options.retreatBtn || document.getElementById('harnessRetreatBtn');
    
    this.currentNode = null;
    this.onCompleteCallback = options.onComplete || (() => {});
    this.onExitCallback = options.onExit || (() => {});

    this.initListeners();
  }

  initListeners() {
    if (this.retreatBtn) {
      this.retreatBtn.addEventListener('click', () => {
        hubAudio.playSelect();
        this.close();
        this.onExitCallback();
      });
    }

    // Bidirectional postMessage listener
    window.addEventListener('message', (event) => {
      this.handleMessage(event);
    });
  }

  handleMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // Support both direct format and nested payload
    const type = data.type;
    const payload = data.payload || data;

    switch (type) {
      case 'CARTRIDGE_READY':
        // Cartridge handshake: send sound settings
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage({
            type: 'HUB_INIT',
            payload: {
              isMuted: hubAudio.isMuted,
            }
          }, '*');
        }
        break;

      case 'CARTRIDGE_COMPLETE':
        console.log('[Harness] Received CARTRIDGE_COMPLETE:', payload);
        if (this.currentNode) {
          this.onCompleteCallback(this.currentNode, payload);
        }
        break;

      case 'CARTRIDGE_EXIT_REQUEST':
        this.close();
        this.onExitCallback();
        break;

      default:
        break;
    }
  }

  launch(node) {
    if (!node || !node.cartridgeUrl) return;
    this.currentNode = node;

    if (this.titleEl) {
      this.titleEl.textContent = `${node.title}: ${node.subtitle}`;
    }
    if (this.lessonBadgeEl) {
      this.lessonBadgeEl.textContent = `Lesson ${node.lessonCode}`;
    }

    hubAudio.playCartridgeLaunch();

    // Show container and point iframe to cartridge with cache-buster
    if (this.container) {
      this.container.classList.remove('hidden');
    }
    if (this.iframe) {
      // Append timestamp query parameter to bypass browser caching of cartridge scripts
      const separator = node.cartridgeUrl.includes('?') ? '&' : '?';
      this.iframe.src = `${node.cartridgeUrl}${separator}_v=${Date.now()}`;
      this.iframe.focus();
    }
  }

  close() {
    if (this.iframe) {
      this.iframe.src = 'about:blank';
    }
    if (this.container) {
      this.container.classList.add('hidden');
    }
    this.currentNode = null;
  }
}
