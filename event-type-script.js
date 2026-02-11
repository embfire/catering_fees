document.addEventListener('DOMContentLoaded', function() {
    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const goToIndex = () => {
        window.location.href = 'index.html';
    };

    const clone = (v) => JSON.parse(JSON.stringify(v));

    const closeButton = document.querySelector('.close-button');
    const toggleButton = document.getElementById('event-type-toggle');
    const addButton = document.getElementById('add-event-type-fee');
    const tableBody = document.getElementById('event-type-table-body');
    const emptyState = document.getElementById('event-type-empty');
    const tableContainer = tableBody ? tableBody.closest('.table-container') : null;

    const unsavedBar = document.getElementById('event-type-unsaved');
    const unsavedCancel = document.getElementById('event-type-cancel');
    const unsavedSave = document.getElementById('event-type-save');

    const modalBackdrop = document.getElementById('event-type-fee-modal');
    const modalTitle = document.getElementById('event-type-modal-title');
    const modalClose = document.getElementById('event-type-modal-close');
    const modalForm = document.getElementById('event-type-modal-form');
    const modalSubmitButton = document.getElementById('event-type-modal-submit');
    const modalCancel = document.getElementById('event-type-modal-cancel');

    // Custom select elements
    const selectButton = document.getElementById('event-type-select');
    const selectDisplay = document.getElementById('event-type-display');
    const selectMenu = document.getElementById('event-type-menu');
    const selectClear = document.getElementById('event-type-clear');
    const nameInput = document.getElementById('event-type-name');
    const nameError = document.getElementById('event-type-name-error');

    const calcButtons = Array.from(document.querySelectorAll('#event-type-calc .segment-button'));
    const amountInput = document.getElementById('event-type-amount');
    const amountField = amountInput?.closest('.input-field');
    const prefixLabel = document.getElementById('event-type-prefix');
    const suffixLabel = document.getElementById('event-type-suffix');
    const amountError = document.getElementById('event-type-amount-error');

    const inlineError = document.getElementById('event-type-inline-error');
    const deactivateDialog = document.getElementById('event-type-deactivate-dialog');
    const deactivateCancel = document.getElementById('event-type-deactivate-cancel');
    const deactivateConfirm = document.getElementById('event-type-deactivate-confirm');

    const snackbar = document.getElementById('fee-snackbar');
    const snackbarMessage = snackbar?.querySelector('.snackbar-message');

    const setSnackbarMessage = (message) => {
        try {
            window.sessionStorage.setItem('feesSnackbarMessage', message);
        } catch (e) {
            console.error('Unable to set snackbar message.', e);
        }
    };

    const showSnackbar = (message) => {
        if (!snackbar || !snackbarMessage) return;
        snackbarMessage.textContent = message;
        snackbar.classList.add('is-visible');
        window.setTimeout(() => snackbar.classList.remove('is-visible'), 3000);
    };

    const formatCurrency = (cents) => `$${(cents / 100).toFixed(2)}`;
    const formatPercent = (value) => `${value}%`;

    const parseCurrencyToCents = (value) => {
        const numeric = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(numeric)) return null;
        return Math.round(numeric * 100);
    };

    const parsePercent = (value) => {
        const numeric = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(numeric)) return null;
        return numeric;
    };

    const formatDollarInput = (input) => {
        if (!input) return;
        const raw = String(input.value || '').trim();
        if (!raw) return;
        const n = parseFloat(raw);
        if (!Number.isFinite(n)) return;
        input.value = n.toFixed(2);
    };

    const formatPercentInput = (input) => {
        if (!input) return;
        const raw = String(input.value || '').trim();
        if (!raw) return;
        const n = parseFloat(raw);
        if (!Number.isFinite(n)) return;
        input.value = String(n);
    };

    const generateId = () => `fee_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const eventTypes = [
        'Birthday',
        'Wedding',
        'Corporate event',
        'Family gathering',
        'Holiday party',
        'School event',
        'Community event',
        'Sports event',
        'Baby shower',
        'Graduation',
        'Anniversary',
        'Office meeting'
    ];

    let editingRuleId = null;

    // ── Draft state ───────────────────────────────────────────────────

    let savedRules = clone(FeesStore.getEventTypeRules());
    let savedSettings = { ...FeesStore.getSettings() };
    let draftRules = clone(savedRules);

    const normalizeRules = (rules) => clone(rules)
        .map(r => ({ id: r.id, eventTypeName: r.eventTypeName, calcType: r.calcType, amountCents: r.amountCents, percent: r.percent, active: r.active }))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const computeDirty = () => {
        if (!savedSettings.eventTypeActive) return false;
        return JSON.stringify(normalizeRules(draftRules)) !== JSON.stringify(normalizeRules(savedRules));
    };

    const setDirty = (dirty) => {
        if (!savedSettings.eventTypeActive) {
            if (unsavedBar) unsavedBar.classList.remove('is-visible');
            document.body.classList.remove('has-unsaved-bar');
            return;
        }
        if (unsavedBar) unsavedBar.classList.toggle('is-visible', dirty);
        document.body.classList.toggle('has-unsaved-bar', dirty);
    };

    // ── Settings / Toggle ─────────────────────────────────────────────

    const isActive = () => !!savedSettings.eventTypeActive;

    const updateToggleLabel = () => {
        if (!toggleButton) return;
        const active = isActive();
        toggleButton.textContent = active ? 'Deactivate' : 'Activate';
        toggleButton.className = active ? 'btn-secondary-destructive' : 'btn-activate';
    };

    // ── Calc type helpers ─────────────────────────────────────────────

    const setModalCalcType = (value) => {
        calcButtons.forEach(btn => {
            btn.classList.toggle('segment-selected', btn.dataset.value === value);
        });
        if (prefixLabel) {
            prefixLabel.textContent = '$';
            prefixLabel.classList.toggle('is-hidden', value === 'percent');
        }
        if (suffixLabel) {
            suffixLabel.classList.toggle('is-hidden', value !== 'percent');
        }
    };

    const getModalCalcType = () => {
        const selected = calcButtons.find(btn => btn.classList.contains('segment-selected'));
        return selected ? selected.dataset.value : 'flat';
    };

    // ── Table (renders from draftRules) ───────────────────────────────

    const renderTable = () => {
        tableBody.innerHTML = '';
        const isEmpty = draftRules.length === 0;

        if (emptyState) emptyState.hidden = !isEmpty;
        if (tableContainer) tableContainer.classList.toggle('is-empty', isEmpty);

        if (isEmpty) return;

        draftRules.forEach(rule => {
            const row = document.createElement('tr');
            row.dataset.id = rule.id;
            const calculation = rule.calcType === 'percent' ? 'Percentage' : 'Flat';
            const amount = rule.calcType === 'percent'
                ? formatPercent(rule.percent || 0)
                : formatCurrency(rule.amountCents || 0);
            row.innerHTML = `
                <td class="cell-bold">${rule.eventTypeName || ''}</td>
                <td>${calculation}</td>
                <td>${amount}</td>
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

    // ── Persist helpers ───────────────────────────────────────────────

    const saveDraftToStore = () => {
        const store = FeesStore.loadStore();
        store.eventTypeRules = clone(draftRules);
        FeesStore.saveStore(store);
        savedRules = clone(draftRules);
        savedSettings = { ...FeesStore.getSettings() };
    };

    // ── Custom select (event type dropdown) ───────────────────────────

    const getUsedEventTypes = (excludeId) => {
        return draftRules
            .filter(r => r.eventTypeName && r.id !== excludeId)
            .map(r => r.eventTypeName);
    };

    const renderOptions = (selectedValue) => {
        const unavailable = new Set(getUsedEventTypes(editingRuleId));
        selectMenu.innerHTML = '';
        eventTypes.forEach(label => {
            const isUnavailable = unavailable.has(label) && label !== selectedValue;
            const option = document.createElement('button');
            option.type = 'button';
            option.className = `select-option${label === selectedValue ? ' is-selected' : ''}${isUnavailable ? ' is-disabled' : ''}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-disabled', String(isUnavailable));
            option.dataset.value = label;
            option.disabled = isUnavailable;
            option.innerHTML = `
                <span class="select-check">
                    ${label === selectedValue ? '<i class="ph ph-check icon-16" aria-hidden="true"></i>' : ''}
                </span>
                <span class="select-option-text">${label}</span>
            `;
            selectMenu.appendChild(option);
        });
    };

    const setSelectedValue = (value) => {
        nameInput.value = value || '';
        if (value) {
            selectDisplay.textContent = value;
            selectDisplay.classList.remove('is-placeholder');
            selectClear.classList.add('is-visible');
        } else {
            selectDisplay.textContent = 'Select';
            selectDisplay.classList.add('is-placeholder');
            selectClear.classList.remove('is-visible');
        }
        renderOptions(value);
        selectButton.classList.remove('input-error');
        if (nameError) nameError.textContent = '';
    };

    const openMenu = () => {
        selectButton.classList.add('select-open');
        selectMenu.classList.add('is-open');
        selectMenu.setAttribute('aria-hidden', 'false');
        selectButton.setAttribute('aria-expanded', 'true');
        const caret = selectButton.querySelector('.ph-caret-down');
        if (caret) caret.classList.replace('ph-caret-down', 'ph-caret-up');
    };

    const closeMenu = () => {
        selectButton.classList.remove('select-open');
        selectMenu.classList.remove('is-open');
        selectMenu.setAttribute('aria-hidden', 'true');
        selectButton.setAttribute('aria-expanded', 'false');
        const caret = selectButton.querySelector('.ph-caret-up');
        if (caret) caret.classList.replace('ph-caret-up', 'ph-caret-down');
    };

    const toggleMenu = () => {
        selectMenu.classList.contains('is-open') ? closeMenu() : openMenu();
    };

    selectButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    selectButton?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
        if (e.key === 'Escape') closeMenu();
    });

    selectMenu?.addEventListener('click', (e) => {
        const option = e.target.closest('.select-option');
        if (!option || option.disabled) return;
        setSelectedValue(option.dataset.value);
        closeMenu();
    });

    selectClear?.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedValue('');
    });

    // ── Modal open / close ────────────────────────────────────────────

    const clearModalErrors = () => {
        if (nameError) nameError.textContent = '';
        if (amountError) amountError.textContent = '';
        if (amountField) amountField.classList.remove('input-error');
        if (selectButton) selectButton.classList.remove('input-error');
    };

    const openModal = (rule) => {
        editingRuleId = rule ? rule.id : null;
        if (modalTitle) {
            modalTitle.textContent = rule ? 'Edit event type fee' : 'Add event type fee';
        }
        if (modalSubmitButton) {
            modalSubmitButton.textContent = rule ? 'Save' : 'Add';
        }
        setSelectedValue(rule?.eventTypeName || '');
        setModalCalcType(rule?.calcType || 'flat');
        if (rule?.calcType === 'percent') {
            amountInput.value = rule.percent != null ? String(rule.percent) : '';
        } else {
            amountInput.value = rule?.amountCents != null ? (rule.amountCents / 100).toFixed(2) : '';
        }
        clearModalErrors();
        if (modalBackdrop) {
            modalBackdrop.classList.add('is-open');
            modalBackdrop.setAttribute('aria-hidden', 'false');
        }
    };

    const closeModal = () => {
        editingRuleId = null;
        closeMenu();
        if (modalBackdrop) {
            modalBackdrop.classList.remove('is-open');
            modalBackdrop.setAttribute('aria-hidden', 'true');
        }
    };

    // ── Dialogs ───────────────────────────────────────────────────────

    const showInlineError = (message) => {
        if (!inlineError) return;
        const text = inlineError.querySelector('.inline-error-text');
        if (text) text.textContent = message || '';
        inlineError.hidden = false;
    };

    const clearInlineError = () => {
        if (!inlineError) return;
        const text = inlineError.querySelector('.inline-error-text');
        if (text) text.textContent = '';
        inlineError.hidden = true;
    };

    const openDeactivateDialog = () => {
        if (deactivateDialog) {
            deactivateDialog.classList.add('is-open');
            deactivateDialog.setAttribute('aria-hidden', 'false');
        }
    };

    const closeDeactivateDialog = () => {
        if (deactivateDialog) {
            deactivateDialog.classList.remove('is-open');
            deactivateDialog.setAttribute('aria-hidden', 'true');
        }
    };

    // ── Event listeners ───────────────────────────────────────────────

    closeButton?.addEventListener('click', goToIndex);
    addButton?.addEventListener('click', () => {
        clearInlineError();
        openModal(null);
    });

    tableBody?.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row) return;
        const deleteBtn = event.target.closest('button[data-action="delete"]');
        if (deleteBtn) {
            event.stopPropagation();
            const rule = draftRules.find(r => r.id === row.dataset.id);
            if (!rule) return;
            if (isActive()) {
                draftRules = draftRules.filter(r => r.id !== rule.id);
                renderTable();
                setDirty(computeDirty());
            } else {
                FeesStore.deleteEventTypeRule(rule.id);
                savedRules = clone(FeesStore.getEventTypeRules());
                draftRules = clone(savedRules);
                renderTable();
            }
            return;
        }
        const rule = draftRules.find(r => r.id === row.dataset.id);
        if (rule) openModal(rule);
    });

    modalClose?.addEventListener('click', closeModal);
    modalCancel?.addEventListener('click', closeModal);

    modalBackdrop?.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
    });

    document.addEventListener('click', () => closeMenu());

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalBackdrop?.classList.contains('is-open')) closeModal();
        }
    });

    calcButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setModalCalcType(btn.dataset.value);
            if (btn.dataset.value === 'percent') formatPercentInput(amountInput);
            else formatDollarInput(amountInput);
        });
    });

    amountInput?.addEventListener('blur', () => {
        if (getModalCalcType() !== 'percent') formatDollarInput(amountInput);
    });

    amountInput?.addEventListener('input', () => {
        if (amountField) amountField.classList.remove('input-error');
        if (amountError) amountError.textContent = '';
    });

    // ── Modal submit ──────────────────────────────────────────────────

    if (modalForm) {
        modalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearModalErrors();

            const eventTypeName = (nameInput?.value || '').trim();
            const calcType = getModalCalcType();
            const rawAmount = String(amountInput?.value || '').trim();

            // Client-side: empty amount check
            if (!rawAmount) {
                if (amountField) amountField.classList.add('input-error');
                if (amountError) amountError.textContent = 'Add fee amount';
                return;
            }

            const amountVal = calcType === 'percent'
                ? parsePercent(rawAmount)
                : parseCurrencyToCents(rawAmount);

            if (amountVal === null) {
                if (amountField) amountField.classList.add('input-error');
                if (amountError) amountError.textContent = 'Add fee amount';
                return;
            }

            const payload = {
                id: editingRuleId || generateId(),
                eventTypeName: eventTypeName || '',
                calcType,
                amountCents: calcType === 'percent' ? 0 : amountVal,
                percent: calcType === 'percent' ? amountVal : 0,
                active: true
            };

            // Validate against draft rules
            const validation = FeesStore.validateEventTypeRule(payload, { eventTypeRules: draftRules });
            if (!validation.valid) {
                const msg = validation.message;
                if (msg.toLowerCase().includes('event type') || msg.toLowerCase().includes('select') || msg.toLowerCase().includes('unique')) {
                    if (selectButton) selectButton.classList.add('input-error');
                    if (nameError) nameError.textContent = msg;
                }
                if (msg.toLowerCase().includes('amount') || msg.toLowerCase().includes('percent') || msg.toLowerCase().includes('fee')) {
                    if (amountField) amountField.classList.add('input-error');
                    if (amountError) amountError.textContent = msg;
                }
                return;
            }

            if (isActive()) {
                // Update draft only
                const idx = draftRules.findIndex(r => r.id === payload.id);
                if (idx >= 0) {
                    draftRules[idx] = payload;
                } else {
                    draftRules.push(payload);
                }
                closeModal();
                renderTable();
                setDirty(computeDirty());
            } else {
                // Persist immediately when inactive
                try {
                    FeesStore.upsertEventTypeRule(payload);
                    savedRules = clone(FeesStore.getEventTypeRules());
                    draftRules = clone(savedRules);
                    closeModal();
                    renderTable();
                } catch (err) {
                    const msg = err.message || 'Unable to save.';
                    if (msg.toLowerCase().includes('event type') || msg.toLowerCase().includes('select') || msg.toLowerCase().includes('unique')) {
                        if (selectButton) selectButton.classList.add('input-error');
                        if (nameError) nameError.textContent = msg;
                    }
                    if (msg.toLowerCase().includes('amount') || msg.toLowerCase().includes('percent') || msg.toLowerCase().includes('fee')) {
                        if (amountField) amountField.classList.add('input-error');
                        if (amountError) amountError.textContent = msg;
                    }
                }
            }
        });
    }

    // ── Unsaved bar ───────────────────────────────────────────────────

    unsavedSave?.addEventListener('click', () => {
        if (draftRules.length === 0 && isActive()) {
            // No fees left — ask to deactivate
            openDeactivateDialog();
            return;
        }
        saveDraftToStore();
        setDirty(false);
    });

    unsavedCancel?.addEventListener('click', () => {
        draftRules = clone(savedRules);
        renderTable();
        setDirty(false);
    });

    // ── Toggle (Activate / Deactivate) ────────────────────────────────

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            if (!isActive()) {
                if (!draftRules.length) {
                    showInlineError('Add at least one event type fee.');
                    return;
                }
                // Persist draft rules + activate
                saveDraftToStore();
                FeesStore.updateSettings({ eventTypeActive: true });
                savedSettings = { ...FeesStore.getSettings() };
                setSnackbarMessage('Fee successfully activated');
                goToIndex();
                return;
            }
            openDeactivateDialog();
        });
    }

    deactivateCancel?.addEventListener('click', closeDeactivateDialog);
    deactivateConfirm?.addEventListener('click', () => {
        // Clear all event type rules on deactivation
        const rules = FeesStore.getEventTypeRules();
        rules.forEach(rule => FeesStore.deleteEventTypeRule(rule.id));
        FeesStore.updateSettings({ eventTypeActive: false });
        savedRules = [];
        draftRules = [];
        savedSettings = { ...FeesStore.getSettings() };
        closeDeactivateDialog();
        setSnackbarMessage('Fee deactivated');
        goToIndex();
    });

    // ── Init ──────────────────────────────────────────────────────────

    updateToggleLabel();
    renderTable();

    try {
        const msg = window.sessionStorage.getItem('feesSnackbarMessage');
        if (msg) {
            window.sessionStorage.removeItem('feesSnackbarMessage');
            showSnackbar(msg);
        }
    } catch (e) {
        console.error('Unable to read snackbar message.', e);
    }
});
