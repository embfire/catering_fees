// Full-service fee configuration with mode selector
document.addEventListener('DOMContentLoaded', function() {
    const closeButton = document.querySelector('.close-button');
    const toggleButton = document.getElementById('full-service-toggle');
    const unsavedBar = document.getElementById('full-service-unsaved');
    const unsavedCancel = document.getElementById('full-service-cancel');
    const unsavedSave = document.getElementById('full-service-save');
    const deactivateDialog = document.getElementById('full-service-deactivate-dialog');
    const deactivateCancel = document.getElementById('full-service-deactivate-cancel');
    const deactivateConfirm = document.getElementById('full-service-deactivate-confirm');
    const modeButtons = Array.from(document.querySelectorAll('#full-service-mode .segment-button'));
    const modeSections = Array.from(document.querySelectorAll('.mode-section'));
    const aLaCarteError = document.getElementById('a-la-carte-error');
    const aLaCarteErrorText = aLaCarteError?.querySelector('.inline-error-text');
    const setSnackbarMessage = (message) => {
        try {
            window.sessionStorage.setItem('feesSnackbarMessage', message);
        } catch (error) {
            console.error('Unable to set snackbar message.', error);
        }
    };

    if (closeButton) {
        closeButton.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }

    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const parseCurrencyToCents = (value) => {
        const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return Math.round(numeric * 100);
    };

    const parsePercent = (value) => {
        const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return numeric;
    };

    const formatDollarInput = (input) => {
        if (!input) return;
        const rawValue = String(input.value || '').trim();
        if (!rawValue) return;
        const numeric = parseFloat(rawValue);
        if (!Number.isFinite(numeric)) return;
        input.value = numeric.toFixed(2);
    };

    const formatPercentInput = (input) => {
        if (!input) return;
        const rawValue = String(input.value || '').trim();
        if (!rawValue) return;
        const numeric = parseFloat(rawValue);
        if (!Number.isFinite(numeric)) return;
        input.value = String(numeric);
    };

    const setSelectedCalcType = (buttons, value, prefix, suffix) => {
        buttons.forEach(btn => {
            btn.classList.toggle('segment-selected', btn.dataset.value === value);
        });
        if (prefix) {
            prefix.textContent = '$';
            prefix.classList.toggle('is-hidden', value === 'percent');
        }
        if (suffix) {
            suffix.classList.toggle('is-hidden', value !== 'percent');
        }
    };

    const getSelectedCalcType = (buttons) => {
        const selected = buttons.find(btn => btn.classList.contains('segment-selected'));
        return selected ? selected.dataset.value : 'flat';
    };

    const getSelectedMode = () => {
        const selected = modeButtons.find(btn => btn.classList.contains('segment-selected'));
        return selected ? selected.dataset.value : 'bundle';
    };

    const setSelectedMode = (mode) => {
        modeButtons.forEach(btn => {
            btn.classList.toggle('segment-selected', btn.dataset.value === mode);
        });
        modeSections.forEach(section => {
            section.hidden = section.dataset.mode !== mode;
        });
    };

    const updateToggleLabel = (isActive) => {
        if (toggleButton) {
            toggleButton.textContent = isActive ? 'Deactivate' : 'Activate';
            toggleButton.className = isActive ? 'btn-secondary-destructive' : 'btn-activate';
        }
    };

    const openDeactivateDialog = () => {
        if (!deactivateDialog) return;
        deactivateDialog.classList.add('is-open');
        deactivateDialog.setAttribute('aria-hidden', 'false');
    };

    const closeDeactivateDialog = () => {
        if (!deactivateDialog) return;
        deactivateDialog.classList.remove('is-open');
        deactivateDialog.setAttribute('aria-hidden', 'true');
    };

    const cloneConfig = (config) => JSON.parse(JSON.stringify(config));
    const createEmptyRule = () => ({
        calcType: 'flat',
        amountCents: 0,
        percent: 0,
        active: false
    });
    const createEmptyConfig = () => ({
        mode: 'bundle',
        bundle: createEmptyRule(),
        components: {
            cutlery: createEmptyRule(),
            staffing: createEmptyRule(),
            setup: createEmptyRule(),
            cleanup: createEmptyRule()
        }
    });
    let savedConfig = cloneConfig(FeesStore.getFullServiceConfig());
    let draftConfig = cloneConfig(savedConfig);
    let isDirty = false;

    const bundleSection = document.querySelector('.mode-section[data-mode="bundle"]');
    const bundleCalcButtons = Array.from(bundleSection?.querySelectorAll('[data-field="calcType"] .segment-button') || []);
    const bundleAmountInput = bundleSection?.querySelector('#bundle-fee-amount');
    const bundleInputField = bundleSection?.querySelector('.input-field');
    const bundlePrefix = bundleSection?.querySelector('#bundle-fee-prefix');
    const bundleSuffix = bundleSection?.querySelector('#bundle-fee-suffix');
    const bundleError = bundleSection?.querySelector('#bundle-fee-error');

    const componentRows = Array.from(document.querySelectorAll('.a-la-carte-row'));
    const componentKeys = ['cutlery', 'staffing', 'setup', 'cleanup'];
    const componentRefs = componentRows.reduce((acc, row) => {
        const key = row.dataset.component;
        acc[key] = {
            row,
            calcButtons: Array.from(row.querySelectorAll('[data-field="calcType"] .segment-button')),
            amountInput: row.querySelector('[data-field="amount"]'),
            inputField: row.querySelector('.input-field'),
            prefix: row.querySelector('[data-field="prefix"]'),
            suffix: row.querySelector('[data-field="suffix"]'),
            error: row.querySelector('[data-field="error"]')
        };
        return acc;
    }, {});

    const setDirty = (dirty) => {
        isDirty = dirty;
        const showDirty = dirty && getActiveState(savedConfig);
        if (unsavedBar) {
            unsavedBar.classList.toggle('is-visible', showDirty);
        }
        document.body.classList.toggle('has-unsaved-bar', showDirty);
    };

    const clearError = (errorLabel, field) => {
        if (errorLabel) {
            errorLabel.textContent = '';
        }
        if (field) {
            field.classList.remove('input-error');
        }
    };

    const setError = (errorLabel, field, message) => {
        if (errorLabel) {
            errorLabel.textContent = message || '';
        }
        if (field && message) {
            field.classList.add('input-error');
        }
    };

    const validateRule = (rule) => {
        if (rule.calcType === 'percent') {
            if (!Number.isFinite(rule.percent) || rule.percent < 0 || rule.percent > 100) {
                return 'Percent must be between 0 and 100.';
            }
            return '';
        }
        if (!Number.isFinite(rule.amountCents) || rule.amountCents < 0) {
        return 'Add fee amount';
        }
        return '';
    };

    const isRuleConfigured = (rule) => {
        if (!rule) return false;
        if (rule.calcType === 'percent') {
            return Number.isFinite(rule.percent);
        }
        return Number.isFinite(rule.amountCents);
    };

    const normalizeRuleFromForm = (calcButtons, amountInput, existingRule) => {
        const calcType = getSelectedCalcType(calcButtons);
        const amountValue = calcType === 'percent'
            ? parsePercent(amountInput?.value)
            : parseCurrencyToCents(amountInput?.value);
        return {
            calcType,
            active: existingRule?.active ?? false,
            amountCents: calcType === 'percent' ? 0 : amountValue,
            percent: calcType === 'percent' ? amountValue : 0
        };
    };

    const applyRuleToForm = (rule, calcButtons, amountInput, prefix, suffix) => {
        setSelectedCalcType(calcButtons, rule.calcType || 'flat', prefix, suffix);
        if (!amountInput) return;
        if (rule.calcType === 'percent') {
            amountInput.value = rule.percent ?? '';
        } else {
            amountInput.value = rule.amountCents ? (rule.amountCents / 100).toFixed(2) : '';
        }
    };

    const readFormToDraft = () => {
        const mode = getSelectedMode();
        draftConfig.mode = mode;
        draftConfig.bundle = {
            ...draftConfig.bundle,
            ...normalizeRuleFromForm(bundleCalcButtons, bundleAmountInput, draftConfig.bundle)
        };
        Object.keys(componentRefs).forEach(key => {
            const ref = componentRefs[key];
            draftConfig.components[key] = {
                ...draftConfig.components[key],
                ...normalizeRuleFromForm(ref.calcButtons, ref.amountInput, draftConfig.components[key])
            };
        });
    };

    const isDraftDifferent = () => JSON.stringify(draftConfig) !== JSON.stringify(savedConfig);

    const getActiveState = (config) => {
        if (config.mode === 'a_la_carte') {
            return componentKeys.some(key => config.components?.[key]?.active);
        }
        return !!config.bundle?.active;
    };

    const setFormFromConfig = (config) => {
        setSelectedMode(config.mode || 'bundle');
        applyRuleToForm(config.bundle, bundleCalcButtons, bundleAmountInput, bundlePrefix, bundleSuffix);
        Object.keys(componentRefs).forEach(key => {
            const ref = componentRefs[key];
            const rule = config.components?.[key] || {};
            applyRuleToForm(rule, ref.calcButtons, ref.amountInput, ref.prefix, ref.suffix);
            clearError(ref.error, ref.inputField);
        });
        clearError(bundleError, bundleInputField);
        if (aLaCarteError) {
            aLaCarteError.hidden = true;
        }
        updateToggleLabel(getActiveState(config));
    };

    const loadState = () => {
        savedConfig = cloneConfig(FeesStore.getFullServiceConfig());
        draftConfig = cloneConfig(savedConfig);
        setFormFromConfig(draftConfig);
        setDirty(false);
    };

    if (bundleAmountInput && bundleInputField) {
        bundleAmountInput.addEventListener('focus', function() {
            bundleInputField.classList.add('input-focused');
        });

        bundleAmountInput.addEventListener('blur', function() {
            bundleInputField.classList.remove('input-focused');
            const calcType = getSelectedCalcType(bundleCalcButtons);
            if (calcType !== 'percent') {
                formatDollarInput(bundleAmountInput);
            }
        });

        bundleAmountInput.addEventListener('input', function() {
            clearError(bundleError, bundleInputField);
            readFormToDraft();
            setDirty(isDraftDifferent());
        });
    }

    bundleCalcButtons.forEach(button => {
        button.addEventListener('click', function() {
            setSelectedCalcType(bundleCalcButtons, this.dataset.value, bundlePrefix, bundleSuffix);
            if (this.dataset.value === 'percent') {
                formatPercentInput(bundleAmountInput);
            } else {
                formatDollarInput(bundleAmountInput);
            }
            readFormToDraft();
            setDirty(isDraftDifferent());
        });
    });

    Object.values(componentRefs).forEach(ref => {
        if (ref.amountInput && ref.inputField) {
            ref.amountInput.addEventListener('focus', () => ref.inputField.classList.add('input-focused'));
            ref.amountInput.addEventListener('blur', () => {
                ref.inputField.classList.remove('input-focused');
                const calcType = getSelectedCalcType(ref.calcButtons);
                if (calcType !== 'percent') {
                    formatDollarInput(ref.amountInput);
                }
            });
            ref.amountInput.addEventListener('input', () => {
                clearError(ref.error, ref.inputField);
                if (aLaCarteError) {
                    aLaCarteError.hidden = true;
                }
                readFormToDraft();
                setDirty(isDraftDifferent());
            });
        }

        ref.calcButtons.forEach(button => {
            button.addEventListener('click', () => {
                setSelectedCalcType(ref.calcButtons, button.dataset.value, ref.prefix, ref.suffix);
                if (button.dataset.value === 'percent') {
                    formatPercentInput(ref.amountInput);
                } else {
                    formatDollarInput(ref.amountInput);
                }
                readFormToDraft();
                setDirty(isDraftDifferent());
            });
        });
    });

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            setSelectedMode(button.dataset.value);
            readFormToDraft();
            setDirty(isDraftDifferent());
        });
    });

    const validateCurrentConfig = () => {
        let isValid = true;
        readFormToDraft();
        clearError(bundleError, bundleInputField);
        if (aLaCarteError) {
            aLaCarteError.hidden = true;
        }

        if (draftConfig.mode === 'bundle') {
            const message = validateRule(draftConfig.bundle);
            if (message) {
                setError(bundleError, bundleInputField, message);
                isValid = false;
            }
            return isValid;
        }

        let configuredCount = 0;
        componentKeys.forEach(key => {
            const ref = componentRefs[key];
            const rule = draftConfig.components[key];
            if (!isRuleConfigured(rule)) {
                clearError(ref.error, ref.inputField);
                return;
            }
            configuredCount += 1;
            const message = validateRule(rule);
            if (message) {
                setError(ref.error, ref.inputField, message);
                isValid = false;
            }
        });
        if (configuredCount === 0) {
            isValid = false;
            if (aLaCarteErrorText) {
                aLaCarteErrorText.textContent = 'Configure at least one service.';
            }
            if (aLaCarteError) {
                aLaCarteError.hidden = false;
            }
        }
        return isValid;
    };

    const activateCurrentConfig = () => {
        if (draftConfig.mode === 'bundle') {
            draftConfig.bundle.active = true;
            return;
        }
        componentKeys.forEach(key => {
            const rule = draftConfig.components[key];
            if (rule) {
                rule.active = isRuleConfigured(rule);
            }
        });
    };

    const deactivateCurrentConfig = () => {
        if (draftConfig.mode === 'bundle') {
            draftConfig.bundle.active = false;
            return;
        }
        componentKeys.forEach(key => {
            if (draftConfig.components[key]) {
                draftConfig.components[key].active = false;
            }
        });
    };

    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            if (!getActiveState(savedConfig)) {
                if (!validateCurrentConfig()) {
                    return;
                }
                activateCurrentConfig();
                try {
                    FeesStore.updateFullServiceConfig(draftConfig);
                    savedConfig = cloneConfig(draftConfig);
                    updateToggleLabel(true);
                    setDirty(false);
                    setSnackbarMessage('Fee successfully activated');
                    window.location.href = 'index.html';
                } catch (error) {
                    setError(bundleError, bundleInputField, error.message || 'Unable to save full-service fee.');
                }
                return;
            }

            openDeactivateDialog();
        });
    }

    if (deactivateCancel) {
        deactivateCancel.addEventListener('click', closeDeactivateDialog);
    }
    if (deactivateConfirm) {
        deactivateConfirm.addEventListener('click', () => {
            draftConfig = createEmptyConfig();
            FeesStore.updateFullServiceConfig(draftConfig);
            savedConfig = cloneConfig(draftConfig);
            updateToggleLabel(false);
            setDirty(false);
            closeDeactivateDialog();
            setSnackbarMessage('Fee deactivated');
            window.location.href = 'index.html';
        });
    }

    if (unsavedSave) {
        unsavedSave.addEventListener('click', () => {
            if (!validateCurrentConfig()) {
                return;
            }
            activateCurrentConfig();
            try {
                FeesStore.updateFullServiceConfig(draftConfig);
                savedConfig = cloneConfig(draftConfig);
                setDirty(false);
                updateToggleLabel(true);
            } catch (error) {
                setError(bundleError, bundleInputField, error.message || 'Unable to save full-service fee.');
            }
        });
    }

    if (unsavedCancel) {
        unsavedCancel.addEventListener('click', () => {
            draftConfig = cloneConfig(savedConfig);
            setFormFromConfig(draftConfig);
            setDirty(false);
        });
    }

    loadState();
});
