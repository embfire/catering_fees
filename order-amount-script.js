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
    const toggleButton = document.getElementById('order-amount-toggle');
    const unsavedBar = document.getElementById('order-amount-unsaved');
    const unsavedCancel = document.getElementById('order-amount-cancel');
    const unsavedSave = document.getElementById('order-amount-save');
    const tableBody = document.getElementById('order-amount-body');
    const tableContainer = document.querySelector('.table-section .table-container');
    const emptyState = document.getElementById('order-amount-empty');
    const inlineError = document.getElementById('order-amount-inline-error');
    const activationDialog = document.getElementById('order-amount-activation-dialog');
    const activationOk = document.getElementById('order-amount-activation-ok');
    const activationBody = document.getElementById('order-amount-activation-body');
    const openEndedDialog = document.getElementById('order-amount-open-ended-dialog');
    const openEndedOk = document.getElementById('order-amount-open-ended-ok');
    const deactivateDialog = document.getElementById('order-amount-deactivate-dialog');
    const deactivateCancel = document.getElementById('order-amount-deactivate-cancel');
    const deactivateConfirm = document.getElementById('order-amount-deactivate-confirm');
    const setSnackbarMessage = (message) => {
        try {
            window.sessionStorage.setItem('feesSnackbarMessage', message);
        } catch (error) {
            console.error('Unable to set snackbar message.', error);
        }
    };

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

    const formatDollars = (cents) => (cents / 100).toFixed(2);

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const normalizeRules = (rules) => clone(rules).map(rule => ({
        id: rule.id,
        minSubtotalCents: rule.minSubtotalCents,
        maxSubtotalCents: rule.maxSubtotalCents,
        calcType: rule.calcType,
        amountCents: rule.amountCents,
        percent: rule.percent,
        active: rule.active
    })).sort((a, b) => String(a.id).localeCompare(String(b.id)));

    let savedRules = clone(FeesStore.getOrderAmountRules());
    let savedSettings = { ...FeesStore.getSettings() };
    let draftRules = savedSettings.orderAmountActive ? clone(savedRules) : [];
    let draftSettings = { ...savedSettings };
    let isDirty = false;

    const setDirty = (dirty) => {
        isDirty = dirty;
        if (!savedSettings.orderAmountActive) {
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
        if (!savedSettings.orderAmountActive) {
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

    const getDefaultCalcType = (rule) => rule.calcType || savedSettings.orderAmountCalcType || 'flat';

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

    const openOpenEndedDialog = () => {
        showInlineError('Add an open-ended subtotal range (leave TO empty, ∞) to cover all subtotals.');
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
        const calcType = getDefaultCalcType(rule);
        const minValue = Number.isFinite(rule.minSubtotalCents) ? formatDollars(rule.minSubtotalCents) : '';
        const maxValue = Number.isFinite(rule.maxSubtotalCents) ? formatDollars(rule.maxSubtotalCents) : '';
        row.innerHTML = `
            <td>
                <div class="input-field input-field-compact">
                    <span class="input-prefix range-prefix">$</span>
                    <input type="number" class="text-input range-input" data-field="min" min="0" step="0.01" value="${minValue}">
                </div>
                <p class="form-error range-error" data-error="min"></p>
            </td>
            <td>
                <div class="input-field input-field-compact">
                    <span class="input-prefix range-prefix">$</span>
                    <input type="number" class="text-input range-input" data-field="max" min="0" step="0.01" value="${maxValue}" placeholder="∞">
                </div>
                <p class="form-error range-error" data-error="max"></p>
            </td>
            <td>
                <div class="segmented-control calc-type-control" data-field="calcType">
                    <button class="segment-button" data-value="flat">Flat</button>
                    <button class="segment-button" data-value="percent">Percent</button>
                </div>
            </td>
            <td>
                <div class="input-field input-field-compact">
                    <span class="input-prefix amount-prefix">$</span>
                    <input type="number" class="text-input range-input" data-field="amount" min="0" step="0.01" value="">
                    <span class="input-suffix amount-suffix">%</span>
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
        const ranges = clone(draftRules).sort((a, b) => Number(a.minSubtotalCents) - Number(b.minSubtotalCents));
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
                minSubtotalCents: parseCurrencyToCents(minValue),
                maxSubtotalCents: maxValue === '' ? null : parseCurrencyToCents(maxValue),
                calcType,
                amountCents: calcType === 'percent' ? 0 : parseCurrencyToCents(amountValue),
                percent: calcType === 'percent' ? parsePercent(amountValue) : 0,
                active: true
            };
        });
    };

    const validateRules = (options = {}) => {
        const { showOpenEndedDialog = true, requireOpenEnded = true } = options;
        const rows = Array.from(tableBody.querySelectorAll('.range-row'));
        const rules = getRulesFromTable();
        clearInlineError();
        rows.forEach(clearRowErrors);

        let valid = true;
        const parsed = rules.map(rule => ({
            min: rule.minSubtotalCents,
            max: rule.maxSubtotalCents === null ? null : rule.maxSubtotalCents,
            amountCents: rule.amountCents,
            percent: rule.percent,
            calcType: rule.calcType
        }));

        rows.forEach((row, index) => {
            const rule = rules[index];
            const data = parsed[index];
            if (row.querySelector('[data-field="min"]').value === '') {
                setRowError(row, '[data-error="min"]', 'Add a From value');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
                return;
            }
            if (!Number.isFinite(data.min) || data.min < 0) {
                setRowError(row, '[data-error="min"]', 'Minimum subtotal must be 0 or greater.');
                row.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                valid = false;
            }
            if (data.max !== null && (!Number.isFinite(data.max) || data.max < data.min)) {
                setRowError(row, '[data-error="max"]', 'Maximum subtotal must be greater than or equal to minimum.');
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
        const first = ordered[0];
        if (first && first.min !== 0) {
            const row = rows[first.index];
            setRowError(row, '[data-error="min"]', 'First range must start at 0.');
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
            if (next) {
                if (next.min <= current.max) {
                    const nextRow = rows[next.index];
                    setRowError(nextRow, '[data-error="min"]', 'Subtotal ranges must be continuous with no gaps or overlaps.');
                    nextRow.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                    return { valid: false };
                }
                if (next.min !== current.max + 1) {
                    const nextRow = rows[next.index];
                    setRowError(nextRow, '[data-error="min"]', 'Subtotal ranges must be continuous with no gaps or overlaps.');
                    nextRow.querySelector('[data-field="min"]').closest('.input-field').classList.add('input-error');
                    return { valid: false };
                }
            }
        }

        if (requireOpenEnded) {
            const last = ordered[ordered.length - 1];
            if (last && last.max !== null) {
                if (showOpenEndedDialog) {
                    openOpenEndedDialog();
                }
                return { valid: false };
            }
        }

        return { valid: true };
    };

    const saveDraftToStore = (active) => {
        const rules = getRulesFromTable().filter(rule => Number.isFinite(rule.minSubtotalCents));
        const store = FeesStore.loadStore();
        store.orderAmountRules = clone(rules);
        store.settings = {
            ...store.settings,
            orderAmountActive: active
        };
        FeesStore.saveStore(store);
        savedRules = clone(store.orderAmountRules);
        savedSettings = { ...store.settings };
        draftRules = clone(savedRules);
        draftSettings = { ...savedSettings };
        updateToggleLabel(savedSettings.orderAmountActive);
        renderTable();
    };

    const updateAmountAffixes = (row) => {
        const calcType = getRowCalcType(row);
        const prefix = row.querySelector('.amount-prefix');
        const suffix = row.querySelector('.amount-suffix');
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
            const firstRow = buildRow({ minSubtotalCents: 0, maxSubtotalCents: null });
            tableBody.appendChild(firstRow);
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
        if (!validateRules({ showOpenEndedDialog: false, requireOpenEnded: false }).valid) {
            return;
        }
        const lastMinCents = parseCurrencyToCents(lastMinInput.value);
        const lastMaxCents = lastMaxInput.value ? parseCurrencyToCents(lastMaxInput.value) : null;
        let newFromCents = 0;
        if (Number.isFinite(lastMaxCents)) {
            newFromCents = lastMaxCents + 1;
        } else {
            newFromCents = Number.isFinite(lastMinCents) ? lastMinCents + 10000 : 10000;
            lastMaxInput.value = formatDollars(newFromCents - 1);
        }
        const newRule = {
            minSubtotalCents: newFromCents,
            maxSubtotalCents: null,
            calcType: getRowCalcType(lastRow) || 'flat',
            amountCents: null,
            percent: null
        };
        tableBody.appendChild(buildRow(newRule));
        updateAllAmountAffixes();
        setDirty(true);
        updateEmptyState();
    });

    tableBody.addEventListener('input', (event) => {
        const row = event.target.closest('.range-row');
        if (!row) return;
        clearInlineError();
        clearRowErrors(row);
        setDirty(computeDirty());
    });

    tableBody.addEventListener('focusout', (event) => {
        const input = event.target.closest('.range-input');
        if (!input) return;
        const field = input.dataset.field;
        if (field === 'min' || field === 'max') {
            formatDollarInput(input);
            return;
        }
        if (field === 'amount') {
            const row = input.closest('.range-row');
            const calcType = row ? getRowCalcType(row) : 'flat';
            if (calcType !== 'percent') {
                formatDollarInput(input);
            }
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
            if (!savedSettings.orderAmountActive) {
                if (!tableBody.querySelectorAll('.range-row').length) {
                    openActivationDialog('Add at least one subtotal range.');
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
                openActivationDialog('Add at least one subtotal range.');
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
            renderTable();
            updateAllAmountAffixes();
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
            draftSettings = { ...savedSettings, orderAmountActive: false };
            saveDraftToStore(false);
            setDirty(false);
            closeDeactivateDialog();
            setSnackbarMessage('Fee deactivated');
            goToIndex();
        });
    }

    updateToggleLabel(!!savedSettings.orderAmountActive);
    renderTable();
    updateAllAmountAffixes();
    updateEmptyState();
});
