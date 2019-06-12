import Descriptions from './h5p-agamotto-descriptions';
import Images from './h5p-agamotto-images';
import Slider from './h5p-agamotto-slider';
import Spinner from './h5p-agamotto-spinner';
import Util from './h5p-agamotto-util';
import Promise from 'promise-polyfill';

/** Class for Agamotto interaction */
class Agamotto extends H5P.Question {
  /**
   * @constructor
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

    /*
     * Tribute to the weird behavior of H5P groups. Can be removed when a11y
     * gets more than one element and will be passed as an object, not a string.
     */
    if (typeof this.params.a11y === 'string') {
      this.params.a11y = {
        imageChanged: this.params.a11y
      };
    }

    // Set default values
    this.params = Util.extend({
      items: [],
      behaviour: {
        snap: true,
        ticks: false,
        labels: false,
        transparencyReplacementColor: '#000000'
      },
      a11y: {
        imageChanged: 'Image changed'
      }
    }, this.params);

    this.extras = contentData;

    this.maxItem = this.params.items.length - 1;
    this.selector = '.h5p-agamotto-wrapper';

    // Set hasDescription = true if at least one item has a description
    this.hasDescription = this.params.items.some(item => item.description !== '');

    this.id = contentId;

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
     * @param {number} index Index of top image.
     * @param {number} opacity Opacity of top image.
     */
    this.updateContent = (index, opacity) => {
      // Limit updates for performance reasons, will be a little jumpy though
      opacity = Math.round(opacity * 10) / 10;
      if (opacity === this.images.getTopOpacity() && (opacity !== 1 || this.position === index)) {
        return;
      }

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

      // Read contents to readspeakers when image changed
      if (
        this.slider.isUsed() && opacity === 0.5 ||
        !this.slider.isUsed() && (opacity === 0 || opacity === 1)
      ) {
        this.announceARIA(this.params.a11y.imageChanged);
      }
    };

    /**
     * Register the DOM elements with H5P.Question.
     */
    this.registerDomElements = () => {
      this.setContent(this.createDOM());
    };

    /**
     * Create the DOM.
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

      /*
       * Load images first before DOM is created; will help to prevent layout
       * problems in some cases.
       */
      const promises = [];
      this.params.items.forEach(item => {
        promises.push(Images.loadImage(item.image, this.id));
      });
      Promise.all(promises).then(results => {
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
        this.wrapper.classList.add('h5p-agamotto-passepartout-horizontal');
        this.wrapper.classList.add('h5p-agamotto-passepartout-top');
        this.wrapper.classList.add('h5p-agamotto-passepartout-bottom');
        content.appendChild(this.wrapper);

        // Title
        if (this.params.title) {
          const title = document.createElement('div');
          title.classList.add('h5p-agamotto-title');
          title.innerHTML = `<h2>${this.params.title}</h2>`;
          this.wrapper.appendChild(title);
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
          snap: this.params.behaviour.snap,
          ticks: this.params.behaviour.ticks,
          labels: this.params.behaviour.labels,
          labelTexts: labelTexts,
          size: this.maxItem
        }, this.selector, this);
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
          this.descriptions.adjustHeight();
          // Passepartout at the bottom is not needed, because we have a description
          this.wrapper.classList.remove('h5p-agamotto-passepartout-bottom');
          this.heightDescriptions = this.descriptions.offsetHeight;
        }
        else {
          this.heightDescriptions = 0;
        }

        // Add passepartout depending on the combination of elements
        if (this.params.showTitle) {
          // Passepartout at the top is not needed, because we have a title
          this.wrapper.classList.remove('h5p-agamotto-passepartout-top');
        }
        else if (!this.hasDescription) {
          // No passepartout is needed at all, because we just have an image
          this.wrapper.classList.remove('h5p-agamotto-passepartout-horizontal');
          this.wrapper.classList.remove('h5p-agamotto-passepartout-top');
          this.wrapper.classList.remove('h5p-agamotto-passepartout-bottom');
        }

        // KeyListeners for Images that will allow to jump from one image to another
        this.imageContainer = this.images.getDOM ();

        // Trigger xAPI when starting to view content
        this.xAPIExperienced();

        this.slider.on('update', event => {
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

        // Add Resize Handler
        window.addEventListener('resize', () => {
          // Prevent infinite resize loops
          if (!this.resizeCooling) {
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
            this.slider.resize();
            // The descriptions will get a scroll bar via CSS if necessary, no resize needed
            this.trigger('resize');

            this.resizeCooling = setTimeout(() => {
              this.resizeCooling = null;
            }, Agamotto.RESIZE_COOLING_PERIOD);
          }
        });

        this.trigger('resize');
      });

      return content;
    };

    /**
     * Read contents to screen readers.
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
     * Get the content type title.
     * @return {string} title.
     */
    this.getTitle = () => {
      return H5P.createTitle((this.extras.metadata && this.extras.metadata.title) ? this.extras.metadata.title : 'Agamotto');
    };
  }

  /**
   * Remove missing items and limit amount.
   * @param {object[]} items Items defined in semantics.org.
   * @return {object[]} Sanitized items.
   */
  static sanitizeItems(items) {
    /*
     * Remove items with missing image an restrict to 50 images, because it
     * might become hard to differentiate more positions on the slider - and
     * a video to slide over might be more sensible anyway if you need more
     * frames.
     */
    items = items
      .filter(item => {
        if (!item.image || !item.image.params || !item.image.params.file) {
          console.warn('An image is missing. I will continue without it, but please check your settings.');
          return false;
        }
        return true;
      })
      .splice(0, 50)
      .map(item => {
        item.image.params.alt = item.image.params.alt || '';
        item.image.params.title = item.image.params.title || '';
        return item;
      });

    return items;
  }
}

/** @constant {string} */
Agamotto.DEFAULT_DESCRIPTION = 'Agamotto';

/** @constant {string} Cooldown period in ms to prevent infinite resizing */
Agamotto.RESIZE_COOLING_PERIOD = 50;

export default Agamotto;
