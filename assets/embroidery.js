/**
 * Embroidery Feature - Product Page (PDP)
 * Modern Shopify implementation with addon product pricing
 * @version 2.0.0
 */
(() => {
  'use strict';

  // Generate unique bundle ID for linking main product and addon
  const generateBundleId = () => {
    return `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Initialize embroidery functionality
  const init = () => {
    const wrap = document.getElementById('embroidery');
    if (!wrap) return;

    // Parse configuration data
    const cfgEl = wrap.querySelector('[data-emb-config]');
    if (!cfgEl) {
      console.error('[Embroidery] Missing configuration data');
      return;
    }

    const cfg = JSON.parse(cfgEl.textContent);
    const { addon_product_id, variant_map, currency } = cfg;

    // DOM elements
    const checkbox = wrap.querySelector('[data-emb-toggle-checkbox]');
    const panel = wrap.querySelector('[data-emb-panel]');
    const enabled = wrap.querySelector('input[name="emb_enabled"]');
    const nameInput = wrap.querySelector('[data-emb-name]');
    const countEl = wrap.querySelector('[data-emb-count]');
    const priceDisplay = wrap.querySelector('[data-emb-price-display]');

    if (!checkbox || !panel || !enabled || !nameInput) {
      console.error('[Embroidery] Missing required DOM elements');
      return;
    }

    /**
     * Format money using Intl API
     */
    const formatMoney = (cents, curr) => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: curr || currency
        }).format((cents || 0) / 100);
      } catch (e) {
        return `${((cents || 0) / 100).toFixed(2)} ${curr || currency}`;
      }
    };

    /**
     * Get currently selected color and font codes
     */
    const getSelectedCodes = () => {
      const colorInput = wrap.querySelector('input[name="emb_colour"]:checked');
      const fontInput = wrap.querySelector('input[name="emb_font"]:checked');

      return {
        color: colorInput ? colorInput.value : null,
        colorLabel: colorInput ? colorInput.dataset.label : null,
        font: fontInput ? fontInput.value : null,
        fontLabel: fontInput ? fontInput.dataset.label : null
      };
    };

    /**
     * Find addon variant ID for selected color/font combination
     */
    const resolveAddonVariant = (colorCode, fontCode) => {
      if (!variant_map || !Array.isArray(variant_map)) {
        console.error('[Embroidery] Invalid variant map');
        return null;
      }

      const match = variant_map.find(v =>
        v.color === colorCode && v.font === fontCode
      );

      if (!match) {
        console.warn(`[Embroidery] No variant found for ${colorCode}/${fontCode}`);
        return null;
      }

      return match;
    };

    /**
     * Update price display based on selected combination
     */
    const updatePriceDisplay = () => {
      if (!priceDisplay) return;

      const { color, font } = getSelectedCodes();
      if (!color || !font) return;

      const variant = resolveAddonVariant(color, font);
      if (variant) {
        priceDisplay.textContent = `+${formatMoney(variant.price_cents, currency)}`;
      }
    };

    /**
     * Toggle embroidery panel visibility
     */
    const setEnabled = (on) => {
      enabled.value = on ? 'true' : 'false';
      panel.classList.toggle('hidden', !on);

      if (on) {
        // Focus name input for accessibility
        setTimeout(() => nameInput.focus(), 100);
      }
    };

    /**
     * Validate name field
     */
    const validateName = () => {
      const value = nameInput.value.trim();
      const isValid = value.length >= 1;

      // Visual feedback
      nameInput.classList.toggle('border-red-500', !isValid);
      nameInput.classList.toggle('border-gray-300', isValid);
      nameInput.setAttribute('aria-invalid', !isValid);

      // Error message
      let errorEl = wrap.querySelector('.emb-name-error');

      if (!isValid && nameInput.dataset.touched === 'true') {
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'emb-name-error text-red-500 text-xs mt-1';
          errorEl.setAttribute('role', 'alert');
          errorEl.textContent = 'Name must be at least 1 character';
          nameInput.parentNode.appendChild(errorEl);
        }
      } else if (errorEl) {
        errorEl.remove();
      }

      return isValid;
    };

    /**
     * Validate color and font selection
     */
    const validateSelections = () => {
      const { color, font } = getSelectedCodes();
      return color && font;
    };

    /**
     * Validate entire form
     */
    const validateAll = () => {
      if (enabled.value !== 'true') return true;

      const nameValid = validateName();
      const selectionsValid = validateSelections();

      if (!selectionsValid) {
        console.error('[Embroidery] Color and font must be selected');
      }

      return nameValid && selectionsValid;
    };

    /**
     * Announce to screen readers
     */
    const announce = (message) => {
      let liveRegion = document.getElementById('emb-live-region');
      if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'emb-live-region';
        liveRegion.className = 'sr-only';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        document.body.appendChild(liveRegion);
      }
      liveRegion.textContent = message;
    };

    // Event: Toggle checkbox
    checkbox.addEventListener('change', () => {
      setEnabled(checkbox.checked);
      if (checkbox.checked) {
        announce('Embroidery options expanded');
      }
    });

    // Auto-expand if URL parameter present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('embroidery') === 'true') {
      checkbox.checked = true;
      setEnabled(true);
    }

    // Event: Name input
    if (countEl) {
      countEl.textContent = String(nameInput.value.length || 0);

      nameInput.addEventListener('input', () => {
        nameInput.dataset.touched = 'true';
        countEl.textContent = String(nameInput.value.length);
        validateName();
      });

      nameInput.addEventListener('blur', () => {
        nameInput.dataset.touched = 'true';
        validateName();
      });
    }

    // Event: Color/Font selection changes price
    wrap.addEventListener('change', (e) => {
      if (e.target.name === 'emb_colour' || e.target.name === 'emb_font') {
        updatePriceDisplay();

        const { colorLabel, fontLabel } = getSelectedCodes();
        if (colorLabel && fontLabel) {
          announce(`Selected ${colorLabel} ${fontLabel}`);
        }
      }
    });

    // Initial price display
    updatePriceDisplay();

    /**
     * Override product form submission to add embroidery
     */
    const productForm = document.querySelector('product-form');
    if (!productForm) {
      console.error('[Embroidery] product-form element not found');
      return;
    }

    const originalOnSubmit = productForm.onSubmitHandler;

    productForm.onSubmitHandler = async function (evt) {
      // If embroidery is enabled, validate and add both lines
      if (enabled.value === 'true') {
        // Validate all fields
        if (!validateAll()) {
          evt.preventDefault();
          evt.stopPropagation();
          nameInput.focus();
          announce('Please fix errors before adding to cart');
          return false;
        }

        const { color, colorLabel, font, fontLabel } = getSelectedCodes();
        const name = nameInput.value.trim();
        const addonVariant = resolveAddonVariant(color, font);

        if (!addonVariant) {
          evt.preventDefault();
          evt.stopPropagation();
          alert('Error: Could not find pricing for selected combination. Please try again.');
          return false;
        }

        // Generate bundle ID to link main and addon lines
        const bundleId = generateBundleId();

        // Get main product form data
        const form = productForm.form;
        const formData = new FormData(form);
        const mainVariantId = formData.get('id');
        const quantity = parseInt(formData.get('quantity') || '1', 10);

        // Prevent default form submission
        evt.preventDefault();
        evt.stopPropagation();

        try {
          // Prepare items array: main product + addon
          const items = [
            {
              id: mainVariantId,
              quantity: quantity,
              properties: {
                '_embroidery': 'true',
                '_emb_bundle_id': bundleId,
                'Embroidery Name': name,
                'Embroidery Color': colorLabel,
                'Embroidery Font': fontLabel,
                '_emb_color_code': color,
                '_emb_font_code': font,
                '_emb_combo_id': `${color}_${font}`
              }
            },
            {
              id: addonVariant.id,
              quantity: quantity,
              properties: {
                '_emb_addon': 'true',
                '_emb_bundle_id': bundleId,
                '_emb_parent_variant': mainVariantId,
                'Embroidery Fee': `${colorLabel} ${fontLabel} - ${formatMoney(addonVariant.price_cents, currency)}`
              }
            }
          ];

          // Add to cart via AJAX with sections
          const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              items: items,
              sections: productForm.getSectionsToRender ? productForm.getSectionsToRender().map(s => s.id) : ['cart-drawer', 'cart-icon-bubble']
            })
          });

          if (!response.ok) {
            throw new Error(`Cart add failed: ${response.status}`);
          }

          const data = await response.json();

          // Let Dawn's product-form handle the cart update
          if (data.sections) {
            productForm.renderContents(data);
          }

          announce(`${name} with ${colorLabel} ${fontLabel} embroidery added to cart`);

        } catch (error) {
          console.error('[Embroidery] Add to cart failed:', error);
          alert('Failed to add to cart. Please try again.');
        }

        return false;
      }

      // If embroidery not enabled, call original handler
      return originalOnSubmit.call(this, evt);
    };
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
