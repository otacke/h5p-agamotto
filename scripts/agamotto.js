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

    this.image1, this.image2 = undefined;
    this.description1, this.description2 = undefined;

    // Set hasDescription = true if at least one item has a description
    this.hasDescription = false;
    for (var i = 0; i < this.options.items.length; i++) {
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
      for (var i = 0; i < this.options.items.length; i++) {
        this.description2.innerHTML = this.options.items[i].description;
        maxDescriptionHeight = Math.max(maxDescriptionHeight, this.description2.offsetHeight);
      }
      return maxDescriptionHeight;
    }

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
    $container.append('<div class="h5p-agamotto-slider-container"><input id="h5p-agamotto-slider" type="range" value="0"/></div>');

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
      /*
       * Map the slider value to the image indexes. Since we might not
       * want to initiate opacity shifts right away, we can add a margin to
       * the left and right of the slider where nothing happens
       */
      var margin = 5;
      var mappedValue = (self.options.items.length-1) * (this.value - margin) / ((slider.getAttribute('max') || 100) - margin);

      // Account for margin change and mapping outside the image indexes
      var topIndex = Math.min(Math.max(0, Math.floor(mappedValue)), self.options.items.length-1);
      var bottomIndex = Math.min(Math.max(0, topIndex + 1), self.options.items.length-1);

      // Using a power value will allow the actual image to be displayed a little longer before blending
      var topOpacity = Math.pow(topIndex + 1 - mappedValue, 2);

      // Update images
      self.image1.src = H5P.getPath(self.options.items[topIndex].image.path, self.id);
      self.image2.src = H5P.getPath(self.options.items[bottomIndex].image.path, self.id);
      self.image1.style.opacity = topOpacity;

      // Update descriptions
      if (self.hasDescription) {
        self.description1.innerHTML = self.options.items[topIndex].description;
        self.description2.innerHTML = self.options.items[bottomIndex].description;
        self.description1.style.opacity = topOpacity;
        self.description2.style.opacity = 1 - topOpacity;
      }
    });
  };

  return C;
}(H5P.jQuery);
