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

  let supports = 'querySelector' in document && 'addEventListener' in window;


  // Default variables
  // =================
  let defaults = {

    buddies: 'data-touch-buddies',
    controllers: 'data-touch-controllers',
    id: 'data-touch-id',
    ignore: 'data-touch-ignore',
    calculator: 'translate',

    threshold: 0.2,
    difference: 10,
    openClass: 'is-open',
    transitioningClass: 'is-transitioning',
    touchmoveClass: 'is-touchmove',

    matrixValues: ['translate', 'scale', 'rotate', 'skew'],
    cssValues: ['opacity'],
    yAxis: ['top', 'bottom', 'height', 'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom'],

    clickDrag: true,
    emitEvents: true
  };

  let touchstart = false;
  let touchstartX = 0;
  let touchstartY = 0;
  let touchendX = 0;
  let touchendY = 0;
  let lastDifference = false;
  let moveDirection = 'forward';
  let target = false;
  let targetValues = [];
  let buddies = [];
  let buddiesValues = [];
  let ignore = false;


  // Reset values
  // ============

  function resetValues() {
    touchstart = false;
    lastDifference = false;
    moveDirection = 'forward';
    target = false;
    targetValues = [];
    buddies = [];
    buddiesValues = [];
  }


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
      let el = this;
      let ancestor = this;
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
    if (!settings.emitEvents || typeof window.CustomEvent !== 'function') return;
    let event = new CustomEvent(type, {
      bubbles: true,
      detail: details
    });
    document.dispatchEvent(event);
  }


  // Extend
  // ======

  function extend() {

    // Variables
    let extended = {};
    let deep = false;
    let i = 0;

    // Check if a deep merge
    if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
      deep = arguments[0];
      i++;
    }

    // Merge the object into the extended object
    let merge = function (obj) {
      for (let prop in obj) {
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
      let obj = arguments[i];
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

    // Get values
    const style = window.getComputedStyle(element);
    const matrix = style['transform'] || style.webkitTransform || style.mozTransform;

    // Return false if no matrix is found
    if (matrix === 'none') return false;

    // Prepare object
    let value = {};

    // Thanks: https://stackoverflow.com/questions/5107134/find-the-rotation-and-skew-of-a-matrix-transformation
    let calculateMatrixValues = function(a) {
      let angle = Math.atan2(a[1], a[0]),
          denom = Math.pow(a[0], 2) + Math.pow(a[1], 2),
          scaleX = Math.sqrt(denom),
          scaleY = (a[0] * a[3] - a[2] * a[1]) / scaleX || 1,
          skewX = Math.atan2(a[0] * a[2] + a[1] * a[3], denom);
      return {
        angle: angle / (Math.PI / 180),
        scaleX: scaleX,
        scaleY: scaleY,
        skewX: skewX / (Math.PI / 180),
        skewY: 0,
        translateX: a[4],
        translateY: a[5]
      };
    };

    // Get separate matrix values
    const matrixValues = calculateMatrixValues(matrix.match(/matrix.*\((.+)\)/)[1].split(', '));

    // Return values
    if (type === 'translate') {
      value.value = {
        x: matrixValues.translateX,
        y: matrixValues.translateY,
        unit: 'px'
      }
    } else if (type === 'scale') {
      value.value = {
        x: matrixValues.scaleX,
        y: matrixValues.scaleY,
        unit: ''
      }
    } else if (type === 'rotate') {
      value.value = {
        x: matrixValues.angle,
        unit: 'deg'
      }
    } else if (type === 'skew') {
      value.value = {
        x: matrixValues.skewX,
        y: matrixValues.skewY,
        unit: 'deg'
      }
    }

    // Get and set delay and duration
    element.removeAttribute('style');
    value.delay = getTransitionValue('transitionDelay', style, 'transform');
    value.duration = getTransitionValue('transitionDuration', style, 'transform');
    element.style.transition = 'none';

    // Return
    return value;
  }


  // Get CSS values
  // ==============

  function getCSSValue(element, type) {
    let style = window.getComputedStyle(element);
    let styles = [];
    styles.value = parseFloat(style[type]);
    styles.unit = style[type].replace(/\d+|[.]/g, '');
    element.removeAttribute('style');
    styles.delay = getTransitionValue('transitionDelay', style, type);
    styles.duration = getTransitionValue('transitionDuration', style, type);
    element.style.transition = 'none';
    return styles;
  }


  // Get transition value
  // ====================

  function getTransitionValue(prop, style, type) {
    let transition = style.transition;
    let transitionValues = style[prop].split(', ');
    let value = 0;
    transition.split(', ').forEach(function(el, i) {
      if (el.includes(type)) {
        value = parseFloat(transitionValues[i]) * 1000;
      }
    });
    return value;
  }


  // Get difference
  // ==============

  function getDifference(a, b) {
    return Math.abs(a - b)
  }


  // Is equivalent
  // =============

  function isEquivalent(a, b) {
    // Create arrays of property names
    let aProps = Object.getOwnPropertyNames(a);
    let bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length !== bProps.length) {
      return false;
    }

    for (let i = 0; i < aProps.length; i++) {
      let propName = aProps[i];

      // If values of same property are not equal,
      // objects are not equivalent
      if (a[propName] !== b[propName]) {
        return false;
      }
    }

    // If we made it this far, objects
    // are considered equivalent
    return true;
  }


  // Get calculations
  // ================

  function getCalculations(from, to, dimension) {
    // Set values
    let values = {
      "from": from.value || '',
      "to": to.value || '',
      "unit": to.unit || '',
      "dir": (from.value < to.value) ? 'up' : 'down',
      "difference": getDifference(from.value, to.value) || 0,
      "delay": to.delay !== 0 ? to.delay : from.delay,
      "duration": to.duration !== 0 ? to.duration : from.duration
    };
    if (dimension === 2 && to !== false) {
      values.unit = to.value.unit;
      values.dir = (from.value.x < to.value.x) ? 'up' : 'down';
      values.difference = getDifference(from.value.x, to.value.x) || 0;
      values.ydir = (from.value.y < to.value.y) ? 'up' : 'down';
      values.ydifference = getDifference(from.value.y, to.value.y) || 0;
    }
    return values;
  }


  // Get transition values
  // =====================

  function getTransitionValues(element, settings) {

    // Variables
    let fromValues = {};
    let toValues = {};
    let returnValues = {
      "element": element
    };

    // Get initial values
    settings.matrixValues.forEach(function(prop) { fromValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { fromValues[prop] = (getCSSValue(element, prop)) });

    // No transition styling
    element.style.transition = 'none';

    // Get target values
    element.classList.toggle(settings.openClass);
    settings.matrixValues.forEach(function(prop) { toValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { toValues[prop] = (getCSSValue(element, prop)) });
    element.classList.toggle(settings.openClass);

    // Add properties and values to the object
    settings.matrixValues.forEach(function(el) {
        const elCalculations = getCalculations(fromValues[el], toValues[el], 2);
        if (elCalculations) {
          returnValues[el] = elCalculations
        }
    });
    settings.cssValues.forEach(function(el) {
      if (!isEquivalent(fromValues[el], toValues[el])) {
        const elCalculations = getCalculations(fromValues[el], toValues[el], 1)
        if (elCalculations) {
          returnValues[el] = elCalculations
        }
      }
    });

    return returnValues;
  }


  // Get target
  // ==========

  function getTarget(isControl, isSelector, settings) {

    // When target is a selector
    if (isSelector) {
      target = isSelector;
    }

    // When target is a controller
    if (isControl) {
      let count = (isControl.controls.className.match(/openedby:/g) || []);
      if (count.length === 1) {
        target = isControl.target;
      } else {
        target = false;
      }
    }

    // Get buddies for target
    if (target) {
      buddies = getBuddies(target, settings) || false;
    }

    // When multiple targets are found, close all applicable targets
    if (!target) {
      isControl.controls.classList.forEach(function(cls) {
        if (cls.match(/openedby:/g)) {
          const el = document.querySelector('[' + settings.id + '="'+cls.split(':')[1]+'"]');
          buddies = [];
          toggle(el, settings, false);
        }
      })
    }

    return target;
  }


  // Get buddies
  // ===========

  function getBuddies(target, settings) {

    // Get target buddies list
    let buddylist = document.querySelectorAll(target.getAttribute(settings.buddies)) || false;
    let controlslist = document.querySelectorAll(target.getAttribute(settings.controllers)) || false;

    // Push the target itself as a buddy
    buddies.push(target);

    // When target has buddies
    if (buddylist.length) {
      buddylist.forEach(function (buddy) {
        buddies.push(buddy);
      });
    }

    // Add controls as buddies
    if (controlslist.length) {
      controlslist.forEach(function (buddy) {
        buddies.push(buddy);
      });
    }

    return buddies;
  }


  // Get essentials
  // ==============

  function getEssentials(transitionValues, settings) {
    let values = {
      "axis": "x",
      "from": transitionValues[settings.calculator].from,
      "to": transitionValues[settings.calculator].to
    };
    if (settings.yAxis.includes(settings.calculator)) {
      values.axis = 'y';
    }
    if (settings.calculator === 'translate') {
      const xDiff = getDifference(transitionValues[settings.calculator].from.x, transitionValues[settings.calculator].to.x);
      const yDiff = getDifference(transitionValues[settings.calculator].from.y, transitionValues[settings.calculator].to.y)
      values.axis = xDiff > yDiff ? 'x' : 'y';
      values.from = values.axis === 'x' ? transitionValues[settings.calculator].from.x : transitionValues[settings.calculator].from.y
      values.to = values.axis === 'x' ? transitionValues[settings.calculator].to.x : transitionValues[settings.calculator].to.y
    }
    return values
  }


  // Get values
  // ==========

  function getValues(target, settings) {
    const transitionValues = getTransitionValues(target, settings);
    const axis = getEssentials(transitionValues, settings).axis;
    const from = getEssentials(transitionValues, settings).from;
    const to = getEssentials(transitionValues, settings).to;
    return {
      "axis": axis,
      "from": from,
      "to": to,
      "difference": getDifference(from, to),
      "delay": transitionValues[settings.calculator].delay,
      "duration": transitionValues[settings.calculator].duration,
      "totalDuration": transitionValues[settings.calculator].delay + transitionValues[settings.calculator].duration
    };
  }


  // Get closest
  // ===========

  function getClosest(from, to, translated) {
    let closest = [from, to].reduce(function(prev, curr) {
      return (Math.abs(curr - translated) < Math.abs(prev - translated) ? curr : prev);
    });
    return closest === from ? 'from' : 'to'
  }


  // Calculate multiplier
  // ====================

  function calculateMultiplier(value) {
    let totalDuration = targetValues.totalDuration;
    let factor = (targetValues.axis === 'x' ? (targetValues.movedX / (targetValues.difference / 100)) : (targetValues.movedY / (targetValues.difference / 100))) / 100;
    let delay = parseInt(value.delay === 0 ? targetValues.delay : value.delay);
    let duration = parseInt(value.duration === 0 ? targetValues.duration : value.duration);
    let delayFactor = delay/totalDuration;
    let durationFactor = duration/totalDuration;
    let x = (factor-delayFactor)*((totalDuration/(duration*durationFactor))*durationFactor);
    let xRound = Math.max(0, Math.min(1, x));
    return {
      "value": x,
      "x": xRound,
      "delay": delay,
      "duration": duration,
      "toggleDuration": totalDuration * (1 - xRound),
      "toggleDelay": (((totalDuration - delay) / totalDuration) * x) * -1000,
      "resetDuration": totalDuration - (totalDuration * (1 - xRound)),
      "resetDelay": -Math.abs(delay) * x,
    };
  }


  // Get remaining delay or duration
  // ===============================

  function getRemaining(multiplierRoot, properties, type) {
    let value = 0;
    if (type === 'delay') {
      value = Math.max(0, Math.min(properties === 'toggle' ? multiplierRoot.toggleDelay : multiplierRoot.resetDelay, multiplierRoot.delay))
    }
    if (type === 'duration') {
      value = Math.max(0, Math.min(properties === 'toggle' ? multiplierRoot.toggleDuration : multiplierRoot.resetDuration, multiplierRoot.duration))
    }
    return value;
  }


  // Set styling
  // ===========

  function setStyling(element, buddyValues, settings, properties) {
    let transforms = [];
    let transitionProperties = [];
    let transitionDelays = [];
    let transitionDurations = [];
    let multiplierRoot = [];
    let multiplier = 1;

    // Loop through matrix values
    settings.matrixValues.forEach(function(prop) {
      if (buddyValues[prop] !== undefined) {
        multiplierRoot = calculateMultiplier(buddyValues[prop]);
        multiplier = multiplierRoot.x;
        if (multiplier) {
          let x = (parseFloat(buddyValues[prop].from.x) < parseFloat(buddyValues[prop].to.x)) ? parseFloat(buddyValues[prop].from.x) + (buddyValues[prop].difference * multiplier) : parseFloat(buddyValues[prop].from.x) - (buddyValues[prop].difference * multiplier);
          let y = (parseFloat(buddyValues[prop].from.y) < parseFloat(buddyValues[prop].to.y)) ? parseFloat(buddyValues[prop].from.y) + (buddyValues[prop].ydifference * multiplier) : parseFloat(buddyValues[prop].from.y) - (buddyValues[prop].ydifference * multiplier) || false;
          buddyValues[prop].multiplier = multiplier;
          buddyValues[prop].value = multiplierRoot.value
          transforms.push(prop + '(' + x + buddyValues[prop].unit + (y ? ',' + y + buddyValues[prop].unit + ')' : ')'));
          if (element === target && prop === settings.calculator) {
            targetValues.finalMove = {"x": x, "y": y};
            targetValues.finalMultiplier = multiplier;
          }
        }
      }
    });


    // Set transforms
    if (properties === 'all') {
      transforms = transforms.join(' ');
      element.style.transform = transforms;
    }

    // Set transition properties
    else {
      transitionProperties.push("transform");
      transitionDelays.push(getRemaining(multiplierRoot, properties, 'delay') + 'ms');
      transitionDurations.push(getRemaining(multiplierRoot, properties, 'duration') + 'ms');
      if (element === target && settings.calculator === 'translate') {
        targetValues.finalDuration = getRemaining(multiplierRoot, properties, 'duration') || targetValues.totalDuration;
      }
    }

    // Loop through CSS values
    settings.cssValues.forEach(function(prop) {
      if (prop !== undefined) {
        let buddyValue = buddyValues[prop];
        if (buddyValue !== undefined) {
          multiplierRoot = calculateMultiplier(buddyValue);
          multiplier = multiplierRoot.x;
          buddyValue.multiplier = multiplier;
          buddyValue.vaue = multiplierRoot.value;
          if (properties === 'all') {
            if (buddyValue.from < buddyValue.to) {
              element.style[prop] = buddyValue.from + buddyValue.difference * multiplier + buddyValue.unit;
            } else {
              element.style[prop] = buddyValue.from - buddyValue.difference * multiplier + buddyValue.unit;
            }
          } else {
            transitionProperties.push(prop);
            transitionDelays.push(getRemaining(multiplierRoot, properties, 'delay') + 'ms');
            transitionDurations.push(getRemaining(multiplierRoot, properties, 'duration') + 'ms');
            if (element === target && settings.calculator === prop) {
              targetValues.finalDuration = getRemaining(multiplierRoot, properties, 'duration') || targetValues.totalDuration;
            }
          }
        }
      }
    });

    // Set transition properties
    if (properties !== 'all') {
      element.style.transitionProperty = transitionProperties;
      element.style.transitionDelay = transitionDelays;
      element.style.transitionDuration = transitionDurations;
      element.ontransitionend = function(event) {
        if (event.target === element) {
          element.removeAttribute('style');
        }
      }
    }
  }


  // Transitions following the touch
  // ===============================

  function transitionWithGesture(element, touchmoveX, touchmoveY, settings) {
    let movedX = Math.abs(touchmoveX - touchstartX);
    let movedY = Math.abs(touchmoveY - touchstartY);


    // Add movedX and movedY to targetValues
    targetValues.movedX = movedX;
    targetValues.movedY = movedY;

    buddies.forEach(function (buddy, i) {
      let count = (buddy.className.match(/openedby:/g) || []).length;
      if (count === 0 || (count === 1 && buddy.classList.contains('openedby:' + element.getAttribute(settings.id)))) {
        setStyling(buddy, buddiesValues[i], settings, 'all');
      }
    });
  }


  // Toggle
  // ======

  function toggle(target, settings, setStyle) {

    // Get buddies if non are defined
    if (buddies.length === 0) {
      buddies = getBuddies(target, settings);
    }

    // Reset target (and buddies)
    resetStyle(target, settings, setStyle);
    target.classList.toggle(settings.openClass);

    // Handle buddies
    if (buddies.length > 0) {
      buddies.forEach(function(buddy, i) {
        if (target.classList.contains(settings.openClass)) {
          buddy.classList.add(settings.openClass, 'openedby:' + target.getAttribute(settings.id));
        } else {
          buddy.classList.remove('openedby:' + target.getAttribute(settings.id));
          let count = (buddy.className.match(/openedby:/g) || []).length;
          if (count === 0) {
            buddy.classList.remove(settings.openClass);
          }
        }
        if (setStyle) {
          setStyling(buddy, buddiesValues[i], settings, 'toggle');
        }
      });
    }

    // Set aria for controller
    document.querySelectorAll(target.getAttribute(settings.controllers)).forEach(function(control) {
      setAria(control, settings);
    });

    // Emit toggle event
    emitEvent('bipToggle', settings, {
      settings: settings,
      targetValues: targetValues,
      buddiesValues: buddiesValues
    })
  }


  // Reset styling
  // =============

  function resetStyle(target, settings, setStyle) {
    target.removeAttribute('style');
    if (buddies) {
      buddies.forEach(function (buddy, i) {
        buddy.removeAttribute('style');
        if (setStyle) {
          setStyling(buddy, buddiesValues[i], settings, 'reset');
        }
      });
    }
  }


  // Handle finished gesture
  // =======================

  function handleGesture(event, target, moveDirection, settings) {

    // Variables
    const diff = (targetValues.axis === 'x') ? getDifference(touchendX, touchstartX) : getDifference(touchendY, touchstartY);
    const threshold = targetValues.difference * settings.threshold;

    // Add the transitioning class
    target.classList.add(settings.transitioningClass);

    // Either toggle or reset
    if ((diff > threshold && moveDirection === 'forward') || diff === 0) {
      toggle(target, settings, true);
    } else {
      resetStyle(target, settings, true);
    }

    // Remove touchmove class from target
    target.classList.remove(settings.touchmoveClass);

    // Remove transitioning class when totalDuration is over
    setTimeout(function() {
      target.classList.remove(settings.transitioningClass);
      touchstart = false;
    }, targetValues.finalDuration * 0.95); // Shorten it a bit because of ease-out it may look like it's done already

    // Emit dragged event
    emitEvent('bipDragged', settings, {
      settings: settings,
      targetValues: targetValues,
      buddiesValues: buddiesValues
    })
  }


  // Set aria attributes to buttons
  // ==============================

  function setAria(button, settings) {
    if (button.tagName === 'BUTTON') {
      if (button.classList.contains(settings.openClass)) {
        button.setAttribute('aria-expanded', 'true');
      } else {
        button.setAttribute('aria-expanded', 'false');
      }
    }
  }


  /**
   * Constructor
   */

  return function (selector, options) {

    // Unique Variables
    const publicAPIs = {};
    let selectors = [];
    let settings;


    // Start handler
    // =============

    function startHandler(event) {

      // Targets
      let isControl = false;
      let isSelector = event.target.closest(selector) || false;

      // See if element is a "close" target
      selectors.forEach(function(el, i) {
        if (event.target.closest(el.controls) && event.target.closest(el.controls).classList.contains('openedby:' + selector.replace(/\W/g, '') + i)) {
          isControl = {
            "controls": event.target.closest(el.controls),
            "target": el.target
          };
        }
      });

      // Return false if applicable
      if (!isControl && !isSelector) return false;

      // Return false if target or closest is an ignore target
      ignore = !!event.target.closest('[' + settings.ignore + ']');
      if (ignore) return false;

      // Reset values for new touchstart event
      resetValues();

      // Movement variables
      touchstartX = event.screenX || event.changedTouches[0].screenX;
      touchstartY = event.screenY || event.changedTouches[0].screenY;

      // Set target
      // ==========
      target = getTarget(isControl, isSelector, settings);

      // Return false if applicable
      if (!target) return false;
      if (target.classList.contains(settings.transitioningClass)) return false;

      // Get target values
      targetValues = getValues(target, settings);

      // Get buddies and values
      buddies.forEach(function (buddy) {
        buddiesValues.push(getTransitionValues(buddy, settings));
      });

      // Disable styling and disable user-select
      document.body.classList.add('bip-busy');
      target.classList.add(settings.touchmoveClass);

      // Set touchstart to true
      touchstart = true;

      // Emit event
      emitEvent('bipDrag', settings, {
        settings: settings,
        targetValues: targetValues,
        buddiesValues: buddiesValues
      })

    }


    // Move handler
    // ============

    function moveHandler(event) {

      // Return false if applicable
      if (!touchstart) return false;
      if (!target) return false;
      if (ignore) return false;
      if (target.classList.contains(settings.transitioningClass)) return false;

      // Variables
      let touchmoveX = event.screenX || (event.changedTouches ? event.changedTouches[0].screenX : false);
      let touchmoveY = event.screenY || (event.changedTouches ? event.changedTouches[0].screenY : false);
      let translatedX = (targetValues.axis === 'x') ? touchmoveX - (touchstartX - targetValues.from) : false;
      let translatedY = (targetValues.axis === 'y') ? touchmoveY - (touchstartY - targetValues.from) : false;
      let translated = (targetValues.axis === 'x') ? translatedX : translatedY;
      let difference = (targetValues.axis === 'x') ? getDifference(touchstartX, touchmoveX) : getDifference(touchstartY, touchmoveY);
      let closest = getClosest(targetValues.from, targetValues.to, translated);
      let isBetween = (targetValues.axis === 'x') ? translatedX.between(targetValues.from, targetValues.to, true) : translatedY.between(targetValues.from, targetValues.to, true);

      // Set last difference
      if ((getDifference(difference, lastDifference) > settings.difference) || lastDifference === false) {
        lastDifference = difference
      }

      // Set move direction
      if (isBetween && difference > lastDifference) {
        moveDirection = 'forward';
      } else if (isBetween && difference < lastDifference) {
        moveDirection = 'backward';
      }

      // Transition
      if (!isBetween && closest === 'from') {
        targetValues.axis === 'x' ? touchmoveX = touchstartX : touchmoveY = touchstartY;
      }

      transitionWithGesture(target, touchmoveX, touchmoveY, settings);
    }


    // End handler
    // ===========

    function endHandler(event) {

      // remove the bip busy class so user can select again
      document.body.classList.remove('bip-busy');

      // Return false if applicable
      if (!touchstart) return false;
      if (!target) return false;
      if (ignore) return false;
      if (target.classList.contains(settings.transitioningClass)) return false;

      // Variables
      touchendX = event.screenX || event.changedTouches[0].screenX;
      touchendY = event.screenY || event.changedTouches[0].screenY;

      // Handle touch gesture
      handleGesture(event, target, moveDirection, settings);
    }

    /**
     * Toggle
     */

    publicAPIs.toggle = function (target) {
      toggle(target, settings, true);
    };


    /**
     * Init
     */

    publicAPIs.init = function (options) {

      // feature test
      if (!supports) return;

      // Merge options into defaults
      settings = extend(defaults, options || {});

      // Grab all selectors
      document.querySelectorAll(selector).forEach(function(el,i) {
        el.setAttribute(settings.id, selector.replace(/\W/g, '') + i);
        selectors[i] = {
          "target": el,
          "controls": el.getAttribute(settings.controllers)
        };

        // Set default aria for each controller
        document.querySelectorAll(el.getAttribute(settings.controllers)).forEach(function(control) {
          setAria(control, settings);
        });
      });

      // Make sure no text will be selected while dragging
      const style = document.createElement('style');
      style.innerHTML = '.bip-busy * { user-select:none; pointer-events: none; }';
      const ref = document.querySelector('script');
      ref.parentNode.insertBefore(style, ref);

      // Event listeners
      if ('ontouchstart' in document.documentElement) {
        document.addEventListener('touchstart', startHandler, true);
        document.addEventListener('touchmove', moveHandler, true);
        document.addEventListener('touchend', endHandler, true);
      } else {
        document.addEventListener('mousedown', startHandler, true);
        if (settings.clickDrag) { document.addEventListener('mousemove', moveHandler, true); }
        document.addEventListener('mouseup', endHandler, true);
      }

      // Emit event
      emitEvent('bipInit', settings, {
        settings: settings
      })

    };

    // Initialize the plugin
    publicAPIs.init(options);

    // Return the public APIs
    return publicAPIs;

  };

});
