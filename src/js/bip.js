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
    ignore: 'data-touch-ignore',
    noswipe: 'data-touch-noswipe',
    noclick: 'data-touch-noclick',
    scrollable: 'data-touch-scrollable',
    accordion: 'data-touch-accordion',
    id: 'data-touch-id',
    controls: 'data-touch-controls',
    
    calculator: 'translate',
    threshold: 0.2,
    difference: 10,
    minEndDuration: 100,
    maxEndDuration: 500,
    
    openClass: 'is-open',
    touchmoveClass: 'is-touchmove',
    transitioningClass: 'is-transitioning',
    hasTouchmoveClass: 'has-touchmove',
    hasOpenClass: 'has-open-bip',
    
    matrixValues: ['translate', 'scale', 'rotate', 'skew'],
    cssValues: ['opacity'],
    yAxis: ['top', 'bottom', 'height', 'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom'],
    
    clickDrag: true,
    swipeOnly: false,
    clickOnly: false,
    closeOnly: false,
    
    emitEvents: true
  };
  
  let touchstart = false;
  let touchstartX = 0;
  let touchstartY = 0;
  let touchendX = 0;
  let touchendY = 0;
  let lastDifference = 0;
  let moveDirection = 'forward';
  let eventTarget = false;
  let targetValues = [];
  let buddies = [];
  let ignore = false;
  let noswipe = false;
  let noclick = false;
  let bipValues = {};


  // Reset values
  // ============
  
  function resetValues() {
    lastDifference = 0;
    moveDirection = 'forward';
    buddies = [];
    targetValues = [];
  }
  
  
  // forEach polyfill
  // ================
  
  if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
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
  
  function emitEvent(type, settings, target, details) {
    if (!settings.emitEvents || typeof window.CustomEvent !== 'function') return;
    let event = new CustomEvent(type, {
      bubbles: true,
      detail: details
    });
    target.dispatchEvent(event);
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
  
  
  // Debounce
  // ========
  
  const debounce = (callback, wait) => {
    let timeoutId = null;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback.apply(null, args);
      }, wait);
    };
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
    return styles;
  }
  
  
  // Get transition value
  // ====================
  
  function getTransitionValue(prop, style, type) {
    let transition = style.transition;
    let transitionValues = style[prop].split(', ');
    let value = 0;
    transition.split(', ').forEach(function(el, i) {
      if (el.indexOf(type) !== -1) {
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
  
  
  // Get calculations
  // ================
  
  function getCalculations(from, to, dimension) {
    if (!from || !to) return false;
    // Set values
    let values = {
      'from': from.value || '',
      'to': to.value || '',
      'unit': to.unit || '',
      'dir': (from.value < to.value) ? 'up' : 'down',
      'difference': getDifference(from.value, to.value) || 0,
      'delay': to.delay !== 0 ? to.delay : from.delay,
      'duration': to.duration !== 0 ? to.duration : from.duration
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
  
  function getTransitionValues(element, target, settings, type) {
    
    // Variables
    let fromValues = {};
    let toValues = {};
    let returnValues = {
      'element': element
    };
    
    // Get initial values
    settings.matrixValues.forEach(function(prop) { fromValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { fromValues[prop] = (getCSSValue(element, prop)) });
    
    // Emit event
    if (type === 'getValues') {
      emitEvent('calculateFrom', settings, target, {
        settings: settings,
        target: target,
        fromValues: fromValues
      });
    }
    
    // Get target values
    element.style.transition = 'none';
    element.classList.toggle(settings.openClass);
    settings.matrixValues.forEach(function(prop) { toValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { toValues[prop] = (getCSSValue(element, prop)) });
    
    // Emit event
    if (type === 'getValues') {
      emitEvent('calculateTo', settings, target, {
        settings: settings,
        target: target,
        fromValues: fromValues,
        toValues: toValues
      });
    }
    
    // Toggle class back
    element.classList.toggle(settings.openClass);
    
    // No transition for movable elements
    element.style.transition = 'none';
    
    // Add properties and values to the object
    settings.matrixValues.forEach(function(el) {
      const elCalculations = getCalculations(fromValues[el], toValues[el], 2);
      if (elCalculations) {
        returnValues[el] = elCalculations
      }
    });
    settings.cssValues.forEach(function(el) {
      if (fromValues[el].value !== toValues[el].value) {
        const elCalculations = getCalculations(fromValues[el], toValues[el], 1);
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
    
    // Controls
    let controls = [];
    let target;
    
    // When target is a controller
    if (isControl) {
      
      // Get controls amount
      isControl.forEach(function(ctrl) {
        if (ctrl.target.classList.contains(settings.openClass)) {
          controls.push(ctrl);
        }
      })
      
      // Set target
      if (controls.length === 1) {
        target = controls[0].target;
      } else if (isControl.length === 1) {
        target = isControl[0].target;
      } else {
        target = false
      }
    }
    
    // When target is a selector
    if (isSelector) {
      target = isSelector;
    }
    
    // When multiple targets are found, close all applicable targets
    if (!target) {
      controls.forEach(function(ctrl) {
        if (ctrl.target.classList.contains(settings.openClass)) {
          buddies = [];
          toggle(ctrl.target, settings, true, false);
        }
      })
    }
    
    return target;
  }
  
  
  // Get buddies
  // ===========
  
  function getBuddies(target, settings) {
    
    // Reset buddies
    buddies = [];
    
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
      'axis': 'x',
      'from': transitionValues[settings.calculator].from,
      'to': transitionValues[settings.calculator].to
    };
    if (settings.yAxis.indexOf(settings.calculator) !== -1) {
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
  
  function getValues(target, transitionValues, settings) {
    
    // Return false if calculator styling is not found
    if (!transitionValues[settings.calculator]) return false;
    
    // Return values
    const axis = getEssentials(transitionValues, settings).axis;
    const from = getEssentials(transitionValues, settings).from;
    const to = getEssentials(transitionValues, settings).to;
    return {
      'axis': axis,
      'from': from,
      'to': to,
      'difference': getDifference(from, to),
      'delay': transitionValues[settings.calculator].delay,
      'duration': transitionValues[settings.calculator].duration,
      'totalDuration': transitionValues[settings.calculator].delay + transitionValues[settings.calculator].duration
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
    let factor = (targetValues.axis === 'x' ? ((targetValues.movedX || 0) / (targetValues.difference / 100)) : ((targetValues.movedY || 0) / (targetValues.difference / 100))) / 100;
    let delay = parseInt(value.delay === 0 ? targetValues.delay : value.delay);
    let duration = parseInt(value.duration === 0 ? targetValues.duration : value.duration);
    let delayFactor = delay/totalDuration;
    let durationFactor = duration/totalDuration;
    let x = (factor-delayFactor)*((totalDuration/(duration*durationFactor))*durationFactor);
    let xRound = Math.max(0, Math.min(1, x));
    return {
      'value': x,
      'x': xRound,
      'delay': delay,
      'duration': duration,
      'toggleDuration': totalDuration * (1 - xRound),
      'toggleDelay': (((totalDuration - delay) / totalDuration) * x) * -1000,
      'resetDuration': totalDuration - (totalDuration * (1 - xRound)),
      'resetDelay': -Math.abs(delay) * x,
    };
  }
  
  
  // Get remaining delay or duration
  // ===============================
  
  function getRemaining(multiplierRoot, properties, type, click, settings) {
    let value = 0;
    if (type === 'delay') {
      value = Math.max(0, Math.min(properties !== 'all' && moveDirection === 'forward' ? multiplierRoot.toggleDelay : multiplierRoot.resetDelay, multiplierRoot.delay))
    }
    if (type === 'duration') {
      value = Math.max(0, Math.min(properties !== 'all' && moveDirection === 'forward' ? multiplierRoot.toggleDuration : multiplierRoot.resetDuration, multiplierRoot.duration))
    }
    // When minEndDuration is set
    if (type === 'duration' && settings.minEndDuration && settings.minEndDuration < settings.maxEndDuration && settings.minEndDuration > value && !click) {
      value = settings.minEndDuration;
    }
    // When maxEndDuration is set
    else if (type === 'duration' && settings.maxEndDuration && settings.maxEndDuration < targetValues.totalDuration && !click) {
      value = value * (settings.maxEndDuration / targetValues.totalDuration);
    }
    return value;
  }
  
  
  // Set styling
  // ===========
  
  function setStyling(element, values, target, settings, click, properties) {
    let transforms = [];
    let transitionProperties = [];
    let transitionDelays = [];
    let transitionDurations = [];
    let multiplierRoot = [];
    let multiplier = 1;
  
    // Set transition properties
    // -------------------------

    function setTransitionProperties(prop, type, multiplierRoot) {
      if (multiplierRoot.length === 0) return false;
      transitionProperties.push(prop);
      transitionDelays.push(getRemaining(multiplierRoot, properties, 'delay', click, settings) + 'ms');
      transitionDurations.push(getRemaining(multiplierRoot, properties, 'duration', click, settings) + 'ms');
      if (element === target && settings.calculator === type) {
        targetValues.finalDuration = getRemaining(multiplierRoot, properties, 'duration', click, settings);
        if (isNaN(targetValues.finalDuration)) {
          targetValues.finalDuration = targetValues.totalDuration
        }
      }
    }

    // Loop through matrix values
    settings.matrixValues.forEach(function (prop) {
      if (values[prop] !== undefined) {
        multiplierRoot = calculateMultiplier(values[prop]);
        multiplier = multiplierRoot.x;
        if (multiplier) {
          let x = (parseFloat(values[prop].from.x) < parseFloat(values[prop].to.x)) ? parseFloat(values[prop].from.x) + (values[prop].difference * multiplier) : parseFloat(values[prop].from.x) - (values[prop].difference * multiplier);
          let y = (parseFloat(values[prop].from.y) < parseFloat(values[prop].to.y)) ? parseFloat(values[prop].from.y) + (values[prop].ydifference * multiplier) : parseFloat(values[prop].from.y) - (values[prop].ydifference * multiplier);
          values[prop].multiplier = multiplier;
          values[prop].value = multiplierRoot.value
          transforms.push(prop + '(' + x + values[prop].unit + (y ? ',' + y + values[prop].unit + ')' : ')'));
          if (element === target && prop === settings.calculator) {
            targetValues.finalMove = {'x': x, 'y': y};
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
      setTransitionProperties('transform', 'translate', multiplierRoot);
    }

    // Loop through CSS values
    settings.cssValues.forEach(function (prop) {
      if (prop !== undefined) {
        let buddyValue = values[prop];
        if (buddyValue !== undefined) {
          multiplierRoot = calculateMultiplier(buddyValue);
          multiplier = multiplierRoot.x;
          buddyValue.multiplier = multiplier;
          buddyValue.value = multiplierRoot.value;
          if (properties === 'all') {
            if (buddyValue.from < buddyValue.to) {
              element.style[prop] = buddyValue.from + buddyValue.difference * multiplier + buddyValue.unit;
            } else {
              element.style[prop] = buddyValue.from - buddyValue.difference * multiplier + buddyValue.unit;
            }
          } else {
            setTransitionProperties(prop, prop, multiplierRoot);
          }
        }
      }
    });

    // Set transition properties
    if (properties !== 'all') {
      element.style.transitionProperty = transitionProperties;
      element.style.transitionDelay = transitionDelays;
      element.style.transitionDuration = transitionDurations;
      element.ontransitionend = function () {
        element.removeAttribute('style');
      }
    }
  }
  
  
  // Transitions following gesture
  // =============================
  
  function transitionWithGesture(element, touchmoveX, touchmoveY, settings) {
    
    // Calculate movedX and movedY
    let movedX = Math.abs(touchmoveX - touchstartX) || 0;
    let movedY = Math.abs(touchmoveY - touchstartY) || 0;
    
    // Add movedX and movedY to targetValues
    targetValues.movedX = movedX;
    targetValues.movedY = movedY;
    
    // Handle buddies
    buddies.forEach(function (buddy) {
      let count = (buddy.element.className.match(/openedby:/g) || []).length;
      if (count === 0 || (count === 1 && buddy.element.classList.contains('openedby:' + element.getAttribute(settings.id)))) {
        setStyling(buddy.element, buddy, element, settings, false, 'all');
      }
    });
  }
  
  
  // Recalculate BipValues
  // =====================
  
  function recalculateValues(target, settings) {
    const bipValuesId = bipValues[target.getAttribute(settings.id)].id;
    buddies = [];
    buddies = getBuddies(target, settings) || false;
    buddies.forEach(function(buddy, i) {
      buddies[i] = (getTransitionValues(buddy, target, settings, 'buddyValues'));
    });
    // Save values
    const transitionValues = getTransitionValues(target, target, settings, 'getValues');
    bipValues[bipValuesId].values = getValues(target, transitionValues, settings);
    bipValues[bipValuesId].buddies = buddies;
  }
  
  
  // Toggle
  // ======
  
  function toggle(target, settings, click, setStyle) {
    
    // Get open or close type
    const type = target.classList.contains(settings.openClass) ? 'close' : 'open';
    
    // Get targetValues
    targetValues = bipValues[target.getAttribute(settings.id)].values;
    buddies = bipValues[target.getAttribute(settings.id)].buddies;
    
    // Reset target and buddies
    resetStyle(target, settings, click, setStyle);
    target.classList.toggle(settings.openClass);
    
    // Handle buddies
    if (buddies.length > 0) {
      buddies.forEach(function(buddy) {
        if (target.classList.contains(settings.openClass)) {
          buddy.element.classList.add(settings.openClass, 'openedby:' + target.getAttribute(settings.id));
        } else {
          buddy.element.classList.remove('openedby:' + target.getAttribute(settings.id));
          let count = (buddy.element.className.match(/openedby:/g) || []).length;
          if (count === 0) {
            buddy.element.classList.remove(settings.openClass);
          }
        }
      });
    }
    
    // Set aria for controller
    document.querySelectorAll(target.getAttribute(settings.controllers)).forEach(function(control) {
      setAria(control, settings);
    });
    
    // Remove body class
    if (type === 'close') {
      document.body.classList.remove(settings.hasOpenClass);
    }
    
    // Recalculate values after toggle
    setTimeout(() => {
      recalculateValues(target, settings);
    }, bipValues[target.getAttribute(settings.id)].values.duration)
    
    // Emit event
    emitEvent('toggle', settings, target, {
      settings: settings,
      target: target,
      targetValues: targetValues,
      buddies: buddies
    });
  }
  
  
  // Reset styling
  // =============
  
  function resetStyle(target, settings, click, setStyle) {
    target.removeAttribute('style');
    if (buddies) {
      buddies.forEach(function (buddy) {
        buddy.element.removeAttribute('style');
        if (setStyle) {
          setStyling(buddy.element, buddy, target, settings, click, 'reset');
        }
      });
    }
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
  
  
  // Remove class by prefix
  // ======================
  
  function removeClassByPrefix(el, prefix) {
    var regex = new RegExp('\\b' + prefix + '[^ ]*[ ]?\\b', 'g');
    el.className = el.className.replace(regex, '');
    return el;
  }
  
  
  /**
   * Constructor
   */
  
  return function(selector, options) {
    
    // Unique Variables
    const publicAPIs = {};
    let selectors = [];
    let settings;
    let target = false;
    let hasActive = false;
    let isMoving = 0;
    
  
    // Handle finished gesture
    // =======================
    
    function handleGesture(target, moveDirection, settings, isPublic) {
      
      // Variables
      let click = ((touchstartX === touchendX && touchstartY === touchendY));
      let go = true;
      
      // Return false if element is noswipe element and user didn't click
      if (noswipe && !click) return false;
      
      // Get targetValues
      targetValues = bipValues[target.getAttribute(settings.id)].values;
      
      // Variables
      const diff = (targetValues.axis === 'x') ? getDifference(touchendX, touchstartX) : getDifference(touchendY, touchstartY);
      const threshold = targetValues.difference * settings.threshold;
      
      // Add / remove classes
      target.classList.add(settings.transitioningClass);
      target.classList.remove(settings.touchmoveClass);
      if (!click) { document.body.classList.remove(settings.hasTouchmoveClass); }
      
      // Set "go" variable depending on settings
      if (click && settings.swipeOnly) { go = false; }
      if (!click && settings.clickOnly) { go = false; }
      if (click && noclick) { go = false; }
      if (noswipe && ((touchstartX !== touchendX || touchstartY !== touchendY))) { go = false; }
      
      // See if eventTarget is a controller
      let isController = false;
      if (eventTarget && eventTarget.closest(target.getAttribute(settings.controllers))) {
        isController = true;
      }
      
      // Either toggle or reset
      if (go && (isPublic || isController || ((touchstartX !== touchendX || touchstartY !== touchendY)))) {
        if ((diff > threshold && moveDirection === 'forward') || diff === 0) {
          toggle(target, settings, click, true);
        } else {
          resetStyle(target, settings, click, true);
        }
      }
      
      // Close current open one if accordion is true
      if (target.hasAttribute(settings.accordion) && (hasActive && hasActive !== target && hasActive.hasAttribute(settings.accordion))) {
        buddies = [];
        toggle(hasActive, settings, true, true);
      }
  
      // Remove transitioning class when finalDuration is over
      setTimeout(function() {
        target.classList.remove(settings.transitioningClass);
        hasActive = false;
        
        // Remove open class from the body
        if (document.querySelectorAll('[class*="openedby:"]').length === 0) {
          document.body.classList.remove(settings.hasOpenClass);
        }
  
        // RecalculateValues
        recalculateValues(target, settings);
        
        // Emit event
        emitEvent('finish', settings, target, {
          settings: settings,
          target: target,
          targetValues: targetValues,
          buddies: buddies
        });
      }, targetValues.finalDuration);
    }
    
    
    // Start handler
    // =============
    
    function startHandler(event) {
      
      // Set eventTarget
      eventTarget = event.target;
      isMoving = 0;
      
      // Targets
      let isControl = [];
      let isSelector = eventTarget.closest(selector) || false;
      
      // Selectors
      selectors.forEach(function(el) {
        
        // See if we already have an open element
        if (el.target.classList.contains(settings.openClass)) {
          hasActive = el.target;
        }
        
        // See if element is a "close" target
        if (eventTarget.closest(el.controls)) {
          isControl.push(el);
        }
      });
      
      // See if element is an ignore, noswipe or noclick element
      ignore = !!eventTarget.closest('[' + settings.ignore + ']') || false;
      noswipe = !!eventTarget.closest('[' + settings.noswipe + ']') || false;
      noclick = !!eventTarget.closest('[' + settings.noclick + ']') || false;
      
      // Return false if ignore
      if (ignore) return false;
      
      // Set target
      if (eventTarget.closest('['+settings.controls+']')) {
        let controlTarget = eventTarget.closest('['+settings.controls+']').getAttribute(settings.controls);
        target = getTarget(false, document.querySelector('['+settings.id+'="'+controlTarget+'"]'), settings);
      } else {
        target = getTarget(isControl, isSelector, settings);
      }
      
      // Return false if applicable
      if (!target) return false;
      if (target.classList.contains(settings.transitioningClass)) return false;
      
      // Reset values for new touchstart event
      resetValues();
      
      // Movement variables
      touchstartX = event.screenX || event.changedTouches[0].screenX;
      touchstartY = event.screenY || event.changedTouches[0].screenY;
      touchstart = true;
      
      // Get target, buddies and values
      targetValues = bipValues[target.getAttribute(settings.id)].values;
      buddies = bipValues[target.getAttribute(settings.id)].buddies;
      
      // Add open class to the body
      document.body.classList.add(settings.hasOpenClass);
      
      // Emit event
      emitEvent('start', settings, target, {
        settings: settings,
        target: target
      });
    }
    
    
    // Move handler
    // ============
    
    function moveHandler(event) {
      
      // Return false if applicable
      if (!touchstart) return false;
      if (!target) return false;
      if (ignore) return false;
      if (target.classList.contains(settings.transitioningClass)) return false;
      if (noswipe) return false;
      
      // Return false if closeOnly is set
      if (settings.closeOnly && !target.classList.contains(settings.openClass)) return false;
      
      // Get current move positions
      let touchmoveX = event.screenX || (event.changedTouches ? event.changedTouches[0].screenX : false);
      let touchmoveY = event.screenY || (event.changedTouches ? event.changedTouches[0].screenY : false);
      
      // Return false if not moved
      if (touchstartX === touchmoveX || touchstartY === touchmoveY) return false;
      
      // Prevent default behavior
      event.preventDefault();
      
      // Variables
      let translatedX = (targetValues.axis === 'x') ? touchmoveX - (touchstartX - targetValues.from) : false;
      let translatedY = (targetValues.axis === 'y') ? touchmoveY - (touchstartY - targetValues.from) : false;
      let translated = (targetValues.axis === 'x') ? translatedX : translatedY;
      let difference = (targetValues.axis === 'x') ? getDifference(touchstartX, touchmoveX) : getDifference(touchstartY, touchmoveY);
      let closest = getClosest(targetValues.from, targetValues.to, translated);
      let isBetween = (targetValues.axis === 'x') ? translatedX.between(targetValues.from, targetValues.to, true) : translatedY.between(targetValues.from, targetValues.to, true);
      
      // Check if move is approved and set isMoving variable
      const scrollables = target.querySelectorAll('['+settings.scrollable+']');
      if (isMoving === 0) {
        if (targetValues.axis === 'x') {
          if (difference > 1) {
            if ((Math.abs(touchmoveX - touchstartX) < Math.abs(touchmoveY - touchstartY)) && !document.body.classList.contains(settings.hasTouchmoveClass)) { isMoving = -1; }
            else { isMoving = 1}
          }
          if (scrollables.length > 0 && target.classList.contains(settings.openClass)) {
            scrollables.forEach(function(scrollable) {
              if (eventTarget.closest('['+settings.scrollable+']') === scrollable && scrollable.scrollWidth > scrollable.clientWidth) {
                isMoving = -1;
              }
            })
          }
        }
        
        if (targetValues.axis === 'y') {
          if (difference > 1) {
            if ((Math.abs(touchmoveX - touchstartX) > Math.abs(touchmoveY - touchstartY)) && !document.body.classList.contains(settings.hasTouchmoveClass)) { isMoving = -1; }
            else { isMoving = 1}
          }
          if (scrollables.length > 0 && target.classList.contains(settings.openClass)) {
            scrollables.forEach(function(scrollable) {
              if (eventTarget.closest('['+settings.scrollable+']') === scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
                isMoving = -1;
              }
            })
          }
        }
      }
      
      // Only run when move direction equals target direction
      if (isMoving === 1) {
        
        // Disable styling and disable user-select
        if (!settings.clickOnly && !document.body.classList.contains('bip-busy')) {
          document.body.classList.add('bip-busy');
        }
        
        // Set touchmove class
        if (!target.classList.contains(settings.touchmoveClass)) {
          target.classList.add(settings.touchmoveClass);
        }
        
        // Add has-touchmove class to body
        if (!document.body.classList.contains(settings.hasTouchmoveClass) && event.type === 'touchmove') {
          document.body.classList.add(settings.hasTouchmoveClass);
        }
        
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
          moveDirection = 'backward';
        } else if (!isBetween && closest === 'to') {
          moveDirection = 'forward';
        }
        
        // Swipe if applicable
        if (!noswipe && difference > 1) {
          transitionWithGesture(target, touchmoveX, touchmoveY, settings);
        }
      }
    }
    
    
    // End handler
    // ===========
    
    function endHandler(event) {
      
      // Reset touchstart
      touchstart = false;
      
      // remove the bip busy class so user can select again
      document.body.classList.remove('bip-busy');
      
      // Return false if applicable
      if (!target) return false;
      if (ignore) return false;
      if (isMoving <= 0) return false;
      if (target.classList.contains(settings.transitioningClass)) return false;
      
      // Prevent default
      event.preventDefault();
      
      // Variables
      if (event.type === 'touchend') {
        touchendX = event.changedTouches[0].screenX;
        touchendY = event.changedTouches[0].screenY;
      } else {
        touchendX = event.screenX;
        touchendY = event.screenY;
      }
      
      // Emit event
      emitEvent('end', settings, target, {
        settings: settings,
        target: target,
        targetValues: targetValues,
        buddies: buddies
      });
      
      // Handle touch gesture
      handleGesture(target, moveDirection, settings, false);
    }
    
    
    // Click handler
    // =============
    
    function clickHandler(event) {
      
      // Return false if moved
      if (isMoving >= 1) return false;
      
      // Set eventTarget
      eventTarget = event.target;
      const isControl = eventTarget.closest('[data-touch-controls]');
      let doRun = false;
      
      // Return if no control
      if (!isControl) return false;
      
      // Get values
      target = document.querySelector('['+settings.id+'='+isControl.getAttribute('data-touch-controls')+']');
      targetValues = bipValues[target.getAttribute(settings.id)].values;
      buddies = bipValues[target.getAttribute(settings.id)].buddies;
      
      // Return
      document.querySelectorAll(selector).forEach((el) => {
        if (target === el) {
          doRun = true;
        }
      });
      
      if (!doRun) return false;
      
      // Toggle target
      toggle(target, settings, true, false);
      
      // Emit event
      emitEvent('clickToggle', settings, target, {
        settings: settings,
        target: target,
        targetValues: targetValues,
        buddies: buddies
      });
    }
  
  
    // Calculate on debounce
    // =====================
    
    const calculateOnDebounce = debounce((ev) => {
      document.querySelectorAll(selector).forEach(function(el) {
        recalculateValues(el, settings);
      });
    }, 500);
  
  
    // Observer
    // ========
  
    const observerCallback = (mutationList) => {
      for (const mutation of mutationList) {
        if (mutation.type === "childList") {
          recalculateValues(mutation.target.closest('['+settings.id+']'), settings);
        }
      }
    };
    const observer = new MutationObserver(observerCallback);
    
    
    /**
     * Toggle
     */
    
    publicAPIs.toggle = function(target) {
      resetValues();
      toggle(target, settings, true, false);
    };
    
    
    /**
     * Destroy
     */
    
    publicAPIs.destroy = function () {
      
      // Remove eventlisteners
      document.removeEventListener('touchstart', startHandler, false);
      if (!settings.clickOnly) { document.removeEventListener('touchmove', moveHandler, false); }
      document.removeEventListener('touchend', endHandler, false);
      document.removeEventListener('mousedown', startHandler, false);
      if (settings.clickDrag && !settings.clickOnly) {  document.removeEventListener('mousemove', moveHandler, false); }
      document.removeEventListener('mouseup', endHandler, false);
      document.removeEventListener('click', clickHandler, false);
      document.removeEventListener('resize', calculateOnDebounce);
      observer.disconnect();
      
      // Remove body classes
      document.body.classList.remove('bip-busy', settings.hasTouchmoveClass);
      
      // Cleanup elements
      function clean(element) {
        element.style.transition = 'none';
        element.classList.remove(settings.openClass, settings.touchmoveClass, settings.transitioningClass);
        element.removeAttribute('style');
        removeClassByPrefix(element, 'openedby');
      }
      
      // Remove styling from all selectors, controllers and buddies
      selectors.forEach(function(selector) {
        clean(selector.target);
        document.querySelectorAll(selector.controls).forEach(function(control) {
          clean(control);
          setAria(control, settings);
        });
        document.querySelectorAll(selector.buddies).forEach(function(buddy) {
          clean(buddy);
        });
      })
      
      // Reset settings
      settings = null;
    };
    
    
    /**
     * Init
     */
    
    publicAPIs.init = function(options) {
      
      // feature test
      if (!supports) return;
      
      // Merge options into defaults
      settings = extend(defaults, options || {});
      
      // Grab all selectors
      document.querySelectorAll(selector).forEach(function(el, i) {
        const selectorId = selector.replace(/\W/g, '') + i;
        el.setAttribute(settings.id, selectorId);
        selectors[i] = {
          'target': el,
          'controls': el.getAttribute(settings.controllers),
          'buddies': el.getAttribute(settings.buddies)
        };
        
        // Set initial values
        buddies = getBuddies(el, settings) || false;
        buddies.forEach(function(buddy, i) {
          buddies[i] = (getTransitionValues(buddy, el, settings, 'buddyValues'));
        });
        
        // Save values
        const transitionValues = getTransitionValues(el, el, settings, 'getValues')
        bipValues[selectorId] = {
          "id": selectorId,
          "values": getValues(el, transitionValues, settings),
          "buddies": buddies
        };
        
        // Set default aria for each controller
        document.querySelectorAll(el.getAttribute(settings.controllers)).forEach(function(control) {
          setAria(control, settings);
          control.setAttribute(settings.controls, selectorId);
        });
        
        // Observe changes
        observer.observe(el, {attributes: false, childList: true, subtree: true});
      });
      
      // Add event listeners
      document.addEventListener('touchstart', startHandler, {passive: false});
      if (!settings.clickOnly) { document.addEventListener('touchmove', moveHandler, {passive: false}); }
      document.addEventListener('touchend', endHandler, {passive: false});
      document.addEventListener('mousedown', startHandler, false);
      if (settings.clickDrag && !settings.clickOnly) { document.addEventListener('mousemove', moveHandler, false); }
      document.addEventListener('mouseup', endHandler, false);
      document.addEventListener('click', clickHandler, false);
      window.addEventListener('resize', calculateOnDebounce);
      
      // Emit event
      document.querySelectorAll(selector).forEach(function(el) {
        emitEvent('init', settings, el, {
          settings: settings,
          selectors: selectors
        });
      });
    }
    
    // Initialize the plugin
    publicAPIs.init(options);
    
    // Events
    publicAPIs.on = function (type, callback) {
      document.querySelectorAll(selector).forEach(function(el) {
        el.addEventListener(type, callback, false);
      });
    };
    
    // Return the public APIs
    return publicAPIs;
    
  };
  
});
