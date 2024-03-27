import Util from '@services/h5p-agamotto-util';

/** Class representing a Slider */
class Slider extends H5P.EventDispatcher {
  /**
   * Slider object.
   * @param {object} params Options for the slider.
   * @param {boolean} [params.snap] If true, slider will snap to fixed positions.
   * @param {boolean} [params.ticks] If true, slider container will display ticks.
   * @param {boolean} [params.labels] If true, slider container will display tick labels.
   * @param {number} [params.startRatio] Set the start ratio.
   * @param {object[]} params.labelTexts Tick labels.
   * @param {string} params.labelTexts.text Tick label.
   * @param {number} params.size Number of positions/ticks.
   * @param {string} params.selector CSS class name of parent node.
   * @param {object} params.parent Parent class Agamotto.
   * @param {object} callbacks Callbacks.
   * @param {function} [callbacks.onButtonFullscreenClicked] Fullscreen button clicked.
   */
  constructor(params, callbacks = {}) {
    super();

    this.params = Util.extend({
      snap: true,
      ticks: false,
      labels: false,
      startRatio: 0
    }, params);

    this.callbacks = callbacks;
    this.callbacks.onButtonFullscreenClicked = callbacks.onButtonFullscreenClicked || (() => {});

    this.selector = params.selector;
    this.parent = params.parent;

    this.trackWidth = 0;
    this.audioButtonOffset = 0;
    this.thumbPosition = 0;
    this.ratio = params.startRatio;

    this.ticks = [];
    this.labels = [];

    this.sliderdown = false;
    this.keydown = false;
    this.interactionstarted = false;
    this.extraInitResizes = 1;

    this.container = document.createElement('div');
    this.container.classList.add('h5p-agamotto-slider-container');

    if (this.params.audio) {
      this.muted = false;
      this.audioButton = document.createElement('button');
      this.audioButton.classList.add('h5p-agamotto-slider-button');
      this.audioButton.classList.add('h5p-agamotto-slider-audio-unmuted');
      this.audioButton.setAttribute('tabindex', 0);
      this.audioButton.setAttribute('aria-label', this.params.a11y.mute);
      this.audioButtonOffset = 28; // Magic number, extra offset for audio button
      this.audioButton.addEventListener('click', (event) => {
        this.handleClickAudioButton(event);
      });
      this.audioButton.addEventListener('touchstart', (event) => {
        this.handleClickAudioButton(event);
      });
      this.container.appendChild(this.audioButton);
    }

    this.track = document.createElement('div');
    this.track.classList.add('h5p-agamotto-slider-track');
    this.container.appendChild(this.track);

    this.thumb = document.createElement('div');
    this.thumb.classList.add('h5p-agamotto-slider-thumb');
    this.thumb.setAttribute('tabindex', 0);
    this.thumb.setAttribute('role', 'slider');
    this.thumb.setAttribute('aria-label', this.params.a11y.imageSlider);
    this.container.appendChild(this.thumb);

    this.fullscreenButton = document.createElement('button');
    this.fullscreenButton.classList.add('h5p-agamotto-slider-button');
    this.fullscreenButton.classList.add('h5p-agamotto-slider-fullscreen');
    this.fullscreenButton.classList.add('h5p-agamotto-slider-fullscreen-enter');
    this.fullscreenButton.setAttribute('aria-label', this.params.a11y.buttonFullscreenEnter);
    this.fullscreenButton.classList.add('h5p-agamotto-button-none');
    this.fullscreenButton.setAttribute('tabindex', 0);
    this.fullscreenButton.addEventListener('click', (event) => {
      this.handleClickFullscreenButton(event);
    });
    this.fullscreenButton.addEventListener('touchstart', (event) => {
      this.handleClickFullscreenButton(event);
    });
    this.container.appendChild(this.fullscreenButton);

    /*
     * We could put the next two blocks in one loop and check for ticks/labels
     * within the loop, but then we would always loop all images even without
     * ticks and labels. Would be slower (with many images).
     */
    let i = 0;
    // Place ticks
    if (this.params.ticks === true) {
      // Function used here to avoid creating it in the upcoming loop
      const placeTicks = (event) => {
        this.setPosition(parseInt(event.target.style.left) - Slider.TRACK_OFFSET - this.audioButtonOffset, true);
      };
      for (i = 0; i <= this.params.size; i++) {
        this.ticks[i] = document.createElement('div');
        this.ticks[i].classList.add('h5p-agamotto-tick');
        this.ticks[i].addEventListener('click', placeTicks);
        this.container.appendChild(this.ticks[i]);
      }
    }

    // Place labels
    if (this.params.labels === true) {
      for (i = 0; i <= this.params.size; i++) {
        this.labels[i] = document.createElement('div');
        this.labels[i].classList.add('h5p-agamotto-tick-label');
        this.labels[i].setAttribute('aria-hidden', 'true');
        this.labels[i].innerHTML = this.params.labelTexts[i];
        this.container.appendChild(this.labels[i]);
      }
    }

    // Event Listeners for Mouse Interface
    document.addEventListener('mousemove', (event) => {
      if (this.sliderdown) {
        this.setPosition(event, false);
      }
    });
    document.addEventListener('mouseup', () => {
      if (this.sliderdown) {
        this.sliderdown = false;
        this.snap();
      }
    });
    this.track.addEventListener('mousedown', (event) => {
      event = event || window.event;
      this.sliderdown = true;
      this.setPosition(event, false);
    });
    this.thumb.addEventListener('mousedown', (event) => {
      event = event || window.event;
      this.sliderdown = true;
      this.setPosition(event, false);
    });

    /*
     * Event Listeners for Touch Interface
     * Using preventDefault here causes Chrome to throw a "violation". Blocking
     * the default behavior for touch is said to cause performance issues.
     * However, if you don't use preventDefault, people will also slide the
     * screen when using the slider which would be weird.
     */
    this.container.addEventListener('touchstart', (event) => {
      if (event.target === this.fullscreenButton || event.target === this.audioButton) {
        return;
      }

      event = event || window.event;
      event.preventDefault();
      event.stopPropagation();
      this.setPosition(event, false);
    });

    this.container.addEventListener('touchmove', (event) => {
      if (event.target === this.fullscreenButton || event.target === this.audioButton) {
        return;
      }

      event = event || window.event;
      event.preventDefault();
      event.stopPropagation();
      this.setPosition(event, false);
    });

    this.container.addEventListener('touchend', (event) => {
      if (event.target === this.fullscreenButton || event.target === this.audioButton) {
        return;
      }

      event = event || window.event;
      event.preventDefault();
      event.stopPropagation();
      this.snap();
    });

    this.thumb.addEventListener('keydown', (event) => {
      // Prevent repeated pressing of a key
      if (this.keydown !== false) {
        return;
      }
      event = event || window.event;
      const key = event.which || event.keyCode;
      switch (key) {
        case 35: // end
          this.handleKeyMove(event, this.params.size);
          break;

        case 36: // home
          this.handleKeyMove(event, 0);
          break;

        case 37: // left
        case 38: // up
          this.handleKeyMove(event, this.getCurrentItemId(true) - 1);
          break;

        case 39: // right
        case 40: // down
          this.handleKeyMove(event, this.getCurrentItemId(true) + 1);
          break;
      }
    });
    this.thumb.addEventListener('keyup', (event) => {
      // Only trigger xAPI if the interaction started by a particular key has ended
      event = event || window.event;
      const key = event.which || event.keyCode;
      if (key === this.keydown) {
        this.keydown = false;
        this.parent.xAPIInteracted();
        this.parent.xAPICompleted();
      }
    });
  }

  /**
   * Detect whether audio is muted.
   * @returns {boolean} True, if muted.
   */
  isMuted() {
    return this.muted;
  }

  /**
   * Handle click/tap on fullscreen button.
   * @param {Event} event Click/Touchstart event.
   * @returns {boolean} False.
   */
  handleClickFullscreenButton(event) {
    event.preventDefault();
    this.callbacks.onButtonFullscreenClicked();
    return false;
  }

  /**
   * Enable fullscreen button.
   */
  enableFullscreenButton() {
    this.fullscreenButton.classList.remove('h5p-agamotto-button-none');
  }

  /**
   * Remove fullscreen button.
   */
  removeFullscreenButton() {
    this.container.removeChild(this.fullscreenButton);
    this.resize();
  }

  /**
   * Set fullscreen title.
   * @param {boolean} state If true, fullscreen entered, else exited.
   */
  setFullScreenButtonTitle(state) {
    if (!this.fullscreenButton) {
      return;
    }

    if (state) {
      this.fullscreenButton.setAttribute('aria-label', this.params.a11y.buttonFullscreenExit);
    }
    else {
      this.fullscreenButton.setAttribute('aria-label', this.params.a11y.buttonFullscreenEnter);
    }
  }

  /**
   * Handle click/tap on audio button.
   * @param {Event} event Click/Touchstart event.
   * @returns {boolean} False.
   */
  handleClickAudioButton(event) {
    event.preventDefault();
    this.toggleAudioButton();
    return false;
  }

  /**
   * Toggle audio button.
   * @param {boolean} [muted] Override for audio button.
   */
  toggleAudioButton(muted) {
    if (!this.audioButton) {
      return;
    }

    if (typeof muted === 'boolean') {
      this.muted = !muted;
    }

    if (this.isMuted()) {
      this.audioButton.classList.remove('h5p-agamotto-slider-audio-muted');
      this.audioButton.classList.add('h5p-agamotto-slider-audio-unmuted');
      this.audioButton.setAttribute('aria-label', this.params.a11y.mute);
      this.trigger('unmuted');
      this.muted = false;
    }
    else {
      this.muted = true;
      this.trigger('muted');
      this.audioButton.classList.remove('h5p-agamotto-slider-audio-unmuted');
      this.audioButton.classList.add('h5p-agamotto-slider-audio-muted');
      this.audioButton.setAttribute('aria-label', this.params.a11y.unmute);
    }
  }

  /**
   * Handle sliding with keys.
   * @param {Event} event Key event.
   * @param {number} nextItemId Id of item to slide to.
   */
  handleKeyMove(event, nextItemId) {
    event.preventDefault();
    this.keydown = event.which || event.keyCode;
    nextItemId = Util.constrain(nextItemId, 0, this.params.size);

    this.setPosition(Util.project(nextItemId, 0, this.params.size, 0, this.getWidth()), true);
  }

  handleTouchMove(event) {
    event = event || window.event;
    event.preventDefault();
    event.stopPropagation();
    this.setPosition(event, false);
  }

  /**
   * Get id of current item pointed at by slider.
   * @param {boolean} [rounded] If true, position will be rounded.
   * @returns {number} Id of item pointed at. Can be a float.
   */
  getCurrentItemId(rounded = true) {
    let itemPosition = this.getPosition() / this.getWidth() * this.params.size;
    if (rounded) {
      itemPosition = Util.constrain(0, Math.round(itemPosition), this.params.size);
    }
    return itemPosition;
  }

  /**
   * Get the DOM elements.
   * @returns {HTMLElement} The DOM elements.
   */
  getDOM() {
    return this.container;
  }

  /**
   * Disable the slider
   */
  disable() {
    this.track.classList.add('h5p-agamotto-disabled');
    this.thumb.classList.add('h5p-agamotto-disabled');
  }

  /**
   * Enable the slider.
   */
  enable() {
    this.track.classList.remove('h5p-agamotto-disabled');
    this.thumb.classList.remove('h5p-agamotto-disabled');
  }

  /**
   * Set the slider's width.
   * @param {number} value Slider's width.
   */
  setWidth(value) {
    if (this.params.audio) {
      this.track.style.left = `${Slider.TRACK_OFFSET + this.audioButtonOffset}px`;
    }

    const fullscreenButtonOffset = this.fullscreenButton.offsetWidth + 4;

    this.trackWidth = value - this.audioButtonOffset - fullscreenButtonOffset;
    this.track.style.width = `${value - this.audioButtonOffset - fullscreenButtonOffset}px`;
  }

  /**
   * Get the slider's width.
   * @returns {number} Slider's width.
   */
  getWidth() {
    return this.trackWidth;
  }

  /**
   * Set the position of the thumb on the slider track.
   * @param {number} position Position on the slider track from 0 to max.
   * @param {boolean} animate If true, slide instead of jumping.
   * @param {boolean} resize If true, won't recompute position/width ratio.
   */
  setPosition(position, animate, resize) {
    if (this.thumb.classList.contains('h5p-agamotto-disabled')) {
      return;
    }

    // Compute position from string (e.g. 1px), from number (e.g. 1), or from event
    if ((typeof position === 'string') || (typeof position === 'number')) {
      position = parseInt(position);
    }
    else if (typeof position === 'object') {
      position = this.getPointerX(position) - this.computeTrackOffset() - this.audioButtonOffset;
    }
    else {
      position = 0;
    }
    position = Util.constrain(position, 0, this.getWidth());

    // Transition control
    if (animate === true) {
      this.thumb.classList.add('h5p-agamotto-transition');
    }
    else {
      this.thumb.classList.remove('h5p-agamotto-transition');
    }

    // We need to keep a fixed ratio not influenced by resizing
    if (!resize) {
      this.ratio = position / this.getWidth();
    }

    // Update DOM
    this.thumb.style.left = position + Slider.THUMB_OFFSET + this.audioButtonOffset + 'px';
    const percentage = Math.round(position / this.getWidth() * 100);
    const currentItemId = (this.getCurrentItemId() || 0);

    this.thumb.setAttribute(
      'aria-valuetext',
      this.params.labels ?
        this.labels[currentItemId].innerHTML :
        this.params.altTitleTexts[currentItemId] || `${this.params.a11y.image} ${currentItemId + 1}`
    );

    // Inform parent node
    this.trigger('update', {
      position: position,
      percentage: percentage
    });
  }

  /**
   * Get the current slider position.
   * @returns {number} Current slider position.
   */
  getPosition() {
    return (this.thumb.style.left) ? parseInt(this.thumb.style.left) - Slider.THUMB_OFFSET : 0;
  }

  /**
   * Get current slider down state.
   * @returns {boolean} True, if slider is in usw.
   */
  isUsed() {
    return this.sliderdown;
  }

  /**
   * Focus slider.
   * @param {object} [options] regular element.focus options.
   */
  focus(options = {}) {
    this.thumb.focus(options);
  }

  /**
   * Snap slider to closest tick position.
   */
  snap() {
    if (this.params.snap === true) {
      const snapIndex = Math.round(Util.project(this.ratio, 0, 1, 0, this.params.size));
      this.setPosition(snapIndex * this.getWidth() / this.params.size, true);
    }

    // Won't pass object and context if invoked by Agamotto.prototype.xAPI...()
    // Trigger xAPI when interacted with content
    this.parent.xAPIInteracted();
    // Will check if interaction was completed before triggering
    this.parent.xAPICompleted();
  }

  /**
   * Get the horizontal position of the pointer/finger.
   * @param {Event} e Delivering event.
   * @returns {number} Horizontal pointer/finger position.
   */
  getPointerX(e) {
    let pointerX = 0;
    if (e.touches) {
      pointerX = e.touches[0].pageX;
    }
    else {
      pointerX = e.clientX;
    }
    return pointerX;
  }

  /**
   * Resize the slider.
   */
  resize() {
    if (this.getWidth() === parseInt(this.container.offsetWidth) - 2 * Slider.TRACK_OFFSET && this.extraInitResizes < 0) {
      return; // Skip, already correct width
    }

    this.extraInitResizes--;

    this.setWidth(parseInt(this.container.offsetWidth) - 2 * Slider.TRACK_OFFSET);
    this.setPosition(this.getWidth() * this.ratio, false, true);

    let i = 0;
    // Update ticks
    if (this.params.ticks === true) {
      for (i = 0; i < this.ticks.length; i++) {
        this.ticks[i].style.left = Slider.TRACK_OFFSET + this.audioButtonOffset + i * this.getWidth() / (this.ticks.length - 1) + 'px';
      }
    }
    // Height to enlarge the slider container
    let maxLabelHeight = 0;
    let overlapping = false;

    // Update labels
    if (this.params.labels === true) {
      for (i = 0; i < this.labels.length; i++) {
        maxLabelHeight = Math.max(maxLabelHeight, parseInt(window.getComputedStyle(this.labels[i]).height));

        // Align the first and the last label left/right instead of centered
        switch (i) {
          case (0):
            // First label
            this.labels[i].style.left = (Slider.TRACK_OFFSET / 2) + this.audioButtonOffset + 'px';
            break;
          case (this.labels.length - 1):
            // Last label
            this.labels[i].style.right = (Slider.TRACK_OFFSET / 2) + this.fullscreenButton.offsetWidth + 4 + 'px';
            break;
          default:
            // Centered over tick mark position
            var offset = Math.ceil(parseInt(window.getComputedStyle(this.labels[i]).width)) / 2;
            this.labels[i].style.left = Slider.TRACK_OFFSET + i * this.getWidth() / (this.labels.length - 1) - offset + this.audioButtonOffset + 'px';
        }

        // Detect overlapping labels
        if (i < this.labels.length - 1 && !overlapping) {
          overlapping = (this.areOverlapping(this.labels[i], this.labels[i + 1]));
        }
      }

      // Hide labels if some of them overlap and remove their vertical space
      if (overlapping) {
        this.labels.forEach((label) => {
          label.classList.add('h5p-agamotto-hidden');
        });
        maxLabelHeight = 0;
      }
      else {
        this.labels.forEach((label) => {
          label.classList.remove('h5p-agamotto-hidden');
        });
      }

      // If there are no ticks, put the labels a little closer to the track
      const buffer = (this.params.ticks === true || overlapping || maxLabelHeight === 0) ? 0 : -7;

      // Update slider height
      this.container.style.height = (Slider.CONTAINER_DEFAULT_HEIGHT + maxLabelHeight + buffer) + 'px';
    }
  }

  /**
   * Compute offset for setting slider track zero position.
   * @returns {number} Track offset.
   */
  computeTrackOffset() {
    const questionContainer = Util.findClosest(this.container, 'h5p-question-content');
    if (questionContainer) {
      const style = window.getComputedStyle(questionContainer);

      const sliderOffset = (this.container.offsetLeft === Slider.TRACK_OFFSET) ?
        Slider.TRACK_OFFSET :
        Slider.TRACK_OFFSET + this.container.offsetLeft;

      return questionContainer.getBoundingClientRect().left +
        parseInt(style.paddingLeft) +
        sliderOffset;
    }
    else { // Fallback
      return this.container.offsetLeft + Slider.TRACK_OFFSET;
    }
  }

  /**
   * Detect overlapping labels
   * @param {HTMLElement} label1 Label 1.
   * @param {HTMLElement} label2 Label 2.
   * @returns {boolean} True if labels are overlapping.
   */
  areOverlapping(label1, label2) {
    const rect1 = label1.getBoundingClientRect();
    const rect2 = label2.getBoundingClientRect();
    return !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
  }
}

// Slider Layout
/** @constant {number} */
Slider.CONTAINER_DEFAULT_HEIGHT = 36;
/** @constant {number} */
Slider.TRACK_OFFSET = 16;
/** @constant {number} */
Slider.THUMB_OFFSET = 8;

export default Slider;
