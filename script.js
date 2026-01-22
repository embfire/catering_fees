// Full-service fee configuration with unsaved changes bar
document.addEventListener('DOMContentLoaded', function() {
    const segmentButtons = Array.from(document.querySelectorAll('.segment-button'));
    const textInput = document.querySelector('.text-input');
    const inputField = document.querySelector('.input-field');
    const closeButton = document.querySelector('.close-button');
    const toggleButton = document.getElementById('full-service-toggle');
    const unsavedBar = document.getElementById('full-service-unsaved');
    const unsavedCancel = document.getElementById('full-service-cancel');
    const unsavedSave = document.getElementById('full-service-save');
    const prefixLabel = document.getElementById('fee-prefix');
    const suffixLabel = document.getElementById('fee-suffix');
    const errorLabel = document.getElementById('full-service-error');
    const hintLabel = document.getElementById('fee-hint');
    const deactivateDialog = document.getElementById('full-service-deactivate-dialog');
    const deactivateCancel = document.getElementById('full-service-deactivate-cancel');
    const deactivateConfirm = document.getElementById('full-service-deactivate-confirm');

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

    const setSelectedCalcType = (value) => {
        segmentButtons.forEach(btn => {
            btn.classList.toggle('segment-selected', btn.dataset.value === value);
        });
        if (prefixLabel) {
            prefixLabel.textContent = '$';
            prefixLabel.classList.toggle('is-hidden', value === 'percent');
        }
        if (suffixLabel) {
            suffixLabel.classList.toggle('is-hidden', value !== 'percent');
        }
        if (hintLabel) {
            hintLabel.textContent = value === 'percent'
                ? 'Percent of subtotal charged'
                : value === 'perPerson'
                    ? 'Amount charged per person'
                    : 'Fixed amount charged';
        }
    };

    const getSelectedCalcType = () => {
        const selected = segmentButtons.find(btn => btn.classList.contains('segment-selected'));
        return selected ? selected.dataset.value : 'flat';
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

    const cloneRule = (rule) => JSON.parse(JSON.stringify(rule));
    let savedRule = cloneRule(FeesStore.getFullServiceRule());
    let draftRule = cloneRule(savedRule);
    let isDirty = false;

    const setDirty = (dirty) => {
        isDirty = dirty;
        if (unsavedBar) {
            unsavedBar.classList.toggle('is-visible', dirty);
        }
        document.body.classList.toggle('has-unsaved-bar', dirty);
    };

    const setFormFromRule = (rule) => {
        setSelectedCalcType(rule.calcType || 'flat');
        if (!rule.active) {
            textInput.value = '';
            return;
        }
        if (rule.calcType === 'percent') {
            textInput.value = rule.percent ?? '';
        } else {
            textInput.value = rule.amountCents ? (rule.amountCents / 100).toFixed(2) : '';
        }
    };

    const readFormToDraft = () => {
        const calcType = getSelectedCalcType();
        const amountValue = calcType === 'percent'
            ? parsePercent(textInput.value)
            : parseCurrencyToCents(textInput.value);
        draftRule = {
            ...draftRule,
            calcType,
            amountCents: calcType === 'percent' ? 0 : amountValue,
            percent: calcType === 'percent' ? amountValue : 0
        };
    };

    const isDraftDifferent = () => JSON.stringify({
        calcType: draftRule.calcType,
        amountCents: draftRule.amountCents,
        percent: draftRule.percent
    }) !== JSON.stringify({
        calcType: savedRule.calcType,
        amountCents: savedRule.amountCents,
        percent: savedRule.percent
    });

    const loadState = () => {
        savedRule = cloneRule(FeesStore.getFullServiceRule());
        draftRule = cloneRule(savedRule);
        setFormFromRule(draftRule);
        updateToggleLabel(!!savedRule.active);
        setDirty(false);
    };

    if (textInput && inputField) {
        textInput.addEventListener('focus', function() {
            inputField.classList.add('input-focused');
        });

        textInput.addEventListener('blur', function() {
            inputField.classList.remove('input-focused');
            const calcType = getSelectedCalcType();
            if (calcType !== 'percent') {
                formatDollarInput(textInput);
            }
        });

        textInput.addEventListener('input', function() {
            inputField.classList.remove('input-error');
            if (errorLabel) {
                errorLabel.textContent = '';
            }
            readFormToDraft();
            if (savedRule.active) {
                setDirty(isDraftDifferent());
            }
        });
    }

    segmentButtons.forEach(button => {
        button.addEventListener('click', function() {
            setSelectedCalcType(this.dataset.value);
            if (this.dataset.value === 'percent') {
                formatPercentInput(textInput);
            } else {
                formatDollarInput(textInput);
            }
            readFormToDraft();
            if (savedRule.active) {
                setDirty(isDraftDifferent());
            }
        });
    });

    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            errorLabel.textContent = '';
            if (inputField) {
                inputField.classList.remove('input-error');
            }

            if (!savedRule.active) {
                readFormToDraft();
                const updatedRule = {
                    ...draftRule,
                    active: true
                };
                try {
                    FeesStore.updateFullServiceRule(updatedRule);
                    savedRule = cloneRule(updatedRule);
                    draftRule = cloneRule(updatedRule);
                    updateToggleLabel(true);
                    setDirty(false);
                    window.location.href = 'index.html';
                } catch (error) {
                    errorLabel.textContent = error.message || 'Unable to save full-service fee.';
                    if (inputField) {
                        inputField.classList.add('input-error');
                    }
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
            draftRule = cloneRule(savedRule);
            setFormFromRule(draftRule);
            const updatedRule = {
                ...savedRule,
                active: false
            };
            FeesStore.updateFullServiceRule(updatedRule);
            savedRule = cloneRule(updatedRule);
            updateToggleLabel(false);
            setDirty(false);
            closeDeactivateDialog();
            window.location.href = 'index.html';
        });
    }

    if (unsavedSave) {
        unsavedSave.addEventListener('click', () => {
            errorLabel.textContent = '';
            if (inputField) {
                inputField.classList.remove('input-error');
            }
            const updatedRule = {
                ...draftRule,
                active: true
            };
            try {
                FeesStore.updateFullServiceRule(updatedRule);
                savedRule = cloneRule(updatedRule);
                draftRule = cloneRule(updatedRule);
                setDirty(false);
            } catch (error) {
                errorLabel.textContent = error.message || 'Unable to save full-service fee.';
                if (inputField) {
                    inputField.classList.add('input-error');
                }
            }
        });
    }

    if (unsavedCancel) {
        unsavedCancel.addEventListener('click', () => {
            draftRule = cloneRule(savedRule);
            setFormFromRule(draftRule);
            setDirty(false);
        });
    }

    loadState();
});
