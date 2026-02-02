document.addEventListener('DOMContentLoaded', function() {
    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const goToIndex = () => {
        window.location.href = 'index.html';
    };

    const closeButton = document.querySelector('.close-button');
    const addRangeButton = document.getElementById('add-range');
    const toggleButton = document.getElementById('guest-count-toggle');
    const unsavedBar = document.getElementById('guest-count-unsaved');
    const unsavedCancel = document.getElementById('guest-count-cancel');
    const unsavedSave = document.getElementById('guest-count-save');
    const tableBody = document.getElementById('guest-range-body');
    const tableContainer = document.querySelector('.table-section .table-container');
    const emptyState = document.getElementById('guest-count-empty');
    const inlineError = document.getElementById('guest-count-inline-error');
    const activationDialog = document.getElementById('guest-activation-dialog');
    const activationOk = document.getElementById('guest-activation-ok');
    const activationBody = document.getElementById('guest-activation-body');
    const deactivateDialog = document.getElementById('guest-deactivate-dialog');
    const deactivateCancel = document.getElementById('guest-deactivate-cancel');
    const deactivateConfirm = document.getElementById('guest-deactivate-confirm');
    const setSnackbarMessage = (message) => {
        try {
            window.sessionStorage.setItem('feesSnackbarMessage', message);
        } catch (error) {
            console.error('Unable to set snackbar message.', error);
        }
    };

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
    const showInlineError = (message) => {
        if (!inlineError) return;
        const text = inlineError.querySelector('.inline-error-text');
        if (text) {
            text.textContent = message || '';
        }
        inlineError.hidden = false;
    };
    const clearInlineError = () => {
        if (!inlineError) return;
        const text = inlineError.querySelector('.inline-error-text');
        if (text) {
            text.textContent = '';
        }
        inlineError.hidden = true;
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
    let lastEditedRowIndex = null;

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
        const currentRules = getRulesFromTable();
        return JSON.stringify(normalizeRules(currentRules)) !== JSON.stringify(normalizeRules(savedRules));
    };

    const updateToggleLabel = (isActive) => {
        if (toggleButton) {
            toggleButton.textContent = isActive ? 'Deactivate' : 'Activate';
            toggleButton.className = isActive ? 'btn-secondary-destructive' : 'btn-activate';
        }
    };

    const updateEmptyState = () => {
        const isEmpty = tableBody.querySelectorAll('.range-row').length === 0;
        if (emptyState) {
            emptyState.hidden = !isEmpty;
        }
        if (tableContainer) {
            tableContainer.classList.toggle('is-empty', isEmpty);
        }
    };

    const getDefaultCalcType = (rule) => rule.calcType || savedSettings.guestCountCalcType || 'flat';

    const getRowCalcType = (row) => {
        const selected = row.querySelector('.calc-type-control .segment-button.segment-selected');
        return selected ? selected.dataset.value : 'flat';
    };

    const setRowCalcType = (row, calcType) => {
        row.querySelectorAll('.calc-type-control .segment-button').forEach(button => {
            button.classList.toggle('segment-selected', button.dataset.value === calcType);
        });
        updateAmountAffixes(row);
    };

    const openActivationDialog = (message) => {
        showInlineError(message);
    };

    const closeActivationDialog = () => {
        if (!activationDialog) return;
        activationDialog.classList.remove('is-open');
        activationDialog.setAttribute('aria-hidden', 'true');
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
        const calcType = getDefaultCalcType(rule);
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
                <div class="segmented-control calc-type-control" data-field="calcType">
                    <button class="segment-button" data-value="flat">Flat</button>
                    <button class="segment-button" data-value="perPerson">Per person</button>
                    <button class="segment-button" data-value="percent">Percent</button>
                </div>
            </td>
            <td>
                <div class="input-field input-field-compact">
                    <span class="input-prefix amount-prefix">$</span>
                    <input type="number" class="text-input range-input" data-field="amount" min="0" step="0.01" value="">
                    <span class="input-suffix amount-suffix-percent">%</span>
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
            if (calcType === 'percent') {
                amountInput.value = Number.isFinite(rule.percent) ? rule.percent : '';
                amountInput.step = '0.1';
            } else {
                amountInput.value = Number.isFinite(rule.amountCents) ? (rule.amountCents / 100).toFixed(2) : '';
                amountInput.step = '0.01';
            }
        }
        setRowCalcType(row, calcType);
        return row;
    };

    const renderTable = () => {
        tableBody.innerHTML = '';
        const ranges = clone(draftRules).sort((a, b) => Number(a.minGuests) - Number(b.minGuests));
        if (!ranges.length) {
            updateEmptyState();
            return;
        }
        ranges.forEach(rule => {
            tableBody.appendChild(buildRow(rule));
        });
        updateEmptyState();
    };

    const getRulesFromTable = () => {
        return Array.from(tableBody.querySelectorAll('.range-row')).map(row => {
            const minValue = row.querySelector('[data-field="min"]').value;
            const maxValue = row.querySelector('[data-field="max"]').value;
            const amountValue = row.querySelector('[data-field="amount"]').value;
            const calcType = getRowCalcType(row);
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
        clearInlineError();
        rows.forEach(clearRowErrors);

        let valid = true;
        const parsed = rules.map(rule => ({
            min: Number(rule.minGuests),
            max: rule.maxGuests === null ? null : Number(rule.maxGuests),
            amountCents: rule.amountCents,
            percent: rule.percent,
            calcType: rule.calcType
        }));

        rows.forEach((row, index) => {
            const rule = rules[index];
            const data = parsed[index];
            if (rule.minGuests === '') {
                setRowError(row, '[data-error="min"]', 'Add a From value');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
                return;
            }
            if (!Number.isFinite(data.min) || data.min < 0) {
                setRowError(row, '[data-error="min"]', 'Minimum party size must be 0 or greater.');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (Number.isFinite(data.min) && !Number.isInteger(data.min)) {
                setRowError(row, '[data-error="min"]', 'Minimum party size must be a whole number.');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (data.max !== null && (!Number.isFinite(data.max) || data.max < data.min)) {
                setRowError(row, '[data-error="max"]', 'Maximum party size must be greater than or equal to minimum.');
                row.querySelector('[data-field="max"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (data.max !== null && Number.isFinite(data.max) && !Number.isInteger(data.max)) {
                setRowError(row, '[data-error="max"]', 'Maximum party size must be a whole number.');
                row.querySelector('[data-field="max"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (rule.calcType === 'percent') {
                if (!Number.isFinite(data.percent) || data.percent < 0 || data.percent > 100) {
                    setRowError(row, '[data-error="amount"]', 'Percent must be between 0 and 100.');
                    row.querySelector('[data-field="amount"]').closest('.input-field').classList.add('input-error');
                    valid = false;
                }
            } else if (!Number.isFinite(data.amountCents) || data.amountCents < 0) {
                setRowError(row, '[data-error="amount"]', 'Add fee amount');
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

        for (let i = 0; i < ordered.length; i += 1) {
            const current = ordered[i];
            if (current.max === null && i !== ordered.length - 1) {
                const next = ordered[i + 1];
                const rowToFlag = (lastEditedRowIndex === current.index)
                    ? rows[current.index]
                    : rows[next.index];
                const errorField = (lastEditedRowIndex === current.index) ? '[data-error="max"]' : '[data-error="min"]';
                const inputField = (lastEditedRowIndex === current.index) ? '[data-field="max"]' : '[data-field="min"]';
                setRowError(rowToFlag, errorField, 'Ranges cannot overlap.');
                rowToFlag.querySelector(inputField).closest('.input-field').classList.add('input-error');
                return { valid: false };
            }
            if (current.max === null) {
                continue;
            }
            const next = ordered[i + 1];
            if (next && next.min <= current.max) {
                const rowToFlag = (lastEditedRowIndex === current.index)
                    ? rows[current.index]
                    : rows[next.index];
                const errorField = (lastEditedRowIndex === current.index) ? '[data-error="max"]' : '[data-error="min"]';
                const inputField = (lastEditedRowIndex === current.index) ? '[data-field="max"]' : '[data-field="min"]';
                setRowError(rowToFlag, errorField, 'Ranges cannot overlap.');
                rowToFlag.querySelector(inputField).closest('.input-field').classList.add('input-error');
                return { valid: false };
            }
        }

        return { valid: true };
    };

    const saveDraftToStore = (active) => {
        const rules = getRulesFromTable().filter(rule => rule.minGuests !== '');
        const store = FeesStore.loadStore();
        store.guestCountRules = clone(rules).sort((a, b) => Number(a.minGuests) - Number(b.minGuests));
        store.settings = {
            ...store.settings,
            guestCountActive: active
        };
        FeesStore.saveStore(store);
        savedRules = clone(store.guestCountRules);
        savedSettings = { ...store.settings };
        draftRules = clone(savedRules);
        draftSettings = { ...savedSettings };
        lastEditedRowIndex = null;
        updateToggleLabel(savedSettings.guestCountActive);
        renderTable();
    };

    const updateAmountAffixes = (row) => {
        const calcType = getRowCalcType(row);
        const prefix = row.querySelector('.amount-prefix');
        const percentSuffix = row.querySelector('.amount-suffix-percent');
        const amountInput = row.querySelector('[data-field="amount"]');
        if (prefix) {
            prefix.classList.toggle('is-hidden', calcType === 'percent');
        }
        if (percentSuffix) {
            percentSuffix.classList.toggle('is-hidden', calcType !== 'percent');
        }
        if (amountInput) {
            amountInput.step = calcType === 'percent' ? '0.1' : '0.01';
        }
    };

    const updateAllAmountAffixes = () => {
        tableBody.querySelectorAll('.range-row').forEach(updateAmountAffixes);
    };

    closeButton.addEventListener('click', () => {
        goToIndex();
    });

    addRangeButton.addEventListener('click', () => {
        clearInlineError();
        const rows = Array.from(tableBody.querySelectorAll('.range-row'));
        if (!rows.length) {
            const firstRow = buildRow({ minGuests: '1', maxGuests: null });
            tableBody.appendChild(firstRow);
            lastEditedRowIndex = 0;
            updateAllAmountAffixes();
            setDirty(true);
            updateEmptyState();
            return;
        }
        const lastRow = rows[rows.length - 1];
        const lastMaxInput = lastRow.querySelector('[data-field="max"]');
        const lastMinInput = lastRow.querySelector('[data-field="min"]');
        const lastAmountInput = lastRow.querySelector('[data-field="amount"]');
        clearRowErrors(lastRow);

        if (!lastMinInput.value) {
            setRowError(lastRow, '[data-error="min"]', 'Add a From value');
            lastMinInput.closest('.input-field').classList.add('input-error');
            return;
        }
        if (!lastAmountInput.value) {
            setRowError(lastRow, '[data-error="amount"]', 'Add fee amount');
            lastAmountInput.closest('.input-field').classList.add('input-error');
            return;
        }
        if (!validateRules().valid) {
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
            calcType: getRowCalcType(lastRow) || 'flat',
            amountCents: null,
            percent: null
        };
        tableBody.appendChild(buildRow(newRule));
        lastEditedRowIndex = tableBody.querySelectorAll('.range-row').length - 1;
        updateAllAmountAffixes();
        setDirty(true);
        updateEmptyState();
    });

    tableBody.addEventListener('input', (event) => {
        const row = event.target.closest('.range-row');
        if (!row) return;
        const rows = Array.from(tableBody.querySelectorAll('.range-row'));
        lastEditedRowIndex = rows.indexOf(row);
        clearInlineError();
        clearRowErrors(row);
        setDirty(computeDirty());
    });

    tableBody.addEventListener('focusout', (event) => {
        const input = event.target.closest('[data-field="amount"]');
        if (!input) return;
        const row = input.closest('.range-row');
        const calcType = row ? getRowCalcType(row) : 'flat';
        if (calcType !== 'percent') {
            formatDollarInput(input);
        }
    });

    tableBody.addEventListener('click', (event) => {
        const calcButton = event.target.closest('.calc-type-control .segment-button');
        if (calcButton) {
            const row = calcButton.closest('.range-row');
            if (!row) return;
            setRowCalcType(row, calcButton.dataset.value);
            const amountInput = row.querySelector('[data-field="amount"]');
            if (amountInput) {
                amountInput.value = '';
            }
            setDirty(computeDirty());
            return;
        }

        const button = event.target.closest('button');
        if (!button || button.dataset.action !== 'delete') return;
        button.closest('.range-row').remove();
        setDirty(computeDirty());
        updateEmptyState();
    });

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            clearInlineError();
            if (!savedSettings.guestCountActive) {
                if (!tableBody.querySelectorAll('.range-row').length) {
                    openActivationDialog('Add at least one party size range.');
                    return;
                }
                if (!validateRules().valid) {
                    return;
                }
                saveDraftToStore(true);
                setDirty(false);
                setSnackbarMessage('Fee successfully activated');
                goToIndex();
                return;
            }
            openDeactivateDialog();
        });
    }

    if (unsavedSave) {
        unsavedSave.addEventListener('click', () => {
            clearInlineError();
            if (!tableBody.querySelectorAll('.range-row').length) {
                openActivationDialog('Add at least one party size range.');
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
            lastEditedRowIndex = null;
            renderTable();
            updateAllAmountAffixes();
            setDirty(false);
        });
    }

    if (activationOk) {
        activationOk.addEventListener('click', closeActivationDialog);
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
            setSnackbarMessage('Fee deactivated');
            goToIndex();
        });
    }

    updateToggleLabel(!!savedSettings.guestCountActive);
    renderTable();
    updateAllAmountAffixes();
    updateEmptyState();
});
