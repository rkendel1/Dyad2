// Content script for Element Selector extension
// This script runs on all web pages and handles communication with the popup

(function() {
  'use strict';
  
  // Flag to track if we're currently in selection mode
  let isSelectionActive = false;
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_SELECTION') {
      startElementSelection();
      sendResponse({ success: true });
    }
    
    return true; // Keep message channel open for async response
  });
  
  function startElementSelection() {
    if (isSelectionActive) {
      return;
    }
    
    isSelectionActive = true;
    
    // Remove any existing selection UI
    cleanupSelectionUI();
    
    let highlightedElement = null;
    
    // Create overlay for visual feedback
    const overlay = document.createElement('div');
    overlay.id = 'element-selector-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      pointer-events: none;
      background: rgba(0, 0, 0, 0.1);
    `;
    document.body.appendChild(overlay);

    // Create highlight element
    const highlight = document.createElement('div');
    highlight.id = 'element-selector-highlight';
    highlight.style.cssText = `
      position: absolute;
      background: rgba(26, 115, 232, 0.3);
      border: 2px solid #1a73e8;
      pointer-events: none;
      z-index: 1000000;
      box-sizing: border-box;
      display: none;
    `;
    document.body.appendChild(highlight);

    // Create instructions tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'element-selector-tooltip';
    tooltip.textContent = 'Click on any element to select it. Press ESC to cancel.';
    tooltip.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #323232;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 1000001;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(tooltip);

    function generateUniqueSelector(element) {
      if (!element || element === document.body) return 'body';
      if (element === document.documentElement) return 'html';
      
      // Try ID first (most specific)
      if (element.id && document.querySelectorAll(`#${element.id}`).length === 1) {
        return `#${element.id}`;
      }
      
      // Build path from element to root
      const path = [];
      let current = element;
      
      while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();
        
        // Add classes if they help make selector unique
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter(c => c && !/\s/.test(c));
          if (classes.length > 0) {
            const classSelector = selector + '.' + classes.join('.');
            // Check if adding classes makes it more specific
            if (current.parentElement) {
              const withClasses = current.parentElement.querySelectorAll(classSelector);
              if (withClasses.length <= 3) { // Use classes if they significantly narrow down selection
                selector = classSelector;
              }
            }
          }
        }
        
        // Add nth-child if there are multiple siblings with same tag
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children).filter(
            sibling => sibling.tagName === current.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
          }
        }
        
        path.unshift(selector);
        current = current.parentElement;
      }
      
      // Build final selector and test for uniqueness
      let finalSelector = path.join(' > ');
      
      // If selector is too long or not unique, try shorter version
      if (path.length > 5 || document.querySelectorAll(finalSelector).length !== 1) {
        // Try last 3 elements in path
        const shortPath = path.slice(-3);
        const shortSelector = shortPath.join(' > ');
        if (document.querySelectorAll(shortSelector).length === 1) {
          finalSelector = shortSelector;
        }
      }
      
      return finalSelector;
    }

    function highlightElement(element) {
      if (!element) {
        highlight.style.display = 'none';
        return;
      }
      
      const rect = element.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      highlight.style.cssText = `
        position: absolute;
        left: ${rect.left + scrollX}px;
        top: ${rect.top + scrollY}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: rgba(26, 115, 232, 0.3);
        border: 2px solid #1a73e8;
        pointer-events: none;
        z-index: 1000000;
        box-sizing: border-box;
        display: block;
      `;
    }

    function handleMouseMove(event) {
      if (!isSelectionActive) return;
      
      event.preventDefault();
      const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
      
      if (elementUnderMouse && 
          elementUnderMouse !== overlay && 
          elementUnderMouse !== highlight && 
          elementUnderMouse !== tooltip &&
          !elementUnderMouse.id?.startsWith('element-selector-')) {
        highlightedElement = elementUnderMouse;
        highlightElement(elementUnderMouse);
      }
    }

    function handleClick(event) {
      if (!isSelectionActive) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      let selector = '';
      if (highlightedElement) {
        selector = generateUniqueSelector(highlightedElement);
      }
      
      cleanup();
      
      // Send the result back to the popup
      chrome.runtime.sendMessage({
        type: 'ELEMENT_SELECTED',
        selector: selector
      });
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        cleanup();
        chrome.runtime.sendMessage({
          type: 'ELEMENT_SELECTED',
          selector: null
        });
      }
    }

    function cleanup() {
      isSelectionActive = false;
      
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      
      cleanupSelectionUI();
      
      // Reset cursor
      document.body.style.cursor = '';
    }

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Change cursor to indicate selection mode
    document.body.style.cursor = 'crosshair';
  }

  function cleanupSelectionUI() {
    const elementsToRemove = [
      'element-selector-overlay',
      'element-selector-highlight', 
      'element-selector-tooltip'
    ];
    
    elementsToRemove.forEach(id => {
      const element = document.getElementById(id);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
  }

  // Clean up when page unloads
  window.addEventListener('beforeunload', cleanupSelectionUI);
})();