class TabsComponent extends HTMLElement {
  constructor() {
    super();
    this.tabs = this.querySelectorAll('.tab-heading');
    this.tabs.forEach(tab => {
      tab.addEventListener('click', this.handleTabClick.bind(this, tab));
    });
  }

  handleTabClick(clickedTab) {
    if (!clickedTab.classList.contains('active')) {
      this.pauseAllIframes();
      const activeTab = this.querySelector('.tab-heading.active');
      const activeTabId = activeTab.dataset.id;
      const targetId = clickedTab.dataset.id;
      this.hideTab(activeTabId);
      this.showTab(targetId);
      this.querySelectorAll('.tab-heading.active').forEach((tab) => {
        tab.classList.remove('active');
      })
      this.querySelectorAll(`.tab-heading[data-id='${targetId}'`).forEach((tab) => {
        tab.classList.add('active');
      })
    }
  }

  hideTab(tabId) {
    this.querySelector(`.tab-detail[data-id='${tabId}']`).classList.remove('active');
  }

  showTab(tabId) {
    this.querySelector(`.tab-detail[data-id='${tabId}']`).classList.add('active');
  }

  pauseAllIframes() {
    this.iframes = this.querySelectorAll('iframe');
    this.iframes.forEach((iframe, key) => {
      iframe.outerHTML = this.iframes[key].outerHTML;
    });
  }
}

if (!customElements.get('tabs-component')) {
  customElements.define('tabs-component', TabsComponent);
}

if (!customElements.get('select-toggle')) {
  class SelectToggle extends HTMLElement {
    constructor() {
      super();
      this.summary = this.querySelector('.summary');
      this.details = this.querySelector('.details');
      this.summary.addEventListener('click', this.toggle.bind(this));
    }

    toggle() {
      if (this.classList.contains('active')) {
        this.details.style.maxHeight = 0;
      } else {
        this.details.style.maxHeight = this.details.scrollHeight + 'px';

        if (this.classList.contains('clickout-accordion')) {
          document.addEventListener('click', (e) => {
            if (!this.contains(e.target)) {
              this.details.style.maxHeight = 0;
              this.classList.remove('active');
            }
          }, false);
        }

        
      }
      this.classList.toggle('active');
    }


  }

  customElements.define('select-toggle', SelectToggle);
}