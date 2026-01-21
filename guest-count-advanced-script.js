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
    const calcButtons = Array.from(document.querySelectorAll('#guest-count-calc-type .segment-button'));
    const amountHeader = document.getElementById('guest-amount-header');
    const tableBody = document.getElementById('guest-range-body');
    const activationDialog = document.getElementById('guest-activation-dialog');
    const activationOk = document.getElementById('guest-activation-ok');
    const activationBody = document.getElementById('guest-activation-body');
    const openEndedDialog = document.getElementById('guest-open-ended-dialog');
    const openEndedOk = document.getElementById('guest-open-ended-ok');
    const deactivateDialog = document.getElementById('guest-deactivate-dialog');
    const deactivateCancel = document.getElementById('guest-deactivate-cancel');
    const deactivateConfirm = document.getElementById('guest-deactivate-confirm');

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
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const normalizeRules = (rules) => clone(rules).map(rule => ({
        id: rule.id,
        minGuests: rule.minGuests,
        maxGuests: rule.maxGuests,
        calcType: rule.calcType,
        amountCents: rule.amountCents,
        percent: rule.percent,
        active: rule.active
    })).sort((a, b) => String(a.id).localeCompare(String(b.id)));

    let savedRules = clone(FeesStore.getGuestCountRules());
    let savedSettings = { ...FeesStore.getSettings() };
    let draftRules = savedSettings.guestCountActive ? clone(savedRules) : [];
    let draftSettings = { ...savedSettings };
    let isDirty = false;

    const setDirty = (dirty) => {
        isDirty = dirty;
        if (!savedSettings.guestCountActive) {
            if (unsavedBar) {
                unsavedBar.classList.remove('is-visible');
            }
            document.body.classList.remove('has-unsaved-bar');
            return;
        }
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
        const currentRules = getRulesFromTable();
        return JSON.stringify(normalizeRules(currentRules)) !== JSON.stringify(normalizeRules(savedRules));
    };

    const updateToggleLabel = (isActive) => {
        if (toggleButton) {
            toggleButton.textContent = isActive ? 'Deactivate' : 'Activate';
            toggleButton.className = isActive ? 'btn-secondary-destructive' : 'btn-activate';
        }
    };

    const setSelectedButton = (buttons, value) => {
        buttons.forEach(button => {
            button.classList.toggle('segment-selected', button.dataset.value === value);
        });
    };

    const getSelectedCalcType = () => {
        const selected = calcButtons.find(button => button.classList.contains('segment-selected'));
        return selected ? selected.dataset.value : 'flat';
    };

    const updateCalcCopy = () => {
        const calcType = draftSettings.guestCountCalcType || getSelectedCalcType();
        if (amountHeader) {
            amountHeader.textContent = calcType === 'percent'
                ? 'FEE %'
                : calcType === 'perPerson'
                    ? 'FEE / PERSON'
                    : 'FLAT FEE';
        }
    };

    const openActivationDialog = (message) => {
        if (!activationDialog) return;
        if (activationBody && message) {
            activationBody.textContent = message;
        }
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

    const clearRowErrors = (row) => {
        row.querySelectorAll('.form-error').forEach(element => {
            element.textContent = '';
        });
        row.querySelectorAll('.input-field').forEach(field => {
            field.classList.remove('input-error');
        });
    };

    const setRowError = (row, selector, message) => {
        const error = row.querySelector(selector);
        if (error) {
            error.textContent = message;
        }
    };

    const buildRow = (rule = {}) => {
        const row = document.createElement('tr');
        row.className = 'range-row';
        row.dataset.id = rule.id || '';
        row.innerHTML = `
            <td>
                <div class="input-field input-field-compact">
                    <input type="number" class="text-input range-input" data-field="min" min="0" step="1" value="${rule.minGuests ?? ''}">
                </div>
                <p class="form-error range-error" data-error="min"></p>
            </td>
            <td>
                <div class="input-field input-field-compact">
                    <input type="number" class="text-input range-input" data-field="max" min="0" step="1" value="${rule.maxGuests ?? ''}" placeholder="∞">
                </div>
                <p class="form-error range-error" data-error="max"></p>
            </td>
            <td>
                <div class="input-field input-field-compact">
                    <span class="input-prefix ${getSelectedCalcType() === 'percent' ? 'is-hidden' : ''}">$</span>
                    <input type="number" class="text-input range-input" data-field="amount" min="0" step="0.01" value="">
                    <span class="input-suffix ${getSelectedCalcType() === 'percent' ? '' : 'is-hidden'}">%</span>
                </div>
                <p class="form-error range-error" data-error="amount"></p>
            </td>
            <td class="cell-action">
                <div class="action-buttons">
                    <button class="btn-delete" type="button" data-action="delete" aria-label="Delete">
                        <i class="ph ph-trash icon-16" aria-hidden="true"></i>
                    </button>
                </div>
            </td>
        `;
        const amountInput = row.querySelector('[data-field="amount"]');
        if (amountInput) {
            if (draftSettings.guestCountCalcType === 'percent') {
                amountInput.value = Number.isFinite(rule.percent) ? rule.percent : '';
                amountInput.step = '0.1';
            } else {
                amountInput.value = Number.isFinite(rule.amountCents) ? (rule.amountCents / 100).toFixed(2) : '';
                amountInput.step = '0.01';
            }
        }
        return row;
    };

    const renderTable = () => {
        tableBody.innerHTML = '';
        const ranges = clone(draftRules).sort((a, b) => Number(a.minGuests) - Number(b.minGuests));
        if (!ranges.length) {
            return;
        }
        ranges.forEach(rule => {
            tableBody.appendChild(buildRow(rule));
        });
    };

    const getRulesFromTable = () => {
        const calcType = draftSettings.guestCountCalcType || getSelectedCalcType();
        return Array.from(tableBody.querySelectorAll('.range-row')).map(row => {
            const minValue = row.querySelector('[data-field="min"]').value;
            const maxValue = row.querySelector('[data-field="max"]').value;
            const amountValue = row.querySelector('[data-field="amount"]').value;
            return {
                id: row.dataset.id || undefined,
                minGuests: minValue,
                maxGuests: maxValue === '' ? null : maxValue,
                calcType,
                amountCents: calcType === 'percent' ? 0 : parseCurrencyToCents(amountValue),
                percent: calcType === 'percent' ? parsePercent(amountValue) : 0,
                active: true
            };
        });
    };

    const validateRules = () => {
        const rows = Array.from(tableBody.querySelectorAll('.range-row'));
        const rules = getRulesFromTable();
        rows.forEach(clearRowErrors);

        let valid = true;
        const parsed = rules.map(rule => ({
            min: Number(rule.minGuests),
            max: rule.maxGuests === null ? null : Number(rule.maxGuests),
            amountCents: rule.amountCents,
            percent: rule.percent
        }));

        rows.forEach((row, index) => {
            const rule = rules[index];
            const data = parsed[index];
            if (rule.minGuests === '') {
                setRowError(row, '[data-error="min"]', 'From cannot be empty.');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
                return;
            }
            if (!Number.isFinite(data.min) || data.min < 0) {
                setRowError(row, '[data-error="min"]', 'Minimum guests must be 0 or greater.');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (Number.isFinite(data.min) && !Number.isInteger(data.min)) {
                setRowError(row, '[data-error="min"]', 'Minimum guests must be a whole number.');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (data.max !== null && (!Number.isFinite(data.max) || data.max < data.min)) {
                setRowError(row, '[data-error="max"]', 'Maximum guests must be greater than or equal to minimum.');
                row.querySelector('[data-field="max"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (data.max !== null && Number.isFinite(data.max) && !Number.isInteger(data.max)) {
                setRowError(row, '[data-error="max"]', 'Maximum guests must be a whole number.');
                row.querySelector('[data-field="max"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (draftSettings.guestCountCalcType === 'percent') {
                if (!Number.isFinite(data.percent) || data.percent < 0 || data.percent > 100) {
                    setRowError(row, '[data-error="amount"]', 'Percent must be between 0 and 100.');
                    row.querySelector('[data-field="amount"]').closest('.input-field').classList.add('input-error');
                    valid = false;
                }
            } else if (!Number.isFinite(data.amountCents) || data.amountCents < 0) {
                setRowError(row, '[data-error="amount"]', 'Amount must be 0 or greater.');
                row.querySelector('[data-field="amount"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
        });

        if (!valid) {
            return { valid: false };
        }

        const ordered = parsed
            .map((rule, index) => ({ ...rule, index }))
            .sort((a, b) => a.min - b.min);
        const first = ordered[0];
        if (first && first.min !== 0 && first.min !== 1) {
            const row = rows[first.index];
            setRowError(row, '[data-error="min"]', 'First range must start at 0 or 1.');
            row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
            return { valid: false };
        }

        for (let i = 0; i < ordered.length; i += 1) {
            const current = ordered[i];
            const row = rows[current.index];
            if (current.max === null) {
                if (i !== ordered.length - 1) {
                    setRowError(row, '[data-error="max"]', 'Open-ended range must be the last range.');
                    row.querySelector('[data-field="max"]').closest('.input-field').classList.add('input-error');
                    return { valid: false };
                }
                continue;
            }
            const next = ordered[i + 1];
            if (next && next.min !== current.max + 1) {
                setRowError(row, '[data-error="max"]', 'Guest count ranges must be continuous with no gaps.');
                row.querySelector('[data-field="max"]').closest('.input-field').classList.add('input-error');
                return { valid: false };
            }
        }

        const last = ordered[ordered.length - 1];
        if (last && last.max !== null) {
            openOpenEndedDialog();
            return { valid: false };
        }

        return { valid: true };
    };

    const saveDraftToStore = (active) => {
        const rules = getRulesFromTable().filter(rule => rule.minGuests !== '');
        const store = FeesStore.loadStore();
        store.guestCountRules = clone(rules);
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

    const updateAmountAffixes = () => {
        const calcType = draftSettings.guestCountCalcType || getSelectedCalcType();
        tableBody.querySelectorAll('.range-row').forEach(row => {
            const prefix = row.querySelector('.input-prefix');
            const suffix = row.querySelector('.input-suffix');
            const amountInput = row.querySelector('[data-field="amount"]');
            if (prefix) {
                prefix.classList.toggle('is-hidden', calcType === 'percent');
            }
            if (suffix) {
                suffix.classList.toggle('is-hidden', calcType !== 'percent');
            }
            if (amountInput) {
                amountInput.step = calcType === 'percent' ? '0.1' : '0.01';
            }
        });
    };

    closeButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    addRangeButton.addEventListener('click', () => {
        const rows = Array.from(tableBody.querySelectorAll('.range-row'));
        if (!rows.length) {
            const firstRow = buildRow({ minGuests: '1', maxGuests: null });
            tableBody.appendChild(firstRow);
            updateAmountAffixes();
            setDirty(true);
            return;
        }
        const lastRow = rows[rows.length - 1];
        const lastMaxInput = lastRow.querySelector('[data-field="max"]');
        const lastMinInput = lastRow.querySelector('[data-field="min"]');
        const lastAmountInput = lastRow.querySelector('[data-field="amount"]');
        clearRowErrors(lastRow);

        if (!lastMinInput.value) {
            setRowError(lastRow, '[data-error="min"]', 'From cannot be empty.');
            lastMinInput.closest('.input-field').classList.add('input-error');
            return;
        }
        if (!lastAmountInput.value) {
            setRowError(lastRow, '[data-error="amount"]', 'Fee amount cannot be empty.');
            lastAmountInput.closest('.input-field').classList.add('input-error');
            return;
        }
        let newFrom = 1;
        if (lastMaxInput.value) {
            newFrom = Number(lastMaxInput.value) + 1;
        } else {
            newFrom = Number(lastMinInput.value || 1) + 50;
            lastMaxInput.value = String(newFrom - 1);
        }
        const newRule = {
            minGuests: String(newFrom),
            maxGuests: null,
            amountCents: draftSettings.guestCountCalcType === 'percent' ? 0 : 0,
            percent: draftSettings.guestCountCalcType === 'percent' ? 0 : 0
        };
        tableBody.appendChild(buildRow(newRule));
        updateAmountAffixes();
        setDirty(true);
    });

    tableBody.addEventListener('input', (event) => {
        const row = event.target.closest('.range-row');
        if (!row) return;
        clearRowErrors(row);
        setDirty(computeDirty());
    });

    tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || button.dataset.action !== 'delete') return;
        button.closest('.range-row').remove();
        setDirty(computeDirty());
    });

    calcButtons.forEach(button => {
        button.addEventListener('click', () => {
            setSelectedButton(calcButtons, button.dataset.value);
            draftSettings.guestCountCalcType = button.dataset.value;
            updateCalcCopy();
            updateAmountAffixes();
            setDirty(computeDirty());
        });
    });

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            if (!savedSettings.guestCountActive) {
                if (!tableBody.querySelectorAll('.range-row').length) {
                    openActivationDialog('Add at least one guest range before activating this fee.');
                    return;
                }
                if (!validateRules().valid) {
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
            if (!tableBody.querySelectorAll('.range-row').length) {
                openActivationDialog('Add at least one guest range before saving.');
                return;
            }
            if (!validateRules().valid) {
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
            updateCalcCopy();
            renderTable();
            updateAmountAffixes();
            setDirty(false);
        });
    }

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

    draftSettings.guestCountCalcType = savedSettings.guestCountCalcType || 'flat';
    setSelectedButton(calcButtons, draftSettings.guestCountCalcType);
    updateCalcCopy();
    updateToggleLabel(!!savedSettings.guestCountActive);
    renderTable();
    updateAmountAffixes();
});
