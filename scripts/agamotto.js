/*
 * Info
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
    this.options = options;
    this.maxItem = options.items.length - 1;

    this.image1, this.image2 = undefined;
    this.description1, this.description2 = undefined;
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

    // Title, images and slider
    if (self.options.title) {
      $container.append('<div class="h5p-agamotto-title"><h2>' + self.options.title + '</h2></div>');
    }
    $container.append('<div id="h5p-agamotto-images"><img id="h5p-agamotto-image1" src="#"/><img id="h5p-agamotto-image2" src="#"/></div>');
    $container.append('<div class="h5p-agamotto-slider-container"><input id="h5p-agamotto-slider" type="range" value="0" min="0" max="100"/></div>');

    // Descriptions
    if (self.hasDescription) {
      $container.append('<div id="h5p-agamotto-descriptions"><div id="h5p-agamotto-description1"></div><div id="h5p-agamotto-description2"></div></div>');

      self.description1 = document.getElementById('h5p-agamotto-description1');
      self.description1.style.opacity = 1;
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
      document.getElementById('h5p-agamotto-images').style.height = self.image1.height + 'px';
      self.trigger('resize');
    }
    self.image1.src = H5P.getPath(self.options.items[0].image.path, self.id);
    self.image2 = document.getElementById('h5p-agamotto-image2');
    self.image2.src = H5P.getPath(self.options.items[1].image.path, self.id);

    // Create slider including event handling
    var slider = document.getElementById('h5p-agamotto-slider');
    slider.addEventListener('input', function () {
      this.setAttribute('value', this.value);
      /*
       * Map the slider value to the image indexes. Since we might not
       * want to initiate opacity shifts right away, we can add a margin to
       * the left and right of the slider where nothing happens
       */
      var margin = 5;
      var mappedValue = self.map(
        this.value,
        (parseInt(this.min) || 0) + margin,
        (parseInt(this.max) || 100) - margin,
        0,
        self.maxItem
      );

      // Account for margin change and mapping outside the image indexes
      var topIndex = self.constrain(Math.floor(mappedValue), 0, self.maxItem);

      // Using a power value will allow the actual image to be displayed a little longer before blending
      var topOpacity = Math.pow(1 - self.constrain(mappedValue - topIndex, 0, 1), 2);

      self.index = topIndex;
      self.opacity = topOpacity;
      self.update(topIndex, topOpacity);
    });

    slider.addEventListener('change', function () {
      if (self.options.snap === true) {
        var snapIndex = Math.round(self.index + 1 - self.opacity);
        this.value = snapIndex * parseInt(this.max) / self.maxItem;
        self.update(snapIndex, 1);
      }
    });

    window.addEventListener('resize', function () {
      document.getElementById('h5p-agamotto-images').style.height = self.image1.height + 'px';
    });
  };

  return C;
}(H5P.jQuery);
