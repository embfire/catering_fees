document.addEventListener('DOMContentLoaded', function() {
    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const getVariant = () => {
        const fromWindow = window.FeesVariant;
        if (fromWindow === 'A' || fromWindow === 'B') {
            return fromWindow;
        }
        try {
            const params = new URLSearchParams(window.location.search);
            const value = (params.get('variant') || 'A').toUpperCase();
            return value === 'B' ? 'B' : 'A';
        } catch (error) {
            return 'A';
        }
    };

    const variant = getVariant();
    const goToIndex = () => {
        window.location.href = `index.html?variant=${encodeURIComponent(variant)}`;
    };
    const toggleVariantSections = () => {
        document.querySelectorAll('[data-variant]').forEach(section => {
            section.hidden = section.dataset.variant !== variant;
        });
    };

    const closeButton = document.querySelector('.close-button');
    const addRangeButton = document.getElementById('add-range');
    const toggleButton = document.getElementById('order-amount-toggle');
    const unsavedBar = document.getElementById('order-amount-unsaved');
    const unsavedCancel = document.getElementById('order-amount-cancel');
    const unsavedSave = document.getElementById('order-amount-save');
    const tableBody = document.getElementById('order-amount-body');
    const tableContainer = document.querySelector('.table-section[data-variant="A"] .table-container');
    const emptyState = document.getElementById('order-amount-empty');
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

    const initRulesVariant = () => {
        const rulesList = document.getElementById('order-amount-rules-list');
        const ruleForm = document.getElementById('order-amount-rule-form');
        const ruleMinInput = document.getElementById('order-amount-min-input');
        const ruleFeeInput = document.getElementById('order-amount-fee-input');
        const ruleCalcType = document.getElementById('order-amount-calc-type');
        const calcSelect = document.getElementById('order-amount-calc-select');
        const calcDisplay = document.getElementById('order-amount-calc-display');
        const calcMenu = document.getElementById('order-amount-calc-menu');
        const feePrefix = document.getElementById('order-amount-fee-prefix');
        const feeSuffix = document.getElementById('order-amount-fee-suffix');
        const minError = document.getElementById('order-amount-min-error');
        const feeError = document.getElementById('order-amount-fee-error');
        const globalError = document.getElementById('order-amount-rule-global-error');
        const toggleButton = document.getElementById('order-amount-toggle');
        const unsavedBar = document.getElementById('order-amount-unsaved');
        const unsavedCancel = document.getElementById('order-amount-cancel');
        const unsavedSave = document.getElementById('order-amount-save');
        const activationDialog = document.getElementById('order-amount-activation-dialog');
        const activationBody = document.getElementById('order-amount-activation-body');
        const activationOk = document.getElementById('order-amount-activation-ok');
        const deactivateDialog = document.getElementById('order-amount-deactivate-dialog');
        const deactivateCancel = document.getElementById('order-amount-deactivate-cancel');
        const deactivateConfirm = document.getElementById('order-amount-deactivate-confirm');

        const setDirty = (dirty) => {
            if (!unsavedBar) return;
            if (!savedSettings.orderAmountActive) {
                unsavedBar.classList.remove('is-visible');
                document.body.classList.remove('has-unsaved-bar');
                return;
            }
            unsavedBar.classList.toggle('is-visible', dirty);
            document.body.classList.toggle('has-unsaved-bar', dirty);
        };

        const updateToggleLabel = (isActive) => {
            if (!toggleButton) return;
            toggleButton.textContent = isActive ? 'Deactivate' : 'Activate';
            toggleButton.className = isActive ? 'btn-secondary-destructive' : 'btn-activate';
        };

        const normalizeThresholds = (rules) => rules.map(rule => ({
            id: rule.id,
            minSubtotalCents: Number(rule.minSubtotalCents),
            calcType: rule.calcType || 'flat',
            amountCents: Number.isFinite(rule.amountCents) ? rule.amountCents : 0,
            percent: Number.isFinite(rule.percent) ? rule.percent : 0
        })).sort((a, b) => a.minSubtotalCents - b.minSubtotalCents);

        const buildRanges = (thresholds) => thresholds.map((rule, index) => ({
            id: rule.id,
            minSubtotalCents: rule.minSubtotalCents,
            maxSubtotalCents: index < thresholds.length - 1 ? thresholds[index + 1].minSubtotalCents - 1 : null,
            calcType: rule.calcType,
            amountCents: rule.calcType === 'percent' ? 0 : rule.amountCents,
            percent: rule.calcType === 'percent' ? rule.percent : 0,
            active: true
        }));

        const formatDollarsSmart = (cents) => {
            const value = Number(cents) || 0;
            if (value % 100 === 0) {
                return `$${value / 100}`;
            }
            return `$${(value / 100).toFixed(2)}`;
        };

        const formatAmountLabel = (rule) => {
            if (rule.calcType === 'percent') {
                return `${rule.percent || 0}% of subtotal`;
            }
            return `${formatDollarsSmart(rule.amountCents)} flat`;
        };

        let savedRules = normalizeThresholds(FeesStore.getOrderAmountRules());
        let savedSettings = { ...FeesStore.getSettings() };
        let draftRules = savedSettings.orderAmountActive ? savedRules.slice() : [];

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

        const saveDraftToStore = (active) => {
            const store = FeesStore.loadStore();
            store.orderAmountRules = buildRanges(draftRules);
            store.settings = {
                ...store.settings,
                orderAmountActive: active
            };
            FeesStore.saveStore(store);
            savedRules = normalizeThresholds(store.orderAmountRules);
            savedSettings = { ...store.settings };
            draftRules = savedSettings.orderAmountActive ? savedRules.slice() : [];
            updateToggleLabel(savedSettings.orderAmountActive);
            renderRules();
            setDirty(false);
        };

        const openCalcMenu = () => {
            if (!calcSelect || !calcMenu) return;
            calcSelect.classList.add('select-open');
            calcMenu.classList.add('is-open');
            calcMenu.setAttribute('aria-hidden', 'false');
            calcSelect.setAttribute('aria-expanded', 'true');
            const caret = calcSelect.querySelector('.ph-caret-down');
            if (caret) caret.classList.replace('ph-caret-down', 'ph-caret-up');
        };

        const closeCalcMenu = () => {
            if (!calcSelect || !calcMenu) return;
            calcSelect.classList.remove('select-open');
            calcMenu.classList.remove('is-open');
            calcMenu.setAttribute('aria-hidden', 'true');
            calcSelect.setAttribute('aria-expanded', 'false');
            const caret = calcSelect.querySelector('.ph-caret-up');
            if (caret) caret.classList.replace('ph-caret-up', 'ph-caret-down');
        };

        const setCalcTypeValue = (value) => {
            if (ruleCalcType) ruleCalcType.value = value;
            if (calcDisplay) {
                calcDisplay.textContent = value === 'percent' ? 'Percent' : 'Flat';
            }
            if (calcMenu) {
                calcMenu.querySelectorAll('.select-option').forEach(option => {
                    const isSelected = option.dataset.value === value;
                    option.classList.toggle('is-selected', isSelected);
                    const check = option.querySelector('.select-check');
                    if (check) {
                        check.innerHTML = isSelected ? '<i class="ph ph-check icon-16" aria-hidden="true"></i>' : '';
                    }
                });
            }
            updateFeeAffixes();
        };

        const updateFeeAffixes = () => {
            const calcType = ruleCalcType ? ruleCalcType.value : 'flat';
            if (feePrefix) {
                feePrefix.classList.toggle('is-hidden', calcType === 'percent');
            }
            if (feeSuffix) {
                feeSuffix.classList.toggle('is-hidden', calcType !== 'percent');
            }
            if (ruleFeeInput) {
                ruleFeeInput.step = calcType === 'percent' ? '0.1' : '0.01';
            }
        };

        const clearErrors = () => {
            if (minError) minError.textContent = '';
            if (feeError) feeError.textContent = '';
            if (globalError) globalError.textContent = '';
            ruleMinInput?.classList.remove('input-error');
            ruleFeeInput?.classList.remove('input-error');
            ruleMinInput?.closest('.input-field')?.classList.remove('input-error');
            ruleFeeInput?.closest('.input-field')?.classList.remove('input-error');
        };

        const validateNewRule = () => {
            clearErrors();
            const minValue = ruleMinInput?.value ?? '';
            const calcType = ruleCalcType?.value || 'flat';
            const feeValue = ruleFeeInput?.value ?? '';
            let valid = true;

            const minNumber = parseCurrencyToCents(minValue);
            if (minValue === '' || !Number.isFinite(minNumber) || minNumber < 0) {
                if (minError) minError.textContent = 'Add amount';
                ruleMinInput?.classList.add('input-error');
                ruleMinInput?.closest('.input-field')?.classList.add('input-error');
                valid = false;
            }

            const lastMin = draftRules.length ? draftRules[draftRules.length - 1].minSubtotalCents : null;
            if (valid && lastMin !== null && minNumber <= lastMin) {
                if (globalError) {
                    globalError.textContent = 'The order amount must be greater than the last added rule. To add lower values, delete rules with higher amounts first.';
                }
                ruleMinInput?.classList.add('input-error');
                ruleMinInput?.closest('.input-field')?.classList.add('input-error');
                valid = false;
            }

            if (calcType === 'percent') {
                const percent = parsePercent(feeValue);
                if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
                    if (feeError) feeError.textContent = 'Add percent';
                    ruleFeeInput?.classList.add('input-error');
                    ruleFeeInput?.closest('.input-field')?.classList.add('input-error');
                    valid = false;
                }
            } else {
                const amount = parseCurrencyToCents(feeValue);
                if (!Number.isFinite(amount) || amount < 0) {
                    if (feeError) feeError.textContent = 'Add fee amount';
                    ruleFeeInput?.classList.add('input-error');
                    ruleFeeInput?.closest('.input-field')?.classList.add('input-error');
                    valid = false;
                }
            }

            return valid ? { minNumber, calcType } : null;
        };

        const updateMinInputState = () => {
            if (!ruleMinInput) return;
            const wrapper = ruleMinInput.closest('.rules-field');
            const isFirstRule = draftRules.length === 0;
            if (isFirstRule) {
                if (!ruleMinInput.value) {
                    ruleMinInput.value = '0';
                }
                ruleMinInput.disabled = true;
                wrapper?.classList.add('rules-field-muted');
                return;
            }
            ruleMinInput.disabled = false;
            wrapper?.classList.remove('rules-field-muted');
        };

        const addRuleFromInputs = () => {
            const validation = validateNewRule();
            if (!validation) return false;
            const { minNumber, calcType } = validation;
            const feeValue = ruleFeeInput?.value ?? '';
            const newRule = {
                id: `order_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                minSubtotalCents: minNumber,
                calcType,
                amountCents: calcType === 'percent' ? 0 : parseCurrencyToCents(feeValue),
                percent: calcType === 'percent' ? parsePercent(feeValue) : 0
            };
            draftRules = normalizeThresholds([...draftRules, newRule]);
            renderRules();
            setDirty(true);
            if (ruleMinInput) ruleMinInput.value = '';
            if (ruleFeeInput) ruleFeeInput.value = '';
            return true;
        };

        const renderRules = () => {
            if (!rulesList) return;
            rulesList.innerHTML = '';
            if (!draftRules.length) {
                rulesList.innerHTML = '<p class="rules-empty">No rules added yet.</p>';
                updateMinInputState();
                return;
            }
            draftRules.forEach((rule, index) => {
                const row = document.createElement('div');
                row.className = 'rules-row';
                row.dataset.id = rule.id;
                const minLabel = formatDollarsSmart(rule.minSubtotalCents);
                const text = `If the order amount is equal to or higher than ${minLabel}, the fee is ${formatAmountLabel(rule)}`;
                const disableDelete = index === 0 && draftRules.length > 1;
                row.innerHTML = `
                    <span class="rules-row-text">${text}</span>
                    <button class="btn-delete rules-delete${disableDelete ? ' rules-delete-disabled' : ''}" type="button" data-action="delete" aria-label="Delete" ${disableDelete ? 'disabled aria-disabled="true" title="The first rule cannot be deleted until all other rules are deleted."' : ''}>
                        <i class="ph ph-trash icon-16" aria-hidden="true"></i>
                    </button>
                `;
                rulesList.appendChild(row);
            });
            updateMinInputState();
        };

        if (calcSelect && calcMenu) {
            calcSelect.addEventListener('click', (event) => {
                event.stopPropagation();
                if (calcMenu.classList.contains('is-open')) {
                    closeCalcMenu();
                } else {
                    openCalcMenu();
                }
            });
            calcSelect.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (calcMenu.classList.contains('is-open')) {
                        closeCalcMenu();
                    } else {
                        openCalcMenu();
                    }
                }
                if (event.key === 'Escape') {
                    closeCalcMenu();
                }
            });
            calcMenu.addEventListener('click', (event) => {
                const option = event.target.closest('.select-option');
                if (!option) return;
                setCalcTypeValue(option.dataset.value);
                closeCalcMenu();
            });
        }
        document.addEventListener('click', closeCalcMenu);
        updateFeeAffixes();
        renderRules();
        updateToggleLabel(!!savedSettings.orderAmountActive);

        if (activationOk) {
            activationOk.addEventListener('click', closeActivationDialog);
        }
        if (deactivateCancel) {
            deactivateCancel.addEventListener('click', closeDeactivateDialog);
        }
        if (deactivateConfirm) {
            deactivateConfirm.addEventListener('click', () => {
                saveDraftToStore(false);
                closeDeactivateDialog();
                setSnackbarMessage('Fee deactivated');
                goToIndex();
            });
        }

        rulesList?.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button || button.dataset.action !== 'delete') return;
            if (button.disabled) return;
            const row = event.target.closest('.rules-row');
            if (!row) return;
            const id = row.dataset.id;
            draftRules = draftRules.filter(rule => rule.id !== id);
            renderRules();
            setDirty(true);
        });

        ruleForm?.addEventListener('submit', (event) => {
            event.preventDefault();
            addRuleFromInputs();
        });

        [ruleMinInput, ruleFeeInput].forEach((input) => {
            input?.addEventListener('input', () => {
                clearErrors();
            });
        });

        toggleButton?.addEventListener('click', () => {
            if (!savedSettings.orderAmountActive) {
                if (!draftRules.length) {
                    openActivationDialog('Add at least one rule before activating this fee.');
                    return;
                }
                saveDraftToStore(true);
                setSnackbarMessage('Fee successfully activated');
                goToIndex();
                return;
            }
            openDeactivateDialog();
        });

        unsavedSave?.addEventListener('click', () => {
            const hasDraftInputs = Boolean(ruleFeeInput?.value) || (!ruleMinInput?.disabled && ruleMinInput?.value);
            if (hasDraftInputs && !addRuleFromInputs()) {
                return;
            }
            if (!draftRules.length) {
                openActivationDialog('Add at least one rule before saving.');
                return;
            }
            saveDraftToStore(true);
        });

        unsavedCancel?.addEventListener('click', () => {
            draftRules = savedSettings.orderAmountActive ? savedRules.slice() : [];
            renderRules();
            setDirty(false);
        });
    };
    const formatDollars = (cents) => (cents / 100).toFixed(2);
    toggleVariantSections();
    if (variant === 'B') {
        if (closeButton) {
            closeButton.addEventListener('click', goToIndex);
        }
        initRulesVariant();
        return;
    }

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

    const validateRules = () => {
        const rows = Array.from(tableBody.querySelectorAll('.range-row'));
        const rules = getRulesFromTable();
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
                setRowError(row, '[data-error="min"]', 'From cannot be empty.');
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
            if (next && next.min !== current.max + 1) {
                setRowError(row, '[data-error="max"]', 'Subtotal ranges must be continuous with no gaps.');
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
            setRowError(lastRow, '[data-error="min"]', 'From cannot be empty.');
            lastMinInput.closest('.input-field').classList.add('input-error');
            return;
        }
        if (!lastAmountInput.value) {
            setRowError(lastRow, '[data-error="amount"]', 'Fee amount cannot be empty.');
            lastAmountInput.closest('.input-field').classList.add('input-error');
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
            amountCents: 0,
            percent: 0
        };
        tableBody.appendChild(buildRow(newRule));
        updateAllAmountAffixes();
        setDirty(true);
        updateEmptyState();
    });

    tableBody.addEventListener('input', (event) => {
        const row = event.target.closest('.range-row');
        if (!row) return;
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
            if (!savedSettings.orderAmountActive) {
                if (!tableBody.querySelectorAll('.range-row').length) {
                    openActivationDialog('Add at least one subtotal range before activating this fee.');
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
            if (!tableBody.querySelectorAll('.range-row').length) {
                openActivationDialog('Add at least one subtotal range before saving.');
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
