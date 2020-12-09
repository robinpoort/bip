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

    threshold: 0.2,
    openClass: 'is-open',

    matrixValues: ['translate', 'scale', 'rotate', 'skew'],
    cssValues: ['opacity'],

    emitEvents: true
  };

  let touchstartX = 0;
  let touchstartY = 0;
  let touchendX = 0;
  let touchendY = 0;
  let touchmoved = false;
  let lastDifference = false;
  let moveDirection = 'forward';
  let gestureZones = false;
  let target = false;
  let final = false;
  let targetValues = [];
  let buddies = [];
  let buddiesValues = [];
  let ignore = false;
  let manuallyClosed = false;


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
  // @TODO: Improve this function

  function getMatrixValues(element, type) {
    const style = window.getComputedStyle(element);
    const matrix = style['transform'] || style.webkitTransform || style.mozTransform;

    // No transform property set
    if (matrix === 'none' && (type === 'translate' || type === 'rotate' || type === 'skew')) {
      return {
        value: {
          x: 0,
          y: 0,
          delay: getTransitionValue('transitionDelay', style, 'transform'),
          duration: getTransitionValue('transitionDuration', style, 'transform')
        }
      }
    } else if (matrix === 'none' && type === 'scale') {
      return {
        value: {
          x: 1,
          y: 1,
          delay: getTransitionValue('transitionDelay', style, 'transform'),
          duration: getTransitionValue('transitionDuration', style, 'transform')
        }
      }
    }

    const matrixValues = matrix.match(/matrix.*\((.+)\)/)[1].split(', ');

    // Set proper values
    if (type === 'translate') {
      return {
        value: {
          x: matrixValues[4],
          y: matrixValues[5],
          delay: getTransitionValue('transitionDelay', style, 'transform'),
          duration: getTransitionValue('transitionDuration', style, 'transform')
        }
      }
    } else if (type === 'scale') {
      return {
        value: {
          x: matrixValues[0],
          y: matrixValues[3],
          delay: getTransitionValue('transitionDelay', style, 'transform'),
          duration: getTransitionValue('transitionDuration', style, 'transform')
        }
      }
    } else if (type === 'rotate') {
      return {
        value: {
          x: matrixValues[2],
          y: matrixValues[2],
          delay: getTransitionValue('transitionDelay', style, 'transform'),
          duration: getTransitionValue('transitionDuration', style, 'transform')
        }
      }
    } else if (type === 'skew') {
      return {
        value: {
          x: matrixValues[1],
          y: matrixValues[2],
          delay: getTransitionValue('transitionDelay', style, 'transform'),
          duration: getTransitionValue('transitionDuration', style, 'transform')
        }
      }
    }
  }


  // Get CSS values
  // ==============

  function getCSSValue(element, type) {
    let style = window.getComputedStyle(element);
    return {
      value: parseFloat(style[type]),
      delay: getTransitionValue('transitionDelay', style, type),
      duration: getTransitionValue('transitionDuration', style, type)
    };
  }


  // Get tansition value
  // ===================

  function getTransitionValue(prop, style, type) {
    let transition = style.transition;
    let transitionValues = style[prop].split(', ');
    let value = 0;
    transition.split(', ').forEach(function(el, i) {
      if (el.includes(type)) {
        value = transitionValues[i]
      }
    });

    return value;
  }


  // Get difference
  // ==============

  function getDifference(a, b) {
    return Math.abs(a - b)
  }


  // Get calculations
  // ================

  function getCalculations(from, to, difference, dimension) {
    let values = {
      "from": from,
      "to": to,
      "dir": (from < to) ? 'up' : 'down',
      "points": (getDifference(from, to) / difference),
    };
    if (dimension === 2) {
      values.dir = (from.x < to.x) ? 'up' : 'down';
      values.points = (getDifference(from.x, to.x) / difference);
      values.ydir = (from.y < to.y) ? 'up' : 'down';
      values.ypoints = (getDifference(from.y, to.y) / difference);
    }
    return values;
  }


  // Get transition values
  // =====================

  function getTransitionValues(element, calculator, settings) {

    // Get initial values
    const calculateFrom = getMatrixValues(calculator, "translate");
    let fromValues = {};
    settings.matrixValues.forEach(function(prop) { fromValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { fromValues[prop] = (getCSSValue(element, prop)) });

    // Get calculator value
    calculator.style.transition = 'none';
    calculator.classList.toggle(settings.openClass);
    const calculateTo = getMatrixValues(calculator, "translate");
    calculator.classList.toggle(settings.openClass);

    // Get target values
    element.style.transition = 'none';
    element.classList.toggle(settings.openClass);
    let toValues = {};
    settings.matrixValues.forEach(function(prop) { toValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { toValues[prop] = (getCSSValue(element, prop)) });
    element.classList.toggle(settings.openClass);

    // X or Y
    const axis = (parseInt(calculateFrom.value.x, 10) !== parseInt(calculateTo.value.x, 10)) ? 'x' : 'y';
    const from = (axis === 'x') ? calculateFrom.value.x : calculateFrom.value.y;
    const to = (axis === 'x') ? calculateTo.value.x : calculateTo.value.y;
    const difference = getDifference(from, to);

    // Set element and axis for object
    let returnValues = {
      "element": element,
      "axis": axis,
      "difference": difference
    };

    // Add properties and values to the object
    settings.matrixValues.forEach(function(el) { returnValues[el] = getCalculations(fromValues[el].value, toValues[el].value, difference, 2) });
    settings.cssValues.forEach(function(el) { returnValues[el] = getCalculations(fromValues[el].value, toValues[el].value, difference, 1) });

    return returnValues;

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
        target = false;
      }
    } else {
      target = isController ? document.querySelector('[data-touch-id="' + isController + '"]') : element;
    }

    if (target) {
      buddies = getBuddies(target, element) || false;
    } else {
      document.querySelectorAll('[data-touch]').forEach(function(el) {
        if (el.classList.contains(settings.openClass)) {
          toggle(el, settings);
        }
      });
      manuallyClosed = true;
    }

    return target;
  }


  // Get values
  // ==========

  function getValues(target, settings) {
    const transitionValues = getTransitionValues(target, target, settings);
    return {
      "transitionValues": transitionValues,
      "translate": getMatrixValues(target, "translate").value || 0,
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

  function calculateValues(movedX, movedY, transitionValues, settings) {
    const dir = (targetValues.axis === 'x') ? movedX : movedY;
    // Calculate matrix properties and values
    // @TODO: See if we can improve 2 dimensional elements
    let returnValues = {
      "translateX": ((transitionValues.translate.dir === 'down') ? parseFloat(transitionValues.translate.from.x) - (dir * transitionValues.translate.points) : parseFloat(transitionValues.translate.from.x) + (dir * transitionValues.translate.points)),
      "translateY": ((transitionValues.translate.ydir === 'down') ? parseFloat(transitionValues.translate.from.y) - (dir * transitionValues.translate.ypoints) : parseFloat(transitionValues.translate.from.y) + (dir * transitionValues.translate.ypoints)),
      "scaleX": ((transitionValues.scale.dir === 'down') ? parseFloat(transitionValues.scale.from.x) - (dir * transitionValues.scale.points) : parseFloat(transitionValues.scale.from.x) + (dir * transitionValues.scale.points)),
      "scaleY": ((transitionValues.scale.ydir === 'down') ? parseFloat(transitionValues.scale.from.y) - (dir * transitionValues.scale.ypoints) : parseFloat(transitionValues.scale.from.y) + (dir * transitionValues.scale.ypoints)),
      "skewX": ((transitionValues.skew.dir === 'down') ? parseFloat(transitionValues.skew.from.x) - (dir * transitionValues.skew.points) : parseFloat(transitionValues.skew.from.x) + (dir * transitionValues.skew.points)),
      "skewY": ((transitionValues.skew.ydir === 'down') ? parseFloat(transitionValues.skew.from.y) - (dir * transitionValues.skew.ypoints) : parseFloat(transitionValues.skew.from.y) + (dir * transitionValues.skew.ypoints)),
      "rotate": ((transitionValues.rotate.dir === 'down') ? parseFloat(transitionValues.rotate.from.x) - (dir * transitionValues.rotate.points) : parseFloat(transitionValues.rotate.from.x) + (dir * transitionValues.rotate.points)),
    };
    // Calculate CSS properties and values
    settings.cssValues.forEach(function(prop) {
      if (transitionValues[prop].points !== 0) {
        returnValues[prop] = ((transitionValues[prop].dir === 'down') ? transitionValues[prop].from - (dir * transitionValues[prop].points) : transitionValues[prop].from + (dir * transitionValues[prop].points));
      }
    });
    return returnValues;
  }


  // Set styling
  // ===========

  function setStyling(element, values, settings, xval, yval) {
    let x = xval ? xval : values.translateX;
    let y = yval ? yval : values.translateY;

    // Set Matrix values
    element.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + values.scaleX + ',' + values.scaleY + ') skew(' + values.skewX * 10 + 'deg,' + values.skewY * 10 + 'deg) rotate(' + values.rotate + 'deg)';

    // Set CSS properties and values
    settings.cssValues.forEach(function(prop) {
      if (values[prop] !== undefined) {
        element.style[prop] = prop !== 'opacity' ? values[prop] + 'px' : values[prop];
      }
    });
  }


  // Transitions following the touch
  // ===============================

  function transitionWithGesture(element, translatedX, translatedY, touchmoveX, touchmoveY, isBetween, settings) {
    let x = translatedX || 0;
    let y = translatedY || 0;
    let movedX = Math.abs(touchmoveX - touchstartX);
    let movedY = Math.abs(touchmoveY - touchstartY);
    let transitionValues = calculateValues(movedX, movedY, targetValues.transitionValues, settings);

    // Only style if we're inbetween
    if (isBetween) {
      // The target itself
      setStyling(element, transitionValues, settings, x, y);

      // It's buddies
      if (buddies) {
        buddies.forEach(function (buddy, i) {
          let count = (buddy.className.match(/openedby:/g) || []).length;
          if (count === 0 || (count === 1 && buddy.classList.contains('openedby:' + element.getAttribute('data-touch-id')))) {
            setStyling(buddy, calculateValues(movedX, movedY, buddiesValues[i], settings), settings);
          }
        });
      }
    }
    // @TODO: testing with elastic pull
    // else {
    //   let diff = getDifference(y, targetValues.max);
    //   console.log(diff);
    //   if (diff < 25) {
    //     let elasticX = x ? x + diff / 2 : x;
    //     let elasticY = y ? y + diff / 2 : y;
    //     setStyling(element, transitionValues, settings, elasticX, elasticY);
    //   }
    // }

    final = calculateValues(touchmoveX - touchstartX, touchmoveY - touchstartY, targetValues.transitionValues, settings, settings)
  }


  // Reset values
  // ============
  // @TODO: work with global variables?

  function resetValues() {
    touchmoved = false;
    lastDifference = false;
    moveDirection = 'forward';
    target = false;
    final = false;
    manuallyClosed = false;
    targetValues = [];
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

  function handleGesture(event, target, moveDirection, settings) {
    const diff = (targetValues.axis === 'x') ? getDifference(touchendX, touchstartX) : getDifference(touchendY, touchstartY);
    const moveFrom = (targetValues.axis === 'x') ? targetValues.transitionValues.translate.from.x : targetValues.transitionValues.translate.from.y;
    const movedTo = (targetValues.axis === 'x') ? final.translateX : final.translateY;
    const threshold = targetValues.transitionValues.difference * settings.threshold;

    if (diff > threshold && movedTo > moveFrom && moveDirection === 'forward') {
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
  // ======

  function toggle(target, settings) {

    // Get buddies if non are defined
    if (buddies.length === 0) {
      buddies = getBuddies(target, target);
    }

    // Reset target (and buddies)
    resetStyle(target);
    target.classList.toggle(settings.openClass);

    // Handle buddies
    if (buddies.length > 0) {
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

    // Get controller
    const controller = document.querySelector('[data-touch-controls="' + target.getAttribute('data-touch-id') + '"]');
    if (controller) {
      setAria(controller, settings);
    }

    // Emit toggle event
    emitEvent('bipToggle', settings);
  }


  // Set aria attributes to the button
  // =================================

  function setAria(button, settings) {
    if (button.classList.contains(settings.openClass)) {
      button.setAttribute('aria-expanded', 'true');
    } else {
      button.setAttribute('aria-expanded', 'false');
    }
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
        targetValues = getValues(target, settings);

        emitEvent('bipDrag', settings);

        // Disable styling
        document.body.style.overflow = 'hidden';
      }
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
      let translatedX = (targetValues.axis === 'x') ? touchmoveX - (touchstartX - targetValues.translate.x) : false;
      let translatedY = (targetValues.axis === 'y') ? touchmoveY - (touchstartY - targetValues.translate.y) : false;
      let difference = (targetValues.axis === 'x') ? getDifference(touchstartX, touchmoveX) : getDifference(touchstartY, touchmoveY);
      const isBetween = (targetValues.axis === 'x') ? translatedX.between(targetValues.min, targetValues.max, true) : translatedY.between(targetValues.min, targetValues.max, true);

      if (buddies && touchmoved === 0) {
        buddies.forEach(function (buddy) {
          buddiesValues.push(getTransitionValues(buddy, target, settings));
        });
        touchmoved = 1;
      }

      // Set last difference
      if ((getDifference(difference, lastDifference) > 10) || lastDifference === false) {
        lastDifference = difference
      }

      // Set move direction
      if (isBetween && difference > lastDifference) {
        moveDirection = 'forward';
      } else if (isBetween && difference < lastDifference) {
        moveDirection = 'backward';
      }

      // Transition
      transitionWithGesture(target, translatedX, translatedY, touchmoveX, touchmoveY, isBetween, settings);
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
      handleGesture(event, target, moveDirection, settings);
    }


    // Click listener
    // ==============

    function clickHandler(event) {

      if (manuallyClosed) {
        event.preventDefault();

        // Re-set manually closed for next event
        manuallyClosed = false;
      }

      // Return for wrong elements
      if (!event.target.closest(settings.controls) && !event.target.closest(settings.closes)) return false;

      // Reset for new click event
      resetValues();

      event.preventDefault();

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

      document.querySelectorAll(settings.controls).forEach(function(control) {
        setAria(control, settings);
      });

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
