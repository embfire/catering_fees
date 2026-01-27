document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const subtotalCents = Number(params.get('subtotalCents') || 0);
    const guestCount = Number(params.get('guestCount') || 0);
    const eventTypeId = params.get('eventTypeId') || '';
    const fullServiceEnabled = params.get('fullServiceEnabled') !== 'false';
    const fullServiceMode = params.get('fullServiceMode') || '';
    const aLaCarteComponents = (params.get('aLaCarteComponents') || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    const subtotalValue = document.getElementById('subtotal-value');
    const cateringFeesValue = document.getElementById('catering-fees-value');
    const totalValue = document.getElementById('total-value');
    const perPersonValue = document.getElementById('per-person-value');
    const checkoutTotal = document.getElementById('checkout-total');
    const checkoutPerPerson = document.getElementById('checkout-per-person');

    const feesDialog = document.getElementById('catering-fees-dialog');
    const feesDialogList = document.getElementById('fee-breakdown-list');
    const feesDialogTotal = document.getElementById('fee-total-value');
    const feesInfoButton = document.getElementById('catering-fees-info');
    const feesCloseButton = document.getElementById('catering-fees-close');
    const feesAckButton = document.getElementById('catering-fees-ack');

    const formatCurrency = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
    const formatDollarsSmart = (cents) => {
        const value = Number(cents || 0);
        if (value % 100 === 0) {
            return `$${value / 100}`;
        }
        return `$${(value / 100).toFixed(2)}`;
    };

    const getRuleAmountCents = (rule) => {
        if (!rule) return 0;
        if (rule.calcType === 'percent') {
            return Math.round(subtotalCents * (Number(rule.percent) || 0) / 100);
        }
        if (rule.calcType === 'perPerson') {
            return (Number(rule.amountCents) || 0) * guestCount;
        }
        return Number(rule.amountCents) || 0;
    };

    const getRuleCalculation = (rule) => {
        if (!rule) return '';
        if (rule.calcType === 'percent') {
            return `${rule.percent || 0}% of subtotal (${formatCurrency(subtotalCents)})`;
        }
        if (rule.calcType === 'perPerson') {
            return `${formatDollarsSmart(rule.amountCents)} per person × ${guestCount}`;
        }
        return `${formatDollarsSmart(rule.amountCents)} flat`;
    };

    const addFeeLine = (lines, name, description, rule, forceShow = false) => {
        if (!rule && !forceShow) return;
        const amountCents = getRuleAmountCents(rule);
        if (!amountCents && !forceShow) return;
        lines.push({
            name,
            description,
            calculation: getRuleCalculation(rule),
            amountCents
        });
    };

    const buildFeeLines = () => {
        if (!window.FeesStore) {
            return [];
        }
        const lines = [];
        const settings = FeesStore.getSettings();
        const guestRules = FeesStore.getGuestCountRules();
        const orderAmountRules = FeesStore.getOrderAmountRules();
        const fullServiceConfig = FeesStore.getFullServiceConfig();
        const eventTypeRules = FeesStore.getEventTypeRules();

        if (settings.guestCountActive) {
            const rule = FeesStore.getGuestCountRuleForCount(guestCount, guestRules);
            addFeeLine(
                lines,
                'Party size fee',
                'Scales with your party size to ensure adequate staffing and prep.',
                rule
            );
        }

        if (settings.orderAmountActive) {
            const rule = FeesStore.getOrderAmountRuleForSubtotal(subtotalCents, orderAmountRules);
            addFeeLine(
                lines,
                'Service fee',
                'Covers the administrative and operational costs of your catering order.',
                rule
            );
        }

        if (eventTypeId) {
            const rule = eventTypeRules.find(item => item.id === eventTypeId);
            if (rule && rule.active) {
                addFeeLine(
                    lines,
                    `${rule.eventTypeName} coordination`,
                    `Specialized planning and resources required for ${rule.eventTypeName} events.`,
                    rule
                );
            }
        }

        if (!fullServiceEnabled) {
            return lines;
        }

        const mode = fullServiceMode || (fullServiceConfig.mode === 'a_la_carte' ? 'bundle' : 'bundle');
        const bundleRule = fullServiceConfig.bundle;
        const componentMap = fullServiceConfig.components || {};
        const componentLabels = {
            cutlery: 'Plates & cutlery',
            staffing: 'On-site staff',
            setup: 'On-site setup',
            cleanup: 'Cleanup'
        };
        const componentDescriptions = {
            cutlery: 'Provision of all necessary dining ware for your guests.',
            staffing: 'Professional team members to assist during your event.',
            setup: 'Professional arrangement and presentation of your catering.',
            cleanup: 'Professional clearing of the catering area after your event.'
        };

        if (mode === 'bundle') {
            addFeeLine(
                lines,
                'Full-service',
                'Comprehensive on-site service from setup to cleanup.',
                bundleRule,
                true
            );
            return lines;
        }

        const componentKeys = aLaCarteComponents;
        componentKeys.forEach(key => {
            const rule = componentMap[key];
            const label = componentLabels[key] || key;
            const description = componentDescriptions[key] || '';
            addFeeLine(lines, label, description, rule, true);
        });

        return lines;
    };

    const renderFeesDialog = (lines, totalCents) => {
        if (!feesDialogList) return;
        feesDialogList.innerHTML = '';
        if (!lines.length) {
            const empty = document.createElement('div');
            empty.className = 'fees-dialog-item';
            empty.innerHTML = `
                <div>
                    <div class="fees-dialog-item-title">No catering fees applied</div>
                    <div class="fees-dialog-item-desc">There are no active fees for this preview.</div>
                </div>
                <div class="fees-dialog-item-amount">$0.00</div>
            `;
            feesDialogList.appendChild(empty);
        } else {
            lines.forEach(line => {
                const item = document.createElement('div');
                item.className = 'fees-dialog-item';
                item.innerHTML = `
                    <div>
                        <div class="fees-dialog-item-title">${line.name}</div>
                        <div class="fees-dialog-item-desc">${line.description}</div>
                        <div class="fees-dialog-item-calc">${line.calculation}</div>
                    </div>
                    <div class="fees-dialog-item-amount">${formatCurrency(line.amountCents)}</div>
                `;
                feesDialogList.appendChild(item);
            });
        }
        if (feesDialogTotal) {
            feesDialogTotal.textContent = formatCurrency(totalCents);
        }
    };

    const setSummaryValues = (feesTotalCents) => {
        const totalCents = subtotalCents + feesTotalCents;
        const perPersonCents = guestCount > 0 ? Math.round(totalCents / guestCount) : 0;
        if (subtotalValue) subtotalValue.textContent = formatCurrency(subtotalCents);
        if (cateringFeesValue) cateringFeesValue.textContent = formatCurrency(feesTotalCents);
        if (totalValue) totalValue.textContent = formatCurrency(totalCents);
        if (perPersonValue) perPersonValue.textContent = `${formatCurrency(perPersonCents)}/person`;
        if (checkoutTotal) checkoutTotal.textContent = formatCurrency(totalCents);
        if (checkoutPerPerson) checkoutPerPerson.textContent = `${formatCurrency(perPersonCents)}/person`;

        const partySizeValue = document.getElementById('party-size-value');
        if (partySizeValue && Number.isFinite(guestCount)) {
            partySizeValue.textContent = String(guestCount);
        }
    };

    const openFeesDialog = () => {
        if (!feesDialog) return;
        feesDialog.classList.add('is-open');
        feesDialog.setAttribute('aria-hidden', 'false');
    };

    const closeFeesDialog = () => {
        if (!feesDialog) return;
        feesDialog.classList.remove('is-open');
        feesDialog.setAttribute('aria-hidden', 'true');
    };

    if (feesInfoButton) {
        feesInfoButton.addEventListener('click', openFeesDialog);
    }
    if (feesCloseButton) {
        feesCloseButton.addEventListener('click', closeFeesDialog);
    }
    if (feesAckButton) {
        feesAckButton.addEventListener('click', closeFeesDialog);
    }
    if (feesDialog) {
        feesDialog.addEventListener('click', (event) => {
            if (event.target === feesDialog) {
                closeFeesDialog();
            }
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && feesDialog?.classList.contains('is-open')) {
            closeFeesDialog();
        }
    });

    const feeLines = buildFeeLines();
    const feesTotalCents = feeLines.reduce((sum, line) => sum + line.amountCents, 0);
    setSummaryValues(feesTotalCents);
    renderFeesDialog(feeLines, feesTotalCents);
});
