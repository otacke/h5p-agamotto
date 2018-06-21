var H5P = H5P || {};

H5P.Agamotto = function () {
  'use strict';
  /**
   * Constructor function.
   *
   * @param {object} options - Options from semantics.json.
   * @param {boolean} options.snap - If true, slider will snap to fixed positions.
   * @param {boolean} options.ticks - If true, slider container will display ticks.
   * @param {number} content - Id.
   */
  function Agamotto(options, id, extras) {
    if (!options.items) {
      return;
    }

    this.options = options;
    this.options.items = sanitizeItems(this.options.items);
    this.extras = extras;

    this.maxItem = this.options.items.length - 1;
    this.selector = '.h5p-agamotto-wrapper';

    // Set hasDescription = true if at least one item has a description
    this.hasDescription = this.options.items.some(function (item) {
      return item.description !== '';
    });

    this.id = id;

    // Container for KeyListeners
    this.imageContainer = undefined;

    // Currently visible image (index)
    this.position = 0;

    // Store the images that have been viewed
    this.imagesViewed = [];

    // Store the completed state for xAPI triggering
    this.completed = false;

    // Store the currently pressed key if any - false otherwise
    this.keyPressed = false;

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

      // Remember current position (index)
      this.position = Math.round(index + (1 - opacity));

      // Remember images that have been viewed
      if (this.completed === false) {
        // Images count as viewed as of 50 % visibility
        if (this.imagesViewed.indexOf(this.position) === -1) {
          this.imagesViewed.push(this.position);
        }
      }
    };

    // Initialize event inheritance
    H5P.EventDispatcher.call(this);
  }

  // Extends the event dispatcher
  Agamotto.prototype = Object.create(H5P.EventDispatcher.prototype);
  Agamotto.prototype.constructor = Agamotto;

  // Cmp. vocabulary of xAPI statements: http://xapi.vocab.pub/datasets/adl/

  /**
   * Trigger xAPI statement 'experienced' (when interaction encountered).
   */
  Agamotto.prototype.xAPIExperienced = function () {
    this.triggerXAPI('experienced');
  };

  /**
   * Trigger xAPI statement 'interacted' (when slider moved, keys released, or link clicked).
   */
  Agamotto.prototype.xAPIInteracted = function () {
    this.triggerXAPI('interacted');
  };

  /**
   * Trigger xAPI statement 'completed' (when all images have been viewed).
   */
  Agamotto.prototype.xAPICompleted = function () {
    if ((this.imagesViewed.length === this.options.items.length) && !this.completed) {
      this.triggerXAPI('completed');
      // Only trigger this once
      this.completed = true;
    }
  };

  /**
   * Attach function called by H5P framework to insert H5P content into page.
   * TODO: Remove this jQuery dependency as soon as the H5P framework is ready
   *
   * @param {jQuery} $container - Container to attach to.
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

    /**
     * Load an Image.
     * TODO: Wouldn't this be better in images.js? Requires a promise here as well
     *
     * @param {string} imageObject - Image object.
     * @param {number} id - H5P ID.
     * @return {Promise} Promise for image being loaded.
     */
    function loadImage (imageObject, id) {
      return new Promise(function (resolve, reject) {
        var image = new Image();
        image.crossOrigin = (H5P.getCrossOrigin !== undefined ? H5P.getCrossOrigin() : 'Anonymous');
        image.onload = function() {
          resolve(this);
        };
        image.onerror = function(error) {
          reject(error);
        };
        image.src = H5P.getPath(imageObject.params.file.path, id);
      });
    }

    /*
     * Load images first before DOM is created; will help to prevent layout
     * problems in some cases.
     */
    var promises = [];
    that.options.items.forEach(function (item) {
      promises.push(loadImage(item.image, that.id));
    });
    Promise.all(promises).then(function(results) {
      that.images = results.map(function (item, index) {
        return {
          img: item,
          alt: that.options.items[index].image.params.alt,
          title: that.options.items[index].image.params.title
        };
      });

      that.wrapper = document.createElement('div');
      that.wrapper.classList.add('h5p-agamotto-wrapper');
      that.wrapper.classList.add('h5p-agamotto-passepartout-horizontal');
      that.wrapper.classList.add('h5p-agamotto-passepartout-top');
      that.wrapper.classList.add('h5p-agamotto-passepartout-bottom');
      $container.append(that.wrapper);

      // Title
      if (that.options.title) {
        var title = document.createElement('div');
        title.classList.add('h5p-agamotto-title');
        title.innerHTML = '<h2>' + that.options.title + '</h2>';
        title.setAttribute('tabindex', 0);
        that.wrapper.appendChild(title);
      }

      // Images
      that.images = new H5P.Agamotto.Images(that.images);
      that.wrapper.appendChild(that.images.getDOM());
      that.images.resize();

      // Slider
      var labelTexts = [];
      for (var i = 0; i <= that.maxItem; i++) {
        labelTexts[i] = that.options.items[i].labelText || '';
      }
      that.slider = new H5P.Agamotto.Slider({
        snap: that.options.snap,
        ticks: that.options.ticks,
        labels: that.options.labels,
        labelTexts: labelTexts,
        size: that.maxItem
      }, that.selector, that);
      that.wrapper.appendChild(that.slider.getDOM());
      that.slider.resize();

      // Descriptions
      if (that.hasDescription) {
        var descriptionTexts = [];
        for (i = 0; i <= that.maxItem; i++) {
          descriptionTexts[i] = that.options.items[i].description;
        }
        that.descriptions = new H5P.Agamotto.Descriptions(descriptionTexts, that.selector, that);
        that.wrapper.appendChild(that.descriptions.getDOM());
        that.descriptions.adjustHeight();
        // Passepartout at the bottom is not needed, because we have a description
        that.wrapper.classList.remove('h5p-agamotto-passepartout-bottom');
        that.heightDescriptions = that.descriptions.offsetHeight;
      }
      else {
        that.heightDescriptions = 0;
      }

      // Add passepartout depending on the combination of elements
      if (that.options.title) {
        // Passepartout at the top is not needed, because we have a title
        that.wrapper.classList.remove('h5p-agamotto-passepartout-top');
      }
      else if (!that.hasDescription) {
        // No passepartout is needed at all, because we just have an image
        that.wrapper.classList.remove('h5p-agamotto-passepartout-horizontal');
        that.wrapper.classList.remove('h5p-agamotto-passepartout-top');
        that.wrapper.classList.remove('h5p-agamotto-passepartout-bottom');
      }

      // KeyListeners for Images that will allow to jump from one image to another
      that.imageContainer = that.images.getDOM ();
      // TODO: Move this to Images class or remove alltogether
      that.imageContainer.addEventListener('keydown', function(e) {
        // Prevent repeated pressing of a key
        if (that.keyPressed !== false) {
          return;
        }
        that.imageContainer.classList.add('h5p-agamotto-images-keydown');
        e = e || window.event;
        var key = e.which || e.keyCode;
        if (key === 37 || key === 33) {
          e.preventDefault();
          that.keyPressed = key;
          that.slider.setPosition(Agamotto.map(Math.max(0, that.position - 1), 0, that.maxItem, 0, that.slider.getWidth()), true);
        }
        if (key === 39 || key === 34) {
          e.preventDefault();
          that.keyPressed = key;
          that.slider.setPosition(Agamotto.map(Math.min(that.position + 1, that.maxItem), 0, that.maxItem, 0, that.slider.getWidth()), true);
        }
      });
      that.imageContainer.addEventListener('keyup', function(e) {
        // Only trigger xAPI if the interaction started by a particular key has ended
        e = e || window.event;
        var key = e.which || e.keyCode;
        if (key === that.keyPressed) {
          that.keyPressed = false;
          that.xAPIInteracted();
          that.xAPICompleted();
        }
      });

      // Trigger xAPI when starting to view content
      that.xAPIExperienced();

      that.slider.on('update', function(e) {
        /*
         * Map the slider value to the image indexes. Since we might not
         * want to initiate opacity shifts right away, we can add a margin to
         * the left and right of the slider where nothing happens
         */
        var margin = 5;
        var mappedValue = Agamotto.map(
          e.data.position,
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
      window.addEventListener('resize', function () {
        // Prevent infinite resize loops
        if (!that.resizeCooling) {
          /*
           * Decrease the size of the content if on a mobile device in landscape
           * orientation, because it might be hard to use it otherwise.
           * iOS devices don't switch screen.height and screen.width on rotation
           */
          if (isMobileDevice() && Math.abs(window.orientation) === 90) {
            if (/iPhone/.test(navigator.userAgent)) {
              that.wrapper.style.width = Math.round((screen.width / 2) * that.images.getRatio()) + 'px';
            }
            else {
              that.wrapper.style.width = Math.round((screen.height / 2) * that.images.getRatio()) + 'px';
            }
          }
          else {
            // Portrait orientation
            that.wrapper.style.width = 'auto';
          }

          // Resize DOM elements
          that.images.resize();
          that.slider.resize();
          // The descriptions will get a scroll bar via CSS if necessary, no resize needed
          that.trigger('resize');

          that.resizeCooling = setTimeout(function () {
            that.resizeCooling = null;
          }, RESIZE_COOLING_PERIOD);

        }

      });

      // DOM completed.
      that.trigger('resize');
    });
  };

  /**
   * Remove missing items and limit amount.
   *
   * @param {Object} items - Items defined in semantics.org.
   * @return {Object} Sanitized items.
   */
  var sanitizeItems = function (items) {
    /*
     * Remove items with missing image an restrict to 50 images, because it
     * might become hard to differentiate more positions on the slider - and
     * a video to slide over might be more sensible anyway if you need more
     * frames.
     */
     items = items
      .filter(function (item) {
        if (!item.image || !item.image.params || !item.image.params.file) {
          console.log('An image is missing. I will continue without it, but please check your settings.');
          return false;
        }
        return true;
      })
      .splice(0, 50)
      .map(function (item) {
        item.image.params.alt = item.image.params.alt || '';
        item.image.params.title = item.image.params.title || '';
        return item;
      });

    return items;
  };

  /**
   * Detect mobile devices (http://detectmobilebrowsers.com/)
   *
   * @returns {boolean} True if running on a mobile device.
   */
  var isMobileDevice = function() {
    var check = false;
    (function(a){
      if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;}) (navigator.userAgent||navigator.vendor||window.opera);
    return check;
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

  // Cooldown period in ms to prevent infinite resizing
  const RESIZE_COOLING_PERIOD = 50;

  return Agamotto;
}();
