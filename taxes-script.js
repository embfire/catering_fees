// Taxes and Fees Page Interactions
document.addEventListener('DOMContentLoaded', function() {
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
    const withVariant = (path) => `${path}?variant=${encodeURIComponent(variant)}`;

    // Tab Switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('tab-active'));
            this.classList.add('tab-active');
        });
    });

    // Navigation Items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Card Action Buttons
    const manageButtons = document.querySelectorAll('.card-footer .btn-text');
    manageButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            if (action === 'full-service') {
                window.location.href = withVariant('full-service-fee.html');
            }
            if (action === 'guest-count') {
                window.location.href = withVariant('guest-count-fee-advanced.html');
            }
            if (action === 'order-amount') {
                window.location.href = withVariant('order-amount-fee-advanced.html');
            }
        });
    });

    // Brand Selector Dropdown
    const brandSelector = document.querySelector('.brand-selector');
    if (brandSelector) {
        brandSelector.addEventListener('click', function() {
            alert('Brand/Store selector dropdown would open here');
        });
    }

    // Header Icon Buttons
    const iconButtons = document.querySelectorAll('.icon-button');
    iconButtons.forEach(button => {
        button.addEventListener('click', function() {
            const ariaLabel = this.getAttribute('aria-label');
            switch(ariaLabel) {
                case 'Notifications':
                    alert('Notifications panel would open here');
                    break;
                case 'Help':
                    alert('Help center would open here');
                    break;
                case 'User':
                    alert('User menu would open here');
                    break;
                case 'Apps':
                    alert('Apps menu would open here');
                    break;
            }
        });
    });

    // Mobile Sidebar Toggle (for responsive design)
    function createMobileMenuToggle() {
        if (window.innerWidth <= 1024) {
            const sidebar = document.querySelector('.sidebar');
            const header = document.querySelector('.main-header');

            if (!document.querySelector('.mobile-menu-toggle')) {
                const toggleButton = document.createElement('button');
                toggleButton.className = 'mobile-menu-toggle';
                toggleButton.innerHTML = '☰';
                toggleButton.style.cssText = `
                    position: fixed;
                    left: 12px;
                    top: 13px;
                    z-index: 101;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 5px;
                `;

                toggleButton.addEventListener('click', function() {
                    sidebar.classList.toggle('open');
                });

                header.insertBefore(toggleButton, header.firstChild);
            }
        }
    }

    createMobileMenuToggle();
    window.addEventListener('resize', createMobileMenuToggle);

    if (!window.FeesStore) {
        console.error('FeesStore is not available.');
        return;
    }

    const tableBody = document.getElementById('event-type-table-body');
    const emptyState = document.getElementById('event-type-empty');
    const tableContainer = tableBody ? tableBody.closest('.table-container') : null;
    const addFeeButton = document.querySelector('.section-header .btn-primary');

    const formatCurrency = (cents) => `$${(cents / 100).toFixed(2)}`;
    const formatPercent = (value) => `${value}%`;

    const setStatusTag = (elementId, isActive) => {
        const tag = document.getElementById(elementId);
        if (!tag) return;
        tag.classList.remove('status-active', 'status-inactive');
        tag.classList.add(isActive ? 'status-active' : 'status-inactive');
        const label = tag.querySelector('span:last-child');
        if (label) {
            label.textContent = isActive ? 'ACTIVE' : 'INACTIVE';
        }
    };

    const setActionLabel = (buttonId, isActive) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.textContent = isActive ? 'Manage' : 'Configure';
    };

    const updateStatusTags = () => {
        const guestRules = FeesStore.getGuestCountRules();
        const settings = FeesStore.getSettings();
        const hasGuestActive = !!settings.guestCountActive;
        const fullServiceRule = FeesStore.getFullServiceRule();
        const hasOrderAmountActive = !!settings.orderAmountActive;
        setStatusTag('guest-count-status', hasGuestActive);
        setStatusTag('full-service-status', !!fullServiceRule.active);
        setStatusTag('order-amount-status', hasOrderAmountActive);
        setActionLabel('guest-count-action', hasGuestActive);
        setActionLabel('full-service-action', !!fullServiceRule.active);
        setActionLabel('order-amount-action', hasOrderAmountActive);
    };

    const renderTable = () => {
        const rules = FeesStore.getEventTypeRules();
        tableBody.innerHTML = '';
        const isEmpty = rules.length === 0;

        if (emptyState) {
            emptyState.hidden = !isEmpty;
        }
        if (tableContainer) {
            tableContainer.classList.toggle('is-empty', isEmpty);
        }

        if (isEmpty) {
            return;
        }
        rules.forEach(rule => {
            const row = document.createElement('tr');
            row.dataset.id = rule.id;
            const calculation = rule.calcType === 'percent' ? 'Percentage' : 'Flat';
            const amount = rule.calcType === 'percent'
                ? formatPercent(rule.percent || 0)
                : formatCurrency(rule.amountCents || 0);
            const statusBadge = rule.active ? '' : '<span class="status-badge">Inactive</span>';

            row.innerHTML = `
                <td class="cell-bold">
                    <div class="cell-status">${rule.eventTypeName} ${statusBadge}</div>
                </td>
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

    addFeeButton.addEventListener('click', () => {
        window.location.href = 'event-type-fee.html';
    });

    tableBody.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row) return;
        const ruleId = row.dataset.id;

        const button = event.target.closest('button');
        if (button) {
            const action = button.dataset.action;
            if (action === 'delete') {
                const rule = FeesStore.getEventTypeRules().find(item => item.id === ruleId);
                if (rule && confirm(`Are you sure you want to delete the fee for "${rule.eventTypeName}"?`)) {
                    FeesStore.deleteEventTypeRule(ruleId);
                    renderTable();
                }
            }
            return;
        }

        const rule = FeesStore.getEventTypeRules().find(item => item.id === ruleId);
        if (rule) {
            window.location.href = `event-type-fee.html?id=${encodeURIComponent(rule.id)}`;
        }
    });

    renderTable();
    updateStatusTags();
});
