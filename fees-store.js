(() => {
    const STORE_KEY = 'cateringFeesStore__A';
    const STORE_VERSION = 2;

    const createDefaultRule = () => ({
        calcType: 'flat',
        amountCents: 0,
        percent: 0,
        active: false
    });

    const createDefaultFullServiceConfig = () => ({
        mode: 'bundle',
        bundle: createDefaultRule(),
        components: {
            cutlery: createDefaultRule(),
            staffing: createDefaultRule(),
            setup: createDefaultRule(),
            cleanup: createDefaultRule()
        }
    });

    const createDefaultStore = () => ({
        version: STORE_VERSION,
        eventTypeRules: [],
        guestCountRules: [],
        orderAmountRules: [],
        fullServiceConfig: createDefaultFullServiceConfig(),
        settings: {
            guestCountMissingPolicy: 'skip',
            guestCountActive: false,
            guestCountCalcType: 'flat',
            orderAmountActive: false,
            orderAmountCalcType: 'flat'
        }
    });

    const deepClone = (value) => JSON.parse(JSON.stringify(value));

    const migrateV1ToV2 = (data) => {
        // Migrate orderAmountRules from cents to dollars
        const migratedOrderAmountRules = (data.orderAmountRules || []).map(rule => {
            const migrated = { ...rule };
            // Convert minSubtotalCents to minSubtotalDollars
            if ('minSubtotalCents' in rule && !('minSubtotalDollars' in rule)) {
                migrated.minSubtotalDollars = Math.floor(Number(rule.minSubtotalCents) / 100);
                delete migrated.minSubtotalCents;
            }
            // Convert maxSubtotalCents to maxSubtotalDollars
            if ('maxSubtotalCents' in rule && !('maxSubtotalDollars' in rule)) {
                migrated.maxSubtotalDollars = rule.maxSubtotalCents === null 
                    ? null 
                    : Math.floor(Number(rule.maxSubtotalCents) / 100);
                delete migrated.maxSubtotalCents;
            }
            return migrated;
        });
        return {
            ...data,
            version: 2,
            orderAmountRules: migratedOrderAmountRules
        };
    };

    const loadStore = () => {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) {
            return createDefaultStore();
        }

        try {
            let parsed = JSON.parse(raw);
            if (!parsed) {
                return createDefaultStore();
            }
            // Migrate from version 1 to version 2
            if (parsed.version === 1) {
                parsed = migrateV1ToV2(parsed);
                // Save the migrated data
                localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
            }
            // Reject unknown versions
            if (parsed.version !== STORE_VERSION) {
                return createDefaultStore();
            }
            const store = createDefaultStore();
            const nextFullServiceConfig = parsed.fullServiceConfig
                ? {
                    ...store.fullServiceConfig,
                    ...(parsed.fullServiceConfig || {}),
                    bundle: {
                        ...store.fullServiceConfig.bundle,
                        ...(parsed.fullServiceConfig.bundle || {})
                    },
                    components: {
                        ...store.fullServiceConfig.components,
                        ...(parsed.fullServiceConfig.components || {})
                    }
                }
                : {
                    ...store.fullServiceConfig,
                    bundle: {
                        ...store.fullServiceConfig.bundle,
                        ...(parsed.fullServiceRule || {})
                    }
                };
            return {
                ...store,
                ...parsed,
                settings: {
                    ...store.settings,
                    ...(parsed.settings || {})
                },
                fullServiceConfig: nextFullServiceConfig,
                orderAmountRules: parsed.orderAmountRules || store.orderAmountRules
            };
        } catch (error) {
            console.warn('Failed to parse fee store, resetting.', error);
            return createDefaultStore();
        }
    };

    const saveStore = (store) => {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
    };

    const withStore = (mutator) => {
        const store = loadStore();
        mutator(store);
        saveStore(store);
        return store;
    };

    const generateId = () => `fee_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const normalizeName = (value) => value.trim();

    const isPercentValid = (value) => Number.isFinite(value) && value >= 0 && value <= 100;

    const isCentsValid = (value) => Number.isFinite(value) && value >= 0;

    const rangesOverlap = (aMin, aMax, bMin, bMax) => {
        const maxA = aMax === null ? Infinity : aMax;
        const maxB = bMax === null ? Infinity : bMax;
        return aMin <= maxB && bMin <= maxA;
    };

    const findGuestCountOverlap = (rule, rules) => {
        const minGuests = Number(rule.minGuests);
        const maxGuests = rule.maxGuests === null ? null : Number(rule.maxGuests);
        if (!Number.isFinite(minGuests) || (maxGuests !== null && !Number.isFinite(maxGuests))) {
            return null;
        }

        return rules.find((existing) => {
            if (rule.id && existing.id === rule.id) {
                return false;
            }
            return rangesOverlap(
                minGuests,
                maxGuests,
                Number(existing.minGuests),
                existing.maxGuests === null ? null : Number(existing.maxGuests)
            );
        }) || null;
    };

    const normalizeGuestCountRule = (rule) => ({
        ...rule,
        minGuests: Number(rule.minGuests),
        maxGuests: rule.maxGuests === null || rule.maxGuests === '' ? null : Number(rule.maxGuests)
    });

    const findOrderAmountOverlap = (rule, rules) => {
        const minSubtotal = Number(rule.minSubtotalDollars);
        const maxSubtotal = rule.maxSubtotalDollars === null ? null : Number(rule.maxSubtotalDollars);
        if (!Number.isFinite(minSubtotal) || (maxSubtotal !== null && !Number.isFinite(maxSubtotal))) {
            return null;
        }

        return rules.find((existing) => {
            if (rule.id && existing.id === rule.id) {
                return false;
            }
            return rangesOverlap(
                minSubtotal,
                maxSubtotal,
                Number(existing.minSubtotalDollars),
                existing.maxSubtotalDollars === null ? null : Number(existing.maxSubtotalDollars)
            );
        }) || null;
    };

    const normalizeOrderAmountRule = (rule) => ({
        ...rule,
        minSubtotalDollars: Number(rule.minSubtotalDollars),
        maxSubtotalDollars: rule.maxSubtotalDollars === null || rule.maxSubtotalDollars === '' ? null : Number(rule.maxSubtotalDollars)
    });


    const validateEventTypeRule = (rule, store) => {
        const name = normalizeName(rule.eventTypeName || '');
        if (!name) {
            return { valid: false, message: 'Select event type' };
        }
        const duplicate = store.eventTypeRules.find((existing) => {
            if (rule.id && existing.id === rule.id) {
                return false;
            }
            return normalizeName(existing.eventTypeName).toLowerCase() === name.toLowerCase();
        });
        if (duplicate) {
            return { valid: false, message: 'Event type name must be unique.' };
        }
        if (rule.calcType === 'percent') {
            if (!isPercentValid(rule.percent)) {
                return { valid: false, message: 'Percent must be between 0 and 100.' };
            }
        } else if (!isCentsValid(rule.amountCents)) {
            return { valid: false, message: 'Add fee amount' };
        }
        return { valid: true, message: '' };
    };

    const validateGuestCountRule = (rule, store) => {
        const minGuests = Number(rule.minGuests);
        const maxGuests = rule.maxGuests === null ? null : Number(rule.maxGuests);

        if (!Number.isFinite(minGuests) || minGuests < 0) {
            return { valid: false, message: 'Minimum party size must be 0 or greater.' };
        }
        if (maxGuests !== null && (!Number.isFinite(maxGuests) || maxGuests < minGuests)) {
            return { valid: false, message: 'Maximum party size must be greater than or equal to minimum.' };
        }
        if (rule.calcType === 'percent') {
            if (!isPercentValid(rule.percent)) {
                return { valid: false, message: 'Percent must be between 0 and 100.' };
            }
        } else if (!isCentsValid(rule.amountCents)) {
            return { valid: false, message: 'Add fee amount' };
        }

        const overlap = findGuestCountOverlap(rule, store.guestCountRules);
        if (overlap) {
            return { valid: false, message: 'Party size ranges cannot overlap.' };
        }

        return { valid: true, message: '' };
    };

    const validateOrderAmountRule = (rule, store) => {
        const minSubtotal = Number(rule.minSubtotalDollars);
        const maxSubtotal = rule.maxSubtotalDollars === null ? null : Number(rule.maxSubtotalDollars);

        if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
            return { valid: false, message: 'Minimum subtotal must be 0 or greater.' };
        }
        if (Number.isFinite(minSubtotal) && !Number.isInteger(minSubtotal)) {
            return { valid: false, message: 'Minimum subtotal must be a whole dollar amount.' };
        }
        if (maxSubtotal !== null && (!Number.isFinite(maxSubtotal) || maxSubtotal < minSubtotal)) {
            return { valid: false, message: 'Maximum subtotal must be greater than or equal to minimum.' };
        }
        if (maxSubtotal !== null && Number.isFinite(maxSubtotal) && !Number.isInteger(maxSubtotal)) {
            return { valid: false, message: 'Maximum subtotal must be a whole dollar amount.' };
        }
        if (rule.calcType === 'percent') {
            if (!isPercentValid(rule.percent)) {
                return { valid: false, message: 'Percent must be between 0 and 100.' };
            }
        } else if (!isCentsValid(rule.amountCents)) {
            return { valid: false, message: 'Add fee amount' };
        }

        const overlap = findOrderAmountOverlap(rule, store.orderAmountRules);
        if (overlap) {
            return { valid: false, message: 'Order amount ranges cannot overlap.' };
        }

        return { valid: true, message: '' };
    };

    const validateFullServiceRule = (rule) => {
        if (rule.calcType === 'percent') {
            if (!isPercentValid(rule.percent)) {
                return { valid: false, message: 'Percent must be between 0 and 100.' };
            }
        } else if (!isCentsValid(rule.amountCents)) {
            return { valid: false, message: 'Add fee amount' };
        }
        return { valid: true, message: '' };
    };

    const validateFullServiceConfig = (config) => {
        const mode = config.mode === 'a_la_carte' ? 'a_la_carte' : 'bundle';
        if (mode === 'bundle') {
            return validateFullServiceRule(config.bundle || createDefaultRule());
        }

        const components = config.components || {};
        const componentKeys = ['cutlery', 'staffing', 'setup', 'cleanup'];
        const activeKeys = componentKeys.filter(key => components[key]?.active);
        if (!activeKeys.length) {
            return { valid: false, message: 'Configure at least one service.' };
        }

        for (const key of activeKeys) {
            const validation = validateFullServiceRule(components[key] || createDefaultRule());
            if (!validation.valid) {
                return validation;
            }
        }

        return { valid: true, message: '' };
    };

    const getEventTypeRules = () => deepClone(loadStore().eventTypeRules);
    const getGuestCountRules = () => deepClone(loadStore().guestCountRules);
    const getOrderAmountRules = () => deepClone(loadStore().orderAmountRules);
    const getFullServiceConfig = () => deepClone(loadStore().fullServiceConfig);
    const getSettings = () => deepClone(loadStore().settings);

    const upsertEventTypeRule = (rule) => withStore((store) => {
        const payload = { ...rule };
        payload.eventTypeName = normalizeName(payload.eventTypeName || '');
        payload.active = payload.active !== false;
        if (!payload.id) {
            payload.id = generateId();
        }

        const validation = validateEventTypeRule(payload, store);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const index = store.eventTypeRules.findIndex((item) => item.id === payload.id);
        if (index >= 0) {
            store.eventTypeRules[index] = payload;
        } else {
            store.eventTypeRules.push(payload);
        }
    });

    const deleteEventTypeRule = (id) => withStore((store) => {
        store.eventTypeRules = store.eventTypeRules.filter((item) => item.id !== id);
    });

    const upsertGuestCountRule = (rule) => withStore((store) => {
        const payload = { ...rule };
        payload.active = payload.active !== false;
        payload.minGuests = Number(payload.minGuests);
        payload.maxGuests = payload.maxGuests === null || payload.maxGuests === '' ? null : Number(payload.maxGuests);
        if (!payload.id) {
            payload.id = generateId();
        }

        const validation = validateGuestCountRule(payload, store);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const index = store.guestCountRules.findIndex((item) => item.id === payload.id);
        if (index >= 0) {
            store.guestCountRules[index] = payload;
        } else {
            store.guestCountRules.push(payload);
        }
        store.guestCountRules.sort((a, b) => a.minGuests - b.minGuests);
    });

    const deleteGuestCountRule = (id) => withStore((store) => {
        store.guestCountRules = store.guestCountRules.filter((item) => item.id !== id);
    });

    const upsertOrderAmountRule = (rule) => withStore((store) => {
        const payload = { ...rule };
        payload.active = payload.active !== false;
        payload.minSubtotalDollars = Math.floor(Number(payload.minSubtotalDollars));
        payload.maxSubtotalDollars = payload.maxSubtotalDollars === null || payload.maxSubtotalDollars === '' ? null : Math.floor(Number(payload.maxSubtotalDollars));
        if (!payload.id) {
            payload.id = generateId();
        }

        const validation = validateOrderAmountRule(payload, store);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const index = store.orderAmountRules.findIndex((item) => item.id === payload.id);
        if (index >= 0) {
            store.orderAmountRules[index] = payload;
        } else {
            store.orderAmountRules.push(payload);
        }
        store.orderAmountRules.sort((a, b) => a.minSubtotalDollars - b.minSubtotalDollars);
    });

    const deleteOrderAmountRule = (id) => withStore((store) => {
        store.orderAmountRules = store.orderAmountRules.filter((item) => item.id !== id);
    });

    const updateFullServiceConfig = (config) => withStore((store) => {
        const nextConfig = {
            ...store.fullServiceConfig,
            ...config,
            bundle: {
                ...store.fullServiceConfig.bundle,
                ...(config.bundle || {})
            },
            components: {
                ...store.fullServiceConfig.components,
                ...(config.components || {})
            }
        };

        const validation = validateFullServiceConfig(nextConfig);
        if (!validation.valid) {
            throw new Error(validation.message);
        }
        store.fullServiceConfig = nextConfig;
    });

    const updateSettings = (settings) => withStore((store) => {
        store.settings = {
            ...store.settings,
            ...settings
        };
    });

    const getGuestCountRuleForCount = (guestCount, rules) => {
        const count = Number(guestCount);
        if (!Number.isFinite(count)) {
            return null;
        }
        const sorted = (rules || [])
            .map(normalizeGuestCountRule)
            .sort((a, b) => a.minGuests - b.minGuests);
        return sorted.find(rule => {
            const maxGuests = rule.maxGuests === null ? Infinity : rule.maxGuests;
            return rule.minGuests <= count && count <= maxGuests;
        }) || null;
    };

    const getOrderAmountRuleForSubtotal = (subtotalCents, rules) => {
        const subtotalDollars = Math.floor(Number(subtotalCents) / 100);
        if (!Number.isFinite(subtotalDollars)) {
            return null;
        }
        const sorted = (rules || [])
            .map(normalizeOrderAmountRule)
            .sort((a, b) => a.minSubtotalDollars - b.minSubtotalDollars);
        return sorted.find(rule => {
            const maxDollars = rule.maxSubtotalDollars === null ? Infinity : rule.maxSubtotalDollars;
            return rule.minSubtotalDollars <= subtotalDollars && subtotalDollars <= maxDollars;
        }) || null;
    };

    window.FeesStore = {
        loadStore,
        saveStore,
        getEventTypeRules,
        getGuestCountRules,
        getOrderAmountRules,
        getFullServiceConfig,
        getSettings,
        upsertEventTypeRule,
        deleteEventTypeRule,
        upsertGuestCountRule,
        deleteGuestCountRule,
        upsertOrderAmountRule,
        deleteOrderAmountRule,
        updateFullServiceConfig,
        updateSettings,
        validateEventTypeRule,
        validateGuestCountRule,
        validateOrderAmountRule,
        validateFullServiceRule,
        validateFullServiceConfig,
        findGuestCountOverlap,
        getGuestCountRuleForCount,
        findOrderAmountOverlap,
        getOrderAmountRuleForSubtotal
    };
})();
