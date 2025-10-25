(() => {
    // Update cart total to include embroidery surcharge
    const updateCartTotal = () => {
        const cartItems = document.querySelectorAll('.cart-item');
        let totalEmbroiderySurcharge = 0;
        
        cartItems.forEach(item => {
            const embroideryCheckbox = item.querySelector('[data-emb-cart-toggle]');
            if (embroideryCheckbox && embroideryCheckbox.checked) {
                const surchargeElement = item.querySelector('[data-emb-surcharge]');
                if (surchargeElement) {
                    const surcharge = parseFloat(surchargeElement.getAttribute('data-emb-surcharge')) || 0;
                    totalEmbroiderySurcharge += surcharge;
                }
            }
        });
        
        // Update total display if embroidery surcharge exists
        if (totalEmbroiderySurcharge > 0) {
            const totalElement = document.querySelector('.totals__total-value');
            if (totalElement) {
                // Add embroidery surcharge on the same line as total
                const surchargeNote = document.querySelector('.embroidery-surcharge-note');
                if (!surchargeNote) {
                    const note = document.createElement('div');
                    note.className = 'embroidery-surcharge-note';
                    note.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;';
                    note.innerHTML = `<span>+ Embroidery surcharge:</span><span>${(totalEmbroiderySurcharge / 100).toFixed(2)}₫</span>`;
                    totalElement.parentNode.appendChild(note);
                } else {
                    // Update existing note
                    surchargeNote.innerHTML = `<span>+ Embroidery surcharge:</span><span>${(totalEmbroiderySurcharge / 100).toFixed(2)}₫</span>`;
                }
            }
        } else {
            // Remove surcharge note if no embroidery
            const surchargeNote = document.querySelector('.embroidery-surcharge-note');
            if (surchargeNote) {
                surchargeNote.remove();
            }
        }
    };

    // Get default embroidery values from product metafields
    const getDefaultEmbroideryValues = () => {
        // Try to get from global product data or metafields
        const productData = window.productData || {};
        const embroideryTemplate = productData.embroidery_template;
        
        if (embroideryTemplate) {
            return {
                'Embroidery Name': 'Custom Name',
                'Embroidery Colour Code': embroideryTemplate.colors?.[0]?.code || 'default',
                'Embroidery Font Code': embroideryTemplate.fonts?.[0]?.code || 'default',
                'Embroidery Surcharge': embroideryTemplate.price ? `+${embroideryTemplate.price}` : '+$5.00'
            };
        }
        
        // Fallback defaults
        return {
            'Embroidery Name': 'Custom Name',
            'Embroidery Colour Code': 'default',
            'Embroidery Font Code': 'default',
            'Embroidery Surcharge': '+$5.00'
        };
    };

    const onToggle = async (e) => {
        const cb = e.target.closest('[data-emb-cart-toggle]');
        if (!cb) return;
        
        const lineKey = cb.getAttribute('data-line-key');
        const turnOn = cb.checked;
        
        // Disable checkbox during request
        cb.disabled = true;
        
        try {
            // If turning off: clear only embroidery properties; if turning on: restore default values
            let props;
            if (turnOn) {
                // Restore default embroidery values when turning on
                const defaultValues = getDefaultEmbroideryValues();
                props = {
                    _embroidery: 'true',
                    ...defaultValues
                };
            } else {
                // When turning off, we need to clear specific embroidery properties
                // but keep other properties intact
                props = {
                    _embroidery: null,
                    'Embroidery Name': null,
                    'Embroidery Colour Code': null,
                    'Embroidery Font Code': null,
                    'Embroidery Surcharge': null
                };
            }
            
            const response = await fetch(`${window.routes.cart_change_url}.js`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: lineKey, 
                    properties: props 
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update cart');
            }
            
            const cart = await response.json();
            
            // Update UI - try to use theme's update mechanism first
            if (window.Shopify?.theme?.sections) {
                // Use theme's section update if available
                const event = new CustomEvent('cart:updated', { detail: { cart } });
                document.dispatchEvent(event);
            } else {
                // Fallback to page reload
                window.location.reload();
            }
            
            // Update cart total to include embroidery surcharge
            updateCartTotal();
            
        } catch (error) {
            console.error('Error updating embroidery:', error);
            // Rollback checkbox state
            cb.checked = !turnOn;
            // Re-enable checkbox on error
            cb.disabled = false;
        }
        
        // Note: If successful, page will reload so we don't need to re-enable here
    };
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.addEventListener('change', onToggle);
            updateCartTotal(); // Update total on page load
        });
    } else {
        document.addEventListener('change', onToggle);
        updateCartTotal(); // Update total on page load
    }
})();
  