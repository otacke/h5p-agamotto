import Promise from 'core-js/features/promise';
import Util from './h5p-agamotto-util';
import { detect } from 'detect-browser';

/** Class representing Images */
class Images {
  /**
   * Images object
   *
   * @class Images
   * @param {object[]} images Array containing the images.
   * @param {string} transparencyReplacementColor Replacement color for transparency.
   */
  constructor(images, transparencyReplacementColor = '#000000') {
    this.images = images;

    // Sanitize properties
    this.images.map((image) => {
      image.alt = Util.stripHTML(image.alt);
      image.title = Util.stripHTML(image.title);
      image.description = Util.stripHTML(image.description);
    });

    this.ratio = this.images[0].img.naturalWidth / this.images[0].img.naturalHeight;

    /*
     * Users might use images with different aspect ratios -- I learned that the hard way ;-)
     * Use the dimensions of the first image, resize the others and add a black border if necessary.
     * We need the black border in the image because of the blending transition. We also need
     * it for images with transparency.
     */
    const firstMaxX = this.images[0].img.naturalWidth;
    const firstMaxY = this.images[0].img.naturalHeight;
    for (let i = 0; i < this.images.length; i++) {
      let maxX = firstMaxX;
      let maxY = firstMaxY;
      let imgX = this.images[i].img.naturalWidth;
      let imgY = this.images[i].img.naturalHeight;

      // Scale image.
      if ((imgX / imgY < this.ratio) && (imgY > maxY)) {
        imgY = maxY;
        imgX *= maxY / this.images[i].img.naturalHeight;
      }
      if ((imgX / imgY > this.ratio) && (imgX > maxX)) {
        imgX = maxX;
        imgY *= maxX / this.images[i].img.naturalWidth;
      }
      if ((imgX / imgY === this.ratio)) {
        maxX = Math.max(maxX, imgX);
        maxY = Math.max(maxY, imgY);
      }

      // Compute offset for centering.
      const offsetX = Util.constrain((maxX - imgX) / 2, 0, maxX);
      const offsetY = Util.constrain((maxY - imgY) / 2, 0, maxY);

      // Create scaled image with background.
      const imageCanvas = document.createElement('canvas');
      imageCanvas.setAttribute('width', maxX);
      imageCanvas.setAttribute('height', maxY);
      const imageCtx = imageCanvas.getContext('2d');
      imageCtx.beginPath();
      imageCtx.rect(0, 0, maxX, maxY);
      imageCtx.fillStyle = transparencyReplacementColor;
      imageCtx.fill();
      imageCtx.drawImage(this.images[i].img, offsetX, offsetY, imgX, imgY);

      // Replace the old image.
      const image = new Image();

      // This is necessary to prevent security errors in some cases.
      const src = imageCanvas.toDataURL('image/jpeg');

      if (src.length <= 6) {
        /*
         * toDataURL requires images on iOS to have a maximum size of 3 megapixels
         * for devices with less than 256 MB RAM and 5 megapixels for devices with
         * greater or equal than 256 MB RAM
         */
        if ((detect().name || '').toLowerCase() === 'ios') {
          const pixelCount = this.images[i].img.naturalWidth * this.images[i].img.naturalHeight;
          if (pixelCount > Images.FIVE_MEGAPIXELS) {
            console.warn('Browsers on iOS may have a limitation that prevents Agamotto to use images larger than 5 megapixels. Please scale down images.');
          }
          else if (pixelCount > Images.THREE_MEGAPIXELS) {
            console.warn('Browsers on iOS may have a limitation that prevents Agamotto to use images larger than 3 megapixels. Please scale down images.');
          }
        }
      }

      image.crossOrigin = this.images[i].img.crossOrigin; // Use the same crossOrigin policy as the inital load used.
      image.src = src;
      this.images[i].img = image;
    }

    // Create DOM
    this.imageTop = document.createElement('img');
    this.imageTop.classList.add('h5p-agamotto-image-top');
    this.imageTop.src = images[0].img.src;
    this.imageTop.setAttribute('draggable', 'false');
    this.imageTop.setAttribute('alt', this.images[0].alt);
    this.imageTop.setAttribute('title', this.images[0].title);
    this.imageTop.setAttribute('aria-label', (this.images[0].alt !== '') ?
      `${images[0].alt}. ${this.images[0].description}` :
      this.images[0].description
    );

    this.imageBottom = document.createElement('img');
    this.imageBottom.classList.add('h5p-agamotto-image-bottom');
    this.imageBottom.src = this.images[1].img.src;
    this.imageBottom.setAttribute('draggable', 'false');
    this.imageBottom.setAttribute('aria-hidden', true);

    this.container = document.createElement('div');

    this.container.classList.add('h5p-agamotto-images-container');
    this.container.appendChild(this.imageTop);
    this.container.appendChild(this.imageBottom);
  }

  /**
   * Get the DOM elements.
   *
   * @returns {HTMLElement} The DOM elements.
   */
  getDOM() {
    return this.container;
  }

  /**
   * Get ALT tag of currently visible image.
   *
   * @returns {string} ALT tag of currently visible image.
   */
  getCurrentAltTag() {
    return this.imageTop.getAttribute('alt');
  }

  /**
   * Get all alt tags or title tags as alternative.
   *
   * @returns {object[]} Alt tags or title texts.
.
   */
  getAltTitleTags() {
    return this.images.map((image) => image.alt || image.title);
  }

  /**
   * Set the visible image combination.
   *
   * @param {number} index Image index.
   * @param {number} opacity Image opacity, [0..1].
   */
  setImage(index, opacity) {
    const visibleImageIndex = Util.constrain(index + Math.round(1 - opacity), 0, this.images.length - 1);
    this.imageBottom.src = this.images[Util.constrain(index + 1, 0, this.images.length - 1)].img.src;
    this.imageTop.src = this.images[index].img.src;
    this.imageTop.setAttribute('alt', this.images[visibleImageIndex].alt);
    this.imageTop.setAttribute('title', this.images[visibleImageIndex].title);
    this.imageTop.setAttribute('aria-label', (this.images[visibleImageIndex].alt !== '') ?
      `${this.images[visibleImageIndex].alt}. ${this.images[visibleImageIndex].description}` :
      this.images[visibleImageIndex].description
    );
    this.imageTop.style.opacity = opacity;
  }

  /**
   * Resize the images.
   */
  resize() {
    setTimeout(() => {
      this.container.style.height = this.container.offsetWidth / this.ratio + 'px';
    }, 0);
  }

  /**
   * Get image size.
   *
   * @returns {object} Size.
   */
  getSize() {
    return {
      width: this.container.offsetWidth,
      height: this.container.offsetHeight
    };
  }

  /**
   * Get the image ratio.
   *
   * @returns {number} Image ratio.
   */
  getRatio() {
    return this.ratio;
  }

  /**
   * Get opacity of top image.
   *
   * @returns {number} Opacity of top image.
   */
  getTopOpacity() {
    return parseFloat(this.imageTop.style.opacity || '');
  }

  /**
   * Load an Image.
   *
   * @param {object} imageObject Image object.
   * @param {number} id H5P ID.
   * @returns {Promise} Promise for image being loaded.
   */
  static loadImage(imageObject, id) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve(image);
      };
      image.onerror = (error) => {
        reject(error);
      };

      if (H5P.setSource !== undefined) {
        H5P.setSource(image, imageObject.params.file, id);
      }
      else {
        // Backwards compatibiltiy (H5P Core <v1.22)
        const src = H5P.getPath(imageObject.params.file.path, id);
        image.crossOrigin = (H5P.getCrossOrigin !== undefined ? H5P.getCrossOrigin(src) : 'Anonymous');
        image.src = src;
      }
    });
  }
}

/** @constant {number} Pixels in images with three megapixels */
Images.THREE_MEGAPIXELS = 2952192;

/** @constant {number} Pixels in images with five megapixels */
Images.FIVE_MEGAPIXELS = 4915200;

export default Images;
