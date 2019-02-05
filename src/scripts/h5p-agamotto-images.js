import Promise from 'promise-polyfill';
import Util from './h5p-agamotto-util';

/** Class representing Images */
class Images {
  /**
   * Images object
   *
   * @class Images
   * @param {Object} images - Array containing the images.
   */
  constructor(images) {
    this.images = images;

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
      let imgX = images[i].img.naturalWidth;
      let imgY = images[i].img.naturalHeight;

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

      // Create scaled image with black border.
      const imageCanvas = document.createElement('canvas');
      imageCanvas.setAttribute('width', maxX);
      imageCanvas.setAttribute('height', maxY);
      const imageCtx = imageCanvas.getContext('2d');
      imageCtx.beginPath();
      imageCtx.rect(0, 0, maxX, maxY);
      imageCtx.fillStyle = 'black';
      imageCtx.fill();
      imageCtx.drawImage(this.images[i].img, offsetX, offsetY, imgX, imgY);

      // Replace the old image.
      const image = new Image();

      // This is necessary to prevent security errors in some cases.
      const src = imageCanvas.toDataURL('image/jpeg');
      image.crossOrigin = (H5P.getCrossOrigin !== undefined ? H5P.getCrossOrigin(src) : 'Anonymous');
      image.src = src;
      this.images[i].img = image;
    }

    // Create DOM
    this.imageTop = document.createElement('img');
    this.imageTop.classList.add('h5p-agamotto-image-top');
    this.imageTop.src = images[0].img.src;
    this.imageTop.setAttribute('draggable', 'false');
    this.imageTop.setAttribute('alt', images[0].alt);
    this.imageTop.setAttribute('title', images[0].title);
    this.imageTop.setAttribute('aria-live', 'polite');
    this.imageTop.setAttribute('tabindex', 0);

    this.imageBottom = document.createElement('img');
    this.imageBottom.classList.add('h5p-agamotto-image-bottom');
    this.imageBottom.src = images[1].img.src;
    this.imageBottom.setAttribute('draggable', 'false');

    this.container = document.createElement('div');

    this.container.classList.add('h5p-agamotto-images-container');
    this.container.appendChild(this.imageTop);
    this.container.appendChild(this.imageBottom);
  }

  /**
   * Get the DOM elements.
   * @return {object} The DOM elements.
   */
  getDOM() {
    return this.container;
  }
  /**
   * Set the visible image combination.
   * @param {number} index - Image index.
   * @param {number} opacity - Image opacity, [0..1].
   */
  setImage(index, opacity) {
    const visibleImageIndex = Math.min(this.images.length - 1, index + Math.round((1 - opacity)));
    this.imageTop.src = this.images[index].img.src;
    this.imageTop.setAttribute('alt', this.images[visibleImageIndex].alt);
    this.imageTop.setAttribute('title', this.images[visibleImageIndex].title);
    this.imageTop.style.opacity = opacity;
    this.imageBottom.src = this.images[Util.constrain(index + 1, 0, this.images.length - 1)].img.src;
    this.imageTop.setAttribute('aria-label', this.images[visibleImageIndex].alt);
  }

  /**
   * Resize the images.
   * @return {boolean} True if the height of the container changed.
   */
  resize() {
    const oldHeight = this.container.style.height;
    this.container.style.height = this.container.offsetWidth / this.ratio + 'px';
    return this.container.style.height !== oldHeight;
  }

  /**
   * Get the image ratio.
   * @return {number} Image ratio.
   */
  getRatio() {
    return this.ratio;
  }

  /**
   * Load an Image.
   * @param {string} imageObject - Image object.
   * @param {number} id - H5P ID.
   * @return {Promise} Promise for image being loaded.
   */
  static loadImage(imageObject, id) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const src = H5P.getPath(imageObject.params.file.path, id);
      image.crossOrigin = (H5P.getCrossOrigin !== undefined ? H5P.getCrossOrigin(src) : 'Anonymous');
      image.onload = () => {
        resolve(image);
      };
      image.onerror = (error) => {
        reject(error);
      };
      image.src = src;
    });
  }
}

export default Images;
