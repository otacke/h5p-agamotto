var H5P = H5P || {};

H5P.Agamotto = function ($) {
  'use strict';
  /**
   * Constructor function.
   *
   * @param {object} options - Options from semantics.json.
   * @param {boolean} options.snap - If true, slider will snap to fixed positions.
   * @param {boolean} options.ticks - If true, slider container will display ticks.
   * @param {number} content - Id.
   */
  function Agamotto(options, id) {
    if (!options.items) {
      return;
    }

    this.options = options;
    this.options.items = sanitizeItems(this.options.items);

    this.maxItem = this.options.items.length - 1;
    this.selector = '.h5p-agamotto-wrapper';

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

    /**
     * Load an Image.
     * TODO: Wouldn't this be better in images.js? Requires a promise here as well
     *
     * @param {string} path - Path to image.
     * @param {number} id - H5P ID.
     * @return {Promise} Promise for image being loaded.
     */
    function loadImage (path, id) {
      return new Promise(function(resolve, reject)  {
        var image = new Image();
        image.onload = function() {
          resolve(this);
        };
        image.onerror = function(error) {
          reject(error);
        };
        image.src = H5P.getPath(path, id);
      });
    }

    /*
     * Load images first before DOM is created; will help to prevent layout
     * problems in some cases.
     */
    var promises = [];
    for (var i = 0; i < that.options.items.length; i++) {
      promises.push(loadImage(that.options.items[i].image.path, that.id));
    }
    Promise.all(promises).then(function(results) {
      that.images = results;

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
        that.wrapper.appendChild(title);
      }

      // Images
      that.images = new H5P.Agamotto.Images(that.images);
      that.wrapper.appendChild(that.images.getDOM());
      that.images.resize();

      // Slider
      that.slider = new H5P.Agamotto.Slider({
        snap: that.options.snap,
        ticks: that.options.ticks,
        size: that.maxItem
      }, that.selector);
      that.wrapper.appendChild(that.slider.getDOM());
      that.slider.resize();

      // Descriptions
      if (that.hasDescription) {
        var descriptionTexts = [];
        for (i = 0; i <= that.maxItem; i++) {
          descriptionTexts[i] = that.options.items[i].description;
        }
        that.descriptions = new H5P.Agamotto.Descriptions(descriptionTexts, that.selector);
        that.wrapper.appendChild(that.descriptions.getDOM());
        that.descriptions.setHeight();
        // Passepartout at the bottom is not needed, because we have a description
        that.wrapper.classList.remove('h5p-agamotto-passepartout-bottom');
      }

      // Title
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
      window.addEventListener('resize', function (e) {
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

        that.images.resize();
        that.slider.resize();
        // The descriptions will get a scroll bar via CSS if neccesary, no resize needed

        // Resize iframe if image's height is too small or too high.
        var windowHeight = window.innerHeight;
        var wrapperHeight = that.wrapper.offsetHeight;
        var actionBar = document.querySelector('.h5p-actions');
        var actionBarHeight = actionBar ? actionBar.offsetHeight : -1;
        if (wrapperHeight + actionBarHeight + 1 !== windowHeight) {
          that.trigger('resize');
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

  return Agamotto;
}(H5P.jQuery);
;
(function (Agamotto) {
  'use strict';

  /**
   * Images object
   *
   * @class H5P.Agamotto.Images
   * @param {Object} images - Array containing the images.
   */
   Agamotto.Images = function (images, scaling) {
     this.images = images;
     this.scaling = scaling || false;

     var canvas = document.createElement('canvas');
     canvas.classList.add('h5p-agamotto-canvas');
     canvas.setAttribute('width', images[0].naturalWidth);
     canvas.setAttribute('height', images[0].naturalHeight);

     console.log(canvas);

     this.ratio = this.images[0].naturalWidth / this.images[0].naturalHeight;
     // Users might use images with different aspect ratios -- I learned that the hard way ;-)
     for (var i = 1; i < this.images.length; i++) {
       if (this.images[i].naturalWidth / this.images[i].naturalHeight !== this.ratio) {
         console.log('I am doing my best, but please make sure that all your images have the same aspect ratio.');
         //break;
       }

       // Scale images 1..n if they are larger than image 0.
       console.log('scale ', i);
       var tmpImg = this.images[i];
       if ((tmpImg.naturalWidth > images[0].naturalWidth) || (tmpImg.naturalHeight > images[0].naturalHeight)) {
         if (tmpImg.naturalWidth / tmpImg.naturalHeight > this.ratio) {
           console.log('scale to height');
           tmpImg.style.height = images[0].naturalHeight + 'px';
           tmpImg.style.width = images[0].naturalHeight / tmpImg.naturalHeight * tmpImg.naturalWidth + 'px';
         }
         if (tmpImg.naturalWidth / tmpImg.naturalHeight < this.ratio) {
           console.log('scale to width');
           tmpImg.style.width = images[0].naturalWidth + 'px';
           tmpImg.style.height = images[0].naturalWidth / tmpImg.naturalWidth * tmpImg.naturalHeight + 'px';
         }
       }
       console.log(tmpImg.style.width, tmpImg.style.height);

       var ctx = canvas.getContext("2d");
       ctx.drawImage(tmpImg, 2, 2);

       var image = new Image();
       image.id = 'pic';
       image.src = canvas.toDataURL();
       this.container = document.createElement('div');
       this.container.appendChild(image);
     }

     this.imageTop = document.createElement('img');
     this.imageTop.classList.add('h5p-agamotto-image-top');
     this.imageTop.src = images[0].src;
     this.imageTop.setAttribute('draggable', 'false');
     this.imageTop.setAttribute('tabindex', 0);

     this.imageBottom = document.createElement('img');
     this.imageBottom.classList.add('h5p-agamotto-image-bottom');
     this.imageBottom.src = images[1].src;
     this.imageBottom.setAttribute('draggable', 'false');

     //this.container = document.createElement('div');
     this.container.classList.add('h5p-agamotto-images-container');
     this.container.appendChild(this.imageTop);
     this.container.appendChild(this.imageBottom);
   };

   Agamotto.Images.prototype = {
     getDOM: function getDOM () {
       return this.container;
     },
     setImage: function setImage (index, opacity) {
       var image1 = this.images[index];
       var image2 = this.images[Agamotto.constrain(index + 1, 0, this.images.length - 1)];

       this.imageTop.src = image1.src;
       this.imageBottom.src = image2.src;
       this.imageTop.style.opacity = opacity;

       if (!this.scaling) {
         // We unfortunately need to always set this, because the images change
         this.imageTop.style.maxWidth = image1.naturalWidth + 'px';
         this.imageTop.style.maxHeight = image1.naturalHeight + 'px';
         this.imageBottom.style.maxWidth = image2.naturalWidth + 'px';
         this.imageBottom.style.maxHeight = image2.naturalHeight + 'px';

         // Center images.
         this.imageTop.style.paddingLeft = Agamotto.constrain(
           (this.container.offsetWidth - this.imageTop.width) / 2,
           0, this.container.offsetWidth) + 'px';
         this.imageTop.style.paddingTop = Agamotto.constrain(
           (this.container.offsetHeight - this.imageTop.height) / 2,
           0, this.container.offsetHeight) + 'px';
         this.imageBottom.style.paddingLeft = Agamotto.constrain(
           (this.container.offsetWidth - this.imageBottom.width) / 2,
           0, this.container.offsetWidth) + 'px';
         this.imageBottom.style.paddingTop = Agamotto.constrain(
           (this.container.offsetHeight - this.imageBottom.height) / 2,
           0, this.container.offsetHeight) + 'px';
       }
     },
     resize: function resize () {
       this.container.style.height = this.container.offsetWidth / this.ratio + 'px';
     },
     getRatio: function getRatio() {
       return this.ratio;
     }
   };

})(H5P.Agamotto);
;
(function (Agamotto) {
  'use strict';

  /**
   * Slider object.
   *
   * @param {Object} options - Options for the slider.
   * @param {boolean} options.snap - If true, slider will snap to fixed positions.
   * @param {boolean} options.ticks - If true, slider container will display ticks.
   * @param {number} options.size - Number of positions/ticks.
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

    // Place ticks
    if (this.options.ticks === true) {
      // Function used here to avoid creating it in the upcoming loop
      var placeTicks = function() {
        that.setPosition(parseInt(this.style.left) - Agamotto.Slider.TRACK_OFFSET, true);
      };
      for (var i = 0; i <= this.options.size; i++) {
        this.ticks[i] = document.createElement('div');
        this.ticks[i].classList.add('h5p-agamotto-tick');
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

    // Initialize event inheritance
    H5P.EventDispatcher.call(this);

    // Slider Layout
    /** @constant {number} */
    Agamotto.Slider.TRACK_OFFSET = 16;
    /** @constant {number} */
    Agamotto.Slider.THUMB_OFFSET = 8;
  };

  // Extends the event dispatcher
  Agamotto.Slider.prototype = Object.create(H5P.EventDispatcher.prototype);
  Agamotto.Slider.prototype.constructor = Agamotto.Slider;

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
          parseInt(window.getComputedStyle(this.container).marginLeft) -
          parseInt(window.getComputedStyle(document.querySelector(this.selector)).paddingLeft) -
          parseInt(window.getComputedStyle(document.querySelector(this.selector)).marginLeft);
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
      var percentage = Math.round(position / this.getWidth() * 100);
      this.container.setAttribute('aria-valuenow', percentage);

      // Inform parent node
      this.trigger('update', {
        position: position,
        percentage: percentage
      });
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
    }
  };

})(H5P.Agamotto);
;
(function (Agamotto) {
  'use strict';

  /**
   * Descriptions object.
   *
   * @param {Object} texts - Array containing the texts for the images.
   * @param {string} selector - Class name of parent node
   */
  Agamotto.Descriptions = function (texts, selector) {
    this.texts = texts;
    this.selector = selector;

    this.descriptionTop = document.createElement('div');
    this.descriptionTop.classList.add('h5p-agamotto-description-top');
    this.descriptionTop.style.opacity = 1;
    this.descriptionTop.setAttribute('tabindex', 0);
    this.descriptionTop.innerHTML = texts[0];

    this.descriptionBottom = document.createElement('div');
    this.descriptionBottom.classList.add('h5p-agamotto-description-bottom');
    this.descriptionBottom.style.opacity = 0;
    this.descriptionBottom.innerHTML = texts[1];

    this.descriptionsContainer = document.createElement('div');
    this.descriptionsContainer.classList.add('h5p-agamotto-descriptions-container');
    this.descriptionsContainer.appendChild(this.descriptionTop);
    this.descriptionsContainer.appendChild(this.descriptionBottom);
  };

  Agamotto.Descriptions.prototype = {
    getDOM: function getDOM () {
      return this.descriptionsContainer;
    },
    setText: function setText (index, opacity) {
      this.descriptionTop.innerHTML = this.texts[index];
      this.descriptionBottom.innerHTML = this.texts[Agamotto.constrain(index + 1, 0, this.texts.length)];
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

})(H5P.Agamotto);
;
/*
 * taylorhakes/promise-polyfill
 * Copyright (c) 2014 Taylor Hakes
 * Copyright (c) 2014 Forbes Lindesay
 * License: MIT License (https://opensource.org/licenses/MIT)
 * original source code: https://github.com/taylorhakes/promise-polyfill
 */
(function (root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {}

  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function () {
      fn.apply(thisArg, arguments);
    };
  }

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    Promise._immediateFn(function () {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      Promise._immediateFn(function() {
        if (!self._handled) {
          Promise._unhandledRejectionFn(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    var prom = new (this.constructor)(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function (arr) {
    var args = Array.prototype.slice.call(arr);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) {
                res(i, val);
              }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for (var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  // Use polyfill for setImmediate for performance gains
  Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
    function (fn) {
      setTimeoutFunc(fn, 0);
    };

  Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @deprecated
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    Promise._immediateFn = fn;
  };

  /**
   * Change the function to execute on unhandled rejection
   * @param {function} fn Function to execute on unhandled rejection
   * @deprecated
   */
  Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
    Promise._unhandledRejectionFn = fn;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  } else if (!root.Promise) {
    root.Promise = Promise;
  }

})(this);
;
