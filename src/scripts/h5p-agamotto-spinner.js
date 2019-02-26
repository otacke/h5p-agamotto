/** Class for an activity indicator aka spinner */
class Spinner {
  /**
   * Constructor.
   * @param {string} classNameBase Class name base to define spinner visuals.
   */
  constructor(classNameBase) {
    this.container = document.createElement('div');
    this.container.classList.add(`${classNameBase}-container`);

    this.spinnerElement = document.createElement('div');
    this.spinnerElement.classList.add(classNameBase);
    this.spinnerElement.innerHTML = '<div></div><div></div><div></div><div></div>';

    this.container.appendChild(this.spinnerElement);
  }

  /**
   * Get the DOM.
   * @return {HTMLElement} Spinner container.
   */
  getDOM() {
    return this.container;
  }

  /**
   * Show spinner.
   */
  show() {
    this.container.classList.remove('h5p-agamotto-spinner-none');
  }

  /**
   * Hide spinner.
   */
  hide() {
    this.container.classList.add('h5p-agamotto-spinner-none');
  }
}

export default Spinner;
