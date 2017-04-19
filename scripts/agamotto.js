/*
 * TODO: clean up variable mess
 * TODO: refactoring
 * TODO: more refactoring
 * TODO: proper commenting
 * TODO: think about optional ticks
 */
var H5P = H5P || {};

H5P.Agamotto = function ($) {
  /**
   * Constructor function.
   *
   * @param {object} options from semantics.json.
   * @param {number} content id.
   */
  function C(options, id) {
    if (!options.items) {
      return;
    }

    // Remove items with missing image
    for (var i = 0; i < options.items.length; i++) {
      if (options.items[i].image === undefined) {
        console.log('An image is missing. I will continue without it, but please check your settings.');
        options.items.splice(i, 1);
        i--;
      }
    }
    // Restrict to 50 images
    options.items = options.items.splice(0, 50);
    this.options = options;

    this.maxItem = this.options.items.length - 1;
    if (this.maxItem > 100) {
      console.log('You have more than 100 images. This will not work well.');
    }

    this.image1, this.image2 = undefined;
    this.description1, this.description2 = undefined;

    // TODO: include other variables

    this.sliderTrackWidth = 0;
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
     * Get maximum height of all descriptions.
     * Expects the DOM to be already setup.
     *
     * @return {number} - The maximum height of all descriptions.
     */
    this.getMaxDescriptionHeight = function() {
      var maxDescriptionHeight = 0;
      for (var i = 0; i < this.maxItem + 1; i++) {
        this.description2.innerHTML = this.options.items[i].description;
        maxDescriptionHeight = Math.max(maxDescriptionHeight, this.description2.offsetHeight);
      }
      return maxDescriptionHeight;
    };

    /**
     * Map a value from one range to another.
     *
     * @param {number} value - the value to me remapped.
     * @param {number} lo1 - lower boundary of first range.
     * @param {number} hi1 - upper boundary of first range.
     * @param {number} lo2 - lower boundary of second range.
     * @param {number} hi2 - upper boundary of second range.
     * @return {number} - remapped value.
     */
    this.map = function (value, lo1, hi1, lo2, hi2) {
      return lo2 + (hi2 - lo2) * (value - lo1) / (hi1 - lo1);
    };

    /**
     * Constrain a number value within a range.
     *
     * @param {number} value - value to be constrained.
     * @param {number} lo - lower boundary of the range.
     * @param {number} hi - upper boundary of the range.
     * @returns {number} - constrained value.
     */
    this.constrain = function (value, lo, hi) {
      return Math.min(hi, Math.max(lo, value));
    };

    /**
     * Update images and descriptions.
     *
     * @param {Number} index - index of top image.
     * @param {Number} opacity - opacity of top image.
     */
    this.update = function (index, opacity) {
      bottomIndex = this.constrain(index + 1, 0, this.maxItem);

      // Update images
      this.image1.src = H5P.getPath(this.options.items[index].image.path, this.id);
      this.image2.src = H5P.getPath(this.options.items[bottomIndex].image.path, this.id);
      this.image1.style.opacity = opacity;

      // Update descriptions
      if (this.hasDescription) {
        this.description1.innerHTML = this.options.items[index].description;
        this.description2.innerHTML = this.options.items[bottomIndex].description;
        this.description1.style.opacity = opacity;
        this.description2.style.opacity = 1 - opacity;
      }
    };

    // Initialize event inheritance
    H5P.EventDispatcher.call(this);
  }

  // Extends the event dispatcher
  C.prototype = Object.create(H5P.EventDispatcher.prototype);
  C.prototype.constructor = C;

  /**
   * Attach function called by H5P framework to insert H5P content into page.
   *
   * @param {jQuery} container to attach to.
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

    // Title, images and slider
    if (self.options.title) {
      $container.append('<div class="h5p-agamotto-title"><h2>' + self.options.title + '</h2></div>');
    }
    $container.append('<div id="h5p-agamotto-images"><img id="h5p-agamotto-image1" src="#" draggable="false"/><img id="h5p-agamotto-image2" src="#" draggable="false"/></div>');
    $container.append('<div id="h5p-agamotto-slider-container"><div id="h5p-agamotto-slider-track"></div><div id="h5p-agamotto-slider-thumb"></div></div>');

    self.sliderContainer = document.getElementById('h5p-agamotto-slider-container');
    self.sliderContainer.setAttribute('role', 'slider');
    self.sliderContainer.setAttribute('aria-valuenow', 0);
    self.sliderContainer.setAttribute('aria-valuemin', 0);
    self.sliderContainer.setAttribute('aria-valuemax', 100);

    self.sliderTrack = document.getElementById('h5p-agamotto-slider-track');
    self.sliderTrackWidth = parseInt(self.sliderContainer.offsetWidth) - 32;
    self.sliderTrack.style.width = self.sliderTrackWidth + 'px';
    self.sliderThumb = document.getElementById('h5p-agamotto-slider-thumb');
    self.sliderThumb.setAttribute('tabindex', 0);

    // Descriptions
    if (self.hasDescription) {
      $container.append('<div id="h5p-agamotto-descriptions"><div id="h5p-agamotto-description1"></div><div id="h5p-agamotto-description2"></div></div>');

      self.description1 = document.getElementById('h5p-agamotto-description1');
      self.description1.style.opacity = 1;
      self.description1.setAttribute('tabindex', 0);
      self.description1.innerHTML = self.options.items[0].description;

      self.description2 = document.getElementById('h5p-agamotto-description2');
      self.description2.style.opacity = 0;
      self.description2.innerHTML = self.options.items[1].description;

      document.getElementById('h5p-agamotto-descriptions').style.height = self.getMaxDescriptionHeight() + 'px';
      self.trigger('resize');
    }

    // We trust the user here and believe that all images have the same height
    self.image1 = document.getElementById('h5p-agamotto-image1');
    self.image1.onload = function () {
      document.getElementById('h5p-agamotto-images').style.height = window.getComputedStyle(self.image1).height;
      self.trigger('resize');
    }
    self.image1.src = H5P.getPath(self.options.items[0].image.path, self.id);
    self.image1.setAttribute('tabindex', 0);
    self.image2 = document.getElementById('h5p-agamotto-image2');
    self.image2.src = H5P.getPath(self.options.items[1].image.path, self.id);

    self.sliderThumb.addEventListener('mousedown', startSlide, false);
    self.sliderTrack.addEventListener('mousedown', startSlide, false);
    document.getElementsByClassName('h5p-agamotto')[0].addEventListener('mouseup', stopSlide, false);

    function startSlide (e) {
      e = e || window.event;
      moveThumb(e);
      document.getElementsByClassName('h5p-agamotto')[0].addEventListener('mousemove', moveThumb, false);
    };

    function stopSlide (e) {
      e = e || window.event;
      document.getElementsByClassName('h5p-agamotto')[0].removeEventListener('mousemove', moveThumb, false);
      snap();
    };

    // Event Listeners for Touch Interface
    this.sliderContainer.addEventListener('touchstart', function (e) {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      moveThumb(e);

      this.addEventListener('touchmove', function (e) {
        e = e || window.event;
        e.preventDefault();
        e.stopPropagation();
        moveThumb(e);
      });
    });
    this.sliderContainer.addEventListener('touchend', function (e) {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      snap();
    });

    // Event Listeners for Keyboard on handle
    this.sliderThumb.addEventListener('keydown', function (e) {
      e = e || window.event;
      var key = e.which || e.keyCode;

      // handler left
      if (key === 37) {
        var position = parseInt(self.sliderThumb.style.left) - 0.01 * self.sliderTrack.offsetWidth;
        moveThumb(position);
      }

      // handler right
      if (key === 39) {
        var position = parseInt(self.sliderThumb.style.left) + 0.01 * self.sliderTrack.offsetWidth;
        moveThumb(position);
      }
    });

    function getPointerX (e) {
      var pointerX = 0;
      if (e.touches) {
        pointerX = e.touches[0].pageX;
      } else {
        pointerX = e.clientX;
      }
      return pointerX;
    };

    function snap () {
      if (self.options.snap === true) {
        var snapIndex = Math.round(self.index + 1 - self.opacity);
        self.sliderThumbPosition = snapIndex * parseInt(self.sliderTrack.offsetWidth) / self.maxItem;
        updateThumb(true);
        self.update(snapIndex, 1);
      }
    }

    function updateThumb(animate) {
      if (animate) {
        self.sliderThumb.classList.add('h5p-agamotto-transition');
      } else {
        self.sliderThumb.classList.remove('h5p-agamotto-transition');
      }
      self.sliderThumb.style.left = self.sliderThumbPosition + 8 + 'px';
      self.sliderContainer.setAttribute('aria-valuenow', Math.round(self.sliderThumbPosition / self.sliderTrack.offsetWidth * 100));
    }

    function moveThumb (to) {
      if ((typeof to === 'string') || (typeof to === 'number')) {
        to = parseInt(to) + 32 - 8;
      } else if (typeof to === 'object') {
        to = getPointerX(to);
      } else {
        to = 0;
      }
      self.sliderThumbPosition = self.constrain(to - 32, 0, self.sliderTrack.offsetWidth);
      updateThumb(false);
      /*
       * Map the slider value to the image indexes. Since we might not
       * want to initiate opacity shifts right away, we can add a margin to
       * the left and right of the slider where nothing happens
       */
      var margin = 5;
      var mappedValue = self.map(
        self.sliderThumbPosition,
        (parseInt(this.min) || 0) + margin,
        (parseInt(this.max) || self.sliderTrack.offsetWidth) - margin,
        0,
        self.maxItem
      );
      // Account for margin change and mapping outside the image indexes
      var topIndex = self.constrain(Math.floor(mappedValue), 0, self.maxItem);

      /*
       * Using the cosine will allow an image to be displayed a little longer
       * before blending than a linear function
       */
      var linearOpacity = (1 - self.constrain(mappedValue - topIndex, 0, 1));
      var topOpacity = 0.5 * (1 - Math.cos(Math.PI * linearOpacity));

      self.index = topIndex;
      self.opacity = topOpacity;
      self.update(topIndex, topOpacity);
    }

    window.addEventListener('resize', function (e) {
      document.getElementById('h5p-agamotto-images').style.height = window.getComputedStyle(self.image1).height;
      var ratio = self.sliderThumbPosition / self.sliderTrackWidth;

      self.sliderTrackWidth = parseInt(self.sliderContainer.offsetWidth) - 32;
      self.sliderThumbPosition = self.sliderTrackWidth * ratio;

      self.sliderThumb.style.left = self.sliderThumbPosition + 8 + 'px';
      self.sliderTrack.style.width = self.sliderTrackWidth + 'px';
    });

    // This is needed for Chrome to detect the mouseup outside the iframe
    window.addEventListener('mouseup', function () {
      document.getElementsByClassName('h5p-agamotto')[0].dispatchEvent(new CustomEvent('mouseup'));
    });
  };

  return C;
}(H5P.jQuery);
