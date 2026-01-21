document.addEventListener('DOMContentLoaded', function() {
    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const closeButton = document.querySelector('.close-button');
    const saveButton = document.getElementById('event-type-save');
    const nameInput = document.getElementById('event-type-name');
    const selectButton = document.getElementById('event-type-select');
    const selectDisplay = document.getElementById('event-type-display');
    const selectMenu = document.getElementById('event-type-menu');
    const selectClear = document.getElementById('event-type-clear');
    const calcButtons = Array.from(document.querySelectorAll('#event-type-calc .segment-button'));
    const amountInput = document.getElementById('event-type-amount');
    const amountField = amountInput.closest('.input-field');
    const prefixLabel = document.getElementById('event-type-prefix');
    const suffixLabel = document.getElementById('event-type-suffix');
    const nameError = document.getElementById('event-type-name-error');
    const amountError = document.getElementById('event-type-amount-error');

    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');

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

    const setSelectedCalcType = (value) => {
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

    const getSelectedCalcType = () => {
        const selected = calcButtons.find(btn => btn.classList.contains('segment-selected'));
        return selected ? selected.dataset.value : 'flat';
    };

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

    const getUnavailableTypes = () => {
        const rules = FeesStore.getEventTypeRules();
        return rules
            .filter(rule => rule.eventTypeName && rule.id !== editId)
            .map(rule => rule.eventTypeName);
    };

    const renderOptions = (selectedValue) => {
        const unavailable = new Set(getUnavailableTypes());
        selectMenu.innerHTML = '';
        eventTypes.forEach((label) => {
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
        if (nameError) {
            nameError.textContent = '';
        }
    };

    const openMenu = () => {
        selectButton.classList.add('select-open');
        selectMenu.classList.add('is-open');
        selectMenu.setAttribute('aria-hidden', 'false');
        selectButton.setAttribute('aria-expanded', 'true');
        selectButton.querySelector('.ph-caret-down').classList.replace('ph-caret-down', 'ph-caret-up');
    };

    const closeMenu = () => {
        selectButton.classList.remove('select-open');
        selectMenu.classList.remove('is-open');
        selectMenu.setAttribute('aria-hidden', 'true');
        selectButton.setAttribute('aria-expanded', 'false');
        const caret = selectButton.querySelector('.ph-caret-up');
        if (caret) {
            caret.classList.replace('ph-caret-up', 'ph-caret-down');
        }
    };

    const toggleMenu = () => {
        if (selectMenu.classList.contains('is-open')) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    const loadRule = () => {
        if (!editId) {
            setSelectedCalcType('flat');
            setSelectedValue('');
            return;
        }

        const rule = FeesStore.getEventTypeRules().find(item => item.id === editId);
        if (!rule) {
            if (nameError) {
                nameError.textContent = 'Event type fee not found.';
            }
            setSelectedCalcType('flat');
            setSelectedValue('');
            return;
        }

        if (rule.eventTypeName && !eventTypes.includes(rule.eventTypeName)) {
            eventTypes.push(rule.eventTypeName);
        }
        setSelectedValue(rule.eventTypeName || '');
        setSelectedCalcType(rule.calcType || 'flat');
        if (rule.calcType === 'percent') {
            amountInput.value = rule.percent ?? '';
        } else {
            amountInput.value = rule.amountCents ? (rule.amountCents / 100).toFixed(2) : '';
        }
    };

    closeButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    selectButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu();
    });

    selectButton.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleMenu();
        }
        if (event.key === 'Escape') {
            closeMenu();
        }
    });

    selectMenu.addEventListener('click', (event) => {
        const option = event.target.closest('.select-option');
        if (!option) return;
        if (option.disabled) return;
        setSelectedValue(option.dataset.value);
        closeMenu();
    });

    selectClear.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelectedValue('');
    });

    amountInput.addEventListener('input', () => {
        if (amountField) {
            amountField.classList.remove('input-error');
        }
        if (amountError) {
            amountError.textContent = '';
        }
    });

    document.addEventListener('click', () => {
        closeMenu();
    });

    calcButtons.forEach(button => {
        button.addEventListener('click', () => {
            setSelectedCalcType(button.dataset.value);
        });
    });

    saveButton.addEventListener('click', () => {
        if (nameError) {
            nameError.textContent = '';
        }
        if (amountError) {
            amountError.textContent = '';
        }
        const calcType = getSelectedCalcType();
        const amountValue = calcType === 'percent'
            ? parsePercent(amountInput.value)
            : parseCurrencyToCents(amountInput.value);

        const payload = {
            id: editId || undefined,
            eventTypeName: nameInput.value,
            calcType,
            amountCents: calcType === 'percent' ? 0 : amountValue,
            percent: calcType === 'percent' ? amountValue : 0,
            active: true
        };

        try {
            FeesStore.upsertEventTypeRule(payload);
            window.location.href = 'index.html';
        } catch (error) {
            const message = error.message || 'Unable to save event type fee.';
            if (message.toLowerCase().includes('event type')) {
                selectButton.classList.add('input-error');
                if (nameError) {
                    nameError.textContent = message;
                }
            }
            if (message.toLowerCase().includes('amount') || message.toLowerCase().includes('percent')) {
                if (amountField) {
                    amountField.classList.add('input-error');
                }
                if (amountError) {
                    amountError.textContent = message;
                }
            }
        }
    });

    setSelectedValue('');
    loadRule();
});
