import Util from './h5p-agamotto-util';

/** Class representing a Slider */
class Slider extends H5P.EventDispatcher {
  /**
   * Slider object.
   *
   * @param {Object} options - Options for the slider.
   * @param {boolean} options.snap - If true, slider will snap to fixed positions.
   * @param {boolean} options.ticks - If true, slider container will display ticks.
   * @param {boolean} options.labels - If true, slider container will display tick labels.
   * @param {Object} options.labelTexts - Tick labels.
   * @param {string} options.labelTexts.text - Tick label.
   * @param {number} options.size - Number of positions/ticks.
   * @param {string} selector - CSS class name of parent node.
   * @param {string} parent - Parent class Agamotto.
   */
  constructor(options, selector, parent) {
    super();

    Util.extend({
      snap: true,
      ticks: false,
      labels: false
    }, options);

    this.options = options;
    this.selector = selector;
    this.parent = parent;

    this.trackWidth = 0;
    this.thumbPosition = 0;
    this.ratio = 0;

    this.ticks = [];
    this.labels = [];

    this.mousedown = false;
    this.keydown = false;
    this.interactionstarted = false;

    this.track = document.createElement('div');
    this.track.classList.add('h5p-agamotto-slider-track');

    this.thumb = document.createElement('div');
    this.thumb.classList.add('h5p-agamotto-slider-thumb');
    this.thumb.setAttribute('tabindex', 0);

    this.container = document.createElement('div');
    this.container.classList.add('h5p-agamotto-slider-container');
    this.container.setAttribute('role', 'slider');
    this.container.setAttribute('aria-valuenow', 0);
    this.container.setAttribute('aria-valuemin', 0);
    this.container.setAttribute('aria-valuemax', 100);
    this.container.appendChild(this.track);
    this.container.appendChild(this.thumb);

    /*
     * We could put the next two blocks in one loop and check for ticks/labels
     * within the loop, but then we would always loop all images even without
     * ticks and labels. Would be slower (with many images).
     */
    let i = 0;
    // Place ticks
    if (this.options.ticks === true) {
      // Function used here to avoid creating it in the upcoming loop
      const placeTicks = () => {
        this.setPosition(parseInt(this.style.left) - Slider.TRACK_OFFSET, true);
      };
      for (i = 0; i <= this.options.size; i++) {
        this.ticks[i] = document.createElement('div');
        this.ticks[i].classList.add('h5p-agamotto-tick');
        this.ticks[i].addEventListener('click', placeTicks);
        this.container.appendChild(this.ticks[i]);
      }
    }

    // Place labels
    if (this.options.labels === true) {
      for (i = 0; i <= this.options.size; i++) {
        this.labels[i] = document.createElement('div');
        this.labels[i].classList.add('h5p-agamotto-tick-label');
        this.labels[i].innerHTML = this.options.labelTexts[i];
        this.container.appendChild(this.labels[i]);
      }
    }

    // Event Listeners for Mouse Interface
    document.addEventListener('mousemove', event => {
      this.setPosition(event, false);
    });
    document.addEventListener('mouseup', () => {
      this.mousedown = false;
      this.snap();
    });
    this.track.addEventListener('mousedown', event => {
      event = event || window.event;
      this.mousedown = true;
      this.sliderdown = true;
      this.setPosition(event, false);
    });
    this.thumb.addEventListener('mousedown', event => {
      event = event || window.event;
      this.mousedown = true;
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
    this.container.addEventListener('touchstart', event => {
      event = event || window.event;
      event.preventDefault();
      event.stopPropagation();
      this.setPosition(event, false);

      this.addEventListener('touchmove', event => {
        event = event || window.event;
        event.preventDefault();
        event.stopPropagation();
        this.setPosition(event, false);
      });
    });
    this.container.addEventListener('touchend', event => {
      event = event || window.event;
      event.preventDefault();
      event.stopPropagation();
      this.snap();
    });

    this.thumb.addEventListener('keydown', event => {
      // Prevent repeated pressing of a key
      if (this.keydown !== false) {
        return;
      }
      event = event || window.event;
      const key = event.which || event.keyCode;
      if (key === 37 || key === 33) {
        event.preventDefault();
        this.keydown = key;

        const previousItemId = this.getNeighbotItemIds(this.getPosition()).previous;
        this.setPosition(previousItemId * this.getWidth() / this.options.size, true);
      }
      if (key === 39 || key === 34) {
        event.preventDefault();
        this.keydown = key;

        const nextItemId = this.getNeighbotItemIds(this.getPosition()).next;
        this.setPosition(nextItemId * this.getWidth() / this.options.size, true);
      }
    });
    this.thumb.addEventListener('keyup', event => {
      // Only trigger xAPI if the interaction started by a particular key has ended
      event = event || window.event;
      const key = event.which || event.keyCode;
      if (key === this.keydown) {
        this.keydown = false;
        parent.xAPIInteracted();
        parent.xAPICompleted();
      }
    });
  }

  /**
   * Get indices of previous/next item.
   *
   * @param {number} position Position on slider.
   * @return {Object} previous and next item index
   */
  getNeighbotItemIds(position) {
    position = Util.constrain(position, 0, this.getWidth());
    const itemPosition = position / this.getWidth() * this.options.size;

    let previous = Math.floor(itemPosition);
    let next = Math.ceil(itemPosition);
    if (previous === next) {
      previous--;
      next++;
    }

    return {
      previous: Util.constrain(previous, 0, this.options.size),
      next: Util.constrain(next, 0, this.options.size)
    };
  }

  /**
   * Get the DOM elements.
   * @return {object} The DOM elements.
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
   * @param {number} value - Slider's width.
   */
  setWidth(value) {
    this.trackWidth = value;
    this.track.style.width = value + 'px';
  }

  /**
   * Get the slider's width.
   * @return {number} Slider's width.
   */
  getWidth() {
    return this.trackWidth;
  }

  /**
   * Set the position of the thumb on the slider track.
   * @param {number} position - Position on the slider track from 0 to max.
   * @param {boolean} animate - If true, slide instead of jumping.
   * @param {boolean} resize - If true, won't recompute position/width ratio.
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
      if ((this.mousedown === false) && (position.type === 'mousemove')) {
        return;
      }

      position = this.getPointerX(position) -
        Slider.TRACK_OFFSET -
        parseInt(window.getComputedStyle(this.container).marginLeft) -
        parseInt(window.getComputedStyle(document.querySelector(this.selector)).paddingLeft) -
        parseInt(window.getComputedStyle(document.querySelector(this.selector)).marginLeft);
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
    this.thumb.style.left = position + Slider.THUMB_OFFSET + 'px';
    const percentage = Math.round(position / this.getWidth() * 100);
    this.container.setAttribute('aria-valuenow', percentage);

    // Inform parent node
    this.trigger('update', {
      position: position,
      percentage: percentage
    });
  }

  /**
   * Get the current slider position.
   * @return {number} Current slider position.
   */
  getPosition() {
    return (this.thumb.style.left) ? parseInt(this.thumb.style.left) - Slider.THUMB_OFFSET : 0;
  }

  /**
   * Snap slider to closest tick position.
   */
  snap() {
    if (this.options.snap === true) {
      const snapIndex = Math.round(Util.project(this.ratio, 0, 1, 0, this.options.size));
      this.setPosition(snapIndex * this.getWidth() / this.options.size, true);
    }
    // Only trigger on mouseup that was started by mousedown over slider
    if (this.sliderdown === true) {
      // Won't pass object and context if invoked by Agamotto.prototype.xAPI...()
      // Trigger xAPI when interacted with content
      this.parent.xAPIInteracted();
      // Will check if interaction was completed before triggering
      this.parent.xAPICompleted();
      // release interaction trigger
      this.sliderdown = false;
    }
  }

  /**
   * Get the horizontal position of the pointer/finger.
   * @param {Event} e - Delivering event.
   * @return {number} Horizontal pointer/finger position.
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
    this.setWidth(parseInt(this.container.offsetWidth) - 2 * Slider.TRACK_OFFSET);
    this.setPosition(this.getWidth() * this.ratio, false, true);

    let i = 0;
    // Update ticks
    if (this.options.ticks === true) {
      for (i = 0; i < this.ticks.length; i++) {
        this.ticks[i].style.left = Slider.TRACK_OFFSET + i * this.getWidth() / (this.ticks.length - 1) + 'px';
      }
    }
    // Height to enlarge the slider container
    let maxLabelHeight = 0;
    let overlapping = false;

    // Update labels
    if (this.options.labels === true) {
      for (i = 0; i < this.labels.length; i++) {
        maxLabelHeight = Math.max(maxLabelHeight, parseInt(window.getComputedStyle(this.labels[i]).height));

        // Align the first and the last label left/right instead of centered
        switch (i) {
          case (0):
            // First label
            this.labels[i].style.left = (Slider.TRACK_OFFSET / 2) + 'px';
            break;
          case (this.labels.length - 1):
            // Last label
            this.labels[i].style.right = (Slider.TRACK_OFFSET / 2) + 'px';
            break;
          default:
            // Centered over tick mark position
            var offset = Math.ceil(parseInt(window.getComputedStyle(this.labels[i]).width)) / 2;
            this.labels[i].style.left = Slider.TRACK_OFFSET + i * this.getWidth() / (this.labels.length - 1) - offset + 'px';
        }

        // Detect overlapping labels
        if (i < this.labels.length - 1 && !overlapping) {
          overlapping = (this.areOverlapping(this.labels[i], this.labels[i + 1]));
        }
      }

      // Hide labels if some of them overlap and remove their vertical space
      if (overlapping) {
        this.labels.forEach(label => {
          label.classList.add('h5p-agamotto-hidden');
        });
        maxLabelHeight = 0;
      }
      else {
        this.labels.forEach(label => {
          label.classList.remove('h5p-agamotto-hidden');
        });
      }

      // If there are no ticks, put the labels a little closer to the track
      const buffer = (this.options.ticks === true || overlapping || maxLabelHeight === 0) ? 0 : -7;

      // Update slider height
      this.container.style.height = (this.CONTAINER_DEFAULT_HEIGHT + maxLabelHeight + buffer) + 'px';
    }
  }

  /**
   * Detect overlapping labels
   * @param {object} label1 - Label 1.
   * @param {object} label2 - Label 2.
   * @return {boolean} True if labels are overlapping.
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
