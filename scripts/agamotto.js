/*
 * TODO: Make the code nice: refactoring, e.g. using a Slider class
 */
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

    this.sliderThumbPosition = 0;
    this.index = 0;
    this.opacity = 1;

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
      var bottomIndex = constrain(index + 1, 0, this.maxItem);

      // Update images
      this.imageObject.setImage(index, opacity);

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
   * @param {Object} images - An array containing the images
   */
  var Images = function (paths, id, parent) {
    this.paths = paths;
    this.id = id;
    this.parent = parent;

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

    this.imagesContainer = document.createElement('div');
    this.imagesContainer.className = 'h5p-agamotto-images-container';
    this.imagesContainer.appendChild(this.imageTop);
    this.imagesContainer.appendChild(this.imageBottom);
  }

  Images.prototype = {
    getDOM: function getDOM () {
      return this.imagesContainer;
    },
    setImage: function setImage (index, opacity) {
      this.imageTop.src = this.images[index].src;
      this.imageBottom.src = this.images[constrain(index + 1, 0, this.images.length - 1)].src;
      this.imageTop.style.opacity = opacity;
    },
    resize: function resize () {
      this.imagesContainer.style.height = window.getComputedStyle(this.imageTop).height;
    },
    loadImages: function loadImages() {
      that = this;
      for (var i = 0; i < this.paths.length; i++) {
        this.images[i] = new Image();
        this.images[i].onload = function () {
          that.imagesLoaded++;
          if (that.imagesLoaded === 1) {
            // We can now determine the render height
            that.imageTop.src = that.images[0].src;
            that.imagesContainer.style.height = window.getComputedStyle(that.imageTop).height;
            that.parent.trigger('resize');
          }
          else if (that.imagesLoaded === 2) {
            // We can now set the bottom image
            that.imageBottom.src = that.images[1].src;
          }
          else if (that.imagesLoaded === that.paths.length) {
            // We can now activate the slider
            // TODO: Replace!
            that.parent.sliderThumb.classList.remove('h5p-agamotto-disabled');
            that.parent.sliderTrack.classList.remove('h5p-agamotto-disabled');
          }
        };
        this.images[i].src = H5P.getPath(this.paths[i], this.id);
      }
    }
  }

  /**
   * Descriptions object
   *
   * @param {Object} texts - An array containing the texts for the images
   */
  var Descriptions = function (texts) {
    this.texts = texts;

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
  }

  /**
   * Attach function called by H5P framework to insert H5P content into page.
   *
   * @param {jQuery} container - Container to attach to.
   */
  C.prototype.attach = function ($container) {
    var self = this;

    // Setup HTML DOM
    $container.addClass("h5p-agamotto");
    if (!self.options.items || self.maxItem < 1) {
      $container.append('<div class="h5p-agamotto-warning">I really need at least two images :-)</div>');
      self.trigger('resize');
      return;
    }

    // Title
    if (self.options.title) {
      $container.append('<div class="h5p-agamotto-title">' +
        '<h2>' + self.options.title + '</h2>' +
        '</div>');
    }

    var paths = [];
    for (var i = 0; i <= self.maxItem; i++) {
      paths[i] = self.options.items[i].image.path;
    }
    self.imageObject = new Images(paths, self.id, this);
    $container.append(self.imageObject.getDOM());
    self.imageObject.loadImages();


    // Slider (TODO: Make this a class?)
    self.sliderTrack = document.createElement('div');
    self.sliderTrack.className = 'h5p-agamotto-slider-track';

    self.sliderThumb = document.createElement('div');
    self.sliderThumb.className = 'h5p-agamotto-slider-thumb';
    self.sliderThumb.setAttribute('tabindex', 0);

    self.sliderContainer = document.createElement('div');
    self.sliderContainer.className = ('h5p-agamotto-slider-container');
    self.sliderContainer.setAttribute('role', 'slider');
    self.sliderContainer.setAttribute('aria-valuenow', 0);
    self.sliderContainer.setAttribute('aria-valuemin', 0);
    self.sliderContainer.setAttribute('aria-valuemax', 100);
    self.sliderContainer.appendChild(self.sliderTrack);
    self.sliderContainer.appendChild(self.sliderThumb);

    $container.append(self.sliderContainer);

    self.sliderTrackWidth = parseInt(self.sliderContainer.offsetWidth) - 2 * C.TRACK_OFFSET;
    self.sliderTrack.style.width = self.sliderTrackWidth + 'px';

    // Deactivate the slider on start, will be activated as soon as all images have loaded
    self.sliderTrack.classList.add('h5p-agamotto-disabled');
    self.sliderThumb.classList.add('h5p-agamotto-disabled');

    if (self.options.ticks) {
      self.sliderTicks = [];
      for (var i = 0; i <= self.maxItem; i++) {
        self.sliderTicks[i] = document.createElement('div');
        self.sliderTicks[i].className = 'h5p-agamotto-tick';
        self.sliderTicks[i].onclick = function() {
          update(parseInt(this.style.left) - C.TRACK_OFFSET, true);
        };
        self.sliderContainer.appendChild(self.sliderTicks[i]);
      }
    }

    // Descriptions
    if (self.hasDescription) {

      var descriptionTexts = [];
      for (var i = 0; i <= self.maxItem; i++) {
        descriptionTexts[i] = self.options.items[i].description;
      }

      // TODO: Don't use global
      self.descriptions = new Descriptions(descriptionTexts);
      $container.append(self.descriptions.getDOM());
      self.descriptions.setHeight();
      self.trigger('resize');
    } else if (!self.options.title) {
      // No passepartout if no title and no descriptions
      self.imagesContainer.style.margin = '0px';
      self.sliderContainer.style.margin = '0px';
      self.trigger('resize');
    } else {
      // Add passepartout to the bottom;
      self.sliderContainer.style.marginBottom = '16px';
      self.trigger('resize');
    }

    addEventListeners();

    /**
     * Add all EventListeners
     */
    function addEventListeners() {
      // Event Listeners for Mouse
      self.sliderThumb.addEventListener('mousedown', startSlide, false);
      self.sliderTrack.addEventListener('mousedown', startSlide, false);
      document.querySelector('.h5p-agamotto').addEventListener('mouseup', stopSlide, false);

      // Event Listeners for Touch Interface
      self.sliderContainer.addEventListener('touchstart', function (e) {
        e = e || window.event;
        e.preventDefault();
        e.stopPropagation();
        update(e, false);

        this.addEventListener('touchmove', function (e) {
          e = e || window.event;
          e.preventDefault();
          e.stopPropagation();
          update(e, false);
        });
      });

      self.sliderContainer.addEventListener('touchend', function (e) {
        e = e || window.event;
        e.preventDefault();
        e.stopPropagation();
        snap();
      });

      // Event Listeners for Keyboard on handle to move in percentage steps
      self.sliderThumb.addEventListener('keydown', function (e) {
        e = e || window.event;
        var key = e.which || e.keyCode;

        // handler left
        if (key === 37) {
          update(parseInt(self.sliderThumb.style.left) - 0.01 *
            self.sliderTrack.offsetWidth - C.THUMB_OFFSET, false);
        }

        // handler right
        if (key === 39) {
          update(parseInt(self.sliderThumb.style.left) + 0.01 *
            self.sliderTrack.offsetWidth - C.THUMB_OFFSET, false);
        }

        this.addEventListener('keyup', function (e) {
          e = e || window.event;
          snap();
        });
      });

      // Resize handler
      window.addEventListener('resize', function (e) {
        self.imageObject.resize();
        var ratio = self.sliderThumbPosition / self.sliderTrackWidth;

        self.sliderTrackWidth = parseInt(self.sliderContainer.offsetWidth) - 2 * C.TRACK_OFFSET;
        self.sliderThumbPosition = self.sliderTrackWidth * ratio;

        self.sliderTrack.style.width = self.sliderTrackWidth + 'px';
        updateThumb(self.sliderThumbPosition, true);

        // Update ticks
        if (self.options.ticks) {
          for (var i = 0; i <= self.maxItem; i++) {
            self.sliderTicks[i].style.left = C.TRACK_OFFSET + i * self.sliderTrackWidth / self.maxItem + 'px';
          }
        }
      });

      // This is needed for Chrome to detect the mouseup outside the iframe
      window.addEventListener('mouseup', function () {
        document.querySelector('.h5p-agamotto').dispatchEvent(new CustomEvent('mouseup'));
      });
    }

    /**
     * Will enable the slider if all images have been loaded.
     */
    function enableSlider() {
      self.imagesLoaded ++;
      if (self.imagesLoaded === self.maxItem) {
        self.sliderThumb.classList.remove('h5p-agamotto-disabled');
        self.sliderTrack.classList.remove('h5p-agamotto-disabled');
      }
    }

    /**
     * Start sliding on mousedown.
     *
     * @param {object} e - Mousedown event.
     */
    function startSlide (e) {
      e = e || window.event;
      update(e, false);
      document.querySelector('.h5p-agamotto').addEventListener('mousemove', update, false);
    }

    /**
     * Stop sliding on mouseup.
     *
     * @param {object} e - Mouseup event.
     */
    function stopSlide (e) {
      e = e || window.event;
      document.querySelector('.h5p-agamotto').removeEventListener('mousemove', update, false);
      snap();
    }

    /**
     * Get the x position from a "pointer" event.
     *
     * @param {object} e - Event.
     * @return {number} X position from the event.
     */
    function getPointerX (e) {
      var pointerX = 0;
      if (e.touches) {
        pointerX = e.touches[0].pageX;
      } else {
        pointerX = e.clientX;
      }
      return pointerX;
    }

    /**
     * Snap the slider to a fixed position
     */
    function snap () {
      if (self.options.snap === true) {
        var snapIndex = Math.round(self.index + 1 - self.opacity);
        updateThumb(snapIndex * parseInt(self.sliderTrack.offsetWidth) / self.maxItem, true);
        self.updateContent(snapIndex, 1);
      }
    }

    /**
     * Update the slider thumb position on the slider track.
     *
     * @param {number} position - Position to set the thumb to.
     * @param {boolean} animate - If true, the slider will move gently in a transition.
     */
    function updateThumb(position, animate) {
      if (animate) {
        self.sliderThumb.classList.add('h5p-agamotto-transition');
      } else {
        self.sliderThumb.classList.remove('h5p-agamotto-transition');
      }
      // Sanitize position
      position = constrain(position, 0, self.sliderTrack.offsetWidth);

      // Store the position for resize
      self.sliderThumbPosition = position;

      self.sliderThumb.style.left = position + C.THUMB_OFFSET + 'px';
      self.sliderContainer.setAttribute('aria-valuenow',
        Math.round(position / self.sliderTrack.offsetWidth * 100));
    }

    /**
     * Update all elements image, slider, and description).
     * This function can handle strings such as 1px from CSS, numbers and also
     * pointer positions from events
     *
     * @param {string|number|object} position - New slider thumb position on slider track.
     * @param {boolean} animate - If true, the slider will move gently in a transition.
     */
    function update (position, animate) {
      if (self.sliderThumb.classList.contains('h5p-agamotto-disabled')) {
        return;
      }
      // Compute position from string (e.g. 1px), from number (e.g. 1), or from event
      if ((typeof position === 'string') || (typeof position === 'number')) {
        position = parseInt(position);
      } else if (typeof position === 'object') {
        position = getPointerX(position) - C.TRACK_OFFSET -
          parseInt(window.getComputedStyle(self.sliderContainer).marginLeft);
      } else {
        position = 0;
      }
      // Sanitization
      position = constrain(position, 0, self.sliderTrack.offsetWidth);

      updateThumb(position, animate);

      /*
       * Map the slider value to the image indexes. Since we might not
       * want to initiate opacity shifts right away, we can add a margin to
       * the left and right of the slider where nothing happens
       */
      var margin = 5;
      var mappedValue = map(
        position,
        (parseInt(this.min) || 0) + margin,
        (parseInt(this.max) || self.sliderTrack.offsetWidth) - margin,
        0,
        self.maxItem
      );
      // Account for margin change and mapping outside the image indexes
      var topIndex = constrain(Math.floor(mappedValue), 0, self.maxItem);

      /*
       * Using the cosine will allow an image to be displayed a little longer
       * before blending than a linear function
       */
      var linearOpacity = (1 - constrain(mappedValue - topIndex, 0, 1));
      var topOpacity = 0.5 * (1 - Math.cos(Math.PI * linearOpacity));

      self.index = topIndex;
      self.opacity = topOpacity;
      self.updateContent(topIndex, topOpacity);
    }
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

  // Slider Layout
  /** @constant {number} */
  C.TRACK_OFFSET = 16;
  /** @constant {number} */
  C.THUMB_OFFSET = 8;

  return C;
}(H5P.jQuery);
