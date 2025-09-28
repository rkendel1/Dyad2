document.addEventListener('DOMContentLoaded', function() {
  const selectElementBtn = document.getElementById('selectElement');
  const statusDiv = document.getElementById('status');
  const resultSection = document.getElementById('resultSection');
  const selectorInput = document.getElementById('selector');
  const noteTextarea = document.getElementById('note');
  const copyBtn = document.getElementById('copyToClipboard');
  const copyStatus = document.getElementById('copyStatus');
  
  let isSelecting = false;

  selectElementBtn.addEventListener('click', async function() {
    if (isSelecting) return;
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        showStatus('No active tab found', 'error');
        return;
      }

      // Start selection mode
      isSelecting = true;
      selectElementBtn.disabled = true;
      selectElementBtn.textContent = 'Selecting...';
      showStatus('Click on any element on the page to select it', 'selecting');
      
      // Inject and execute the selection script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: startElementSelection
      });
      
      // Listen for the selected element
      chrome.runtime.onMessage.addListener(handleElementSelected);
      
    } catch (error) {
      console.error('Error starting element selection:', error);
      showStatus('Error: Could not start element selection', 'error');
      resetSelectionState();
    }
  });

  function handleElementSelected(message, sender, sendResponse) {
    if (message.type === 'ELEMENT_SELECTED') {
      chrome.runtime.onMessage.removeListener(handleElementSelected);
      
      if (message.selector) {
        selectorInput.value = message.selector;
        noteTextarea.value = '';
        resultSection.style.display = 'block';
        showStatus('Element selected successfully!', 'success');
      } else {
        showStatus('Selection cancelled', 'error');
      }
      
      resetSelectionState();
      sendResponse({ received: true });
    }
  }

  copyBtn.addEventListener('click', async function() {
    const selector = selectorInput.value.trim();
    const note = noteTextarea.value.trim();
    
    if (!selector) {
      showCopyStatus('No selector to copy');
      return;
    }
    
    const textToCopy = note ? `${selector} → ${note}` : selector;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      showCopyStatus('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showCopyStatus('Failed to copy');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = message ? 'block' : 'none';
  }

  function showCopyStatus(message) {
    copyStatus.textContent = message;
    copyStatus.classList.add('show');
    setTimeout(() => {
      copyStatus.classList.remove('show');
    }, 2000);
  }

  function resetSelectionState() {
    isSelecting = false;
    selectElementBtn.disabled = false;
    selectElementBtn.textContent = 'Select Element';
  }
});

// This function will be injected into the content script
function startElementSelection() {
  // Remove any existing overlay
  const existingOverlay = document.getElementById('element-selector-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  let isSelecting = true;
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

  function generateSelector(element) {
    if (!element || element === document.body) return 'body';
    
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Build selector path
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      // Add class names if available
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/);
        if (classes.length > 0 && classes[0] !== '') {
          selector += '.' + classes.join('.');
        }
      }
      
      // Add nth-child if needed for uniqueness
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
    
    return path.join(' > ');
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
    if (!isSelecting) return;
    
    event.preventDefault();
    const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
    
    if (elementUnderMouse && elementUnderMouse !== overlay && elementUnderMouse !== highlight) {
      highlightedElement = elementUnderMouse;
      highlightElement(elementUnderMouse);
    }
  }

  function handleClick(event) {
    if (!isSelecting) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    cleanup();
    
    let selector = '';
    if (highlightedElement) {
      selector = generateSelector(highlightedElement);
    }
    
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
    isSelecting = false;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (highlight && highlight.parentNode) {
      highlight.parentNode.removeChild(highlight);
    }
    
    document.body.style.cursor = '';
  }

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Change cursor to indicate selection mode
  document.body.style.cursor = 'crosshair';
}