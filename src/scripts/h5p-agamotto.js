import Descriptions from './h5p-agamotto-descriptions';
import Images from './h5p-agamotto-images';
import Promise from 'core-js/features/promise';
import Slider from './h5p-agamotto-slider';
import Spinner from './h5p-agamotto-spinner';
import Util from './h5p-agamotto-util';

/** Class for Agamotto interaction */
class Agamotto extends H5P.Question {
  /**
   * @class
   * @param {object} params Params from semantics.json.
   * @param {string} contentId ContentId.
   * @param {object} contentData contentData.
   */
  constructor(params, contentId, contentData) {
    super('agamotto');

    if (!params.items) {
      return;
    }

    this.params = params;
    this.params.items = Agamotto.sanitizeItems(this.params.items);

    // Set default values
    this.params = Util.extend({
      items: [],
      behaviour: {
        startImage: 1,
        snap: true,
        ticks: false,
        labels: false,
        transparencyReplacementColor: '#000000',
        imagesDescriptionsRatio: 70
      },
      a11y: {
        image: 'Image',
        imageSlider: 'Image slider',
        mute: 'Mute',
        unmute: 'Unmute',
        buttonFullscreenEnter: 'Enter fullscreen mode',
        buttonFullscreenExit: 'Exit fullscreen mode'
      }
    }, this.params);

    this.extras = contentData;

    // Keep track of whether the content is visible or not
    this.isVisible = false;

    this.maxItem = this.params.items.length - 1;
    this.startImage = Util.constrain(this.params.behaviour.startImage - 1, 0, this.maxItem);
    this.selector = '.h5p-agamotto-wrapper';

    // Tracking for resizes
    this.previousSizes = [];
    this.imagesRepeatedZeroHeight = 0;

    // Set hasDescription = true if at least one item has a description
    this.hasDescription = this.params.items.some((item) => item.description !== '');

    this.contentId = contentId;

    // Container for KeyListeners
    this.imageContainer = undefined;

    // Currently visible image (index)
    this.position = 0;

    // Store the images that have been viewed
    this.imagesViewed = [];

    // Store the completed state for xAPI triggering
    this.completed = false;

    /**
     * Update images and descriptions.
     *
     * @param {number} index Index of top image.
     * @param {number} opacity Opacity of top image.
     */
    this.updateContent = (index, opacity) => {
      // Limit updates for performance reasons, will be a little jumpy though
      opacity = Math.round(opacity * 10) / 10;
      if (this.slider.isUsed() && opacity === this.images.getTopOpacity() && (opacity !== 1 || this.position === index)) {
        return;
      }

      this.currentIndex = index;

      // Update audio
      this.setAudio(index, opacity);

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

    /**
     * Set audio.
     *
     * @param {number} index Current image's index.
     * @param {number} opacity Current image's opacity.
     */
    this.setAudio = (index, opacity) => {
      // Keep track of current audio
      const audioIndex = Math.round(1 + index - opacity);
      if (audioIndex === this.currentAudioId) {
        return; // skip, already played/playing or null
      }
      this.currentAudioId = audioIndex;

      // No need to play
      if (this.muted) {
        return;
      }

      this.stopAudios();

      // Start new audio
      if (this.audios[audioIndex]) {
        this.startAudio(this.currentAudioId);
      }
    };

    /**
     * Start audio.
     *
     * @param {number} id Index.
     */
    this.startAudio = (id) => {
      if (!this.isVisible) {
        return; // Don't play when content is not visible
      }

      if (this.audios.length <= id) {
        return;
      }

      const currentAudio = this.audios[id];
      if (!currentAudio) {
        return;
      }

      // People might move the slider quickly ...
      if (!currentAudio.promise) {
        currentAudio.promise = currentAudio.player.play();
        currentAudio.promise
          .finally(() => {
            currentAudio.promise = null;
          })
          .catch(() => {
            // Browser policy prevents playing
            this.slider.toggleAudioButton(true);
          });
      }
    };

    /**
     * Stop audios
     */
    this.stopAudios = () => {
      /*
       * People may move the slider quickly, and audios that should
       * be stopped may not have loaded yet.
       */
      this.audios.forEach((audio) => {
        if (!audio) {
          return; // skip, no audio
        }

        if (audio.promise) {
          audio.promise.then(() => {
            audio.player.pause();
            audio.player.load(); // Reset
            audio.promise = null;
          });
        }
        else {
          audio.player.pause();
          audio.player.load(); // Reset
        }
      });
    };

    /**
     * Register the DOM elements with H5P.Question.
     */
    this.registerDomElements = () => {
      this.content = this.createDOM();

      // Stop audio when content gets hidden and start when gets visible
      new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.intersectionRatio === 0) {
          this.isVisible = false;
          this.stopAudios();
        }
        else if (entry.intersectionRatio === 1) {
          this.isVisible = true;
          this.startAudio(this.currentIndex);
        }
      }, {
        root: document.documentElement,
        threshold: [0, 1] // Get events when it is shown and hidden
      }).observe(this.content);

      this.setContent(this.content);
    };

    /**
     * Create the DOM.
     *
     * @returns {HTMLElement} DOM.
     */
    this.createDOM = () => {
      const content = document.createElement('div');
      content.classList.add('h5p-agamotto');

      if (!this.params.items || this.maxItem < 1) {
        const warning = document.createElement('div');
        warning.classList.add('h5p-agamotto-warning');
        warning.innerHTML = 'I really need at least two images :-)';
        content.appendChild(warning);
        return content;
      }

      // Spinner to indicate loading
      this.spinner = new Spinner('h5p-agamotto-spinner');
      content.appendChild(this.spinner.getDOM());

      // Create audio elements
      this.audios = this.createAudios(this.params.items);
      this.audios.forEach((audio) => {
        if (audio) {
          content.append(audio.player);
        }
      });

      /*
       * Load images first before DOM is created; will help to prevent layout
       * problems in some cases.
       */
      const promises = [];
      this.params.items.forEach((item) => {
        promises.push(Images.loadImage(item.image, this.contentId));
      });
      Promise
        .all(promises)
        .then((results) => {
          this.images = results.map((item, index) => ({
            img: item,
            alt: this.params.items[index].image.params.alt,
            title: this.params.items[index].image.params.title,
            description: this.params.items[index].description
          }));

          // We can hide the spinner now
          this.spinner.hide();

          this.wrapper = document.createElement('div');
          this.wrapper.classList.add('h5p-agamotto-wrapper');
          content.appendChild(this.wrapper);

          // Title
          if (this.params.title) {
            this.title = document.createElement('div');
            this.title.classList.add('h5p-agamotto-title');
            this.title.innerHTML = `<h2>${this.params.title}</h2>`;
            this.wrapper.appendChild(this.title);
          }

          // Images
          this.images = new Images(this.images, this.params.behaviour.transparencyReplacementColor);
          this.wrapper.appendChild(this.images.getDOM());
          this.images.resize();

          // Slider
          const labelTexts = [];
          for (let i = 0; i <= this.maxItem; i++) {
            labelTexts[i] = this.params.items[i].labelText || '';
          }
          this.slider = new Slider({
            audio: this.hasAudio(),
            snap: this.params.behaviour.snap,
            ticks: this.params.behaviour.ticks,
            labels: this.params.behaviour.labels,
            labelTexts: labelTexts,
            altTitleTexts: this.images.getAltTitleTags(),
            startRatio: this.startImage / this.maxItem,
            size: this.maxItem,
            a11y: {
              image: this.params.a11y.image,
              imageSlider: this.params.a11y.imageSlider,
              mute: this.params.a11y.mute,
              unmute: this.params.a11y.unmute,
              buttonFullscreenEnter: this.params.a11y.buttonFullscreenEnter,
              buttonFullscreenExit: this.params.a11y.buttonFullscreenExit
            },
            selector: this.selector,
            parent: this
          }, {
            onButtonFullscreenClicked: () => {
              this.handleFullscreenClicked();
            }
          });

          this.wrapper.appendChild(this.slider.getDOM());
          this.slider.resize();

          // Descriptions
          if (this.hasDescription) {
            const descriptionTexts = [];
            for (let i = 0; i <= this.maxItem; i++) {
              descriptionTexts[i] = this.params.items[i].description;
            }
            this.descriptions = new Descriptions(descriptionTexts, this.selector, this, this.contentId);
            this.wrapper.appendChild(this.descriptions.getDOM());
            this.descriptions.resize();
            this.heightDescriptions = this.descriptions.offsetHeight;
          }
          else {
            this.heightDescriptions = 0;
          }

          // KeyListeners for Images that will allow to jump from one image to another
          this.imageContainer = this.images.getDOM ();

          // Focus slider so people can click on the image and use keyboard
          this.imageContainer.addEventListener('click', () => {
            this.slider.focus({ preventScroll: true });
          });

          // Trigger xAPI when starting to view content
          this.xAPIExperienced();

          this.slider.on('update', (event) => {
            /*
             * Map the slider value to the image indexes. Since we might not
             * want to initiate opacity shifts right away, we can add a margin to
             * the left and right of the slider where nothing happens
             */
            const margin = 5;
            const mappedValue = Util.project(
              event.data.position,
              0 + margin,
              this.slider.getWidth() - margin,
              0,
              this.maxItem
            );
            // Account for margin change and mapping outside the image indexes
            const topIndex = Util.constrain(Math.floor(mappedValue), 0, this.maxItem);

            /*
             * Using the cosine will allow an image to be displayed a little longer
             * before blending than a linear function
             */
            const linearOpacity = (1 - Util.constrain(mappedValue - topIndex, 0, 1));
            const topOpacity = 0.5 * (1 - Math.cos(Math.PI * linearOpacity));

            this.updateContent(topIndex, topOpacity);
          });

          // Detect audio muting
          this.slider.on('muted', () => {
            this.muted = true;
            this.stopAudios();
          });

          // Detect audio unmuting
          this.slider.on('unmuted', () => {
            this.muted = false;
            this.startAudio(this.currentAudioId);
          });

          this.on('resize', () => {
            this.handleResize();
          });

          // Add fullscreen listeners
          this.container = document.querySelector('.h5p-container');
          if (
            this.container && !this.noFullscreen &&
            this.isRoot() && H5P.fullscreenSupported
          ) {
            this.slider.enableFullscreenButton();

            this.on('enterFullScreen', () => {
              setTimeout(() => { // Needs time to get into fullscreen for window.innerHeight
                this.setFixedSize(true);
                this.slider.setFullScreenButtonTitle(true);
              }, 250);
            });

            this.on('exitFullScreen', () => {
              this.setFixedSize(false);
              this.slider.setFullScreenButtonTitle(false);
            });

            // Resize fullscreen dimensions when rotating screen
            window.addEventListener('orientationchange', () => {
              if (H5P.isFullscreen) {
                setTimeout(() => { // Needs time to rotate for window.innerHeight
                  this.setFixedSize(true);
                }, 250);
              }
              else {
                this.setFixedSize(false);
              }
            }, false);
          }

          this.trigger('resize');
        })
        .catch((error) => {
          console.warn(error);
        });

      return content;
    };

    /**
     * Handle resize.
     */
    this.handleResize = () => {
      /*
       * Decrease the size of the content if on a mobile device in landscape
       * orientation, because it might be hard to use it otherwise.
       * iOS devices don't switch screen.height and screen.width on rotation
       */
      if (Util.isMobileDevice() && Math.abs(window.orientation) === 90) {
        const determiningDimension = (/iPhone/.test(navigator.userAgent)) ? screen.width : screen.height;
        this.wrapper.style.width = Math.round((determiningDimension / 2) * this.images.getRatio()) + 'px';
      }
      else {
        // Portrait orientation
        this.wrapper.style.width = 'auto';
      }

      // Resize DOM elements
      this.images.resize();
      if (this.hasDescription) {
        this.descriptions.resize();
      }

      this.slider.resize();

      window.requestAnimationFrame(() => {
        // Keep Agamotto.RESIZE_REPETITIONS previous sizes
        this.previousSizes.push(this.images.getSize());
        if (this.previousSizes.length > Agamotto.RESIZE_REPETITIONS) {
          this.previousSizes.shift();
        }

        // Resize again if needed
        if (this.isResizeNeeded()) {
          clearTimeout(this.extraResize);
          this.extraResize = setTimeout(() => {
            this.trigger('resize');
          }, Agamotto.RESIZE_COOLING_PERIOD);
        }
      });
    };

    /**
     * Check if a resize is needed.
     *
     * @returns {boolean} True, if resize is required.
     */
    this.isResizeNeeded = () => {
      /*
       * Images need time to resize, and we resize again until
       * the size didn't yield Agamotto.RESIZE_REPETITIONS different
       * sizes in Agamotto.RESIZE_REPETITIONS retries - 3 to prevent
       * infinite resizes when scroll bar is added/removed
       * In case of problems when getting height 0, stop resize after
       * Agamotto.RESIZE_REPETITIONS_ZERO_HEIGHT attempts
       */

      // Check for minimal number of required resizes to be sure
      let resizeNeeded = this.previousSizes.length < Agamotto.RESIZE_REPETITIONS;

      // Check for height being 0
      if (!resizeNeeded) {
        resizeNeeded = this.previousSizes.some((size) => size.height === 0);
        if (resizeNeeded) {
          this.imagesRepeatedZeroHeight++;
        }
        else {
          this.imagesRepeatedZeroHeight = 0;
        }

        if (this.imagesRepeatedZeroHeight === Agamotto.RESIZE_REPETITIONS_ZERO_HEIGHT) {
          this.imagesRepeatedZeroHeight = 0;
          resizeNeeded = false; // Stop loop
        }
      }

      // Check for number of identical previous sizes
      if (!resizeNeeded) {
        const differentSizes = {};
        this.previousSizes
          .map((size) => `${size.width}|${size.height}`)
          .forEach((size) => {
            differentSizes[size] = true;
          });

        resizeNeeded = Object.keys(differentSizes).length === Agamotto.RESIZE_REPETITIONS;
      }

      return resizeNeeded;
    };

    /**
     * Create audio elements from items.
     *
     * @param {object[]} items Items from params.
     * @returns {object[]} Audio elements.
     */
    this.createAudios = (items) => {
      const audioElements = [];

      items.forEach((item) => {
        if (!item.audio || item.audio.length < 1 || !item.audio[0].path) {
          audioElements.push(null);
          return;
        }

        const player = document.createElement('audio');
        player.style.display = 'none';
        player.src = H5P.getPath(item.audio[0].path, this.contentId);
        audioElements.push({
          player: player,
          promise: null
        });
      });

      return audioElements;
    };

    /**
     * Detect whether there's at least one audio.
     *
     * @returns {boolean} True, if content has audio.
     */
    this.hasAudio = () => {
      return this.audios.some((audio) => audio !== null);
    };

    /**
     * Read contents to screen readers.
     *
     * @param {string} [intro] Optional intro text.
     */
    this.announceARIA = (intro) => {
      intro = (intro !== undefined) ? Util.htmlDecode(`${intro} `) : '';
      const descriptionText = (this.descriptions) ? this.descriptions.getCurrentDescriptionText() : '';
      let announcement = `${intro}${this.images.getCurrentAltTag()}. ${descriptionText}`;
      announcement = Util.stripHTML(announcement);
      // Use ARIA live region provided by H5P.Question
      this.read(announcement);
    };

    // Cmp. vocabulary of xAPI statements: http://xapi.vocab.pub/datasets/adl/

    /**
     * Trigger xAPI statement 'experienced' (when interaction encountered).
     */
    this.xAPIExperienced = () => {
      this.triggerXAPI('experienced');
    };

    /**
     * Trigger xAPI statement 'interacted' (when slider moved, keys released, or link clicked).
     */
    this.xAPIInteracted = () => {
      this.triggerXAPI('interacted');
    };

    /**
     * Trigger xAPI statement 'completed' (when all images have been viewed).
     */
    this.xAPICompleted = () => {
      if ((this.imagesViewed.length === this.params.items.length) && !this.completed) {
        this.triggerXAPI('completed');
        // Only trigger this once
        this.completed = true;
      }
    };

    /**
     * Get context data.
     * Contract used for confusion report.
     *
     * @returns {object} Context data.
     */
    this.getContext = () => {
      return {
        type: 'image',
        value: this.position + 1
      };
    };

    /**
     * Get the content type title.
     *
     * @returns {string} title.
     */
    this.getTitle = () => {
      return H5P.createTitle((this.extras.metadata && this.extras.metadata.title) ? this.extras.metadata.title : 'Agamotto');
    };

    /**
     * Handle fullscreen button clicked.
     */
    this.handleFullscreenClicked = () => {
      setTimeout(() => {
        this.toggleFullscreen();
      }, 300); // Some devices don't register user gesture before call to to requestFullscreen
    };

    /**
     * Toggle fullscreen button.
     *
     * @param {string|boolean} state enter|false for enter, exit|true for exit.
     */
    this.toggleFullscreen = (state) => {
      if (!this.container) {
        return;
      }

      if (typeof state === 'string') {
        if (state === 'enter') {
          state = false;
        }
        else if (state === 'exit') {
          state = true;
        }
      }

      if (typeof state !== 'boolean') {
        state = !H5P.isFullscreen;
      }

      if (state === true) {
        H5P.fullScreen(H5P.jQuery(this.container), this);
      }
      else {
        H5P.exitFullScreen();
      }
    };

    /**
     * Remove fullscreen button.
     */
    this.removeFullscreenButton = () => {
      if (!this.slider) { // Not yet instantiated
        this.noFullscreen = true;
        return;
      }
      this.slider.removeFullscreenButton();
    };

    /**
     * Fix height to current screen size.
     *
     * @param {boolean} state If true, fix height.
     */
    this.setFixedSize = (state) => {
      const images = this.images.getDOM();
      const slider = this.slider.getDOM();
      const descriptions = (this.descriptions) ? this.descriptions.getDOM() : null;

      // Reset values
      if (this.title) {
        this.title.style.maxWidth = '';
      }
      images.style.maxWidth = '';
      images.style.maxHeight = '';
      slider.style.maxWidth = '';
      if (descriptions) {
        descriptions.style.maxHeight = '';
        descriptions.style.maxWidth = '';
        descriptions.style.overflowY = '';
      }

      setTimeout(() => {
        if (state) {
          const headingHeight = (this.title) ? this.title.offsetHeight : 0;
          const sliderHeight = slider.offsetHeight;

          const maxHeight = window.innerHeight - 2 * this.wrapper.offsetTop - headingHeight - sliderHeight;
          let imagesMaxHeight = (descriptions) ? maxHeight * this.params.behaviour.imagesDescriptionsRatio / 100 : maxHeight;

          // Scale images down if required
          if (images.offsetHeight > imagesMaxHeight) {
            const maxWidth = `${imagesMaxHeight * images.offsetWidth / images.offsetHeight}px`;
            if (this.title) {
              this.title.style.maxWidth = maxWidth;
            }

            // Set maximum width to allow centering
            images.style.maxWidth = maxWidth;
            slider.style.maxWidth = maxWidth;
            if (descriptions) {
              descriptions.style.maxWidth = maxWidth;
            }
          }
          else {
            imagesMaxHeight = images.offsetHeight;
          }

          // Set maximum height for images + descriptions
          images.style.maxHeight = `${imagesMaxHeight}px`;
          if (descriptions && descriptions.offsetHeight > maxHeight - imagesMaxHeight) {
            descriptions.style.maxHeight = `${maxHeight - imagesMaxHeight}px`;
            descriptions.style.overflowY = 'auto';
          }
        }

        // Resize
        window.requestAnimationFrame(() => {
          this.slider.resize();
          this.images.resize();
          this.trigger('resize');
        });
      }, 0);
    };
  }

  /**
   * Remove missing items and limit amount.
   *
   * @param {object[]} items Items defined in semantics.org.
   * @returns {object[]} Sanitized items.
   */
  static sanitizeItems(items) {
    /*
     * Remove items with missing image an restrict to 50 images, because it
     * might become hard to differentiate more positions on the slider - and
     * a video to slide over might be more sensible anyway if you need more
     * frames.
     */
    items = items
      .filter((item) => {
        if (!item.image || !item.image.params || !item.image.params.file) {
          console.warn('An image is missing. I will continue without it, but please check your settings.');
          return false;
        }
        return true;
      })
      .splice(0, 50)
      .map((item) => {
        item.image.params.alt = item.image.params.alt || '';
        item.image.params.title = item.image.params.title || '';
        return item;
      });

    return items;
  }
}

/** @constant {string} */
Agamotto.DEFAULT_DESCRIPTION = 'Agamotto';

/** @constant {number} Cooldown period in ms to prevent infinite resizing */
Agamotto.RESIZE_COOLING_PERIOD = 75;

/** @constant {number} Number of consecutive identical resizes */
Agamotto.RESIZE_REPETITIONS = 3;

/** @constant {number} Number of maximum resizes with height zero */
Agamotto.RESIZE_REPETITIONS_ZERO_HEIGHT = 50;

export default Agamotto;
