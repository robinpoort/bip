(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return factory(root);
    });
  } else if (typeof exports === 'object') {
    module.exports = factory(root);
  } else {
    root.Bip = factory(root);
  }
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this, function (window) {

  'use strict';


  // Feature Test
  // ============

  var supports = 'querySelector' in document && 'addEventListener' in window;


  // Default variables
  // =================
  var defaults = {

    selector: '[data-touch]',
    controls: '[data-touch-controls]',
    closes: '[data-touch-closes]',

    threshold: 35,
    openClass: 'is-open',

    emitEvents: true
  };

  let touchstartX = 0;
  let touchstartY = 0;
  let touchendX = 0;
  let touchendY = 0;
  let touchmoved = false;
  let gestureZones = false;
  let target = false;
  let final = false;
  let settings2 = [];
  let buddies = [];
  let buddiesValues = [];
  let ignore = false;


  // Closest polyfill
  // ================

  /**
   * Element.closest() polyfill
   * https://developer.mozilla.org/en-US/docs/Web/API/Element/closest#Polyfill
   */
  if (!Element.prototype.closest) {
    if (!Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
    }
    Element.prototype.closest = function (s) {
      var el = this;
      var ancestor = this;
      if (!document.documentElement.contains(el)) return null;
      do {
        if (ancestor.matches(s)) return ancestor;
        ancestor = ancestor.parentElement;
      } while (ancestor !== null);
      return null;
    };
  }


  // Emit event
  // ==========

  function emitEvent(type, settings, details) {
    if (typeof window.CustomEvent !== 'function') return;
    var event = new CustomEvent(type, {
      bubbles: true,
      detail: details
    });
    document.dispatchEvent(event);
  }


  // Extend
  // ======

  function extend() {

    // Variables
    var extended = {};
    var deep = false;
    var i = 0;

    // Check if a deep merge
    if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
      deep = arguments[0];
      i++;
    }

    // Merge the object into the extended object
    var merge = function (obj) {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          // If property is an object, merge properties
          if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
            extended[prop] = extend(extended[prop], obj[prop]);
          } else {
            extended[prop] = obj[prop];
          }
        }
      }
    };

    // Loop through each object and conduct a merge
    for (; i < arguments.length; i++) {
      var obj = arguments[i];
      merge(obj);
    }

    return extended;

  }


  // See if number is between two values
  // ===================================

  Number.prototype.between = function (a, b, inclusive) {
    let min = Math.min(a, b);
    let max = Math.max(a, b);
    return inclusive ? this >= min && this <= max : this > min && this < max;
  };


  // Get matrix values
  // =================

  function getMatrixValues(element, type) {
    const style = window.getComputedStyle(element);
    const matrix = style['transform'] || style.webkitTransform || style.mozTransform;

    // No transform property set
    if (matrix === 'none' && type === 'translate') {
      return {
        x: 0,
        y: 0
      }
    } else if (matrix === 'none' && type === 'scale') {
      return {
        x: 1,
        y: 1
      }
    }

    const matrixValues = matrix.match(/matrix.*\((.+)\)/)[1].split(', ');

    // Set proper values
    if (type === 'translate') {
      return {
        x: matrixValues[4],
        y: matrixValues[5]
      }
    } else if (type === 'scale') {
      return {
        x: matrixValues[0],
        y: matrixValues[3]
      }
    }
  }


  // Get CSS values
  // ==============

  function getCSSValue(element, type, float, fallback) {
    let style = window.getComputedStyle(element);
    if (float) {
      style = parseFloat(style[type]) || fallback;
    } else {
      style = style[type] || fallback;
    }
    return style;
  }


  // Get difference
  // ==============

  function getDifference(a, b) {
    return Math.abs(a - b)
  }


  // Get calculations
  // ================

  function getCalculations(from, to, difference, dimension) {
    let values = {};
    // @TODO: add to object when 2 (or 3) dimensional?
    if (dimension === 2) {
      values = {
        "from": from,
        "to": to,
        "dir": (from.x < to.x) ? 'up' : 'down',
        "points": (getDifference(from.x, to.x) / difference),
        "ydir": (from.y < to.y) ? 'up' : 'down',
        "ypoints": (getDifference(from.y, to.y) / difference),
      }
    } else {
      values = {
        "from": from,
        "to": to,
        "dir": (from < to) ? 'up' : 'down',
        "points": (getDifference(from, to) / difference),
      }
    }
    return values;
  }


  // Get transition values
  // =====================
  // @TODO: don't ask to each value separate but run an array of elements instead? | Also for calculatevalues and setstyling

  function getTransitionValues(element, calculator, settings) {

    // Get initial values
    const calculateFrom = getMatrixValues(calculator, "translate");
    const translateFrom = getMatrixValues(element, "translate");
    const scaleFrom = getMatrixValues(element, "scale");
    const opacityFrom = getCSSValue(element, 'opacity', false, 1);
    const widthFrom = getCSSValue(element, 'width', true, false);

    // Get calculator value
    calculator.style.transition = 'none';
    calculator.classList.toggle(settings.openClass);
    const calculateTo = getMatrixValues(calculator, "translate");
    calculator.classList.toggle(settings.openClass);

    // Get target values
    element.style.transition = 'none';
    element.classList.toggle(settings.openClass);
    let target = {
      "translateTo": getMatrixValues(element, "translate"),
      "scaleTo": getMatrixValues(element, "scale"),
      "opacityTo": getCSSValue(element, 'opacity', false, 1),
      "widthTo": getCSSValue(element, 'width', true, false),
    };
    element.classList.toggle(settings.openClass);

    // X or Y
    const axis = (parseInt(calculateFrom.x, 10) !== parseInt(calculateTo.x, 10)) ? 'x' : 'y';
    const from = (axis === 'x') ? calculateFrom.x : calculateFrom.y;
    const to = (axis === 'x') ? calculateTo.x : calculateTo.y;
    const difference = getDifference(from, to);

    return {
      "element": element,
      "axis": axis,
      "translate": getCalculations(translateFrom, target.translateTo, difference, 2),
      "scale": getCalculations(scaleFrom, target.scaleTo, difference, 2),
      "opacity": getCalculations(opacityFrom, target.opacityTo, difference, 1),
      "width": getCalculations(widthFrom, target.widthTo, difference, 1),
    };
  }


  // Get target
  // ==========

  function getTarget(element, settings) {
    const isController = element.getAttribute('data-touch-controls') || false;
    let isCloser = element.getAttribute('data-touch-closes') || false;

    if (isCloser) {
      let controllerList = [];
      isCloser = isCloser.split(',');
      isCloser.forEach(function (controller) {
        controller = document.querySelector('[data-touch-id="' + controller + '"]');
        if (controller.classList.contains(settings.openClass)) {
          controllerList.push(controller);
        }
      });
      if (controllerList.length === 1) {
        target = controllerList[0];
      } else {
        element.click(); // @TODO: Use toggle instead?
        target = false;
      }
    } else {
      target = isController ? document.querySelector('[data-touch-id="' + isController + '"]') : element;
    }

    return target;
  }


  // Get values
  // ==========

  function getValues(target, settings) {
    const transitionValues = getTransitionValues(target, target, settings);
    return {
      "transitionValues": transitionValues,
      "translate": getMatrixValues(target, "translate") || 0,
      "axis": transitionValues.axis,
      "min": parseInt(transitionValues.axis === 'x' ? transitionValues.translate.from.x : transitionValues.translate.from.y),
      "max": parseInt(transitionValues.axis === 'x' ? transitionValues.translate.to.x : transitionValues.translate.to.y),
    };
  }


  // Get buddies
  // ===========

  function getBuddies(target, element) {
    // Get target buddies list
    let buddylist = target.getAttribute('data-touch-buddies') || false;

    // Get controllers list
    const hasControllers = document.querySelectorAll('[data-touch-controls="' + target.getAttribute('data-touch-id') + '"]');

    // Push to buddies
    if (target !== element) {
      buddies.push(element);
    }

    if (hasControllers) {
      hasControllers.forEach(function (controller) {
        buddies.push(controller);
      });
    }

    // When target has buddies
    if (buddylist) {
      buddylist = buddylist.split(',');
      buddylist.forEach(function (buddy) {
        buddy = document.querySelector('[data-touch-id="' + buddy + '"]');
        if (buddy) {
          buddies.push(buddy);
        }
      });
    }

    return buddies;
  }


  // Calculate live values
  // =====================

  function calculateValues(movedX, movedY, transitionValues) {
    // @TODO: Make this a better function
    const dir = (settings2.axis === 'x') ? movedX : movedY;
    return {
      "translateX": ((transitionValues.translate.dir === 'down') ? parseFloat(transitionValues.translate.from.x) - (dir * transitionValues.translate.points) : parseFloat(transitionValues.translate.from.x) + (dir * transitionValues.translate.points)),
      "translateY": ((transitionValues.translate.ydir === 'down') ? parseFloat(transitionValues.translate.from.y) - (dir * transitionValues.translate.ypoints) : parseFloat(transitionValues.translate.from.y) + (dir * transitionValues.translate.ypoints)),
      "scaleX": ((transitionValues.scale.dir === 'down') ? parseFloat(transitionValues.scale.from.x) - (dir * transitionValues.scale.points) : parseFloat(transitionValues.scale.from.x) + (dir * transitionValues.scale.points)),
      "scaleY": ((transitionValues.scale.ydir === 'down') ? parseFloat(transitionValues.scale.from.y) - (dir * transitionValues.scale.ypoints) : parseFloat(transitionValues.scale.from.y) + (dir * transitionValues.scale.ypoints)),
      "opacity": ((transitionValues.opacity.dir === 'down') ? transitionValues.opacity.from - (dir * transitionValues.opacity.points) : transitionValues.opacity.from + (dir * transitionValues.opacity.points)),
      "width": ((transitionValues.width.dir === 'down') ? transitionValues.width.from - (dir * transitionValues.width.points) : transitionValues.width.from + (dir * transitionValues.width.points))
    }
  }


  // Property styling
  // ================

  function propertyStyling(element, property, value) {
    element.style.width = values.width + 'px';
  }


  // Set styling
  // ===========

  function setStyling(element, values, xval, yval) {
    let x = xval ? xval : values.translateX;
    let y = yval ? yval : values.translateY;
    element.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + values.scaleX + ',' + values.scaleY + ')';
    element.style.opacity = values.opacity;
    element.style.width = values.width + 'px';
    // @TODO: use property styling?
  }


  // Transitions following the touch
  // ===============================

  function transitionWithGesture(element, translatedX, translatedY, touchmoveX, touchmoveY, isBetween) {
    let x = translatedX || 0;
    let y = translatedY || 0;
    let movedX = Math.abs(touchmoveX - touchstartX);
    let movedY = Math.abs(touchmoveY - touchstartY);
    let transitionValues = calculateValues(movedX, movedY, settings2.transitionValues);

    // Only style if we're inbetween
    if (isBetween) {
      // The target itself
      setStyling(element, transitionValues, x, y);

      // It's buddies
      if (buddies) {
        buddies.forEach(function (buddy, i) {
          let count = (buddy.className.match(/openedby:/g) || []).length;
          if (count === 0 || (count === 1 && buddy.classList.contains('openedby:' + element.getAttribute('data-touch-id')))) {
            setStyling(buddy, calculateValues(movedX, movedY, buddiesValues[i]));
          }
        });
      }
    }
    // @TODO: testing with elastic
    // else {
    //   let diff = getDifference(y, settings2.max);
    //   console.log(diff);
    //   if (diff < 25) {
    //     let elasticX = x ? x + diff / 2 : x;
    //     let elasticY = y ? y + diff / 2 : y;
    //     setStyling(element, transitionValues, elasticX, elasticY);
    //   }
    // }

    final = calculateValues(touchmoveX - touchstartX, touchmoveY - touchstartY, settings2.transitionValues)
  }


  // Reset values
  // ============
  // @TODO: work with global variables?

  function resetValues() {
    touchmoved = false;
    target = false;
    final = false;
    settings2 = [];
    buddies = [];
    buddiesValues = [];
  }


  // Reset styling
  // =============

  function resetStyle(target) {
    target.removeAttribute('style');
    if (buddies) {
      buddies.forEach(function (buddy) {
        buddy.removeAttribute('style');
      });
    }
  }


  // Handle finished gesture
  // =======================

  function handleGesture(event, target, settings) {
    const diff = (settings2.axis === 'x') ? getDifference(touchendX, touchstartX) : getDifference(touchendY, touchstartY);
    const moveFrom = (settings2.axis === 'x') ? settings2.transitionValues.translate.from.x : settings2.transitionValues.translate.from.y;
    const movedTo = (settings2.axis === 'x') ? final.translateX : final.translateY;

    if (diff > settings.threshold && movedTo > moveFrom) {
      toggle(target, settings);
    } else {
      resetStyle(target);
    }

    // Emit dragged event
    emitEvent('bipDragged', settings);

    // Reset body styling
    document.body.removeAttribute('style');
  }


  // Toggle
  // ==============

  function toggle(target, settings) {
    resetStyle(target);
    target.classList.toggle(settings.openClass);
    // @TODO: set buddies some place else
    if (buddies) {
      buddies.forEach(function (buddy) {
        if (target.classList.contains(settings.openClass)) {
          buddy.classList.add(settings.openClass, 'openedby:' + target.getAttribute('data-touch-id'));
        } else {
          buddy.classList.remove('openedby:' + target.getAttribute('data-touch-id'));
          let count = (buddy.className.match(/openedby:/g) || []).length;
          if (count === 0) {
            buddy.classList.remove(settings.openClass);
          }
        }
      });
    }

    // Emit toggle event
    emitEvent('bipToggle', settings);
  }


  /**
   * Constructor
   */

  return function (selector, options) {

    // Unique Variables
    const publicAPIs = {};
    let settings;


    // Touch start
    // ===========

    function touchstartHandler(event) {

      // Return false for wrong elements
      if (!event.target.closest(gestureZones)) return false;
      ignore = !!event.target.closest('[data-touch-ignore]');
      if (ignore) return false;

      // Reset for new touchstart event
      resetValues();

      // Movement variables
      touchstartX = event.changedTouches[0].screenX;
      touchstartY = event.changedTouches[0].screenY;
      touchmoved = 0;
      const eventTarget = event.target.closest(gestureZones);

      // Set target
      // ==========
      target = getTarget(eventTarget, settings);

      if (target) {
        settings2 = getValues(target, settings);
        buddies = getBuddies(target, eventTarget) || false;
      }

      emitEvent('bipDrag', settings);

      // Disable styling
      document.body.style.overflow = 'hidden';
    }


    // Touch move
    // ==========

    function touchmoveHandler(event) {

      // Return false for wrong elements
      if (!event.target.closest(gestureZones)) return false;
      if (ignore) return false;
      if (!target) return false;

      // Variables
      let touchmoveX = event.changedTouches[0].screenX;
      let touchmoveY = event.changedTouches[0].screenY;
      let translatedX = (settings2.axis === 'x') ? touchmoveX - (touchstartX - settings2.translate.x) : false;
      let translatedY = (settings2.axis === 'y') ? touchmoveY - (touchstartY - settings2.translate.y) : false;
      const isBetween = (settings2.axis === 'x') ? translatedX.between(settings2.min, settings2.max, true) : translatedY.between(settings2.min, settings2.max, true);

      if (buddies && touchmoved === 0) {
        buddies.forEach(function (buddy) {
          buddiesValues.push(getTransitionValues(buddy, target, settings));
        });
        touchmoved = 1;
      }


      transitionWithGesture(target, translatedX, translatedY, touchmoveX, touchmoveY, isBetween);
    }


    // Touch end
    // =========

    function touchendHandler(event) {

      // Return false for wrong elements
      if (!event.target.closest(gestureZones)) return false;
      if (ignore) return false;
      if (!target) return false;

      // Variables
      touchendX = event.changedTouches[0].screenX;
      touchendY = event.changedTouches[0].screenY;

      // Handle the gesture
      handleGesture(event, target, settings);
    }


    // Click listener
    // ==============

    function clickHandler(event) {

      // Return for wrong elements
      if (!event.target.closest(settings.controls) && !event.target.closest(settings.closes)) return false;

      // Reset for new click event
      resetValues();

      // Variables
      const controlTarget = event.target.closest(settings.controls);
      const closeTarget = event.target.closest(settings.closes);
      let targets = [];

      if (closeTarget) {
        let toClose = closeTarget.getAttribute(['data-touch-closes']);
        toClose = toClose.split(',');
        toClose.forEach(function (el) {
          el = document.querySelector('[data-touch-id="' + el + '"]');
          if (el.classList.contains(settings.openClass)) {
            targets.push(getTarget(el, settings));
          }
        });
      } else {
        targets.push(getTarget(controlTarget, settings));
      }

      targets.forEach(function (target) {
        buddies = getBuddies(target, target);
        toggle(target, settings);
      });
    }


    /**
     * Toggle
     */

    publicAPIs.toggle = function (target) {
      toggle(target, settings);
    };


    /**
     * Init
     */

    publicAPIs.init = function (options) {

      // feature test
      if (!supports) return;

      // Merge options into defaults
      settings = extend(defaults, options || {});

      // Set gesture zones
      gestureZones = settings.selector + ',' + settings.controls + ',' + settings.closes;

      // Event listeners
      window.addEventListener('click', clickHandler, true);
      window.addEventListener('touchstart', touchstartHandler, true);
      window.addEventListener('touchmove', touchmoveHandler, true);
      window.addEventListener('touchend', touchendHandler, true);

    };

    // Initialize the plugin
    publicAPIs.init(options);

    // Return the public APIs
    return publicAPIs;

  };

});
