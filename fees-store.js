(() => {
    const STORE_KEY = 'cateringFeesStore';
    const STORE_VERSION = 1;

    const createDefaultStore = () => ({
        version: STORE_VERSION,
        eventTypeRules: [],
        guestCountRules: [],
        fullServiceRule: {
            calcType: 'flat',
            amountCents: 0,
            percent: 0,
            active: false
        },
        settings: {
            guestCountMissingPolicy: 'skip',
            guestCountActive: false,
            guestCountCalcType: 'flat'
        }
    });

    const deepClone = (value) => JSON.parse(JSON.stringify(value));

    const loadStore = () => {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) {
            return createDefaultStore();
        }

        try {
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== STORE_VERSION) {
                return createDefaultStore();
            }
            const store = createDefaultStore();
            return {
                ...store,
                ...parsed,
                settings: {
                    ...store.settings,
                    ...(parsed.settings || {})
                },
                fullServiceRule: {
                    ...store.fullServiceRule,
                    ...(parsed.fullServiceRule || {})
                }
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

    const validateGuestCountContinuity = (rules) => {
        if (!rules.length) {
            return { valid: true, message: '' };
        }

        const sorted = rules
            .map(normalizeGuestCountRule)
            .sort((a, b) => a.minGuests - b.minGuests);
        const firstMin = sorted[0].minGuests;
        if (firstMin !== 0 && firstMin !== 1) {
            return { valid: false, message: 'First range must start at 0 or 1.' };
        }

        for (let i = 0; i < sorted.length; i += 1) {
            const current = sorted[i];
            const currentMax = current.maxGuests;
            if (currentMax === null) {
                if (i !== sorted.length - 1) {
                    return { valid: false, message: 'Open-ended range must be the last range.' };
                }
                return { valid: true, message: '' };
            }
            const next = sorted[i + 1];
            if (next && next.minGuests !== currentMax + 1) {
                return { valid: false, message: 'Guest count ranges must be continuous with no gaps.' };
            }
        }

        return { valid: true, message: '' };
    };

    const validateEventTypeRule = (rule, store) => {
        const name = normalizeName(rule.eventTypeName || '');
        if (!name) {
            return { valid: false, message: 'Event type name is required.' };
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
            return { valid: false, message: 'Amount must be 0 or greater.' };
        }
        return { valid: true, message: '' };
    };

    const validateGuestCountRule = (rule, store) => {
        const minGuests = Number(rule.minGuests);
        const maxGuests = rule.maxGuests === null ? null : Number(rule.maxGuests);

        if (!Number.isFinite(minGuests) || minGuests < 0) {
            return { valid: false, message: 'Minimum guests must be 0 or greater.' };
        }
        if (maxGuests !== null && (!Number.isFinite(maxGuests) || maxGuests < minGuests)) {
            return { valid: false, message: 'Maximum guests must be greater than or equal to minimum.' };
        }
        if (rule.calcType === 'percent') {
            if (!isPercentValid(rule.percent)) {
                return { valid: false, message: 'Percent must be between 0 and 100.' };
            }
        } else if (!isCentsValid(rule.amountCents)) {
            return { valid: false, message: 'Amount must be 0 or greater.' };
        }

        const overlap = findGuestCountOverlap(rule, store.guestCountRules);
        if (overlap) {
            return { valid: false, message: 'Guest count ranges cannot overlap.' };
        }

        const nextRules = store.guestCountRules.map(normalizeGuestCountRule);
        const nextIndex = nextRules.findIndex(item => item.id === rule.id);
        if (nextIndex >= 0) {
            nextRules[nextIndex] = normalizeGuestCountRule(rule);
        } else {
            nextRules.push(normalizeGuestCountRule(rule));
        }

        const continuity = validateGuestCountContinuity(nextRules);
        if (!continuity.valid) {
            return continuity;
        }

        return { valid: true, message: '' };
    };

    const validateFullServiceRule = (rule) => {
        if (rule.calcType === 'percent') {
            if (!isPercentValid(rule.percent)) {
                return { valid: false, message: 'Percent must be between 0 and 100.' };
            }
        } else if (!isCentsValid(rule.amountCents)) {
            return { valid: false, message: 'Amount must be 0 or greater.' };
        }
        return { valid: true, message: '' };
    };

    const getEventTypeRules = () => deepClone(loadStore().eventTypeRules);
    const getGuestCountRules = () => deepClone(loadStore().guestCountRules);
    const getFullServiceRule = () => deepClone(loadStore().fullServiceRule);
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
    });

    const deleteGuestCountRule = (id) => withStore((store) => {
        store.guestCountRules = store.guestCountRules.filter((item) => item.id !== id);
    });

    const updateFullServiceRule = (rule) => withStore((store) => {
        const payload = {
            ...store.fullServiceRule,
            ...rule
        };
        payload.active = payload.active === true;
        const validation = validateFullServiceRule(payload);
        if (!validation.valid) {
            throw new Error(validation.message);
        }
        store.fullServiceRule = payload;
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
        const matching = sorted.find(rule => {
            const maxGuests = rule.maxGuests === null ? Infinity : rule.maxGuests;
            return rule.minGuests <= count && count <= maxGuests;
        });
        if (matching) {
            return matching;
        }
        const lower = sorted.filter(rule => rule.minGuests < count);
        if (!lower.length) {
            return null;
        }
        return lower.reduce((best, rule) => (rule.minGuests > best.minGuests ? rule : best), lower[0]);
    };

    window.FeesStore = {
        loadStore,
        saveStore,
        getEventTypeRules,
        getGuestCountRules,
        getFullServiceRule,
        getSettings,
        upsertEventTypeRule,
        deleteEventTypeRule,
        upsertGuestCountRule,
        deleteGuestCountRule,
        updateFullServiceRule,
        updateSettings,
        validateEventTypeRule,
        validateGuestCountRule,
        validateFullServiceRule,
        findGuestCountOverlap,
        getGuestCountRuleForCount
    };
})();
