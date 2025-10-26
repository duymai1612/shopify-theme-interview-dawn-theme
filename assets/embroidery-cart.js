/**
 * Embroidery Feature - Cart Drawer
 * Full editing capability with Sections Rendering API
 * @version 2.0.0
 */
(() => {
  'use strict';

  let editModalInstance = null;

  /**
   * Format money helper
   */
  const formatMoney = (cents, currency = 'GBP') => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency
      }).format((cents || 0) / 100);
    } catch (e) {
      return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
    }
  };

  /**
   * Announce to screen readers
   */
  const announce = (message) => {
    let liveRegion = document.getElementById('cart-emb-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'cart-emb-live-region';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = message;
  };

  /**
   * Update cart sections without page reload
   */
  const updateCartSections = async (sections) => {
    if (!sections) return;

    Object.entries(sections).forEach(([sectionId, html]) => {
      const sectionSelector = `#shopify-section-${sectionId}`;
      const targetElement = document.querySelector(sectionSelector);

      if (targetElement) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const newContent = tempDiv.querySelector(sectionSelector);

        if (newContent) {
          targetElement.innerHTML = newContent.innerHTML;
        }
      }
    });

    // Re-attach event listeners after DOM update
    attachEventListeners();
  };

  /**
   * Fetch current cart state
   */
  const fetchCart = async () => {
    const response = await fetch('/cart.js');
    if (!response.ok) throw new Error('Failed to fetch cart');
    return response.json();
  };

  /**
   * Find addon line for a given parent line
   */
  const findAddonLine = (cart, parentBundleId) => {
    return cart.items.find(item =>
      item.properties?._emb_addon === 'true' &&
      item.properties?._emb_bundle_id === parentBundleId
    );
  };

  /**
   * Toggle embroidery on/off
   */
  const handleToggle = async (lineKey, turnOn) => {
    const cart = await fetchCart();
    const parentLine = cart.items.find(item => item.key === lineKey);

    if (!parentLine) {
      console.error('[Embroidery] Parent line not found');
      return;
    }

    try {
      if (turnOn) {
        // Turning ON: Open edit modal to select options
        openEditModal(lineKey, parentLine, null);
      } else {
        // Turning OFF: Remove embroidery properties and addon line
        const bundleId = parentLine.properties?._emb_bundle_id;
        const addonLine = bundleId ? findAddonLine(cart, bundleId) : null;

        // Update main line: clear embroidery properties
        const updateResponse = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            id: lineKey,
            properties: {
              '_embroidery': '',
              '_emb_bundle_id': '',
              'Embroidery Name': '',
              'Embroidery Color': '',
              'Embroidery Font': '',
              '_emb_color_code': '',
              '_emb_font_code': '',
              '_emb_combo_id': ''
            },
            sections: 'cart-drawer,cart-icon-bubble'
          })
        });

        if (!updateResponse.ok) throw new Error('Failed to update cart');

        // Remove addon line if exists
        if (addonLine) {
          await fetch('/cart/change.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              id: addonLine.key,
              quantity: 0,
              sections: 'cart-drawer,cart-icon-bubble'
            })
          });
        }

        const finalResponse = await fetch('/cart.js');
        const finalCart = await finalResponse.json();

        // Update UI with sections
        const sectionsResponse = await fetch(`${window.location.pathname}?sections=cart-drawer,cart-icon-bubble`);
        const sectionsData = await sectionsResponse.json();
        updateCartSections(sectionsData);

        announce('Embroidery removed');
      }
    } catch (error) {
      console.error('[Embroidery] Toggle failed:', error);
      alert('Failed to update embroidery. Please try again.');
    }
  };

  /**
   * Open edit modal for embroidery
   */
  const openEditModal = async (lineKey, parentLine, addonLine) => {
    // Close existing modal
    if (editModalInstance) {
      editModalInstance.remove();
    }

    // Get product metafield data
    const productHandle = parentLine.handle;
    let productData;

    try {
      const response = await fetch(`/products/${productHandle}.js`);
      productData = await response.json();
    } catch (error) {
      console.error('[Embroidery] Failed to fetch product data:', error);
      alert('Failed to load embroidery options');
      return;
    }

    // Parse metafield (assuming it's available in product JSON via metafields API)
    // Note: In production, you'd fetch this via a proper endpoint
    const currentName = parentLine.properties?.['Embroidery Name'] || '';
    const currentColorCode = parentLine.properties?._emb_color_code || '';
    const currentFontCode = parentLine.properties?._emb_font_code || '';

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'emb-edit-modal fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'emb-modal-title');

    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-4">
          <h3 id="emb-modal-title" class="text-lg font-semibold">Edit Embroidery</h3>
          <button type="button" class="emb-modal-close text-gray-500 hover:text-gray-700" aria-label="Close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form id="emb-edit-form" class="space-y-4">
          <div>
            <label for="emb-edit-name" class="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              id="emb-edit-name"
              class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-purple-600 focus:outline-none"
              value="${currentName}"
              maxlength="10"
              required
              aria-describedby="emb-edit-name-error"
            >
            <div id="emb-edit-name-error" class="text-red-500 text-xs mt-1 hidden" role="alert"></div>
          </div>

          <fieldset>
            <legend class="block text-sm font-medium mb-2">Color</legend>
            <div class="flex gap-3" role="radiogroup">
              <label class="cursor-pointer">
                <input type="radio" name="emb-edit-color" value="white" data-label="White" class="sr-only peer" ${currentColorCode === 'white' ? 'checked' : ''} required>
                <span class="inline-block w-12 h-12 rounded-full border-2 peer-checked:border-black" style="background: white; border-color: #ccc;"></span>
                <span class="block text-xs text-center mt-1">White</span>
              </label>
              <label class="cursor-pointer">
                <input type="radio" name="emb-edit-color" value="gold" data-label="Gold" class="sr-only peer" ${currentColorCode === 'gold' ? 'checked' : ''} required>
                <span class="inline-block w-12 h-12 rounded-full border-2 peer-checked:border-black" style="background: gold;"></span>
                <span class="block text-xs text-center mt-1">Gold</span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend class="block text-sm font-medium mb-2">Font</legend>
            <div class="flex gap-3" role="radiogroup">
              <label class="cursor-pointer">
                <input type="radio" name="emb-edit-font" value="serif" data-label="Serif" class="sr-only peer" ${currentFontCode === 'serif' ? 'checked' : ''} required>
                <span class="px-4 py-2 border-2 rounded peer-checked:border-black peer-checked:bg-gray-50 block">Serif</span>
              </label>
              <label class="cursor-pointer">
                <input type="radio" name="emb-edit-font" value="script" data-label="Script" class="sr-only peer" ${currentFontCode === 'script' ? 'checked' : ''} required>
                <span class="px-4 py-2 border-2 rounded peer-checked:border-black peer-checked:bg-gray-50 block font-script">Script</span>
              </label>
            </div>
          </fieldset>

          <div class="flex gap-3 pt-4">
            <button type="button" class="emb-modal-close flex-1 px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Save</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    editModalInstance = modal;

    // Focus first input
    setTimeout(() => modal.querySelector('#emb-edit-name').focus(), 100);

    // Close handlers
    const closeModal = () => {
      modal.remove();
      editModalInstance = null;
    };

    modal.querySelectorAll('.emb-modal-close').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // Form submission
    const form = modal.querySelector('#emb-edit-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = modal.querySelector('#emb-edit-name');
      const newName = nameInput.value.trim();
      const newColorInput = modal.querySelector('input[name="emb-edit-color"]:checked');
      const newFontInput = modal.querySelector('input[name="emb-edit-font"]:checked');

      if (!newName || !newColorInput || !newFontInput) {
        alert('Please fill all fields');
        return;
      }

      const newColor = newColorInput.value;
      const newColorLabel = newColorInput.dataset.label;
      const newFont = newFontInput.value;
      const newFontLabel = newFontInput.dataset.label;

      try {
        await saveEmbroideryChanges(lineKey, parentLine, {
          name: newName,
          color: newColor,
          colorLabel: newColorLabel,
          font: newFont,
          fontLabel: newFontLabel
        });

        closeModal();
        announce(`Embroidery updated to ${newName}, ${newColorLabel} ${newFontLabel}`);
      } catch (error) {
        console.error('[Embroidery] Save failed:', error);
        alert('Failed to save changes. Please try again.');
      }
    });
  };

  /**
   * Save embroidery changes
   */
  const saveEmbroideryChanges = async (lineKey, parentLine, newData) => {
    const cart = await fetchCart();
    const bundleId = parentLine.properties?._emb_bundle_id || `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const oldAddonLine = findAddonLine(cart, bundleId);

    // Update parent line properties
    await fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        id: lineKey,
        properties: {
          '_embroidery': 'true',
          '_emb_bundle_id': bundleId,
          'Embroidery Name': newData.name,
          'Embroidery Color': newData.colorLabel,
          'Embroidery Font': newData.fontLabel,
          '_emb_color_code': newData.color,
          '_emb_font_code': newData.font,
          '_emb_combo_id': `${newData.color}_${newData.font}`
        }
      })
    });

    // Remove old addon line
    if (oldAddonLine) {
      await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          id: oldAddonLine.key,
          quantity: 0
        })
      });
    }

    // Add new addon line with correct price
    // Note: You'll need to resolve the variant ID based on color/font
    // This is a simplified version - implement variant resolution
    const newAddonVariantId = resolveAddonVariantId(newData.color, newData.font);

    if (newAddonVariantId) {
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          items: [{
            id: newAddonVariantId,
            quantity: parentLine.quantity,
            properties: {
              '_emb_addon': 'true',
              '_emb_bundle_id': bundleId,
              '_emb_parent_variant': parentLine.variant_id,
              'Embroidery Fee': `${newData.colorLabel} ${newData.fontLabel}`
            }
          }],
          sections: 'cart-drawer,cart-icon-bubble'
        })
      });
    }

    // Update UI
    const sectionsResponse = await fetch(`${window.location.pathname}?sections=cart-drawer,cart-icon-bubble`);
    const sectionsData = await sectionsResponse.json();
    updateCartSections(sectionsData);
  };

  /**
   * Resolve addon variant ID (simplified - needs actual implementation)
   */
  const resolveAddonVariantId = (color, font) => {
    // This should match your addon product's variant mapping
    // For now, return a placeholder
    console.warn('[Embroidery] Variant resolution not fully implemented');
    return null;
  };

  /**
   * Attach event listeners to cart elements
   */
  const attachEventListeners = () => {
    // Toggle embroidery on/off
    document.querySelectorAll('[data-emb-cart-toggle]').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const lineKey = e.target.dataset.lineKey;
        const turnOn = e.target.checked;

        e.target.disabled = true;
        await handleToggle(lineKey, turnOn);
        e.target.disabled = false;
      });
    });

    // Edit embroidery button
    document.querySelectorAll('[data-emb-edit-btn]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const lineKey = e.target.dataset.lineKey;
        const cart = await fetchCart();
        const parentLine = cart.items.find(item => item.key === lineKey);

        if (parentLine) {
          const bundleId = parentLine.properties?._emb_bundle_id;
          const addonLine = bundleId ? findAddonLine(cart, bundleId) : null;
          openEditModal(lineKey, parentLine, addonLine);
        }
      });
    });
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachEventListeners);
  } else {
    attachEventListeners();
  }

  // Re-attach listeners when cart drawer opens
  document.addEventListener('cart:refresh', attachEventListeners);
})();
