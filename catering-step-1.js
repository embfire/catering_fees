document.addEventListener('DOMContentLoaded', () => {
    const selectAllInput = document.getElementById('service-all');
    const cutleryInput = document.getElementById('service-cutlery');
    const staffingInput = document.getElementById('service-staffing');
    const setupInput = document.getElementById('service-setup');
    const cleanupInput = document.getElementById('service-cleanup');
    const staffingHelper = document.getElementById('staffing-helper');

    const serviceInputs = [cutleryInput, staffingInput, setupInput, cleanupInput].filter(Boolean);

    const updateSelectAll = () => {
        if (!selectAllInput) return;
        selectAllInput.checked = serviceInputs.length > 0 && serviceInputs.every(input => input.checked);
    };

    const shakeHelper = () => {
        if (!staffingHelper) return;
        staffingHelper.classList.remove('is-shaking');
        requestAnimationFrame(() => {
            staffingHelper.classList.add('is-shaking');
        });
    };

    const enforceStaffingDependency = (source) => {
        const needsStaffing = setupInput?.checked || cleanupInput?.checked;
        const staffingWasUnchecked = staffingInput && !staffingInput.checked;

        if (needsStaffing && staffingWasUnchecked) {
            staffingInput.checked = true;
            if (source === 'staffing') {
                shakeHelper();
            }
        }

        updateSelectAll();
    };

    if (selectAllInput) {
        selectAllInput.addEventListener('change', () => {
            const isChecked = selectAllInput.checked;
            serviceInputs.forEach(input => {
                input.checked = isChecked;
            });
            enforceStaffingDependency('select-all');
        });
    }

    if (cutleryInput) {
        cutleryInput.addEventListener('change', updateSelectAll);
    }
    if (setupInput) {
        setupInput.addEventListener('change', () => enforceStaffingDependency('setup'));
    }
    if (cleanupInput) {
        cleanupInput.addEventListener('change', () => enforceStaffingDependency('cleanup'));
    }
    if (staffingInput) {
        staffingInput.addEventListener('change', () => enforceStaffingDependency('staffing'));
    }

    updateSelectAll();
});
