(function (Agamotto) {

  /**
   * Slider object.
   *
   * @param {Object} options - Options for the slider.
   * @param {string} selector - Class name of parent node
   */
  Agamotto.Slider = function (options, selector) {
    var that = this;

    if (options.snap === undefined) {
      options.snap = true;
    }
    if (options.ticks === undefined) {
      options.ticks = false;
    }

    this.options = options;
    this.selector = selector;

    this.mousedown = false;
    this.trackWidth = 0;
    this.thumbPosition = 0;
    this.ratio = 0;
    this.ticks = [];

    this.track = document.createElement('div');
    this.track.className = 'h5p-agamotto-slider-track';

    this.thumb = document.createElement('div');
    this.thumb.className = 'h5p-agamotto-slider-thumb';
    this.thumb.setAttribute('tabindex', 0);

    this.container = document.createElement('div');
    this.container.className = ('h5p-agamotto-slider-container');
    this.container.setAttribute('role', 'slider');
    this.container.setAttribute('aria-valuenow', 0);
    this.container.setAttribute('aria-valuemin', 0);
    this.container.setAttribute('aria-valuemax', 100);
    this.container.appendChild(this.track);
    this.container.appendChild(this.thumb);

    // Place ticks
    if (this.options.ticks === true) {
      // Function used here to avoid creating it in the upcoming loop
      var placeTicks = function() {
        that.setPosition(parseInt(this.style.left) - Agamotto.Slider.TRACK_OFFSET, true);
      };
      for (var i = 0; i <= this.options.size; i++) {
        this.ticks[i] = document.createElement('div');
        this.ticks[i].className = 'h5p-agamotto-tick';
        this.ticks[i].addEventListener('click', placeTicks);
        this.container.appendChild(this.ticks[i]);
      }
    }

    // Event Listeners for Mouse Interface
    document.addEventListener('mousemove', function(e) {
      that.setPosition(e, false);
    });
    document.addEventListener('mouseup', function() {
      that.mousedown = false;
      that.snap();
    });
    this.track.addEventListener('mousedown', function (e) {
      e = e || window.event;
      that.mousedown = true;
      that.setPosition(e, false);
    });
    this.thumb.addEventListener('mousedown', function (e) {
      e = e || window.event;
      that.mousedown = true;
      that.setPosition(e, false);
    });

    // Event Listeners for Touch Interface
    this.container.addEventListener('touchstart', function (e) {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      that.setPosition(e, false);

      this.addEventListener('touchmove', function (e) {
        e = e || window.event;
        e.preventDefault();
        e.stopPropagation();
        that.setPosition(e, false);
      });
    });
    this.container.addEventListener('touchend', function (e) {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      that.snap();
    });

    // Event Listeners for Keyboard on handle to move in percentage steps
    this.thumb.addEventListener('keydown', function (e) {
      e = e || window.event;
      var key = e.which || e.keyCode;
      // handler left
      if (key === 37) {
        that.setPosition(that.getPosition() - 0.01 * parseInt(that.getWidth()), false);
      }
      // handler right
      if (key === 39) {
        that.setPosition(that.getPosition() + 0.01 * parseInt(that.getWidth()), false);
      }
      this.addEventListener('keyup', function (e) {
        e = e || window.event;
        that.snap();
      });
    });

    // Slider Layout
    /** @constant {number} */
    Agamotto.Slider.TRACK_OFFSET = 16;
    /** @constant {number} */
    Agamotto.Slider.THUMB_OFFSET = 8;
  };

  Agamotto.Slider.prototype = {
    getDOM: function getDOM () {
      return this.container;
    },
    disable: function disable () {
      this.track.classList.add('h5p-agamotto-disabled');
      this.thumb.classList.add('h5p-agamotto-disabled');
    },
    enable: function enable () {
      this.track.classList.remove('h5p-agamotto-disabled');
      this.thumb.classList.remove('h5p-agamotto-disabled');
    },
    setWidth: function setWidth(value) {
      this.trackWidth = value;
      this.track.style.width = value + 'px';
    },
    getWidth: function getWidth() {
      return this.trackWidth;
    },
    /**
     * Will set the position of the thumb on the slider track.
     *
     * @param {number} position - Position on the slider track from 0 to max.
     * @param {boolean} animate - If true, slide instead of jumping.
     * @param {boolean} resize - If true, won't recompute position/width ratio.
     */
    setPosition: function setPosition (position, animate, resize) {
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
          Agamotto.Slider.TRACK_OFFSET -
          parseInt(window.getComputedStyle(this.container).marginLeft);
      }
      else {
        position = 0;
      }
      position = Agamotto.constrain(position, 0, this.getWidth());

      // Transition control
      if (animate === true) {
        this.thumb.classList.add('h5p-agamotto-transition');
      } else {
        this.thumb.classList.remove('h5p-agamotto-transition');
      }

      // We need to keep a fixed ratio not influenced by resizing
      if (!resize) {
        this.ratio = position / this.getWidth();
      }

      // Update DOM
      this.thumb.style.left = position + Agamotto.Slider.THUMB_OFFSET + 'px';
      this.container.setAttribute('aria-valuenow',
        Math.round(position / this.getWidth() * 100));

      // Inform parent node
      document.querySelector(this.selector).dispatchEvent(new CustomEvent('update'));
    },
    getPosition: function getPosition() {
      return (this.thumb.style.left) ? parseInt(this.thumb.style.left) - Agamotto.Slider.THUMB_OFFSET : 0;
    },
    snap: function snap () {
      if (this.options.snap === true) {
        var snapIndex = Math.round(Agamotto.map(this.ratio, 0, 1, 0, this.options.size));
        this.setPosition(snapIndex * this.getWidth() / this.options.size, true);
      }
    },
    getPointerX: function getPointerX (e) {
      var pointerX = 0;
      if (e.touches) {
        pointerX = e.touches[0].pageX;
      } else {
        pointerX = e.clientX;
      }
      return pointerX;
    },
    resize: function resize() {
      this.setWidth(parseInt(this.container.offsetWidth) - 2 * Agamotto.Slider.TRACK_OFFSET);
      this.setPosition(this.getWidth() * this.ratio, false, true);

      // Update ticks
      if (this.options.ticks === true) {
        for (var i = 0; i < this.ticks.length; i++) {
          this.ticks[i].style.left = Agamotto.Slider.TRACK_OFFSET + i * this.getWidth() / (this.ticks.length - 1) + 'px';
        }
      }
    },
    setMargin: function setMargin (margin) {
      this.container.style.margin = margin;
    }
  };

  // Polyfill for "the one" browser that has hiccups ...
  (function () {
    if ( typeof window.CustomEvent === "function" ) return false;

    function CustomEvent (event, params) {
      params = params || {bubbles: false, cancelable: false, detail: undefined};
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
      return evt;
     }
    CustomEvent.prototype = window.Event.prototype;
    window.CustomEvent = CustomEvent;
  })();  

})(H5P.Agamotto);
