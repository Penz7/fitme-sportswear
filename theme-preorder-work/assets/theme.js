var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// js/common/utilities/country-selector.js
var CountrySelector = class extends HTMLElement {
  constructor() {
    super();
    this._onCountryChangedListener = this._onCountryChanged.bind(this);
  }
  connectedCallback() {
    this.countryElement = this.querySelector('[name="address[country]"]');
    this.provinceElement = this.querySelector('[name="address[province]"]');
    this.countryElement.addEventListener("change", this._onCountryChangedListener);
    if (this.hasAttribute("country") && this.getAttribute("country") !== "") {
      this.countryElement.selectedIndex = Math.max(0, Array.from(this.countryElement.options).findIndex((option) => option.textContent === this.getAttribute("country")));
      this.countryElement.dispatchEvent(new Event("change"));
    } else {
      this._onCountryChanged();
    }
  }
  disconnectedCallback() {
    this.countryElement.removeEventListener("change", this._onCountryChangedListener);
  }
  _onCountryChanged() {
    const option = this.countryElement.options[this.countryElement.selectedIndex], provinces = JSON.parse(option.getAttribute("data-provinces"));
    this.provinceElement.parentElement.hidden = provinces.length === 0;
    if (provinces.length === 0) {
      return;
    }
    this.provinceElement.innerHTML = "";
    provinces.forEach((data) => {
      const selected = data[1] === this.getAttribute("province");
      this.provinceElement.options.add(new Option(data[1], data[0], selected, selected));
    });
  }
};
if (!window.customElements.get("country-selector")) {
  window.customElements.define("country-selector", CountrySelector);
}

// js/common/utilities/cached-fetch.js
var cachedMap = /* @__PURE__ */ new Map();
function cachedFetch(url, options) {
  const cacheKey = url;
  if (cachedMap.has(cacheKey)) {
    return Promise.resolve(new Response(new Blob([cachedMap.get(cacheKey)])));
  }
  return fetch(url, options).then((response) => {
    if (response.status === 200) {
      const contentType = response.headers.get("Content-Type");
      if (contentType && (contentType.match(/application\/json/i) || contentType.match(/text\//i))) {
        response.clone().text().then((content) => {
          cachedMap.set(cacheKey, content);
        });
      }
    }
    return response;
  });
}

// js/common/utilities/extract-section-id.js
function extractSectionId(element) {
  element = element.classList.contains("shopify-section") ? element : element.closest(".shopify-section");
  return element.id.replace("shopify-section-", "");
}

// js/common/utilities/dom.js
function deepQuerySelector(root, selector) {
  let element = root.querySelector(selector);
  if (element) {
    return element;
  }
  for (const template2 of root.querySelectorAll("template")) {
    element = deepQuerySelector(template2.content, selector);
    if (element) {
      return element;
    }
  }
  return null;
}
function throttle(callback) {
  let requestId = null, lastArgs;
  const later = (context) => () => {
    requestId = null;
    callback.apply(context, lastArgs);
  };
  const throttled = (...args) => {
    lastArgs = args;
    if (requestId === null) {
      requestId = requestAnimationFrame(later(this));
    }
  };
  throttled.cancel = () => {
    cancelAnimationFrame(requestId);
    requestId = null;
  };
  return throttled;
}
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
function waitForEvent(element, eventName) {
  return new Promise((resolve) => {
    const done = (event) => {
      if (event.target === element) {
        element.removeEventListener(eventName, done);
        resolve(event);
      }
    };
    element.addEventListener(eventName, done);
  });
}

// js/common/utilities/player.js
var _callback, _duration, _remainingTime, _startTime, _timer, _state, _onVisibilityChangeListener, _Player_instances, onVisibilityChange_fn;
var Player = class extends EventTarget {
  constructor(durationInSec, stopOnVisibility = true) {
    super();
    __privateAdd(this, _Player_instances);
    __privateAdd(this, _callback);
    __privateAdd(this, _duration);
    __privateAdd(this, _remainingTime);
    __privateAdd(this, _startTime);
    __privateAdd(this, _timer);
    __privateAdd(this, _state, "paused");
    __privateAdd(this, _onVisibilityChangeListener, __privateMethod(this, _Player_instances, onVisibilityChange_fn).bind(this));
    __privateSet(this, _callback, () => this.dispatchEvent(new CustomEvent("player:end")));
    this.setDuration(durationInSec);
    if (stopOnVisibility) {
      document.addEventListener("visibilitychange", __privateGet(this, _onVisibilityChangeListener));
    }
  }
  getDuration() {
    return __privateGet(this, _duration) / 1e3;
  }
  setDuration(durationInSec) {
    __privateSet(this, _duration, __privateSet(this, _remainingTime, durationInSec * 1e3));
  }
  pause() {
    if (__privateGet(this, _state) !== "started") {
      return;
    }
    clearTimeout(__privateGet(this, _timer));
    __privateSet(this, _state, "paused");
    __privateSet(this, _remainingTime, __privateGet(this, _remainingTime) - ((/* @__PURE__ */ new Date()).getTime() - __privateGet(this, _startTime)));
    this.dispatchEvent(new CustomEvent("player:pause", { detail: { duration: __privateGet(this, _duration) / 1e3, remainingTime: __privateGet(this, _remainingTime) / 1e3 } }));
  }
  resume(restartTimer = false) {
    if (__privateGet(this, _state) !== "stopped") {
      if (restartTimer) {
        this.start();
      } else {
        clearTimeout(__privateGet(this, _timer));
        __privateSet(this, _startTime, (/* @__PURE__ */ new Date()).getTime());
        __privateSet(this, _state, "started");
        __privateSet(this, _timer, setTimeout(__privateGet(this, _callback), __privateGet(this, _remainingTime)));
        this.dispatchEvent(new CustomEvent("player:resume", { detail: { duration: __privateGet(this, _duration) / 1e3, remainingTime: __privateGet(this, _remainingTime) / 1e3 } }));
      }
    }
  }
  start() {
    clearTimeout(__privateGet(this, _timer));
    __privateSet(this, _startTime, (/* @__PURE__ */ new Date()).getTime());
    __privateSet(this, _state, "started");
    __privateSet(this, _remainingTime, __privateGet(this, _duration));
    __privateSet(this, _timer, setTimeout(__privateGet(this, _callback), __privateGet(this, _remainingTime)));
    this.dispatchEvent(new CustomEvent("player:start", { detail: { duration: __privateGet(this, _duration) / 1e3, remainingTime: __privateGet(this, _remainingTime) / 1e3 } }));
  }
  stop() {
    clearTimeout(__privateGet(this, _timer));
    __privateSet(this, _state, "stopped");
    this.dispatchEvent(new CustomEvent("player:stop"));
  }
};
_callback = new WeakMap();
_duration = new WeakMap();
_remainingTime = new WeakMap();
_startTime = new WeakMap();
_timer = new WeakMap();
_state = new WeakMap();
_onVisibilityChangeListener = new WeakMap();
_Player_instances = new WeakSet();
onVisibilityChange_fn = function() {
  if (document.visibilityState === "hidden") {
    this.pause();
  } else if (document.visibilityState === "visible") {
    this.resume();
  }
};

// js/common/utilities/accessibility.js
function announceText(holderId, message) {
  const holder = document.getElementById(holderId);
  holder.textContent = "";
  setTimeout(() => {
    holder.textContent = message;
  }, 100);
}
function announceStatus(message) {
  announceText("status-announcement", message);
}
function announceError(message) {
  announceText("error-announcement", message);
}

// js/common/actions/confirm-button.js
var ConfirmButton = class extends HTMLButtonElement {
  constructor() {
    super();
    this.addEventListener("click", (event) => {
      if (!window.confirm(this.getAttribute("data-message") ?? "Are you sure you wish to do this?")) {
        event.preventDefault();
      }
    });
  }
};
if (!window.customElements.get("confirm-button")) {
  window.customElements.define("confirm-button", ConfirmButton, { extends: "button" });
}

// js/common/actions/controls.js
var PageDots = class extends HTMLElement {
  connectedCallback() {
    this._abortController = new AbortController();
    this.items = Array.from(this.children);
    this.items.forEach((button, index) => button.addEventListener("click", () => this.select(index), { signal: this._abortController.signal }));
    this.addEventListener("control:filter", this._filterItems, { signal: this._abortController.signal });
    if (this.controlledElement) {
      this.controlledElement.addEventListener("carousel:change", (event) => this.select(event.detail.index, false), { signal: this._abortController.signal });
    }
    if (Shopify.designMode) {
      this.addEventListener("shopify:block:select", (event) => this.select(this.items.indexOf(event.target)));
    }
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  get controlledElement() {
    return this.hasAttribute("aria-controls") ? document.getElementById(this.getAttribute("aria-controls")) : null;
  }
  get selectedIndex() {
    return this.items.findIndex((button) => button.getAttribute("aria-current") === "true");
  }
  select(selectedIndex, dispatchEvent = true) {
    if (this.hasAttribute("align-selected")) {
      const scrollElement = this.getAttribute("align-selected") !== "" ? this.closest(this.getAttribute("align-selected")) : this;
      scrollElement.scrollTo({
        left: this.items[selectedIndex].offsetLeft - scrollElement.clientWidth / 2 + this.items[selectedIndex].clientWidth / 2,
        top: this.items[selectedIndex].offsetTop - scrollElement.clientHeight / 2 - this.items[selectedIndex].clientHeight / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: no-preference)").matches ? "smooth" : "auto"
      });
    }
    if (this.selectedIndex === selectedIndex) {
      return;
    }
    this.items.forEach((button, index) => button.setAttribute("aria-current", selectedIndex === index ? "true" : "false"));
    if (dispatchEvent) {
      this._dispatchEvent(selectedIndex);
    }
  }
  _filterItems(event) {
    this.items.forEach((item, index) => item.hidden = event.detail.filteredIndexes.includes(index));
  }
  _dispatchEvent(index) {
    (this.controlledElement ?? this).dispatchEvent(new CustomEvent("control:select", { bubbles: true, cancelable: true, detail: { index } }));
  }
};
var PrevButton = class extends HTMLButtonElement {
  connectedCallback() {
    this._abortController = new AbortController();
    this.addEventListener("click", () => (this.controlledElement ?? this).dispatchEvent(new CustomEvent("control:prev", { bubbles: true, cancelable: true })), { signal: this._abortController.signal });
    if (this.controlledElement) {
      this.controlledElement.addEventListener("scroll:edge-nearing", (event) => this.disabled = event.detail.position === "start", { signal: this._abortController.signal });
      this.controlledElement.addEventListener("scroll:edge-leaving", (event) => this.disabled = event.detail.position === "start" ? false : this.disabled, { signal: this._abortController.signal });
    }
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  get controlledElement() {
    return this.hasAttribute("aria-controls") ? document.getElementById(this.getAttribute("aria-controls")) : null;
  }
};
var NextButton = class extends HTMLButtonElement {
  connectedCallback() {
    this._abortController = new AbortController();
    this.addEventListener("click", () => (this.controlledElement ?? this).dispatchEvent(new CustomEvent("control:next", { bubbles: true, cancelable: true })), { signal: this._abortController.signal });
    if (this.controlledElement) {
      this.controlledElement.addEventListener("scroll:edge-nearing", (event) => this.disabled = event.detail.position === "end", { signal: this._abortController.signal });
      this.controlledElement.addEventListener("scroll:edge-leaving", (event) => this.disabled = event.detail.position === "end" ? false : this.disabled, { signal: this._abortController.signal });
    }
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  get controlledElement() {
    return this.hasAttribute("aria-controls") ? document.getElementById(this.getAttribute("aria-controls")) : null;
  }
};
if (!window.customElements.get("page-dots")) {
  window.customElements.define("page-dots", PageDots);
}
if (!window.customElements.get("prev-button")) {
  window.customElements.define("prev-button", PrevButton, { extends: "button" });
}
if (!window.customElements.get("next-button")) {
  window.customElements.define("next-button", NextButton, { extends: "button" });
}

// js/common/actions/copy-button.js
import { timeline } from "vendor";
var CopyButton = class extends HTMLButtonElement {
  constructor() {
    super();
    this.append(this.contentElement, this.animationElement);
    this.addEventListener("click", this._copyToClipboard.bind(this));
  }
  get contentElement() {
    if (this._contentElement) {
      return this._contentElement;
    }
    this._contentElement = document.createElement("div");
    this._contentElement.append(...this.childNodes);
    return this._contentElement = this._contentElement || document.createElement("div").append();
  }
  get animationElement() {
    return this._animationElement = this._animationElement || document.createRange().createContextualFragment(`
      <span class="button__feedback">  
        <svg role="presentation" focusable="false" fill="none" width="18px" height="18px" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/>
          <path d="m6 9.8 2.63 2.8L14 7" stroke="currentColor" stroke-width="2"/>
        </svg>
      </span>
    `).firstElementChild;
  }
  async _copyToClipboard() {
    if (!navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(this.getAttribute("data-text") || "");
    timeline([
      [this.contentElement, { y: ["translateY(0)", "translateY(-10px)"], opacity: 0 }, { duration: 0.15 }],
      [this.animationElement, { transform: ["translateY(10px)", "translateY(0)"], opacity: [0, 1] }, { duration: 0.15 }],
      [this.animationElement, { transform: ["translateY(0)", "translateY(-10px)"], opacity: 0 }, { duration: 0.15, at: "+0.5" }],
      [this.contentElement, { transform: ["translateY(10px)", "translateY(0)"], opacity: 1 }, { duration: 0.15 }]
    ]);
  }
};
if (!window.customElements.get("copy-button")) {
  window.customElements.define("copy-button", CopyButton, { extends: "button" });
}

// js/common/actions/custom-button.js
import { animate, timeline as timeline2, stagger } from "vendor";
var CustomButton = class extends HTMLButtonElement {
  static get observedAttributes() {
    return ["aria-busy"];
  }
  constructor() {
    super();
    if (this.type === "submit" && this.form) {
      this.form.addEventListener("submit", () => this.setAttribute("aria-busy", "true"));
    }
    this.append(this.contentElement, this.animationElement);
    window.addEventListener("pageshow", () => this.removeAttribute("aria-busy"));
  }
  get contentElement() {
    if (this._contentElement) {
      return this._contentElement;
    }
    this._contentElement = document.createElement("div");
    this._contentElement.append(...this.childNodes);
    return this._contentElement = this._contentElement || document.createElement("div").append();
  }
  get animationElement() {
    return this._animationElement = this._animationElement || document.createRange().createContextualFragment(`
      <span class="button__loader">
        <span></span>
        <span></span>
        <span></span>
      </span>
    `).firstElementChild;
  }
  async attributeChangedCallback(name, oldValue, newValue) {
    if (newValue === "true") {
      timeline2([
        [this.contentElement, { transform: ["translateY(0)", "translateY(-10px)"], opacity: 0 }, { duration: 0.15 }],
        [this.animationElement, { transform: ["translateY(10px)", "translateY(0)"], opacity: 1 }, { duration: 0.15 }]
      ]);
      animate(this.animationElement.children, { opacity: [1, 0.1] }, { duration: 0.35, delay: stagger(0.35 / 3), direction: "alternate", repeat: Infinity });
    } else {
      timeline2([
        [this.animationElement, { transform: ["translateY(0)", "translateY(-10px)"], opacity: 0 }, { duration: 0.15 }],
        [this.contentElement, { transform: ["translateY(10px)", "translateY(0)"], opacity: 1 }, { duration: 0.15 }]
      ]);
    }
  }
};
if (!window.customElements.get("custom-button")) {
  window.customElements.define("custom-button", CustomButton, { extends: "button" });
}

// js/common/actions/share-button.js
var ShareButton = class extends HTMLButtonElement {
  constructor() {
    super();
    if (navigator.share) {
      this.addEventListener("click", this._showSystemShare);
    }
  }
  _showSystemShare() {
    navigator.share({
      title: this.hasAttribute("share-title") ? this.getAttribute("share-title") : document.title,
      url: this.hasAttribute("share-url") ? this.getAttribute("share-url") : window.location.href
    });
  }
};
if (!window.customElements.get("share-button")) {
  window.customElements.define("share-button", ShareButton, { extends: "button" });
}

// js/common/animation/heading.js
import { stagger as stagger2 } from "vendor";
function getHeadingKeyframe(element, options = {}) {
  if (!element) {
    return [];
  }
  const splitLines = element.querySelector("split-lines")?.lines;
  if (window.themeVariables.settings.headingApparition === "fade" || !splitLines) {
    return [element, { opacity: [0, 1] }, { duration: 0.2, ...options }];
  } else {
    element.style.opacity = "1";
    switch (window.themeVariables.settings.headingApparition) {
      case "split_fade":
        return [splitLines, { transform: ["translateY(0.5em)", "translateY(0)"], opacity: [0, 1] }, { duration: 0.3, delay: stagger2(0.1), ...options }];
      case "split_clip":
        return [splitLines, { clipPath: ["inset(0 0 100% 0)", "inset(0 0 -0.3em 0)"], transform: ["translateY(100%)", "translateY(0)"], opacity: [0, 1] }, { duration: 0.7, delay: stagger2(0.15), easing: [0.22, 1, 0.36, 1], ...options }];
      case "split_rotation":
        const rotatedSpans = splitLines.map((line) => line.querySelector("span"));
        rotatedSpans.forEach((span) => span.style.transformOrigin = "top left");
        splitLines.forEach((line) => line.style.clipPath = "inset(0 0 -0.3em 0)");
        return [rotatedSpans, { transform: ["translateY(0.5em) rotateZ(5deg)", "translateY(0) rotateZ(0)"], opacity: [0, 1] }, { duration: 0.4, delay: stagger2(0.1), ...options }];
    }
  }
}

// js/common/animation/reveal-items.js
import { animate as animate2, stagger as stagger3, inView } from "vendor";
var _RevealItems_instances, reveal_fn;
var RevealItems = class extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _RevealItems_instances);
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches && window.themeVariables.settings.staggerProductsApparition) {
      inView(this, __privateMethod(this, _RevealItems_instances, reveal_fn).bind(this), { margin: this.getAttribute("margin") ?? "-50px 0px" });
    }
  }
};
_RevealItems_instances = new WeakSet();
reveal_fn = function() {
  this.style.opacity = "1";
  animate2(
    this.hasAttribute("selector") ? this.querySelectorAll(this.getAttribute("selector")) : this.children,
    { opacity: [0, 1], transform: ["translateY(15px)", "translateY(0)"] },
    { duration: 0.35, delay: stagger3(0.05, { easing: "ease-out" }), easing: "ease" }
  );
};
if (!window.customElements.get("reveal-items")) {
  window.customElements.define("reveal-items", RevealItems);
}

// js/common/behavior/custom-cursor.js
var _abortController, _CustomCursor_instances, onPointerLeave_fn, onPointerMove_fn;
var CustomCursor = class extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _CustomCursor_instances);
    __privateAdd(this, _abortController);
  }
  connectedCallback() {
    __privateSet(this, _abortController, new AbortController());
    this.parentElement.addEventListener("pointermove", __privateMethod(this, _CustomCursor_instances, onPointerMove_fn).bind(this), { passive: true, signal: __privateGet(this, _abortController).signal });
    this.parentElement.addEventListener("pointerleave", __privateMethod(this, _CustomCursor_instances, onPointerLeave_fn).bind(this), { signal: __privateGet(this, _abortController).signal });
  }
  disconnectedCallback() {
    __privateGet(this, _abortController).abort();
  }
};
_abortController = new WeakMap();
_CustomCursor_instances = new WeakSet();
onPointerLeave_fn = function() {
  this.classList.remove("is-visible", "is-half-start", "is-half-end");
};
onPointerMove_fn = function(event) {
  if (event.target.matches("button, a[href], button :scope, a[href] :scope")) {
    return this.classList.remove("is-visible");
  }
  const parentBoundingRect = this.parentElement.getBoundingClientRect(), parentXCenter = (parentBoundingRect.left + parentBoundingRect.right) / 2, isOnStartHalfPart = event.pageX < parentXCenter;
  this.classList.toggle("is-half-start", isOnStartHalfPart);
  this.classList.toggle("is-half-end", !isOnStartHalfPart);
  this.classList.add("is-visible");
  const mouseY = event.clientY - parentBoundingRect.y - this.clientHeight / 2, mouseX = event.clientX - parentBoundingRect.x - this.clientWidth / 2;
  this.style.translate = `${mouseX.toFixed(3)}px ${mouseY.toFixed(3)}px`;
  this.style.transform = `${mouseX.toFixed(3)}px ${mouseY.toFixed(3)}px`;
};
if (!window.customElements.get("custom-cursor")) {
  window.customElements.define("custom-cursor", CustomCursor);
}

// js/common/behavior/gesture-area.js
var _domElement, _thresholdDistance, _thresholdTime, _signal, _firstClientX, _tracking, _start, _GestureArea_instances, touchStart_fn, preventTouch_fn, gestureStart_fn, gestureMove_fn, gestureEnd_fn;
var GestureArea = class {
  constructor(domElement, { thresholdDistance = 80, thresholdTime = 500, signal = null } = {}) {
    __privateAdd(this, _GestureArea_instances);
    __privateAdd(this, _domElement);
    __privateAdd(this, _thresholdDistance);
    __privateAdd(this, _thresholdTime);
    __privateAdd(this, _signal);
    __privateAdd(this, _firstClientX);
    __privateAdd(this, _tracking, false);
    __privateAdd(this, _start, {});
    __privateSet(this, _domElement, domElement);
    __privateSet(this, _thresholdDistance, thresholdDistance);
    __privateSet(this, _thresholdTime, thresholdTime);
    __privateSet(this, _signal, signal);
    __privateGet(this, _domElement).addEventListener("touchstart", __privateMethod(this, _GestureArea_instances, touchStart_fn).bind(this), { passive: true, signal: __privateGet(this, _signal) });
    __privateGet(this, _domElement).addEventListener("touchmove", __privateMethod(this, _GestureArea_instances, preventTouch_fn).bind(this), { passive: false, signal: __privateGet(this, _signal) });
    __privateGet(this, _domElement).addEventListener("pointerdown", __privateMethod(this, _GestureArea_instances, gestureStart_fn).bind(this), { signal: __privateGet(this, _signal) });
    __privateGet(this, _domElement).addEventListener("pointermove", __privateMethod(this, _GestureArea_instances, gestureMove_fn).bind(this), { passive: false, signal: __privateGet(this, _signal) });
    __privateGet(this, _domElement).addEventListener("pointerup", __privateMethod(this, _GestureArea_instances, gestureEnd_fn).bind(this), { signal: __privateGet(this, _signal) });
    __privateGet(this, _domElement).addEventListener("pointerleave", __privateMethod(this, _GestureArea_instances, gestureEnd_fn).bind(this), { signal: __privateGet(this, _signal) });
    __privateGet(this, _domElement).addEventListener("pointercancel", __privateMethod(this, _GestureArea_instances, gestureEnd_fn).bind(this), { signal: __privateGet(this, _signal) });
  }
};
_domElement = new WeakMap();
_thresholdDistance = new WeakMap();
_thresholdTime = new WeakMap();
_signal = new WeakMap();
_firstClientX = new WeakMap();
_tracking = new WeakMap();
_start = new WeakMap();
_GestureArea_instances = new WeakSet();
touchStart_fn = function(event) {
  __privateSet(this, _firstClientX, event.touches[0].clientX);
};
preventTouch_fn = function(event) {
  if (Math.abs(event.touches[0].clientX - __privateGet(this, _firstClientX)) > 10) {
    event.preventDefault();
  }
};
gestureStart_fn = function(event) {
  __privateSet(this, _tracking, true);
  __privateSet(this, _start, {
    time: (/* @__PURE__ */ new Date()).getTime(),
    x: event.clientX,
    y: event.clientY
  });
};
gestureMove_fn = function(event) {
  if (__privateGet(this, _tracking)) {
    event.preventDefault();
  }
};
gestureEnd_fn = function(event) {
  if (!__privateGet(this, _tracking)) {
    return;
  }
  __privateSet(this, _tracking, false);
  const now = (/* @__PURE__ */ new Date()).getTime(), deltaTime = now - __privateGet(this, _start).time, deltaX = event.clientX - __privateGet(this, _start).x, deltaY = event.clientY - __privateGet(this, _start).y;
  if (deltaTime > __privateGet(this, _thresholdTime)) {
    return;
  }
  let matchedEvent;
  if (deltaX === 0 && deltaY === 0 && !event.target.matches("a, button, a :scope, button :scope")) {
    matchedEvent = "tap";
  } else if (deltaX > __privateGet(this, _thresholdDistance) && Math.abs(deltaY) < __privateGet(this, _thresholdDistance)) {
    matchedEvent = "swiperight";
  } else if (-deltaX > __privateGet(this, _thresholdDistance) && Math.abs(deltaY) < __privateGet(this, _thresholdDistance)) {
    matchedEvent = "swipeleft";
  } else if (deltaY > __privateGet(this, _thresholdDistance) && Math.abs(deltaX) < __privateGet(this, _thresholdDistance)) {
    matchedEvent = "swipedown";
  } else if (-deltaY > __privateGet(this, _thresholdDistance) && Math.abs(deltaX) < __privateGet(this, _thresholdDistance)) {
    matchedEvent = "swipeup";
  }
  if (matchedEvent) {
    __privateGet(this, _domElement).dispatchEvent(new CustomEvent(matchedEvent, { bubbles: true, composed: true, detail: { originalEvent: event } }));
  }
};

// js/common/behavior/height-observer.js
var HeightObserver = class extends HTMLElement {
  constructor() {
    super();
    if (window.ResizeObserver) {
      new ResizeObserver(this._updateCustomProperties.bind(this)).observe(this);
    }
  }
  connectedCallback() {
    if (!window.ResizeObserver) {
      document.documentElement.style.setProperty(`--${this.getAttribute("variable")}-height`, `${this.clientHeight.toFixed(1)}px`);
    }
  }
  _updateCustomProperties(entries) {
    requestAnimationFrame(() => {
      entries.forEach((entry) => {
        if (entry.target === this) {
          const height = entry.borderBoxSize ? entry.borderBoxSize.length > 0 ? entry.borderBoxSize[0].blockSize : entry.borderBoxSize.blockSize : entry.target.clientHeight;
          document.documentElement.style.setProperty(`--${this.getAttribute("variable")}-height`, `${Math.round(height)}px`);
        }
      });
    });
  }
};
if (!window.customElements.get("height-observer")) {
  window.customElements.define("height-observer", HeightObserver);
}

// js/common/behavior/safe-sticky.js
import { inView as inView2 } from "vendor";
var _resizeObserver, _checkPositionListener, _initialTop, _lastKnownY, _currentTop, _position, _SafeSticky_instances, recalculateStyles_fn, checkPosition_fn;
var SafeSticky = class extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _SafeSticky_instances);
    __privateAdd(this, _resizeObserver, new ResizeObserver(__privateMethod(this, _SafeSticky_instances, recalculateStyles_fn).bind(this)));
    __privateAdd(this, _checkPositionListener, throttle(__privateMethod(this, _SafeSticky_instances, checkPosition_fn).bind(this)));
    __privateAdd(this, _initialTop, 0);
    __privateAdd(this, _lastKnownY, 0);
    /* we could initialize it to window.scrollY but this avoids a costly reflow */
    __privateAdd(this, _currentTop, 0);
    __privateAdd(this, _position, "relative");
  }
  connectedCallback() {
    inView2(this, () => {
      __privateGet(this, _resizeObserver).observe(this);
      window.addEventListener("scroll", __privateGet(this, _checkPositionListener));
      return () => {
        __privateGet(this, _resizeObserver).unobserve(this);
        window.removeEventListener("scroll", __privateGet(this, _checkPositionListener));
      };
    }, { margin: "500px" });
  }
  disconnectedCallback() {
    window.removeEventListener("scroll", __privateGet(this, _checkPositionListener));
  }
};
_resizeObserver = new WeakMap();
_checkPositionListener = new WeakMap();
_initialTop = new WeakMap();
_lastKnownY = new WeakMap();
_currentTop = new WeakMap();
_position = new WeakMap();
_SafeSticky_instances = new WeakSet();
recalculateStyles_fn = function() {
  this.style.removeProperty("top");
  const computedStyles = getComputedStyle(this);
  __privateSet(this, _initialTop, parseInt(computedStyles.top));
  __privateSet(this, _position, computedStyles.position);
  __privateMethod(this, _SafeSticky_instances, checkPosition_fn).call(this);
};
checkPosition_fn = function() {
  if (__privateGet(this, _position) !== "sticky") {
    return this.style.removeProperty("top");
  }
  let bounds = this.getBoundingClientRect(), maxTop = bounds.top + window.scrollY - this.offsetTop + __privateGet(this, _initialTop), minTop = this.clientHeight - window.innerHeight + 20;
  if (window.scrollY < __privateGet(this, _lastKnownY)) {
    __privateSet(this, _currentTop, __privateGet(this, _currentTop) - (window.scrollY - __privateGet(this, _lastKnownY)));
  } else {
    __privateSet(this, _currentTop, __privateGet(this, _currentTop) + (__privateGet(this, _lastKnownY) - window.scrollY));
  }
  __privateSet(this, _currentTop, Math.min(Math.max(__privateGet(this, _currentTop), -minTop), maxTop, __privateGet(this, _initialTop)));
  __privateSet(this, _lastKnownY, window.scrollY);
  this.style.top = `${Math.round(__privateGet(this, _currentTop))}px`;
};
if (!window.customElements.get("safe-sticky")) {
  window.customElements.define("safe-sticky", SafeSticky);
}

// js/common/behavior/scroll-area.js
var ScrollArea = class {
  constructor(element, abortController2 = null) {
    this._element = element;
    this._allowTriggerNearingStartEvent = false;
    this._allowTriggerLeavingStartEvent = true;
    this._allowTriggerNearingEndEvent = true;
    this._allowTriggerLeavingEndEvent = false;
    new ResizeObserver(this._checkIfScrollable.bind(this)).observe(element);
    this._element.addEventListener("scroll", throttle(this._onScroll.bind(this)), { signal: abortController2?.signal });
  }
  get scrollNearingThreshold() {
    return 125;
  }
  get scrollDirection() {
    if (this._element.scrollWidth > this._element.clientWidth) {
      return "inline";
    } else if (this._element.scrollHeight - this._element.clientHeight > 1) {
      return "block";
    } else {
      return "none";
    }
  }
  _checkIfScrollable() {
    this._element.classList.toggle("is-scrollable", this.scrollDirection !== "none");
  }
  _onScroll() {
    clearTimeout(this._scrollTimeout);
    this._lastScrollPosition = this._lastScrollPosition ?? (this.scrollDirection === "inline" ? Math.abs(this._element.scrollLeft) : Math.abs(this._element.scrollTop));
    let direction;
    if (this.scrollDirection === "inline") {
      direction = this._lastScrollPosition > Math.abs(this._element.scrollLeft) ? "start" : "end";
      this._lastScrollPosition = Math.abs(this._element.scrollLeft);
    } else {
      direction = this._lastScrollPosition > Math.abs(this._element.scrollTop) ? "start" : "end";
      this._lastScrollPosition = Math.abs(this._element.scrollTop);
    }
    const scrollPosition = Math.round(Math.abs(this.scrollDirection === "inline" ? this._element.scrollLeft : this._element.scrollTop)), scrollMinusSize = Math.round(this.scrollDirection === "inline" ? this._element.scrollWidth - this._element.clientWidth : this._element.scrollHeight - this._element.clientHeight);
    if (direction === "start" && this._allowTriggerNearingStartEvent && scrollPosition <= this.scrollNearingThreshold) {
      this._allowTriggerNearingStartEvent = false;
      this._allowTriggerLeavingStartEvent = true;
      this._element.dispatchEvent(new CustomEvent("scroll:edge-nearing", { bubbles: true, detail: { position: "start" } }));
    } else if (direction === "end" && scrollPosition > this.scrollNearingThreshold) {
      this._allowTriggerNearingStartEvent = true;
      if (this._allowTriggerLeavingStartEvent) {
        this._allowTriggerLeavingStartEvent = false;
        this._element.dispatchEvent(new CustomEvent("scroll:edge-leaving", { bubbles: true, detail: { position: "start" } }));
      }
    }
    if (direction === "end" && this._allowTriggerNearingEndEvent && scrollMinusSize <= scrollPosition + this.scrollNearingThreshold) {
      this._allowTriggerNearingEndEvent = false;
      this._allowTriggerLeavingEndEvent = true;
      this._element.dispatchEvent(new CustomEvent("scroll:edge-nearing", { bubbles: true, detail: { position: "end" } }));
    } else if (direction === "start" && scrollMinusSize > scrollPosition + this.scrollNearingThreshold) {
      this._allowTriggerNearingEndEvent = true;
      if (this._allowTriggerLeavingEndEvent) {
        this._allowTriggerLeavingEndEvent = false;
        this._element.dispatchEvent(new CustomEvent("scroll:edge-leaving", { bubbles: true, detail: { position: "end" } }));
      }
    }
    if (window.onscrollend === void 0) {
      this._scrollTimeout = setTimeout(() => {
        this._element.dispatchEvent(new CustomEvent("scrollend", { bubbles: true, composed: true }));
      }, 75);
    }
  }
};

// js/common/behavior/scroll-progress.js
var ScrollProgress = class extends HTMLElement {
  connectedCallback() {
    this.scrolledElement.addEventListener("scroll", throttle(this._updateScrollProgress.bind(this)));
    if (window.ResizeObserver) {
      new ResizeObserver(this._updateScrollProgress.bind(this)).observe(this.scrolledElement);
    }
  }
  get scrolledElement() {
    return this._scrolledElement = this._scrolledElement || document.getElementById(this.getAttribute("observes"));
  }
  _updateScrollProgress() {
    const scrollLeft = document.dir === "ltr" ? this.scrolledElement.scrollLeft : Math.abs(this.scrolledElement.scrollLeft), advancement = (scrollLeft + this.scrolledElement.clientWidth) / this.scrolledElement.scrollWidth;
    this.style.setProperty("--scroll-progress", Math.max(0, Math.min(advancement, 1)).toFixed(6));
  }
};
if (!window.customElements.get("scroll-progress")) {
  window.customElements.define("scroll-progress", ScrollProgress);
}

// js/common/behavior/scroll-shadow.js
var template = `
  <style>
    :host {
      display: inline-block;
      contain: layout;
      position: relative;
    }
    
    :host([hidden]) {
      display: none;
    }
    
    s {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      pointer-events: none;
      background-image:
        var(--scroll-shadow-top, linear-gradient(to bottom, rgb(var(--background)), rgb(var(--background) / 0))),
        var(--scroll-shadow-bottom, linear-gradient(to top, rgb(var(--background)), rgb(var(--background) / 0))),
        var(--scroll-shadow-left, linear-gradient(to right, rgb(var(--background)), rgb(var(--background) / 0))),
        var(--scroll-shadow-right, linear-gradient(to left, rgb(var(--background)), rgb(var(--background) / 0)));
      background-position: top, bottom, left, right;
      background-repeat: no-repeat;
      background-size: 100% var(--top, 0), 100% var(--bottom, 0), var(--left, 0) 100%, var(--right, 0) 100%;
    }
  </style>
  <slot></slot>
  <s></s>
`;
var Updater = class {
  constructor(targetElement) {
    this.scheduleUpdate = throttle(() => this.update(targetElement, getComputedStyle(targetElement)));
    this.resizeObserver = new ResizeObserver(this.scheduleUpdate.bind(this));
  }
  start(element) {
    if (this.element) {
      this.stop();
    }
    if (element) {
      element.addEventListener("scroll", this.scheduleUpdate);
      this.resizeObserver.observe(element);
      this.element = element;
    }
  }
  stop() {
    if (!this.element) {
      return;
    }
    this.element.removeEventListener("scroll", this.scheduleUpdate);
    this.resizeObserver.unobserve(this.element);
    this.element = null;
  }
  update(targetElement, style) {
    if (!this.element) {
      return;
    }
    const maxSize = style.getPropertyValue("--scroll-shadow-size") ? parseInt(style.getPropertyValue("--scroll-shadow-size")) : 0;
    const scroll5 = {
      top: Math.max(this.element.scrollTop, 0),
      bottom: Math.max(this.element.scrollHeight - this.element.offsetHeight - this.element.scrollTop, 0),
      left: Math.max(this.element.scrollLeft, 0),
      right: Math.max(this.element.scrollWidth - this.element.offsetWidth - this.element.scrollLeft, 0)
    };
    requestAnimationFrame(() => {
      for (const position of ["top", "bottom", "left", "right"]) {
        targetElement.style.setProperty(
          `--${position}`,
          `${scroll5[position] > maxSize ? maxSize : scroll5[position]}px`
        );
      }
    });
  }
};
var ScrollShadow = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = template;
    this.updater = new Updater(this.shadowRoot.lastElementChild);
  }
  connectedCallback() {
    this.shadowRoot.querySelector("slot").addEventListener("slotchange", this.start);
    this.start();
  }
  disconnectedCallback() {
    this.updater.stop();
  }
  start() {
    if (this.firstElementChild) {
      this.updater.start(this.firstElementChild);
    }
  }
};
if ("ResizeObserver" in window && !window.customElements.get("scroll-shadow")) {
  window.customElements.define("scroll-shadow", ScrollShadow);
}

// js/common/behavior/split-lines.js
var _requireSplit, _lastScreenWidth, _SplitLines_instances, split_fn, onWindowResized_fn;
var SplitLines = class extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _SplitLines_instances);
    __privateAdd(this, _requireSplit, true);
    __privateAdd(this, _lastScreenWidth, window.innerWidth);
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(document.createRange().createContextualFragment("<slot></slot>"));
    window.addEventListener("resize", throttle(__privateMethod(this, _SplitLines_instances, onWindowResized_fn).bind(this)));
    new MutationObserver(__privateMethod(this, _SplitLines_instances, split_fn).bind(this, true)).observe(this, { characterData: true, attributes: false, childList: false, subtree: true });
  }
  connectedCallback() {
    __privateMethod(this, _SplitLines_instances, split_fn).call(this);
  }
  get lines() {
    return Array.from(this.shadowRoot.children);
  }
};
_requireSplit = new WeakMap();
_lastScreenWidth = new WeakMap();
_SplitLines_instances = new WeakSet();
split_fn = function(force = false) {
  if (!__privateGet(this, _requireSplit) && !force) {
    return;
  }
  this.shadowRoot.innerHTML = this.textContent.replace(/./g, "<span>$&</span>").replace(/\s/g, " ");
  const bounds = /* @__PURE__ */ new Map();
  Array.from(this.shadowRoot.children).forEach((letter) => {
    const key = Math.round(letter.getBoundingClientRect().top);
    bounds.set(key, (bounds.get(key) || "").concat(letter.textContent));
  });
  this.shadowRoot.replaceChildren(...Array.from(bounds.values(), (line) => document.createRange().createContextualFragment(`
      <span style="display: inline-block;">
        <span style="display: block">${line}</span>
      </span>
    `)));
  __privateSet(this, _requireSplit, false);
};
onWindowResized_fn = function() {
  if (__privateGet(this, _lastScreenWidth) === window.innerWidth) {
    return;
  }
  __privateMethod(this, _SplitLines_instances, split_fn).call(this, true);
  __privateSet(this, _lastScreenWidth, window.innerWidth);
};
if (!window.customElements.get("split-lines")) {
  window.customElements.define("split-lines", SplitLines);
}

// js/common/carousel/effect-carousel.js
import { timeline as timeline3, inView as inView3 } from "vendor";

// js/common/carousel/base-carousel.js
var BaseCarousel = class extends HTMLElement {
  connectedCallback() {
    this._abortController = new AbortController();
    this._reloaded = false;
    if (Shopify.designMode) {
      this.closest(".shopify-section")?.addEventListener("shopify:section:select", (event) => this._reloaded = event.detail.load);
    }
    if (this.items.length > 1) {
      if (Shopify.designMode) {
        this.addEventListener("shopify:block:select", (event) => this.select(this.items.indexOf(event.target), { animate: !event.detail.load }));
      }
      if (this.hasAttribute("adaptive-height")) {
        this.addEventListener("carousel:settle", this._adjustHeight);
        this._adjustHeight();
      }
      this.addEventListener("carousel:select", this._preloadImages, { signal: this._abortController.signal });
      this.addEventListener("carousel:filter", this._filterItems, { signal: this._abortController.signal });
      this.addEventListener("control:prev", this.previous, { signal: this._abortController.signal });
      this.addEventListener("control:next", this.next, { signal: this._abortController.signal });
      this.addEventListener("control:select", (event) => this.select(event.detail.index), { signal: this._abortController.signal });
    }
    if (this.selectedIndex === 0) {
      this.selectedSlide.classList.add("is-selected");
      this._dispatchEvent("carousel:select", 0);
    } else {
      this.select(this.selectedIndex, { animate: false, force: true });
    }
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  get items() {
    if (this.hasAttribute("reversed")) {
      return this._items = this._items || Array.from(this.hasAttribute("selector") ? this.querySelectorAll(this.getAttribute("selector")) : this.children).reverse();
    } else {
      return this._items = this._items || Array.from(this.hasAttribute("selector") ? this.querySelectorAll(this.getAttribute("selector")) : this.children);
    }
  }
  get visibleItems() {
    return this.items.filter((item) => item.offsetParent !== null);
  }
  get selectedIndex() {
    return this._selectedIndex = this._selectedIndex ?? parseInt(this.getAttribute("initial-index") || 0);
  }
  get selectedIndexAmongVisible() {
    return this.visibleItems.indexOf(this.selectedSlide);
  }
  get loop() {
    return false;
  }
  get selectedSlide() {
    return this.items[this.selectedIndex];
  }
  get previousSlide() {
    return this.visibleItems[this.loop ? (this.selectedIndexAmongVisible - 1 + this.visibleItems.length) % this.visibleItems.length : Math.max(this.selectedIndexAmongVisible - 1, 0)];
  }
  get nextSlide() {
    return this.visibleItems[this.loop ? (this.selectedIndexAmongVisible + 1 + this.visibleItems.length) % this.visibleItems.length : Math.min(this.selectedIndexAmongVisible + 1, this.visibleItems.length - 1)];
  }
  previous(animate19 = true) {
    this.select(this.items.indexOf(this.previousSlide), { direction: "previous", animate: animate19 });
  }
  next(animate19 = true) {
    this.select(this.items.indexOf(this.nextSlide), { direction: "next", animate: animate19 });
  }
  _transitionTo(fromSlide, toSlide, options = {}) {
  }
  _adjustHeight() {
    if (this.hasAttribute("adaptive-height") && this.selectedSlide.clientHeight !== this.clientHeight) {
      this.style.maxHeight = `${this.selectedSlide.clientHeight}px`;
    }
  }
  _filterItems(event) {
    this.items.forEach((item, index) => item.hidden = event.detail.filteredIndexes.includes(index));
  }
  _preloadImages() {
    requestAnimationFrame(() => {
      [this.previousSlide, this.nextSlide].forEach((item) => {
        if (item) {
          Array.from(item.querySelectorAll('img[loading="lazy"]')).forEach((img) => img.removeAttribute("loading"));
        }
      });
    });
  }
  _dispatchEvent(eventName, index) {
    this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: { slide: this.items[index], index } }));
  }
};

// js/common/carousel/effect-carousel.js
var EffectCarousel = class extends BaseCarousel {
  connectedCallback() {
    if (this.items.length > 1 && this.hasAttribute("autoplay")) {
      this._player = new Player(this.getAttribute("autoplay"));
      this._player.addEventListener("player:end", this.next.bind(this));
      inView3(this, () => this._player.resume(true));
      if (Shopify.designMode) {
        this.addEventListener("shopify:block:select", () => this._player.stop());
        this.addEventListener("shopify:block:deselect", () => this._player.start());
      }
    }
    super.connectedCallback();
    if (this.items.length > 1) {
      if (this.swipeable) {
        new GestureArea(this, { signal: this._abortController.signal });
        this.addEventListener("swipeleft", this.next, { signal: this._abortController.signal });
        this.addEventListener("swiperight", this.previous, { signal: this._abortController.signal });
      }
    }
  }
  get player() {
    return this._player;
  }
  get loop() {
    return true;
  }
  get swipeable() {
    return this.getAttribute("swipeable") !== "false";
  }
  async select(index, { direction, animate: animate19 = true } = {}) {
    const indexBeforeChange = this.selectedIndex;
    this._selectedIndex = index;
    this._dispatchEvent("carousel:select", index);
    if (!direction) {
      direction = index > indexBeforeChange ? "next" : "previous";
    }
    if (index !== indexBeforeChange) {
      const [fromSlide, toSlide] = [this.items[indexBeforeChange], this.items[index]];
      this._dispatchEvent("carousel:change", index);
      this.player?.pause();
      await this._transitionTo(fromSlide, toSlide, { direction, animate: animate19 });
      this.player?.resume(true);
      this._dispatchEvent("carousel:settle", index);
    }
  }
  /**
   * Perform a simple fade animation. For more complex animations, you should implement your own custom elements
   * that extends the EffectCarousel, and implement your own transition. You should make sure to return a promise
   * that resolves when the animation is finished
   */
  _transitionTo(fromSlide, toSlide, { direction = "next", animate: animate19 = true } = {}) {
    fromSlide.classList.remove("is-selected");
    toSlide.classList.add("is-selected");
    const timelineControls = timeline3([
      [fromSlide, { opacity: [1, 0], visibility: ["visible", "hidden"], zIndex: 0 }, { zIndex: { easing: "step-end" } }],
      [toSlide, { opacity: [0, 1], visibility: ["hidden", "visible"], zIndex: 1 }, { at: "<", zIndex: { easing: "step-end" } }]
    ], { duration: animate19 ? 0.3 : 0 });
    return timelineControls.finished;
  }
};
if (!window.customElements.get("effect-carousel")) {
  window.customElements.define("effect-carousel", EffectCarousel);
}

// js/common/carousel/scroll-carousel.js
var ScrollCarousel = class extends BaseCarousel {
  constructor() {
    super();
    if (window.ResizeObserver) {
      new ResizeObserver(throttle(this._adjustHeight.bind(this))).observe(this);
    }
  }
  connectedCallback() {
    this._hasPendingProgrammaticScroll = false;
    this._scrollArea = new ScrollArea(this, this._abortController);
    super.connectedCallback();
    this.addEventListener("scroll", throttle(this._onCarouselScroll.bind(this)), { signal: this._abortController.signal });
    this.addEventListener("scrollend", this._onScrollSettled, { signal: this._abortController.signal });
  }
  get itemOffset() {
    return this.visibleItems.length < 2 ? 0 : this.visibleItems[1].offsetLeft - this.visibleItems[0].offsetLeft;
  }
  get slidesPerPage() {
    return this.visibleItems.length < 2 ? 1 : Math.floor((this.clientWidth - this.visibleItems[0].offsetLeft) / (Math.abs(this.itemOffset) - (parseInt(getComputedStyle(this).gap) || 0)));
  }
  get totalPages() {
    return this.visibleItems.length < 2 ? 1 : this.visibleItems.length - this.slidesPerPage + 1;
  }
  select(index, { animate: animate19 = true, force = false } = {}) {
    const indexBeforeChange = this.selectedIndex;
    if (!this.offsetParent || this._scrollArea.scrollDirection === "none") {
      return this._selectedIndex = index;
    }
    const indexAmongVisible = this.visibleItems.indexOf(this.items[index]);
    index = this.items.indexOf(this.visibleItems[Math.min(this.totalPages, indexAmongVisible)]);
    this._selectedIndex = index;
    this._dispatchEvent("carousel:select", index);
    if (index !== indexBeforeChange || force) {
      const [fromSlide, toSlide] = [this.items[indexBeforeChange], this.items[index]];
      this._dispatchEvent("carousel:change", index);
      this._transitionTo(fromSlide, toSlide, { animate: animate19 });
    }
  }
  /**
   * Transition using the scrollTo method. To prevent the intersection observer to caught up the change, we set up
   * a "hasPendingProgrammaticScroll" variable to true, that is set back to false once the scroll has settled
   */
  _transitionTo(fromSlide, toSlide, { animate: animate19 = true } = {}) {
    fromSlide.classList.remove("is-selected");
    toSlide.classList.add("is-selected");
    let slideAlign = this._extractSlideAlign(toSlide), scrollAmount = 0;
    switch (slideAlign) {
      case "start":
        scrollAmount = this.itemOffset * this.visibleItems.indexOf(toSlide);
        break;
      case "center":
        scrollAmount = toSlide.offsetLeft - (this.clientWidth / 2 - (parseInt(getComputedStyle(this).scrollPaddingInline) || 0)) + toSlide.clientWidth / 2;
        break;
    }
    this._hasPendingProgrammaticScroll = animate19;
    this.scrollTo({ left: scrollAmount, behavior: animate19 ? "smooth" : "auto" });
  }
  /**
   * Update the index when manually scrolling (which allows to update the controls)
   */
  _onCarouselScroll() {
    if (this._hasPendingProgrammaticScroll || this._scrollArea.scrollDirection === "none") {
      return;
    }
    const newIndex = this.items.indexOf(this.visibleItems[Math.round(this.scrollLeft / this.itemOffset)]);
    if (newIndex !== this.selectedIndex) {
      this._selectedIndex = newIndex;
      this._dispatchEvent("carousel:select", this.selectedIndex);
      this._dispatchEvent("carousel:change", this.selectedIndex);
    }
  }
  /**
   * On the scroll has settled we dispatch the event (which covers both programmatic scroll and swipe)
   */
  _onScrollSettled() {
    this.items.forEach((item) => item.classList.remove("is-selected"));
    this.selectedSlide.classList.add("is-selected");
    this._hasPendingProgrammaticScroll = false;
    this._dispatchEvent("carousel:settle", this.selectedIndex);
  }
  _adjustHeight() {
    this.style.maxHeight = null;
    if (this._scrollArea?.scrollDirection !== "none") {
      super._adjustHeight();
    }
  }
  _extractSlideAlign(slide) {
    return getComputedStyle(slide).scrollSnapAlign === "center" ? "center" : "start";
  }
};
if (!window.customElements.get("scroll-carousel")) {
  window.customElements.define("scroll-carousel", ScrollCarousel);
}

// js/common/cart/cart-count.js
import { animate as animate3 } from "vendor";

// js/common/cart/fetch-cart.js
var createCartPromise = () => {
  return new Promise(async (resolve) => {
    resolve(await (await fetch(`${Shopify.routes.root}cart.js`)).json());
  });
};
var fetchCart = createCartPromise();
document.addEventListener("cart:refresh", () => {
  fetchCart = createCartPromise();
});
document.addEventListener("cart:change", (event) => {
  fetchCart = event.detail["cart"];
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    fetchCart = createCartPromise();
  }
});

// js/common/cart/cart-count.js
var CartCount = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(document.createRange().createContextualFragment("<span><slot></slot></span>"));
  }
  connectedCallback() {
    this._abortController = new AbortController();
    document.addEventListener("cart:change", (event) => this.itemCount = event.detail["cart"]["item_count"], { signal: this._abortController.signal });
    document.addEventListener("cart:refresh", this._updateFromServer.bind(this), { signal: this._abortController.signal });
    window.addEventListener("pageshow", this._updateFromServer.bind(this));
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  async _updateFromServer() {
    this.itemCount = (await fetchCart)["item_count"];
  }
  get itemCount() {
    return parseInt(this.textContent);
  }
  set itemCount(count) {
    if (this.itemCount === count) {
      return;
    }
    if (count === 0) {
      animate3(this, { opacity: 0 }, { duration: 0.1 });
      this.textContent = count;
    } else if (this.itemCount === 0) {
      animate3(this, { opacity: 1 }, { duration: 0.1 });
      this.textContent = count;
    } else {
      (async () => {
        await animate3(this.shadowRoot.firstElementChild, { transform: ["translateY(-50%)"], opacity: 0 }, { duration: 0.25, easing: [1, 0, 0, 1] }).finished;
        this.textContent = count;
        animate3(this.shadowRoot.firstElementChild, { transform: ["translateY(50%)", "translateY(0)"], opacity: 1 }, { duration: 0.25, easing: [1, 0, 0, 1] });
      })();
    }
  }
};
if (!window.customElements.get("cart-count")) {
  window.customElements.define("cart-count", CartCount);
}

// js/common/cart/cart-discount.js
var AbstractCartDiscount = class extends HTMLElement {
  async getDiscountCodes() {
    return (await fetchCart)["discount_codes"].filter((discount) => discount.applicable).map((discount) => discount.code.toLowerCase());
  }
  async toggleDiscount(event) {
    let target = event.currentTarget;
    target.setAttribute("aria-busy", "true");
    let discountCodes = await this.getDiscountCodes();
    if (target.hasAttribute("discount-code")) {
      discountCodes = discountCodes.filter((discount2) => discount2 !== target.getAttribute("discount-code").toLowerCase());
    }
    let discount = (discountCodes.length > 0 ? discountCodes.join(",") + "," : "") + (event.target.value || "");
    const response = await fetch(`${Shopify.routes.root}cart/update.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ discount })
    });
    target.setAttribute("aria-busy", "false");
    if (!response.ok) {
      this.dispatchEvent(new CustomEvent("cart:discount:error", { bubbles: true }));
      return;
    }
    const responseJson = await response.json();
    if (responseJson.discount_codes.some((obj) => obj.applicable === false)) {
      this.dispatchEvent(new CustomEvent("cart:discount:error", { bubbles: true }));
      return;
    } else {
      this.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
    }
    if (window.themeVariables.settings.pageType === "cart") {
      window.location.reload();
    }
  }
};
var _abortController2, _CartDiscountBanner_instances, onCartDiscountError_fn;
var CartDiscountBanner = class extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _CartDiscountBanner_instances);
    __privateAdd(this, _abortController2);
  }
  connectedCallback() {
    __privateSet(this, _abortController2, new AbortController());
    document.addEventListener("cart:discount:error", __privateMethod(this, _CartDiscountBanner_instances, onCartDiscountError_fn).bind(this), { signal: __privateGet(this, _abortController2).signal });
  }
  disconnectedCallback() {
    __privateGet(this, _abortController2).abort();
  }
};
_abortController2 = new WeakMap();
_CartDiscountBanner_instances = new WeakSet();
onCartDiscountError_fn = function() {
  this.hidden = false;
};
var _hiddenDiscountInputOriginalValue, _CartDiscountField_instances, hiddenDiscountInput_get, updateHiddenInput_fn;
var CartDiscountField = class extends AbstractCartDiscount {
  constructor() {
    super();
    __privateAdd(this, _CartDiscountField_instances);
    __privateAdd(this, _hiddenDiscountInputOriginalValue);
    __privateSet(this, _hiddenDiscountInputOriginalValue, __privateGet(this, _CartDiscountField_instances, hiddenDiscountInput_get).value);
    this.addEventListener("change", this.toggleDiscount.bind(this));
    this.addEventListener("input", __privateMethod(this, _CartDiscountField_instances, updateHiddenInput_fn));
  }
};
_hiddenDiscountInputOriginalValue = new WeakMap();
_CartDiscountField_instances = new WeakSet();
hiddenDiscountInput_get = function() {
  return this.querySelector('[name="discount"]');
};
updateHiddenInput_fn = function(event) {
  __privateGet(this, _CartDiscountField_instances, hiddenDiscountInput_get).value = [__privateGet(this, _hiddenDiscountInputOriginalValue), event.target.value].filter((val) => val && val.trim() !== "").join(",");
};
var CartDiscountRemoveButton = class extends AbstractCartDiscount {
  constructor() {
    super();
    this.addEventListener("click", this.toggleDiscount.bind(this));
  }
};
if (!window.customElements.get("cart-discount-field")) {
  window.customElements.define("cart-discount-field", CartDiscountField);
}
if (!window.customElements.get("cart-discount-remove-button")) {
  window.customElements.define("cart-discount-remove-button", CartDiscountRemoveButton);
}
if (!window.customElements.get("cart-discount-banner")) {
  window.customElements.define("cart-discount-banner", CartDiscountBanner);
}

// js/common/cart/cart-drawer.js
import { animate as animate4 } from "vendor";

// js/common/overlay/dialog-element.js
import { FocusTrap, Delegate } from "vendor";
var DialogElement = class _DialogElement extends HTMLElement {
  static get observedAttributes() {
    return ["id", "open"];
  }
  static #lockLayerCount = 0;
  #isLocked = false;
  constructor() {
    super();
    this.addEventListener("dialog:force-close", (event) => {
      this.hide();
      event.stopPropagation();
    });
  }
  connectedCallback() {
    if (this.id) {
      this.delegate.off().on("click", `[aria-controls="${this.id}"]`, this._onToggleClicked.bind(this));
    }
    this._abortController = new AbortController();
    this.setAttribute("role", "dialog");
    if (Shopify.designMode) {
      this.addEventListener("shopify:block:select", (event) => this.show(!event.detail.load), { signal: this._abortController.signal });
      this.addEventListener("shopify:block:deselect", this.hide, { signal: this._abortController.signal });
      this._shopifySection = this._shopifySection || this.closest(".shopify-section");
      if (this._shopifySection) {
        if (this.hasAttribute("handle-section-events")) {
          this._shopifySection.addEventListener("shopify:section:select", (event) => this.show(!event.detail.load), { signal: this._abortController.signal });
          this._shopifySection.addEventListener("shopify:section:deselect", this.hide.bind(this), { signal: this._abortController.signal });
        }
        this._shopifySection.addEventListener("shopify:section:unload", () => this.remove(), { signal: this._abortController.signal });
      }
    }
  }
  disconnectedCallback() {
    this._abortController.abort();
    this.delegate.off();
    this.focusTrap?.deactivate({ onDeactivate: () => {
    } });
    if (this.#isLocked) {
      this.#isLocked = false;
      document.documentElement.classList.toggle("lock", --_DialogElement.#lockLayerCount > 0);
    }
  }
  show(animate19 = true) {
    if (this.open) {
      return;
    }
    this.setAttribute("open", animate19 ? "" : "immediate");
    return waitForEvent(this, "dialog:after-show");
  }
  hide() {
    if (!this.open) {
      return;
    }
    this.removeAttribute("open");
    return waitForEvent(this, "dialog:after-hide");
  }
  get delegate() {
    return this._delegate = this._delegate || new Delegate(document.body);
  }
  get controls() {
    return Array.from(this.getRootNode().querySelectorAll(`[aria-controls="${this.id}"]`));
  }
  get open() {
    return this.hasAttribute("open");
  }
  get shouldTrapFocus() {
    return true;
  }
  get shouldLock() {
    return false;
  }
  /**
   * Sometimes (especially for drawer) we need to ensure that an element is on top of everything else. To do that,
   * we need to move the element to the body. We are doing that on open, and then restore the initial position on
   * close
   */
  get shouldAppendToBody() {
    return false;
  }
  get initialFocus() {
    return this.hasAttribute("initial-focus") ? this.getAttribute("initial-focus") : this.hasAttribute("tabindex") ? this : this.querySelector('input:not([type="hidden"])') || false;
  }
  get preventScrollWhenTrapped() {
    return true;
  }
  get focusTrap() {
    return this._focusTrap = this._focusTrap || new FocusTrap.createFocusTrap(this, {
      onDeactivate: this.hide.bind(this),
      allowOutsideClick: this._allowOutsideClick.bind(this),
      initialFocus: window.matchMedia("screen and (pointer: fine)").matches ? this.initialFocus : void 0,
      fallbackFocus: this,
      tabbableOptions: {
        getShadowRoot: true
      },
      preventScroll: this.preventScrollWhenTrapped
    });
  }
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "id":
        if (newValue) {
          this.delegate.off().on("click", `[aria-controls="${this.id}"]`, this._onToggleClicked.bind(this));
        }
        break;
      case "open":
        this.controls.forEach((toggle) => toggle.setAttribute("aria-expanded", newValue === null ? "false" : "true"));
        if (oldValue === null && (newValue === "" || newValue === "immediate")) {
          this.removeAttribute("inert");
          this._originalParentBeforeAppend = null;
          if (this.shouldAppendToBody && this.parentElement !== document.body) {
            this._originalParentBeforeAppend = this.parentElement;
            document.body.append(this);
          }
          const showTransitionPromise = this._showTransition(newValue !== "immediate") || Promise.resolve();
          showTransitionPromise.then(() => {
            this.dispatchEvent(new CustomEvent("dialog:after-show", { bubbles: true }));
          });
          if (this.shouldTrapFocus) {
            this.focusTrap.activate({
              checkCanFocusTrap: () => showTransitionPromise
            });
          }
          if (this.shouldLock) {
            _DialogElement.#lockLayerCount += 1;
            this.#isLocked = true;
            document.documentElement.classList.add("lock");
          }
        } else if (oldValue !== null && newValue === null) {
          this.setAttribute("inert", "");
          const hideTransitionPromise = this._hideTransition() || Promise.resolve();
          hideTransitionPromise.then(() => {
            if (this.parentElement === document.body && this._originalParentBeforeAppend) {
              this._originalParentBeforeAppend.appendChild(this);
              this._originalParentBeforeAppend = null;
            }
            this.dispatchEvent(new CustomEvent("dialog:after-hide", { bubbles: true }));
          });
          this.focusTrap?.deactivate({
            checkCanReturnFocus: () => hideTransitionPromise
          });
          if (this.shouldLock) {
            this.#isLocked = false;
            document.documentElement.classList.toggle("lock", --_DialogElement.#lockLayerCount > 0);
          }
        }
        this.dispatchEvent(new CustomEvent("toggle", { bubbles: true }));
        break;
    }
  }
  /* Those methods are used to perform custom show/hide transition, and must return a promise */
  _showTransition(animate19 = true) {
  }
  _hideTransition() {
  }
  /* By default, a focus element is deactivated when you click outside it */
  _allowOutsideClick(event) {
    if ("TouchEvent" in window && event instanceof TouchEvent) {
      return this._allowOutsideClickTouch(event);
    } else {
      return this._allowOutsideClickMouse(event);
    }
  }
  _allowOutsideClickTouch(event) {
    event.target.addEventListener("touchend", (subEvent) => {
      const endTarget = document.elementFromPoint(subEvent.changedTouches.item(0).clientX, subEvent.changedTouches.item(0).clientY);
      if (!this.contains(endTarget)) {
        this.hide();
      }
    }, { once: true });
    return false;
  }
  _allowOutsideClickMouse(event) {
    if (event.type !== "click") {
      return false;
    }
    if (!this.contains(event.target)) {
      this.hide();
    }
    let target = event.target, closestControl = event.target.closest("[aria-controls]");
    if (closestControl && closestControl.getAttribute("aria-controls") === this.id) {
      target = closestControl;
    }
    return this.id !== target.getAttribute("aria-controls");
  }
  _onToggleClicked(event) {
    event?.preventDefault();
    this.open ? this.hide() : this.show();
  }
};
var CloseButton = class extends HTMLButtonElement {
  constructor() {
    super();
    this.addEventListener("click", () => this.dispatchEvent(new CustomEvent("dialog:force-close", { bubbles: true, cancelable: true, composed: true })));
  }
};
if (!window.customElements.get("dialog-element")) {
  window.customElements.define("dialog-element", DialogElement);
}
if (!window.customElements.get("close-button")) {
  window.customElements.define("close-button", CloseButton, { extends: "button" });
}

// js/common/overlay/drawer.js
import { animate as motionAnimate, timeline as motionTimeline } from "vendor";
var reduceDrawerAnimation = window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.themeVariables.settings.reduceDrawerAnimation;
var Drawer = class extends DialogElement {
  constructor() {
    super();
    const template2 = document.getElementById(this.template).content.cloneNode(true);
    this.attachShadow({ mode: "open" }).appendChild(template2);
    this.shadowRoot.addEventListener("slotchange", (event) => this._updateSlotVisibility(event.target));
  }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("aria-modal", "true");
    this.shadowRoot.querySelector('[part="overlay"]')?.addEventListener("click", this.hide.bind(this), { signal: this._abortController.signal });
    Array.from(this.shadowRoot.querySelectorAll("slot")).forEach((slot) => this._updateSlotVisibility(slot));
  }
  get template() {
    return this.getAttribute("template") || "drawer-default-template";
  }
  get shouldLock() {
    return true;
  }
  get shouldAppendToBody() {
    return true;
  }
  get openFrom() {
    return window.matchMedia(`${window.themeVariables.breakpoints["sm-max"]}`).matches ? "bottom" : this.getAttribute("open-from") || "right";
  }
  _getClipPathProperties() {
    switch (this.openFrom) {
      case "left":
        return document.dir === "ltr" ? ["inset(0 100% 0 0 round var(--rounded-sm))", "inset(0 0 0 0 round var(--rounded-sm))"] : ["inset(0 0 0 100% round var(--rounded-sm))", "inset(0 0 0 0 round var(--rounded-sm))"];
      case "right":
        return document.dir === "ltr" ? ["inset(0 0 0 100% round var(--rounded-sm))", "inset(0 0 0 0 round var(--rounded-sm)"] : ["inset(0 100% 0 0 round var(--rounded-sm))", "inset(0 0 0 0 round var(--rounded-sm))"];
      case "bottom":
        return ["inset(100% 0 0 0 round var(--rounded-sm))", "inset(0 0 0 0 round var(--rounded-sm))"];
      case "top":
        return ["inset(0 0 100% 0 round var(--rounded-sm))", "inset(0 0 0 0 round var(--rounded-sm))"];
    }
  }
  _setInitialPosition() {
    this.style.left = document.dir === "ltr" && this.openFrom === "left" || document.dir === "rtl" && this.openFrom === "right" ? "0px" : "auto";
    this.style.right = this.style.left === "auto" ? "0px" : "auto";
    this.style.bottom = this.openFrom === "bottom" ? "0px" : null;
    this.style.top = this.style.bottom === "" ? "0px" : null;
  }
  _showTransition(animate19 = true) {
    let animationControls;
    this._setInitialPosition();
    if (reduceDrawerAnimation) {
      animationControls = motionAnimate(this, { opacity: [0, 1], visibility: ["hidden", "visible"] }, { duration: 0.2 });
    } else {
      let content = this.shadowRoot.querySelector('[part="content"]'), closeButton = this.shadowRoot.querySelector('[part="outside-close-button"]');
      animationControls = motionTimeline([
        [this, { opacity: [0, 1], visibility: ["hidden", "visible"] }, { duration: 0.15 }],
        [content, { clipPath: this._getClipPathProperties() }, { duration: 0.4, easing: [0.86, 0, 0.07, 1] }],
        [content.children, { opacity: [0, 1] }, { duration: 0.15 }],
        [closeButton, { opacity: [0, 1] }, { at: "<", duration: 0.15 }]
      ]);
    }
    animate19 ? animationControls.play() : animationControls.finish();
    return animationControls.finished.then(() => this.classList.add("show-close-cursor"));
  }
  _hideTransition() {
    let animationControls;
    if (reduceDrawerAnimation) {
      animationControls = motionAnimate(this, { opacity: [1, 0], visibility: ["visibility", "hidden"] }, { duration: 0.2 });
    } else {
      let content = this.shadowRoot.querySelector('[part="content"]'), closeButton = this.shadowRoot.querySelector('[part="outside-close-button"]');
      animationControls = motionTimeline([
        [closeButton, { opacity: [null, 0] }, { duration: 0.15 }],
        [content.children, { opacity: [null, 0] }, { at: "<", duration: 0.15 }],
        [content, { clipPath: this._getClipPathProperties().reverse() }, { duration: 0.4, easing: [0.86, 0, 0.07, 1] }],
        [this, { opacity: [null, 0], visibility: ["visible", "hidden"] }, { duration: 0.15 }]
      ]);
    }
    return animationControls.finished.then(() => this.classList.remove("show-close-cursor"));
  }
  _updateSlotVisibility(slot) {
    if (!["header", "footer", "body"].includes(slot.name)) {
      return;
    }
    slot.parentElement.hidden = slot.assignedElements({ flatten: true }).length === 0;
  }
};
if (!window.customElements.get("x-drawer")) {
  window.customElements.define("x-drawer", Drawer);
}

// js/common/overlay/popover.js
import { animate as motionAnimate2, timeline as motionTimeline2 } from "vendor";
var Popover = class extends DialogElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).appendChild(document.getElementById(this.template).content.cloneNode(true));
  }
  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.querySelector('[part="overlay"]')?.addEventListener("click", this.hide.bind(this), { signal: this._abortController.signal });
    this.controls.forEach((control) => control.setAttribute("aria-haspopup", "dialog"));
    if (this.hasAttribute("close-on-listbox-select")) {
      if (this.querySelector("x-listbox")) {
        this.addEventListener("listbox:select", this.hide, { signal: this._abortController.signal });
      } else {
        this.addEventListener("change", this.hide, { signal: this._abortController.signal });
      }
    }
  }
  get template() {
    return this.getAttribute("template") || "popover-default-template";
  }
  get shouldLock() {
    return window.matchMedia("screen and (max-width: 999px)").matches;
  }
  get shouldAppendToBody() {
    return window.matchMedia("screen and (max-width: 999px)").matches;
  }
  get anchor() {
    return {
      vertical: this.getAttribute("anchor-vertical") || "start",
      horizontal: this.getAttribute("anchor-horizontal") || "end"
    };
  }
  _showTransition(animate19 = true) {
    let animationControls, content = this.shadowRoot.querySelector('[part="content"]'), closeButton = this.shadowRoot.querySelector('[part="outside-close-button"]');
    this.style.display = "block";
    if (window.matchMedia("screen and (max-width: 999px)").matches) {
      this.style.insetInlineStart = "0px";
      this.style.insetInlineEnd = null;
      this.style.insetBlockEnd = "0px";
      this.style.insetBlockStart = null;
      animationControls = motionTimeline2([
        [this, { opacity: [0, 1], visibility: ["hidden", "visible"] }, { duration: 0.15 }],
        [content, { clipPath: ["inset(100% 0 0 0 round 8px)", "inset(0 0 0 0 round 8px"] }, { duration: 0.4, easing: [0.86, 0, 0.07, 1] }],
        [content.children, { opacity: [0, 1] }, { duration: 0.15 }],
        [closeButton, { opacity: [0, 1] }, { at: "<", duration: 0.15 }]
      ]);
    } else {
      let spacingBlockValue = "var(--popover-anchor-block-spacing)", spacingInlineValue = "var(--popover-anchor-inline-spacing)";
      this.style.insetInlineStart = this.anchor.horizontal === "start" ? spacingInlineValue : null;
      this.style.insetInlineEnd = this.anchor.horizontal === "end" ? spacingInlineValue : null;
      if (this.anchor.vertical === "center") {
        this.style.insetBlockStart = `calc(50% - ${parseInt(this.clientHeight / 2)}px)`;
        this.style.insetBlockEnd = null;
      } else {
        this.style.insetBlockStart = this.anchor.vertical === "end" ? `calc(100% + ${spacingBlockValue})` : null;
        this.style.insetBlockEnd = this.anchor.vertical === "start" ? `calc(100% + ${spacingBlockValue})` : null;
      }
      animationControls = motionTimeline2([
        [this, { opacity: [0, 1], visibility: ["hidden", "visible"] }, { duration: 0.15 }],
        [content, { clipPath: "none" }, { at: "<", duration: 0 }],
        [content.children, { opacity: 1 }, { at: "<", duration: 0 }]
      ]);
    }
    animate19 ? animationControls.play() : animationControls.finish();
    return animationControls.finished;
  }
  _hideTransition() {
    let animationControls;
    if (window.matchMedia("screen and (max-width: 999px)").matches) {
      let content = this.shadowRoot.querySelector('[part="content"]'), closeButton = this.shadowRoot.querySelector('[part="outside-close-button"]');
      animationControls = motionTimeline2([
        [closeButton, { opacity: [null, 0] }, { duration: 0.15 }],
        [content.children, { opacity: [null, 0] }, { at: "<", duration: 0.15 }],
        [content, { clipPath: [null, "inset(100% 0 0 0 round 8px)"] }, { duration: 0.4, easing: [0.86, 0, 0.07, 1] }],
        [this, { opacity: [null, 0], visibility: ["visible", "hidden"] }, { duration: 0.15 }]
      ]);
    } else {
      animationControls = motionAnimate2(this, { opacity: [null, 0], visibility: ["visible", "hidden"] }, { duration: 0.15 });
    }
    return animationControls.finished.then(() => this.style.display = "none");
  }
};
if (!window.customElements.get("x-popover")) {
  window.customElements.define("x-popover", Popover);
}

// js/common/overlay/privacy-bar.js
import { Delegate as Delegate2 } from "vendor";
var PrivacyBar = class extends HTMLElement {
  constructor() {
    super();
    this._delegate = new Delegate2(this);
    window.Shopify.loadFeatures([{
      name: "consent-tracking-api",
      version: "0.1",
      onLoad: this._onConsentLibraryLoaded.bind(this)
    }]);
    if (Shopify.designMode) {
      const section = this.closest(".shopify-section");
      section.addEventListener("shopify:section:select", this.show.bind(this));
      section.addEventListener("shopify:section:deselect", this.hide.bind(this));
    }
  }
  connectedCallback() {
    this._delegate.on("click", '[data-action="accept"]', this._acceptPolicy.bind(this));
    this._delegate.on("click", '[data-action="decline"]', this._declinePolicy.bind(this));
    this._delegate.on("click", '[data-action="close"]', this.hide.bind(this));
  }
  disconnectedCallback() {
    this._delegate.off();
  }
  show() {
    this.hidden = false;
  }
  hide() {
    this.hidden = true;
  }
  _onConsentLibraryLoaded() {
    if (window.Shopify.customerPrivacy?.shouldShowBanner()) {
      this.show();
    }
  }
  _acceptPolicy() {
    window.Shopify.customerPrivacy?.setTrackingConsent(true, this.hide.bind(this));
  }
  _declinePolicy() {
    window.Shopify.customerPrivacy?.setTrackingConsent(false, this.hide.bind(this));
  }
};
if (!window.customElements.get("privacy-bar")) {
  window.customElements.define("privacy-bar", PrivacyBar);
}

// js/common/cart/cart-drawer.js
var CartDrawer = class extends Drawer {
  constructor() {
    super();
    this._onPrepareBundledSectionsListener = this._onPrepareBundledSections.bind(this);
    this._onCartChangedListener = this._onCartChanged.bind(this);
    this._onCartRefreshListener = this._onCartRefresh.bind(this);
    this._onVariantAddedListener = this._onVariantAdded.bind(this);
    window.addEventListener("pageshow", this._onPageShow.bind(this));
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("cart:prepare-bundled-sections", this._onPrepareBundledSectionsListener);
    document.addEventListener("cart:change", this._onCartChangedListener);
    document.addEventListener("cart:refresh", this._onCartRefreshListener);
    document.addEventListener("variant:add", this._onVariantAddedListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("cart:prepare-bundled-sections", this._onPrepareBundledSectionsListener);
    document.removeEventListener("cart:change", this._onCartChangedListener);
    document.removeEventListener("cart:refresh", this._onCartRefreshListener);
    document.removeEventListener("variant:add", this._onVariantAddedListener);
  }
  get shouldAppendToBody() {
    return false;
  }
  get openFrom() {
    return "right";
  }
  _onPrepareBundledSections(event) {
    event.detail.sections.push(extractSectionId(this));
  }
  /**
   * Update the cart drawer content when cart content changes.
   */
  async _onCartChanged(event) {
    const updatedDrawerContent = new DOMParser().parseFromString(event.detail.cart["sections"][extractSectionId(this)], "text/html");
    if (event.detail.cart["item_count"] > 0) {
      const currentInner = this.querySelector(".cart-drawer__inner"), updatedInner = updatedDrawerContent.querySelector(".cart-drawer__inner");
      if (!currentInner) {
        this.replaceChildren(document.createRange().createContextualFragment(updatedDrawerContent.querySelector(".cart-drawer").innerHTML));
      } else {
        setTimeout(() => {
          currentInner.innerHTML = updatedInner.innerHTML;
        }, event.detail.baseEvent === "variant:add" ? 0 : 1250);
        this.querySelector('[slot="footer"]').replaceChildren(...updatedDrawerContent.querySelector('[slot="footer"]').childNodes);
      }
    } else {
      await animate4(this.children, { opacity: 0 }, { duration: 0.15 }).finished;
      this.replaceChildren(...updatedDrawerContent.querySelector(".cart-drawer").childNodes);
      animate4(this.querySelector(".empty-state"), { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] }, { duration: 0.15 });
    }
  }
  /**
   * Handle the case when the page is served from BF cache
   */
  _onPageShow(event) {
    if (!event.persisted) {
      return;
    }
    this._onCartRefresh();
  }
  /**
   * Listeners called when a new variant has been added
   */
  _onVariantAdded(event) {
    if (window.themeVariables.settings.cartType !== "drawer" || event.detail?.blockCartDrawerOpening) {
      return;
    }
    this.show();
  }
  /**
   * Force a complete refresh of the cart drawer (this is called by dispatching the 'cart:refresh' on the document)
   */
  async _onCartRefresh() {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = await (await fetch(`${window.Shopify.routes.root}?section_id=${extractSectionId(this)}`)).text();
    this.replaceChildren(...tempDiv.querySelector("#cart-drawer").children);
  }
};
var CartNotificationDrawer = class extends Drawer {
  constructor() {
    super();
    this._onVariantAddedListener = this._onVariantAdded.bind(this);
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("variant:add", this._onVariantAddedListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("variant:add", this._onVariantAddedListener);
  }
  async show() {
    this.style.display = "block";
    return super.show();
  }
  async hide() {
    super.hide()?.then(() => {
      this.style.display = "none";
    });
  }
  _onVariantAdded(event) {
    if (window.themeVariables.settings.cartType !== "popover" || event.detail?.blockCartDrawerOpening) {
      return;
    }
    const tempContent = document.createElement("div");
    tempContent.innerHTML = event.detail.cart["sections"]["variant-added"];
    this.replaceChildren(...tempContent.querySelector(".shopify-section").children);
    this.show();
  }
};
var LineItem = class extends HTMLElement {
  connectedCallback() {
    this.pillLoaderElement = this.querySelector("pill-loader");
    this.addEventListener("line-item:will-change", this._onWillChange.bind(this));
    this.addEventListener("line-item:error", this._onErrored.bind(this));
    this.addEventListener("line-item:change", this._onChanged.bind(this));
  }
  _onWillChange() {
    this.pillLoaderElement.setAttribute("aria-busy", "true");
  }
  _onErrored() {
    this.pillLoaderElement.removeAttribute("aria-busy");
  }
  async _onChanged(event) {
    this.pillLoaderElement.removeAttribute("aria-busy");
    if (event.detail.cart["item_count"] === 0 || event.detail.quantity !== 0) {
      return;
    }
    let marginCompensation = 0;
    if (this.nextElementSibling) {
      marginCompensation = `-${getComputedStyle(this.nextElementSibling).paddingTop}`;
    }
    await animate4(this, { height: [`${this.clientHeight}px`, 0], marginBottom: [0, marginCompensation], overflow: "hidden", opacity: [1, 0] }, { duration: 0.2, easing: "ease" }).finished;
    this.remove();
  }
};
if (!window.customElements.get("cart-drawer")) {
  window.customElements.define("cart-drawer", CartDrawer);
}
if (!window.customElements.get("cart-notification-drawer")) {
  window.customElements.define("cart-notification-drawer", CartNotificationDrawer);
}
if (!window.customElements.get("line-item")) {
  window.customElements.define("line-item", LineItem);
}

// js/common/cart/cart-note.js
var CartNote = class extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("change", this._onNoteChanged);
  }
  _onNoteChanged(event) {
    if (event.target.getAttribute("name") !== "note") {
      return;
    }
    fetch(`${Shopify.routes.root}cart/update.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: event.target.value }),
      keepalive: true
      // Allows to make sure the request is fired even when submitting the form
    });
  }
};
var CartNoteDialog = class extends DialogElement {
  constructor() {
    super();
    this.addEventListener("change", this._onNoteChanged);
  }
  _onNoteChanged(event) {
    if (event.target.value === "") {
      this.controls.forEach((control) => control.innerHTML = `<span class="link text-sm text-subdued">${window.themeVariables.strings.addOrderNote}</span>`);
    } else {
      this.controls.forEach((control) => control.innerHTML = `<span class="link text-sm text-subdued">${window.themeVariables.strings.editOrderNote}</span>`);
    }
  }
};
if (!window.customElements.get("cart-note")) {
  window.customElements.define("cart-note", CartNote);
}
if (!window.customElements.get("cart-note-dialog")) {
  window.customElements.define("cart-note-dialog", CartNoteDialog);
}

// js/common/cart/free-shipping-bar.js
var FreeShippingBar = class extends HTMLElement {
  static get observedAttributes() {
    return ["threshold", "total-price"];
  }
  constructor() {
    super();
    this._onCartChangedListener = this._onCartChanged.bind(this);
    this._currencyFormatter = new Intl.NumberFormat(Shopify.locale, { style: "currency", currency: Shopify.currency.active });
  }
  async connectedCallback() {
    this.threshold = Math.round(this.threshold * (Shopify.currency.rate || 1));
    document.addEventListener("cart:change", this._onCartChangedListener);
  }
  disconnectedCallback() {
    document.removeEventListener("cart:change", this._onCartChangedListener);
  }
  get threshold() {
    return parseFloat(this.getAttribute("threshold"));
  }
  set threshold(value) {
    this.setAttribute("threshold", value);
  }
  get totalPrice() {
    return parseFloat(this.getAttribute("total-price"));
  }
  set totalPrice(value) {
    this.setAttribute("total-price", value);
  }
  async attributeChangedCallback(attribute, oldValue, newValue) {
    await window.customElements.whenDefined("progress-bar");
    const progressBarElement = this.querySelector("progress-bar");
    switch (attribute) {
      case "threshold":
        progressBarElement.valueMax = newValue;
        break;
      case "total-price":
        progressBarElement.valueNow = newValue;
        break;
    }
    this._updateMessage();
  }
  _updateMessage() {
    const messageElement = this.querySelector("span");
    if (this.totalPrice >= this.threshold) {
      messageElement.innerHTML = this.getAttribute("reached-message");
    } else {
      const replacement = `<span class="bold text-accent">${this._currencyFormatter.format((this.threshold - this.totalPrice) / 100).replace(/\$/g, "$$$$")}</span>`;
      messageElement.innerHTML = this.getAttribute("unreached-message").replace(new RegExp("({{.*}})", "g"), replacement);
    }
  }
  _onCartChanged(event) {
    const priceForItems = event.detail["cart"]["items"].filter((item) => item["requires_shipping"]).reduce((sum, item) => sum + item["final_line_price"], 0), cartDiscount = event.detail["cart"]["cart_level_discount_applications"].reduce((sum, discountAllocation) => sum + discountAllocation["total_allocated_amount"], 0);
    this.totalPrice = priceForItems - cartDiscount;
  }
};
if (!window.customElements.get("free-shipping-bar")) {
  window.customElements.define("free-shipping-bar", FreeShippingBar);
}

// js/common/cart/line-item-quantity.js
var LineItemQuantity = class extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("change", this._onQuantityChanged);
    this.addEventListener("click", this._onRemoveLinkClicked);
  }
  _onQuantityChanged(event) {
    if (!event.target.hasAttribute("data-line-key")) {
      return;
    }
    this._changeLineItemQuantity(event.target.getAttribute("data-line-key"), parseInt(event.target.value));
  }
  _onRemoveLinkClicked(event) {
    if (event.target.tagName !== "A" || !event.target.href.includes("/cart/change")) {
      return;
    }
    event.preventDefault();
    const url = new URL(event.target.href);
    this._changeLineItemQuantity(url.searchParams.get("id"), parseInt(url.searchParams.get("quantity")));
  }
  async _changeLineItemQuantity(lineKey, targetQuantity) {
    const lineItem = this.closest("line-item");
    lineItem?.dispatchEvent(new CustomEvent("line-item:will-change", { bubbles: true, detail: { targetQuantity } }));
    let sectionsToBundle = [];
    document.documentElement.dispatchEvent(new CustomEvent("cart:prepare-bundled-sections", { bubbles: true, detail: { sections: sectionsToBundle } }));
    const response = await fetch(`${Shopify.routes.root}cart/change.js`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: lineKey,
        quantity: targetQuantity,
        sections: sectionsToBundle
      })
    });
    if (!response.ok) {
      const responseContent = await response.json();
      this.closest(".line-item, tr").querySelector('[role="alert"]')?.remove();
      const errorSvg = `<svg width="14" viewBox="0 0 18 18">
        <path d="M0 9C0 4.02944 4.02944 0 9 0C13.9706 0 18 4.02944 18 9C18 13.9706 13.9706 18 9 18C4.02944 18 0 13.9706 0 9Z" fill="#eb001b"></path>
        <path d="M5.29289 6.70711L11.2929 12.7071L12.7071 11.2929L6.70711 5.29289L5.29289 6.70711ZM6.70711 12.7071L12.7071 6.70711L11.2929 5.2929L5.29289 11.2929L6.70711 12.7071Z" fill="#ffffff"></path>
      </svg>`;
      this.closest(".line-item, tr").querySelector(".line-item__info").insertAdjacentHTML("beforeend", `<p class="text-with-icon text-error text-xs" role="alert">${errorSvg} ${responseContent["description"]}</p>`);
      this.querySelector(".quantity-input").value = this.querySelector(".quantity-input").defaultValue;
      lineItem?.dispatchEvent(new CustomEvent("line-item:error", { bubbles: true }));
    } else {
      const cartContent = await response.json();
      if (window.themeVariables.settings.pageType === "cart") {
        window.location.reload();
      } else {
        const lineItemAfterChange = cartContent["items"].filter((lineItem2) => lineItem2["key"] === lineKey);
        lineItem?.dispatchEvent(new CustomEvent("line-item:change", {
          bubbles: true,
          detail: {
            quantity: lineItemAfterChange.length === 0 ? 0 : lineItemAfterChange[0]["quantity"],
            cart: cartContent
          }
        }));
        document.documentElement.dispatchEvent(new CustomEvent("cart:change", {
          bubbles: true,
          detail: {
            baseEvent: "line-item:change",
            cart: cartContent
          }
        }));
      }
    }
  }
};
if (!window.customElements.get("line-item-quantity")) {
  window.customElements.define("line-item-quantity", LineItemQuantity);
}

// js/common/cart/shipping-estimator.js
var ShippingEstimator = class extends HTMLElement {
  constructor() {
    super();
    this._estimateShippingListener = this._estimateShipping.bind(this);
  }
  connectedCallback() {
    this.submitButton = this.querySelector('[type="submit"]');
    this.resultsElement = this.lastElementChild;
    this.submitButton.addEventListener("click", this._estimateShippingListener);
  }
  disconnectedCallback() {
    this.submitButton.removeEventListener("click", this._estimateShippingListener);
  }
  /**
   * @doc https://shopify.dev/docs/themes/ajax-api/reference/cart#generate-shipping-rates
   */
  async _estimateShipping(event) {
    event.preventDefault();
    const zip = this.querySelector('[name="address[zip]"]').value, country = this.querySelector('[name="address[country]"]').value, province = this.querySelector('[name="address[province]"]').value;
    this.submitButton.setAttribute("aria-busy", "true");
    const prepareResponse = await fetch(`${Shopify.routes.root}cart/prepare_shipping_rates.json?shipping_address[zip]=${zip}&shipping_address[country]=${country}&shipping_address[province]=${province}`, { method: "POST" });
    if (prepareResponse.ok) {
      const shippingRates = await this._getAsyncShippingRates(zip, country, province);
      this._formatShippingRates(shippingRates);
    } else {
      const jsonError = await prepareResponse.json();
      this._formatError(jsonError);
    }
    this.resultsElement.hidden = false;
    this.submitButton.removeAttribute("aria-busy");
  }
  async _getAsyncShippingRates(zip, country, province) {
    const response = await fetch(`${Shopify.routes.root}cart/async_shipping_rates.json?shipping_address[zip]=${zip}&shipping_address[country]=${country}&shipping_address[province]=${province}`);
    const responseAsText = await response.text();
    if (responseAsText === "null") {
      return this._getAsyncShippingRates(zip, country, province);
    } else {
      return JSON.parse(responseAsText)["shipping_rates"];
    }
  }
  _formatShippingRates(shippingRates) {
    let formattedShippingRates = shippingRates.map((shippingRate) => {
      return `<li>${shippingRate["presentment_name"]}: ${shippingRate["currency"]} ${shippingRate["price"]}</li>`;
    });
    this.resultsElement.innerHTML = `
      <div class="v-stack gap-2">
        <p>${shippingRates.length === 0 ? window.themeVariables.strings.shippingEstimatorNoResults : shippingRates.length === 1 ? window.themeVariables.strings.shippingEstimatorOneResult : window.themeVariables.strings.shippingEstimatorMultipleResults}</p>
        ${formattedShippingRates === "" ? "" : `<ul class="list-disc" role="list">${formattedShippingRates.join("")}</ul>`}
      </div>
    `;
  }
  _formatError(errors) {
    let formattedShippingRates = Object.keys(errors).map((errorKey) => {
      return `<li>${errors[errorKey]}</li>`;
    });
    this.resultsElement.innerHTML = `
      <div class="v-stack gap-2">
        <p>${window.themeVariables.strings.shippingEstimatorError}</p>
        <ul class="list-disc" role="list">${formattedShippingRates}</ul>
      </div>
    `;
  }
};
if (!window.customElements.get("shipping-estimator")) {
  window.customElements.define("shipping-estimator", ShippingEstimator);
}

// js/common/facets/facet-apply-button.js
var FacetApplyButton = class extends HTMLButtonElement {
  constructor() {
    super();
    this.addEventListener("click", this._closeDrawer);
    this.form.addEventListener("change", this._updateCount.bind(this));
    this.filterCountElement = document.createElement("span");
    this.appendChild(this.filterCountElement);
  }
  connectedCallback() {
    this._updateCount();
  }
  _updateCount() {
    const form = new FormData(this.form);
    let nonEmptyValuesCount = Array.from(form.values()).filter((item) => item !== "").length;
    if (form.has("sort_by")) {
      nonEmptyValuesCount -= 1;
    }
    this.filterCountElement.innerText = ` (${nonEmptyValuesCount})`;
  }
  async _closeDrawer() {
    this.closest("facet-drawer").hide();
  }
};
if (!window.customElements.get("facet-apply-button")) {
  window.customElements.define("facet-apply-button", FacetApplyButton, { extends: "button" });
}

// js/common/facets/facet-dialog.js
var FacetDialog = class extends DialogElement {
  get initialFocus() {
    return false;
  }
};
if (!window.customElements.get("facet-dialog")) {
  window.customElements.define("facet-dialog", FacetDialog);
}

// js/common/facets/facet-drawer.js
var FacetDrawer = class extends Drawer {
  constructor() {
    super();
    this.addEventListener("dialog:after-hide", this._submitForm);
  }
  _submitForm() {
    const form = this.querySelector("#facet-form");
    if (HTMLFormElement.prototype.requestSubmit) {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  }
};
if (!window.customElements.get("facet-drawer")) {
  window.customElements.define("facet-drawer", FacetDrawer);
}

// js/common/facets/facet-floating-filter.js
import { animate as animate5 } from "vendor";
var FacetFloatingFilter = class extends HTMLElement {
  connectedCallback() {
    new IntersectionObserver(this._onFooterVisibilityChanged.bind(this), { rootMargin: "50px 0px" }).observe(document.querySelector(".shopify-section--footer"));
  }
  _onFooterVisibilityChanged(entries) {
    if (entries[0].isIntersecting) {
      animate5(this, { opacity: 0, transform: [null, "translateY(15px)"], visibility: "hidden" }, { duration: 0.15 });
    } else {
      animate5(this, { opacity: 1, transform: [null, "translateY(0)"], visibility: "visible" }, { duration: 0.15 });
    }
  }
};
if (!window.customElements.get("facet-floating-filter")) {
  window.customElements.define("facet-floating-filter", FacetFloatingFilter);
}

// js/common/facets/facet-form.js
var abortController = null;
var openElements = /* @__PURE__ */ new Set();
document.addEventListener("facet:update", async (event) => {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const url = event.detail.url, shopifySection = document.getElementById(`shopify-section-${url.searchParams.get("section_id")}`);
  shopifySection.classList.add("is-loading");
  const clonedUrl = new URL(url);
  clonedUrl.searchParams.delete("section_id");
  history.replaceState({}, "", clonedUrl.toString());
  try {
    const tempContent = new DOMParser().parseFromString(await (await cachedFetch(url.toString(), { signal: abortController.signal })).text(), "text/html");
    Array.from(tempContent.querySelectorAll("details, facet-dialog")).forEach((item) => {
      if (openElements.has(item.id)) {
        item.setAttribute("open", "");
      }
    });
    shopifySection.replaceChildren(...document.importNode(tempContent.querySelector(".shopify-section"), true).childNodes);
    shopifySection.classList.remove("is-loading");
    const scrollToElement = window.matchMedia("(min-width: 700px) and (max-width: 999px)").matches ? shopifySection.querySelector(".collection__results") : shopifySection.querySelector(".collection__results product-list"), scrollToBoundingRect = scrollToElement.getBoundingClientRect();
    if (scrollToBoundingRect.top < parseInt(getComputedStyle(scrollToElement).scrollPaddingTop || 0)) {
      scrollToElement.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  } catch (e) {
  }
});
var FacetForm = class extends HTMLFormElement {
  constructor() {
    super();
    this._isDirty = false;
    this.addEventListener("change", this._onFormChanged);
    this.addEventListener("submit", this._onFormSubmitted);
  }
  connectedCallback() {
    Array.from(this.querySelectorAll("details, facet-dialog")).forEach((disclosureElement) => {
      if (disclosureElement.open) {
        openElements.add(disclosureElement.id);
      }
      disclosureElement.addEventListener("toggle", () => {
        if (disclosureElement.open) {
          openElements.add(disclosureElement.id);
        } else {
          openElements.delete(disclosureElement.id);
        }
      });
    });
  }
  _buildUrl() {
    const searchParams = new URLSearchParams(new FormData(this)), url = new URL(this.action);
    url.search = "";
    searchParams.forEach((value, key) => url.searchParams.append(key, value));
    ["page", "filter.v.price.gte", "filter.v.price.lte"].forEach((optionToClear) => {
      if (url.searchParams.get(optionToClear) === "") {
        url.searchParams.delete(optionToClear);
      }
    });
    url.searchParams.set("section_id", this.getAttribute("section-id"));
    return url;
  }
  _onFormChanged() {
    this._isDirty = true;
    if (this.hasAttribute("update-on-change")) {
      if (HTMLFormElement.prototype.requestSubmit) {
        this.requestSubmit();
      } else {
        this.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    } else {
      cachedFetch(this._buildUrl().toString());
    }
  }
  _onFormSubmitted(event) {
    event.preventDefault();
    if (!this._isDirty) {
      return;
    }
    this.dispatchEvent(new CustomEvent("facet:update", {
      bubbles: true,
      detail: {
        url: this._buildUrl()
      }
    }));
    this._isDirty = false;
  }
};
if (!window.customElements.get("facet-form")) {
  window.customElements.define("facet-form", FacetForm, { extends: "form" });
}

// js/common/facets/facet-link.js
var FacetLink = class extends HTMLAnchorElement {
  constructor() {
    super();
    this.addEventListener("click", this._onFacetUpdate);
  }
  _onFacetUpdate(event) {
    event.preventDefault();
    const sectionId = event.target.closest(".shopify-section").id.replace("shopify-section-", ""), url = new URL(this.href);
    url.searchParams.set("section_id", sectionId);
    this.dispatchEvent(new CustomEvent("facet:update", {
      bubbles: true,
      detail: {
        url
      }
    }));
  }
};
if (!window.customElements.get("facet-link")) {
  window.customElements.define("facet-link", FacetLink, { extends: "a" });
}

// js/common/facets/facet-sort-by.js
var FacetSortBy = class extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("listbox:change", this._onValueChanged);
  }
  _onValueChanged(event) {
    const url = new URL(location.href), sectionId = event.target.closest(".shopify-section").id.replace("shopify-section-", "");
    url.searchParams.set("sort_by", event.detail.value);
    url.searchParams.set("section_id", sectionId);
    url.searchParams.delete("page");
    if (window.themeVariables.settings.pageType === "search") {
      url.searchParams.set("type", "product");
    }
    this.dispatchEvent(new CustomEvent("facet:update", {
      bubbles: true,
      detail: {
        url
      }
    }));
  }
};
if (!window.customElements.get("facet-sort-by")) {
  window.customElements.define("facet-sort-by", FacetSortBy);
}

// js/common/feedback/pill-loader.js
import { animate as animate6, timeline as timeline4, stagger as stagger4 } from "vendor";
var PillLoader = class extends HTMLElement {
  static get observedAttributes() {
    return ["aria-busy"];
  }
  connectedCallback() {
    this.innerHTML = `
      <div class="loader-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      
      <svg class="loader-checkmark" fill="none" width="9" height="8" viewBox="0 0 9 8">
        <path d="M1 3.5 3.3 6 8 1" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (newValue === "true") {
      timeline4([
        [this, { opacity: [0, 1], visibility: "visible", transform: ["translateY(5px)", "translateY(0)"] }, { duration: 0.15 }],
        [this.firstElementChild, { opacity: 1, transform: ["translateY(0)"] }, { duration: 0.15, at: "<" }],
        [this.lastElementChild, { opacity: 0 }, { duration: 0, at: "<" }]
      ]);
      animate6(this.firstElementChild.querySelectorAll("span"), { opacity: [1, 0.1] }, { duration: 0.35, delay: stagger4(0.35 / 3), direction: "alternate", repeat: Infinity });
    } else {
      timeline4([
        [this.firstElementChild, { opacity: 0, transform: ["translateY(0)", "translateY(-2px)"] }, { duration: 0.15 }],
        [this.lastElementChild, { opacity: 1, transform: ["translateY(2px)", "translateY(0)"] }, { duration: 0.15 }],
        [this, { opacity: 0, transform: ["translateY(0)", "translateY(-5px)"], visibility: "hidden" }, { duration: 0.15, at: "+0.8" }]
      ]);
    }
  }
};
if (!window.customElements.get("pill-loader")) {
  window.customElements.define("pill-loader", PillLoader);
}

// js/common/feedback/progress-bar.js
var ProgressBar = class extends HTMLElement {
  static get observedAttributes() {
    return ["aria-valuenow", "aria-valuemax"];
  }
  set valueMax(value) {
    this.setAttribute("aria-valuemax", value);
  }
  set valueNow(value) {
    this.setAttribute("aria-valuenow", value);
  }
  attributeChangedCallback() {
    this.style.setProperty("--progress", `${Math.min(1, this.getAttribute("aria-valuenow") / this.getAttribute("aria-valuemax"))}`);
  }
};
if (!window.customElements.get("progress-bar")) {
  window.customElements.define("progress-bar", ProgressBar);
}

// js/common/form/price-range.js
var PriceRange = class extends HTMLElement {
  connectedCallback() {
    this._abortController = new AbortController();
    this.rangeLowerBound = this.querySelector('input[type="range"]:first-child');
    this.rangeHigherBound = this.querySelector('input[type="range"]:last-child');
    this.textInputLowerBound = this.querySelector('input[name="filter.v.price.gte"]');
    this.textInputHigherBound = this.querySelector('input[name="filter.v.price.lte"]');
    this.textInputLowerBound.addEventListener("focus", () => this.textInputLowerBound.select(), { signal: this._abortController.signal });
    this.textInputHigherBound.addEventListener("focus", () => this.textInputHigherBound.select(), { signal: this._abortController.signal });
    this.textInputLowerBound.addEventListener("change", (event) => {
      event.preventDefault();
      event.target.value = Math.max(Math.min(parseInt(event.target.value), parseInt(this.textInputHigherBound.value || event.target.max) - 1), event.target.min);
      this.rangeLowerBound.value = event.target.value;
      this.rangeLowerBound.parentElement.style.setProperty("--range-min", `${parseInt(this.rangeLowerBound.value) / parseInt(this.rangeLowerBound.max) * 100}%`);
    }, { signal: this._abortController.signal });
    this.textInputHigherBound.addEventListener("change", (event) => {
      event.preventDefault();
      event.target.value = Math.min(Math.max(parseInt(event.target.value), parseInt(this.textInputLowerBound.value || event.target.min) + 1), event.target.max);
      this.rangeHigherBound.value = event.target.value;
      this.rangeHigherBound.parentElement.style.setProperty("--range-max", `${parseInt(this.rangeHigherBound.value) / parseInt(this.rangeHigherBound.max) * 100}%`);
    }, { signal: this._abortController.signal });
    this.rangeLowerBound.addEventListener("change", (event) => {
      event.stopPropagation();
      this.textInputLowerBound.value = event.target.value;
      this.textInputLowerBound.dispatchEvent(new Event("change", { bubbles: true }));
    }, { signal: this._abortController.signal });
    this.rangeHigherBound.addEventListener("change", (event) => {
      event.stopPropagation();
      this.textInputHigherBound.value = event.target.value;
      this.textInputHigherBound.dispatchEvent(new Event("change", { bubbles: true }));
    }, { signal: this._abortController.signal });
    this.rangeLowerBound.addEventListener("input", (event) => {
      event.target.value = Math.min(parseInt(event.target.value), parseInt(this.textInputHigherBound.value || event.target.max) - 1);
      event.target.parentElement.style.setProperty("--range-min", `${parseInt(event.target.value) / parseInt(event.target.max) * 100}%`);
      this.textInputLowerBound.value = event.target.value;
    }, { signal: this._abortController.signal });
    this.rangeHigherBound.addEventListener("input", (event) => {
      event.target.value = Math.max(parseInt(event.target.value), parseInt(this.textInputLowerBound.value || event.target.min) + 1);
      event.target.parentElement.style.setProperty("--range-max", `${parseInt(event.target.value) / parseInt(event.target.max) * 100}%`);
      this.textInputHigherBound.value = event.target.value;
    }, { signal: this._abortController.signal });
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
};
if (!window.customElements.get("price-range")) {
  window.customElements.define("price-range", PriceRange);
}

// js/common/form/quantity-selector.js
var QuantitySelector = class extends HTMLElement {
  connectedCallback() {
    this._abortController = new AbortController();
    this.inputElement = this.querySelector("input");
    this.querySelector("button:first-of-type").addEventListener("click", this.stepDown.bind(this), { signal: this._abortController.signal });
    this.querySelector("button:last-of-type").addEventListener("click", this.stepUp.bind(this), { signal: this._abortController.signal });
  }
  stepDown() {
    this.inputElement.stepDown();
    this.inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    announceStatus(this.inputElement.value);
  }
  stepUp() {
    this.inputElement.stepUp();
    this.inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    announceStatus(this.inputElement.value);
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
};
var QuantityInput = class extends HTMLInputElement {
  constructor() {
    super();
    this.addEventListener("input", this._onValueInput);
    this.addEventListener("change", this._onValueChanged);
    this.addEventListener("focus", this.select);
  }
  disconnectedCallback() {
    this._abortController?.abort();
  }
  get quantity() {
    return parseInt(this.value);
  }
  set quantity(quantity) {
    const isNumeric = (typeof quantity === "number" || typeof quantity === "string" && quantity.trim() !== "") && !isNaN(quantity);
    if (quantity === "") {
      return;
    }
    if (!isNumeric || quantity < 0) {
      quantity = parseInt(quantity) || 1;
    }
    this.value = Math.max(this.min || 1, Math.min(quantity, this.max || Number.MAX_VALUE)).toString();
    if (!this.checkValidity()) {
      this.stepDown();
    }
  }
  _onValueInput() {
    this.quantity = this.value;
    this.style.setProperty("--quantity-input-characters-count", `${this.value.toString().length}ch`);
  }
  _onValueChanged() {
    if (this.value === "") {
      this.quantity = this.min || 1;
    }
    if (!this.checkValidity()) {
      this.stepDown();
    }
    this.style.setProperty("--quantity-input-characters-count", `${this.value.toString().length}ch`);
  }
};
if (!window.customElements.get("quantity-selector")) {
  window.customElements.define("quantity-selector", QuantitySelector);
}
if (!window.customElements.get("quantity-input")) {
  window.customElements.define("quantity-input", QuantityInput, { extends: "input" });
}

// js/common/form/resizable-textarea.js
var ResizableTextarea = class extends HTMLTextAreaElement {
  constructor() {
    super();
    this.addEventListener("input", this._onInput);
  }
  _onInput() {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + 2 + "px";
  }
};
if (!window.customElements.get("resizable-textarea")) {
  window.customElements.define("resizable-textarea", ResizableTextarea, { extends: "textarea" });
}

// js/common/list/listbox.js
var _accessibilityInitialized, _hiddenInput, _Listbox_instances, onOptionClicked_fn, onInputChanged_fn, onKeyDown_fn;
var Listbox = class extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _Listbox_instances);
    __privateAdd(this, _accessibilityInitialized, false);
    __privateAdd(this, _hiddenInput);
    this.addEventListener("keydown", __privateMethod(this, _Listbox_instances, onKeyDown_fn));
  }
  static get observedAttributes() {
    return ["aria-activedescendant"];
  }
  connectedCallback() {
    if (!__privateGet(this, _accessibilityInitialized)) {
      this.setAttribute("role", "listbox");
      __privateSet(this, _hiddenInput, this.querySelector('input[type="hidden"]'));
      __privateGet(this, _hiddenInput)?.addEventListener("change", __privateMethod(this, _Listbox_instances, onInputChanged_fn).bind(this));
      Array.from(this.querySelectorAll('[role="option"]')).forEach((option) => {
        option.addEventListener("click", __privateMethod(this, _Listbox_instances, onOptionClicked_fn).bind(this));
        option.id = "option-" + (crypto.randomUUID ? crypto.randomUUID() : Math.floor(Math.random() * 1e4));
        if (option.getAttribute("aria-selected") === "true") {
          this.setAttribute("aria-activedescendant", option.id);
        }
      });
      __privateSet(this, _accessibilityInitialized, true);
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "aria-activedescendant" && oldValue !== null && newValue !== oldValue) {
      Array.from(this.querySelectorAll('[role="option"]')).forEach((option) => {
        if (option.id === newValue) {
          option.setAttribute("aria-selected", "true");
          if (__privateGet(this, _hiddenInput) && __privateGet(this, _hiddenInput).value !== option.value) {
            __privateGet(this, _hiddenInput).value = option.value;
            __privateGet(this, _hiddenInput).dispatchEvent(new Event("change", { bubbles: true }));
          }
          if (this.hasAttribute("aria-owns")) {
            this.getAttribute("aria-owns").split(" ").forEach((boundId) => {
              document.getElementById(boundId).textContent = option.getAttribute("title") || option.innerText || option.value;
            });
          }
          option.dispatchEvent(new CustomEvent("listbox:change", {
            bubbles: true,
            detail: {
              value: option.value
            }
          }));
        } else {
          option.setAttribute("aria-selected", "false");
        }
      });
    }
  }
};
_accessibilityInitialized = new WeakMap();
_hiddenInput = new WeakMap();
_Listbox_instances = new WeakSet();
onOptionClicked_fn = function(event) {
  this.setAttribute("aria-activedescendant", event.currentTarget.id);
  event.currentTarget.dispatchEvent(new CustomEvent("listbox:select", {
    bubbles: true,
    detail: {
      value: event.currentTarget.value
    }
  }));
};
onInputChanged_fn = function(event) {
  this.setAttribute("aria-activedescendant", this.querySelector(`[role="option"][value="${CSS.escape(event.target.value)}"]`).id);
};
onKeyDown_fn = function(event) {
  if (event.key === "ArrowUp") {
    event.target.previousElementSibling?.focus();
    event.preventDefault();
  } else if (event.key === "ArrowDown") {
    event.target.nextElementSibling?.focus();
    event.preventDefault();
  }
};
if (!window.customElements.get("x-listbox")) {
  window.customElements.define("x-listbox", Listbox);
}

// js/common/media/image.js
function imageLoaded(imageOrArray) {
  if (!imageOrArray) {
    return Promise.resolve();
  }
  imageOrArray = imageOrArray instanceof Element ? [imageOrArray] : Array.from(imageOrArray);
  return Promise.all(imageOrArray.map((image) => {
    return new Promise((resolve) => {
      if (image.tagName === "IMG" && image.complete || !image.offsetParent) {
        resolve();
      } else {
        image.onload = () => resolve();
      }
    });
  }));
}
function generateSrcset(imageObjectOrString, widths = []) {
  let imageUrl, maxWidth;
  if (typeof imageObjectOrString === "string") {
    imageUrl = new URL(imageObjectOrString.startsWith("//") ? `https:${imageObjectOrString}` : imageObjectOrString);
    maxWidth = parseInt(imageUrl.searchParams.get("width"));
  } else {
    imageUrl = new URL(imageObjectOrString["src"].startsWith("//") ? `https:${imageObjectOrString["src"]}` : imageObjectOrString["src"]);
    maxWidth = imageObjectOrString["width"];
  }
  return widths.filter((width) => width <= maxWidth).map((width) => {
    imageUrl.searchParams.set("width", width.toString());
    return `${imageUrl.href} ${width}w`;
  }).join(", ");
}
function createMediaImg(media, widths = [], properties = {}) {
  const image = new Image(media["preview_image"]["width"], media["preview_image"]["height"]), src = media["preview_image"]["src"], featuredMediaUrl = new URL(src.startsWith("//") ? `https:${src}` : src);
  for (const propertyKey in properties) {
    image.setAttribute(propertyKey, properties[propertyKey]);
  }
  image.alt = media["alt"];
  image.src = featuredMediaUrl.href;
  image.srcset = generateSrcset(media["preview_image"], widths);
  return image;
}

// js/common/product/gift-card-recipient.js
var _recipientCheckbox, _recipientOtherProperties, _recipientSendOnProperty, _offsetProperty, _recipientFieldsContainer, _GiftCardRecipient_instances, synchronizeProperties_fn, formatDate_fn;
var GiftCardRecipient = class extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _GiftCardRecipient_instances);
    __privateAdd(this, _recipientCheckbox);
    __privateAdd(this, _recipientOtherProperties, []);
    __privateAdd(this, _recipientSendOnProperty);
    __privateAdd(this, _offsetProperty);
    __privateAdd(this, _recipientFieldsContainer);
  }
  connectedCallback() {
    const properties = Array.from(this.querySelectorAll('[name*="properties"]')), checkboxPropertyName = "properties[__shopify_send_gift_card_to_recipient]";
    __privateSet(this, _recipientCheckbox, properties.find((input) => input.name === checkboxPropertyName));
    __privateSet(this, _recipientOtherProperties, properties.filter((input) => input.name !== checkboxPropertyName));
    __privateSet(this, _recipientFieldsContainer, this.querySelector(".gift-card-recipient__fields"));
    __privateSet(this, _offsetProperty, this.querySelector('[name="properties[__shopify_offset]"]'));
    if (__privateGet(this, _offsetProperty)) {
      __privateGet(this, _offsetProperty).value = (/* @__PURE__ */ new Date()).getTimezoneOffset().toString();
    }
    __privateSet(this, _recipientSendOnProperty, this.querySelector('[name="properties[Send on]"]'));
    const minDate = /* @__PURE__ */ new Date();
    const maxDate = /* @__PURE__ */ new Date();
    maxDate.setDate(minDate.getDate() + 90);
    __privateGet(this, _recipientSendOnProperty)?.setAttribute("min", __privateMethod(this, _GiftCardRecipient_instances, formatDate_fn).call(this, minDate));
    __privateGet(this, _recipientSendOnProperty)?.setAttribute("max", __privateMethod(this, _GiftCardRecipient_instances, formatDate_fn).call(this, maxDate));
    __privateGet(this, _recipientCheckbox)?.addEventListener("change", __privateMethod(this, _GiftCardRecipient_instances, synchronizeProperties_fn).bind(this));
    __privateMethod(this, _GiftCardRecipient_instances, synchronizeProperties_fn).call(this);
  }
};
_recipientCheckbox = new WeakMap();
_recipientOtherProperties = new WeakMap();
_recipientSendOnProperty = new WeakMap();
_offsetProperty = new WeakMap();
_recipientFieldsContainer = new WeakMap();
_GiftCardRecipient_instances = new WeakSet();
synchronizeProperties_fn = function() {
  __privateGet(this, _recipientOtherProperties).forEach((property) => property.disabled = !__privateGet(this, _recipientCheckbox).checked);
  __privateGet(this, _recipientFieldsContainer).toggleAttribute("hidden", !__privateGet(this, _recipientCheckbox).checked);
};
formatDate_fn = function(date) {
  const offset = date.getTimezoneOffset();
  const offsetDate = new Date(date.getTime() - offset * 60 * 1e3);
  return offsetDate.toISOString().split("T")[0];
};
if (!window.customElements.get("gift-card-recipient")) {
  window.customElements.define("gift-card-recipient", GiftCardRecipient);
}

// js/common/product/product-card.js
import { Delegate as Delegate3 } from "vendor";
var ProductCard = class extends HTMLElement {
  constructor() {
    super();
    this._delegate = new Delegate3(this);
  }
  connectedCallback() {
    this._delegate.on("change", '.product-card__swatch-list [type="radio"], .product-card__variant-list [type="radio"]', this._onSwatchChanged.bind(this));
    this._delegate.on("pointerover", '.product-card__swatch-list [type="radio"] + label, .product-card__variant-list [type="radio"] + label', this._onSwatchHovered.bind(this), true);
  }
  disconnectedCallback() {
    this._delegate.off();
  }
  async _onSwatchHovered(event, target) {
    const control = target.control;
    const primaryMediaElement = this.querySelector(".product-card__image--primary");
    if (control.hasAttribute("data-variant-media")) {
      this._createImageElement(JSON.parse(control.getAttribute("data-variant-media")), primaryMediaElement.className, primaryMediaElement.sizes);
    }
  }
  async _onSwatchChanged(event, target) {
    if (target.hasAttribute("data-variant-id")) {
      this.querySelectorAll(`a[href^="${Shopify.routes.root}products/${this.getAttribute("handle")}"`).forEach((link) => {
        const url = new URL(link.href);
        url.searchParams.set("variant", target.getAttribute("data-variant-id"));
        link.href = `${url.pathname}${url.search}${url.hash}`;
      });
    }
    if (!target.hasAttribute("data-variant-media")) {
      return;
    }
    const newMedia = JSON.parse(target.getAttribute("data-variant-media")), primaryMediaElement = this.querySelector(".product-card__image--primary"), secondaryMediaElement = this.querySelector(".product-card__image--secondary"), newPrimaryMediaElement = this._createImageElement(newMedia, primaryMediaElement.className, primaryMediaElement.sizes);
    let newSecondaryMediaElement = null;
    if (secondaryMediaElement && target.hasAttribute("data-variant-secondary-media")) {
      let newSecondaryMedia = JSON.parse(target.getAttribute("data-variant-secondary-media"));
      newSecondaryMediaElement = this._createImageElement(newSecondaryMedia, secondaryMediaElement.className, secondaryMediaElement.sizes);
      newSecondaryMediaElement.ariaHidden = "true";
    }
    if (primaryMediaElement.src !== newPrimaryMediaElement.src) {
      if (secondaryMediaElement && newSecondaryMediaElement) {
        secondaryMediaElement.replaceWith(newSecondaryMediaElement);
      }
      await primaryMediaElement.animate({ opacity: [1, 0] }, { duration: 150, easing: "ease-in", fill: "forwards" }).finished;
      await new Promise((resolve) => newPrimaryMediaElement.complete ? resolve() : newPrimaryMediaElement.onload = () => resolve());
      primaryMediaElement.replaceWith(newPrimaryMediaElement);
      newPrimaryMediaElement.animate({ opacity: [0, 1] }, { duration: 150, easing: "ease-in" });
    }
  }
  _createImageElement(media, classes, sizes) {
    return createMediaImg(media, [200, 300, 400, 500, 600, 700, 800, 1e3, 1200, 1400, 1600, 1800], { class: classes, sizes });
  }
};
if (!window.customElements.get("product-card")) {
  window.customElements.define("product-card", ProductCard);
}

// js/common/product/product-form.js
var ProductForm = class extends HTMLFormElement {
  #submitting = false;
  constructor() {
    super();
    this.addEventListener("submit", this._onSubmit);
  }
  connectedCallback() {
    this.id.disabled = false;
  }
  async _onSubmit(event) {
    event.preventDefault();
    if (this.#submitting) {
      return;
    }
    if (!this.checkValidity()) {
      this.reportValidity();
      return;
    }
    const submitButtons = Array.from(this.elements).filter((button) => button.type === "submit");
    submitButtons.forEach((submitButton) => {
      submitButton.setAttribute("aria-busy", "true");
    });
    let sectionsToBundle = ["variant-added"];
    document.documentElement.dispatchEvent(new CustomEvent("cart:prepare-bundled-sections", { bubbles: true, detail: { sections: sectionsToBundle } }));
    const formData = new FormData(this);
    formData.set("sections", sectionsToBundle.join(","));
    formData.set("sections_url", `${Shopify.routes.root}variants/${this.id.value}`);
    this.#submitting = true;
    const response = await fetch(`${Shopify.routes.root}cart/add.js`, {
      body: formData,
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
        // Needed for Shopify to check inventory
      }
    });
    submitButtons.forEach((submitButton) => {
      submitButton.removeAttribute("aria-busy");
    });
    this.#submitting = false;
    const responseJson = await response.json();
    if (response.ok) {
      if (window.themeVariables.settings.cartType === "page" || window.themeVariables.settings.pageType === "cart") {
        return window.location.href = `${Shopify.routes.root}cart`;
      }
      const cartContent = await (await fetch(`${Shopify.routes.root}cart.js`)).json();
      cartContent["sections"] = responseJson["sections"];
      this.dispatchEvent(new CustomEvent("variant:add", {
        bubbles: true,
        detail: {
          items: responseJson.hasOwnProperty("items") ? responseJson["items"] : [responseJson],
          cart: cartContent
        }
      }));
      document.documentElement.dispatchEvent(new CustomEvent("cart:change", {
        bubbles: true,
        detail: {
          baseEvent: "variant:add",
          cart: cartContent
        }
      }));
    } else {
      this.dispatchEvent(new CustomEvent("cart:error", {
        bubbles: true,
        detail: {
          error: responseJson["description"]
        }
      }));
      document.dispatchEvent(new CustomEvent("cart:refresh"));
    }
  }
};
if (!window.customElements.get("product-form")) {
  window.customElements.define("product-form", ProductForm, { extends: "form" });
}

// js/common/product/product-form-listeners.js
var BuyButtons = class extends HTMLElement {
  constructor() {
    super();
    this._onCartErrorListener = this._onCartError.bind(this);
    this._onVariantAddedListener = this._onVariantAdded.bind(this);
  }
  connectedCallback() {
    this._productForm = document.forms[this.getAttribute("form")];
    this._productForm?.addEventListener("cart:error", this._onCartErrorListener);
    this._productForm?.addEventListener("variant:add", this._onVariantAddedListener);
  }
  disconnectedCallback() {
    this._productForm?.removeEventListener("cart:error", this._onCartErrorListener);
    this._productForm?.removeEventListener("variant:add", this._onVariantAddedListener);
  }
  _onVariantAdded(event) {
    if (window.themeVariables.settings.cartType === "drawer" || window.themeVariables.settings.cartType === "popover") {
      const items = event.detail.items;
      let content = [];
      items.forEach((item) => {
        content.push(window.themeVariables.strings.addedToCartWithTitle.replace("{{ product_title }}", item?.title || ""));
      });
      announceStatus(content.join(", "));
    }
  }
  _onCartError(event) {
    const errorBanner = document.createElement("div");
    errorBanner.classList.add("banner", "banner--error", "justify-center");
    errorBanner.setAttribute("role", "alert");
    errorBanner.setAttribute("aria-live", "polite");
    errorBanner.style.gridColumn = "1/-1";
    errorBanner.style.marginBottom = "1rem";
    errorBanner.innerHTML = `
      <svg role="presentation" focusable="false" width="18" height="18" class="offset-icon icon icon-error" style="--icon-height: 18px" viewBox="0 0 18 18">
        <path d="M0 9C0 4.02944 4.02944 0 9 0C13.9706 0 18 4.02944 18 9C18 13.9706 13.9706 18 9 18C4.02944 18 0 13.9706 0 9Z" fill="currentColor"></path>
        <path d="M5.29289 6.70711L11.2929 12.7071L12.7071 11.2929L6.70711 5.29289L5.29289 6.70711ZM6.70711 12.7071L12.7071 6.70711L11.2929 5.2929L5.29289 11.2929L6.70711 12.7071Z" fill="#ffffff"></path>
      </svg>
      
      <p>${event.detail.error}</p>
    `;
    this.before(errorBanner);
    setTimeout(async () => {
      await errorBanner.animate({ opacity: [1, 0] }, { duration: 250, fill: "forwards" }).finished;
      errorBanner.remove();
    }, 5e3);
  }
};
if (!window.customElements.get("buy-buttons")) {
  window.customElements.define("buy-buttons", BuyButtons);
}

// js/common/product/product-gallery.js
import { PhotoSwipeLightbox } from "vendor";
var ProductGallery = class extends HTMLElement {
  connectedCallback() {
    this._abortController = new AbortController();
    const form = document.forms[this.getAttribute("form")];
    form?.addEventListener("product:rerender", this._onSectionRerender.bind(this), { signal: this._abortController.signal });
    form?.addEventListener("variant:change", this._onVariantChanged.bind(this), { signal: this._abortController.signal });
    this._carousels = Array.from(this.querySelectorAll("media-carousel"));
    this._pageDots = Array.from(this.querySelectorAll("page-dots"));
    this._viewInSpaceButton = this.querySelector("[data-shopify-xr]");
    this._customCursor = this.querySelector(".product-gallery__cursor");
    this.addEventListener("carousel:change", this._onCarouselChanged);
    if (this._viewInSpaceButton) {
      this.addEventListener("carousel:settle", this._updateViewInSpaceButton);
    }
    if (this.hasAttribute("allow-zoom")) {
      this.addEventListener("lightbox:open", (event) => this.openZoom(event.detail.index));
    }
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  get filteredIndexes() {
    return JSON.parse(this.getAttribute("filtered-indexes")).map((index) => parseInt(index) - 1);
  }
  get photoswipe() {
    if (this._photoswipe) {
      return this._photoswipe;
    }
    const photoswipe = new PhotoSwipeLightbox({
      pswpModule: () => import("photoswipe"),
      bgOpacity: 1,
      maxZoomLevel: parseInt(this.getAttribute("allow-zoom")) || 3,
      closeTitle: window.themeVariables.strings.closeGallery,
      zoomTitle: window.themeVariables.strings.zoomGallery,
      errorMsg: window.themeVariables.strings.errorGallery,
      // UX
      arrowPrev: false,
      arrowNext: false,
      counter: false,
      zoom: false,
      closeSVG: `<svg fill="none" xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <path d="M56 28C56 12.536 43.464 0 28 0S0 12.536 0 28s12.536 28 28 28 28-12.536 28-28Z" fill="#fff"/>
        <path d="M55.5 28C55.5 12.812 43.188.5 28 .5S.5 12.812.5 28 12.812 55.5 28 55.5 55.5 43.188 55.5 28Z" stroke="#252627" stroke-opacity=".12"/>
        <path d="m22.344 22.343 11.313 11.314m-11.313 0 11.313-11.313" stroke="#252627" stroke-width="2"/>
      </svg>`
    });
    photoswipe.addFilter("thumbEl", (thumbEl, data) => data["thumbnailElement"]);
    photoswipe.on("uiRegister", () => {
      photoswipe.pswp.ui.registerElement({
        name: "bottom-bar",
        order: 5,
        appendTo: "wrapper",
        html: `
          <div class="pagination">
            <button class="pagination__item group" rel="prev">
              <span class="animated-arrow animated-arrow--reverse"></span>
            </button>
            
            <span class="pagination__current text-sm">
              <span class="pagination__current-page">1</span> / <span class="pagination__page-count"></span>
            </span>
            
            <button class="pagination__item group" rel="next">
              <span class="animated-arrow"></span>
            </button>
          </div>
        `,
        onInit: (el, pswp) => {
          el.querySelector(".pagination__page-count").innerText = pswp.getNumItems();
          el.querySelector('[rel="prev"]')?.addEventListener("click", () => pswp.prev());
          el.querySelector('[rel="next"]')?.addEventListener("click", () => pswp.next());
          pswp.on("change", () => {
            el.querySelector(".pagination__current-page").innerText = pswp.currIndex + 1;
          });
        }
      });
    });
    photoswipe.init();
    return this._photoswipe = photoswipe;
  }
  /**
   * Open the zoom by dynamically creating a data source based on the filtered items
   */
  openZoom(index = 0) {
    const dataSource = Array.from(this.querySelectorAll('.product-gallery__media[data-media-type="image"]:not([hidden]) > img')).map((image) => {
      return {
        thumbnailElement: image,
        src: image.src,
        srcset: image.srcset,
        msrc: image.currentSrc || image.src,
        width: parseInt(image.getAttribute("width")),
        height: parseInt(image.getAttribute("height")),
        alt: image.alt,
        thumbCropped: true
      };
    });
    this.photoswipe.loadAndOpen(index, dataSource);
  }
  _updateViewInSpaceButton(event) {
    if (event.detail.slide.getAttribute("data-media-type") === "model") {
      this._viewInSpaceButton.setAttribute("data-shopify-model3d-id", event.detail.slide.getAttribute("data-media-id"));
    } else {
      this._viewInSpaceButton.setAttribute("data-shopify-model3d-id", this._viewInSpaceButton.getAttribute("data-shopify-model3d-default-id"));
    }
  }
  _onCarouselChanged(event) {
    if (this._customCursor) {
      this._customCursor.toggleAttribute("hidden", event.detail.slide.getAttribute("data-media-type") !== "image");
    }
  }
  _onVariantChanged(event) {
    if (!event.detail.variant) {
      return;
    }
    let newMediaPosition;
    if (event.detail.previousVariant === null) {
      newMediaPosition = event.detail.variant["featured_media"]["position"] - 1;
    } else if (event.detail.variant["featured_media"] && event.detail.previousVariant["featured_media"] && event.detail.previousVariant["featured_media"]["id"] !== event.detail.variant["featured_media"]["id"] || !event.detail.previousVariant["featured_media"] && event.detail.variant["featured_media"]) {
      newMediaPosition = event.detail.variant["featured_media"]["position"] - 1;
    }
    if (newMediaPosition !== void 0) {
      this._carousels.forEach((carousel) => carousel.select(newMediaPosition, { animate: false }));
    }
  }
  _onSectionRerender(event) {
    const galleryMarkup = deepQuerySelector(event.detail.htmlFragment, `${this.tagName}[form="${this.getAttribute("form")}"]`);
    if (!galleryMarkup) {
      return;
    }
    if (galleryMarkup.filteredIndex !== this.filteredIndexes) {
      this.setAttribute("filtered-indexes", galleryMarkup.getAttribute("filtered-indexes"));
      const filteredIndexes = this.filteredIndexes;
      this._carousels.forEach((carousel) => carousel.dispatchEvent(new CustomEvent("carousel:filter", { detail: { filteredIndexes } })));
      this._pageDots.forEach((pageDots) => pageDots.dispatchEvent(new CustomEvent("control:filter", { detail: { filteredIndexes } })));
    }
  }
};
var MediaCarousel = class extends ScrollCarousel {
  connectedCallback() {
    super.connectedCallback();
    this._onGestureChangedListener = this._onGestureChanged.bind(this);
    this.addEventListener("gesturestart", this._onGestureStart, { capture: false, signal: this._abortController.signal });
    this.addEventListener("carousel:settle", this._onMediaSettled, { signal: this._abortController.signal });
    this.addEventListener("click", this._onGalleryClick);
  }
  _onMediaSettled(event) {
    const media = event.detail.slide;
    this.items.filter((item) => ["video", "external_video", "model"].includes(item.getAttribute("data-media-type"))).forEach((item) => item.firstElementChild.pause());
    switch (media.getAttribute("data-media-type")) {
      case "external_video":
      case "video":
        if (this.hasAttribute("autoplay")) {
          media.firstElementChild.play();
        }
        break;
      case "model":
        if (window.matchMedia("(min-width: 1000px)").matches) {
          media.firstElementChild.play();
        }
        break;
    }
  }
  _onGalleryClick(event) {
    if (event.target.matches("button, a[href], button :scope, a[href] :scope") || !window.matchMedia("screen and (pointer: fine)").matches) {
      return;
    }
    if (this.selectedSlide.getAttribute("data-media-type") !== "image") {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect(), offsetX = event.clientX - rect.left;
    offsetX > this.clientWidth / 2 ? this.next() : this.previous();
  }
  _onGestureStart(event) {
    event.preventDefault();
    this.addEventListener("gesturechange", this._onGestureChangedListener, { capture: false, signal: this._abortController.signal });
  }
  _onGestureChanged(event) {
    event.preventDefault();
    if (event.scale > 1.5) {
      const visibleImages = this.visibleItems.filter((item) => item.getAttribute("data-media-type") === "image"), openIndex = visibleImages.indexOf(this.selectedSlide);
      this.dispatchEvent(new CustomEvent("lightbox:open", { bubbles: true, detail: { index: openIndex } }));
      this.removeEventListener("gesturechange", this._onGestureChangedListener);
    }
  }
};
var ProductZoomButton = class extends HTMLButtonElement {
  constructor() {
    super();
    this.addEventListener("click", this._onButtonClicked);
  }
  _onButtonClicked() {
    let media = this.closest(".product-gallery__media"), openIndex;
    if (media) {
      const visibleImages = this.closest("media-carousel").visibleItems.filter((item) => item.getAttribute("data-media-type") === "image");
      openIndex = visibleImages.indexOf(media);
    } else {
      const carousel = this.closest(".product-gallery__media-list-wrapper").querySelector("media-carousel"), visibleImages = carousel.visibleItems.filter((item) => item.getAttribute("data-media-type") === "image");
      openIndex = visibleImages.indexOf(carousel.selectedSlide);
    }
    this.dispatchEvent(new CustomEvent("lightbox:open", {
      bubbles: true,
      detail: {
        index: openIndex
      }
    }));
  }
};
if (!window.customElements.get("product-gallery")) {
  window.customElements.define("product-gallery", ProductGallery);
}
if (!window.customElements.get("product-zoom-button")) {
  window.customElements.define("product-zoom-button", ProductZoomButton, { extends: "button" });
}
if (!window.customElements.get("media-carousel")) {
  window.customElements.define("media-carousel", MediaCarousel);
}

// js/common/product/product-loader.js
var ProductLoader = class {
  static loadedProducts = {};
  static load(productHandle) {
    if (!productHandle) {
      return;
    }
    if (this.loadedProducts[productHandle]) {
      return this.loadedProducts[productHandle];
    }
    this.loadedProducts[productHandle] = new Promise(async (resolve, reject) => {
      const response = await fetch(`${Shopify.routes.root}products/${productHandle}.js`);
      if (response.ok) {
        const responseAsJson = await response.json();
        resolve(responseAsJson);
      } else {
        reject(`
          Attempted to load information for product with handle ${productHandle}, but this product is in "draft" mode. You won't be able to
          switch between variants or access to per-variant information. To fully preview this product, change temporarily its status
          to "active".
        `);
      }
    });
    return this.loadedProducts[productHandle];
  }
};

// js/common/product/quick-add.js
var ProductQuickAdd = class extends HTMLElement {
  #scopeFromPassed = false;
  #scopeToReached = false;
  #intersectionObserver = new IntersectionObserver(this._onObserved.bind(this));
  connectedCallback() {
    this._scopeFrom = document.getElementById(this.getAttribute("form"));
    this._scopeTo = document.querySelector(".footer");
    if (!this._scopeFrom || !this._scopeTo) {
      return;
    }
    this.#intersectionObserver.observe(this._scopeFrom);
    this.#intersectionObserver.observe(this._scopeTo);
  }
  disconnectedCallback() {
    this.#intersectionObserver.disconnect();
  }
  _onObserved(entries) {
    entries.forEach((entry) => {
      if (entry.target === this._scopeFrom) {
        this.#scopeFromPassed = entry.boundingClientRect.bottom < 0;
      }
      if (entry.target === this._scopeTo) {
        this.#scopeToReached = entry.isIntersecting;
      }
    });
    this.classList.toggle("is-visible", this.#scopeFromPassed && !this.#scopeToReached);
  }
};
if (!window.customElements.get("product-quick-add")) {
  window.customElements.define("product-quick-add", ProductQuickAdd);
}

// js/common/product/product-rerender.js
var _abortController3, _ProductRerender_instances, onRerender_fn;
var ProductRerender = class extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _ProductRerender_instances);
    __privateAdd(this, _abortController3);
  }
  connectedCallback() {
    __privateSet(this, _abortController3, new AbortController());
    if (!this.id || !this.hasAttribute("observe-form")) {
      console.warn('The <product-rerender> requires an ID to identify the element to re-render, and an "observe-form" attribute referencing to the form to monitor.');
    }
    document.forms[this.getAttribute("observe-form")].addEventListener("product:rerender", __privateMethod(this, _ProductRerender_instances, onRerender_fn).bind(this), { signal: __privateGet(this, _abortController3).signal });
  }
  disconnectedCallback() {
    __privateGet(this, _abortController3).abort();
  }
};
_abortController3 = new WeakMap();
_ProductRerender_instances = new WeakSet();
onRerender_fn = function(event) {
  const matchingElement = deepQuerySelector(event.detail.htmlFragment, `#${this.id}`);
  if (!matchingElement) {
    return;
  }
  const focusedElement = document.activeElement;
  if (!this.hasAttribute("allow-partial-rerender") || event.detail.productChange) {
    this.replaceWith(matchingElement);
  } else {
    const blockTypes = ["sku", "badges", "price", "payment-terms", "variant-picker", "quantity-selector", "volume-pricing", "inventory", "buy-buttons", "pickup-availability", "liquid"];
    blockTypes.forEach((blockType) => {
      this.querySelectorAll(`[data-block-type="${blockType}"]`).forEach((element) => {
        const matchingBlock = matchingElement.querySelector(`[data-block-type="${blockType}"][data-block-id="${element.getAttribute("data-block-id")}"]`);
        if (matchingBlock) {
          matchingBlock.querySelectorAll("noscript").forEach((noscript) => {
            noscript.remove();
          });
          if (blockType === "buy-buttons") {
            element.querySelector("buy-buttons").replaceWith(matchingBlock.querySelector("buy-buttons"));
          } else if (blockType === "quantity-selector") {
            const existingQuantity = element.querySelector(".quantity-selector__input")?.quantity;
            element.replaceWith(matchingBlock);
            const newSelector = matchingBlock.querySelector(".quantity-selector__input");
            if (newSelector) {
              newSelector.quantity = existingQuantity;
            }
          } else {
            element.replaceWith(matchingBlock);
          }
        }
      });
    });
  }
  if (focusedElement.id) {
    const element = document.getElementById(focusedElement.id);
    if (this.contains(element)) {
      element.focus();
    }
  }
};
if (!window.customElements.get("product-rerender")) {
  window.customElements.define("product-rerender", ProductRerender);
}

// js/common/product/quick-buy-drawer.js
import { animate as animate7, timeline as timeline5 } from "vendor";
var QuickBuyDrawer = class extends Drawer {
  constructor() {
    super();
    this._hasLoaded = false;
    this.addEventListener("variant:add", this._onVariantAdded.bind(this));
  }
  async show() {
    this.style.display = "block";
    if (!this._hasLoaded) {
      [this, ...this.controls].forEach((control) => control.setAttribute("aria-busy", "true"));
      const responseContent = await (await fetch(`${window.Shopify.routes.root}products/${this.getAttribute("handle")}`)).text();
      [this, ...this.controls].forEach((control) => control.setAttribute("aria-busy", "false"));
      const quickBuyContent = new DOMParser().parseFromString(responseContent, "text/html").getElementById("quick-buy-content").content;
      Array.from(quickBuyContent.querySelectorAll("noscript")).forEach((noScript) => noScript.remove());
      this.replaceChildren(quickBuyContent);
      Shopify.PaymentButton?.init();
      this._hasLoaded = true;
    }
    return super.show();
  }
  async hide() {
    return super.hide()?.then(() => {
      this.style.display = "none";
    });
  }
  _onVariantAdded(event) {
    event.detail.blockCartDrawerOpening = true;
    const contentShadow = this.shadowRoot.querySelector('[part="content"]'), fromHeight = contentShadow.clientHeight;
    animate7(contentShadow.children, { opacity: 0, visibility: "hidden" }, { duration: 0.15 });
    this.replaceChildren(...new DOMParser().parseFromString(event.detail.cart["sections"]["variant-added"], "text/html").querySelector(".shopify-section").children);
    requestAnimationFrame(async () => {
      await timeline5([
        [contentShadow, { height: [`${fromHeight}px`, `${contentShadow.clientHeight}px`] }, { duration: 0.35, easing: [0.86, 0, 0.07, 1] }],
        [contentShadow.children, { opacity: [0, 1], visibility: "visible" }, { duration: 0.15 }]
      ]).finished;
      contentShadow.style.height = null;
    });
    this._hasLoaded = false;
  }
};
if (!window.customElements.get("quick-buy-drawer")) {
  window.customElements.define("quick-buy-drawer", QuickBuyDrawer);
}

// js/common/product/variant-picker.js
import { Delegate as Delegate4 } from "vendor";
var CACHE_EVICTION_TIME = 1e3 * 60 * 5;
var _preloadedHtml, _delegate, _intersectionObserver, _form, _selectedVariant, _VariantPicker_instances, getActiveOptionValues_fn, getOptionValuesFromOption_fn, onOptionChanged_fn, onOptionPreload_fn, onIntersection_fn, renderForCombination_fn, createHashKeyForHtml_fn;
var _VariantPicker = class _VariantPicker extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _VariantPicker_instances);
    __privateAdd(this, _delegate, new Delegate4(document.body));
    __privateAdd(this, _intersectionObserver, new IntersectionObserver(__privateMethod(this, _VariantPicker_instances, onIntersection_fn).bind(this)));
    __privateAdd(this, _form);
    __privateAdd(this, _selectedVariant);
  }
  async connectedCallback() {
    __privateSet(this, _selectedVariant, JSON.parse(this.querySelector("script[data-variant]")?.textContent || "{}"));
    __privateSet(this, _form, document.forms[this.getAttribute("form-id")]);
    __privateGet(this, _delegate).on("change", `input[data-option-position][form="${this.getAttribute("form-id")}"]`, __privateMethod(this, _VariantPicker_instances, onOptionChanged_fn).bind(this));
    __privateGet(this, _delegate).on("pointerenter", `input[data-option-position][form="${this.getAttribute("form-id")}"]:not(:checked) + label`, __privateMethod(this, _VariantPicker_instances, onOptionPreload_fn).bind(this), true);
    __privateGet(this, _delegate).on("touchstart", `input[data-option-position][form="${this.getAttribute("form-id")}"]:not(:checked) + label`, __privateMethod(this, _VariantPicker_instances, onOptionPreload_fn).bind(this), true);
    __privateGet(this, _intersectionObserver).observe(this);
  }
  disconnectedCallback() {
    __privateGet(this, _delegate).off();
    __privateGet(this, _intersectionObserver).unobserve(this);
  }
  get selectedVariant() {
    return __privateGet(this, _selectedVariant);
  }
  get productHandle() {
    return this.getAttribute("handle");
  }
  get updateUrl() {
    return this.hasAttribute("update-url");
  }
  /**
   * Select a variant using a list of option values. The list of option values might lead to no variant (for instance)
   * in the case of a combination that does not exist
   */
  async selectCombination({ optionValues, productChange }) {
    const previousVariant = this.selectedVariant;
    const newContent = document.createRange().createContextualFragment(await __privateMethod(this, _VariantPicker_instances, renderForCombination_fn).call(this, optionValues));
    if (!productChange) {
      const newVariantPicker = deepQuerySelector(newContent, `${this.tagName}[form-id="${this.getAttribute("form-id")}"]`);
      const newVariant = JSON.parse(newVariantPicker.querySelector("script[data-variant]")?.textContent || "{}");
      __privateSet(this, _selectedVariant, newVariant);
      __privateGet(this, _form).id.value = __privateGet(this, _selectedVariant)?.id;
      __privateGet(this, _form).id.dispatchEvent(new Event("change", { bubbles: true }));
      if (this.updateUrl && __privateGet(this, _selectedVariant)?.id) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("variant", __privateGet(this, _selectedVariant).id);
        window.history.replaceState({ path: newUrl.toString() }, "", newUrl.toString());
      }
    }
    __privateGet(this, _form).dispatchEvent(new CustomEvent("product:rerender", {
      detail: {
        htmlFragment: newContent,
        productChange
      }
    }));
    if (!productChange) {
      __privateGet(this, _form).dispatchEvent(new CustomEvent("variant:change", {
        bubbles: true,
        detail: {
          formId: __privateGet(this, _form).id,
          variant: __privateGet(this, _selectedVariant),
          previousVariant
        }
      }));
    }
    Shopify?.PaymentButton?.init();
  }
};
_preloadedHtml = new WeakMap();
_delegate = new WeakMap();
_intersectionObserver = new WeakMap();
_form = new WeakMap();
_selectedVariant = new WeakMap();
_VariantPicker_instances = new WeakSet();
/**
 * Get the option values for the active combination
 */
getActiveOptionValues_fn = function() {
  return Array.from(__privateGet(this, _form).elements).filter((item) => item.matches("input[data-option-position]:checked")).sort((a, b) => parseInt(a.getAttribute("data-option-position")) - parseInt(b.getAttribute("data-option-position"))).map((input) => input.value);
};
/**
 * Get the option values for a given input
 */
getOptionValuesFromOption_fn = function(input) {
  const optionValues = [input, ...Array.from(__privateGet(this, _form).elements).filter((item) => item.matches(`input[data-option-position]:not([name="${input.name}"]):checked`))].sort((a, b) => parseInt(a.getAttribute("data-option-position")) - parseInt(b.getAttribute("data-option-position"))).map((input2) => input2.value);
  return optionValues;
};
onOptionChanged_fn = async function(event) {
  if (!event.target.name.includes("option")) {
    return;
  }
  this.selectCombination({
    optionValues: __privateMethod(this, _VariantPicker_instances, getActiveOptionValues_fn).call(this),
    productChange: event.target.hasAttribute("data-product-url")
  });
};
/**
 * To improve the user experience, we preload a variant whenever the user hovers over a specific option
 */
onOptionPreload_fn = function(event, target) {
  __privateMethod(this, _VariantPicker_instances, renderForCombination_fn).call(this, __privateMethod(this, _VariantPicker_instances, getOptionValuesFromOption_fn).call(this, target.control));
};
/**
 * When the variant picker is intersecting the viewport, we preload the options to improve the user experience
 * so that switching variants is nearly instant
 */
onIntersection_fn = function(entries) {
  const prerenderOptions = () => {
    Array.from(__privateGet(this, _form).elements).filter((item) => item.matches("input[data-option-position]:not(:checked)")).forEach((input) => {
      __privateMethod(this, _VariantPicker_instances, renderForCombination_fn).call(this, __privateMethod(this, _VariantPicker_instances, getOptionValuesFromOption_fn).call(this, input));
    });
  };
  if (entries[0].isIntersecting) {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(prerenderOptions, { timeout: 2e3 });
    } else {
      prerenderOptions();
    }
  }
};
renderForCombination_fn = async function(optionValues) {
  const optionValuesAsString = optionValues.join(",");
  const hashKey = __privateMethod(this, _VariantPicker_instances, createHashKeyForHtml_fn).call(this, optionValuesAsString);
  let productUrl = `${Shopify.routes.root}products/${this.productHandle}`;
  for (const optionValue of optionValues) {
    const inputForOptionValue = Array.from(__privateGet(this, _form).elements).find((item) => item.matches(`input[value="${optionValue}"]`));
    if (inputForOptionValue?.dataset.productUrl) {
      productUrl = inputForOptionValue.dataset.productUrl;
      break;
    }
  }
  if (!__privateGet(_VariantPicker, _preloadedHtml).has(hashKey)) {
    const sectionQueryParam = this.getAttribute("context") === "quick_buy" ? "" : `&section_id=${this.getAttribute("section-id")}`;
    const promise = new Promise(async (resolve) => {
      resolve(await (await fetch(`${productUrl}?option_values=${optionValuesAsString}${sectionQueryParam}`)).text());
    });
    __privateGet(_VariantPicker, _preloadedHtml).set(hashKey, { htmlPromise: promise, timestamp: Date.now() });
    if (__privateGet(_VariantPicker, _preloadedHtml).size > 100) {
      __privateGet(_VariantPicker, _preloadedHtml).delete(Array.from(__privateGet(_VariantPicker, _preloadedHtml).keys())[0]);
    }
  }
  return __privateGet(_VariantPicker, _preloadedHtml).get(hashKey).htmlPromise;
};
createHashKeyForHtml_fn = function(optionValuesAsString) {
  return `${optionValuesAsString}-${this.getAttribute("section-id")}`;
};
__privateAdd(_VariantPicker, _preloadedHtml, /* @__PURE__ */ new Map());
var VariantPicker = _VariantPicker;
if (!window.customElements.get("variant-picker")) {
  window.customElements.define("variant-picker", VariantPicker);
}

// js/common/media/base-media.js
import { inView as inView4 } from "vendor";
var BaseMedia = class extends HTMLElement {
  static get observedAttributes() {
    return ["playing"];
  }
  connectedCallback() {
    this._abortController = new AbortController();
    if (this.hasAttribute("autoplay")) {
      inView4(this, this.play.bind(this), { margin: "0px 0px 0px 0px" });
    }
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  get playing() {
    return this.hasAttribute("playing");
  }
  get player() {
    return this._playerProxy = this._playerProxy || new Proxy(this._playerTarget(), {
      get: (target, prop) => {
        return async () => {
          target = await target;
          this._playerHandler(target, prop);
        };
      }
    });
  }
  play() {
    if (!this.playing) {
      this.player.play();
    }
  }
  pause() {
    if (this.playing) {
      this.player.pause();
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "playing") {
      if (oldValue === null && newValue === "") {
        this.dispatchEvent(new CustomEvent("media:play", { bubbles: true }));
        if (this.hasAttribute("group")) {
          Array.from(document.querySelectorAll(`[group="${this.getAttribute("group")}"]`)).filter((item) => item !== this).forEach((itemToPause) => {
            itemToPause.pause();
          });
        }
      } else if (newValue === null) {
        this.dispatchEvent(new CustomEvent("media:pause", { bubbles: true }));
      }
    }
  }
};

// js/common/media/model.js
var ModelMedia = class extends BaseMedia {
  connectedCallback() {
    super.connectedCallback();
    this.player;
  }
  _playerTarget() {
    return new Promise((resolve) => {
      this.setAttribute("loaded", "");
      window.Shopify.loadFeatures([
        {
          name: "shopify-xr",
          version: "1.0",
          onLoad: this._setupShopifyXr.bind(this)
        },
        {
          name: "model-viewer-ui",
          version: "1.0",
          onLoad: () => {
            const modelViewer = this.querySelector("model-viewer");
            modelViewer.addEventListener("shopify_model_viewer_ui_toggle_play", () => this.setAttribute("playing", ""));
            modelViewer.addEventListener("shopify_model_viewer_ui_toggle_pause", () => this.removeAttribute("playing"));
            this.setAttribute("can-play", "");
            resolve(new window.Shopify.ModelViewerUI(modelViewer, { focusOnPlay: true }));
          }
        }
      ]);
    });
  }
  _playerHandler(target, prop) {
    target[prop]();
  }
  async _setupShopifyXr() {
    if (!window.ShopifyXR) {
      document.addEventListener("shopify_xr_initialized", this._setupShopifyXr.bind(this));
    } else {
      const models = (await ProductLoader.load(this.getAttribute("handle")))["media"].filter((media) => media["media_type"] === "model");
      window.ShopifyXR.addModels(models);
      window.ShopifyXR.setupXRElements();
    }
  }
};
if (!window.customElements.get("model-media")) {
  window.customElements.define("model-media", ModelMedia);
}

// js/common/media/video.js
var onYouTubePromise = new Promise((resolve) => {
  window.onYouTubeIframeAPIReady = () => resolve();
});
var VideoMedia = class extends BaseMedia {
  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute("autoplay")) {
      this.addEventListener("click", this.play, { once: true, signal: this._abortController.signal });
      this.nextElementSibling?.querySelector(".video-play-button")?.addEventListener("click", this.play.bind(this), { once: true, signal: this._abortController.signal });
    }
    if (this.hasAttribute("show-play-button") && !this.shadowRoot) {
      this.attachShadow({ mode: "open" }).appendChild(document.createRange().createContextualFragment(`
        <slot></slot>
        
        <svg part="play-button" fill="none" width="48" height="48" viewBox="0 0 48 48">
          <path d="M48 24C48 10.745 37.255 0 24 0S0 10.745 0 24s10.745 24 24 24 24-10.745 24-24Z" fill="${window.themeVariables.settings.pageBackground}"/>
          <path d="M18.578 32.629a.375.375 0 0 1-.578-.316V15.687c0-.297.328-.476.578-.316l12.931 8.314c.23.147.23.483 0 .63L18.578 32.63Z" fill="${window.themeVariables.settings.textColor}"/>
          <path d="M24 .5C36.979.5 47.5 11.021 47.5 24S36.979 47.5 24 47.5.5 36.979.5 24 11.021.5 24 .5Z" stroke="${window.themeVariables.settings.textColor}" stroke-opacity=".12"/>
        </svg>
      `));
    }
  }
  play({ restart = false } = {}) {
    if (restart && !this.hasAttribute("host")) {
      this.querySelector("video").currentTime = 0;
    }
    super.play();
  }
  _playerTarget() {
    if (this.hasAttribute("host")) {
      this.setAttribute("loaded", "");
      return new Promise(async (resolve) => {
        const templateElement = this.querySelector("template");
        if (templateElement) {
          templateElement.replaceWith(templateElement.content.firstElementChild.cloneNode(true));
        }
        const muteVideo = this.hasAttribute("autoplay") || window.matchMedia("screen and (max-width: 999px)").matches;
        const script = document.createElement("script");
        script.type = "text/javascript";
        if (this.getAttribute("host") === "youtube") {
          if (!window.YT || !window.YT.Player) {
            script.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(script);
            await new Promise((resolve2) => {
              script.onload = resolve2;
            });
          }
          await onYouTubePromise;
          this.setAttribute("can-play", "");
          const player = new YT.Player(this.querySelector("iframe"), {
            events: {
              "onReady": () => {
                if (muteVideo) {
                  player.mute();
                }
                resolve(player);
              },
              "onStateChange": (event) => {
                if (event.data === YT.PlayerState.PLAYING) {
                  this.setAttribute("playing", "");
                } else if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
                  this.removeAttribute("playing");
                }
              }
            }
          });
        }
        if (this.getAttribute("host") === "vimeo") {
          if (!window.Vimeo || !window.Vimeo.Player) {
            script.src = "https://player.vimeo.com/api/player.js";
            document.head.appendChild(script);
            await new Promise((resolve2) => {
              script.onload = resolve2;
            });
          }
          const player = new Vimeo.Player(this.querySelector("iframe"));
          if (muteVideo) {
            player.setMuted(true);
          }
          this.setAttribute("can-play", "");
          player.on("play", () => {
            this.setAttribute("playing", "");
          });
          player.on("pause", () => this.removeAttribute("playing"));
          player.on("ended", () => this.removeAttribute("playing"));
          resolve(player);
        }
      });
    } else {
      const videoElement = this.querySelector("video");
      this.setAttribute("loaded", "");
      this.setAttribute("can-play", "");
      videoElement.addEventListener("play", () => {
        this.setAttribute("playing", "");
        this.removeAttribute("suspended");
      });
      videoElement.addEventListener("pause", () => {
        if (!videoElement.seeking && videoElement.paused) {
          this.removeAttribute("playing");
        }
      });
      return videoElement;
    }
  }
  _playerHandler(target, prop) {
    if (this.getAttribute("host") === "youtube") {
      prop === "play" ? target.playVideo() : target.pauseVideo();
    } else {
      if (prop === "play" && !this.hasAttribute("host")) {
        target.play().catch((error) => {
          if (error.name === "NotAllowedError") {
            this.setAttribute("suspended", "");
            target.controls = true;
            const replacementImageSrc = target.previousElementSibling?.currentSrc;
            if (replacementImageSrc) {
              target.poster = replacementImageSrc;
            }
          }
        });
      } else {
        target[prop]();
      }
    }
  }
};
if (!window.customElements.get("video-media")) {
  window.customElements.define("video-media", VideoMedia);
}

// js/common/navigation/accordion-disclosure.js
import { timeline as timeline6 } from "vendor";

// js/common/navigation/animated-details.js
var AnimatedDetails = class extends HTMLDetailsElement {
  constructor() {
    super();
    this.summaryElement = this.firstElementChild;
    this.contentElement = this.lastElementChild;
    this._open = this.hasAttribute("open");
    this.summaryElement.addEventListener("click", this._onSummaryClicked.bind(this));
    if (Shopify.designMode) {
      this.addEventListener("shopify:block:select", () => this.open = true);
      this.addEventListener("shopify:block:deselect", () => this.open = false);
    }
  }
  set open(value) {
    if (value !== this._open) {
      this._open = value;
      if (this.isConnected) {
        this._transition(value);
      } else {
        value ? this.setAttribute("open", "") : this.removeAttribute("open");
      }
    }
  }
  get open() {
    return this._open;
  }
  _onSummaryClicked(event) {
    event.preventDefault();
    this.open = !this.open;
  }
  _transition(value) {
  }
};

// js/common/navigation/accordion-disclosure.js
var AccordionDisclosure = class extends AnimatedDetails {
  static get observedAttributes() {
    return ["open"];
  }
  constructor() {
    super();
    this.setAttribute("aria-expanded", this._open ? "true" : "false");
  }
  set open(value) {
    super.open = value;
    this.setAttribute("aria-expanded", value ? "true" : "false");
  }
  get open() {
    return super.open;
  }
  async _transition(value) {
    this.style.overflow = "hidden";
    if (value) {
      this.setAttribute("open", "");
      await timeline6([
        [this, { height: [`${this.summaryElement.clientHeight}px`, `${this.scrollHeight}px`] }, { duration: 0.25, easing: "ease" }],
        [this.contentElement, { opacity: [0, 1], transform: ["translateY(0)", "translateY(-4px)"] }, { duration: 0.15, at: "-0.1" }]
      ]).finished;
    } else {
      await timeline6([
        [this.contentElement, { opacity: 0 }, { duration: 0.15 }],
        [this, { height: [`${this.clientHeight}px`, `${this.summaryElement.clientHeight}px`] }, { duration: 0.25, at: "<", easing: "ease" }]
      ]).finished;
      this.removeAttribute("open");
    }
    this.style.height = "auto";
    this.style.overflow = "visible";
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "open") {
      this.setAttribute("aria-expanded", newValue === "" ? "true" : "false");
    }
  }
};
if (!window.customElements.get("accordion-disclosure")) {
  window.customElements.define("accordion-disclosure", AccordionDisclosure, { extends: "details" });
}

// js/common/navigation/tabs.js
import { animate as animate8 } from "vendor";
var _Tabs_instances, setupComponent_fn, onSlotChange_fn;
var Tabs = class extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _Tabs_instances);
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" }).appendChild(this.querySelector("template").content.cloneNode(true));
    }
    if (Shopify.designMode) {
      this.addEventListener("shopify:block:select", (event) => this.selectedIndex = this.buttons.indexOf(event.target));
    }
    this.shadowRoot.addEventListener("slotchange", __privateMethod(this, _Tabs_instances, onSlotChange_fn).bind(this));
    this.addEventListener("keydown", this._handleKeyboard);
  }
  static get observedAttributes() {
    return ["selected-index"];
  }
  connectedCallback() {
    this._abortController = new AbortController();
    __privateMethod(this, _Tabs_instances, setupComponent_fn).call(this);
    this.selectedIndex = this.selectedIndex;
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  get animationDuration() {
    return this.hasAttribute("animation-duration") ? parseFloat(this.getAttribute("animation-duration")) : 0.15;
  }
  get selectedIndex() {
    return parseInt(this.getAttribute("selected-index")) || 0;
  }
  set selectedIndex(index) {
    this.setAttribute("selected-index", Math.min(Math.max(index, 0), this.buttons.length - 1).toString());
    this.style.setProperty("--selected-index", this.selectedIndex.toString());
    this.style.setProperty("--item-count", this.buttons.length.toString());
  }
  attributeChangedCallback(name, oldValue, newValue) {
    this.buttons?.forEach((button, index) => button.setAttribute("aria-selected", index === parseInt(newValue) ? "true" : "false"));
    if (name === "selected-index" && oldValue !== null && oldValue !== newValue) {
      let fromPanel = !this.hasAttribute("external-panels") ? this.panels[parseInt(oldValue)] : document.getElementById(this.buttons[parseInt(oldValue)].getAttribute("controlled-panel"));
      let toPanel = !this.hasAttribute("external-panels") ? this.panels[parseInt(newValue)] : document.getElementById(this.buttons[parseInt(newValue)].getAttribute("controlled-panel"));
      this._transition(fromPanel, toPanel);
    }
  }
  _setupAccessibility() {
    const componentID = crypto.randomUUID ? crypto.randomUUID() : Math.floor(Math.random() * 1e4);
    this.buttons?.forEach((button, index) => {
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `tab-panel-${componentID}-${index}`);
      button.id = `tab-${componentID}-${index}`;
    });
    this.panels?.forEach((panel, index) => {
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", `tab-${componentID}-${index}`);
      panel.id = `tab-panel-${componentID}-${index}`;
      panel.hidden = index !== this.selectedIndex;
    });
  }
  /**
   * As per https://www.w3.org/WAI/ARIA/apg/example-index/tabs/tabs-automatic.html, when a tab is currently focused,
   * left and right arrow should switch the tab
   */
  _handleKeyboard(event) {
    const index = this.buttons.indexOf(document.activeElement);
    if (index === -1 || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }
    if (event.key === "ArrowLeft") {
      this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
    } else {
      this.selectedIndex = (this.selectedIndex + 1 + this.buttons.length) % this.buttons.length;
    }
    this.buttons[this.selectedIndex].focus();
  }
  /**
   * Perform a custom transition (can be overridden in subclasses). To "from" and "to" are hash representing the panel
   */
  async _transition(fromPanel, toPanel) {
    await animate8(fromPanel, { opacity: [1, 0] }, { duration: this.animationDuration }).finished;
    fromPanel.hidden = true;
    toPanel.hidden = false;
    await animate8(toPanel, { opacity: [0, 1] }, { duration: this.animationDuration }).finished;
  }
};
_Tabs_instances = new WeakSet();
setupComponent_fn = function() {
  this.buttons = Array.from(this.shadowRoot.querySelector('slot[name="title"]').assignedNodes(), (item) => item.matches("button") && item || item.querySelector("button"));
  this.panels = this.shadowRoot.querySelector('slot[name="content"]') ? Array.from(this.shadowRoot.querySelector('slot[name="content"]').assignedNodes()) : null;
  this.buttons.forEach((button, index) => button.addEventListener("click", () => this.selectedIndex = index, { signal: this._abortController.signal }));
  if (this.hasAttribute("external-panels")) {
    Array.from(this.buttons).forEach((button, index) => {
      button.setAttribute("aria-selected", (this.selectedIndex === index).toString());
      document.getElementById(button.getAttribute("controlled-panel")).hidden = !(this.selectedIndex === index);
    });
  }
  this._setupAccessibility();
};
onSlotChange_fn = function() {
  __privateMethod(this, _Tabs_instances, setupComponent_fn).call(this);
};
if (!window.customElements.get("x-tabs")) {
  window.customElements.define("x-tabs", Tabs);
}

// js/common/search/predictive-search.js
import { animate as animate9 } from "vendor";
var PredictiveSearch = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(document.createRange().createContextualFragment(`<slot name="idle"></slot>`));
  }
  connectedCallback() {
    this._searchForm = this.closest("form");
    this._queryInput = this._searchForm.elements["q"];
    this._searchForm.addEventListener("submit", this._onFormSubmitted.bind(this));
    this._searchForm.addEventListener("reset", this._onSearchCleared.bind(this));
    this._queryInput.addEventListener("input", debounce(this._onInputChanged.bind(this), this.autoCompleteDelay));
  }
  /**
   * Return the delay in ms before we send the autocomplete request. Using a value too low can cause the results to
   * refresh too often, so we recommend to keep the default one
   */
  get autoCompleteDelay() {
    return 280;
  }
  /**
   * Check if the store supports the predictive API (some languages do not). When not supported, the predictive
   * search is simply disabled and only the standard search is used
   */
  supportsPredictiveApi() {
    return JSON.parse(document.getElementById("shopify-features").innerHTML)["predictiveSearch"];
  }
  /**
   * Check if the input is not empty, and if so, trigger the predictive search
   */
  _onInputChanged() {
    if (this._queryInput.value === "") {
      return this._onSearchCleared();
    }
    this._abortController?.abort();
    this._abortController = new AbortController();
    try {
      return this.supportsPredictiveApi() ? this._doPredictiveSearch() : this._doFallbackSearch();
    } catch (e) {
      if (e.name !== "AbortError") {
        throw e;
      }
    }
  }
  /**
   * Prevent the form submission if the query is empty
   */
  _onFormSubmitted(event) {
    if (this._queryInput.value === "") {
      return event.preventDefault();
    }
  }
  /**
   * Do the actual predictive search
   */
  async _doPredictiveSearch() {
    await this._transitionToSlot("loading");
    const queryParams = `q=${encodeURIComponent(this._queryInput.value)}&section_id=${this.getAttribute("section-id")}&resources[limit]=10&resources[limit_scope]=each`;
    const nodeElement = new DOMParser().parseFromString(await (await cachedFetch(`${window.Shopify.routes.root}search/suggest?${queryParams}`, { signal: this._abortController.signal })).text(), "text/html");
    this.querySelector('[slot="results"]').replaceWith(document.importNode(nodeElement.querySelector('[slot="results"]'), true));
    return this._transitionToSlot("results");
  }
  /**
   * For merchants using store that do not support the predictive search, we have to fallback to standard search. Unfortunately,
   * the standard search is less convenient, and we have to simulate one request for each desired resource type
   */
  async _doFallbackSearch() {
    await this._transitionToSlot("loading");
    const queryParams = `q=${this._queryInput.value}&section_id=${this.getAttribute("section-id")}&resources[limit]=10&resources[limit_scope]=each`;
    const nodeElement = new DOMParser().parseFromString(await (await cachedFetch(`${window.Shopify.routes.root}search?${queryParams}`, { signal: this._abortController.signal })).text(), "text/html");
    this.querySelector('[slot="results"]').replaceWith(document.importNode(nodeElement.querySelector('[slot="results"]'), true));
    return this._transitionToSlot("results");
  }
  /**
   * If any search is pending, we abort them, and transition to the idle slot
   */
  _onSearchCleared() {
    this._abortController?.abort();
    this._queryInput.focus();
    return this._transitionToSlot("idle");
  }
  /**
   * Transition between different slot. To prevent useless animation, the slot does not transition if we go to the same slot
   */
  async _transitionToSlot(toSlotName) {
    if (this.shadowRoot.firstElementChild.name === toSlotName) {
      return;
    }
    await animate9(this.shadowRoot.firstElementChild.assignedNodes(), { opacity: [1, 0] }, { duration: 0.1 }).finished;
    this.shadowRoot.firstElementChild.setAttribute("name", toSlotName);
    return animate9(this.shadowRoot.firstElementChild.assignedNodes(), { opacity: [0, 1], transform: ["translateY(5px)", "translateY(0)"] }, { duration: 0.1 }).finished;
  }
};
if (!window.customElements.get("predictive-search")) {
  window.customElements.define("predictive-search", PredictiveSearch);
}

// js/common/search/search-drawer.js
var SearchDrawer = class extends Drawer {
  get shouldAppendToBody() {
    return false;
  }
  get openFrom() {
    return window.matchMedia(`${window.themeVariables.breakpoints["sm-max"]}`).matches ? "top" : this.getAttribute("open-from") || "right";
  }
};
if (!window.customElements.get("search-drawer")) {
  window.customElements.define("search-drawer", SearchDrawer);
}

// js/common/text/section-header.js
import { animate as animate10, inView as inView5 } from "vendor";
var _SectionHeader_instances, reveal_fn2;
var SectionHeader = class extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _SectionHeader_instances);
  }
  connectedCallback() {
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      inView5(this, __privateMethod(this, _SectionHeader_instances, reveal_fn2).bind(this), { margin: "0px 0px -100px 0px" });
    }
  }
};
_SectionHeader_instances = new WeakSet();
reveal_fn2 = function() {
  const heading = this.querySelector('h2[reveal-on-scroll="true"]'), headingKeyframe = getHeadingKeyframe(heading);
  animate10(...headingKeyframe);
};
if (!window.customElements.get("section-header")) {
  window.customElements.define("section-header", SectionHeader);
}

// js/common/ui/marquee-text.js
var MarqueeText = class extends HTMLElement {
  constructor() {
    super();
    if (window.ResizeObserver) {
      new ResizeObserver(this._calculateDuration.bind(this)).observe(this);
    }
  }
  _calculateDuration(entries) {
    const scrollingSpeed = parseInt(this.getAttribute("scrolling-speed") || 5), contentWidth = entries[0].contentRect.width, slowFactor = 1 + (Math.min(1600, contentWidth) - 375) / (1600 - 375);
    this.style.setProperty("--marquee-animation-duration", `${(scrollingSpeed * slowFactor * entries[0].target.querySelector("span").clientWidth / contentWidth).toFixed(3)}s`);
  }
};
if (!window.customElements.get("marquee-text")) {
  window.customElements.define("marquee-text", MarqueeText);
}

// js/sections/announcement-bar.js
import { timeline as timeline7 } from "vendor";
var AnnouncementBar = class extends EffectCarousel {
  _transitionTo(fromSlide, toSlide) {
    timeline7([
      [fromSlide, { transform: ["translateY(0)", "translateY(-5px)"], opacity: [1, 0], visibility: ["visible", "hidden"] }, { duration: 0.2 }],
      [toSlide, { transform: ["translateY(5px)", "translateY(0)"], opacity: [0, 1], visibility: ["hidden", "visible"] }, { duration: 0.2 }]
    ]);
  }
};
if (!window.customElements.get("announcement-bar")) {
  window.customElements.define("announcement-bar", AnnouncementBar);
}

// js/sections/before-after-image.js
var SplitCursor = class extends HTMLElement {
  _abortController;
  connectedCallback() {
    this._parentSection = this.closest(".shopify-section");
    this._dragging = false;
    this._offsetX = this._currentX = 0;
    this._abortController = new AbortController();
    this._parentSection.addEventListener("pointerdown", this._onPointerDown.bind(this), { signal: this._abortController.signal });
    this._parentSection.addEventListener("pointermove", this._onPointerMove.bind(this), { signal: this._abortController.signal });
    this._parentSection.addEventListener("pointerup", this._onPointerUp.bind(this), { signal: this._abortController.signal });
    this.addEventListener("keydown", this._onKeyboardNavigation, { signal: this._abortController.signal });
    this._recalculateOffset();
    window.addEventListener("resize", this._recalculateOffset.bind(this), { signal: this._abortController.signal });
  }
  disconnectedCallback() {
    this._abortController?.abort();
  }
  get minOffset() {
    return -this.offsetLeft - (document.dir === "rtl" ? this.clientWidth : 0);
  }
  get maxOffset() {
    return this.offsetParent.clientWidth + this.minOffset;
  }
  _onPointerDown(event) {
    if (event.target === this || this.contains(event.target)) {
      this._initialX = event.clientX - this._offsetX;
      this._dragging = true;
    }
  }
  _onPointerMove(event) {
    if (!this._dragging) {
      return;
    }
    this._currentX = Math.min(Math.max(event.clientX - this._initialX, this.minOffset), this.maxOffset);
    this._offsetX = this._currentX;
    this._parentSection.style.setProperty("--clip-path-offset", `${this._currentX.toFixed(1)}px`);
  }
  _onPointerUp() {
    this._dragging = false;
  }
  _recalculateOffset() {
    this._parentSection.style.setProperty("--clip-path-offset", `${Math.min(Math.max(this.minOffset, this._currentX.toFixed(1)), this.maxOffset)}px`);
  }
  _onKeyboardNavigation(event) {
    if (!event.target.classList.contains("before-after__cursor") || !this.hasAttribute("vertical") && event.code !== "ArrowLeft" && event.code !== "ArrowRight" || this.hasAttribute("vertical") && event.code !== "ArrowUp" && event.code !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    let currentPosition = parseInt(this._parentSection.style.getPropertyValue("--clip-path-offset"));
    let newPosition;
    if (this.hasAttribute("vertical")) {
      newPosition = event.code === "ArrowUp" ? currentPosition - 1 : currentPosition + 1;
    } else {
      newPosition = event.code === "ArrowLeft" ? currentPosition - 1 : currentPosition + 1;
    }
    this._currentX = Math.min(Math.max(newPosition, this.minOffset), this.maxOffset);
    this._offsetX = this._currentX;
    this._parentSection.style.setProperty("--clip-path-offset", `${this._currentX.toFixed(1)}px`);
  }
};
if (!window.customElements.get("split-cursor")) {
  window.customElements.define("split-cursor", SplitCursor);
}

// js/sections/collection-list.js
import { timeline as timeline8, inView as inView6 } from "vendor";
var CollectionList = class extends HTMLElement {
  connectedCallback() {
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      inView6(this, this._reveal.bind(this), { margin: "-100px" });
    }
  }
  _reveal() {
    const toReveal = Array.from(this.querySelectorAll("[reveal-js]"));
    timeline8([
      [toReveal, { opacity: 1 }, { duration: 0 }],
      [toReveal.map((item) => item.querySelector("img, svg")), { opacity: [0, 1], transform: ["scale(1.03)", "auto"] }, { duration: 0.2 }],
      [toReveal.map((item) => item.querySelector(".collection-card__content-wrapper")), { opacity: [0, 1] }, { duration: 0.2 }]
    ]);
  }
};
if (!window.customElements.get("collection-list")) {
  window.customElements.define("collection-list", CollectionList);
}

// js/sections/customer-login.js
import { Delegate as Delegate5 } from "vendor";
var AccountLogin = class extends HTMLElement {
  connectedCallback() {
    this.recoverForm = this.querySelector("#recover");
    this.loginForm = this.querySelector("#login");
    if (window.location.hash === "#recover") {
      this._switchForms();
    }
    new Delegate5(this).on("click", '[href="#recover"], [href="#login"]', this._switchForms.bind(this));
  }
  _switchForms(event) {
    if (event) {
      event.preventDefault();
    }
    this.recoverForm.hidden = !this.recoverForm.hidden;
    this.loginForm.hidden = !this.loginForm.hidden;
  }
};
if (!window.customElements.get("account-login")) {
  window.customElements.define("account-login", AccountLogin);
}

// js/sections/header.js
import { animate as animate11, timeline as timeline9, stagger as stagger5, Delegate as Delegate6 } from "vendor";
var reduceMenuAnimation = window.themeVariables.settings.reduceMenuAnimation;
var StoreHeader = class extends HTMLElement {
  connectedCallback() {
    if (this.hasAttribute("hide-on-scroll") && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      this._lastScrollTop = 0;
      this._accumulatedScroll = 0;
      this._isVisible = true;
      this._hasSwitchedToSticky = false;
      window.addEventListener("scroll", throttle(this._onScroll.bind(this)));
    }
    this.addEventListener("toggle", this._checkTransparency.bind(this), { capture: true });
    this._setupTransparentHeader();
    if (this.hasAttribute("sticky")) {
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
          this.classList.remove("is-filled");
          this._setupTransparentHeader();
        }
      });
      if (Shopify.designMode) {
        document.addEventListener("shopify:section:load", this._setupTransparentHeader.bind(this));
        document.addEventListener("shopify:section:unload", this._setupTransparentHeader.bind(this));
        document.addEventListener("shopify:section:reorder", this._setupTransparentHeader.bind(this));
      }
    }
  }
  async hide() {
    if (this._isVisible) {
      this._isVisible = false;
      document.documentElement.style.setProperty("--header-is-visible", "0");
      await animate11(this, { transform: ["translateY(0)", "translateY(-100%)"] }, { duration: 0.2, easing: "ease" }).finished;
      if (this._isVisible === false) {
        this.closest(".shopify-section").style.visibility = "hidden";
      }
    }
  }
  show() {
    if (!this._isVisible) {
      this.closest(".shopify-section").style.visibility = "visible";
      document.documentElement.style.setProperty("--header-is-visible", "1");
      animate11(this, { transform: ["translateY(-100%)", "translateY(0)"] }, { duration: 0.2, easing: "ease" });
      this._accumulatedScroll = 0;
      this._isVisible = true;
    }
  }
  _onScroll() {
    if (window.scrollY < 0) {
      return;
    }
    this._accumulatedScroll = Math.max(0, this._accumulatedScroll + (window.scrollY - this._lastScrollTop));
    if (window.scrollY < this._lastScrollTop) {
      this.show();
    } else if (this._accumulatedScroll > parseInt(this.getAttribute("hide-on-scroll")) && this.querySelectorAll("[open]").length === 0) {
      this.hide();
    }
    this._lastScrollTop = window.scrollY;
  }
  _checkTransparency() {
    let hasFallbackScrollDetection = false;
    if (CSS.supports("selector(:has(> *))") && this.hasAttribute("sticky") && !this.hasAttribute("hide-on-scroll") && this.hasAttribute("allow-transparency")) {
      const offsetBeforeChanging = 500;
      if (this.querySelectorAll("[open]").length > 0) {
        this.classList.add("is-filled");
      } else if (window.scrollY >= offsetBeforeChanging && !this._hasSwitchedToSticky) {
        this._hasSwitchedToSticky = true;
        this.classList.add("is-filled");
        animate11(this, { transform: ["translateY(-100%)", "translateY(0)"] }, { duration: 0.15, easing: "ease" });
      } else if (window.scrollY < offsetBeforeChanging) {
        if (this._hasSwitchedToSticky) {
          this._hasSwitchedToSticky = false;
          animate11(this, { transform: ["translateY(0)", "translateY(-100%)"] }, { duration: 0.15, easing: "ease" }).finished.then(() => {
            this.style.transform = null;
            this.classList.remove("is-filled");
          });
        } else if (this.getAnimations().length === 0) {
          this.classList.remove("is-filled");
        }
      }
    } else {
      hasFallbackScrollDetection = this.hasAttribute("sticky") && window.scrollY > 20;
      this.classList.toggle("is-filled", !this.hasAttribute("allow-transparency") || this.querySelectorAll("[open]").length > 0 || hasFallbackScrollDetection);
    }
  }
  _setupTransparentHeader() {
    if (document.querySelector(".shopify-section:first-child [allow-transparent-header]")) {
      this.setAttribute("allow-transparency", "");
      this.addEventListener("mouseenter", this._checkTransparency.bind(this));
      this.addEventListener("mouseleave", this._checkTransparency.bind(this));
      if (this.hasAttribute("sticky")) {
        window.addEventListener("scroll", throttle(this._checkTransparency.bind(this)));
      }
      this._checkTransparency();
    } else {
      this.removeAttribute("allow-transparency");
    }
  }
};
var DropdownDisclosure = class _DropdownDisclosure extends AnimatedDetails {
  constructor() {
    super();
    this._detectClickOutsideListener = this._detectClickOutside.bind(this);
    this._detectEscKeyboardListener = this._detectEscKeyboard.bind(this);
    this._detectFocusOutListener = this._detectFocusOut.bind(this);
    this._detectHoverListener = this._detectHover.bind(this);
    this._hoverTimer = null;
    this.addEventListener("mouseover", this._detectHoverListener.bind(this));
    this.addEventListener("mouseout", this._detectHoverListener.bind(this));
  }
  get trigger() {
    return !window.matchMedia("screen and (pointer: fine)").matches ? "click" : this.getAttribute("trigger");
  }
  get mouseOverDelayTolerance() {
    return 250;
  }
  /**
   * When the summary is clicked and that the mode is hover, we follow the link (if set) that may have been specified
   * on the parent. If the mode is click, then we deferred to the default behavior of the "AnimatedDetails" parent
   */
  _onSummaryClicked(event) {
    if (this.trigger === "hover") {
      event.preventDefault();
      if (event.currentTarget.hasAttribute("data-url")) {
        window.location.href = event.currentTarget.getAttribute("data-url");
      }
    } else {
      super._onSummaryClicked(event);
    }
  }
  async _transition(value) {
    if (value) {
      this.setAttribute("open", "");
      document.addEventListener("click", this._detectClickOutsideListener);
      document.addEventListener("keydown", this._detectEscKeyboardListener);
      document.addEventListener("focusout", this._detectFocusOutListener);
      const openSiblings = Array.from(this.closest("ul").querySelectorAll("[open]")).filter((item) => item !== this);
      openSiblings.forEach((sibling) => sibling.open = false);
      await this._transitionIn(openSiblings.length > 0);
    } else {
      document.removeEventListener("click", this._detectClickOutsideListener);
      document.removeEventListener("keydown", this._detectEscKeyboardListener);
      document.removeEventListener("focusout", this._detectFocusOutListener);
      await this._transitionOut();
      this.removeAttribute("open");
    }
  }
  _transitionIn(hasOpenSiblings = false) {
    const timelineSequence = [[this.contentElement, { opacity: 1 }, { duration: 0.2 }]];
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches && !reduceMenuAnimation) {
      timelineSequence.push([this.contentElement.querySelectorAll(":scope > ul > li"), { opacity: [0, 1], transform: ["translateY(-10px)", "translateY(0)"] }, { delay: stagger5(0.025), at: "-0.1", duration: 0.2 }]);
    }
    return timeline9(timelineSequence, { delay: hasOpenSiblings > 0 ? 0.1 : 0 }).finished;
  }
  _transitionOut() {
    return timeline9([[this.contentElement, { opacity: 0 }, { duration: 0.2 }]]).finished;
  }
  /**
   * When dropdown menu is configured to open on click, we add a listener to detect click outside and automatically
   * close the navigation.
   */
  _detectClickOutside(event) {
    if (this.trigger !== "click") {
      return;
    }
    if (!this.contains(event.target) && !(event.target.closest("details") instanceof _DropdownDisclosure)) {
      this.open = false;
    }
  }
  /**
   * On desktop device, if the mode is set to hover, we open/close the dropdown on hover
   */
  _detectHover(event) {
    if (this.trigger !== "hover") {
      return;
    }
    if (event.type === "mouseover") {
      this.open = true;
      clearTimeout(this._hoverTimer);
    } else {
      this._hoverTimer = setTimeout(() => this.open = false, this.mouseOverDelayTolerance);
    }
  }
  /**
   * Detect if we hit the "Escape" key to automatically close the dropdown
   */
  _detectEscKeyboard(event) {
    if (event.code === "Escape") {
      const targetMenu = event.target.closest("details[open]");
      if (targetMenu) {
        targetMenu.open = false;
      }
    }
  }
  /**
   * Close the dropdown automatically when the dropdown is focused out
   */
  _detectFocusOut(event) {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) {
      this.open = false;
    }
  }
};
var MegaMenuDisclosure = class extends DropdownDisclosure {
  constructor() {
    super();
    this.addEventListener("pointerover", this._preloadImages.bind(this));
  }
  get mouseOverDelayTolerance() {
    return 500;
  }
  _transitionIn(hasOpenSiblings) {
    const timelineSequence = [[this.contentElement, { opacity: 1 }, { duration: 0.2 }], "mega-menu"], contentDelay = hasOpenSiblings ? 0.1 : 0;
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches && !reduceMenuAnimation) {
      this.contentElement.querySelectorAll(".mega-menu__promo").forEach((promo) => {
        timelineSequence.push([promo, { opacity: [0, 1] }, { duration: 0.25, delay: contentDelay, at: "mega-menu" }], "mega-menu-promo");
      });
      this.contentElement.querySelectorAll(".mega-menu__nav > li").forEach((column) => {
        timelineSequence.push([column.querySelectorAll(":scope > :first-child, :scope li"), { opacity: [0, 1], transform: ["translateY(-10px)", "translateY(0)"] }, { easing: "ease", delay: stagger5(0.025, { start: contentDelay }), at: "mega-menu", duration: 0.2 }]);
      });
    }
    return timeline9(timelineSequence).finished;
  }
  /**
   * When the toggle is hovered we preload the mega-menu images to improve perceived performance
   */
  _preloadImages() {
    Array.from(this.querySelectorAll('img[loading="lazy"]')).forEach((image) => image.setAttribute("loading", "eager"));
  }
};
var MegaMenuPromoCarousel = class extends EffectCarousel {
  connectedCallback() {
    super.connectedCallback();
    if (this.nextElementSibling) {
      this.addEventListener("carousel:select", (event) => this._updateControlsColor(event.detail.slide));
    }
    this._updateControlsColor(this.items[this.selectedIndex]);
  }
  _updateControlsColor(slide) {
    const extractFrom = slide.classList.contains("content-over-media") ? slide : slide.firstElementChild;
    this.nextElementSibling.style.setProperty("--text-color", extractFrom.style.getPropertyValue("--text-color"));
  }
};
var NavigationDrawer = class extends Drawer {
  constructor() {
    super();
    const delegate = new Delegate6(this);
    delegate.on("click", "button[data-panel]", this._onPanelButtonClick.bind(this));
    this._isTransitioning = false;
    this.addEventListener("dialog:after-hide", () => {
      this.reinitializeDrawer();
    });
  }
  get openFrom() {
    return window.matchMedia("(max-width: 699px)").matches ? this.getAttribute("mobile-opening") : super.openFrom;
  }
  // Used for navigation mobile and navigation desktop set to drawer
  switchToPanel(panelIndex, linkListIndex = null) {
    const panels = this.querySelectorAll(".panel");
    let panelToHideTransform, panelToShowTransform, panelToHide = linkListIndex !== null ? panels[parseInt(panelIndex) - 1] : panels[parseInt(panelIndex) + 1], panelToShow = panels[panelIndex], linkLists = panelToShow.querySelectorAll(".panel__wrapper"), timelineSequence = [];
    if (document.dir === "rtl") {
      panelToHideTransform = linkListIndex !== null ? ["translateX(0%)", "translateX(100%)"] : ["translateX(0%)", "translateX(-100%)"];
      panelToShowTransform = linkListIndex !== null ? ["translateX(-100%)", "translateX(0%)"] : ["translateX(100%)", "translateX(0%)"];
    } else {
      panelToHideTransform = linkListIndex !== null ? ["translateX(0%)", "translateX(-100%)"] : ["translateX(0%)", "translateX(100%)"];
      panelToShowTransform = linkListIndex !== null ? ["translateX(100%)", "translateX(0%)"] : ["translateX(-100%)", "translateX(0%)"];
    }
    timelineSequence.push(
      [panelToHide, { transform: panelToHideTransform, opacity: [1, 0], visibility: ["visible", "hidden"] }, { duration: 0.3, opacity: { at: "+0.3" }, transform: { at: "+0.3" } }],
      "panelHidden",
      [panelToShow, { opacity: [0, 1], visibility: ["hidden", "visible"], transform: panelToShowTransform }, { at: "<", transform: { duration: 0.3 } }]
    );
    if (linkListIndex !== null) {
      timelineSequence.push(this.switchLinkList(linkLists, linkListIndex));
    }
    timeline9(timelineSequence);
  }
  // Used when mega menu is set to drawer
  showPanel(panelIndex, linkListIndex = null) {
    const panels = this.querySelectorAll(".panel");
    let timelineSequence = [], panelToShow = panels[panelIndex], linkLists = panelToShow.querySelectorAll(".panel__wrapper");
    if (!panelToShow.hasAttribute("open") && !this._isTransitioning) {
      this._isTransitioning = true;
      timelineSequence.push(
        [this, { width: [this.offsetWidth + "px", (this.offsetWidth - parseInt(window.getComputedStyle(this).getPropertyValue("padding"))) * 2 + "px"] }, { duration: 0.2 }],
        [panelToShow, { opacity: [0, 1], visibility: ["hidden", "visible"] }, { at: "<" }]
      );
      timelineSequence.push(this.switchLinkList(linkLists, linkListIndex));
    }
    if (this.previousLinkIndex && this.previousLinkIndex !== linkListIndex) {
      timelineSequence.push([linkLists[this.previousLinkIndex], { opacity: [1, 0], visibility: ["visible", "hidden"] }, { duration: 0.2 }]);
    }
    timeline9(timelineSequence).finished.then(() => {
      if (this.previousLinkIndex && this.previousLinkIndex !== linkListIndex) {
        linkLists[this.previousLinkIndex].removeAttribute("style");
      }
      if (panelToShow.hasAttribute("open") && this.previousLinkIndex !== linkListIndex) {
        timeline9([this.switchLinkList(linkLists, linkListIndex)]);
      }
      this.previousLinkIndex = linkListIndex;
      panelToShow.setAttribute("open", "");
      this._isTransitioning = false;
    });
  }
  switchLinkList(linkLists, linkListIndex) {
    Array.from(linkLists).forEach((item) => {
      item.setAttribute("hidden", "");
    });
    linkLists[linkListIndex].removeAttribute("hidden");
    return [linkLists[linkListIndex].querySelectorAll("li"), { opacity: [0, 1], visibility: ["hidden", "visible"], transform: ["translateY(-10px)", "translateY(0)"] }, { easing: "ease", duration: 0.2, at: "-0.15", delay: stagger5(0.025, { start: 0.1 }) }];
  }
  // Set navigation drawer to initial state when drawer closed
  reinitializeDrawer() {
    if (this.hasAttribute("mega-menu") && window.matchMedia("(min-width:1150px)").matches) {
      this.style.removeProperty("width");
      this.setExpanded();
    } else {
      const firstPanel = this.querySelector(".panel:first-child");
      firstPanel.style.opacity = "1";
      firstPanel.style.visibility = "visible";
      firstPanel.style.transform = "translateX(0%)";
    }
    Array.from(this.querySelectorAll(".panel:not(:first-child)")).forEach((item) => {
      if (this.hasAttribute("mega-menu")) {
        item.removeAttribute("open");
      }
      item.style.opacity = "0";
      item.style.visibility = "hidden";
      Array.from(item.querySelectorAll(".panel__wrapper")).forEach((list) => list.setAttribute("hidden", ""));
    });
  }
  setExpanded(target) {
    Array.from(this.querySelectorAll("button[data-panel]")).forEach((item) => {
      item.setAttribute("aria-expanded", "false");
    });
    if (target) {
      target.setAttribute("aria-expanded", "true");
    }
  }
  _onPanelButtonClick(event, target) {
    if (this.hasAttribute("mega-menu") && window.matchMedia("(min-width:1150px)").matches) {
      this.setExpanded(target);
      this.showPanel(...target.getAttribute("data-panel").split("-"));
    } else {
      this.switchToPanel(...target.getAttribute("data-panel").split("-"));
    }
  }
};
if (!window.customElements.get("store-header")) {
  window.customElements.define("store-header", StoreHeader);
}
if (!window.customElements.get("dropdown-disclosure")) {
  window.customElements.define("dropdown-disclosure", DropdownDisclosure, { extends: "details" });
}
if (!window.customElements.get("mega-menu-disclosure")) {
  window.customElements.define("mega-menu-disclosure", MegaMenuDisclosure, { extends: "details" });
}
if (!window.customElements.get("mega-menu-promo-carousel")) {
  window.customElements.define("mega-menu-promo-carousel", MegaMenuPromoCarousel);
}
if (!window.customElements.get("navigation-drawer")) {
  window.customElements.define("navigation-drawer", NavigationDrawer);
}

// js/sections/feature-chart.js
import { animate as motionAnimate3, scroll } from "vendor";
var FeatureChart = class extends HTMLElement {
  connectedCallback() {
    this.viewButtonElement = this.querySelector('[data-action="toggle-rows"]');
    this.featureChartTable = this.querySelector(".feature-chart__table");
    this.featureChartRows = Array.from(this.featureChartTable.childNodes);
    this.featureProductRow = this.querySelector(".feature-chart__table-row--product");
    this.featureChartSticky = this.querySelector(".feature-chart__table-row--sticky");
    if (this.viewButtonElement) {
      this.viewButtonElement.addEventListener("click", this._toggleRows.bind(this));
    }
    if (this.featureChartSticky) {
      this.featureChartSticky.style.width = `${this.featureChartTable.scrollWidth}px`;
      this.featureChartTable.addEventListener("scroll", (event) => {
        this.featureChartSticky.style.marginLeft = -1 * event.target.scrollLeft + "px";
      });
      new ResizeObserver((entries) => {
        this.featureChartSticky.style.width = `${entries[0].contentRect.width}px`;
      }).observe(this.featureChartTable);
      const offset = getComputedStyle(this).scrollPaddingTop;
      scroll(({ y }) => {
        if (y.current >= y.targetOffset + this.featureProductRow.clientHeight / 2 && y.progress < 0.85) {
          this.featureChartSticky.classList.add("is-visible");
        } else {
          this.featureChartSticky.classList.remove("is-visible");
        }
      }, {
        target: this.featureChartTable,
        offset: [`${offset} start`, `end ${offset}`]
      });
    }
  }
  _toggleRows() {
    if (this.classList.contains("is-expanded")) {
      this._hideRows();
    } else {
      this._showRows();
    }
  }
  async _showRows() {
    const fromHeight = this.featureChartTable.clientHeight;
    this.featureChartRows.forEach((row) => {
      row.hidden = false;
    });
    this.viewButtonElement.querySelector(".feature-chart__toggle-text").innerText = this.viewButtonElement.getAttribute("data-view-less");
    this.classList.add("is-expanded");
    await motionAnimate3(this.featureChartTable, { height: [`${fromHeight}px`, `${this.featureChartTable.clientHeight}px`] }).finished;
    this.featureChartTable.style.height = "auto";
  }
  async _hideRows() {
    let fromHeight = this.featureChartTable.clientHeight, toHeight = 0, maxRows = parseInt(this.getAttribute("max-rows"));
    this.featureChartRows.slice(0, maxRows).forEach((row) => {
      toHeight += row.clientHeight;
    });
    this.viewButtonElement.querySelector(".feature-chart__toggle-text").innerText = this.viewButtonElement.getAttribute("data-view-more");
    this.classList.remove("is-expanded");
    await motionAnimate3(this.featureChartTable, { height: [`${fromHeight}px`, `${toHeight}px`] }).finished;
    this.featureChartRows.slice(maxRows).forEach((row) => row.hidden = true);
    this.featureChartTable.style.height = "auto";
  }
};
if (!window.customElements.get("feature-chart")) {
  window.customElements.define("feature-chart", FeatureChart);
}

// js/sections/image-banner.js
import { scroll as scroll2, timeline as timeline10, animate as animate12, inView as inView7 } from "vendor";
var ImageBanner = class extends HTMLElement {
  connectedCallback() {
    if (this.parallax && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      this._setupParallax();
    }
    inView7(this, async () => {
      await imageLoaded(Array.from(this.querySelectorAll(":scope > :is(img, video, iframe, svg, video-media)")));
      const headings = Array.from(this.querySelectorAll('[reveal-on-scroll="true"]'));
      timeline10([
        [this, { opacity: [0, 1] }, { duration: 0.25 }],
        ...headings.map((heading) => [...getHeadingKeyframe(heading)])
      ]);
    });
  }
  get parallax() {
    return this.hasAttribute("parallax") ? parseFloat(this.getAttribute("parallax")) : false;
  }
  _setupParallax() {
    const media = Array.from(this.querySelectorAll(":scope > :is(img, video, iframe, svg, video-media, picture)")), [scale, translate] = [1 + this.parallax, this.parallax * 100 / (1 + this.parallax)];
    scroll2(
      animate12(media, { transform: [`scale(${scale}) translateY(-${translate}%)`, `scale(${scale}) translateY(0)`] }, { easing: "linear" }),
      {
        target: this,
        offset: ["start end", "end start"]
      }
    );
  }
};
if (!window.customElements.get("image-banner")) {
  window.customElements.define("image-banner", ImageBanner);
}

// js/sections/image-link-blocks.js
var ImageLinkBlocks = class extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.children);
    new ScrollArea(this);
    this.addEventListener("control:prev", this._prev);
    this.addEventListener("control:next", this._next);
  }
  _prev() {
    this.scrollBy({ left: (document.dir === "rtl" ? 1 : -1) * this.items[0].clientWidth, behavior: "smooth" });
  }
  _next() {
    this.scrollBy({ left: (document.dir === "rtl" ? -1 : 1) * this.items[0].clientWidth, behavior: "smooth" });
  }
};
if (!window.customElements.get("image-link-blocks")) {
  window.customElements.define("image-link-blocks", ImageLinkBlocks);
}

// js/sections/images-with-text-scrolling.js
import { animate as animate13, timeline as timeline11, inView as inView8 } from "vendor";
var ImagesWithTextScrolling = class extends HTMLElement {
  connectedCallback() {
    inView8(this, this._reveal.bind(this));
    if (this.hasAttribute("scrolling-experience")) {
      this._imageToTransitionItems = Array.from(this.querySelectorAll(".images-scrolling-desktop__media-wrapper > :not(:first-child)"));
      this._mainImage = this.querySelector(".images-scrolling-desktop__media-wrapper > :first-child");
      this._contentItems = Array.from(this.querySelectorAll(".images-scrolling__content"));
      if (this._imageToTransitionItems.length > 0) {
        window.addEventListener("scroll", throttle(this._onScroll.bind(this)));
      }
    }
  }
  _reveal() {
    Array.from(this.querySelectorAll('[reveal-on-scroll="true"]')).forEach((heading) => {
      animate13(...getHeadingKeyframe(heading));
    });
  }
  _onScroll() {
    const imageRect = this._mainImage.getBoundingClientRect(), imageBottom = imageRect.bottom, imageEffect = this.getAttribute("scrolling-experience");
    for (const [index, contentItem] of this._contentItems.entries()) {
      const contentItemRect = contentItem.getBoundingClientRect(), image = this._imageToTransitionItems[index - 1], content = this._contentItems[index];
      if (contentItemRect.top < imageBottom - imageRect.height * 0.1 && contentItemRect.bottom > imageBottom) {
        if (image && !image.classList.contains("is-visible")) {
          image.classList.add("is-visible");
          if (imageEffect === "fade") {
            timeline11([
              [image, { opacity: [null, 1] }, { duration: 0.2 }],
              [content, { opacity: [null, 1] }, { duration: 0.45, at: "<" }]
            ]);
          } else {
            timeline11([
              [image, { opacity: [null, 1], clipPath: ["inset(100% 0 0 0)", "inset(0 0 0 0)"] }, { duration: 0.35, easing: [0.99, 0.01, 0.5, 0.94], opacity: { duration: 0 } }],
              [content, { opacity: [null, 1] }, { duration: 0.45, at: "<" }]
            ]);
          }
        }
        break;
      }
      if (contentItemRect.top > imageBottom - imageRect.height * 0.1) {
        if (image && image.classList.contains("is-visible")) {
          image.classList.remove("is-visible");
          if (imageEffect === "fade") {
            timeline11([
              [image, { opacity: [null, 0] }, { duration: 0.2 }],
              [content, { opacity: [null, 0] }, { duration: 0.2, at: "<" }]
            ]);
          } else {
            timeline11([
              [image, { opacity: [null, 1], clipPath: ["inset(0 0 0 0)", "inset(100% 0 0 0)"] }, { duration: 0.35, easing: [0.99, 0.01, 0.5, 0.94], opacity: { duration: 0 } }],
              [content, { opacity: [null, 0] }, { duration: 0.2, at: "<" }]
            ]);
          }
        }
        break;
      }
    }
  }
};
if (!window.customElements.get("images-with-text-scrolling")) {
  window.customElements.define("images-with-text-scrolling", ImagesWithTextScrolling);
}

// js/sections/impact-text.js
import { animate as animate14, inView as inView9 } from "vendor";
var ImpactText = class extends HTMLElement {
  connectedCallback() {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      return;
    }
    inView9(this, ({ target }) => this._onBecameVisible(target), { margin: "-100px" });
  }
  async _onBecameVisible(target) {
    animate14(target, { opacity: 1, transform: ["translateY(10px)", "translateY(0)"] }, { duration: 0.3 });
    if (this.hasAttribute("count-up")) {
      const itemToSearch = this.childElementCount === 0 ? this : this.firstElementChild, matches = itemToSearch.textContent.trim().match(/\d+(?:[,. ]\d+)*/);
      if (!matches) {
        return;
      }
      itemToSearch.innerHTML = itemToSearch.textContent.replace(/\d+(?:[,. ]\d+)*/, `<span>${matches[0]}</span>`);
      const numberSpan = itemToSearch.querySelector("span");
      numberSpan.style.textAlign = matches[0] === matches["input"] ? null : "end";
      if (!itemToSearch.classList.contains("text-gradient")) {
        numberSpan.style.display = "inline-block";
        numberSpan.style.minWidth = `${numberSpan.clientWidth}px`;
      }
      const toReplace = matches[0].replace(/[,\. ]+/, ""), charactersMatches = [...matches[0].matchAll(/[,\. ]+/g)];
      await animate14((progress) => {
        let formattedString = Math.round(progress * parseInt(toReplace)).toString();
        charactersMatches.forEach((character) => {
          if (formattedString.length >= matches[0].length - character.index) {
            formattedString = formattedString.slice(0, character.index) + character[0] + formattedString.slice(character.index);
          }
        });
        numberSpan.textContent = progress === 1 ? matches[0] : formattedString;
      }, { duration: parseFloat(this.getAttribute("count-up")), easing: [0.16, 1, 0.3, 1] }).finished;
      numberSpan.style.minWidth = null;
    }
  }
};
if (!window.customElements.get("impact-text")) {
  window.customElements.define("impact-text", ImpactText);
}

// js/sections/main-search.js
var SearchResultPanel = class extends HTMLElement {
  async connectedCallback() {
    if (!this.hasAttribute("load-from-url")) {
      return;
    }
    const textResponse = await (await fetch(encodeURI(`${this.getAttribute("load-from-url")}&section_id=${extractSectionId(this)}`))).text();
    const temporaryContent = new DOMParser().parseFromString(textResponse, "text/html");
    const searchResultsPanel = temporaryContent.querySelector(`#${this.getAttribute("id")}`);
    if (searchResultsPanel) {
      this.replaceChildren(...searchResultsPanel.children);
    } else {
      document.querySelector(`[controlled-panel="${this.id}"]`).remove();
      this.remove();
    }
  }
};
if (!window.customElements.get("search-result-panel")) {
  window.customElements.define("search-result-panel", SearchResultPanel);
}

// js/sections/media-grid.js
import { timeline as timeline12, inView as inView10 } from "vendor";
var MediaGrid = class extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.children);
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      inView10(this, this._onBecameVisible.bind(this));
    }
  }
  _onBecameVisible() {
    const contentElements = this.querySelectorAll(".content-over-media > :not(img, video, iframe, svg, video-media, native-video, external-video)");
    timeline12([
      [this.items, { opacity: 1, transform: ["translateY(10px)", "translateY(0)"] }, { duration: 0.3 }],
      [contentElements, { opacity: [0, 1] }, { duration: 0.2, at: "+0.1" }]
    ]);
  }
};
if (!window.customElements.get("media-grid")) {
  window.customElements.define("media-grid", MediaGrid);
}

// js/sections/media-with-text.js
import { animate as animate15, timeline as timeline13, inView as inView11 } from "vendor";
var reduceMotion = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
var MediaWithText = class extends HTMLElement {
  connectedCallback() {
    if (reduceMotion) {
      Array.from(this.querySelectorAll(".media-with-text__item")).forEach((item) => {
        inView11(item, (observer) => this.reveal(observer.target));
      });
    }
  }
  reveal(item) {
    const media = item.querySelector(".media-with-text__media");
    imageLoaded(media.querySelector("img")).then(() => {
      timeline13([
        [media, { opacity: [0, 1] }, { duration: 0.3 }],
        [media.querySelector("img, video-media"), { transform: ["scale(1.05)", "scale(1)"] }, { duration: 0.3, at: "<" }]
      ]);
    });
    animate15(item.querySelector(".media-with-text__content > .prose"), { opacity: [0, 1] }, { duration: 0.2, delay: 0.3 });
  }
};
if (!window.customElements.get("media-with-text")) {
  window.customElements.define("media-with-text", MediaWithText);
}

// js/sections/multiple-images-with-text.js
import { timeline as timeline14, animate as animate16, stagger as stagger6, inView as inView12 } from "vendor";
var MultipleImagesWithText = class extends HTMLElement {
  constructor() {
    super();
    this._imageCarousel = this.querySelector("multiple-images-with-text-image-list");
    this._contentCarousel = this.querySelector("multiple-images-with-text-content-list");
    this.addEventListener("control:prev", () => {
      this._imageCarousel.previous();
      this._contentCarousel.previous();
    });
    this.addEventListener("control:next", () => {
      this._imageCarousel.next();
      this._contentCarousel.next();
    });
    if (Shopify.designMode) {
      this.addEventListener("shopify:block:select", (event) => {
        if (event.target.hasAttribute("image-id")) {
          this._imageCarousel.select(this._imageCarousel.items.findIndex((item) => item.id === event.target.getAttribute("image-id")));
        }
      });
    }
  }
};
var MultipleImagesWithTextImageList = class extends EffectCarousel {
  constructor() {
    super();
    inView12(this, this._reveal.bind(this));
  }
  async _reveal() {
    await imageLoaded(this.querySelectorAll("img"));
    if (this.getAttribute("layout") === "stacked") {
      timeline14([
        [this.lastElementChild, { transform: "rotate(0deg)" }],
        [this.lastElementChild?.previousElementSibling, { transform: "rotate(2deg)" }, { at: "<" }],
        [this.lastElementChild?.previousElementSibling?.previousElementSibling, { transform: "rotate(-2deg)" }, { at: "<" }]
      ], {
        defaultOptions: { duration: 0.15, easing: [0.26, 0.02, 0.27, 0.97] }
      });
    } else if (this.getAttribute("layout") === "collage") {
      timeline14([
        [this.children, { opacity: 1, transform: ["translateY(15px)", "translateY(0)"] }, { duration: 0.3, delay: stagger6(0.1) }]
      ]);
    } else {
      timeline14([
        [this.children, { opacity: 1, transform: "rotate(var(--image-rotation, 0deg))" }, { duration: 0.3, delay: stagger6(0.1) }]
      ]);
    }
  }
  _transitionTo(fromSlide, toSlide, { direction, animate: animate19 }) {
    if (this.getAttribute("layout") !== "stacked") {
      return;
    }
    const transitionSpeed = 0.2;
    if (direction === "next") {
      const fromSlideTransform = getComputedStyle(fromSlide).getPropertyValue("transform");
      return timeline14([
        [fromSlide, { opacity: 0, transform: "rotate(5deg) translate(40px, 10px)" }, { duration: transitionSpeed }],
        [toSlide, { zIndex: 1 }, { duration: transitionSpeed, zIndex: { easing: "step-start" } }],
        [fromSlide, { opacity: 1, transform: fromSlideTransform, zIndex: -1 }, { duration: transitionSpeed, at: "<", zIndex: { easing: "step-start" } }],
        [toSlide.previousElementSibling, { zIndex: 0 }, { at: "<", easing: "step-start" }]
      ], { defaultOptions: { easing: [0.26, 0.02, 0.27, 0.97] } }).finished;
    } else {
      const toSlideTransform = getComputedStyle(toSlide).getPropertyValue("transform");
      return timeline14([
        [toSlide, { opacity: 0, transform: "rotate(-5deg) translate(-40px, -10px)" }, { duration: transitionSpeed }],
        this.items.length >= 3 && [fromSlide.previousElementSibling || this.lastElementChild, { zIndex: -1 }, { easing: "step-start" }],
        [toSlide, { opacity: 1, transform: toSlideTransform, zIndex: 1 }, { duration: transitionSpeed, at: this.items.length >= 3 ? "<" : "+0", zIndex: { easing: "step-start" } }],
        [fromSlide, { zIndex: 0 }, { duration: transitionSpeed, at: "<", zIndex: { easing: "step-start" } }]
      ].filter(Boolean), { defaultOptions: { easing: [0.26, 0.02, 0.27, 0.97] } }).finished;
    }
  }
};
var MultipleImagesWithTextContentList = class extends EffectCarousel {
  constructor() {
    super();
    inView12(this, this._reveal.bind(this));
  }
  _reveal() {
    animate16(...getHeadingKeyframe(this.querySelector('[reveal-on-scroll="true"]')));
  }
  _transitionTo(fromSlide, toSlide, { direction = "next", animate: animate19 = true } = {}) {
    fromSlide.classList.remove("is-selected");
    toSlide.classList.add("is-selected");
    return timeline14([
      [fromSlide, { opacity: [1, 0], visibility: ["visible", "hidden"] }],
      [toSlide, { opacity: [0, 1], visibility: ["hidden", "visible"] }],
      [...getHeadingKeyframe(toSlide.querySelector('[reveal-on-scroll="true"]'), { at: "<" })]
    ], { duration: animate19 ? parseFloat(this.getAttribute("fade-speed") || 0.5) : 0 }).finished;
  }
};
if (!window.customElements.get("multiple-images-with-text")) {
  window.customElements.define("multiple-images-with-text", MultipleImagesWithText);
}
if (!window.customElements.get("multiple-images-with-text-image-list")) {
  window.customElements.define("multiple-images-with-text-image-list", MultipleImagesWithTextImageList);
}
if (!window.customElements.get("multiple-images-with-text-content-list")) {
  window.customElements.define("multiple-images-with-text-content-list", MultipleImagesWithTextContentList);
}

// js/sections/newsletter-popup.js
var NewsletterPopup = class extends Drawer {
  connectedCallback() {
    super.connectedCallback();
    if (this.shouldAppearAutomatically) {
      setTimeout(() => this.show(), this.apparitionDelay);
    }
  }
  get initialFocus() {
    return false;
  }
  get shouldAppendToBody() {
    return false;
  }
  get apparitionDelay() {
    return parseInt(this.getAttribute("apparition-delay") || 0) * 1e3;
  }
  get shouldAppearAutomatically() {
    return !(localStorage.getItem("theme:popup-filled") === "true" || this.hasAttribute("only-once") && localStorage.getItem("theme:popup-appeared") === "true");
  }
  _setInitialPosition() {
    this.style.top = null;
    this.style.bottom = "0px";
    this.style.left = document.dir === "ltr" ? null : "0px";
    this.style.right = document.dir === "rtl" ? "auto" : "0px";
  }
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === "open" && this.open) {
      localStorage.setItem("theme:popup-appeared", "true");
    }
  }
};
if (!window.customElements.get("newsletter-popup")) {
  window.customElements.define("newsletter-popup", NewsletterPopup);
}

// js/sections/press.js
import { timeline as timeline15, animate as animate17, inView as inView13 } from "vendor";
var reduceMotion2 = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
var PressCarousel = class extends EffectCarousel {
  constructor() {
    super();
    if (reduceMotion2) {
      inView13(this, this._reveal.bind(this));
    }
  }
  _reveal() {
    animate17(this.selectedSlide.querySelector(".blockquote"), { opacity: 1, transform: ["translateY(15px)", "translateY(0)"] }, { duration: 0.2 });
  }
  async _transitionTo(fromSlide, toSlide, options = {}) {
    await timeline15([
      [fromSlide.querySelectorAll(".press__logo, .press__author"), { opacity: [null, 0] }, { duration: 0.2 }],
      [fromSlide.querySelector(".blockquote"), { opacity: [null, 0], ...reduceMotion2 && { transform: [null, "translateY(-10px)"] } }, { duration: 0.2, at: "<" }]
    ]).finished;
    fromSlide.classList.remove("is-selected");
    toSlide.classList.add("is-selected");
    await timeline15([
      [toSlide.querySelectorAll(".press__logo, .press__author"), { opacity: [0, 1] }, { duration: 0.2 }],
      [toSlide.querySelector(".blockquote"), { opacity: [0, 1], ...reduceMotion2 && { transform: ["translateY(10px)", "translateY(0px)"] } }, { duration: 0.2, at: "<" }]
    ]).finished;
  }
};
if (!window.customElements.get("press-carousel")) {
  window.customElements.define("press-carousel", PressCarousel);
}

// js/sections/product-recommendations.js
var ProductRecommendations = class extends HTMLElement {
  constructor() {
    super();
    this._isLoaded = false;
  }
  connectedCallback() {
    this._loadRecommendations();
  }
  async _loadRecommendations() {
    if (this._isLoaded) {
      return;
    }
    this._isLoaded = true;
    const section = this.closest(".shopify-section"), intent = this.getAttribute("intent") || "related", url = `${Shopify.routes.root}recommendations/products?product_id=${this.getAttribute("product")}&limit=${this.getAttribute("limit") || 4}&section_id=${section.id.replace("shopify-section-", "")}&intent=${intent}`, response = await fetch(url, { priority: "low" });
    const tempDiv = new DOMParser().parseFromString(await response.text(), "text/html"), productRecommendationsElement = tempDiv.querySelector("product-recommendations");
    if (productRecommendationsElement.childElementCount > 0) {
      this.replaceChildren(...document.importNode(productRecommendationsElement, true).childNodes);
    } else {
      if (intent === "related") {
        section.remove();
      } else {
        this.remove();
      }
    }
  }
};
if (!window.customElements.get("product-recommendations")) {
  window.customElements.define("product-recommendations", ProductRecommendations);
}

// js/sections/recently-viewed-products.js
var _isLoaded, _RecentlyViewedProducts_instances, searchQueryString_get, loadProducts_fn;
var RecentlyViewedProducts = class extends HTMLElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _RecentlyViewedProducts_instances);
    __privateAdd(this, _isLoaded, false);
  }
  connectedCallback() {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(__privateMethod(this, _RecentlyViewedProducts_instances, loadProducts_fn).bind(this), { timeout: 1500 });
    } else {
      __privateMethod(this, _RecentlyViewedProducts_instances, loadProducts_fn).call(this);
    }
  }
};
_isLoaded = new WeakMap();
_RecentlyViewedProducts_instances = new WeakSet();
searchQueryString_get = function() {
  const items = new Set(JSON.parse(localStorage.getItem("theme:recently-viewed-products") || "[]"));
  if (this.hasAttribute("exclude-id")) {
    items.delete(parseInt(this.getAttribute("exclude-id")));
  }
  return Array.from(items.values(), (item) => `id:${item}`).slice(0, parseInt(this.getAttribute("products-count"))).join(" OR ");
};
loadProducts_fn = async function() {
  if (__privateGet(this, _isLoaded)) {
    return;
  }
  __privateSet(this, _isLoaded, true);
  const section = this.closest(".shopify-section"), url = `${Shopify.routes.root}search?type=product&q=${__privateGet(this, _RecentlyViewedProducts_instances, searchQueryString_get)}&section_id=${extractSectionId(section)}`, response = await fetch(url, { priority: "low" });
  const tempDiv = new DOMParser().parseFromString(await response.text(), "text/html"), recentlyViewedProductsElement = tempDiv.querySelector("recently-viewed-products");
  if (recentlyViewedProductsElement.childElementCount > 0) {
    this.replaceChildren(...document.importNode(recentlyViewedProductsElement, true).childNodes);
  } else {
    section.remove();
  }
};
if (!window.customElements.get("recently-viewed-products")) {
  window.customElements.define("recently-viewed-products", RecentlyViewedProducts);
}

// js/sections/revealed-image-on-scroll.js
import { scroll as scroll3, timeline as timeline16, ScrollOffset, inView as inView14 } from "vendor";
var RevealedImage = class extends HTMLElement {
  connectedCallback() {
    const scrollTracker = this.querySelector(".revealed-image__scroll-tracker"), scroller = this.querySelector(".revealed-image__scroller");
    scrollTracker.style.height = `${scroller.clientHeight}px`;
    new ResizeObserver((entries) => scrollTracker.style.height = `${entries[0].contentRect.height}px`).observe(scroller);
    scroll3(timeline16([
      [this.querySelectorAll(".revealed-image__image-clipper, .revealed-image__content--inside"), { clipPath: ["inset(37% 37% 41% 37%)", "inset(calc(var(--sticky-area-height) / 2) 0)"] }, { easing: "ease-in" }],
      [this.querySelectorAll("img, svg"), { transform: ["translate(-10%, -1.5%) scale(1.4)", "translate(0, 0) scale(1)"] }, { easing: "ease-in", at: "<" }],
      [this.querySelectorAll(".revealed-image__content"), { opacity: [0, 1, 1] }, { offset: [0, 0.25, 1], at: "<" }]
    ]), {
      target: scrollTracker,
      offset: ScrollOffset.All
    });
    inView14(this, () => {
      this.style.visibility = "visible";
      return () => {
        this.style.visibility = "hidden";
      };
    }, { margin: "200px" });
  }
};
if (!window.customElements.get("revealed-image")) {
  window.customElements.define("revealed-image", RevealedImage);
}

// js/sections/scrolling-text.js
import { animate as animate18, scroll as scroll4 } from "vendor";
var ScrollingText = class extends HTMLElement {
  connectedCallback() {
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      if (window.ScrollTimeline) {
        const timeline18 = new ViewTimeline({
          subject: this,
          axis: "block"
        });
        this.animate(
          {
            transform: ["translateX(calc(var(--transform-logical-flip) * 50vw))", "translateX(calc(var(--transform-logical-flip) * 50vw - 10%))"]
          },
          {
            timeline: timeline18,
            rangeStart: "cover 0%",
            rangeEnd: "cover 100%"
          }
        );
      } else {
        scroll4(
          animate18(
            this,
            {
              transform: ["translateX(calc(var(--transform-logical-flip) * 50vw))", "translateX(calc(var(--transform-logical-flip) * 50vw - 10%))"]
            }
          ),
          {
            target: this,
            offset: ["start end", "end start"]
          }
        );
      }
    }
  }
};
if (!window.customElements.get("scrolling-text")) {
  window.customElements.define("scrolling-text", ScrollingText);
}

// js/sections/shop-the-look.js
var ShopTheLookDots = class extends HTMLElement {
  connectedCallback() {
    this._abortController = new AbortController();
    Array.from(this.children).forEach((dots) => {
      document.getElementById(dots.getAttribute("aria-controls")).addEventListener("carousel:change", (event) => this._onDotClicked(event), { signal: this._abortController.signal });
    });
  }
  disconnectedCallback() {
    this._abortController.abort();
  }
  _onDotClicked(event) {
    Array.from(this.querySelectorAll(`button:nth-child(${event.detail.index + 1})`)).forEach((button) => button.click());
  }
};
if (!window.customElements.get("shop-the-look-dots")) {
  window.customElements.define("shop-the-look-dots", ShopTheLookDots);
}

// js/sections/slideshow.js
import { animate as motionAnimate4, timeline as timeline17, inView as inView15 } from "vendor";
var Slideshow = class extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("carousel:select", this._onSlideSelected);
  }
  async _onSlideSelected(event) {
    const slideStyles = getComputedStyle(event.detail.slide);
    this.style.setProperty("--slideshow-controls-background", slideStyles.getPropertyValue("--slideshow-slide-controls-background"));
    this.style.setProperty("--slideshow-controls-color", slideStyles.getPropertyValue("--slideshow-slide-controls-color"));
    if (!this.classList.contains("slideshow--boxed")) {
      return;
    }
    const backgroundElement = this.querySelector(".slideshow__slide-background");
    const background = slideStyles.getPropertyValue("--slideshow-slide-background");
    backgroundElement.style.background = background;
    await motionAnimate4(backgroundElement, { opacity: [0, 1] }, { duration: 0.2 }).finished;
    this.style.setProperty("--slideshow-background", background);
    motionAnimate4(backgroundElement, { opacity: 0 }, { duration: 0 });
  }
};
var SlideshowCarousel = class extends EffectCarousel {
  _pendingAnimationControls = [];
  constructor() {
    super();
    this.addEventListener("carousel:select", this._onSlideSelected);
    if (this.hasAttribute("reveal-on-scroll")) {
      inView15(this, this._reveal.bind(this));
    }
    if (this.querySelector(".slideshow__cursor")) {
      this.addEventListener("tap", this._onSlideshowTap);
    }
  }
  connectedCallback() {
    super.connectedCallback();
    if (this._player && this.hasAttribute("autoplay")) {
      this._player.addEventListener("player:start", (event) => {
        const cursorRing = this.querySelector(".slideshow__cursor-ring circle");
        if (cursorRing) {
          const cursorRingAnimationControl = motionAnimate4(cursorRing, { strokeDasharray: [`0px, ${cursorRing.getTotalLength()}px`, `${cursorRing.getTotalLength()}px, ${cursorRing.getTotalLength()}px`] }, {
            duration: event.detail.duration,
            easing: "linear"
          });
          this._pendingAnimationControls.push(cursorRingAnimationControl);
        }
        const circles = Array.from(this.querySelectorAll(".numbered-dots__item"));
        circles.forEach((item) => {
          const circle = item.querySelector("circle:last-child");
          let circleAnimationControl = null;
          if (item.getAttribute("aria-current") === "true") {
            circleAnimationControl = motionAnimate4(circle, { strokeDasharray: [`0px, ${circle.getTotalLength()}px`, `${circle.getTotalLength()}px, ${circle.getTotalLength()}px`] }, { duration: event.detail.duration, easing: "linear" });
          } else {
            circleAnimationControl = motionAnimate4(circle, { strokeDasharray: `${circle.getTotalLength()}px, ${circle.getTotalLength()}px` }, { duration: 0, easing: "linear" });
          }
          this._pendingAnimationControls.push(circleAnimationControl);
        });
      });
      this._player.addEventListener("player:pause", () => {
        this._pendingAnimationControls.forEach((control) => control.pause());
      });
      this._player.addEventListener("player:resume", () => {
        this._pendingAnimationControls.forEach((control) => control.play());
      });
    }
  }
  get transitionType() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "fade" : this.getAttribute("transition");
  }
  async _reveal() {
    const selectedSlide = this.selectedSlide;
    await imageLoaded(selectedSlide.querySelectorAll("img"));
    this.style.opacity = "1";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    if (!this._reloaded) {
      timeline17([
        [selectedSlide, { zIndex: 1 }, { duration: 0 }],
        [selectedSlide.querySelectorAll("img, video-media"), { opacity: [0, 1], transform: ["scale(1.05)", "scale(1)"] }, { duration: 0.3 }],
        "content",
        [selectedSlide.querySelectorAll('[data-sequence="subheading"], .button'), { opacity: [0, 1] }, { duration: 0.3, at: "content" }],
        [...getHeadingKeyframe(selectedSlide.querySelector('[data-sequence="heading"]'), { duration: 0.3, at: "content" })],
        [selectedSlide.querySelector(".button"), { opacity: [0, 1] }, { duration: 0.3, at: "content" }],
        [this.querySelector(".slideshow__controls"), { opacity: [0, 1], transform: ["translateY(10px)", "translateY(0)"] }, { duration: 0.3 }]
      ]);
    }
  }
  _onSlideshowTap(event) {
    if (event.target.matches("button, a[href], button :scope, a[href] :scope") || !window.matchMedia("screen and (pointer: fine)").matches) {
      return;
    }
    event.detail.originalEvent.clientX > window.innerWidth / 2 ? this.next() : this.previous();
  }
  /**
   * Perform a simple fade animation. For more complex animations, you should implement your own custom elements
   * that extends the EffectCarousel, and implement your own transition. You should make sure to return a promise
   * that resolves when the animation is finished
   */
  async _transitionTo(fromSlide, toSlide, { direction, animate: animate19 = true } = {}) {
    fromSlide.classList.remove("is-selected");
    toSlide.classList.add("is-selected");
    let timelineControls = null;
    switch (this.transitionType) {
      case "fade":
        timelineControls = this._fade(fromSlide, toSlide, { animate: animate19 });
        break;
      case "fade_with_text":
        timelineControls = this._fadeWithText(fromSlide, toSlide, { animate: animate19 });
        break;
    }
    if (!animate19) {
      timelineControls.finish();
    }
    return timelineControls.finished;
  }
  /**
   * Perform a simple fade transition
   */
  _fade(fromSlide, toSlide) {
    return timeline17([
      [fromSlide, { opacity: [1, 0], visibility: ["visible", "hidden"], zIndex: 0 }, { duration: 0.3, easing: "ease-in", zIndex: { easing: "step-end" } }],
      [toSlide, { opacity: [0, 1], visibility: ["hidden", "visible"], zIndex: 1 }, { duration: 0.3, at: "<", easing: "ease-out", zIndex: { easing: "step-end" } }]
    ]);
  }
  /**
   * Perform a transition with fade images and image transition
   */
  async _fadeWithText(fromSlide, toSlide) {
    motionAnimate4(fromSlide, { opacity: [1, 0], visibility: ["visible", "hidden"], zIndex: 0 }, { duration: 0.3, easing: "ease-in", zIndex: { easing: "step-end" } });
    await imageLoaded(toSlide.querySelectorAll("img"));
    motionAnimate4(toSlide, { opacity: [0, 1], visibility: ["hidden", "visible"], zIndex: 1 }, { duration: 0, zIndex: { easing: "step-end" } });
    return timeline17([
      [toSlide.querySelectorAll("img, video-media"), { opacity: [0, 1], transform: ["scale(1.05)", "scale(1)"] }, { duration: 0.3, easing: "ease-out" }],
      "content",
      [toSlide.querySelectorAll('[data-sequence="subheading"], .button'), { opacity: [0, 1] }, { duration: 0.3, at: "content" }],
      [...getHeadingKeyframe(toSlide.querySelector('[data-sequence="heading"]'), { duration: 0.3, at: "content" })]
    ]);
  }
  /**
   * Perform the synchronization with video
   */
  async _onSlideSelected(event) {
    Array.from(this.querySelectorAll("video-media")).forEach((video) => video.pause());
    if (event.detail.slide.getAttribute("data-slide-type") === "video") {
      const visibleVideo = Array.from(event.detail.slide.querySelectorAll("video-media")).filter((video) => video.offsetParent !== null).pop();
      visibleVideo.play({ restart: true });
      if (this.player) {
        const video = visibleVideo.querySelector("video");
        if (isNaN(video.duration)) {
          await new Promise((resolve) => {
            video.onloadedmetadata = () => resolve();
          });
        }
        this._player.setDuration(video.duration);
        this._player.resume({ restart: true });
      }
    } else {
      this._player?.setDuration(parseInt(this.getAttribute("autoplay")));
    }
  }
};
if (!window.customElements.get("x-slideshow")) {
  window.customElements.define("x-slideshow", Slideshow);
}
if (!window.customElements.get("slideshow-carousel")) {
  window.customElements.define("slideshow-carousel", SlideshowCarousel);
}

// js/theme.js
import { Delegate as Delegate7 } from "vendor";
(() => {
  const delegateDocument = new Delegate7(document.documentElement);
  if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    delegateDocument.on("click", 'a[href*="#"]', (event, target) => {
      if (event.defaultPrevented || target.pathname !== window.location.pathname || target.search !== window.location.search) {
        return;
      }
      const url = new URL(target.href);
      if (url.hash === "") {
        return;
      }
      const anchorElement = document.querySelector(url.hash);
      if (anchorElement) {
        event.preventDefault();
        anchorElement.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }
  const setScrollbarWidth = () => {
    const scrollbarWidth = window.innerWidth - document.body.clientWidth;
    if (scrollbarWidth > 0) {
      document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    }
  };
  setScrollbarWidth();
  window.addEventListener("resize", throttle(setScrollbarWidth));
})();
export {
  AccordionDisclosure,
  AccountLogin,
  AnimatedDetails,
  AnnouncementBar,
  BuyButtons,
  CartCount,
  CartDiscountBanner,
  CartDiscountField,
  CartDiscountRemoveButton,
  CartDrawer,
  CartNote,
  CartNotificationDrawer,
  CollectionList,
  ConfirmButton,
  CopyButton,
  CountrySelector,
  CustomButton,
  CustomCursor,
  DialogElement,
  Drawer,
  DropdownDisclosure,
  EffectCarousel,
  FacetApplyButton,
  FacetDialog,
  FacetDrawer,
  FacetFloatingFilter,
  FacetForm,
  FacetLink,
  FacetSortBy,
  FeatureChart,
  FreeShippingBar,
  GestureArea,
  GiftCardRecipient,
  HeightObserver,
  ImageBanner,
  ImageLinkBlocks,
  ImagesWithTextScrolling,
  ImpactText,
  LineItem,
  LineItemQuantity,
  Listbox,
  MarqueeText,
  MediaCarousel,
  MediaGrid,
  MediaWithText,
  MegaMenuDisclosure,
  MegaMenuPromoCarousel,
  ModelMedia,
  MultipleImagesWithText,
  MultipleImagesWithTextContentList,
  MultipleImagesWithTextImageList,
  NavigationDrawer,
  NewsletterPopup,
  NextButton,
  PageDots,
  PillLoader,
  Player,
  Popover,
  PredictiveSearch,
  PressCarousel,
  PrevButton,
  PriceRange,
  PrivacyBar,
  ProductCard,
  ProductForm,
  ProductGallery,
  ProductLoader,
  ProductQuickAdd,
  ProductRecommendations,
  ProductRerender,
  ProductZoomButton,
  ProgressBar,
  QuantitySelector,
  QuickBuyDrawer,
  RecentlyViewedProducts,
  ResizableTextarea,
  RevealItems,
  RevealedImage,
  SafeSticky,
  ScrollArea,
  ScrollCarousel,
  ScrollProgress,
  ScrollShadow,
  ScrollingText,
  SearchDrawer,
  SearchResultPanel,
  SectionHeader,
  ShareButton,
  ShippingEstimator,
  ShopTheLookDots,
  Slideshow,
  SlideshowCarousel,
  SplitCursor,
  SplitLines,
  StoreHeader,
  Tabs,
  VariantPicker,
  VideoMedia,
  announceError,
  announceStatus,
  cachedFetch,
  createMediaImg,
  debounce,
  deepQuerySelector,
  extractSectionId,
  fetchCart,
  generateSrcset,
  getHeadingKeyframe,
  imageLoaded,
  throttle,
  waitForEvent
};
