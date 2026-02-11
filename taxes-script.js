// Taxes and Fees Page Interactions
document.addEventListener('DOMContentLoaded', function() {
    // Tab Switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('tab-active'));
            this.classList.add('tab-active');
        });
    });

    // Navigation Items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Card Action Buttons
    const manageButtons = document.querySelectorAll('.card-footer .btn-text');
    manageButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            if (action === 'full-service') {
                window.location.href = 'full-service-fee.html';
            }
            if (action === 'guest-count') {
                window.location.href = 'guest-count-fee.html';
            }
            if (action === 'order-amount') {
                window.location.href = 'order-amount-fee.html';
            }
            if (action === 'event-type') {
                window.location.href = 'event-type-fee.html';
            }
        });
    });

    // Brand Selector Dropdown
    const brandSelector = document.querySelector('.brand-selector');
    if (brandSelector) {
        brandSelector.addEventListener('click', function() {
            alert('Brand/Store selector dropdown would open here');
        });
    }

    // Header Icon Buttons
    const iconButtons = document.querySelectorAll('.icon-button');
    iconButtons.forEach(button => {
        button.addEventListener('click', function() {
            const ariaLabel = this.getAttribute('aria-label');
            switch(ariaLabel) {
                case 'Notifications':
                    alert('Notifications panel would open here');
                    break;
                case 'Help':
                    alert('Help center would open here');
                    break;
                case 'User':
                    alert('User menu would open here');
                    break;
                case 'Apps':
                    alert('Apps menu would open here');
                    break;
            }
        });
    });

    // Mobile Sidebar Toggle (for responsive design)
    function createMobileMenuToggle() {
        if (window.innerWidth <= 1024) {
            const sidebar = document.querySelector('.sidebar');
            const header = document.querySelector('.main-header');

            if (!document.querySelector('.mobile-menu-toggle')) {
                const toggleButton = document.createElement('button');
                toggleButton.className = 'mobile-menu-toggle';
                toggleButton.innerHTML = '☰';
                toggleButton.style.cssText = `
                    position: fixed;
                    left: 12px;
                    top: 13px;
                    z-index: 101;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 5px;
                `;

                toggleButton.addEventListener('click', function() {
                    sidebar.classList.toggle('open');
                });

                header.insertBefore(toggleButton, header.firstChild);
            }
        }
    }

    createMobileMenuToggle();
    window.addEventListener('resize', createMobileMenuToggle);

    const snackbar = document.getElementById('fee-snackbar');
    const snackbarMessage = snackbar?.querySelector('.snackbar-message');
    const showSnackbar = (message) => {
        if (!snackbar || !snackbarMessage) return;
        snackbarMessage.textContent = message;
        snackbar.classList.add('is-visible');
        window.setTimeout(() => {
            snackbar.classList.remove('is-visible');
        }, 3000);
    };

    try {
        const message = window.sessionStorage.getItem('feesSnackbarMessage');
        if (message) {
            window.sessionStorage.removeItem('feesSnackbarMessage');
            showSnackbar(message);
        }
    } catch (error) {
        console.error('Unable to read snackbar message.', error);
    }

    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const previewButton = document.getElementById('preview-fees-button');
    const previewModal = document.getElementById('preview-fees-modal');
    const previewClose = document.getElementById('preview-fees-close');
    const previewCancel = document.getElementById('preview-fees-cancel');
    const previewForm = document.getElementById('preview-fees-form');
    const previewSubtotal = document.getElementById('preview-subtotal');
    const previewSubtotalField = previewSubtotal?.closest('.input-field');
    const previewSubtotalError = document.getElementById('preview-subtotal-error');
    const previewGuestCount = document.getElementById('preview-guest-count');
    const previewGuestCountField = previewGuestCount?.closest('.input-field');
    const previewGuestCountError = document.getElementById('preview-guest-count-error');
    const previewEventType = document.getElementById('preview-event-type');
    const previewALaCarteError = document.getElementById('preview-a-la-carte-error');
    const previewALaCarteOptions = document.getElementById('preview-a-la-carte-options');
    const previewFullServiceChoice = document.getElementById('preview-full-service-choice');
    const previewFullServiceToggle = document.getElementById('preview-full-service-toggle');
    const previewFullServiceSegment = document.getElementById('preview-full-service-segment');
    const previewFullServiceModeInput = document.getElementById('preview-full-service-mode');
    const componentKeys = ['cutlery', 'staffing', 'setup', 'cleanup'];

    const formatCurrency = (cents) => `$${(cents / 100).toFixed(2)}`;
    const formatPercent = (value) => `${value}%`;
    const formatCurrencyShort = (cents) => {
        const value = cents / 100;
        const rounded = Math.round(value * 100) / 100;
        const hasCents = Math.abs(rounded % 1) > 0;
        return `$${rounded.toLocaleString('en-US', {
            minimumFractionDigits: hasCents ? 2 : 0,
            maximumFractionDigits: hasCents ? 2 : 0
        })}`;
    };
    const formatRange = (minValue, maxValue, formatter) => {
        const minLabel = formatter(minValue);
        if (maxValue === null || maxValue === undefined) {
            return `${minLabel}+`;
        }
        return `${minLabel} to ${formatter(maxValue)}`;
    };

    const parseCurrencyToCents = (value) => {
        const numeric = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Math.round(numeric * 100);
    };

    const isRuleConfigured = (rule) => {
        if (!rule) return false;
        if (rule.calcType === 'percent') {
            return Number.isFinite(rule.percent);
        }
        return Number.isFinite(rule.amountCents);
    };

    const getConfiguredALaCarteComponents = (config) => {
        return componentKeys.filter(key => {
            const rule = config.components?.[key];
            return rule?.active && isRuleConfigured(rule);
        });
    };

    const clearFieldError = (errorLabel, field) => {
        if (errorLabel) {
            errorLabel.textContent = '';
        }
        if (field) {
            field.classList.remove('input-error');
        }
    };

    const setFieldError = (errorLabel, field, message) => {
        if (errorLabel) {
            errorLabel.textContent = message || '';
        }
        if (field && message) {
            field.classList.add('input-error');
        }
    };

    const clearPreviewErrors = () => {
        clearFieldError(previewSubtotalError, previewSubtotalField);
        clearFieldError(previewGuestCountError, previewGuestCountField);
        clearFieldError(previewALaCarteError, null);
    };

    const openPreviewModal = () => {
        if (!previewModal) return;
        previewModal.classList.add('is-open');
        previewModal.setAttribute('aria-hidden', 'false');
        clearPreviewErrors();
    };

    const closePreviewModal = () => {
        if (!previewModal) return;
        previewModal.classList.remove('is-open');
        previewModal.setAttribute('aria-hidden', 'true');
        clearPreviewErrors();
    };

    const setFullServiceMode = (value) => {
        if (!previewFullServiceSegment || !previewFullServiceModeInput) return;
        const buttons = Array.from(previewFullServiceSegment.querySelectorAll('.segment-button'));
        buttons.forEach(button => {
            button.classList.toggle('segment-selected', button.dataset.value === value);
        });
        previewFullServiceModeInput.value = value;
    };

    const updateALaCarteVisibility = () => {
        const fullServiceConfig = FeesStore.getFullServiceConfig();
        const isALaCarteConfigured = fullServiceConfig.mode === 'a_la_carte';
        const isEnabled = previewFullServiceToggle?.checked ?? true;
        if (previewFullServiceChoice) {
            previewFullServiceChoice.hidden = !(isEnabled && isALaCarteConfigured);
        }
        if (!previewALaCarteOptions) return;
        const isALaCarte = previewFullServiceModeInput?.value === 'a_la_carte';
        const configuredKeys = getConfiguredALaCarteComponents(fullServiceConfig);
        componentKeys.forEach(key => {
            const checkbox = previewALaCarteOptions.querySelector(`input[value="${key}"]`);
            if (!checkbox) return;
            const label = checkbox.closest('label');
            const isConfigured = configuredKeys.includes(key);
            if (label) {
                label.hidden = !isConfigured;
            }
            if (!isConfigured) {
                checkbox.checked = false;
            }
        });
        previewALaCarteOptions.hidden = !(isEnabled && isALaCarteConfigured && isALaCarte && configuredKeys.length);
    };

    const renderEventTypeOptions = () => {
        if (!previewEventType) return;
        const rules = FeesStore.getEventTypeRules();
        previewEventType.innerHTML = '';
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'None';
        previewEventType.appendChild(emptyOption);
        rules.forEach(rule => {
            const option = document.createElement('option');
            option.value = rule.id;
            option.textContent = rule.active ? rule.eventTypeName : `${rule.eventTypeName} (Inactive)`;
            previewEventType.appendChild(option);
        });
    };

    const setStatusTag = (elementId, isActive) => {
        const tag = document.getElementById(elementId);
        if (!tag) return;
        tag.classList.remove('status-active', 'status-inactive');
        tag.classList.add(isActive ? 'status-active' : 'status-inactive');
        const label = tag.querySelector('span:last-child');
        if (label) {
            label.textContent = isActive ? 'ACTIVE' : 'INACTIVE';
        }
    };

    const setActionLabel = (buttonId, isActive) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.textContent = isActive ? 'Manage' : 'Configure';
    };

    const updateStatusTags = () => {
        const guestRules = FeesStore.getGuestCountRules();
        const settings = FeesStore.getSettings();
        const hasGuestActive = !!settings.guestCountActive;
        const fullServiceConfig = FeesStore.getFullServiceConfig();
        const hasOrderAmountActive = !!settings.orderAmountActive;
        const hasFullServiceActive = fullServiceConfig.mode === 'a_la_carte'
            ? getConfiguredALaCarteComponents(fullServiceConfig).length > 0
            : !!fullServiceConfig.bundle?.active;
        const hasEventTypeActive = !!settings.eventTypeActive;
        setStatusTag('guest-count-status', hasGuestActive);
        setStatusTag('full-service-status', hasFullServiceActive);
        setStatusTag('order-amount-status', hasOrderAmountActive);
        setStatusTag('event-type-status', hasEventTypeActive);
        setActionLabel('guest-count-action', hasGuestActive);
        setActionLabel('full-service-action', hasFullServiceActive);
        setActionLabel('order-amount-action', hasOrderAmountActive);
        setActionLabel('event-type-action', hasEventTypeActive);
        updateCardSummaries(hasGuestActive, hasOrderAmountActive, hasFullServiceActive, hasEventTypeActive);
    };

    const setCardSummary = (elementId, summary) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        const row = element.closest('.card-summary-row');
        const card = element.closest('.card');
        if (!summary) {
            element.textContent = '';
            if (row) {
                row.hidden = true;
            }
            if (card) {
                card.classList.remove('has-summary');
            }
            return;
        }
        element.textContent = summary;
        if (row) {
            row.hidden = false;
        }
        if (card) {
            card.classList.add('has-summary');
        }
    };

    const getGuestCountSummary = () => {
        const guestRules = FeesStore.getGuestCountRules();
        if (!guestRules.length) return '';
        const sorted = [...guestRules].sort((a, b) => Number(a.minGuests) - Number(b.minGuests));
        const parts = sorted.map(rule => {
            const range = formatRange(rule.minGuests, rule.maxGuests, (value) => String(value));
            let valueText = '';
            if (rule.calcType === 'percent') {
                valueText = `${formatPercent(rule.percent || 0)} of subtotal`;
            } else if (rule.calcType === 'perPerson') {
                valueText = `${formatCurrencyShort(rule.amountCents || 0)} per person`;
            } else {
                valueText = `${formatCurrencyShort(rule.amountCents || 0)} flat`;
            }
            return `${valueText} for ${range} guests`;
        });
        return parts.join(' • ');
    };

    const getOrderAmountSummary = () => {
        const rules = FeesStore.getOrderAmountRules();
        if (!rules.length) return '';
        const sorted = [...rules].sort((a, b) => Number(a.minSubtotalDollars) - Number(b.minSubtotalDollars));
        const formatDollarRange = (value) => `$${value}`;
        const parts = sorted.map(rule => {
            const range = formatRange(
                rule.minSubtotalDollars,
                rule.maxSubtotalDollars,
                formatDollarRange
            );
            const valueText = rule.calcType === 'percent'
                ? formatPercent(rule.percent || 0)
                : `${formatCurrencyShort(rule.amountCents || 0)} flat`;
            return `${valueText} for ${range} subtotal`;
        });
        return parts.join(' • ');
    };

    const getFullServiceSummary = () => {
        const config = FeesStore.getFullServiceConfig();
        if (config.mode !== 'a_la_carte') {
            if (!config.bundle || !isRuleConfigured(config.bundle)) {
                return '';
            }
            const valueText = config.bundle.calcType === 'percent'
                ? `${formatPercent(config.bundle.percent || 0)} of subtotal`
                : config.bundle.calcType === 'perPerson'
                    ? `${formatCurrencyShort(config.bundle.amountCents || 0)} per person`
                    : `${formatCurrencyShort(config.bundle.amountCents || 0)} flat`;
            return `${valueText} for full service`;
        }

        const labels = {
            cutlery: 'Cutlery',
            staffing: 'Staffing',
            setup: 'Setup',
            cleanup: 'Cleanup'
        };
        const configuredKeys = getConfiguredALaCarteComponents(config);
        if (!configuredKeys.length) return '';
        const parts = configuredKeys.map(key => {
            const rule = config.components?.[key];
            if (!rule) return null;
            let valueText = '';
            if (rule.calcType === 'percent') {
                valueText = `${formatPercent(rule.percent || 0)} of subtotal`;
            } else if (rule.calcType === 'perPerson') {
                valueText = `${formatCurrencyShort(rule.amountCents || 0)} per person`;
            } else {
                valueText = `${formatCurrencyShort(rule.amountCents || 0)} flat`;
            }
            return `${valueText} for ${labels[key] || key}`;
        }).filter(Boolean);
        return parts.join(' • ');
    };

    const getEventTypeSummary = () => {
        const rules = FeesStore.getEventTypeRules();
        if (!rules.length) return '';
        const parts = rules.map(rule => {
            const valueText = rule.calcType === 'percent'
                ? `${formatPercent(rule.percent || 0)} of subtotal`
                : `${formatCurrencyShort(rule.amountCents || 0)} flat`;
            return `${valueText} for ${rule.eventTypeName}`;
        });
        return parts.join(' • ');
    };

    const updateCardSummaries = (guestActive, orderAmountActive, fullServiceActive, eventTypeActive) => {
        const settings = FeesStore.getSettings();
        const fullServiceConfig = FeesStore.getFullServiceConfig();
        const resolvedGuestActive = typeof guestActive === 'boolean' ? guestActive : !!settings.guestCountActive;
        const resolvedOrderAmountActive = typeof orderAmountActive === 'boolean' ? orderAmountActive : !!settings.orderAmountActive;
        const resolvedFullServiceActive = typeof fullServiceActive === 'boolean'
            ? fullServiceActive
            : (fullServiceConfig.mode === 'a_la_carte'
                ? getConfiguredALaCarteComponents(fullServiceConfig).length > 0
                : !!fullServiceConfig.bundle?.active);
        const resolvedEventTypeActive = typeof eventTypeActive === 'boolean' ? eventTypeActive : !!settings.eventTypeActive;

        setCardSummary('guest-count-summary', resolvedGuestActive ? getGuestCountSummary() : '');
        setCardSummary('order-amount-summary', resolvedOrderAmountActive ? getOrderAmountSummary() : '');
        setCardSummary('full-service-summary', resolvedFullServiceActive ? getFullServiceSummary() : '');
        setCardSummary('event-type-summary', resolvedEventTypeActive ? getEventTypeSummary() : '');
    };

    if (previewButton) {
        previewButton.addEventListener('click', () => {
            const fullServiceConfig = FeesStore.getFullServiceConfig();
            if (fullServiceConfig.mode !== 'a_la_carte') {
                setFullServiceMode('bundle');
            }
            renderEventTypeOptions();
            updateALaCarteVisibility();
            openPreviewModal();
        });
    }

    if (previewClose) {
        previewClose.addEventListener('click', closePreviewModal);
    }

    if (previewCancel) {
        previewCancel.addEventListener('click', closePreviewModal);
    }

    if (previewModal) {
        previewModal.addEventListener('click', (event) => {
            if (event.target === previewModal) {
                closePreviewModal();
            }
        });
    }

    if (previewFullServiceSegment) {
        previewFullServiceSegment.addEventListener('click', (event) => {
            const button = event.target.closest('.segment-button');
            if (!button) return;
            setFullServiceMode(button.dataset.value);
            clearFieldError(previewALaCarteError, null);
            updateALaCarteVisibility();
        });
    }

    if (previewForm) {
        previewForm.addEventListener('change', (event) => {
            if (event.target && event.target.id === 'preview-full-service-toggle') {
                clearFieldError(previewALaCarteError, null);
                updateALaCarteVisibility();
            }
        });
    }

    if (previewALaCarteOptions) {
        previewALaCarteOptions.addEventListener('change', () => {
            clearFieldError(previewALaCarteError, null);
        });
    }

    if (previewSubtotal) {
        previewSubtotal.addEventListener('input', () => {
            clearFieldError(previewSubtotalError, previewSubtotalField);
        });
    }

    if (previewGuestCount) {
        previewGuestCount.addEventListener('input', () => {
            clearFieldError(previewGuestCountError, previewGuestCountField);
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && previewModal?.classList.contains('is-open')) {
            closePreviewModal();
        }
    });

    if (previewForm) {
        previewForm.addEventListener('submit', (event) => {
            event.preventDefault();
            clearPreviewErrors();

            const subtotalCents = parseCurrencyToCents(previewSubtotal?.value);
            if (subtotalCents === null || subtotalCents < 0) {
                setFieldError(previewSubtotalError, previewSubtotalField, 'Enter a valid subtotal.');
                previewSubtotal?.focus();
                return;
            }

            const guestCountValue = Number(previewGuestCount?.value);
            const guestCountRaw = String(previewGuestCount?.value || '').trim();
            if (!guestCountRaw) {
                setFieldError(previewGuestCountError, previewGuestCountField, 'Enter a party size.');
                previewGuestCount?.focus();
                return;
            }
            if (!Number.isFinite(guestCountValue) || guestCountValue < 0) {
                setFieldError(previewGuestCountError, previewGuestCountField, 'Enter a valid party size.');
                previewGuestCount?.focus();
                return;
            }

            const fullServiceConfig = FeesStore.getFullServiceConfig();
            const fullServiceEnabled = previewFullServiceToggle?.checked ?? true;
            let fullServiceMode = fullServiceConfig.mode === 'a_la_carte' ? 'bundle' : 'bundle';
            let aLaCarteComponents = [];

            if (fullServiceEnabled) {
                if (fullServiceConfig.mode === 'a_la_carte') {
                    fullServiceMode = previewFullServiceModeInput?.value || 'bundle';
                    if (fullServiceMode === 'a_la_carte' && previewALaCarteOptions) {
                        const configuredKeys = getConfiguredALaCarteComponents(fullServiceConfig);
                        aLaCarteComponents = Array.from(previewALaCarteOptions.querySelectorAll('input[type="checkbox"]:checked'))
                            .map(input => input.value)
                            .filter(key => configuredKeys.includes(key));
                        if (!aLaCarteComponents.length) {
                            setFieldError(previewALaCarteError, null, 'Select at least one a-la-carte item.');
                            return;
                        }
                    }
                } else {
                    fullServiceMode = 'bundle';
                }
            }

            const params = new URLSearchParams();
            params.set('subtotalCents', String(subtotalCents));
            params.set('guestCount', String(Math.round(guestCountValue)));
            params.set('fullServiceEnabled', fullServiceEnabled ? 'true' : 'false');
            if (fullServiceEnabled) {
                params.set('fullServiceMode', fullServiceMode);
            }
            if (previewEventType?.value) {
                params.set('eventTypeId', previewEventType.value);
            }
            if (aLaCarteComponents.length) {
                params.set('aLaCarteComponents', aLaCarteComponents.join(','));
            }
            const previewUrl = `preview-cart.html?${params.toString()}`;
            window.open(previewUrl, '_blank', 'noopener');
            closePreviewModal();
        });
    }

    updateStatusTags();
});
