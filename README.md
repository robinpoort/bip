# Bip
Swipe support for CSS transitions. Just write your CSS transitions, add a toggle button, optional transition buddies and initiate Bip. That’s it!

## Features
- Just write CSS transitions. No animating in JS needed.
- Values are calculated on start drag, so no miscalculation bugs on window resize.
- Add optional buddies to an element that transition with it.
- All elements move based on their delays en durations. So buddies can start and stop later depending on it’s delay and duration settings.
- Very customizable.
- Loads of events.

## Demo
[https://robinpoort.github.io/bip/](https://robinpoort.github.io/bip/)

## Acknowledgements
- Calculations are based on linear transitions, so swiping and clicking might look slightly different when using longer transition times combined with a non-linear bezier.
- CssValues should be single values, shorthand CSS is not supported.
- Translate is only calculated correctlty when being set before rotate or skew.
- Using rotate and skew together doesn't currently work due to how browsers and Bip calculate the transform matrix.

## Options

### buddies
Data attribute name for buddies (default: data-touch-buddies)

### controllers
Data attribute name for controller(s) (default: data-touch-controllers)

### ignore
Data attribute name for ignore elements (default: data-touch-ignore)

### calculator
The property that is being used to calculate 'from' and 'to' of target element (default: 'translate')

### threshold
The "percentage" that the drag has to be at least occured before toggling the element. If not met, the element will reset itself on release. (default: 0.2)

### difference
The amount of pixels that need to differ between the last state and current state to set the direction. For example; swiping down and releasing while accidentally swiping 4 pixels up because of releasing will still keep the direction set to "down". (default: 10)
  
### maxEndDuration
The amount of milliseconds the final transition (when releasing) may take. (default: 500)
  
### openClass
Class name for elements when open. (default: 'is-open')

### touchmoveClass: 
Class name for target element while dragging/swiping. (default: 'is-touchmove')

### transitioningClass
Class name for target element when transitioning (on release). (default: 'is-transitioning')

### matrixValues
Default matrix values to check. (default: ['translate', 'scale', 'rotate', 'skew'])

### cssValues
Default CSS properties to check for. (default: ['opacity'])

### yAxis
Elements where the axis is always 'y'. (default: ['top', 'bottom', 'height', 'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom'])

### clickDrag
Enables clickdrag on none touch devices. (default: true)

### emitEvents
Wether to emit events or not. (default: true)

## APIs
...

## Events
...
