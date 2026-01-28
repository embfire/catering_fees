document.addEventListener('DOMContentLoaded', function() {
    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const closeButton = document.querySelector('.close-button');
    const addRangeButton = document.getElementById('add-range');
    const toggleButton = document.getElementById('guest-count-toggle');
    const unsavedBar = document.getElementById('guest-count-unsaved');
    const unsavedCancel = document.getElementById('guest-count-cancel');
    const unsavedSave = document.getElementById('guest-count-save');
    const modal = document.getElementById('guest-range-modal');
    const modalTitle = document.getElementById('guest-range-title');
    const modalClose = modal.querySelector('.modal-close');
    const modalCancel = document.getElementById('guest-range-cancel');
    const modalForm = document.getElementById('guest-range-form');
    const minError = document.getElementById('min-guests-error');
    const maxError = document.getElementById('max-guests-error');
    const amountError = document.getElementById('guest-amount-error');
    const activationDialog = document.getElementById('guest-activation-dialog');
    const activationOk = document.getElementById('guest-activation-ok');
    const openEndedDialog = document.getElementById('guest-open-ended-dialog');
    const openEndedOk = document.getElementById('guest-open-ended-ok');
    const deactivateDialog = document.getElementById('guest-deactivate-dialog');
    const deactivateCancel = document.getElementById('guest-deactivate-cancel');
    const deactivateConfirm = document.getElementById('guest-deactivate-confirm');
    const minInput = document.getElementById('min-guests');
    const maxInput = document.getElementById('max-guests');
    const calcButtons = Array.from(document.querySelectorAll('#guest-count-calc-type .segment-button'));
    const calcHint = document.getElementById('guest-count-calc-hint');
    const amountInput = document.getElementById('guest-amount');
    const amountPrefix = document.getElementById('guest-amount-prefix');
    const amountSuffix = document.getElementById('guest-amount-suffix');
    const amountField = amountInput.closest('.input-field');
    const tableBody = document.getElementById('guest-range-body');
    const rangeInfo = document.getElementById('guest-range-info');

    const formatCurrency = (cents) => `$${(cents / 100).toFixed(2)}`;
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

    const clone = (value) => JSON.parse(JSON.stringify(value));
    let savedRules = clone(FeesStore.getGuestCountRules());
    let savedSettings = { ...FeesStore.getSettings() };
    let draftRules = savedSettings.guestCountActive ? clone(savedRules) : [];
    let draftSettings = { ...savedSettings };
    let isDirty = false;

    const normalizeRules = (rules) => clone(rules).map(rule => ({
        id: rule.id,
        minGuests: rule.minGuests,
        maxGuests: rule.maxGuests,
        calcType: rule.calcType,
        amountCents: rule.amountCents,
        percent: rule.percent,
        active: rule.active
    })).sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const setDirty = (dirty) => {
        isDirty = dirty;
        if (unsavedBar) {
            unsavedBar.classList.toggle('is-visible', dirty);
        }
        document.body.classList.toggle('has-unsaved-bar', dirty);
    };

    const computeDirty = () => {
        if (!savedSettings.guestCountActive) {
            return false;
        }
        if (draftSettings.guestCountCalcType !== savedSettings.guestCountCalcType) {
            return true;
        }
        return JSON.stringify(normalizeRules(draftRules)) !== JSON.stringify(normalizeRules(savedRules));
    };

    const updateToggleLabel = (isActive) => {
        if (toggleButton) {
            toggleButton.textContent = isActive ? 'Deactivate' : 'Activate';
            toggleButton.className = isActive ? 'btn-secondary-destructive' : 'btn-activate';
        }
    };

    const setSelectedButton = (buttons, value) => {
        buttons.forEach(button => {
            button.classList.toggle('segment-selected', button.dataset.value === value || button.dataset.policy === value);
        });
    };

    const getSelectedCalcType = () => {
        const selected = calcButtons.find(button => button.classList.contains('segment-selected'));
        return selected ? selected.dataset.value : 'flat';
    };

    const updatePrefix = () => {
        const calcType = draftSettings.guestCountCalcType || getSelectedCalcType();
        if (amountPrefix) {
            amountPrefix.textContent = '$';
            amountPrefix.classList.toggle('is-hidden', calcType === 'percent');
        }
        if (amountSuffix) {
            amountSuffix.classList.toggle('is-hidden', calcType !== 'percent');
        }
    };

    const updateCalcHint = (prevType, nextType) => {
        if (!calcHint) return;
        if (!draftRules.length) {
            calcHint.textContent = '';
            return;
        }
        if (prevType !== nextType && (prevType === 'percent' || nextType === 'percent')) {
            calcHint.textContent = 'Percent values may need review after switching calculation type.';
            return;
        }
        calcHint.textContent = '';
    };

    const convertRulesForCalcType = (fromType, toType) => {
        if (fromType === toType) return;
        draftRules = draftRules.map(rule => {
            const updated = { ...rule };
            if (toType === 'percent') {
                updated.percent = Number.isFinite(updated.percent) ? updated.percent : 0;
            } else {
                updated.amountCents = Number.isFinite(updated.amountCents) ? updated.amountCents : 0;
            }
            return updated;
        });
    };

    const saveDraftToStore = (active) => {
        const store = FeesStore.loadStore();
        store.guestCountRules = clone(draftRules);
        store.settings = {
            ...store.settings,
            guestCountActive: active,
            guestCountCalcType: draftSettings.guestCountCalcType
        };
        FeesStore.saveStore(store);
        savedRules = clone(store.guestCountRules);
        savedSettings = { ...store.settings };
        draftRules = clone(savedRules);
        draftSettings = { ...savedSettings };
        updateToggleLabel(savedSettings.guestCountActive);
        renderTable();
    };

    const clearFieldErrors = () => {
        if (minError) minError.textContent = '';
        if (maxError) maxError.textContent = '';
        if (amountError) amountError.textContent = '';
    };

    const openModal = (rule) => {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        clearFieldErrors();
        minInput.classList.remove('input-error');
        maxInput.classList.remove('input-error');
        amountInput.classList.remove('input-error');
        if (amountField) {
            amountField.classList.remove('input-error');
        }

        if (rule) {
            modalTitle.textContent = 'Edit guest range';
            modal.dataset.editingId = rule.id;
            minInput.value = rule.minGuests ?? '';
            maxInput.value = rule.maxGuests ?? '';
            setSelectedButton(calcButtons, draftSettings.guestCountCalcType || 'flat');
            if (draftSettings.guestCountCalcType === 'percent') {
                amountInput.value = rule.percent ?? '';
            } else {
                amountInput.value = rule.amountCents ? (rule.amountCents / 100).toFixed(2) : '';
            }
        } else {
            modalTitle.textContent = 'Add guest range';
            modal.dataset.editingId = '';
            minInput.value = '';
            maxInput.value = '';
            setSelectedButton(calcButtons, draftSettings.guestCountCalcType || 'flat');
            amountInput.value = '';

            const ranges = clone(draftRules).sort((a, b) => Number(a.minGuests) - Number(b.minGuests));
            if (!ranges.length) {
                minInput.value = '1';
            } else {
                const last = ranges[ranges.length - 1];
                const lastMax = Number(last.maxGuests);
                if (Number.isFinite(lastMax)) {
                    minInput.value = String(lastMax + 1);
                }
            }
        }

        updatePrefix();
        minInput.focus();
    };

    const closeModal = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        clearFieldErrors();
        minInput.classList.remove('input-error');
        maxInput.classList.remove('input-error');
        amountInput.classList.remove('input-error');
        if (amountField) {
            amountField.classList.remove('input-error');
        }
    };

    const openActivationDialog = () => {
        if (!activationDialog) return;
        activationDialog.classList.add('is-open');
        activationDialog.setAttribute('aria-hidden', 'false');
    };

    const closeActivationDialog = () => {
        if (!activationDialog) return;
        activationDialog.classList.remove('is-open');
        activationDialog.setAttribute('aria-hidden', 'true');
    };

    const openOpenEndedDialog = () => {
        if (!openEndedDialog) return;
        openEndedDialog.classList.add('is-open');
        openEndedDialog.setAttribute('aria-hidden', 'false');
    };

    const closeOpenEndedDialog = () => {
        if (!openEndedDialog) return;
        openEndedDialog.classList.remove('is-open');
        openEndedDialog.setAttribute('aria-hidden', 'true');
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

    const renderTable = () => {
        const ranges = clone(draftRules)
            .sort((a, b) => Number(a.minGuests) - Number(b.minGuests));
        tableBody.innerHTML = '';
        if (rangeInfo) {
            rangeInfo.textContent = '';
        }

        if (!ranges.length) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="3" class="empty-cell">No guest count ranges added yet.</td>';
            tableBody.appendChild(emptyRow);
            return;
        }

        const hasOpenEnded = ranges.some(range => range.maxGuests === null || range.maxGuests === '');
        if (!hasOpenEnded && rangeInfo) {
            rangeInfo.textContent = 'No open-ended range set. We will apply the fee from the last range for guest counts above it.';
        }

        ranges.forEach(range => {
            const row = document.createElement('tr');
            row.dataset.id = range.id;

            const rangeLabel = range.maxGuests === null || range.maxGuests === ''
                ? `${range.minGuests}+`
                : `${range.minGuests}-${range.maxGuests}`;
            const amountLabel = draftSettings.guestCountCalcType === 'percent'
                ? `${range.percent || 0}%`
                : `${formatCurrency(range.amountCents || 0)}${draftSettings.guestCountCalcType === 'perPerson' ? ' / person' : ''}`;

            row.innerHTML = `
                <td>${rangeLabel}</td>
                <td>${amountLabel}</td>
                <td class="cell-action">
                    <div class="action-buttons">
                        <button class="btn-delete" type="button" data-action="delete" aria-label="Delete">
                            <i class="ph ph-trash icon-16" aria-hidden="true"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    closeButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    addRangeButton.addEventListener('click', () => {
        const ranges = clone(draftRules).sort((a, b) => Number(a.minGuests) - Number(b.minGuests));
        const openEnded = ranges.find(item => item.maxGuests === null || item.maxGuests === '');
        if (openEnded) {
            openOpenEndedDialog();
            return;
        }
        openModal(null);
    });
    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    if (activationOk) {
        activationOk.addEventListener('click', closeActivationDialog);
    }
    if (openEndedOk) {
        openEndedOk.addEventListener('click', closeOpenEndedDialog);
    }
    if (deactivateCancel) {
        deactivateCancel.addEventListener('click', closeDeactivateDialog);
    }
    if (deactivateConfirm) {
        deactivateConfirm.addEventListener('click', () => {
            draftRules = clone(savedRules);
            draftSettings = { ...savedSettings, guestCountActive: false };
            saveDraftToStore(false);
            setDirty(false);
            closeDeactivateDialog();
            window.location.href = 'index.html';
        });
    }

    calcButtons.forEach(button => {
        button.addEventListener('click', () => {
            const prevType = draftSettings.guestCountCalcType || getSelectedCalcType();
            const nextType = button.dataset.value;
            setSelectedButton(calcButtons, nextType);
            draftSettings.guestCountCalcType = nextType;
            convertRulesForCalcType(prevType, nextType);
            updateCalcHint(prevType, nextType);
            updatePrefix();
            if (nextType === 'percent') {
                formatPercentInput(amountInput);
            } else {
                formatDollarInput(amountInput);
            }
            renderTable();
            setDirty(computeDirty());
        });
    });

    modalForm.addEventListener('submit', (event) => {
        event.preventDefault();
        clearFieldErrors();
        minInput.classList.remove('input-error');
        maxInput.classList.remove('input-error');
        amountInput.classList.remove('input-error');
        if (amountField) {
            amountField.classList.remove('input-error');
        }

        if (minInput.value === '') {
            minInput.classList.add('input-error');
            if (minError) minError.textContent = 'Add a From value';
            return;
        }

        const calcType = draftSettings.guestCountCalcType || getSelectedCalcType();
        const amountValue = calcType === 'percent'
            ? parsePercent(amountInput.value)
            : parseCurrencyToCents(amountInput.value);

        const existingRule = draftRules.find(item => item.id === modal.dataset.editingId);
        const existingAmount = existingRule?.amountCents;
        const existingPercent = existingRule?.percent;
        const rule = {
            id: modal.dataset.editingId || undefined,
            minGuests: minInput.value,
            maxGuests: maxInput.value === '' ? null : maxInput.value,
            calcType,
            amountCents: calcType === 'percent'
                ? (Number.isFinite(existingAmount) ? existingAmount : 0)
                : amountValue,
            percent: calcType === 'percent'
                ? amountValue
                : (Number.isFinite(existingPercent) ? existingPercent : 0),
            active: true
        };

        try {
            const validation = FeesStore.validateGuestCountRule(rule, { guestCountRules: draftRules });
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            const index = draftRules.findIndex(item => item.id === rule.id);
            if (index >= 0) {
                draftRules[index] = rule;
            } else {
                rule.id = rule.id || `guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                draftRules.push(rule);
            }
            renderTable();
            closeModal();
            setDirty(computeDirty());
        } catch (error) {
            const message = error.message || 'Unable to save range.';
            const lower = message.toLowerCase();
            if (lower.includes('minimum')) {
                minInput.classList.add('input-error');
                if (minError) minError.textContent = message;
            }
            if (lower.includes('maximum')) {
                maxInput.classList.add('input-error');
                if (maxError) maxError.textContent = message;
            }
            if (lower.includes('percent') || lower.includes('amount')) {
                amountInput.classList.add('input-error');
                if (amountField) {
                    amountField.classList.add('input-error');
                }
                if (amountError) amountError.textContent = message;
            }
            if (lower.includes('overlap')) {
                minInput.classList.add('input-error');
                maxInput.classList.add('input-error');
                if (minError) minError.textContent = message;
            }
            if (lower.includes('continuous') || lower.includes('open-ended') || lower.includes('first range')) {
                minInput.classList.add('input-error');
                maxInput.classList.add('input-error');
                if (minError) minError.textContent = message;
            }
        }
    });

    [minInput, maxInput, amountInput].forEach((field) => {
        field.addEventListener('input', () => {
            if (field === minInput && minError) minError.textContent = '';
            if (field === maxInput && maxError) maxError.textContent = '';
            if (field === amountInput && amountError) amountError.textContent = '';
            field.classList.remove('input-error');
            if (amountField && field === amountInput) {
                amountField.classList.remove('input-error');
            }
        });
        field.addEventListener('blur', () => {
            if (field === amountInput) {
                const calcType = draftSettings.guestCountCalcType || getSelectedCalcType();
                if (calcType !== 'percent') {
                    formatDollarInput(field);
                }
            }
        });
    });

    tableBody.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row) return;
        const ruleId = row.dataset.id;
        if (!ruleId) return;

        const button = event.target.closest('button');
        if (button && button.dataset.action === 'delete') {
            const rule = draftRules.find(item => item.id === ruleId);
            if (rule && confirm('Are you sure you want to delete this guest range?')) {
                draftRules = draftRules.filter(item => item.id !== ruleId);
                renderTable();
                setDirty(computeDirty());
            }
            return;
        }

        const rule = draftRules.find(item => item.id === ruleId);
        if (rule) {
            openModal(rule);
        }
    });

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            if (!savedSettings.guestCountActive) {
                if (!draftRules.length) {
                    openActivationDialog();
                    return;
                }
                saveDraftToStore(true);
                setDirty(false);
                window.location.href = 'index.html';
                return;
            }
            openDeactivateDialog();
        });
    }

    if (unsavedSave) {
        unsavedSave.addEventListener('click', () => {
            if (!draftRules.length) {
                openActivationDialog();
                return;
            }
            saveDraftToStore(true);
            setDirty(false);
        });
    }

    if (unsavedCancel) {
        unsavedCancel.addEventListener('click', () => {
            draftRules = clone(savedRules);
            draftSettings = { ...savedSettings };
            setSelectedButton(calcButtons, draftSettings.guestCountCalcType || 'flat');
            updateCalcHint(draftSettings.guestCountCalcType, draftSettings.guestCountCalcType);
            updatePrefix();
            renderTable();
            setDirty(false);
        });
    }

    draftSettings.guestCountCalcType = savedSettings.guestCountCalcType || 'flat';
    setSelectedButton(calcButtons, draftSettings.guestCountCalcType);
    updateCalcHint(draftSettings.guestCountCalcType, draftSettings.guestCountCalcType);
    updatePrefix();
    updateToggleLabel(!!savedSettings.guestCountActive);
    renderTable();
});
