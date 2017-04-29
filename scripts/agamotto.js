"use strict";

var H5P = H5P || {};

H5P.Agamotto = function ($) {
  /**
   * Constructor function.
   *
   * @param {object} options - Options from semantics.json.
   * @param {number} content - Id.
   */
  function Agamotto(options, id) {
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
  Agamotto.prototype = Object.create(H5P.EventDispatcher.prototype);
  Agamotto.prototype.constructor = Agamotto;

  /**
   * Attach function called by H5P framework to insert H5P content into page.
   *
   * @param {jQuery} container - Container to attach to.
   */
  Agamotto.prototype.attach = function ($container) {
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
    this.images = new H5P.Agamotto.Images(paths, this.id, this.selector);
    $container.append(this.images.getDOM());
    this.images.loadImages();

    // Slider
    this.slider = new H5P.Agamotto.Slider({
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
      this.descriptions = new H5P.Agamotto.Descriptions(descriptionTexts, this.selector);
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
      // Just to be sure
      that.trigger('resize');
    });
    // Slider was updated
    document.querySelector(that.selector).addEventListener('update', function() {
      /*
       * Map the slider value to the image indexes. Since we might not
       * want to initiate opacity shifts right away, we can add a margin to
       * the left and right of the slider where nothing happens
       */
      var margin = 5;
      var mappedValue = Agamotto.map(
        that.slider.getPosition(),
        0 + margin,
        that.slider.getWidth() - margin,
        0,
        that.maxItem
      );
      // Account for margin change and mapping outside the image indexes
      var topIndex = Agamotto.constrain(Math.floor(mappedValue), 0, that.maxItem);

      /*
       * Using the cosine will allow an image to be displayed a little longer
       * before blending than a linear function
       */
      var linearOpacity = (1 - Agamotto.constrain(mappedValue - topIndex, 0, 1));
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
  Agamotto.map = function (value, lo1, hi1, lo2, hi2) {
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
  Agamotto.constrain = function (value, lo, hi) {
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

  return Agamotto;
}(H5P.jQuery);
