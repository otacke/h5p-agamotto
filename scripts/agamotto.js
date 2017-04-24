"use strict";

var H5P = H5P || {};

H5P.Agamotto = function ($) {
  /**
   * Constructor function.
   *
   * @param {object} options - Options from semantics.json.
   * @param {number} content - Id.
   */
  function C(options, id) {
    if (!options.items) {
      return;
    }

    this.options = options;
    this.options.items = sanitizeItems(this.options.items);

    this.maxItem = this.options.items.length - 1;
    this.selector = '.h5p-agamotto';

    // Set hasDescription = true if at least one item has a description
    this.hasDescription = false;
    for (var i = 0; i < this.maxItem + 1; i++) {
      if (this.options.items[i].description !== '') {
        this.hasDescription = true;
        break;
      }
    }
    this.id = id;

    /**
     * Update images and descriptions.
     *
     * @param {Number} index - Index of top image.
     * @param {Number} opacity - Opacity of top image.
     */
    this.updateContent = function (index, opacity) {
      // Update images
      this.images.setImage(index, opacity);

      // Update descriptions
      if (this.hasDescription) {
        this.descriptions.setText(index, opacity);
      }
    };

    // Initialize event inheritance
    H5P.EventDispatcher.call(this);
  }

  // Extends the event dispatcher
  C.prototype = Object.create(H5P.EventDispatcher.prototype);
  C.prototype.constructor = C;

  /**
   * Images object
   *
   * @param {Object} images - Array containing the images.
   * @param {number} id - ID of this H5P content.
   * @param {string} selector - Class name of parent node.
   */
  var Images = function (paths, id, selector) {
    this.paths = paths;
    this.id = id;
    this.selector = selector;

    this.images = [];
    this.imagesLoaded = 0;

    this.imageTop = document.createElement('img');
    this.imageTop.className = 'h5p-agamotto-image-top';
    this.imageTop.src = '#';
    this.imageTop.setAttribute('draggable', 'false');
    this.imageTop.setAttribute('tabindex', 0);

    this.imageBottom = document.createElement('img');
    this.imageBottom.className = 'h5p-agamotto-image-bottom';
    this.imageBottom.src = '#';
    this.imageBottom.setAttribute('draggable', 'false');

    this.container = document.createElement('div');
    this.container.className = 'h5p-agamotto-images-container';
    this.container.appendChild(this.imageTop);
    this.container.appendChild(this.imageBottom);
  };

  Images.prototype = {
    getDOM: function getDOM () {
      return this.container;
    },
    setImage: function setImage (index, opacity) {
      this.imageTop.src = this.images[index].src;
      this.imageBottom.src = this.images[constrain(index + 1, 0, this.images.length - 1)].src;
      this.imageTop.style.opacity = opacity;
    },
    resize: function resize () {
      this.container.style.height = window.getComputedStyle(this.imageTop).height;
    },
    loadImages: function loadImages() {
      var that = this;

      // Wait for images to be loaded before triggering some stuff
      var loadImagesDispatcher = function () {
        that.imagesLoaded++;
        if (that.imagesLoaded === 1) {
          // We can now determine the render height
          that.imageTop.src = that.images[0].src;
          that.container.style.height = window.getComputedStyle(that.imageTop).height;
          document.querySelector(that.selector).dispatchEvent(new CustomEvent('loaded first'));
        }
        else if (that.imagesLoaded === 2) {
          // We can now set the bottom image
          that.imageBottom.src = that.images[1].src;
        }
        if (that.imagesLoaded === that.paths.length) {
          // We can now activate the slider
          document.querySelector(that.selector).dispatchEvent(new CustomEvent('loaded all'));
        }
      };

      for (var i = 0; i < this.paths.length; i++) {
        this.images[i] = new Image();
        this.images[i].onload = loadImagesDispatcher;
        this.images[i].src = H5P.getPath(this.paths[i], this.id);
      }
    },
    setMargin: function setMargin (margin) {
      this.container.style.margin = margin;
    }
  };

  /**
   * Descriptions object.
   *
   * @param {Object} texts - An array containing the texts for the images.
   * @param {string} selector - Class name of parent node
   */
  var Descriptions = function (texts, selector) {
    this.texts = texts;
    this.selector = selector;

    this.descriptionTop = document.createElement('div');
    this.descriptionTop.className = 'h5p-agamotto-description-top';
    this.descriptionTop.style.opacity = 1;
    this.descriptionTop.setAttribute('tabindex', 0);
    this.descriptionTop.innerHTML = texts[0];

    this.descriptionBottom = document.createElement('div');
    this.descriptionBottom.className = 'h5p-agamotto-description-bottom';
    this.descriptionBottom.style.opacity = 0;
    this.descriptionBottom.innerHTML = texts[1];

    this.descriptionsContainer = document.createElement('div');
    this.descriptionsContainer.className = 'h5p-agamotto-descriptions-container';
    this.descriptionsContainer.appendChild(this.descriptionTop);
    this.descriptionsContainer.appendChild(this.descriptionBottom);
  };

  Descriptions.prototype = {
    getDOM: function getDOM () {
      return this.descriptionsContainer;
    },
    setText: function setText (index, opacity) {
      this.descriptionTop.innerHTML = this.texts[index];
      this.descriptionBottom.innerHTML = this.texts[constrain(index + 1, 0, this.texts.length)];
      this.descriptionTop.style.opacity = opacity;
      this.descriptionBottom.style.opacity = 1 - opacity;
    },
    setHeight: function setHeight () {
      // We need to determine the highest description text for resizing
      var height = 0;
      for (var i = 0; i <= this.texts.length; i++) {
        this.descriptionBottom.innerHTML = this.texts[i];
        height = Math.max(height, this.descriptionBottom.offsetHeight);
      }
      this.descriptionsContainer.style.height = height + 'px';
    }
  };

  /**
   * Descriptions object.
   *
   * @param {Object} options - Options for the slider.
   * @param {string} selector - Class name of parent node
   */
  var Slider = function (options, selector) {
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
        that.setPosition(parseInt(this.style.left) - Slider.TRACK_OFFSET, true);
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
    Slider.TRACK_OFFSET = 16;
    /** @constant {number} */
    Slider.THUMB_OFFSET = 8;
  };

  Slider.prototype = {
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
          Slider.TRACK_OFFSET -
          parseInt(window.getComputedStyle(this.container).marginLeft);
      }
      else {
        position = 0;
      }
      position = constrain(position, 0, this.getWidth());

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
      this.thumb.style.left = position + Slider.THUMB_OFFSET + 'px';
      this.container.setAttribute('aria-valuenow',
        Math.round(position / this.getWidth() * 100));

      // Inform parent node
      document.querySelector(this.selector).dispatchEvent(new CustomEvent('update'));
    },
    getPosition: function getPosition() {
      return (this.thumb.style.left) ? parseInt(this.thumb.style.left) - Slider.THUMB_OFFSET : 0;
    },
    snap: function snap () {
      if (this.options.snap === true) {
        var snapIndex = Math.round(map(this.ratio, 0, 1, 0, this.options.size));
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
      this.setWidth(parseInt(this.container.offsetWidth) - 2 * Slider.TRACK_OFFSET);
      this.setPosition(this.getWidth() * this.ratio, false, true);

      // Update ticks
      if (this.options.ticks === true) {
        for (var i = 0; i < this.ticks.length; i++) {
          this.ticks[i].style.left = Slider.TRACK_OFFSET + i * this.getWidth() / (this.ticks.length - 1) + 'px';
        }
      }
    },
    setMargin: function setMargin (margin) {
      this.container.style.margin = margin;
    }
  };

  /**
   * Attach function called by H5P framework to insert H5P content into page.
   *
   * @param {jQuery} container - Container to attach to.
   */
  C.prototype.attach = function ($container) {
    var that = this;

    // Setup HTML DOM
    $container.addClass('h5p-agamotto');
    if (!this.options.items || this.maxItem < 1) {
      $container.append('<div class="h5p-agamotto-warning">I really need at least two images :-)</div>');
      this.trigger('resize');
      return;
    }

    // Title
    if (this.options.title) {
      $container.append('<div class="h5p-agamotto-title"><h2>' + this.options.title + '</h2></div>');
    }

    // Images
    var paths = [];
    for (var i = 0; i <= this.maxItem; i++) {
      paths[i] = this.options.items[i].image.path;
    }
    this.images = new Images(paths, this.id, this.selector);
    $container.append(this.images.getDOM());
    this.images.loadImages();

    // Slider
    this.slider = new Slider({
      snap: this.options.snap,
      ticks: this.options.ticks,
      size: this.maxItem
    }, this.selector);

    $container.append(this.slider.getDOM());

    // Deactivate the slider on start, will be activated as soon as all images have loaded
    this.slider.disable();

    // Descriptions
    if (this.hasDescription) {

      var descriptionTexts = [];
      for (var i = 0; i <= this.maxItem; i++) {
        descriptionTexts[i] = this.options.items[i].description;
      }
      this.descriptions = new Descriptions(descriptionTexts, this.selector);
      $container.append(this.descriptions.getDOM());
      this.descriptions.setHeight();
      this.trigger('resize');
    }
    else if (!this.options.title) {
      // No passepartout if no title and no descriptions
      this.images.setMargin('0px');
      this.slider.setMargin('0px');
      this.trigger('resize');
    }
    else {
      // Add passepartout to the bottom;
      this.slider.setMargin('0 16px 16px 16px');
      this.trigger('resize');
    }

    // First image loaded, we can set the height of the container
    document.querySelector(that.selector).addEventListener('loaded first', function() {
      that.trigger('resize');
    });
    // All images loaded, we can enable the slider
    document.querySelector(that.selector).addEventListener('loaded all', function() {
      that.slider.enable();
    });
    // Slider was updated
    document.querySelector(that.selector).addEventListener('update', function() {
      /*
       * Map the slider value to the image indexes. Since we might not
       * want to initiate opacity shifts right away, we can add a margin to
       * the left and right of the slider where nothing happens
       */
      var margin = 5;
      var mappedValue = map(
        that.slider.getPosition(),
        0 + margin,
        that.slider.getWidth() - margin,
        0,
        that.maxItem
      );
      // Account for margin change and mapping outside the image indexes
      var topIndex = constrain(Math.floor(mappedValue), 0, that.maxItem);

      /*
       * Using the cosine will allow an image to be displayed a little longer
       * before blending than a linear function
       */
      var linearOpacity = (1 - constrain(mappedValue - topIndex, 0, 1));
      var topOpacity = 0.5 * (1 - Math.cos(Math.PI * linearOpacity));

      that.updateContent(topIndex, topOpacity);
    });

    // Add Resize Handler
    window.addEventListener('resize', function (e) {
      that.images.resize();
      that.slider.resize();
      // The descriptions will get a scroll bar via CSS if neccesary, no resize needed
    });
  };

  /**
   * Remove missing items and limit amount.
   *
   * @param {Object} items - Items defined in semantics.org.
   * @return {Object} Sanitized items.
   */
  var sanitizeItems = function(items) {
    // Remove items with missing image
    for (var i = 0; i < items.length; i++) {
      if (items[i].image === undefined) {
        console.log('An image is missing. I will continue without it, but please check your settings.');
        items.splice(i, 1);
        i--;
      }
    }
    // Restrict to 50 images
    items = items.splice(0, 50);

    return items;
  };

  /**
   * Map a value from one range to another.
   *
   * @param {number} value - Value to me remapped.
   * @param {number} lo1 - Lower boundary of first range.
   * @param {number} hi1 - Upper boundary of first range.
   * @param {number} lo2 - Lower boundary of second range.
   * @param {number} hi2 - Upper boundary of second range.
   * @return {number} - Remapped value.
   */
  var map = function (value, lo1, hi1, lo2, hi2) {
    return lo2 + (hi2 - lo2) * (value - lo1) / (hi1 - lo1);
  };

  /**
   * Constrain a number value within a range.
   *
   * @param {number} value - Value to be constrained.
   * @param {number} lo - Lower boundary of the range.
   * @param {number} hi - Upper boundary of the range.
   * @returns {number} - Constrained value.
   */
  var constrain = function (value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
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

  return C;
}(H5P.jQuery);
