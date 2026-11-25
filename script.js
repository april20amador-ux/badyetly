/* ==========================================
BADYETLY - PERSONAL BUDGET TRACKER
COMPLETE UPDATED VERSION
========================================== */

const ACCOUNT_KEY = "badyetly_accounts";
const USER_KEY = "badyetly_user";
const THEME_KEY = "badyetly_theme";

let user = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
let accounts = [];
let activeFilterDate = null;
let activeHomePeriod = "all";
let activeReportMonth = "";

function setActiveUserSession(username, keepLoggedIn = true) {
    user = username;
    if (keepLoggedIn) {
        localStorage.setItem(USER_KEY, username);
        sessionStorage.removeItem(USER_KEY);
    } else {
        sessionStorage.setItem(USER_KEY, username);
        localStorage.removeItem(USER_KEY);
    }
}

function clearActiveUserSession() {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    user = null;
}

let data = {
    incomes: [],
    expenses: [],
    savings: [],
    budgets: {},
    customCategories: [],
    quickChips: [],
    recurringBills: [],
    settings: {
        deductSavingsFromBalance: false
    }
};

/* ==========================================
THEME, TOASTS, CUSTOM DIALOGS & PWA
========================================== */

function getCurrentTheme() {
    try {
        return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch (error) {
        return "light";
    }
}

function syncThemeUI(theme) {
    const isDark = theme === "dark";

    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
        button.textContent = isDark ? "☀ Light" : "☾ Dark";
        button.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );
    });

    const settingsBtn = document.getElementById("settingsThemeBtn");
    if (settingsBtn) {
        settingsBtn.textContent = isDark
            ? "Switch to Light Mode"
            : "Switch to Dark Mode";
    }

    const themeStatusText = document.getElementById("themeStatusText");
    if (themeStatusText) {
        themeStatusText.textContent = isDark
            ? "Currently using Midnight Dark Mode. Switch back to Light Mode anytime."
            : "Currently using Light Mode (Midnight Luxe). Switch to Dark Mode for comfortable night viewing.";
    }

    const metaTheme = document.getElementById("themeColorMeta");
    if (metaTheme) {
        metaTheme.setAttribute("content", isDark ? "#0B1220" : "#172B4D");
    }
}

function applyTheme(theme, redrawCharts = true) {
    const nextTheme = theme === "dark" ? "dark" : "light";

    if (nextTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    } else {
        document.documentElement.removeAttribute("data-theme");
    }

    try {
        localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
        console.error("Theme save error:", error);
    }

    syncThemeUI(nextTheme);

    if (redrawCharts && user) {
        drawChart();
        updateAnalytics();
    }
}

function toggleTheme() {
    const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
    showToast(
        nextTheme === "dark" ? "Midnight Dark Mode enabled." : "Light Mode enabled.",
        "info",
        2400
    );
}

function showToast(message, type = "info", duration = 3600) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    const safeType = ["success", "error", "warning", "info"].includes(type)
        ? type
        : "info";

    toast.className = "badyetly-toast badyetly-toast-" + safeType;

    const textSpan = document.createElement("span");
    textSpan.textContent = String(message || "");

    const closeSpan = document.createElement("span");
    closeSpan.className = "badyetly-toast-close";
    closeSpan.textContent = "×";
    closeSpan.setAttribute("aria-hidden", "true");

    toast.appendChild(textSpan);
    toast.appendChild(closeSpan);

    const removeToast = () => {
        if (toast.parentNode) {
            toast.remove();
        }
    };

    toast.addEventListener("click", removeToast);
    container.appendChild(toast);

    while (container.children.length > 4) {
        container.firstElementChild.remove();
    }

    if (duration > 0) {
        setTimeout(removeToast, duration);
    }
}

let activeDialogResolver = null;
let activeDialogMode = "confirm";

function openDialogModal({
    mode = "confirm",
    eyebrow = "CONFIRMATION",
    title = "Please Confirm",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false,
    label = "Value",
    placeholder = "",
    defaultValue = "",
    inputType = "text"
}) {
    const modal = document.getElementById("dialogModal");
    const eyebrowEl = document.getElementById("dialogModalEyebrow");
    const titleEl = document.getElementById("dialogModalTitle");
    const messageEl = document.getElementById("dialogModalMessage");
    const inputWrap = document.getElementById("dialogModalInputWrap");
    const inputLabel = document.getElementById("dialogModalInputLabel");
    const inputEl = document.getElementById("dialogModalInput");
    const cancelBtn = document.getElementById("dialogModalCancelBtn");
    const confirmBtn = document.getElementById("dialogModalConfirmBtn");

    if (!modal || !titleEl || !messageEl || !confirmBtn) {
        return Promise.resolve(mode === "confirm" ? false : null);
    }

    if (activeDialogResolver) {
        const previousResolver = activeDialogResolver;
        activeDialogResolver = null;
        previousResolver(activeDialogMode === "confirm" ? false : null);
    }

    activeDialogMode = mode;

    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    titleEl.textContent = title;
    messageEl.textContent = message;

    if (cancelBtn) {
        cancelBtn.textContent = cancelText;
    }

    confirmBtn.textContent = confirmText;
    confirmBtn.className = danger ? "btn-danger" : "btn-primary";

    if (inputWrap && inputEl && inputLabel) {
        if (mode === "prompt") {
            inputWrap.style.display = "flex";
            inputLabel.textContent = label;
            inputEl.type = inputType;
            inputEl.placeholder = placeholder;
            inputEl.value = defaultValue;
        } else {
            inputWrap.style.display = "none";
            inputEl.value = "";
        }
    }

    modal.style.display = "flex";

    setTimeout(() => {
        if (mode === "prompt" && inputEl) {
            inputEl.focus();
            inputEl.select();
        } else {
            confirmBtn.focus();
        }
    }, 20);

    return new Promise(resolve => {
        activeDialogResolver = resolve;
    });
}

function showConfirmModal(options) {
    const opts = typeof options === "string"
        ? { message: options }
        : (options || {});

    return openDialogModal({
        mode: "confirm",
        eyebrow: opts.eyebrow || "CONFIRMATION",
        title: opts.title || "Please Confirm",
        message: opts.message || "",
        confirmText: opts.confirmText || "Confirm",
        cancelText: opts.cancelText || "Cancel",
        danger: Boolean(opts.danger)
    });
}

function showPromptModal(options) {
    const opts = typeof options === "string"
        ? { message: options }
        : (options || {});

    return openDialogModal({
        mode: "prompt",
        eyebrow: opts.eyebrow || "INPUT REQUIRED",
        title: opts.title || "Enter Details",
        message: opts.message || "",
        label: opts.label || "Value",
        placeholder: opts.placeholder || "",
        defaultValue: opts.defaultValue || "",
        inputType: opts.inputType || "text",
        confirmText: opts.confirmText || "Continue",
        cancelText: opts.cancelText || "Cancel"
    });
}

function closeDialogModal(result) {
    const modal = document.getElementById("dialogModal");
    if (modal) modal.style.display = "none";

    if (activeDialogResolver) {
        const resolver = activeDialogResolver;
        activeDialogResolver = null;
        if (activeDialogMode === "confirm") {
            resolver(Boolean(result));
        } else {
            resolver(result === null || result === undefined ? null : String(result));
        }
    }
}

function submitDialogModal(event) {
    event.preventDefault();

    if (activeDialogMode === "confirm") {
        closeDialogModal(true);
        return;
    }

    const inputEl = document.getElementById("dialogModalInput");
    closeDialogModal(inputEl ? inputEl.value : "");
}

let deferredPWAPrompt = null;
let isPWAStandalone = false;
let isIOSDevice = false;
let isInAppBrowser = false;

function openIOSInstallModal() {
    const modal = document.getElementById("iosInstallModal");
    if (modal) modal.style.display = "flex";
}

function closeIOSInstallModal() {
    const modal = document.getElementById("iosInstallModal");
    if (modal) modal.style.display = "none";
}

function updatePWAUI() {
    const topBtn = document.getElementById("pwaInstallTopBtn");
    const authBtn = document.getElementById("pwaInstallAuthBtn");
    const settingsBtn = document.getElementById("pwaInstallSettingsBtn");
    const badge = document.getElementById("pwaStatusBadge");
    const statusText = document.getElementById("pwaStatusText");

    if (isPWAStandalone) {
        if (topBtn) topBtn.style.display = "none";
        if (authBtn) authBtn.style.display = "none";
        if (settingsBtn) settingsBtn.style.display = "none";
        if (badge) {
            badge.textContent = "Installed App Mode";
            badge.classList.add("pwa-status-installed");
        }
        if (statusText) {
            statusText.textContent = "Badyetly is running as an installed app on this device and works offline.";
        }
        return;
    }

    if (deferredPWAPrompt) {
        if (topBtn) topBtn.style.display = "inline-flex";
        if (authBtn) authBtn.style.display = "inline-flex";
        if (settingsBtn) {
            settingsBtn.style.display = "inline-flex";
            settingsBtn.textContent = "⇩ Install Badyetly";
        }
        if (badge) {
            badge.textContent = "Ready to Install";
            badge.classList.remove("pwa-status-installed");
        }
        if (statusText) {
            statusText.textContent = "Install Badyetly directly onto your home screen or desktop for offline access.";
        }
        return;
    }

    if (isIOSDevice) {
        if (topBtn) topBtn.style.display = "inline-flex";
        if (authBtn) authBtn.style.display = "inline-flex";
        if (settingsBtn) {
            settingsBtn.style.display = "inline-flex";
            settingsBtn.textContent = "Install on iOS";
        }
        if (badge) {
            badge.textContent = isInAppBrowser ? "In-App Browser (Open in Safari)" : "Safari Web Mode";
            badge.classList.remove("pwa-status-installed");
        }
        if (statusText) {
            statusText.textContent = isInAppBrowser
                ? "You are inside Messenger/Facebook browser. Tap ••• → Open in Safari, then tap Share → Add to Home Screen."
                : "On iPhone or iPad, tap Share → Add to Home Screen to install Badyetly.";
        }
        return;
    }

    if (topBtn) topBtn.style.display = "inline-flex";
    if (authBtn) authBtn.style.display = "inline-flex";
    if (settingsBtn) {
        settingsBtn.style.display = "inline-flex";
        settingsBtn.textContent = "⇩ How to Install";
    }
    if (badge) {
        badge.textContent = isInAppBrowser
            ? "In-App Browser (Open in Chrome)"
            : "Browser Mode (Offline Ready)";
        badge.classList.remove("pwa-status-installed");
    }
    if (statusText) {
        statusText.textContent = isInAppBrowser
            ? "Open this page in Chrome (tap ⋮ or ••• → Open in Chrome), then tap Install App."
            : "Offline caching is supported. Tap How to Install or use your browser menu ('Install app' or 'Add to Home screen').";
    }
    if (typeof renderAboutDetailsMeta === "function") {
        renderAboutDetailsMeta();
    }
}

async function triggerPWAInstall() {
    if (isPWAStandalone) {
        showToast("Badyetly is already installed on this device.", "info");
        return;
    }

    if (deferredPWAPrompt) {
        deferredPWAPrompt.prompt();
        const choice = await deferredPWAPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
            isPWAStandalone = true;
            deferredPWAPrompt = null;
            showToast("Badyetly installed! You can now launch it from your home screen.", "success");
        }
        updatePWAUI();
        return;
    }

    if (isIOSDevice) {
        if (isInAppBrowser) {
            await showConfirmModal({
                eyebrow: "OPEN IN SAFARI",
                title: "Open in Safari to Install",
                message:
                    "You opened Badyetly inside Messenger or an in-app browser.\n\n" +
                    "To install Badyetly on iPhone/iPad:\n" +
                    "1. Tap the ••• menu at the top corner.\n" +
                    "2. Tap 'Open in Safari' (or Open in Browser).\n" +
                    "3. In Safari, tap Share → Add to Home Screen.",
                confirmText: "Got it",
                cancelText: "Close"
            });
            return;
        }
        openIOSInstallModal();
        return;
    }

    if (isInAppBrowser) {
        await showConfirmModal({
            eyebrow: "OPEN IN CHROME",
            title: "Open in Chrome to Install",
            message:
                "You opened Badyetly inside Messenger or an in-app browser, which blocks app installation.\n\n" +
                "1. Tap the ⋮ or ••• menu at the top corner.\n" +
                "2. Select 'Open in Chrome' (or Open in Browser).\n" +
                "3. Then tap Install App or Menu → Add to Home screen.",
            confirmText: "Got it",
            cancelText: "Close"
        });
        return;
    }

    await showConfirmModal({
        eyebrow: "INSTALL APP",
        title: "Install Badyetly on This Device",
        message:
            "Use your browser menu to install Badyetly:\n\n" +
            "1. Tap the ⋮ or ••• menu in Chrome/Edge.\n" +
            "2. Select 'Install app' or 'Add to Home screen'.\n\n" +
            "(Note: If Badyetly is already installed on this phone, or you are in Incognito mode, the auto-install popup won't appear.)",
        confirmText: "Got it",
        cancelText: "Close"
    });
}

function updateOnlineStatus(showNotification = false) {
    const banner = document.getElementById("offlineBanner");
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;

    if (banner) {
        banner.style.display = online ? "none" : "inline-flex";
    }

    if (showNotification) {
        showToast(
            online
                ? "You are back online."
                : "Offline mode active. Changes remain saved locally.",
            online ? "success" : "warning"
        );
    }
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    const isSecureContext =
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    if (!isSecureContext) return;

    navigator.serviceWorker.register("./sw.js").catch(error => {
        console.warn("Service worker registration skipped:", error);
    });
}

function initPWA() {
    isPWAStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

    const ua = window.navigator.userAgent.toLowerCase();
    isIOSDevice = /iphone|ipad|ipod/.test(ua);
    isInAppBrowser = /fban|fbav|fb_iab|messenger|instagram|line|micromessenger|\bwv\b/.test(ua);

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        deferredPWAPrompt = event;
        updatePWAUI();
    });

    window.addEventListener("appinstalled", () => {
        isPWAStandalone = true;
        deferredPWAPrompt = null;
        updatePWAUI();
        showToast("Badyetly has been installed!", "success");
    });

    window.addEventListener("online", () => updateOnlineStatus(true));
    window.addEventListener("offline", () => updateOnlineStatus(true));

    updatePWAUI();
    updateOnlineStatus(false);
}

/* ==========================================
STORAGE AND DATA
========================================== */

function getUserDataKey(name) {
    return "badyetly_data_" +
        String(name || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_");
}

function loadAccounts() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(ACCOUNT_KEY) || "[]"
        );

        if (Array.isArray(saved)) {
            accounts = saved;
        } else if (saved && typeof saved === "object") {
            accounts = Object.entries(saved).map(([name, account]) => {
                if (typeof account === "string") {
                    return { name, pass: account };
                }

                return {
                    ...account,
                    name: account.name || name
                };
            });
        } else {
            accounts = [];
        }

        accounts = accounts.filter(account =>
            account &&
            typeof account.name === "string"
        );

    } catch (error) {
        console.error("Account loading error:", error);
        accounts = [];
    }
}

function saveAccounts() {
    try {
        localStorage.setItem(
            ACCOUNT_KEY,
            JSON.stringify(accounts)
        );
        return true;
    } catch (error) {
        console.error("Account saving error:", error);
        showToast("Unable to save accounts. Check your browser storage.", "error");
        return false;
    }
}

function getDefaultQuickChips() {
    return [
        { id: "chip_pamasahe", label: "Pamasahe", amount: 25, cat: "Transportation" },
        { id: "chip_kape", label: "Kape", amount: 120, cat: "Food & Drinks" },
        { id: "chip_lunch", label: "Lunch", amount: 150, cat: "Food & Drinks" },
        { id: "chip_load", label: "Mobile Load", amount: 50, cat: "Bills & Utilities" },
        { id: "chip_snacks", label: "Snacks", amount: 40, cat: "Food & Drinks" }
    ];
}

function normalizeQuickChips(rawChips) {
    if (rawChips === undefined || rawChips === null) {
        return getDefaultQuickChips();
    }
    if (!Array.isArray(rawChips)) {
        return getDefaultQuickChips();
    }

    return rawChips
        .filter(chip => chip && typeof chip === "object")
        .map(chip => ({
            id: String(chip.id || makeId()),
            label: String(chip.label || "").trim(),
            amount: Math.max(0, Number(chip.amount) || 0),
            cat: String(chip.cat || "Others").trim() || "Others"
        }))
        .filter(chip => chip.label && chip.amount > 0);
}

function normalizeRecurringBills(rawBills) {
    if (!Array.isArray(rawBills)) return [];

    return rawBills
        .filter(bill => bill && typeof bill === "object")
        .map(bill => ({
            id: String(bill.id || makeId()),
            name: String(bill.name || "").trim(),
            amount: Math.max(0, Number(bill.amount) || 0),
            cat: String(bill.cat || "Bills & Utilities").trim() || "Bills & Utilities",
            dueDay: Math.min(31, Math.max(1, parseInt(bill.dueDay, 10) || 1)),
            lastPaidMonth: /^\d{4}-\d{2}$/.test(String(bill.lastPaidMonth || ""))
                ? String(bill.lastPaidMonth)
                : "",
            lastPaidDate: /^\d{4}-\d{2}-\d{2}$/.test(String(bill.lastPaidDate || ""))
                ? String(bill.lastPaidDate)
                : ""
        }))
        .filter(bill => bill.name && bill.amount > 0);
}

function normalizeUserSettings(rawSettings) {
    return {
        deductSavingsFromBalance: Boolean(
            rawSettings && rawSettings.deductSavingsFromBalance
        )
    };
}

function normalizeCustomCategories(rawCategories) {
    if (!Array.isArray(rawCategories)) return [];

    const defaultsLower = new Set(BADYETLY_CATEGORIES.map(c => c.toLowerCase()));
    const seen = new Set();
    const cleaned = [];

    rawCategories.forEach(item => {
        const name = String(item || "").trim().slice(0, 60);
        if (!name) return;
        const lower = name.toLowerCase();
        if (defaultsLower.has(lower) || seen.has(lower)) return;
        seen.add(lower);
        cleaned.push(name);
    });

    return cleaned.slice(0, 50);
}

function extractImplicitCustomCategories(expenses, budgets, existingCustom) {
    const merged = [...(Array.isArray(existingCustom) ? existingCustom : [])];
    if (Array.isArray(expenses)) {
        expenses.forEach(item => {
            if (item && item.cat) merged.push(String(item.cat));
        });
    }
    if (budgets && typeof budgets === "object") {
        Object.keys(budgets).forEach(cat => merged.push(String(cat)));
    }
    return normalizeCustomCategories(merged);
}

function emptyData() {
    return {
        incomes: [],
        expenses: [],
        savings: [],
        budgets: {},
        customCategories: [],
        quickChips: getDefaultQuickChips(),
        recurringBills: [],
        settings: {
            deductSavingsFromBalance: false
        }
    };
}

function normalizeSavingsGoals(rawSavings) {
    if (Array.isArray(rawSavings)) {
        return rawSavings
            .filter(goal => goal && typeof goal === "object")
            .map(goal => ({
                id: String(goal.id || makeId()),
                name: String(goal.name || "My Goal").trim() || "My Goal",
                target: Math.max(0, Number(goal.target) || 0),
                current: Math.max(0, Number(goal.current) || 0),
                deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(goal.deadline || ""))
                    ? String(goal.deadline)
                    : "",
                deductFromBalance: Boolean(goal.deductFromBalance)
            }))
            .filter(goal => goal.target > 0);
    }

    if (rawSavings && typeof rawSavings === "object" && rawSavings.name) {
        const target = Math.max(0, Number(rawSavings.target) || 0);
        if (target > 0) {
            return [{
                id: String(rawSavings.id || makeId()),
                name: String(rawSavings.name).trim() || "My Goal",
                target: target,
                current: Math.max(0, Number(rawSavings.current) || 0),
                deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(rawSavings.deadline || ""))
                    ? String(rawSavings.deadline)
                    : "",
                deductFromBalance: Boolean(rawSavings.deductFromBalance)
            }];
        }
    }

    return [];
}

function loadUserData(name) {
    try {
        const saved = localStorage.getItem(
            getUserDataKey(name)
        );

        if (!saved) return emptyData();

        const parsed = JSON.parse(saved);
        const incomes = Array.isArray(parsed.incomes) ? parsed.incomes : [];
        const expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
        const budgets = parsed.budgets && typeof parsed.budgets === "object" ? parsed.budgets : {};

        return {
            incomes: incomes,
            expenses: expenses,
            savings: normalizeSavingsGoals(parsed.savings),
            budgets: budgets,
            customCategories: extractImplicitCustomCategories(expenses, budgets, parsed.customCategories),
            quickChips: normalizeQuickChips(parsed.quickChips),
            recurringBills: normalizeRecurringBills(parsed.recurringBills),
            settings: normalizeUserSettings(parsed.settings)
        };

    } catch (error) {
        console.error("Data loading error:", error);
        return emptyData();
    }
}

function saveUserData(skipCloudSchedule = false) {
    if (!user) return;

    try {
        localStorage.setItem(
            getUserDataKey(user),
            JSON.stringify(data)
        );

        renderAll();

        if (!skipCloudSchedule && typeof scheduleCloudSync === "function") {
            scheduleCloudSync();
        }

    } catch (error) {
        console.error("Data saving error:", error);
        showToast("Unable to save data. Your browser storage may be full.", "error");
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]
    );
}

function money(amount) {
    const num = Number(amount || 0);
    const sign = num < 0 ? "-" : "";
    return sign + "₱" + Math.abs(num).toLocaleString(
        "en-PH",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}

const BALANCE_PRIVACY_KEY = "badyetly_hide_balance";

function getUserPrefKey(name, suffix) {
    return "badyetly_pref_" +
        String(name || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "_") +
        "_" + suffix;
}

function getDefaultHomePeriodPref(name = user) {
    if (!name) return "all";
    try {
        return localStorage.getItem(getUserPrefKey(name, "default_period")) === "this_month"
            ? "this_month"
            : "all";
    } catch (error) {
        return "all";
    }
}

function setDefaultHomePeriodPref(value) {
    if (!user) return;
    const cleanVal = value === "this_month" ? "this_month" : "all";
    try {
        localStorage.setItem(getUserPrefKey(user, "default_period"), cleanVal);
    } catch (error) {}

    activeHomePeriod = cleanVal === "this_month" ? getCurrentMonthKey() : "all";
    renderAll();
    showToast(
        cleanVal === "this_month"
            ? "Default Home view set to This Month."
            : "Default Home view set to All Time.",
        "info"
    );
}

function getHideBalanceDefaultPref(name = user) {
    if (!name) return false;
    try {
        return localStorage.getItem(getUserPrefKey(name, "hide_balance")) === "true";
    } catch (error) {
        return false;
    }
}

function setHideBalanceDefaultPref(enabled) {
    if (!user) return;
    const isHidden = Boolean(enabled);
    try {
        localStorage.setItem(getUserPrefKey(user, "hide_balance"), isHidden ? "true" : "false");
        localStorage.setItem(BALANCE_PRIVACY_KEY, isHidden ? "true" : "false");
    } catch (error) {}

    renderAll();
    showToast(
        isHidden
            ? "Balance amounts will stay hidden by default on open."
            : "Balance amounts will be visible by default on open.",
        "info"
    );
}

function recordBackupTimestamp(name = user) {
    if (!name) return;
    try {
        localStorage.setItem(getUserPrefKey(name, "last_backup"), new Date().toISOString());
    } catch (error) {}
}

function getLastBackupInfo(name = user) {
    if (!name) return "";
    try {
        return localStorage.getItem(getUserPrefKey(name, "last_backup")) || "";
    } catch (error) {
        return "";
    }
}

function triggerImportBackup() {
    const input = document.getElementById("importFile");
    if (input) input.click();
}

let currentViewName = "home";
let currentSettingsTab = "preferences";
let viewNavStack = [];

function getNavLocationLabel(view, settingsTab = "preferences") {
    switch (view) {
        case "home": return "Home";
        case "dashboard": return "Transactions";
        case "analytics": return "Analytics";
        case "budget": return "Budget Planner";
        case "goals": return "Savings Goals";
        case "guide": return "User Guide";
        case "help": return "Help Center";
        case "settings":
            return settingsTab === "about"
                ? "About Badyetly"
                : "Settings & Data";
        default: return "Previous Page";
    }
}

function updateBackNavUI() {
    const bar = document.getElementById("viewBackBar");
    const labelEl = document.getElementById("viewBackLabel");
    const hintEl = document.getElementById("viewBackHint");
    const pill = document.getElementById("mobileBackPill");
    const pillLabel = document.getElementById("mobileBackPillLabel");

    const prev = viewNavStack.length ? viewNavStack[viewNavStack.length - 1] : null;

    if (!prev) {
        if (bar) bar.style.display = "none";
        if (pill) {
            pill.style.display = "none";
            pill.classList.remove("is-visible");
        }
        return;
    }

    const destLabel = prev.label || getNavLocationLabel(prev.view, prev.settingsTab);
    if (labelEl) labelEl.textContent = "Back to " + destLabel;
    if (hintEl) hintEl.textContent = "Return to " + destLabel;
    if (bar) bar.style.display = "flex";

    if (pill && pillLabel) {
        pillLabel.textContent = (prev.view === "settings" && prev.settingsTab === "about")
            ? "Back to About"
            : "Back to " + destLabel;
        pill.style.display = "";
        pill.classList.add("is-visible");
        pill.setAttribute("aria-label", "Back to " + destLabel);
    }
}

function clearBackNav() {
    viewNavStack = [];
    updateBackNavUI();
}

function navigateFromShortcut(targetView, targetSettingsTab = null, scrollSelector = "") {
    const nextView = targetView || currentViewName;
    const nextTab = nextView === "settings"
        ? (targetSettingsTab || currentSettingsTab || "preferences")
        : currentSettingsTab;

    const prevSnapshot = {
        view: currentViewName,
        settingsTab: currentSettingsTab,
        label: getNavLocationLabel(currentViewName, currentSettingsTab),
        scrollY: typeof window !== "undefined" ? (window.scrollY || 0) : 0
    };

    const isSameSpot =
        prevSnapshot.view === nextView &&
        (nextView !== "settings" || prevSnapshot.settingsTab === nextTab);

    if (!isSameSpot) {
        viewNavStack.push(prevSnapshot);
        if (viewNavStack.length > 10) {
            viewNavStack.shift();
        }
        try {
            if (window.history && typeof window.history.pushState === "function") {
                window.history.pushState({ badyetlyBack: true }, "");
            }
        } catch (error) {}
    }

    showView(nextView, {
        preserveStack: true,
        skipScrollTop: Boolean(scrollSelector)
    });

    if (nextView === "settings" && targetSettingsTab) {
        setSettingsTab(targetSettingsTab, { preserveStack: true });
    }

    updateBackNavUI();

    if (scrollSelector) {
        setTimeout(() => {
            const targetEl = document.querySelector(scrollSelector);
            if (!targetEl) return;
            const rect = targetEl.getBoundingClientRect();
            const topOffset = window.innerWidth <= 760 ? 74 : 20;
            window.scrollTo({
                top: Math.max(0, (window.scrollY || 0) + rect.top - topOffset),
                behavior: "smooth"
            });
        }, 60);
    } else if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "auto" });
    }
}

function goBackNav() {
    if (!viewNavStack.length) {
        clearBackNav();
        return;
    }

    const prev = viewNavStack.pop();

    showView(prev.view, {
        preserveStack: true,
        skipScrollTop: true
    });

    if (prev.view === "settings") {
        setSettingsTab(prev.settingsTab || "preferences", { preserveStack: true });
    }

    updateBackNavUI();

    if (typeof window !== "undefined") {
        const restoreY = Math.max(0, Number(prev.scrollY) || 0);
        requestAnimationFrame(() => {
            window.scrollTo({ top: restoreY, behavior: "auto" });
        });
    }
}
function setSettingsTab(tab, options = {}) {
    const isAbout = tab === "about";
    const prefsPanel = document.getElementById("settingsPanelPrefs");
    const aboutPanel = document.getElementById("settingsPanelAbout");
    const prefsBtn = document.getElementById("settingsTabPrefs");
    const aboutBtn = document.getElementById("settingsTabAbout");

    currentSettingsTab = isAbout ? "about" : "preferences";

    if (prefsPanel) prefsPanel.style.display = isAbout ? "none" : "grid";
    if (aboutPanel) aboutPanel.style.display = isAbout ? "block" : "none";

    if (prefsBtn) {
        prefsBtn.classList.toggle("active", !isAbout);
        prefsBtn.setAttribute("aria-selected", String(!isAbout));
    }
    if (aboutBtn) {
        aboutBtn.classList.toggle("active", isAbout);
        aboutBtn.setAttribute("aria-selected", String(isAbout));
    }

    if (options && options.fromUserClick && !options.preserveStack) {
        viewNavStack = [];
    }

    if (isAbout) {
        renderAboutDetailsMeta();
    }

    updateBackNavUI();
}

function renderAboutDetailsMeta() {
    const storageEl = document.getElementById("aboutStorageStatus");
    const recordsEl = document.getElementById("aboutRecordsCount");
    const appModeEl = document.getElementById("aboutAppMode");
    const lastBackupEl = document.getElementById("aboutLastBackup");
    const isFileMode = typeof window !== "undefined" && window.location.protocol === "file:";

    if (storageEl) {
        if (typeof cloudSyncUser !== "undefined" && cloudSyncUser) {
            storageEl.textContent = cloudSyncBusy
                ? "Google Cloud Sync (Syncing...)"
                : "Local + Google Cloud Sync";
        } else if (isFileMode) {
            storageEl.textContent = "Local Device Storage (File Mode)";
        } else {
            storageEl.textContent = "Local Device Storage";
        }
    }

    if (recordsEl && user) {
        const goalsCount = normalizeSavingsGoals(data.savings).length;
        recordsEl.textContent =
            data.incomes.length + (data.incomes.length === 1 ? " Income" : " Incomes") +
            " · " +
            data.expenses.length + (data.expenses.length === 1 ? " Expense" : " Expenses") +
            " · " +
            goalsCount + (goalsCount === 1 ? " Goal" : " Goals");
    }

    if (appModeEl) {
        if (typeof isPWAStandalone !== "undefined" && isPWAStandalone) {
            appModeEl.textContent = "Installed App (Offline Ready)";
        } else if (isFileMode) {
            appModeEl.textContent = "Local HTML File Mode";
        } else {
            appModeEl.textContent = "Browser Mode (Offline Ready)";
        }
    }

    if (lastBackupEl && user) {
        const lastIso = getLastBackupInfo(user);
        const parsed = lastIso ? new Date(lastIso) : null;
        if (parsed && !isNaN(parsed.getTime())) {
            lastBackupEl.textContent = parsed.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit"
            });
        } else {
            lastBackupEl.textContent = "Not backed up yet";
        }
    }
}

function renderSettingsMeta() {
    if (!user) return;

    const goalsCount = normalizeSavingsGoals(data.savings).length;
    const customCount = normalizeCustomCategories(data.customCategories).length;

    const dataSummaryEl = document.getElementById("settingsDataSummary");
    if (dataSummaryEl) {
        dataSummaryEl.textContent =
            data.incomes.length + (data.incomes.length === 1 ? " Income" : " Incomes") +
            " · " +
            data.expenses.length + (data.expenses.length === 1 ? " Expense" : " Expenses") +
            " · " +
            goalsCount + (goalsCount === 1 ? " Goal" : " Goals") +
            " · " +
            customCount + " Custom " + (customCount === 1 ? "Category" : "Categories");
    }

    const lastBackupEl = document.getElementById("lastBackupInfo");
    if (lastBackupEl) {
        const lastIso = getLastBackupInfo(user);
        const parsed = lastIso ? new Date(lastIso) : null;
        if (parsed && !isNaN(parsed.getTime())) {
            const formatted = parsed.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit"
            });
            lastBackupEl.textContent = "Last JSON backup: " + formatted;
            lastBackupEl.classList.add("has-backup");
        } else {
            lastBackupEl.textContent = "No JSON backup downloaded yet — save a copy regularly.";
            lastBackupEl.classList.remove("has-backup");
        }
    }

    const catSummaryEl = document.getElementById("settingsCategoriesSummary");
    if (catSummaryEl) {
        catSummaryEl.textContent =
            BADYETLY_CATEGORIES.length + " built-in categories · " +
            customCount + " custom " + (customCount === 1 ? "category" : "categories") +
            " · " + normalizeQuickChips(data.quickChips).length + " quick-add chips.";
    }

    const renameInput = document.getElementById("renameAccountInput");
    if (renameInput) {
        renameInput.placeholder = "Current: " + user;
    }

    const defaultPeriodSelect = document.getElementById("prefDefaultHomePeriod");
    if (defaultPeriodSelect) {
        defaultPeriodSelect.value = getDefaultHomePeriodPref(user);
    }

    const hideBalanceCheckbox = document.getElementById("prefHideBalanceDefault");
    if (hideBalanceCheckbox) {
        hideBalanceCheckbox.checked = getHideBalanceDefaultPref(user);
    }

    const fileNotice = document.getElementById("cloudSyncFileNotice");
    if (fileNotice && typeof window !== "undefined") {
        fileNotice.style.display = window.location.protocol === "file:" ? "block" : "none";
    }

    renderAboutDetailsMeta();
}

function isBalanceHidden() {
    return localStorage.getItem(BALANCE_PRIVACY_KEY) === "true";
}

function toggleBalancePrivacy() {
    const nextHidden = !isBalanceHidden();
    localStorage.setItem(BALANCE_PRIVACY_KEY, nextHidden ? "true" : "false");
    renderAll();
}

async function setStartingBalance() {
    const raw = await showPromptModal({
        eyebrow: "OPENING BALANCE",
        title: "Set Starting Balance",
        message: "Enter the cash or bank/e-wallet money you already had before logging expenses so your Total Balance stays accurate.",
        label: "Starting Amount (₱)",
        placeholder: "e.g. 10000",
        inputType: "number",
        confirmText: "Add Starting Balance"
    });

    if (raw === null) return;

    const amount = parseFloat(String(raw).replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Please enter a valid positive amount.", "warning");
        return;
    }

    const dateEntry = buildDateEntry(todayISO());
    data.incomes.push({
        id: makeId(),
        source: "Starting Balance",
        amount: amount,
        date: dateEntry.date,
        ts: dateEntry.ts,
        dateISO: dateEntry.dateISO
    });

    saveUserData();
    showToast("Starting balance added (+" + money(amount) + ")!", "success");
}

function todayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;

    return new Date(now.getTime() - offset)
        .toISOString()
        .slice(0, 10);
}

function getDateISO() {
    return todayISO();
}

function getCurrentMonthKey() {
    return todayISO().slice(0, 7);
}

function getSelectedReportMonth() {
    if (!/^\d{4}-\d{2}$/.test(activeReportMonth)) {
        activeReportMonth = getCurrentMonthKey();
    }
    return activeReportMonth;
}

function formatMonthLabel(monthKey, shortMonth = false) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
        return "This Month";
    }
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", {
        month: shortMonth ? "short" : "long",
        year: "numeric"
    });
}

function formatFullDateLabel(dateISO, shortMonth = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO || ""))) {
        return "";
    }
    const parsed = new Date(dateISO + "T12:00:00");
    if (isNaN(parsed.getTime())) return String(dateISO);
    return parsed.toLocaleDateString("en-US", {
        month: shortMonth ? "short" : "long",
        day: "numeric",
        year: "numeric"
    });
}

function buildDateEntry(dateISOInput) {
    const cleanISO = /^\d{4}-\d{2}-\d{2}$/.test(String(dateISOInput || ""))
        ? String(dateISOInput)
        : todayISO();

    const today = todayISO();
    if (cleanISO === today) {
        const now = new Date();
        return {
            dateISO: cleanISO,
            date: now.toLocaleDateString(),
            ts: now.getTime()
        };
    }

    const parsed = new Date(cleanISO + "T12:00:00");
    return {
        dateISO: cleanISO,
        date: !isNaN(parsed.getTime()) ? parsed.toLocaleDateString() : cleanISO,
        ts: !isNaN(parsed.getTime()) ? parsed.getTime() : Date.now()
    };
}

function initTransactionDateDefaults() {
    const today = todayISO();
    const incomeDate = document.getElementById("incomeDate");
    const expenseDate = document.getElementById("expenseDate");

    if (incomeDate && !incomeDate.value) incomeDate.value = today;
    if (expenseDate && !expenseDate.value) expenseDate.value = today;
}

function setHomePeriod(value) {
    if (value === "all") {
        activeHomePeriod = "all";
    } else if (value === "current") {
        activeHomePeriod = getCurrentMonthKey();
    } else if (/^\d{4}-\d{2}$/.test(String(value || ""))) {
        activeHomePeriod = String(value);
    } else {
        activeHomePeriod = "all";
    }
    renderAll();
}

function setReportMonth(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return;
    activeReportMonth = String(monthKey);
    renderAll();
}

function resetReportMonth() {
    activeReportMonth = getCurrentMonthKey();
    renderAll();
}

function syncPeriodUI() {
    const currentMonth = getCurrentMonthKey();
    const reportMonth = getSelectedReportMonth();

    const allBtn = document.getElementById("homeAllTimeBtn");
    const thisMonthBtn = document.getElementById("homeThisMonthBtn");
    const homeMonthPicker = document.getElementById("homeMonthPicker");
    const homeSubtitle = document.getElementById("homePeriodSubtitle");

    if (allBtn) {
        allBtn.className = activeHomePeriod === "all"
            ? "btn-primary btn-small"
            : "btn-outline btn-small";
    }

    if (thisMonthBtn) {
        thisMonthBtn.className = activeHomePeriod === currentMonth
            ? "btn-primary btn-small"
            : "btn-outline btn-small";
    }

    if (homeMonthPicker) {
        homeMonthPicker.value = activeHomePeriod === "all" ? "" : activeHomePeriod;
    }

    if (homeSubtitle) {
        homeSubtitle.textContent = activeHomePeriod === "all"
            ? "Showing all recorded transactions."
            : "Showing financial summary for " + formatMonthLabel(activeHomePeriod) + ".";
    }

    const analyticsPicker = document.getElementById("analyticsMonthPicker");
    const budgetPicker = document.getElementById("budgetMonthPicker");

    if (analyticsPicker) analyticsPicker.value = reportMonth;
    if (budgetPicker) budgetPicker.value = reportMonth;
}

function getAccount(name) {
    return accounts.find(account =>
        String(account.name).trim().toLowerCase() ===
        String(name).trim().toLowerCase()
    ) || null;
}

function makeId() {
    return Date.now().toString() +
        Math.random().toString(36).slice(2, 8);
}

function sha256Hex(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    const utf8 = unescape(encodeURIComponent(String(ascii ?? "")));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = "";
    const words = [];
    const asciiBitLength = utf8.length * 8;
    const hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (let i = 0; i < 313; i += candidate) {
                isComposite[i] = candidate;
            }
            hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
    }
    let msg = utf8 + "\x80";
    while ((msg.length % 64) - 56) msg += "\x00";
    for (let i = 0; i < msg.length; i++) {
        const j = msg.charCodeAt(i);
        if (j >> 8) return "";
        words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length;) {
        const w = words.slice(j, j += 16);
        const oldHash = hash.slice(0);
        for (let i = 0; i < 64; i++) {
            const w15 = w[i - 15];
            const w2 = w[i - 2];
            const a = hash[0];
            const e = hash[4];
            const temp1 =
                hash[7] +
                (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
                ((e & hash[5]) ^ (~e & hash[6])) +
                k[i] +
                (w[i] = i < 16
                    ? w[i]
                    : (
                        w[i - 16] +
                        (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                        w[i - 7] +
                        (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                    ) | 0);
            const temp2 =
                (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
                ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
            hash.unshift((temp1 + temp2) | 0);
            hash[4] = (hash[4] + temp1) | 0;
            hash.pop();
        }
        for (let i = 0; i < 8; i++) {
            hash[i] = (hash[i] + oldHash[i]) | 0;
        }
    }
    for (let i = 0; i < 8; i++) {
        for (let j = 3; j + 1; j--) {
            const b = (hash[i] >> (j * 8)) & 255;
            result += (b < 16 ? "0" : "") + b.toString(16);
        }
    }
    return result;
}

function makeSalt() {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(12);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

function hashAccountSecret(secret, salt) {
    let digest = sha256Hex("badyetly:" + String(salt) + ":" + String(secret ?? ""));
    for (let i = 0; i < 200; i++) {
        digest = sha256Hex(digest + ":" + String(salt));
    }
    return digest;
}

function setAccountPasswordFields(account, plainPass) {
    const salt = makeSalt();
    account.passHash = hashAccountSecret(String(plainPass ?? ""), salt);
    account.passSalt = salt;
    delete account.pass;
    delete account.password;
    return account;
}

function hasAccountPassword(account) {
    if (!account) return false;
    return Boolean(
        (account.passHash && account.passSalt) ||
        account.pass !== undefined ||
        account.password !== undefined
    );
}

function verifyAccountPassword(account, plainPass) {
    if (!account) return false;
    if (account.passHash && account.passSalt) {
        return hashAccountSecret(String(plainPass ?? ""), account.passSalt) === account.passHash;
    }
    const legacy = account.pass !== undefined ? account.pass : account.password;
    if (legacy === undefined) return false;
    return String(legacy) === String(plainPass ?? "");
}

function setAccountRecoveryPinFields(account, pin) {
    const salt = makeSalt();
    account.recoveryPinHash = hashAccountSecret(String(pin).trim(), salt);
    account.recoveryPinSalt = salt;
    delete account.recoveryPin;
    return account;
}

function hasAccountRecoveryPin(account) {
    if (!account) return false;
    return Boolean((account.recoveryPinHash && account.recoveryPinSalt) || account.recoveryPin);
}

function verifyAccountRecoveryPin(account, enteredPin) {
    if (!hasAccountRecoveryPin(account)) return true;
    const clean = String(enteredPin ?? "").trim();
    if (account.recoveryPinHash && account.recoveryPinSalt) {
        return hashAccountSecret(clean, account.recoveryPinSalt) === account.recoveryPinHash;
    }
    return clean === String(account.recoveryPin);
}

function upgradeLegacyAccountFields(account) {
    if (!account) return false;
    let changed = false;
    const legacyPass = account.pass !== undefined ? account.pass : account.password;
    if (legacyPass !== undefined && (!account.passHash || !account.passSalt)) {
        setAccountPasswordFields(account, String(legacyPass));
        changed = true;
    } else if (account.pass !== undefined || account.password !== undefined) {
        delete account.pass;
        delete account.password;
        changed = true;
    }
    if (account.recoveryPin && (!account.recoveryPinHash || !account.recoveryPinSalt)) {
        setAccountRecoveryPinFields(account, account.recoveryPin);
        changed = true;
    } else if (account.recoveryPin !== undefined) {
        delete account.recoveryPin;
        changed = true;
    }
    return changed;
}

function buildBackupAccountMeta(account) {
    if (!account) return null;
    if (upgradeLegacyAccountFields(account)) {
        saveAccounts();
    }
    const meta = {};
    if (account.passHash && account.passSalt) {
        meta.passHash = account.passHash;
        meta.passSalt = account.passSalt;
    }
    if (account.recoveryPinHash && account.recoveryPinSalt) {
        meta.recoveryPinHash = account.recoveryPinHash;
        meta.recoveryPinSalt = account.recoveryPinSalt;
    }
    return Object.keys(meta).length ? meta : null;
}

function syncLoginPassRequirement(accountName) {
    const passEl = document.getElementById("loginPass");
    if (!passEl) return;
    const acc = accountName ? getAccount(accountName) : null;
    const needsPass = !acc || hasAccountPassword(acc) || Boolean(acc.googleUid);
    passEl.required = needsPass;
    passEl.placeholder = needsPass
        ? "Enter your password"
        : "No password set yet (click Log In)";
}

/* ==========================================
LOGIN AND REGISTER
========================================== */

function updateAuthTabState(mode) {
    const tabLogin = document.getElementById("tabLoginBtn");
    const tabRegister = document.getElementById("tabRegisterBtn");
    const isRegister = mode === "register";

    if (tabLogin) {
        tabLogin.classList.toggle("active", !isRegister);
        tabLogin.setAttribute("aria-selected", String(!isRegister));
    }

    if (tabRegister) {
        tabRegister.classList.toggle("active", isRegister);
        tabRegister.setAttribute("aria-selected", String(isRegister));
    }
}

function showRegister() {
    const loginEl = document.getElementById("loginScreen");
    const registerEl = document.getElementById("registerScreen");

    if (loginEl) loginEl.style.display = "none";
    if (registerEl) registerEl.style.display = "block";
    updateAuthTabState("register");

    const loginName = document.getElementById("loginName");
    const registerName = document.getElementById("registerName");
    if (registerName && loginName && loginName.value.trim()) {
        registerName.value = loginName.value.trim();
    }

    const regPass = document.getElementById("registerPass");
    const confPass = document.getElementById("confirmPass");
    const regPin = document.getElementById("registerPin");
    const regDebug = document.getElementById("registerDebug");

    if (regPass) regPass.value = "";
    if (confPass) confPass.value = "";
    if (regPin) regPin.value = "";
    if (regDebug) regDebug.innerText = "";

    updateRegisterValidationUI();
}

function showLogin() {
    const loginEl = document.getElementById("loginScreen");
    const registerEl = document.getElementById("registerScreen");
    const debug = document.getElementById("debug");

    if (registerEl) registerEl.style.display = "none";
    if (loginEl) loginEl.style.display = "block";
    if (debug) debug.innerText = "";
    updateAuthTabState("login");
}

function updateRegisterValidationUI() {
    const passEl = document.getElementById("registerPass");
    const confirmEl = document.getElementById("confirmPass");
    const strengthWrap = document.getElementById("passwordStrengthWrap");
    const strengthFill = document.getElementById("passwordStrengthFill");
    const strengthLabel = document.getElementById("passwordStrengthLabel");
    const matchHint = document.getElementById("passwordMatchHint");

    if (!passEl || !confirmEl) return;

    const pass = passEl.value;
    const confirmPass = confirmEl.value;

    if (strengthWrap && strengthFill && strengthLabel) {
        if (!pass.length) {
            strengthWrap.style.display = "none";
        } else {
            strengthWrap.style.display = "flex";
            let score = 0;
            if (pass.length >= 4) score++;
            if (pass.length >= 8) score++;
            if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
            if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

            if (pass.length < 4) {
                strengthFill.style.width = "20%";
                strengthFill.style.background = "var(--red)";
                strengthLabel.textContent = "Too short";
                strengthLabel.style.color = "var(--red)";
            } else if (score <= 1) {
                strengthFill.style.width = "40%";
                strengthFill.style.background = "var(--red)";
                strengthLabel.textContent = "Weak";
                strengthLabel.style.color = "var(--red)";
            } else if (score <= 2) {
                strengthFill.style.width = "70%";
                strengthFill.style.background = "var(--gold)";
                strengthLabel.textContent = "Good";
                strengthLabel.style.color = "var(--eyebrow)";
            } else {
                strengthFill.style.width = "100%";
                strengthFill.style.background = "var(--green)";
                strengthLabel.textContent = "Strong";
                strengthLabel.style.color = "var(--green)";
            }
        }
    }

    if (matchHint) {
        if (!confirmPass.length) {
            matchHint.textContent = "";
            matchHint.className = "password-match-hint";
        } else if (pass === confirmPass) {
            matchHint.textContent = "Passwords match ✓";
            matchHint.className = "password-match-hint match-ok";
        } else {
            matchHint.textContent = "Passwords do not match";
            matchHint.className = "password-match-hint match-error";
        }
    }
}

function renderSaved() {
    const wrap = document.getElementById("savedWrap");
    const container = document.getElementById("savedAccounts");

    if (!wrap || !container) return;

    if (!accounts.length) {
        wrap.style.display = "none";
        return;
    }

    wrap.style.display = "block";
    container.innerHTML = "";

    accounts.forEach(account => {
        const chip = document.createElement("span");
        chip.className = "account-chip";

        const trigger = document.createElement("span");
        trigger.className = "account-chip-trigger";

        const avatar = document.createElement("span");
        avatar.className = "account-chip-avatar";
        avatar.textContent = (account.name.trim().charAt(0) || "B").toUpperCase();

        const name = document.createElement("span");
        name.textContent = account.name;

        trigger.appendChild(avatar);
        trigger.appendChild(name);

        if (hasAccountRecoveryPin(account)) {
            const pinBadge = document.createElement("span");
            pinBadge.className = "account-chip-pin";
            pinBadge.textContent = "🔒";
            pinBadge.title = "Recovery PIN protected";
            trigger.appendChild(pinBadge);
        }

        trigger.addEventListener("click", () => {
            selectAccount(account.name);
        });

        const remove = document.createElement("span");
        remove.className = "del-x";
        remove.textContent = "×";
        remove.title = "Delete account";
        remove.setAttribute("aria-label", "Delete " + account.name);

        remove.addEventListener("click", () => {
            deleteSavedAccount(account.name);
        });

        chip.appendChild(trigger);
        chip.appendChild(remove);
        container.appendChild(chip);
    });
}

function selectAccount(name) {
    document.getElementById("loginName").value = name;
    syncLoginPassRequirement(name);
    document.getElementById("loginPass").focus();

    const debug = document.getElementById("debug");
    if (debug) debug.innerText = "";
}

function login() {
    const name = document.getElementById("loginName")
        .value.trim();

    const pass = document.getElementById("loginPass")
        .value;

    const debug = document.getElementById("debug");
    const rememberEl = document.getElementById("rememberMe");
    const keepLoggedIn = rememberEl ? rememberEl.checked : true;

    if (!name) {
        debug.innerText = "Please enter your account name.";
        return;
    }

    const account = getAccount(name);

    if (!account) {
        debug.innerText = "Account not found. Please create an account first.";
        return;
    }

    if (!hasAccountPassword(account)) {
        if (account.googleUid) {
            debug.innerText = "This account uses Google Cloud Sign-In or needs a password set in Settings.";
            return;
        }
        setActiveUserSession(account.name, keepLoggedIn);
        data = loadUserData(user);
        activeFilterDate = null;
        location.reload();
        return;
    }

    if (!pass) {
        debug.innerText = "Please enter your account name and password.";
        return;
    }

    if (!verifyAccountPassword(account, pass)) {
        debug.innerText = "Incorrect password. Please try again.";
        return;
    }

    if (upgradeLegacyAccountFields(account)) {
        saveAccounts();
    }

    setActiveUserSession(account.name, keepLoggedIn);

    data = loadUserData(user);
    activeFilterDate = null;

    location.reload();
}


function tryDemoAccount() {
    loadAccounts();
    const demoName = "Demo User";
    const demoPass = "demo1234";
    const today = todayISO();
    const monthPrefix = today.slice(0, 7);
    const futureGoalDate = new Date();
    futureGoalDate.setDate(futureGoalDate.getDate() + 45);
    const goalDeadline = futureGoalDate.toISOString().slice(0, 10);

    let demoAccount = getAccount(demoName);
    if (!demoAccount) {
        demoAccount = setAccountPasswordFields({ name: demoName }, demoPass);
        accounts.push(demoAccount);
        if (!saveAccounts()) {
            accounts.pop();
            return;
        }
    }

    const existingDemoRaw = localStorage.getItem(getUserDataKey(demoName));
    if (!existingDemoRaw) {
        const sampleData = {
            incomes: [
                { id: makeId(), source: "Monthly Allowance", amount: 8500, date: new Date().toLocaleDateString(), ts: Date.now() - 86400000 * 4, dateISO: monthPrefix + "-01" },
                { id: makeId(), source: "Freelance Design", amount: 4200, date: new Date().toLocaleDateString(), ts: Date.now() - 86400000 * 2, dateISO: today }
            ],
            expenses: [
                { id: makeId(), cat: "Food & Drinks", note: "Grocery & Ulams", amount: 1250, date: new Date().toLocaleDateString(), ts: Date.now() - 86400000 * 3, dateISO: monthPrefix + "-03" },
                { id: makeId(), cat: "Transportation", note: "Jeep & Grab fare", amount: 285, date: new Date().toLocaleDateString(), ts: Date.now() - 86400000 * 2, dateISO: today },
                { id: makeId(), cat: "Food & Drinks", note: "Kape & Snacks", amount: 165, date: new Date().toLocaleDateString(), ts: Date.now() - 3600000 * 5, dateISO: today },
                { id: makeId(), cat: "Bills & Utilities", note: "Home WiFi", amount: 1499, date: new Date().toLocaleDateString(), ts: Date.now() - 3600000 * 2, dateISO: today },
                { id: makeId(), cat: "Skincare & Personal Care", note: "Sunscreen", amount: 349, date: new Date().toLocaleDateString(), ts: Date.now() - 3600000, dateISO: today }
            ],
            savings: [
                { id: makeId(), name: "Emergency Fund", target: 10000, current: 3500, deadline: goalDeadline, deductFromBalance: false },
                { id: makeId(), name: "New Headphones", target: 3500, current: 1800, deadline: "", deductFromBalance: false }
            ],
            budgets: {
                "Food & Drinks": 4000,
                "Transportation": 1200,
                "Bills & Utilities": 2500
            },
            quickChips: getDefaultQuickChips(),
            recurringBills: [
                { id: makeId(), name: "Home WiFi", amount: 1499, cat: "Bills & Utilities", dueDay: 15, lastPaidMonth: monthPrefix, lastPaidDate: today },
                { id: makeId(), name: "Mobile Postpaid", amount: 599, cat: "Bills & Utilities", dueDay: new Date().getDate(), lastPaidMonth: "", lastPaidDate: "" }
            ],
            settings: {
                deductSavingsFromBalance: false
            }
        };

        try {
            localStorage.setItem(getUserDataKey(demoName), JSON.stringify(sampleData));
        } catch (error) {
            console.error("Demo account error:", error);
            showToast("Unable to create demo data.", "error");
            return;
        }
    }

    setActiveUserSession(demoAccount.name, false);
    showToast("Logged in as Demo User (sample data loaded)!", "success", 3000);
    setTimeout(() => location.reload(), 250);
}

async function logout() {
    const confirmed = await showConfirmModal({
        eyebrow: "LOG OUT",
        title: "Log Out of Badyetly?",
        message: "Are you sure you want to log out of this account?",
        confirmText: "Log Out"
    });

    if (!confirmed) return;

    clearActiveUserSession();
    location.reload();
}
async function deleteSavedAccount(name) {
    const confirmed = await showConfirmModal({
        eyebrow: "PERMANENT DELETE",
        title: "Delete Account?",
        message:
            'Delete account "' + name +
            '" permanently? Its saved income, expenses, goals, and budgets will also be deleted.',
        confirmText: "Delete Account",
        danger: true
    });

    if (!confirmed) return;

    const previousAccounts = [...accounts];

    accounts = accounts.filter(account =>
        account.name.toLowerCase() !== name.toLowerCase()
    );

    if (!saveAccounts()) {
        accounts = previousAccounts;
        return;
    }

    localStorage.removeItem(getUserDataKey(name));
    ["last_backup", "default_period", "hide_balance"].forEach(suffix => {
        localStorage.removeItem(getUserPrefKey(name, suffix));
    });

    if (
        user &&
        user.toLowerCase() === name.toLowerCase()
    ) {
        clearActiveUserSession();
        location.reload();
        return;
    }

    renderSaved();
    showToast("Account deleted successfully.", "success");
}

async function deleteAccountFromLogin() {
    const name = document.getElementById("loginName")
        .value.trim();

    if (!name) {
        showToast("Enter or select an account name first.", "warning");
        return;
    }

    await deleteSavedAccount(name);
}

async function deleteCurrentAccount() {
    if (!user) return;

    await deleteSavedAccount(user);
}

function renameCurrentAccount() {
    if (!user) return;

    const input = document.getElementById("renameAccountInput");
    const newName = input ? input.value.trim().slice(0, 100) : "";

    if (!newName) {
        showToast("Please enter a new account name.", "warning");
        return;
    }

    if (newName === user) {
        showToast("That is already your current account name.", "info");
        return;
    }

    const oldName = user;
    const isSameCaseInsensitive = oldName.toLowerCase() === newName.toLowerCase();
    const conflict = !isSameCaseInsensitive ? getAccount(newName) : null;

    if (conflict) {
        showToast('Account name "' + newName + '" is already in use.', "warning");
        return;
    }

    const account = getAccount(oldName);
    if (!account) {
        showToast("Account not found.", "error");
        return;
    }

    const previousName = account.name;
    account.name = newName;

    if (!saveAccounts()) {
        account.name = previousName;
        return;
    }

    const oldDataKey = getUserDataKey(oldName);
    const newDataKey = getUserDataKey(newName);
    if (oldDataKey !== newDataKey) {
        try {
            const existingRaw = localStorage.getItem(oldDataKey);
            localStorage.setItem(newDataKey, existingRaw || JSON.stringify(data));
            localStorage.removeItem(oldDataKey);

            ["last_backup", "default_period", "hide_balance"].forEach(suffix => {
                const oldPrefKey = getUserPrefKey(oldName, suffix);
                const newPrefKey = getUserPrefKey(newName, suffix);
                const val = localStorage.getItem(oldPrefKey);
                if (val !== null) {
                    localStorage.setItem(newPrefKey, val);
                    localStorage.removeItem(oldPrefKey);
                }
            });
        } catch (error) {
            console.error("Account rename migration error:", error);
        }
    }

    const keepLoggedIn = Boolean(localStorage.getItem(USER_KEY));
    setActiveUserSession(newName, keepLoggedIn);

    const welcomeEl = document.getElementById("welcomeText");
    const sidebarUserEl = document.getElementById("sidebarUser");
    const topbarUserEl = document.getElementById("topbarUserName");
    const mobileMoreUserEl = document.getElementById("mobileMoreUser");
    const currentUserEl = document.getElementById("currentUserLabel");

    if (welcomeEl) welcomeEl.innerText = "Hello, " + newName + "!";
    if (sidebarUserEl) sidebarUserEl.innerText = "Logged in as " + newName;
    if (topbarUserEl) topbarUserEl.textContent = newName;
    if (mobileMoreUserEl) mobileMoreUserEl.textContent = newName;
    if (currentUserEl) currentUserEl.innerText = newName;
    if (input) input.value = "";

    saveUserData();
    showToast('Account renamed to "' + newName + '"!', "success");
}

function changePassword() {
    if (!user) return;

    const newPassEl = document.getElementById("newPass");
    const confirmEl = document.getElementById("confirmNewPass");
    const newPassword = newPassEl ? newPassEl.value : "";
    const confirmPassword = confirmEl ? confirmEl.value : newPassword;

    if (!newPassword || newPassword.length < 4) {
        showToast("Password must be at least 4 characters.", "warning");
        return;
    }

    if (confirmEl && newPassword !== confirmPassword) {
        showToast("New passwords do not match.", "error");
        return;
    }

    const account = getAccount(user);

    if (!account) {
        showToast("Account not found.", "error");
        return;
    }

    setAccountPasswordFields(account, newPassword);

    if (!saveAccounts()) return;

    if (newPassEl) newPassEl.value = "";
    if (confirmEl) confirmEl.value = "";

    syncRecoveryPinStatus();
    showToast("Password updated successfully!", "success");
}

function syncRecoveryPinStatus() {
    const statusEl = document.getElementById("recoveryPinStatus");
    if (!statusEl || !user) return;

    const account = getAccount(user);
    if (account && !hasAccountPassword(account) && !account.googleUid) {
        statusEl.textContent = "Password not set yet (restored from older backup). Set a password above and a 4-digit Recovery PIN below.";
        statusEl.style.color = "var(--eyebrow)";
    } else if (account && hasAccountRecoveryPin(account)) {
        statusEl.textContent = "Recovery PIN is active. Password resets require this 4-digit PIN.";
        statusEl.style.color = "var(--green)";
    } else {
        statusEl.textContent = "No Recovery PIN set yet. Set 4 digits to protect password resets.";
        statusEl.style.color = "var(--muted)";
    }
}

function updateRecoveryPin() {
    if (!user) return;

    const pinEl = document.getElementById("settingsRecoveryPin");
    const pin = pinEl ? pinEl.value.trim() : "";

    if (!/^\d{4}$/.test(pin)) {
        showToast("Please enter a valid 4-digit numeric PIN.", "warning");
        return;
    }

    const account = getAccount(user);
    if (!account) {
        showToast("Account not found.", "error");
        return;
    }

    setAccountRecoveryPinFields(account, pin);
    if (!saveAccounts()) return;

    if (pinEl) pinEl.value = "";
    syncRecoveryPinStatus();
    showToast("4-digit Recovery PIN saved!", "success");
}

/* ==========================================
INITIALIZE APPLICATION
========================================== */

function checkAuth() {
    loadAccounts();
    renderSaved();

    const now = new Date();

    const fullDate = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    const today = document.getElementById("todayDate");
    const sidebarDate = document.getElementById("sidebarDate");
    const currentUser = document.getElementById("currentUserLabel");
    const topbarUserName = document.getElementById("topbarUserName");
    const authScreen = document.getElementById("authScreen");
    const appScreen = document.getElementById("appScreen");

    if (today) today.innerText = fullDate;
    if (sidebarDate) sidebarDate.innerText = fullDate;
    if (currentUser) currentUser.innerText = user || "";

    if (user) {

        if (!getAccount(user)) {
            clearActiveUserSession();
            location.reload();
            return;
        }

        data = loadUserData(user);

        if (authScreen) authScreen.style.display = "none";
        if (appScreen) appScreen.style.display = "";

        document.getElementById("welcomeText").innerText =
            "Hello, " + user + "!";

        document.getElementById("sidebarUser").innerText =
            "Logged in as " + user;

        // Show the active account name in the top-right corner and mobile menu.
        if (topbarUserName) {
            topbarUserName.textContent = user;
        }

        const mobileMoreUser = document.getElementById("mobileMoreUser");
        if (mobileMoreUser) {
            mobileMoreUser.textContent = user;
        }

        const defaultPeriod = getDefaultHomePeriodPref(user);
        activeHomePeriod = defaultPeriod === "this_month" ? getCurrentMonthKey() : "all";
        if (getHideBalanceDefaultPref(user)) {
            localStorage.setItem(BALANCE_PRIVACY_KEY, "true");
        }
        activeReportMonth = getCurrentMonthKey();
        initTransactionDateDefaults();
        syncRecoveryPinStatus();
        syncCloudUI();
        renderAll();

    } else {

        if (topbarUserName) {
            topbarUserName.textContent = "My Account";
        }

        if (authScreen) authScreen.style.display = "";
        if (appScreen) appScreen.style.display = "none";
        showLogin();

    }
}

function showView(view, options = {}) {
    const preserveStack = Boolean(options && options.preserveStack);
    const skipScrollTop = Boolean(options && options.skipScrollTop);

    currentViewName = view;
    if (!preserveStack) {
        viewNavStack = [];
    }

    document.querySelectorAll(".view").forEach(element => {
        element.classList.remove("active");
    });

    document.querySelectorAll(".nav-vertical button, .mobile-bottom-nav button")
        .forEach(element => {
            element.classList.remove("active");
        });

    const selectedView = document.getElementById("view-" + view);
    const selectedNav = document.getElementById("nav-" + view);
    const selectedMobileNav = document.getElementById("mnav-" + view);
    const moreMobileNav = document.getElementById("mnav-more");

    if (selectedView) selectedView.classList.add("active");
    if (selectedNav) selectedNav.classList.add("active");

    if (selectedMobileNav) {
        selectedMobileNav.classList.add("active");
    } else if (moreMobileNav) {
        moreMobileNav.classList.add("active");
    }

    if (view === "settings" && currentSettingsTab === "about") {
        renderAboutDetailsMeta();
    }

    updateBackNavUI();
    closeMobileMoreMenu();

    if (typeof window !== "undefined" && !skipScrollTop && window.innerWidth <= 760) {
        window.scrollTo({ top: 0, behavior: "auto" });
    }
}

/* ==========================================
MOBILE MORE MENU & QUICK-ADD SHEET
========================================== */

let quickAddType = "expense";
let quickAddManualCategory = false;

function openMobileMoreMenu() {
    const modal = document.getElementById("mobileMoreModal");
    const mobileMoreUser = document.getElementById("mobileMoreUser");
    if (mobileMoreUser && user) {
        mobileMoreUser.textContent = user;
    }
    if (modal) modal.style.display = "flex";
}

function closeMobileMoreMenu() {
    const modal = document.getElementById("mobileMoreModal");
    if (modal) modal.style.display = "none";
}

function selectMobileMoreView(view) {
    closeMobileMoreMenu();
    showView(view);
}

function renderQuickAddSheetChips() {
    const listEl = document.getElementById("qaQuickChipsList");
    if (!listEl) return;

    data.quickChips = normalizeQuickChips(data.quickChips);
    if (!data.quickChips.length) {
        listEl.innerHTML = '<small style="color:var(--muted)">No chips saved yet.</small>';
        return;
    }

    listEl.innerHTML = data.quickChips.map(chip => {
        const safeId = escapeHTML(chip.id);
        return `
            <div class="quick-chip-item">
                <button type="button" class="quick-chip-btn"
                    onclick="quickAddFromSheetChip('${safeId}')">
                    <span>${escapeHTML(chip.label)}</span>
                    <strong>${money(chip.amount)}</strong>
                </button>
            </div>
        `;
    }).join("");
}

function quickAddFromSheetChip(chipId) {
    quickAddExpenseChip(chipId);
    closeQuickAddModal();
}

function setQuickAddType(type) {
    quickAddType = type === "income" ? "income" : "expense";
    quickAddManualCategory = false;

    const expTab = document.getElementById("qaTabExpense");
    const incTab = document.getElementById("qaTabIncome");
    const chipsWrap = document.getElementById("qaQuickChipsWrap");
    const catWrap = document.getElementById("qaCategoryWrap");
    const textLabel = document.getElementById("qaTextLabel");
    const textInput = document.getElementById("qaTextInput");
    const submitBtn = document.getElementById("qaSubmitBtn");

    if (expTab) expTab.classList.toggle("active", quickAddType === "expense");
    if (incTab) incTab.classList.toggle("active", quickAddType === "income");
    if (chipsWrap) chipsWrap.style.display = quickAddType === "expense" ? "block" : "none";
    if (catWrap) catWrap.style.display = quickAddType === "expense" ? "flex" : "none";

    if (textLabel) {
        textLabel.textContent = quickAddType === "expense" ? "Expense Item" : "Income Source";
    }
    if (textInput) {
        textInput.placeholder = quickAddType === "expense"
            ? "e.g. Coffee, Jeep fare, Lunch"
            : "e.g. Allowance, Salary, Freelance";
    }
    if (submitBtn) {
        submitBtn.textContent = quickAddType === "expense" ? "+ Save Expense" : "+ Save Income";
    }
}

function markQuickAddCategoryManual() {
    quickAddManualCategory = true;
}

function updateQuickAddCategoryHint() {
    if (quickAddType !== "expense" || quickAddManualCategory) return;
    const textInput = document.getElementById("qaTextInput");
    const catSelect = document.getElementById("qaCategorySelect");
    if (!textInput || !catSelect) return;

    const detected = autoDetectCategory(textInput.value || "");
    if (detected) {
        catSelect.value = detected;
    }
}

function openQuickAddModal() {
    const modal = document.getElementById("quickAddModal");
    const textInput = document.getElementById("qaTextInput");
    const amountInput = document.getElementById("qaAmountInput");
    const dateInput = document.getElementById("qaDateInput");
    const catSelect = document.getElementById("qaCategorySelect");

    if (!modal) return;

    setQuickAddType("expense");
    renderQuickAddSheetChips();

    if (textInput) textInput.value = "";
    if (amountInput) amountInput.value = "";
    if (dateInput) dateInput.value = todayISO();
    if (catSelect) catSelect.value = "Food & Drinks";

    modal.style.display = "flex";
    setTimeout(() => {
        if (textInput) textInput.focus();
    }, 30);
}

function closeQuickAddModal() {
    const modal = document.getElementById("quickAddModal");
    if (modal) modal.style.display = "none";
}

function submitQuickAddModal(event) {
    event.preventDefault();

    const textInput = document.getElementById("qaTextInput");
    const amountInput = document.getElementById("qaAmountInput");
    const dateInput = document.getElementById("qaDateInput");
    const catSelect = document.getElementById("qaCategorySelect");

    const text = textInput ? textInput.value.trim() : "";
    const amount = amountInput ? parseFloat(amountInput.value) : NaN;
    const dateEntry = buildDateEntry(dateInput ? dateInput.value : todayISO());

    if (!text || !Number.isFinite(amount) || amount <= 0) {
        showToast("Please enter a valid description and amount.", "warning");
        return;
    }

    if (quickAddType === "income") {
        data.incomes.push({
            id: makeId(),
            source: text,
            amount: amount,
            date: dateEntry.date,
            ts: dateEntry.ts,
            dateISO: dateEntry.dateISO
        });
        saveUserData();
        closeQuickAddModal();
        showToast("Income added (+" + money(amount) + ")!", "success");
        return;
    }

    const category = (catSelect && catSelect.value) || autoDetectCategory(text);
    data.expenses.push({
        id: makeId(),
        cat: category,
        note: text,
        amount: amount,
        date: dateEntry.date,
        ts: dateEntry.ts,
        dateISO: dateEntry.dateISO
    });
    saveUserData();
    closeQuickAddModal();
    showToast("Expense added (-" + money(amount) + ")!", "success");
}

/* ==========================================
INCOME
========================================== */

function addIncome() {
    const source = document.getElementById("incomeSource")
        .value.trim();

    const amount = parseFloat(
        document.getElementById("incomeAmount").value
    );

    const incomeDateEl = document.getElementById("incomeDate");
    const dateEntry = buildDateEntry(incomeDateEl ? incomeDateEl.value : todayISO());

    if (!source || !Number.isFinite(amount) || amount <= 0) {
        showToast("Please enter a valid income.", "warning");
        return;
    }

    data.incomes.push({
        id: makeId(),
        source: source,
        amount: amount,
        date: dateEntry.date,
        ts: dateEntry.ts,
        dateISO: dateEntry.dateISO
    });

    saveUserData();
    showToast("Income added!", "success");

    document.getElementById("incomeSource").value = "";
    document.getElementById("incomeAmount").value = "";
    if (incomeDateEl) incomeDateEl.value = todayISO();
}

/* ==========================================
SMART AUTO CATEGORY
========================================== */

function autoDetectCategory(description) {
    const raw = String(description || "");
    const text = raw.toLowerCase();
    const allCategories = getAllCategories();

    // 1. Explicit #Tag match (e.g. "Dog food #Pets" or "#Health")
    const tagMatch = raw.match(/#([a-zA-Z0-9_&-]+)/);
    if (tagMatch) {
        const tagKey = tagMatch[1].toLowerCase().replace(/[_-]+/g, "");
        const matchedTag = allCategories.find(cat =>
            cat.toLowerCase().replace(/[^a-z0-9]+/g, "") === tagKey ||
            cat.toLowerCase().includes(tagMatch[1].toLowerCase())
        );
        if (matchedTag) return matchedTag;
    }

    // 2. Direct match against user's custom categories
    const customList = normalizeCustomCategories(data.customCategories);
    for (let i = 0; i < customList.length; i++) {
        const customCat = customList[i];
        const lowerCat = customCat.toLowerCase();
        if (lowerCat.length >= 2 && text.includes(lowerCat)) {
            return customCat;
        }
    }

    if (/mcdo|jollibee|food|rice|kanin|ulam|adobo|manok|burger|pizza|milktea|milk tea|coffee|kape|snack|breakfast|lunch|dinner|grocery|meal/.test(text)) {
        return "Food & Drinks";
    }

    if (/jeep|tricycle|bus|grab|pamasahe|pasahe|transport|taxi|gasolina|gas fare/.test(text)) {
        return "Transportation";
    }

    if (/shampoo|sabon|facial wash|skincare|sunscreen|lotion|makeup|moisturizer|serum|toner|lipstick|perfume|conditioner/.test(text)) {
        return "Skincare & Personal Care";
    }

    if (/damit|shopee|shopping|clothes|shoes|shirt|pants|bag|accessory/.test(text)) {
        return "Shopping";
    }

    if (/load|wifi|internet|bill|rent|electricity|kuryente|water bill|water|phone bill/.test(text)) {
        return "Bills & Utilities";
    }

    if (/school|tuition|notebook|ballpen|printing|book|project|school supplies/.test(text)) {
        return "Education";
    }

    if (/movie|cinema|game|concert|entertainment|subscription/.test(text)) {
        return "Entertainment";
    }

    return "Others";
}

function smartAddExpense() {
    const input = document.getElementById("smartExpenseInput")
        .value.trim();

    if (!input) {
        showToast("Please enter expenses.", "warning");
        return;
    }

    const expenseDateEl = document.getElementById("expenseDate");
    const dateEntry = buildDateEntry(expenseDateEl ? expenseDateEl.value : todayISO());

    const items = input.split(/[\n,]+/);

    let added = 0;
    let preview = "";

    items.forEach((raw, idx) => {
        raw = raw.trim();

        if (!raw) return;

        const match = raw.match(/\d+(?:,\d{3})*(?:\.\d+)?/);

        if (!match) return;

        const amount = parseFloat(match[0].replace(/,/g, ""));

        if (!Number.isFinite(amount) || amount <= 0) return;

        const rawDesc = raw.replace(match[0], "").trim()
            .replace(/^[-–—:]\s*/, "")
            .replace(/\s*[-–—:]\s*$/, "");

        const category = autoDetectCategory(rawDesc || "Expense");
        const strippedTagDesc = rawDesc.replace(/#[a-zA-Z0-9_&-]+/g, "").trim()
            .replace(/\s{2,}/g, " ")
            .replace(/\s*[-–—:]\s*$/, "");
        const description = strippedTagDesc || rawDesc || "Expense";

        data.expenses.push({
            id: makeId(),
            cat: category,
            note: description,
            amount: amount,
            date: dateEntry.date,
            ts: dateEntry.ts + idx,
            dateISO: dateEntry.dateISO
        });

        added++;

        preview += `
            <div style="
                padding:8px 0;
                border-bottom:1px solid var(--border);
                display:flex;
                justify-content:space-between;
                gap:8px;
            ">
                <span>
                    <b>${escapeHTML(description)}</b>
                    →
                    <small>${escapeHTML(category)}</small>
                </span>
                <b style="color:var(--red)">
                    ${money(amount)}
                </b>
            </div>
        `;
    });

    if (added === 0) {
        showToast("No valid expenses found. Use one purchase per line, e.g. Rice - 50.", "warning");
        return;
    }

    document.getElementById("smartPreview").innerHTML = `
        <b style="color:var(--green)">
            Added ${added} items successfully!
        </b>
        <div style="
            margin-top:8px;
            background:var(--surface-row);
            padding:10px;
            border:1px solid var(--border);
            border-radius:10px;
        ">
            ${preview}
        </div>
    `;

    saveUserData();
    showToast("Added " + added + " expense" + (added === 1 ? "" : "s") + "!", "success");

    document.getElementById("smartExpenseInput").value = "";
    if (expenseDateEl) expenseDateEl.value = todayISO();
}

/* ==========================================
DELETE TRANSACTIONS - FIXED
========================================== */

async function deleteItem(type, index) {
    if (type !== "incomes" && type !== "expenses") return;

    const transactionIndex = Number(index);

    if (
        !Number.isInteger(transactionIndex) ||
        transactionIndex < 0 ||
        transactionIndex >= data[type].length
    ) {
        showToast("Transaction not found. Please refresh the page.", "error");
        return;
    }

    const confirmed = await showConfirmModal({
        eyebrow: "DELETE TRANSACTION",
        title: "Delete Transaction?",
        message: "Are you sure you want to delete this transaction? This cannot be undone.",
        confirmText: "Delete",
        danger: true
    });

    if (!confirmed) return;

    // Remove only the selected transaction.
    // Works even with older records that have no ID.
    data[type].splice(transactionIndex, 1);

    // Save changes and refresh the dashboard.
    saveUserData();
    showToast("Transaction deleted.", "info");
}

async function clearAll() {
    const confirmed = await showConfirmModal({
        eyebrow: "CLEAR ACCOUNT DATA",
        title: "Clear All Data?",
        message:
            "Clear all transactions, savings goals, and budgets for " +
            user + "? Make sure you have a backup first.",
        confirmText: "Clear All Data",
        danger: true
    });

    if (!confirmed) return;

    data = emptyData();

    saveUserData();
    showToast("All account data cleared.", "info");
}

/* ==========================================
SAVINGS GOALS (MULTIPLE GOALS SUPPORTED)
========================================== */

function focusAddGoalForm() {
    const formPanel = document.getElementById("goalFormPanel");
    const nameInput = document.getElementById("savingsName");

    if (formPanel) {
        formPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (nameInput) {
        nameInput.focus();
    }
}

function setSavings() {
    const nameInput = document.getElementById("savingsName");
    const targetInput = document.getElementById("savingsTarget");
    const currentInput = document.getElementById("savingsCurrent");
    const deadlineInput = document.getElementById("savingsDeadline");
    const deductInput = document.getElementById("savingsDeductBalance");

    const name = nameInput.value.trim() || "My Goal";
    const target = parseFloat(targetInput.value);
    const currentVal = currentInput.value;
    const current = currentVal === "" ? 0 : parseFloat(currentVal);
    const deadlineRaw = deadlineInput ? deadlineInput.value.trim() : "";
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw) ? deadlineRaw : "";
    const deductFromBalance = Boolean(deductInput && deductInput.checked);

    if (
        !Number.isFinite(target) ||
        target <= 0 ||
        !Number.isFinite(current) ||
        current < 0
    ) {
        showToast("Please enter valid goal amounts.", "warning");
        return;
    }

    data.savings = normalizeSavingsGoals(data.savings);

    data.savings.push({
        id: makeId(),
        name: name,
        target: target,
        current: current,
        deadline: deadline,
        deductFromBalance: deductFromBalance
    });

    nameInput.value = "";
    targetInput.value = "";
    currentInput.value = "";
    if (deadlineInput) deadlineInput.value = "";
    if (deductInput) deductInput.checked = false;

    saveUserData();
    showView("goals");
    showToast('Savings goal "' + name + '" added!', "success");
}

function toggleGoalBalanceDeduct(goalId, enabled) {
    data.savings = normalizeSavingsGoals(data.savings);
    const goal = data.savings.find(item => item.id === goalId);
    if (!goal) return;

    goal.deductFromBalance = Boolean(enabled);
    saveUserData();
    showToast(
        goal.deductFromBalance
            ? '"' + goal.name + '" will be deducted from Spendable Balance.'
            : '"' + goal.name + '" removed from Spendable Balance deduction.',
        "info"
    );
}

function addMoneyToGoal(goalId) {
    data.savings = normalizeSavingsGoals(data.savings);
    const goal = data.savings.find(item => item.id === goalId);
    const amountInput = document.getElementById("goalAmount-" + goalId);
    const amount = amountInput ? parseFloat(amountInput.value) : NaN;

    if (!goal || !Number.isFinite(amount) || amount <= 0) {
        showToast("Enter a valid amount.", "warning");
        return;
    }

    goal.current = Number(goal.current || 0) + amount;
    amountInput.value = "";

    saveUserData();
    showToast("Added " + money(amount) + " to " + goal.name + "!", "success");
}

function deductMoneyFromGoal(goalId) {
    data.savings = normalizeSavingsGoals(data.savings);
    const goal = data.savings.find(item => item.id === goalId);
    const amountInput = document.getElementById("goalAmount-" + goalId);
    const amount = amountInput ? parseFloat(amountInput.value) : NaN;

    if (!goal || !Number.isFinite(amount) || amount <= 0) {
        showToast("Enter a valid amount.", "warning");
        return;
    }

    goal.current = Math.max(0, Number(goal.current || 0) - amount);
    amountInput.value = "";

    saveUserData();
    showToast("Deducted " + money(amount) + " from " + goal.name + ".", "info");
}

async function deleteGoal(goalId) {
    data.savings = normalizeSavingsGoals(data.savings);
    const goal = data.savings.find(item => item.id === goalId);
    if (!goal) return;

    const confirmed = await showConfirmModal({
        eyebrow: "DELETE GOAL",
        title: "Delete Savings Goal?",
        message: 'Delete savings goal "' + goal.name + '"? Its progress will be removed.',
        confirmText: "Delete Goal",
        danger: true
    });

    if (!confirmed) return;

    data.savings = data.savings.filter(item => item.id !== goalId);

    saveUserData();
    showToast('Savings goal "' + goal.name + '" deleted.', "info");
}
/* ==========================================
BUDGET LIMIT
========================================== */

function setBudgetLimit() {
    const category = document.getElementById("budgetCat").value;

    const limit = parseFloat(
        document.getElementById("budgetLimit").value
    );

    if (!Number.isFinite(limit) || limit <= 0) {
        showToast("Enter a valid budget limit.", "warning");
        return;
    }

    data.budgets[category] = limit;

    saveUserData();
    showToast("Budget limit saved for " + category + ".", "success");

    document.getElementById("budgetLimit").value = "";
}

function renderBudget() {
    const element = document.getElementById("budgetList");
    const monthLabelEl = document.getElementById("budgetMonthLabel");

    if (!element) return;

    const currentMonth = getSelectedReportMonth();

    if (monthLabelEl) {
        monthLabelEl.textContent = "Showing spending for " + formatMonthLabel(currentMonth) + ".";
    }

    const spent = {};

    data.expenses.forEach(expense => {
        if (getTransactionDateISO(expense).slice(0, 7) !== currentMonth) {
            return;
        }
        spent[expense.cat] =
            (spent[expense.cat] || 0) + Number(expense.amount || 0);
    });

    const aliases = {
        "Food": "Food & Drinks",
        "Transport": "Transportation",
        "Bills": "Bills & Utilities"
    };

    const categories = Object.keys(data.budgets);

    if (!categories.length) {
        element.innerHTML =
            '<small style="color:#999">No budgets set yet.</small>';
        return;
    }

    let html = "";

    categories.forEach(category => {
        const limit = Number(data.budgets[category]) || 0;

        const modernCategory = aliases[category] || category;

        const used = (spent[category] || 0) +
            (category !== modernCategory
                ? (spent[modernCategory] || 0)
                : 0);

        const percent = limit
            ? Math.min(100, Math.round((used / limit) * 100))
            : 0;

        const encodedCat = encodeURIComponent(category);

        html += `
            <div style="
                padding:14px;
                border:1px solid var(--border);
                border-radius:12px;
                margin-bottom:10px;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    gap:8px;
                ">
                    <b>${escapeHTML(category)}</b>
                    <span>${money(used)} / ${money(limit)}</span>
                </div>
                <div class="budget-progress">
                    <div class="budget-fill"
                        style="
                            width:${percent}%;
                            background:${percent >= 100
                                ? "var(--red)"
                                : "var(--primary)"};
                        ">
                    </div>
                </div>
                <small style="color:var(--muted)">
                    ${percent}% used this month
                    ${percent >= 100 ? " - Budget limit reached!" : ""}
                </small>
                <button class="btn-delete"
                    style="margin-top:8px"
                    onclick="deleteBudget(decodeURIComponent('${encodedCat}'))">
                    Delete Budget
                </button>
            </div>
        `;
    });

    element.innerHTML = html;
}

async function deleteBudget(category) {
    const confirmed = await showConfirmModal({
        eyebrow: "DELETE BUDGET",
        title: "Delete Budget Limit?",
        message: 'Remove the monthly budget limit for "' + category + '"?',
        confirmText: "Delete Budget",
        danger: true
    });

    if (!confirmed) return;

    delete data.budgets[category];

    saveUserData();
    showToast("Budget limit removed.", "info");
}

/* ==========================================
BACKUP AND RESTORE
========================================== */

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function backupData() {
    if (!user) return;

    loadAccounts();
    const currentAcc = getAccount(user);
    const accountMeta = buildBackupAccountMeta(currentAcc);

    const backup = {
        accountName: user,
        exportedAt: new Date().toISOString(),
        ...(accountMeta ? { accountMeta } : {}),
        ...data
    };

    const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    downloadBlob(
        blob,
        "badyetly-backup-" + user + ".json"
    );

    recordBackupTimestamp(user);
    renderSettingsMeta();
    showToast("JSON backup downloaded!", "success");
}

function exportCSV() {
    const rows = [
        ["Type", "Category", "Note", "Amount", "Date"]
    ];

    data.incomes.forEach(income => {
        rows.push([
            "Income",
            "Income",
            income.source,
            income.amount,
            income.dateISO || income.date
        ]);
    });

    data.expenses.forEach(expense => {
        rows.push([
            "Expense",
            expense.cat,
            expense.note,
            expense.amount,
            expense.dateISO || expense.date
        ]);
    });

    const csv = rows.map(row =>
        row.map(value =>
            '"' + String(value ?? "").replace(/"/g, '""') + '"'
        ).join(",")
    ).join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    downloadBlob(blob, "badyetly-" + user + ".csv");
}

function importBackup(event) {
    const inputEl = event.target;
    const file = inputEl.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const imported = JSON.parse(e.target.result);

            if (
                !imported ||
                !Array.isArray(imported.incomes) ||
                !Array.isArray(imported.expenses)
            ) {
                throw new Error("Invalid backup format");
            }

            const confirmed = await showConfirmModal({
                eyebrow: "RESTORE BACKUP",
                title: "Restore Backup for " + user + "?",
                message:
                    "Incomes: " + imported.incomes.length + "\n" +
                    "Expenses: " + imported.expenses.length +
                    "\n\nThis will replace your current account data.",
                confirmText: "Restore Backup",
                danger: true
            });

            if (!confirmed) return;

            data = {
                incomes: imported.incomes,
                expenses: imported.expenses,
                savings: normalizeSavingsGoals(imported.savings),
                budgets: imported.budgets || {},
                customCategories: extractImplicitCustomCategories(
                    imported.expenses,
                    imported.budgets,
                    imported.customCategories
                ),
                quickChips: normalizeQuickChips(imported.quickChips),
                recurringBills: normalizeRecurringBills(imported.recurringBills),
                settings: normalizeUserSettings(imported.settings)
            };

            saveUserData();

            showToast("Backup restored successfully!", "success");

        } catch (error) {
            showToast("Invalid backup file!", "error");
            console.error(error);
        } finally {
            inputEl.value = "";
        }
    };

    reader.onerror = function () {
        showToast("Unable to read the backup file.", "error");
        inputEl.value = "";
    };

    reader.readAsText(file);
}

/* ==========================================
ANALYTICS
========================================== */

function drawChart() {
    const canvas = document.getElementById("catChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const categories = {};

    data.expenses.forEach(expense => {
        categories[expense.cat] =
            (categories[expense.cat] || 0) +
            Number(expense.amount || 0);
    });

    const labels = Object.keys(categories);
    const values = Object.values(categories);

    const breakdown = document.getElementById("catBreakdown");

    const styles = getComputedStyle(document.documentElement);
    const chartTextColor = (styles.getPropertyValue("--chart-text") || "#333333").trim();
    const mutedColor = (styles.getPropertyValue("--muted") || "#999999").trim();

    if (!labels.length) {
        ctx.fillStyle = mutedColor;
        ctx.font = "14px sans-serif";
        ctx.fillText("No expenses yet", 20, 100);

        if (breakdown) {
            breakdown.innerHTML =
                '<p class="empty-message">No expense breakdown yet.</p>';
        }

        return;
    }

    const colors = [
        "#087B5B",
        "#DC6255",
        "#E9C46A",
        "#4D7EA8",
        "#F4A261",
        "#6688AA",
        "#8B6BA8",
        "#55A6A0"
    ];

    const max = Math.max(...values) || 1;

    const gap = (canvas.width - 60) / labels.length;

    const barWidth = Math.min(
        45,
        Math.max(15, gap - 10)
    );

    let html = "";

    labels.forEach((label, index) => {
        const height = (values[index] / max) * 115;

        const x = 25 + index * gap;
        const y = 145 - height;

        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x, y, barWidth, height);

        ctx.fillStyle = chartTextColor;
        ctx.font = "10px sans-serif";

        ctx.fillText(
            label.substring(0, 9),
            x,
            165
        );

        html += `
            <div style="
                display:flex;
                justify-content:space-between;
                padding:9px 0;
                border-bottom:1px solid var(--border);
            ">
                <span>${escapeHTML(label)}</span>
                <b>${money(values[index])}</b>
            </div>
        `;
    });

    if (breakdown) {
        breakdown.innerHTML = html;
    }
}
/* ==========================================
   BADYETLY - COMPLETE ANALYTICS FUNCTIONS
========================================== */

// Convert transaction date into YYYY-MM-DD.
// Supports both new and older transaction records.
function getTransactionDateISO(item) {
    if (
        item.dateISO &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.dateISO)
    ) {
        return item.dateISO;
    }

    let date = null;

    if (item.ts && Number(item.ts) > 0) {
        date = new Date(Number(item.ts));
    } else if (item.date) {
        date = new Date(item.date);
    }

    if (!date || isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// Draw a simple bar chart for Analytics.
function drawAnalyticsBarChart(canvasId, labels, datasets) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const allValues = datasets.flatMap(dataset => dataset.values);

    const hasData = allValues.some(value => Number(value) > 0);

    const styles = getComputedStyle(document.documentElement);
    const gridColor = (styles.getPropertyValue("--chart-grid") || "#E8E8E8").trim();
    const axisColor = (styles.getPropertyValue("--chart-axis") || "#888888").trim();
    const labelColor = (styles.getPropertyValue("--chart-text") || "#555555").trim();
    const mutedColor = (styles.getPropertyValue("--muted") || "#999999").trim();

    if (!labels.length || !hasData) {
        ctx.fillStyle = mutedColor;
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No data available yet", width / 2, height / 2);
        ctx.textAlign = "left";
        return;
    }

    const left = 45;
    const right = 15;
    const top = 20;
    const bottom = 45;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const maxValue = Math.max(...allValues, 1);
    const maxScale = maxValue * 1.2;

    // Horizontal grid lines and amounts.
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = axisColor;

    for (let i = 0; i <= 4; i++) {
        const y = top + chartHeight - (chartHeight * i / 4);
        const value = maxScale * i / 4;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();

        ctx.fillText(
            value >= 1000
                ? "₱" + (value / 1000).toFixed(1) + "k"
                : "₱" + Math.round(value),
            left - 7,
            y + 4
        );
    }

    const groupWidth = chartWidth / labels.length;
    const seriesCount = datasets.length;

    const barWidth = Math.min(
        30,
        (groupWidth * 0.65) / seriesCount
    );

    labels.forEach((label, index) => {
        const centerX = left + groupWidth * (index + 0.5);

        datasets.forEach((dataset, seriesIndex) => {
            const value = Number(dataset.values[index]) || 0;

            const barHeight = (value / maxScale) * chartHeight;

            const x = centerX +
                (seriesIndex - (seriesCount - 1) / 2) * barWidth -
                barWidth / 2;

            const y = top + chartHeight - barHeight;

            ctx.fillStyle = dataset.color;

            ctx.fillRect(
                x,
                y,
                Math.max(2, barWidth - 3),
                barHeight
            );
        });

        ctx.fillStyle = labelColor;
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";

        ctx.fillText(
            String(label).substring(0, 10),
            centerX,
            height - 17
        );
    });

    ctx.textAlign = "left";
}


// Main Analytics updater.
function updateAnalytics() {
    if (!user) return;

    const selectedMonth = getSelectedReportMonth();
    const [selYear, selMonthNum] = selectedMonth.split("-").map(Number);
    const shortSelectedLabel = formatMonthLabel(selectedMonth, true);
    const isCurrentSelected = selectedMonth === getCurrentMonthKey();

    const analyticsSubtitle = document.getElementById("analyticsPeriodSubtitle");
    const analyticsIncomeLabel = document.getElementById("analyticsIncomeLabel");
    const analyticsExpenseLabel = document.getElementById("analyticsExpenseLabel");
    const analyticsBalanceLabel = document.getElementById("analyticsBalanceLabel");

    if (analyticsSubtitle) {
        analyticsSubtitle.textContent = isCurrentSelected
            ? "Understand your income, expenses, and savings progress."
            : "Viewing monthly financial breakdown for " + formatMonthLabel(selectedMonth) + ".";
    }

    if (analyticsIncomeLabel) {
        analyticsIncomeLabel.textContent = isCurrentSelected
            ? "THIS MONTH'S INCOME"
            : "INCOME (" + shortSelectedLabel.toUpperCase() + ")";
    }

    if (analyticsExpenseLabel) {
        analyticsExpenseLabel.textContent = isCurrentSelected
            ? "THIS MONTH'S EXPENSES"
            : "EXPENSES (" + shortSelectedLabel.toUpperCase() + ")";
    }

    if (analyticsBalanceLabel) {
        analyticsBalanceLabel.textContent = isCurrentSelected
            ? "THIS MONTH'S BALANCE"
            : "BALANCE (" + shortSelectedLabel.toUpperCase() + ")";
    }

    // Get all transactions belonging to selected month.
    const monthlyIncome = data.incomes.filter(item =>
        getTransactionDateISO(item).slice(0, 7) === selectedMonth
    );

    const monthlyExpenses = data.expenses.filter(item =>
        getTransactionDateISO(item).slice(0, 7) === selectedMonth
    );

    // Calculate monthly totals.
    const totalIncome = monthlyIncome.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
    );

    const totalExpense = monthlyExpenses.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
    );

    const balance = totalIncome - totalExpense;

    // Update Analytics summary cards.
    const incomeElement =
        document.getElementById("analyticsIncome");

    const expenseElement =
        document.getElementById("analyticsExpense");

    const balanceElement =
        document.getElementById("analyticsBalance");

    if (incomeElement) {
        incomeElement.textContent = money(totalIncome);
    }

    if (expenseElement) {
        expenseElement.textContent = money(totalExpense);
    }

    if (balanceElement) {
        balanceElement.textContent = money(balance);
        balanceElement.style.color =
            balance >= 0 ? "#43866D" : "#C76565";
    }

    // Find top spending category for selected month.
    const categoryTotals = {};

    monthlyExpenses.forEach(item => {
        const category = item.cat || "Others";

        categoryTotals[category] =
            (categoryTotals[category] || 0) +
            (Number(item.amount) || 0);
    });

    const categoryEntries = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);

    const topCategoryElement =
        document.getElementById("analyticsTopCategory");

    const topAmountElement =
        document.getElementById("analyticsTopAmount");

    if (categoryEntries.length) {
        const [category, amount] = categoryEntries[0];

        if (topCategoryElement) {
            topCategoryElement.textContent = category;
        }

        if (topAmountElement) {
            topAmountElement.textContent =
                money(amount) + " spent in " + shortSelectedLabel;
        }
    } else {
        if (topCategoryElement) {
            topCategoryElement.textContent = "No data";
        }

        if (topAmountElement) {
            topAmountElement.textContent =
                "No expenses recorded for " + shortSelectedLabel;
        }
    }

    // Income vs. Expenses chart.
    drawAnalyticsBarChart(
        "incomeExpenseChart",
        [isCurrentSelected ? "This Month" : shortSelectedLabel],
        [
            {
                name: "Income",
                values: [totalIncome],
                color: "#43866D"
            },
            {
                name: "Expenses",
                values: [totalExpense],
                color: "#C76565"
            }
        ]
    );

    // Six months ending at selected month.
    const monthLabels = [];
    const monthlySpending = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(
            selYear,
            (selMonthNum - 1) - i,
            1
        );

        const monthKey =
            date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0");

        monthLabels.push(
            date.toLocaleDateString("en-US", {
                month: "short"
            })
        );

        const amount = data.expenses
            .filter(item =>
                getTransactionDateISO(item).slice(0, 7) === monthKey
            )
            .reduce(
                (sum, item) =>
                    sum + (Number(item.amount) || 0),
                0
            );

        monthlySpending.push(amount);
    }

    drawAnalyticsBarChart(
        "monthlyTrendChart",
        monthLabels,
        [
            {
                name: "Monthly Expenses",
                values: monthlySpending,
                color: "#D6B979"
            }
        ]
    );

    // Savings Analytics.
    const savingsElement =
        document.getElementById("analyticsSavings");

    if (savingsElement) {
        const goals = normalizeSavingsGoals(data.savings);

        if (goals.length) {
            savingsElement.innerHTML = goals.map(goal => {
                const target = Number(goal.target) || 0;
                const current = Number(goal.current) || 0;
                const percentage = target > 0
                    ? Math.min(100, Math.round((current / target) * 100))
                    : 0;

                return `
                    <div style="padding:14px 0; border-bottom:1px solid var(--border);">
                        <small style="color:var(--muted)">
                            SAVINGS GOAL
                        </small>

                        <h3 style="margin:6px 0 10px">
                            ${escapeHTML(goal.name)}
                        </h3>

                        <div style="
                            height:10px;
                            background:var(--track-bg);
                            border-radius:20px;
                            overflow:hidden;
                            margin:10px 0;
                        ">
                            <div style="
                                height:100%;
                                width:${percentage}%;
                                background:#43866D;
                                border-radius:20px;
                            "></div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
                            <strong style="color:#43866D">${percentage}% Complete</strong>
                            <small style="color:var(--muted)">${money(current)} / ${money(target)}</small>
                        </div>

                        <small style="color:var(--muted); display:block; margin-top:4px;">
                            Remaining: ${money(Math.max(0, target - current))}
                        </small>
                    </div>
                `;
            }).join("");
        } else {
            savingsElement.innerHTML = `
                <p class="empty-message">
                    Set a savings goal to view your progress.
                </p>
            `;
        }
    }

    // Smart Financial Insights.
    const insightsElement =
        document.getElementById("analyticsInsights");

    if (insightsElement) {
        const insights = [];

        if (totalIncome === 0 && totalExpense === 0) {
            insights.push(
                "Start recording your income and expenses to see your financial insights."
            );
        } else {
            if (totalIncome > 0) {
                insights.push(
                    "Your recorded income this month is " +
                    money(totalIncome) + "."
                );
            }

            if (totalExpense > 0) {
                insights.push(
                    "You have recorded " +
                    money(totalExpense) +
                    " in expenses this month."
                );
            }

            if (balance > 0) {
                insights.push(
                    "Your income is currently higher than your expenses by " +
                    money(balance) + "."
                );
            } else if (balance < 0) {
                insights.push(
                    "Your expenses are currently higher than your income by " +
                    money(Math.abs(balance)) + ". Review your spending."
                );
            } else if (totalIncome > 0 || totalExpense > 0) {
                insights.push(
                    "Your recorded income and expenses are currently equal."
                );
            }

            if (categoryEntries.length) {
                insights.push(
                    "Your highest spending category this month is " +
                    categoryEntries[0][0] + "."
                );
            }
        }

        insightsElement.innerHTML = insights.map(insight => `
            <div style="
                padding:12px;
                margin-bottom:9px;
                background:var(--green-soft);
                border-radius:10px;
                line-height:1.6;
            ">
                ✦ ${escapeHTML(insight)}
            </div>
        `).join("");
    }
}

/* ==========================================
DATE FILTER
========================================== */

function applyDateFilter() {
    const selected = document.getElementById("filterDate").value;

    if (!selected) {
        showToast("Please select a date.", "warning");
        return;
    }

    activeFilterDate = selected;

    document.getElementById("clearFilterBtn").style.display =
        "inline-block";

    renderAll();
}

function filterToday() {
    const today = getDateISO();

    document.getElementById("filterDate").value = today;

    activeFilterDate = today;

    document.getElementById("clearFilterBtn").style.display =
        "inline-block";

    renderAll();
}

function clearDateFilter() {
    activeFilterDate = null;

    document.getElementById("filterDate").value = "";

    document.getElementById("clearFilterBtn").style.display =
        "none";

    renderAll();
}

function clearTransactionFilters() {
    const searchInput = document.getElementById("txSearchInput");
    const categorySelect = document.getElementById("txCategoryFilter");

    if (searchInput) searchInput.value = "";
    if (categorySelect) categorySelect.value = "ALL";

    renderAll();
}
/* ==========================================
EDIT MODAL (GOALS & TRANSACTIONS)
========================================== */

let activeEditTarget = null;

const BADYETLY_CATEGORIES = [
    "Food & Drinks",
    "Transportation",
    "Skincare & Personal Care",
    "Shopping",
    "Bills & Utilities",
    "Education",
    "Entertainment",
    "Others"
];

function openEditGoal(goalId) {
    data.savings = normalizeSavingsGoals(data.savings);
    const goal = data.savings.find(item => item.id === goalId);
    if (!goal) return;

    activeEditTarget = { kind: "goal", goalId: goal.id };

    const modal = document.getElementById("editModal");
    const eyebrow = document.getElementById("editModalEyebrow");
    const title = document.getElementById("editModalTitle");
    const fields = document.getElementById("editModalFields");

    if (!modal || !fields) return;

    if (eyebrow) eyebrow.textContent = "SAVINGS GOAL";
    if (title) title.textContent = "Edit Savings Goal";

    fields.innerHTML = `
        <div class="form-group">
            <label for="editGoalName">Goal Name</label>
            <input type="text" id="editGoalName" value="${escapeHTML(goal.name)}" required>
        </div>
        <div class="form-group">
            <label for="editGoalTarget">Target Amount (₱)</label>
            <input type="number" id="editGoalTarget" min="0.01" step="0.01" value="${Number(goal.target) || 0}" required>
        </div>
        <div class="form-group">
            <label for="editGoalCurrent">Current Saved (₱)</label>
            <input type="number" id="editGoalCurrent" min="0" step="0.01" value="${Number(goal.current) || 0}" required>
        </div>
        <div class="form-group">
            <label for="editGoalDeadline">Target Date (Optional)</label>
            <input type="date" id="editGoalDeadline" value="${escapeHTML(goal.deadline || "")}">
        </div>
        <div class="balance-link-box" style="margin-top:4px;">
            <label class="toggle-switch-row" for="editGoalDeduct">
                <input type="checkbox" id="editGoalDeduct" ${goal.deductFromBalance ? "checked" : ""}>
                <span>Deduct this goal from Spendable Balance</span>
            </label>
        </div>
    `;

    modal.style.display = "flex";
    const nameInput = document.getElementById("editGoalName");
    if (nameInput) nameInput.focus();
}

function openQuickChipModal() {
    activeEditTarget = { kind: "quickChip" };

    const modal = document.getElementById("editModal");
    const eyebrow = document.getElementById("editModalEyebrow");
    const title = document.getElementById("editModalTitle");
    const fields = document.getElementById("editModalFields");

    if (!modal || !fields) return;

    if (eyebrow) eyebrow.textContent = "1-TAP EXPENSE";
    if (title) title.textContent = "Add Quick-Add Chip";

    const catOptions = getAllCategories().map(cat =>
        `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`
    ).join("");

    fields.innerHTML = `
        <div class="form-group">
            <label for="editChipLabel">Chip Label</label>
            <input type="text" id="editChipLabel" placeholder="e.g. Milk Tea, Grab" required>
        </div>
        <div class="form-group">
            <label for="editChipAmount">Amount (₱)</label>
            <input type="number" id="editChipAmount" min="0.01" step="0.01" placeholder="0.00" required>
        </div>
        <div class="form-group">
            <label for="editChipCat">Category</label>
            <select id="editChipCat">${catOptions}</select>
        </div>
    `;

    modal.style.display = "flex";
    const labelInput = document.getElementById("editChipLabel");
    if (labelInput) labelInput.focus();
}

function openRecurringBillModal(billId = null) {
    data.recurringBills = normalizeRecurringBills(data.recurringBills);
    const existing = billId
        ? data.recurringBills.find(item => item.id === billId)
        : null;

    activeEditTarget = { kind: "bill", billId: existing ? existing.id : null };

    const modal = document.getElementById("editModal");
    const eyebrow = document.getElementById("editModalEyebrow");
    const title = document.getElementById("editModalTitle");
    const fields = document.getElementById("editModalFields");

    if (!modal || !fields) return;

    if (eyebrow) eyebrow.textContent = "MONTHLY BILL";
    if (title) title.textContent = existing ? "Edit Recurring Bill" : "Add Recurring Bill";

    const currentCat = existing ? existing.cat : "Bills & Utilities";
    const billCats = getAllCategories(currentCat);
    const catOptions = billCats.map(cat =>
        `<option value="${escapeHTML(cat)}" ${cat === currentCat ? "selected" : ""}>${escapeHTML(cat)}</option>`
    ).join("");

    fields.innerHTML = `
        <div class="form-group">
            <label for="editBillName">Bill Name</label>
            <input type="text" id="editBillName" placeholder="e.g. WiFi, House Rent, Kuryente"
                value="${existing ? escapeHTML(existing.name) : ""}" required>
        </div>
        <div class="form-row-2">
            <div class="form-group">
                <label for="editBillAmount">Amount (₱)</label>
                <input type="number" id="editBillAmount" min="0.01" step="0.01"
                    value="${existing ? Number(existing.amount) || 0 : ""}" placeholder="0.00" required>
            </div>
            <div class="form-group">
                <label for="editBillDueDay">Due Day (1–31)</label>
                <input type="number" id="editBillDueDay" min="1" max="31"
                    value="${existing ? existing.dueDay : 15}" required>
            </div>
        </div>
        <div class="form-group">
            <label for="editBillCat">Category</label>
            <select id="editBillCat">${catOptions}</select>
        </div>
    `;

    modal.style.display = "flex";
    const nameInput = document.getElementById("editBillName");
    if (nameInput) nameInput.focus();
}

function openEditTransaction(type, index) {
    if (type !== "incomes" && type !== "expenses") return;

    const txIndex = Number(index);
    const item = data[type][txIndex];
    if (!item) return;

    activeEditTarget = { kind: "transaction", type: type, index: txIndex };

    const modal = document.getElementById("editModal");
    const eyebrow = document.getElementById("editModalEyebrow");
    const title = document.getElementById("editModalTitle");
    const fields = document.getElementById("editModalFields");

    if (!modal || !fields) return;

    const currentDateISO = getTransactionDateISO(item) || todayISO();

    if (type === "incomes") {
        if (eyebrow) eyebrow.textContent = "INCOME RECORD";
        if (title) title.textContent = "Edit Income";

        fields.innerHTML = `
            <div class="form-group">
                <label for="editTxText">Income Source</label>
                <input type="text" id="editTxText" value="${escapeHTML(item.source || "")}" required>
            </div>
            <div class="form-group">
                <label for="editTxAmount">Amount (₱)</label>
                <input type="number" id="editTxAmount" min="0.01" step="0.01" value="${Number(item.amount) || 0}" required>
            </div>
            <div class="form-group">
                <label for="editTxDate">Date</label>
                <input type="date" id="editTxDate" value="${escapeHTML(currentDateISO)}" required>
            </div>
        `;
    } else {
        if (eyebrow) eyebrow.textContent = "EXPENSE RECORD";
        if (title) title.textContent = "Edit Expense";

        const currentCat = item.cat || "Others";
        const catOptions = getAllCategories(currentCat).map(cat =>
            `<option value="${escapeHTML(cat)}" ${cat === currentCat ? "selected" : ""}>${escapeHTML(cat)}</option>`
        ).join("");

        fields.innerHTML = `
            <div class="form-group">
                <label for="editTxText">Description</label>
                <input type="text" id="editTxText" value="${escapeHTML(item.note || "")}" required>
            </div>
            <div class="form-group">
                <label for="editTxCat">Category</label>
                <select id="editTxCat">${catOptions}</select>
            </div>
            <div class="form-group">
                <label for="editTxAmount">Amount (₱)</label>
                <input type="number" id="editTxAmount" min="0.01" step="0.01" value="${Number(item.amount) || 0}" required>
            </div>
            <div class="form-group">
                <label for="editTxDate">Date</label>
                <input type="date" id="editTxDate" value="${escapeHTML(currentDateISO)}" required>
            </div>
        `;
    }

    modal.style.display = "flex";
    const textInput = document.getElementById("editTxText");
    if (textInput) textInput.focus();
}

function closeEditModal() {
    const modal = document.getElementById("editModal");
    if (modal) modal.style.display = "none";
    activeEditTarget = null;
}

function saveEditModal(event) {
    event.preventDefault();
    if (!activeEditTarget) return;

    if (activeEditTarget.kind === "goal") {
        data.savings = normalizeSavingsGoals(data.savings);
        const goal = data.savings.find(item => item.id === activeEditTarget.goalId);
        if (!goal) {
            closeEditModal();
            return;
        }

        const name = document.getElementById("editGoalName").value.trim() || "My Goal";
        const target = parseFloat(document.getElementById("editGoalTarget").value);
        const current = parseFloat(document.getElementById("editGoalCurrent").value);
        const deadlineEl = document.getElementById("editGoalDeadline");
        const deadlineRaw = deadlineEl ? deadlineEl.value.trim() : "";
        const deadline = /^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw) ? deadlineRaw : "";
        const deductEl = document.getElementById("editGoalDeduct");

        if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) {
            showToast("Please enter valid goal amounts.", "warning");
            return;
        }

        goal.name = name;
        goal.target = target;
        goal.current = current;
        goal.deadline = deadline;
        goal.deductFromBalance = Boolean(deductEl && deductEl.checked);

        closeEditModal();
        saveUserData();
        showToast("Savings goal updated!", "success");
        return;
    }

    if (activeEditTarget.kind === "quickChip") {
        const label = document.getElementById("editChipLabel").value.trim();
        const amount = parseFloat(document.getElementById("editChipAmount").value);
        const cat = document.getElementById("editChipCat").value || "Others";

        if (!label || !Number.isFinite(amount) || amount <= 0) {
            showToast("Please enter a valid label and amount.", "warning");
            return;
        }

        data.quickChips = normalizeQuickChips(data.quickChips);
        data.quickChips.push({
            id: makeId(),
            label: label,
            amount: amount,
            cat: cat
        });

        closeEditModal();
        saveUserData();
        showToast('Quick-add chip "' + label + '" saved!', "success");
        return;
    }

    if (activeEditTarget.kind === "bill") {
        const name = document.getElementById("editBillName").value.trim();
        const amount = parseFloat(document.getElementById("editBillAmount").value);
        const dueDay = parseInt(document.getElementById("editBillDueDay").value, 10);
        const cat = document.getElementById("editBillCat").value || "Bills & Utilities";

        if (!name || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
            showToast("Please enter valid bill details (Due day 1–31).", "warning");
            return;
        }

        data.recurringBills = normalizeRecurringBills(data.recurringBills);
        if (activeEditTarget.billId) {
            const existing = data.recurringBills.find(item => item.id === activeEditTarget.billId);
            if (existing) {
                existing.name = name;
                existing.amount = amount;
                existing.dueDay = dueDay;
                existing.cat = cat;
            }
        } else {
            data.recurringBills.push({
                id: makeId(),
                name: name,
                amount: amount,
                cat: cat,
                dueDay: dueDay,
                lastPaidMonth: "",
                lastPaidDate: ""
            });
        }

        closeEditModal();
        saveUserData();
        showToast("Recurring bill saved!", "success");
        return;
    }

    if (activeEditTarget.kind === "transaction") {
        const { type, index } = activeEditTarget;
        const item = data[type] && data[type][index];
        if (!item) {
            closeEditModal();
            return;
        }

        const text = document.getElementById("editTxText").value.trim();
        const amount = parseFloat(document.getElementById("editTxAmount").value);
        const dateISO = document.getElementById("editTxDate").value;

        if (!text || !Number.isFinite(amount) || amount <= 0 || !dateISO) {
            showToast("Please enter valid details.", "warning");
            return;
        }

        const parsedDate = new Date(dateISO + "T12:00:00");
        const formattedDate = !isNaN(parsedDate.getTime())
            ? parsedDate.toLocaleDateString()
            : item.date;

        if (type === "incomes") {
            item.source = text;
        } else {
            item.note = text;
            const catEl = document.getElementById("editTxCat");
            if (catEl) item.cat = catEl.value;
        }

        const previousDateISO = getTransactionDateISO(item);

        item.amount = amount;
        item.dateISO = dateISO;
        item.date = formattedDate;
        if (previousDateISO !== dateISO || !item.ts) {
            item.ts = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Date.now();
        }

        closeEditModal();
        saveUserData();
        showToast("Transaction updated!", "success");
    }
}

/* ==========================================
QUICK-ADD CHIPS, BILLS & GOAL PACE HELPERS
========================================== */

function quickAddExpenseChip(chipId) {
    data.quickChips = normalizeQuickChips(data.quickChips);
    const chip = data.quickChips.find(item => item.id === chipId);
    if (!chip) return;

    const expenseDateEl = document.getElementById("expenseDate");
    const dateEntry = buildDateEntry(expenseDateEl ? expenseDateEl.value : todayISO());

    data.expenses.push({
        id: makeId(),
        cat: chip.cat || "Others",
        note: chip.label,
        amount: Number(chip.amount),
        date: dateEntry.date,
        ts: dateEntry.ts,
        dateISO: dateEntry.dateISO
    });

    saveUserData();
    showToast("Added " + chip.label + " (-" + money(chip.amount) + ")!", "success");
}

async function deleteQuickChip(chipId, event) {
    if (event) event.stopPropagation();
    data.quickChips = normalizeQuickChips(data.quickChips);
    const chip = data.quickChips.find(item => item.id === chipId);
    if (!chip) return;

    const confirmed = await showConfirmModal({
        eyebrow: "REMOVE QUICK-ADD CHIP",
        title: "Delete Quick-Add Chip?",
        message: 'Are you sure you want to delete the "' + chip.label + '" (' + money(chip.amount) + ') quick-add chip?',
        confirmText: "Delete Chip",
        danger: true
    });

    if (!confirmed) return;

    data.quickChips = data.quickChips.filter(item => item.id !== chipId);
    saveUserData();
    showToast('Quick-add chip "' + chip.label + '" removed.', "info");
}

function renderQuickChips() {
    const container = document.getElementById("quickChipsList");
    if (!container) return;

    data.quickChips = normalizeQuickChips(data.quickChips);

    if (!data.quickChips.length) {
        container.innerHTML = '<small style="color:var(--muted)">No quick-add chips yet. Click + Add Chip to create one.</small>';
        return;
    }

    container.innerHTML = data.quickChips.map(chip => {
        const safeId = escapeHTML(chip.id);
        return `
            <div class="quick-chip-item">
                <button type="button" class="quick-chip-btn"
                    onclick="quickAddExpenseChip('${safeId}')"
                    title="Category: ${escapeHTML(chip.cat)}">
                    <span>${escapeHTML(chip.label)}</span>
                    <strong>${money(chip.amount)}</strong>
                </button>
                <button type="button" class="quick-chip-remove"
                    onclick="deleteQuickChip('${safeId}', event)"
                    aria-label="Remove ${escapeHTML(chip.label)} chip">×</button>
            </div>
        `;
    }).join("");
}

function getOrdinalDay(day) {
    const n = Number(day) || 1;
    if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
    switch (n % 10) {
        case 1: return n + "st";
        case 2: return n + "nd";
        case 3: return n + "rd";
        default: return n + "th";
    }
}

function resolveBillPaidDateISO(bill, currentMonthKey) {
    if (
        bill.lastPaidDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(bill.lastPaidDate) &&
        bill.lastPaidDate.slice(0, 7) === currentMonthKey
    ) {
        return bill.lastPaidDate;
    }

    const billNameLower = String(bill.name || "").trim().toLowerCase();
    if (billNameLower && Array.isArray(data.expenses)) {
        const matches = data.expenses
            .filter(exp => {
                const expDateISO = getTransactionDateISO(exp);
                return (
                    expDateISO.slice(0, 7) === currentMonthKey &&
                    String(exp.note || "").trim().toLowerCase() === billNameLower
                );
            })
            .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));

        if (matches.length) {
            return getTransactionDateISO(matches[0]);
        }
    }

    return "";
}

function getBillStatus(bill, currentMonthKey, todayDay) {
    if (bill.lastPaidMonth === currentMonthKey) {
        const paidDateISO = resolveBillPaidDateISO(bill, currentMonthKey);
        const paidLabel = paidDateISO
            ? formatFullDateLabel(paidDateISO, true)
            : formatMonthLabel(currentMonthKey, true);

        return {
            key: "paid",
            label: "Paid (" + paidLabel + ")",
            className: "bill-status-paid"
        };
    }

    if (todayDay > bill.dueDay) {
        return {
            key: "overdue",
            label: "Overdue (Due " + getOrdinalDay(bill.dueDay) + ")",
            className: "bill-status-overdue"
        };
    }

    if (todayDay === bill.dueDay) {
        return {
            key: "due",
            label: "Due Today",
            className: "bill-status-due"
        };
    }

    const daysAway = bill.dueDay - todayDay;
    if (daysAway <= 5) {
        return {
            key: "upcoming",
            label: "Due in " + daysAway + (daysAway === 1 ? " day" : " days"),
            className: "bill-status-due"
        };
    }

    return {
        key: "scheduled",
        label: "Due every " + getOrdinalDay(bill.dueDay),
        className: "bill-status-due"
    };
}

async function payRecurringBill(billId) {
    data.recurringBills = normalizeRecurringBills(data.recurringBills);
    const bill = data.recurringBills.find(item => item.id === billId);
    if (!bill) return;

    const expenseDateEl = document.getElementById("expenseDate");
    const dateEntry = buildDateEntry(expenseDateEl ? expenseDateEl.value : todayISO());
    const targetMonthKey = dateEntry.dateISO.slice(0, 7);

    if (bill.lastPaidMonth === targetMonthKey) {
        const lastPaidLabel = resolveBillPaidDateISO(bill, targetMonthKey)
            ? formatFullDateLabel(resolveBillPaidDateISO(bill, targetMonthKey), true)
            : formatMonthLabel(targetMonthKey, true);

        const confirmed = await showConfirmModal({
            eyebrow: "ALREADY PAID THIS MONTH",
            title: "Log Payment Again?",
            message:
                '"' + bill.name + '" (' + money(bill.amount) + ') was already paid on ' + lastPaidLabel + ".\n\n" +
                "Do you want to log another payment to your expenses?",
            confirmText: "Log Payment Again"
        });

        if (!confirmed) return;
    }

    data.expenses.push({
        id: makeId(),
        cat: bill.cat || "Bills & Utilities",
        note: bill.name,
        amount: Number(bill.amount),
        date: dateEntry.date,
        ts: dateEntry.ts,
        dateISO: dateEntry.dateISO
    });

    bill.lastPaidMonth = targetMonthKey;
    bill.lastPaidDate = dateEntry.dateISO;

    saveUserData();
    showToast(
        'Logged payment for "' + bill.name + '" (-' + money(bill.amount) + ") on " + formatFullDateLabel(dateEntry.dateISO, true) + "!",
        "success"
    );
}

async function deleteRecurringBill(billId) {
    data.recurringBills = normalizeRecurringBills(data.recurringBills);
    const bill = data.recurringBills.find(item => item.id === billId);
    if (!bill) return;

    const confirmed = await showConfirmModal({
        eyebrow: "DELETE RECURRING BILL",
        title: "Delete Recurring Bill?",
        message: 'Remove "' + bill.name + '" from your recurring bills?',
        confirmText: "Delete Bill",
        danger: true
    });

    if (!confirmed) return;

    data.recurringBills = data.recurringBills.filter(item => item.id !== billId);
    saveUserData();
    showToast('Recurring bill "' + bill.name + '" removed.', "info");
}

function renderRecurringBills() {
    const listEl = document.getElementById("recurringBillsList");
    const homeWidgetEl = document.getElementById("homeBillsWidget");

    data.recurringBills = normalizeRecurringBills(data.recurringBills);
    const currentMonthKey = getCurrentMonthKey();
    const todayDay = new Date().getDate();
    const sorted = [...data.recurringBills].sort((a, b) => a.dueDay - b.dueDay);

    if (listEl) {
        if (!sorted.length) {
            listEl.innerHTML = '<p class="empty-message">No recurring bills yet. Click + Add Bill to track monthly payments.</p>';
        } else {
            listEl.innerHTML = sorted.map(bill => {
                const status = getBillStatus(bill, currentMonthKey, todayDay);
                const safeId = escapeHTML(bill.id);
                const isPaid = status.key === "paid";

                return `
                    <div class="recurring-bill-card">
                        <div class="recurring-bill-top">
                            <div>
                                <h4>${escapeHTML(bill.name)}</h4>
                                <small>${escapeHTML(bill.cat)} · Every ${getOrdinalDay(bill.dueDay)}</small>
                            </div>
                            <span class="recurring-bill-amount">${money(bill.amount)}</span>
                        </div>
                        <div class="recurring-bill-meta">
                            <span class="bill-status-badge ${status.className}">${escapeHTML(status.label)}</span>
                        </div>
                        <div class="recurring-bill-actions">
                            <button type="button" class="${isPaid ? "btn-outline" : "btn-primary"}"
                                onclick="payRecurringBill('${safeId}')">
                                ${isPaid ? "Log Again" : "✓ Log Payment"}
                            </button>
                            <button type="button" class="btn-edit"
                                onclick="openRecurringBillModal('${safeId}')">
                                Edit
                            </button>
                            <button type="button" class="btn-delete"
                                onclick="deleteRecurringBill('${safeId}')">
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    if (homeWidgetEl) {
        const dueBills = sorted.filter(bill => {
            const st = getBillStatus(bill, currentMonthKey, todayDay);
            return st.key === "overdue" || st.key === "due" || st.key === "upcoming";
        });

        if (!dueBills.length) {
            homeWidgetEl.style.display = "none";
            homeWidgetEl.innerHTML = "";
        } else {
            const totalDue = dueBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
            const firstBill = dueBills[0];
            homeWidgetEl.style.display = "block";
            homeWidgetEl.innerHTML = `
                <div class="home-bills-card">
                    <div class="home-bills-card-info">
                        <strong>Upcoming / Due Bills (${dueBills.length}) · ${money(totalDue)}</strong>
                        <small>Next: ${escapeHTML(firstBill.name)} (${money(firstBill.amount)}, every ${getOrdinalDay(firstBill.dueDay)})</small>
                    </div>
                    <div class="home-bills-card-actions">
                        <button type="button" class="btn-primary btn-small"
                            onclick="payRecurringBill('${escapeHTML(firstBill.id)}')">
                            Pay ${escapeHTML(firstBill.name)}
                        </button>
                        <button type="button" class="btn-outline btn-small"
                            onclick="navigateFromShortcut('dashboard', null, '#recurringBillsPanel')">
                            Manage Bills →
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

function formatGoalPaceHTML(goal, remaining) {
    if (!goal.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(goal.deadline)) {
        return "";
    }

    const deadlineDate = new Date(goal.deadline + "T00:00:00");
    const todayDate = new Date(todayISO() + "T00:00:00");
    if (isNaN(deadlineDate.getTime())) return "";

    const formattedDeadline = deadlineDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

    if (remaining <= 0) {
        return `
            <div class="goal-deadline-meta">
                <strong>Target Date:</strong> ${escapeHTML(formattedDeadline)} · Goal completed!
            </div>
        `;
    }

    const daysLeft = Math.ceil((deadlineDate.getTime() - todayDate.getTime()) / 86400000);

    if (daysLeft <= 0) {
        return `
            <div class="goal-deadline-meta">
                <strong>Target Date:</strong> ${escapeHTML(formattedDeadline)} (Passed) ·
                ${money(remaining)} left to complete
            </div>
        `;
    }

    const perDay = remaining / daysLeft;
    const perWeek = remaining / Math.max(1, daysLeft / 7);
    const perMonth = remaining / Math.max(1, daysLeft / 30);

    return `
        <div class="goal-deadline-meta">
            <strong>Target:</strong> ${escapeHTML(formattedDeadline)} (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)<br>
            <strong>Pace:</strong> ${money(perDay)}/day · ${money(perWeek)}/wk · ${money(perMonth)}/mo
        </div>
    `;
}
/* ==========================================
MAIN RENDER FUNCTION
========================================== */

function renderAll() {
    if (!user) return;

    syncPeriodUI();
    populateCategorySelects();

    const goalsList = normalizeSavingsGoals(data.savings);
    data.settings = normalizeUserSettings(data.settings);

    const deductedGoals = goalsList.filter(g => Boolean(g.deductFromBalance));
    const deductedSavingsTotal = deductedGoals.reduce(
        (sum, g) => sum + (Number(g.current) || 0),
        0
    );
    const deductSavings = deductedGoals.length > 0;

    let totalIncome = 0;
    let totalExpense = 0;

    data.incomes.forEach(income => {
        if (activeHomePeriod !== "all" && getTransactionDateISO(income).slice(0, 7) !== activeHomePeriod) {
            return;
        }
        totalIncome += Number(income.amount) || 0;
    });

    data.expenses.forEach(expense => {
        if (activeHomePeriod !== "all" && getTransactionDateISO(expense).slice(0, 7) !== activeHomePeriod) {
            return;
        }
        totalExpense += Number(expense.amount) || 0;
    });

    const balance = totalIncome - totalExpense - deductedSavingsTotal;

    const hIncomeLabel = document.getElementById("hIncomeLabel");
    const hExpenseLabel = document.getElementById("hExpenseLabel");
    const hBalanceLabel = document.getElementById("hBalanceLabel");
    const hIncomeSub = document.getElementById("hIncomeSub");
    const hExpenseSub = document.getElementById("hExpenseSub");
    const hBalanceSub = document.getElementById("hBalanceSub");

    if (activeHomePeriod === "all") {
        if (hIncomeLabel) hIncomeLabel.innerText = "TOTAL INCOME";
        if (hExpenseLabel) hExpenseLabel.innerText = "TOTAL EXPENSES";
        if (hBalanceLabel) hBalanceLabel.innerText = deductSavings ? "SPENDABLE BALANCE" : "TOTAL BALANCE";
        if (hIncomeSub) hIncomeSub.innerText = "Money coming in";
        if (hExpenseSub) hExpenseSub.innerText = "Money going out";
    } else {
        const shortLabel = formatMonthLabel(activeHomePeriod, true).toUpperCase();
        if (hIncomeLabel) hIncomeLabel.innerText = "INCOME (" + shortLabel + ")";
        if (hExpenseLabel) hExpenseLabel.innerText = "EXPENSES (" + shortLabel + ")";
        if (hBalanceLabel) hBalanceLabel.innerText = deductSavings ? "SPENDABLE (" + shortLabel + ")" : "NET (" + shortLabel + ")";
        if (hIncomeSub) hIncomeSub.innerText = "Recorded in " + formatMonthLabel(activeHomePeriod);
        if (hExpenseSub) hExpenseSub.innerText = "Spent in " + formatMonthLabel(activeHomePeriod);
    }

    const balanceHidden = isBalanceHidden();
    const homeBalanceCard = document.getElementById("homeBalanceCard");
    const balancePrivacyBtn = document.getElementById("balancePrivacyBtn");
    const startingBalanceBtn = document.getElementById("startingBalanceBtn");

    if (homeBalanceCard) {
        homeBalanceCard.classList.toggle("is-deficit", !balanceHidden && balance < 0);
    }

    if (balancePrivacyBtn) {
        balancePrivacyBtn.innerText = balanceHidden ? "Show" : "Hide";
        balancePrivacyBtn.setAttribute(
            "aria-label",
            balanceHidden ? "Show balance amounts" : "Hide balance amounts"
        );
    }

    if (hBalanceSub) {
        if (balanceHidden) {
            hBalanceSub.innerText = "Amounts hidden — tap Show to view";
        } else if (balance < 0) {
            const deficitAmount = money(Math.abs(balance));
            hBalanceSub.innerText = deductSavings && deductedSavingsTotal > 0
                ? "Deficit of " + deficitAmount + " (after " + money(deductedSavingsTotal) + " in selected savings)"
                : "Deficit — expenses exceeded income by " + deficitAmount;
        } else if (deductSavings) {
            hBalanceSub.innerText = deductedSavingsTotal > 0
                ? "After " + money(deductedSavingsTotal) + " in " + deductedGoals.length + " selected " + (deductedGoals.length === 1 ? "goal" : "goals")
                : "Selected savings goal currently at ₱0.00";
        } else {
            hBalanceSub.innerText = "Your remaining money";
        }
    }

    if (startingBalanceBtn) {
        startingBalanceBtn.style.display = (!balanceHidden && balance <= 0) ? "inline-flex" : "none";
    }

    document.getElementById("hIncome").innerText =
        balanceHidden ? "₱•••••" : money(totalIncome);

    document.getElementById("hExpense").innerText =
        balanceHidden ? "₱•••••" : money(totalExpense);

    document.getElementById("hBalance").innerText =
        balanceHidden ? "₱•••••" : money(balance);

    /* SAVINGS GOAL WIDGET */

    const homeWidget = document.getElementById("homeGoalWidget");
    const dashboardWidget = document.getElementById("dashboardGoalWidget");
    const homeGoalPlaceholder = document.getElementById("homeGoalPlaceholder");

    if (goalsList.length) {
        if (homeGoalPlaceholder) {
            homeGoalPlaceholder.style.display = "none";
        }

        const totalTarget = goalsList.reduce((sum, g) => sum + (Number(g.target) || 0), 0);
        const totalCurrent = goalsList.reduce((sum, g) => sum + (Number(g.current) || 0), 0);
        const overallPercent = totalTarget > 0
            ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100))
            : 0;

        const firstGoal = goalsList[0];
        const titleText = goalsList.length === 1
            ? firstGoal.name
            : goalsList.length + " Active Savings Goals";

        const goalHTML = `
            <div class="goal-home-card"
                onclick="navigateFromShortcut('goals')">
                <div style="flex:1">
                    <small style="
                        font-size:10px;
                        font-weight:700;
                        color:var(--primary);
                    ">
                        ${goalsList.length === 1 ? "CURRENT GOAL" : "SAVINGS GOALS (" + goalsList.length + ")"}
                    </small>
                    <b style="
                        font-size:16px;
                        margin-top:5px;
                        display:block;
                    ">
                        ${escapeHTML(titleText)}
                    </b>
                    <div style="
                        height:8px;
                        background:var(--track-bg);
                        border-radius:10px;
                        overflow:hidden;
                        max-width:320px;
                        margin-top:10px;
                    ">
                        <div style="
                            height:100%;
                            background:var(--green);
                            width:${overallPercent}%;
                        "></div>
                    </div>
                    <small style="
                        font-size:12px;
                        color:var(--muted);
                        margin-top:6px;
                        display:block;
                    ">
                        ${money(totalCurrent)} / ${money(totalTarget)}
                    </small>
                </div>
                <b style="color:var(--heading)">
                    ${overallPercent}%
                </b>
            </div>
        `;

        if (homeWidget) {
            homeWidget.innerHTML = goalHTML;
            homeWidget.style.display = "block";
        }

        if (dashboardWidget) {
            dashboardWidget.innerHTML = goalHTML;
            dashboardWidget.style.display = "block";
        }

    } else {
        if (homeGoalPlaceholder) {
            homeGoalPlaceholder.style.display = "block";
        }
        if (homeWidget) homeWidget.style.display = "none";
        if (dashboardWidget) dashboardWidget.style.display = "none";
    }

    /* COMBINE TRANSACTIONS */

    const all = [];

    data.incomes.forEach(item => {
        all.push({
            id: item.id,
            text: item.source,
            amount: Number(item.amount),
            date: item.date,
            dateISO: item.dateISO || "",
            ts: item.ts || Number(item.id) || 0,
            type: "income"
        });
    });

    data.expenses.forEach(item => {
        all.push({
            id: item.id,
            text: item.note,
            amount: Number(item.amount),
            date: item.date,
            dateISO: item.dateISO || "",
            ts: item.ts || Number(item.id) || 0,
            type: "expense"
        });
    });

    all.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    /* DATE & PERIOD FILTER FOR RECENT TRANSACTIONS */

    let filtered = all;

    if (activeFilterDate) {
        filtered = all.filter(transaction =>
            transaction.dateISO === activeFilterDate
        );
    } else if (activeHomePeriod !== "all") {
        filtered = all.filter(transaction =>
            (transaction.dateISO || "").slice(0, 7) === activeHomePeriod
        );
    }

    /* DAILY SUMMARY */

    const dailySummary = document.getElementById("dailySummary");

    if (activeFilterDate && dailySummary) {
        let dayIncome = 0;
        let dayExpense = 0;

        filtered.forEach(transaction => {
            if (transaction.type === "income") {
                dayIncome += transaction.amount;
            } else {
                dayExpense += transaction.amount;
            }
        });

        const displayDate = new Date(
            activeFilterDate + "T00:00:00"
        ).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });

        dailySummary.style.display = "grid";

        dailySummary.innerHTML = `
            <div>
                <small>DATE</small>
                <b>${escapeHTML(displayDate)}</b>
            </div>
            <div>
                <small>INCOME THAT DAY</small>
                <b style="color:var(--primary)">
                    +${money(dayIncome)}
                </b>
            </div>
            <div>
                <small>EXPENSE THAT DAY</small>
                <b style="color:var(--red)">
                    -${money(dayExpense)}
                </b>
            </div>
        `;

    } else if (dailySummary) {
        dailySummary.style.display = "none";
    }

    /* RECENT TRANSACTIONS */

    const recentList = document.getElementById("recentList");

    const listToShow = (activeFilterDate || activeHomePeriod !== "all") ? filtered : all;

    const today = todayISO();

    let recentHTML = "";

    if (!listToShow.length) {
        recentHTML = activeFilterDate
            ? '<p style="text-align:center;padding:20px;color:#999">No transactions for this date.</p>'
            : (activeHomePeriod !== "all"
                ? '<p style="text-align:center;padding:20px;color:#999">No transactions for ' + escapeHTML(formatMonthLabel(activeHomePeriod)) + '.</p>'
                : '<p style="color:#999;padding:12px 0">No transactions yet.</p>');

    } else {

        listToShow.slice(0, 20).forEach(transaction => {
            const isToday = transaction.dateISO
                ? transaction.dateISO === today
                : transaction.date === new Date().toLocaleDateString();

            const isIncome = transaction.type === "income";

            recentHTML += `
                <div class="item"
                    style="${
                        isToday && !activeFilterDate
                        ? "background:var(--green-soft);border-left:3px solid var(--primary);padding-left:10px;border-radius:7px;"
                        : ""
                    }">
                    <div>
                        ${escapeHTML(transaction.text)}
                        ${
                            isToday && !activeFilterDate
                            ? '<span class="badge-new">TODAY</span>'
                            : ""
                        }
                        <br>
                        <small>${escapeHTML(transaction.date)}</small>
                    </div>
                    <b style="
                        color:${isIncome ? "var(--primary)" : "var(--red)"};
                        white-space:nowrap;
                    ">
                        ${isIncome ? "+" : "-"}${money(transaction.amount)}
                    </b>
                </div>
            `;
        });
    }

    if (recentList) {
        recentList.innerHTML = recentHTML;
    }

    const txSearchEl = document.getElementById("txSearchInput");
    const txCatEl = document.getElementById("txCategoryFilter");
    const searchQuery = txSearchEl ? txSearchEl.value.trim().toLowerCase() : "";
    const selectedCategory = txCatEl ? txCatEl.value : "ALL";

    /* INCOME LIST */

    const filteredIncomes = data.incomes
        .map((item, index) => ({ item, index }))
        .reverse()
        .filter(({ item }) => {
            if (!searchQuery) return true;
            const haystack = [
                item.source,
                item.amount,
                item.date,
                item.dateISO
            ].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(searchQuery);
        });

    let incomeHTML = "";

    filteredIncomes.forEach(({ item, index }) => {
        incomeHTML += `
            <div class="item">
                <div>
                    <b>${escapeHTML(item.source)}</b>
                    <br>
                    <small>${escapeHTML(item.date)}</small>
                </div>
                <div class="tx-item-actions">
                    <b style="color:var(--green)">
                        +${money(item.amount)}
                    </b>
                    <button type="button" class="btn-edit"
                        onclick="openEditTransaction('incomes',${index})">
                        Edit
                    </button>
                    <button type="button" class="btn-delete"
                        onclick="deleteItem('incomes',${index})">
                        Delete
                    </button>
                </div>
            </div>
        `;
    });

    const incomeList = document.getElementById("incomeList");

    if (incomeList) {
        incomeList.innerHTML =
            incomeHTML ||
            (searchQuery
                ? '<p class="empty-message">No matching income found.</p>'
                : '<p style="font-size:12px;color:var(--muted)">No income yet.</p>');
    }

    /* EXPENSE LIST */

    const filteredExpenses = data.expenses
        .map((item, index) => ({ item, index }))
        .reverse()
        .filter(({ item }) => {
            const cat = item.cat || "Others";
            if (selectedCategory !== "ALL" && cat !== selectedCategory) {
                return false;
            }
            if (!searchQuery) return true;
            const haystack = [
                item.note,
                cat,
                item.amount,
                item.date,
                item.dateISO
            ].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(searchQuery);
        });

    let expenseHTML = "";

    filteredExpenses.forEach(({ item, index }) => {
        expenseHTML += `
            <div class="item">
                <div>
                    <b>${escapeHTML(item.note)}</b>
                    <small>(${escapeHTML(item.cat)})</small>
                    <br>
                    <small>${escapeHTML(item.date)}</small>
                </div>
                <div class="tx-item-actions">
                    <b style="color:var(--red)">
                        -${money(item.amount)}
                    </b>
                    <button type="button" class="btn-edit"
                        onclick="openEditTransaction('expenses',${index})">
                        Edit
                    </button>
                    <button type="button" class="btn-delete"
                        onclick="deleteItem('expenses',${index})">
                        Delete
                    </button>
                </div>
            </div>
        `;
    });

    const expenseList = document.getElementById("expenseList");

    if (expenseList) {
        expenseList.innerHTML =
            expenseHTML ||
            (searchQuery || selectedCategory !== "ALL"
                ? '<p class="empty-message">No matching expenses found.</p>'
                : '<p style="font-size:12px;color:var(--muted)">No expenses yet.</p>');
    }

    /* SAVINGS DISPLAY (MULTIPLE GOALS) */

    const savingsDisplay = document.getElementById("savingsDisplay");
    const savingsGoalsList = document.getElementById("savingsGoalsList");
    const noGoal = document.getElementById("noGoal");
    const createGoalBtn = document.getElementById("createGoalBtn");
    const goalFormTitle = document.getElementById("goalFormTitle");
    const goalHelperText = document.getElementById("goalHelperText");

    if (createGoalBtn) {
        createGoalBtn.textContent = goalsList.length > 0
            ? "+ Add More Goals"
            : "+ Create Goal";
    }

    if (goalFormTitle) {
        goalFormTitle.textContent = goalsList.length > 0
            ? "Add More Savings Goals"
            : "Create a Savings Goal";
    }

    if (goalHelperText) {
        goalHelperText.textContent = goalsList.length > 0
            ? "You currently have " + goalsList.length + " saved " + (goalsList.length === 1 ? "goal" : "goals") + ". Adding a new goal will keep your existing goals intact."
            : "You can add multiple savings goals without losing your existing ones.";
    }

    if (goalsList.length) {
        if (savingsDisplay) savingsDisplay.style.display = "grid";
        if (noGoal) noGoal.style.display = "none";

        if (savingsGoalsList) {
            savingsGoalsList.innerHTML = goalsList.map(goal => {
                const target = Number(goal.target) || 0;
                const current = Number(goal.current) || 0;
                const remaining = Math.max(0, target - current);
                const percent = target > 0
                    ? Math.min(100, Math.round((current / target) * 100))
                    : 0;
                const safeId = escapeHTML(goal.id);

                return `
                    <div class="savings-goal-card">
                        <div class="savings-goal-card-header">
                            <div>
                                <h3>${escapeHTML(goal.name)}</h3>
                                <small>${remaining === 0 ? "Goal reached!" : "Remaining: " + money(remaining)}</small>
                            </div>
                            <div class="savings-goal-card-header-actions">
                                <button type="button" class="btn-edit"
                                    onclick="openEditGoal('${safeId}')">
                                    Edit
                                </button>
                                <button type="button" class="btn-delete"
                                    onclick="deleteGoal('${safeId}')">
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div class="savings-percent">
                            <strong>${percent}%</strong>
                            <span>complete</span>
                        </div>

                        <div class="progress-track">
                            <div class="progress-fill" style="width:${percent}%"></div>
                        </div>

                        <p class="goal-amount-text">
                            ${money(current)} / ${money(target)}
                        </p>

                        ${formatGoalPaceHTML(goal, remaining)}

                        <label class="goal-deduct-toggle ${goal.deductFromBalance ? "is-active" : ""}"
                            for="goalDeduct-${safeId}">
                            <input type="checkbox"
                                id="goalDeduct-${safeId}"
                                ${goal.deductFromBalance ? "checked" : ""}
                                onchange="toggleGoalBalanceDeduct('${safeId}', this.checked)">
                            <span>Deduct from Spendable Balance</span>
                        </label>

                        <div class="goal-contribution">
                            <div class="form-group" style="margin-bottom:10px;">
                                <input type="number"
                                    id="goalAmount-${safeId}"
                                    min="0" step="0.01"
                                    placeholder="Enter amount (₱)">
                            </div>
                            <div class="savings-goal-card-actions">
                                <button type="button" class="btn-primary"
                                    onclick="addMoneyToGoal('${safeId}')">
                                    + Add Savings
                                </button>
                                <button type="button" class="btn-outline"
                                    onclick="deductMoneyFromGoal('${safeId}')">
                                    - Deduct
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }

    } else {
        if (savingsDisplay) savingsDisplay.style.display = "none";
        if (savingsGoalsList) savingsGoalsList.innerHTML = "";
        if (noGoal) noGoal.style.display = "block";
    }

    /* OTHER SECTIONS */

    renderQuickChips();
    renderRecurringBills();
    renderBudget();
    drawChart();
    updateAnalytics();
    renderSettingsMeta();
}

/* ==========================================
FORM EVENT LISTENERS
========================================== */

document.addEventListener("DOMContentLoaded", function () {
    applyTheme(getCurrentTheme(), false);
    initPWA();
    registerServiceWorker();

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();
            login();
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", function (event) {
            event.preventDefault();
            register();
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeEditModal();
            closeDialogModal(null);
            closeIOSInstallModal();
            closeMobileMoreMenu();
            closeQuickAddModal();
            closeManageCategoriesModal();
        }
    });

    window.addEventListener("popstate", function () {
        if (viewNavStack.length > 0) {
            goBackNav();
        }
    });

    checkAuth();
    addLoginRestoreUI();
    initCloudSync();
});

/* ==========================================
LOGIN PAGE - RESTORE BACKUP
========================================== */

function addLoginRestoreUI() {
    const fileInput = document.getElementById("loginRestoreFile");
    const restoreButton = document.getElementById("loginRestoreButton");

    if (fileInput && restoreButton) {
        if (!restoreButton.dataset.bound) {
            restoreButton.dataset.bound = "true";
            restoreButton.addEventListener("click", function () {
                fileInput.click();
            });
            fileInput.addEventListener("change", restoreBackupFromLogin);
        }
        return;
    }
}

/* ==========================================
VALIDATE BACKUP FILE
========================================== */

function validateLoginBackup(imported) {
    if (
        !imported ||
        typeof imported !== "object" ||
        !Array.isArray(imported.incomes) ||
        !Array.isArray(imported.expenses)
    ) {
        return false;
    }

    if (
        imported.budgets !== undefined &&
        (
            !imported.budgets ||
            typeof imported.budgets !== "object" ||
            Array.isArray(imported.budgets)
        )
    ) {
        return false;
    }

    if (
        imported.savings !== undefined &&
        imported.savings !== null &&
        typeof imported.savings !== "object"
    ) {
        return false;
    }

    return true;
}

/* ==========================================
RESTORE BACKUP FROM LOGIN PAGE
========================================== */

function restoreBackupFromLogin(event) {
    const inputEl = event.target;
    const file = inputEl.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
        showToast("Please select a valid Badyetly JSON backup file.", "warning");
        inputEl.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const imported = JSON.parse(e.target.result);

            if (!validateLoginBackup(imported)) {
                throw new Error("Invalid backup format.");
            }

            const backupName =
                String(imported.accountName || "").trim();

            if (!backupName) {
                showToast("The backup file does not contain an account name.", "error");
                return;
            }

            loadAccounts();

            const existingAccount = getAccount(backupName);

            if (existingAccount) {
                const restoreExisting = await showConfirmModal({
                    eyebrow: "EXISTING ACCOUNT FOUND",
                    title: 'Restore to "' + backupName + '"?',
                    message:
                        'An account named "' + backupName + '" already exists.\n\n' +
                        "Restore this backup to that account? Its current income, expenses, savings, and budgets will be replaced.",
                    confirmText: "Replace Account Data",
                    danger: true
                });

                if (restoreExisting) {
                    restoreBackupToExistingAccount(
                        existingAccount,
                        imported
                    );
                    return;
                }

                const createAnother = await showConfirmModal({
                    eyebrow: "RESTORE AS NEW ACCOUNT",
                    title: "Create a New Account Instead?",
                    message: "Would you rather restore this backup as a separate new account?",
                    confirmText: "Create New Account"
                });

                if (!createAnother) return;

                await createNewAccountFromBackup(imported, backupName);
                return;
            }

            await createNewAccountFromBackup(imported, backupName);

        } catch (error) {
            console.error("Backup restore error:", error);
            showToast("Unable to restore backup. Please check your JSON file.", "error");
        } finally {
            inputEl.value = "";
        }
    };

    reader.onerror = function () {
        showToast("Unable to read the selected backup file.", "error");
        inputEl.value = "";
    };

    reader.readAsText(file);
}

/* ==========================================
RESTORE TO EXISTING ACCOUNT
========================================== */

function restoreBackupToExistingAccount(account, imported) {
    const restoredData = {
        incomes: imported.incomes,
        expenses: imported.expenses,
        savings: normalizeSavingsGoals(imported.savings),
        budgets: imported.budgets || {},
        customCategories: extractImplicitCustomCategories(
            imported.expenses,
            imported.budgets,
            imported.customCategories
        ),
        quickChips: normalizeQuickChips(imported.quickChips),
        recurringBills: normalizeRecurringBills(imported.recurringBills),
        settings: normalizeUserSettings(imported.settings)
    };

    const meta = imported && imported.accountMeta && typeof imported.accountMeta === "object"
        ? imported.accountMeta
        : null;
    if (meta) {
        let accountUpdated = false;
        if (!hasAccountPassword(account) && meta.passHash && meta.passSalt) {
            account.passHash = String(meta.passHash);
            account.passSalt = String(meta.passSalt);
            accountUpdated = true;
        }
        if (!hasAccountRecoveryPin(account) && meta.recoveryPinHash && meta.recoveryPinSalt) {
            account.recoveryPinHash = String(meta.recoveryPinHash);
            account.recoveryPinSalt = String(meta.recoveryPinSalt);
            accountUpdated = true;
        }
        if (accountUpdated) {
            saveAccounts();
        }
    }

    const storageKey = getUserDataKey(account.name);
    const previousData = localStorage.getItem(storageKey);

    try {
        localStorage.setItem(
            storageKey,
            JSON.stringify(restoredData)
        );

        showToast(
            "Backup restored for " + account.name + "! You can now log in.",
            "success",
            5000
        );

        document.getElementById("loginName").value = account.name;
        syncLoginPassRequirement(account.name);
        const loginPassEl = document.getElementById("loginPass");
        if (loginPassEl) {
            loginPassEl.value = "";
            loginPassEl.focus();
        }

        const debug = document.getElementById("debug");

        if (debug) {
            debug.innerText = "Backup restored. Please log in.";
        }

        renderSaved();

    } catch (error) {
        console.error("Restore error:", error);

        try {
            if (previousData === null) {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, previousData);
            }
        } catch (rollbackError) {
            console.error("Restore rollback error:", rollbackError);
        }

        showToast("Unable to restore backup. Your existing data was preserved.", "error");
    }
}

/* ==========================================
RESTORE AS A NEW ACCOUNT
========================================== */

async function createNewAccountFromBackup(imported, originalName) {
    let newName = originalName;

    if (getAccount(newName)) {
        const enteredName = await showPromptModal({
            eyebrow: "ACCOUNT NAME IN USE",
            title: "Choose Account Name",
            message: "This account name is already in use. Enter a different name for your restored account.",
            label: "Account Name",
            defaultValue: originalName + " Restored",
            confirmText: "Restore Account"
        });

        if (!enteredName || !enteredName.trim()) return;

        newName = enteredName.trim();

        if (getAccount(newName)) {
            showToast("That account name already exists. Please try another name.", "warning");
            return;
        }
    }

    const meta = imported && imported.accountMeta && typeof imported.accountMeta === "object"
        ? imported.accountMeta
        : null;
    const hasPreservedPassword = Boolean(meta && meta.passHash && meta.passSalt);

    const newAccount = { name: newName };

    if (hasPreservedPassword) {
        newAccount.passHash = String(meta.passHash);
        newAccount.passSalt = String(meta.passSalt);
        if (meta.recoveryPinHash && meta.recoveryPinSalt) {
            newAccount.recoveryPinHash = String(meta.recoveryPinHash);
            newAccount.recoveryPinSalt = String(meta.recoveryPinSalt);
        }
    }

    const restoredData = {
        incomes: imported.incomes,
        expenses: imported.expenses,
        savings: normalizeSavingsGoals(imported.savings),
        budgets: imported.budgets || {},
        customCategories: extractImplicitCustomCategories(
            imported.expenses,
            imported.budgets,
            imported.customCategories
        ),
        quickChips: normalizeQuickChips(imported.quickChips),
        recurringBills: normalizeRecurringBills(imported.recurringBills),
        settings: normalizeUserSettings(imported.settings)
    };

    const previousAccounts = [...accounts];

    accounts.push(newAccount);

    if (!saveAccounts()) {
        accounts = previousAccounts;
        return;
    }

    try {
        localStorage.setItem(
            getUserDataKey(newName),
            JSON.stringify(restoredData)
        );

        if (!hasPreservedPassword) {
            setActiveUserSession(newName, true);
            showToast(
                "Backup restored as " + newName + "! Opening Badyetly — you can set a password & PIN in Settings.",
                "success",
                4500
            );
            setTimeout(() => location.reload(), 250);
            return;
        }

        showToast(
            "Backup restored as " + newName + "! Log in with your original password.",
            "success",
            5000
        );

        document.getElementById("loginName").value = newName;
        syncLoginPassRequirement(newName);
        const loginPassEl = document.getElementById("loginPass");
        if (loginPassEl) {
            loginPassEl.value = "";
            loginPassEl.focus();
        }

        const debug = document.getElementById("debug");

        if (debug) {
            debug.innerText = "Account restored. Log in with your original password.";
        }

        renderSaved();

    } catch (error) {
        console.error("New account restore error:", error);

        accounts = previousAccounts;
        saveAccounts();

        localStorage.removeItem(getUserDataKey(newName));

        showToast("Unable to save the restored backup. Please try again.", "error");
    }
}
/* ==========================================
CUSTOM CATEGORIES MANAGER
========================================== */

function getAllCategories(includeExtra) {
    const customList = normalizeCustomCategories(data.customCategories);
    const baseWithoutOthers = BADYETLY_CATEGORIES.filter(c => c !== "Others");
    const result = [...baseWithoutOthers, ...customList, "Others"];

    if (includeExtra && typeof includeExtra === "string") {
        const cleanExtra = includeExtra.trim();
        if (cleanExtra && !result.includes(cleanExtra)) {
            result.splice(result.length - 1, 0, cleanExtra);
        }
    }

    return result;
}

function populateCategorySelects() {
    const allCats = getAllCategories();

    const filterEl = document.getElementById("txCategoryFilter");
    if (filterEl) {
        const prev = filterEl.value || "ALL";
        filterEl.innerHTML =
            '<option value="ALL">All Categories</option>' +
            allCats.map(cat =>
                `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`
            ).join("");
        filterEl.value = prev === "ALL" || allCats.includes(prev) ? prev : "ALL";
    }

    ["budgetCat", "qaCategorySelect"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const prev = el.value;
        el.innerHTML = allCats.map(cat =>
            `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`
        ).join("");
        if (prev && allCats.includes(prev)) {
            el.value = prev;
        }
    });
}

function renderCustomCategoriesManager() {
    const customEl = document.getElementById("customCategoriesList");
    const defaultEl = document.getElementById("defaultCategoriesList");

    data.customCategories = normalizeCustomCategories(data.customCategories);

    if (customEl) {
        if (!data.customCategories.length) {
            customEl.innerHTML = '<small style="color:var(--muted)">No custom categories yet. Add one above!</small>';
        } else {
            customEl.innerHTML = data.customCategories.map(cat => {
                const encoded = encodeURIComponent(cat);
                return `
                    <span class="custom-cat-chip">
                        <span>${escapeHTML(cat)}</span>
                        <button type="button" class="custom-cat-remove"
                            onclick="deleteCustomCategory(decodeURIComponent('${encoded}'))"
                            aria-label="Remove ${escapeHTML(cat)}">×</button>
                    </span>
                `;
            }).join("");
        }
    }

    if (defaultEl) {
        defaultEl.innerHTML = BADYETLY_CATEGORIES.map(cat =>
            `<span class="custom-cat-chip is-default">${escapeHTML(cat)}</span>`
        ).join("");
    }
}

function openManageCategoriesModal() {
    const modal = document.getElementById("categoriesModal");
    if (!modal) return;
    renderCustomCategoriesManager();
    modal.style.display = "flex";
    const input = document.getElementById("newCustomCatInput");
    if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 30);
    }
}

function closeManageCategoriesModal() {
    const modal = document.getElementById("categoriesModal");
    if (modal) modal.style.display = "none";
}

function addCustomCategory(event) {
    if (event) event.preventDefault();
    const input = document.getElementById("newCustomCatInput");
    const rawName = input ? input.value.trim().slice(0, 60) : "";

    if (!rawName) {
        showToast("Please enter a category name.", "warning");
        return;
    }

    data.customCategories = normalizeCustomCategories(data.customCategories);
    const existsInAll = getAllCategories().some(
        c => c.toLowerCase() === rawName.toLowerCase()
    );

    if (existsInAll) {
        showToast('Category "' + rawName + '" already exists.', "warning");
        return;
    }

    if (data.customCategories.length >= 50) {
        showToast("Maximum of 50 custom categories reached.", "warning");
        return;
    }

    data.customCategories.push(rawName);
    if (input) input.value = "";

    saveUserData();
    renderCustomCategoriesManager();
    showToast('Custom category "' + rawName + '" added!', "success");
}

async function deleteCustomCategory(catName) {
    data.customCategories = normalizeCustomCategories(data.customCategories);
    const target = data.customCategories.find(
        c => c.toLowerCase() === String(catName || "").toLowerCase()
    );
    if (!target) return;

    const confirmed = await showConfirmModal({
        eyebrow: "REMOVE CATEGORY",
        title: "Remove Custom Category?",
        message: 'Remove "' + target + '" from your category list?\n\nExisting recorded expenses using this category will stay intact.',
        confirmText: "Remove",
        danger: true
    });

    if (!confirmed) return;

    data.customCategories = data.customCategories.filter(c => c !== target);
    saveUserData();
    renderCustomCategoriesManager();
    showToast('Removed "' + target + '" category.', "info");
}

/* ==========================================
PRINTABLE / PDF MONTHLY REPORT
========================================== */

function buildMonthlyReportHTML(monthKey) {
    const targetMonth = /^\d{4}-\d{2}$/.test(String(monthKey || ""))
        ? String(monthKey)
        : getSelectedReportMonth();
    const monthLabel = formatMonthLabel(targetMonth);
    const generatedAt = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    const monthlyIncomes = data.incomes
        .filter(item => getTransactionDateISO(item).slice(0, 7) === targetMonth)
        .map(item => ({
            type: "Income",
            cat: "Income",
            note: item.source || "Income",
            amount: Number(item.amount) || 0,
            dateISO: getTransactionDateISO(item),
            date: item.date || "",
            ts: Number(item.ts) || 0
        }));

    const monthlyExpenses = data.expenses
        .filter(item => getTransactionDateISO(item).slice(0, 7) === targetMonth)
        .map(item => ({
            type: "Expense",
            cat: item.cat || "Others",
            note: item.note || "Expense",
            amount: Number(item.amount) || 0,
            dateISO: getTransactionDateISO(item),
            date: item.date || "",
            ts: Number(item.ts) || 0
        }));

    const totalIncome = monthlyIncomes.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = monthlyExpenses.reduce((sum, item) => sum + item.amount, 0);
    const netBalance = totalIncome - totalExpense;

    const goals = normalizeSavingsGoals(data.savings);
    const totalSavedGoals = goals.reduce((sum, g) => sum + (Number(g.current) || 0), 0);

    const catSpent = {};
    monthlyExpenses.forEach(item => {
        catSpent[item.cat] = (catSpent[item.cat] || 0) + item.amount;
    });

    const budgetCategories = Object.keys(data.budgets || {});
    const allReportCats = Array.from(new Set([...Object.keys(catSpent), ...budgetCategories]));
    allReportCats.sort((a, b) => (catSpent[b] || 0) - (catSpent[a] || 0));

    const categoryRowsHTML = allReportCats.length
        ? allReportCats.map(cat => {
            const spent = catSpent[cat] || 0;
            const limit = Number((data.budgets || {})[cat]) || 0;
            const pctSpend = totalExpense > 0 ? Math.round((spent / totalExpense) * 100) : 0;
            const budgetStatus = limit > 0
                ? Math.round((spent / limit) * 100) + "% of " + money(limit)
                : "No limit";
            return `
                <tr>
                    <td>${escapeHTML(cat)}</td>
                    <td class="print-num">${money(spent)}</td>
                    <td class="print-num">${pctSpend}%</td>
                    <td class="print-num">${escapeHTML(budgetStatus)}</td>
                </tr>
            `;
        }).join("")
        : '<tr><td colspan="4">No expenses or budgets recorded for this month.</td></tr>';

    const goalsRowsHTML = goals.length
        ? goals.map(goal => {
            const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
            return `
                <tr>
                    <td>${escapeHTML(goal.name)}</td>
                    <td class="print-num">${money(goal.current)}</td>
                    <td class="print-num">${money(goal.target)}</td>
                    <td class="print-num">${pct}%</td>
                    <td>${goal.deadline ? escapeHTML(goal.deadline) : "—"}</td>
                </tr>
            `;
        }).join("")
        : '<tr><td colspan="5">No savings goals created yet.</td></tr>';

    const ledger = [...monthlyIncomes, ...monthlyExpenses]
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));

    const ledgerRowsHTML = ledger.length
        ? ledger.map(tx => `
            <tr>
                <td>${escapeHTML(tx.dateISO || tx.date || "—")}</td>
                <td>${escapeHTML(tx.type)}</td>
                <td>${escapeHTML(tx.cat)}</td>
                <td>${escapeHTML(tx.note)}</td>
                <td class="print-num">${tx.type === "Income" ? "+" : "-"}${money(tx.amount)}</td>
            </tr>
        `).join("")
        : '<tr><td colspan="5">No transactions recorded for ' + escapeHTML(monthLabel) + '.</td></tr>';

    return `
        <div class="print-header">
            <div>
                <div class="print-brand">Badyetly · Monthly Financial Report</div>
                <div class="print-subtitle">Track Your Pera Wisely · Executive Statement</div>
            </div>
            <div class="print-meta">
                <div><strong>Account:</strong> ${escapeHTML(user || "Personal Account")}</div>
                <div><strong>Period:</strong> ${escapeHTML(monthLabel)}</div>
                <div><strong>Generated:</strong> ${escapeHTML(generatedAt)}</div>
            </div>
        </div>

        <div class="print-kpi-grid">
            <div class="print-kpi-card">
                <small>MONTHLY INCOME</small>
                <strong>${money(totalIncome)}</strong>
            </div>
            <div class="print-kpi-card">
                <small>MONTHLY EXPENSES</small>
                <strong>${money(totalExpense)}</strong>
            </div>
            <div class="print-kpi-card">
                <small>NET BALANCE</small>
                <strong>${money(netBalance)}</strong>
            </div>
            <div class="print-kpi-card">
                <small>SAVINGS GOALS TOTAL</small>
                <strong>${money(totalSavedGoals)}</strong>
            </div>
        </div>

        <div class="print-section">
            <h3>Category &amp; Budget Breakdown</h3>
            <table class="print-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th class="print-num">Spent</th>
                        <th class="print-num">Share</th>
                        <th class="print-num">Budget Status</th>
                    </tr>
                </thead>
                <tbody>${categoryRowsHTML}</tbody>
            </table>
        </div>

        <div class="print-section">
            <h3>Savings Goals Progress</h3>
            <table class="print-table">
                <thead>
                    <tr>
                        <th>Goal</th>
                        <th class="print-num">Saved</th>
                        <th class="print-num">Target</th>
                        <th class="print-num">Progress</th>
                        <th>Target Date</th>
                    </tr>
                </thead>
                <tbody>${goalsRowsHTML}</tbody>
            </table>
        </div>

        <div class="print-section">
            <h3>Monthly Transactions (${ledger.length})</h3>
            <table class="print-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th class="print-num">Amount</th>
                    </tr>
                </thead>
                <tbody>${ledgerRowsHTML}</tbody>
            </table>
        </div>

        <div class="print-footer">
            <span>Badyetly Personal Budget Tracker</span>
            <span>Developer: April Amador</span>
        </div>
    `;
}

function printMonthlyReport(monthKeyOverride) {
    if (!user) return;
    const container = document.getElementById("printableReport");
    if (!container) return;

    const targetMonth = monthKeyOverride || getSelectedReportMonth();
    container.innerHTML = buildMonthlyReportHTML(targetMonth);

    setTimeout(() => {
        try {
            window.print();
        } catch (error) {
            console.error("Print error:", error);
            showToast("Unable to open print dialog on this browser.", "error");
        }
    }, 60);
}

/* ==========================================
FIREBASE CLOUD SYNC
========================================== */

let cloudSyncUser = null;
let cloudSyncBusy = false;
let cloudSyncLastAt = "";
let cloudSyncTimer = null;
let cloudSyncMeta = {
    workspaceCreatedAt: null,
    incomes: {},
    expenses: {}
};

function sanitizeFirestoreId(rawId) {
    const clean = String(rawId || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 128);
    return clean || makeId();
}

function ensureLocalTransactionIds() {
    let changed = false;
    data.incomes.forEach(item => {
        const cleanId = sanitizeFirestoreId(item.id);
        if (item.id !== cleanId) {
            item.id = cleanId;
            changed = true;
        }
    });
    data.expenses.forEach(item => {
        const cleanId = sanitizeFirestoreId(item.id);
        if (item.id !== cleanId) {
            item.id = cleanId;
            changed = true;
        }
    });
    if (changed && user) {
        try {
            localStorage.setItem(getUserDataKey(user), JSON.stringify(data));
        } catch (e) {}
    }
}

function buildCloudSyncPayloads() {
    ensureLocalTransactionIds();

    const safeBudgets = {};
    Object.entries(data.budgets || {}).slice(0, 60).forEach(([k, v]) => {
        const key = String(k || "").trim().slice(0, 100);
        const val = Number(v);
        if (key && Number.isFinite(val) && val > 0) {
            safeBudgets[key] = val;
        }
    });

    const safeCustomCats = normalizeCustomCategories(data.customCategories).slice(0, 50);
    const safeChips = normalizeQuickChips(data.quickChips).slice(0, 40);
    const safeBills = normalizeRecurringBills(data.recurringBills).slice(0, 50);
    const safeSavings = normalizeSavingsGoals(data.savings).slice(0, 50);
    const safeSettings = normalizeUserSettings(data.settings);

    const workspacePayload = {
        email: String((cloudSyncUser && cloudSyncUser.email) || "").slice(0, 200),
        displayName: String((cloudSyncUser && cloudSyncUser.displayName) || user || "Badyetly User").slice(0, 120),
        activeAccountName: String(user || "My Account").trim().slice(0, 100) || "My Account",
        budgets: safeBudgets,
        customCategories: safeCustomCats,
        quickChips: safeChips,
        recurringBills: safeBills,
        savings: safeSavings,
        settings: safeSettings
    };

    const incomesList = data.incomes
        .filter(item => item && Number(item.amount) > 0)
        .map(item => ({
            id: sanitizeFirestoreId(item.id),
            accountName: String(user || "My Account").trim().slice(0, 100) || "My Account",
            source: String(item.source || "Income").trim().slice(0, 200) || "Income",
            amount: Number(item.amount),
            date: String(item.date || "").slice(0, 40),
            dateISO: String(getTransactionDateISO(item) || "").slice(0, 20),
            ts: Math.max(0, Number(item.ts) || 0)
        }));

    const expensesList = data.expenses
        .filter(item => item && Number(item.amount) > 0)
        .map(item => ({
            id: sanitizeFirestoreId(item.id),
            accountName: String(user || "My Account").trim().slice(0, 100) || "My Account",
            cat: String(item.cat || "Others").trim().slice(0, 100) || "Others",
            note: String(item.note || "Expense").trim().slice(0, 250) || "Expense",
            amount: Number(item.amount),
            date: String(item.date || "").slice(0, 40),
            dateISO: String(getTransactionDateISO(item) || "").slice(0, 20),
            ts: Math.max(0, Number(item.ts) || 0)
        }));

    return { workspacePayload, incomesList, expensesList };
}

function syncCloudUI() {
    const badge = document.getElementById("cloudSyncBadge");
    const statusText = document.getElementById("cloudSyncStatusText");
    const userMeta = document.getElementById("cloudSyncUserMeta");
    const signInBtn = document.getElementById("cloudSyncSignInBtn");
    const syncNowBtn = document.getElementById("cloudSyncNowBtn");
    const pullBtn = document.getElementById("cloudSyncPullBtn");
    const signOutBtn = document.getElementById("cloudSyncSignOutBtn");

    if (!badge || !statusText) return;

    if (!cloudSyncUser) {
        badge.textContent = "Local Only";
        badge.classList.remove("pwa-status-installed");
        statusText.textContent = "Connect your Google account to back up and sync your Badyetly records across devices.";
        if (userMeta) {
            userMeta.style.display = "none";
            userMeta.innerHTML = "";
        }
        if (signInBtn) signInBtn.style.display = "inline-flex";
        if (syncNowBtn) syncNowBtn.style.display = "none";
        if (pullBtn) pullBtn.style.display = "none";
        if (signOutBtn) signOutBtn.style.display = "none";
        if (typeof renderAboutDetailsMeta === "function") renderAboutDetailsMeta();
        return;
    }

    badge.textContent = cloudSyncBusy ? "Syncing..." : "Cloud Connected";
    badge.classList.add("pwa-status-installed");
    statusText.textContent = cloudSyncLastAt
        ? "Your Badyetly data is synced to Google Cloud. Last synced: " + cloudSyncLastAt
        : "Connected to Google Cloud Sync. Changes auto-sync while online.";

    if (userMeta) {
        userMeta.style.display = "block";
        userMeta.innerHTML = `
            <strong>${escapeHTML(cloudSyncUser.displayName || "Google Account")}</strong>
            <small>${escapeHTML(cloudSyncUser.email || "")}</small>
        `;
    }

    if (signInBtn) signInBtn.style.display = "none";
    if (syncNowBtn) syncNowBtn.style.display = "inline-flex";
    if (pullBtn) pullBtn.style.display = "inline-flex";
    if (signOutBtn) signOutBtn.style.display = "inline-flex";
    if (typeof renderAboutDetailsMeta === "function") renderAboutDetailsMeta();
}

async function fetchCloudState(uid) {
    const fb = window.BadyetlyFirebase;
    if (!fb || !fb.ready) {
        throw new Error("Cloud Sync is currently offline or unavailable.");
    }

    const [workspace, incomes, expenses] = await Promise.all([
        fb.getUserWorkspace(uid),
        fb.getUserIncomes(uid),
        fb.getUserExpenses(uid)
    ]);

    const incomeCreatedMap = {};
    (incomes || []).forEach(docItem => {
        if (docItem && docItem.id) {
            incomeCreatedMap[docItem.id] = docItem.createdAt || null;
        }
    });

    const expenseCreatedMap = {};
    (expenses || []).forEach(docItem => {
        if (docItem && docItem.id) {
            expenseCreatedMap[docItem.id] = docItem.createdAt || null;
        }
    });

    cloudSyncMeta = {
        workspaceCreatedAt: workspace ? (workspace.createdAt || null) : null,
        incomes: incomeCreatedMap,
        expenses: expenseCreatedMap
    };

    return { workspace, incomes: incomes || [], expenses: expenses || [] };
}

function applyCloudStateToLocalData(cloudState) {
    const ws = cloudState.workspace || {};
    const sortedIncomes = [...cloudState.incomes]
        .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0))
        .map(item => ({
            id: item.id,
            source: item.source,
            amount: Number(item.amount) || 0,
            date: item.date || "",
            dateISO: item.dateISO || "",
            ts: Number(item.ts) || 0
        }));

    const sortedExpenses = [...cloudState.expenses]
        .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0))
        .map(item => ({
            id: item.id,
            cat: item.cat || "Others",
            note: item.note,
            amount: Number(item.amount) || 0,
            date: item.date || "",
            dateISO: item.dateISO || "",
            ts: Number(item.ts) || 0
        }));

    const budgets = ws.budgets && typeof ws.budgets === "object" ? ws.budgets : {};

    data = {
        incomes: sortedIncomes,
        expenses: sortedExpenses,
        savings: normalizeSavingsGoals(ws.savings),
        budgets: budgets,
        customCategories: extractImplicitCustomCategories(
            sortedExpenses,
            budgets,
            ws.customCategories
        ),
        quickChips: normalizeQuickChips(ws.quickChips),
        recurringBills: normalizeRecurringBills(ws.recurringBills),
        settings: normalizeUserSettings(ws.settings)
    };
}

async function pushLocalToCloud(showNotifications = false) {
    const fb = window.BadyetlyFirebase;
    if (!fb || !fb.ready || !cloudSyncUser || !user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (showNotifications) showToast("You are offline. Changes will sync when back online.", "warning");
        return;
    }

    cloudSyncBusy = true;
    syncCloudUI();

    try {
        if (!cloudSyncMeta.workspaceCreatedAt) {
            await fetchCloudState(cloudSyncUser.uid);
        }

        const { workspacePayload, incomesList, expensesList } = buildCloudSyncPayloads();
        await fb.pushWorkspaceBatch(
            cloudSyncUser.uid,
            workspacePayload,
            incomesList,
            expensesList,
            cloudSyncMeta
        );

        await fetchCloudState(cloudSyncUser.uid);

        cloudSyncLastAt = new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        });

        if (showNotifications) {
            showToast("Synced to Google Cloud!", "success");
        }
    } catch (error) {
        console.error("Cloud push error:", error);
        if (showNotifications) {
            showToast("Cloud sync failed. Your data remains saved locally.", "error");
        }
    } finally {
        cloudSyncBusy = false;
        syncCloudUI();
    }
}

async function pullCloudToLocal(askConfirm = true) {
    if (!cloudSyncUser || !user) return;

    cloudSyncBusy = true;
    syncCloudUI();

    try {
        const cloudState = await fetchCloudState(cloudSyncUser.uid);

        if (!cloudState.workspace) {
            showToast("No cloud backup found yet for this Google account.", "info");
            return;
        }

        if (askConfirm) {
            const confirmed = await showConfirmModal({
                eyebrow: "DOWNLOAD FROM CLOUD",
                title: "Replace Device Data with Cloud?",
                message:
                    "Cloud records found:\n" +
                    "• Incomes: " + cloudState.incomes.length + "\n" +
                    "• Expenses: " + cloudState.expenses.length + "\n\n" +
                    "This will replace your current local records on this device.",
                confirmText: "Download Cloud Data",
                danger: true
            });

            if (!confirmed) return;
        }

        applyCloudStateToLocalData(cloudState);
        saveUserData(true);

        cloudSyncLastAt = new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        });

        showToast("Cloud records downloaded to this device!", "success");
    } catch (error) {
        console.error("Cloud pull error:", error);
        showToast("Unable to download from Cloud. Check your connection.", "error");
    } finally {
        cloudSyncBusy = false;
        syncCloudUI();
    }
}

function scheduleCloudSync() {
    if (!cloudSyncUser || !user) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
        pushLocalToCloud(false);
    }, 800);
}

async function syncNowWithCloud() {
    if (!cloudSyncUser) {
        await cloudSyncSignIn();
        return;
    }
    await pushLocalToCloud(true);
}

function handleGoogleAuthError(error) {
    console.error("Google sign-in error:", error);
    const msg = String((error && (error.code || error.message)) || "");
    if (msg.includes("auth/popup-closed-by-user") || msg.includes("auth/cancelled-popup-request")) {
        showToast("Google sign-in was cancelled.", "info");
        return;
    }
    if (msg.includes("auth/unauthorized-domain")) {
        const host = window.location.hostname || "this domain";
        showConfirmModal({
            eyebrow: "DOMAIN AUTHORIZATION NEEDED",
            title: "Authorize Domain for Google Login",
            message:
                'Add "' + host + '" inside Firebase Console → Authentication → Settings → Authorized domains so Google Sign-In works on your live site.',
            confirmText: "Got it",
            cancelText: "Close"
        });
        return;
    }
    showToast("Unable to connect Google Cloud Sync. Check your internet connection.", "error");
}

async function cloudSyncSignIn() {
    const fb = window.BadyetlyFirebase;
    if (!fb || !fb.ready) {
        showToast("Cloud Sync is unavailable offline. Local storage is active.", "warning");
        return;
    }

    try {
        const cred = await fb.signInWithGoogle();
        cloudSyncUser = cred.user;
        syncCloudUI();

        const cloudState = await fetchCloudState(cloudSyncUser.uid);
        const hasLocal =
            data.incomes.length > 0 ||
            data.expenses.length > 0 ||
            normalizeSavingsGoals(data.savings).length > 0 ||
            Object.keys(data.budgets || {}).length > 0;

        if (!cloudState.workspace) {
            await pushLocalToCloud(true);
            return;
        }

        if (!hasLocal) {
            applyCloudStateToLocalData(cloudState);
            saveUserData(true);
            cloudSyncLastAt = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            syncCloudUI();
            showToast("Connected & restored your cloud data!", "success");
            return;
        }

        const useCloud = await showConfirmModal({
            eyebrow: "CLOUD BACKUP FOUND",
            title: "Choose Which Data to Keep",
            message:
                "Your Google account already has cloud data (" +
                cloudState.incomes.length + " incomes, " +
                cloudState.expenses.length + " expenses).\n\n" +
                "Download Cloud Data onto this device? (Cancel to keep local data and upload it to Cloud instead.)",
            confirmText: "Download Cloud Data",
            cancelText: "Upload Device Data"
        });

        if (useCloud) {
            applyCloudStateToLocalData(cloudState);
            saveUserData(true);
            cloudSyncLastAt = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            syncCloudUI();
            showToast("Cloud data loaded onto this device!", "success");
        } else {
            await pushLocalToCloud(true);
        }
    } catch (error) {
        handleGoogleAuthError(error);
    }
}

async function cloudSyncSignOut() {
    const fb = window.BadyetlyFirebase;
    if (!fb || !fb.ready) return;

    const confirmed = await showConfirmModal({
        eyebrow: "DISCONNECT CLOUD",
        title: "Disconnect Google Cloud Sync?",
        message: "Your local data on this device will stay safe, but automatic cloud syncing will pause until you sign in again.",
        confirmText: "Disconnect"
    });

    if (!confirmed) return;

    try {
        await fb.signOutGoogle();
        cloudSyncUser = null;
        cloudSyncLastAt = "";
        cloudSyncMeta = { workspaceCreatedAt: null, incomes: {}, expenses: {} };
        syncCloudUI();
        showToast("Disconnected from Google Cloud Sync.", "info");
    } catch (error) {
        console.error("Sign out error:", error);
        showToast("Error disconnecting Google account.", "error");
    }
}

async function loginWithGoogleCloudSync() {
    const fb = window.BadyetlyFirebase;
    if (!fb || !fb.ready) {
        showToast("Cloud Sync requires an internet connection.", "warning");
        return;
    }

    try {
        const cred = await fb.signInWithGoogle();
        const gUser = cred.user;
        cloudSyncUser = gUser;

        const cloudState = await fetchCloudState(gUser.uid);

        if (!cloudState.workspace) {
            showToast("No cloud backup found for this Google account yet. Create an account or log in first, then connect Cloud Sync in Settings.", "warning", 5000);
            return;
        }

        loadAccounts();
        const cloudAccountName = String(
            cloudState.workspace.activeAccountName ||
            gUser.displayName ||
            (gUser.email ? gUser.email.split("@")[0] : "Badyetly User")
        ).trim();

        let localAcc = getAccount(cloudAccountName);
        if (!localAcc) {
            const newPass = await showPromptModal({
                eyebrow: "RESTORE CLOUD ACCOUNT",
                title: 'Set Device PIN / Password for "' + cloudAccountName + '"',
                message: "Create a local password (at least 4 characters) for quick offline access on this device.",
                label: "Local Password",
                placeholder: "At least 4 characters",
                inputType: "password",
                confirmText: "Restore & Log In"
            });
            if (!newPass || newPass.length < 4) {
                showToast("Password must be at least 4 characters.", "warning");
                return;
            }
            localAcc = setAccountPasswordFields({ name: cloudAccountName, googleUid: gUser.uid }, newPass);
            accounts.push(localAcc);
            if (!saveAccounts()) {
                accounts.pop();
                return;
            }
        }

        applyCloudStateToLocalData(cloudState);
        localStorage.setItem(getUserDataKey(localAcc.name), JSON.stringify(data));
        setActiveUserSession(localAcc.name, true);
        showToast("Cloud account restored! Opening Badyetly...", "success");
        setTimeout(() => location.reload(), 250);
    } catch (error) {
        handleGoogleAuthError(error);
    }
}

function initCloudSync() {
    const attach = () => {
        const fb = window.BadyetlyFirebase;
        if (!fb || !fb.ready) {
            syncCloudUI();
            return;
        }
        fb.onAuthChange(authUser => {
            cloudSyncUser = authUser || null;
            syncCloudUI();
        });
    };

    if (window.BadyetlyFirebase && window.BadyetlyFirebase.ready) {
        attach();
    } else {
        window.addEventListener("badyetly:firebase-ready", attach, { once: true });
        syncCloudUI();
    }
}
/* ==========================================
USER GUIDE FILTER & SMART HELP CENTER
========================================== */

let activeHelpCategory = "all";

function filterGuideCards(group, buttonEl) {
    if (buttonEl) {
        document.querySelectorAll("#guideFilterBar .help-cat-pill").forEach(btn => {
            btn.classList.remove("active");
        });
        buttonEl.classList.add("active");
    }

    document.querySelectorAll("#view-guide .guide-card").forEach(card => {
        const cardGroup = card.getAttribute("data-guide-group") || "all";
        card.style.display = (group === "all" || cardGroup === group) ? "" : "none";
    });
}

function setHelpCategory(category, buttonEl) {
    activeHelpCategory = category || "all";
    if (buttonEl) {
        document.querySelectorAll("#helpCategoryTabs .help-cat-pill").forEach(btn => {
            btn.classList.remove("active");
        });
        buttonEl.classList.add("active");
    }
    filterHelpCenter();
}

function filterHelpCenter() {
    const searchEl = document.getElementById("helpSearchInput");
    const query = searchEl ? searchEl.value.trim().toLowerCase() : "";
    const items = document.querySelectorAll("#helpFaqList .faq-item");
    const noResultsEl = document.getElementById("helpNoResults");

    let visibleCount = 0;

    items.forEach(item => {
        const cat = item.getAttribute("data-cat") || "";
        const keywords = (item.getAttribute("data-keywords") || "").toLowerCase();
        const text = (item.textContent || "").toLowerCase();

        const matchesCategory = activeHelpCategory === "all" || cat === activeHelpCategory;
        const matchesQuery = !query || text.includes(query) || keywords.includes(query);

        const show = matchesCategory && matchesQuery;
        item.style.display = show ? "" : "none";

        if (show) {
            visibleCount++;
            if (query) item.open = true;
        }
    });

    if (noResultsEl) {
        noResultsEl.style.display = visibleCount === 0 ? "block" : "none";
    }
}

function resetHelpSearch() {
    const searchEl = document.getElementById("helpSearchInput");
    if (searchEl) searchEl.value = "";
    const firstTab = document.querySelector("#helpCategoryTabs .help-cat-pill");
    setHelpCategory("all", firstTab);
    toggleAllFaqs(false);
}

function toggleAllFaqs(expand) {
    document.querySelectorAll("#helpFaqList .faq-item").forEach(item => {
        if (item.style.display !== "none") {
            item.open = Boolean(expand);
        }
    });
}

function askHelpQuestion() {
    const inputEl = document.getElementById("helpAskInput");
    const resultsEl = document.getElementById("helpAskResults");
    if (!inputEl || !resultsEl) return;

    const raw = inputEl.value.trim();
    if (!raw) {
        showToast("Please type your question first.", "warning");
        inputEl.focus();
        return;
    }

    const queryLower = raw.toLowerCase();
    const synonymMap = {
        nawala: ["missing", "backup", "restore", "clear"],
        bura: ["delete", "clear"],
        palit: ["edit", "rename", "theme", "password"],
        kuryente: ["recurring", "bills"],
        tubig: ["recurring", "bills"],
        utang: ["bills", "negative", "deficit"],
        kulang: ["negative", "starting", "balance"],
        bawas: ["deduct", "spendable"],
        lipat: ["transfer", "device", "backup", "restore"],
        ayaw: ["cannot", "file://", "blocked", "not added"],
        nakalimutan: ["forgot", "pin", "password"],
        ipon: ["savings", "goal", "pace"],
        gastos: ["expense", "category", "smart"]
    };

    const rawTokens = queryLower
        .replace(/[^a-z0-9#\s]/g, " ")
        .split(/\s+/)
        .filter(t => t.length >= 2);

    const expandedTokens = new Set(rawTokens);
    rawTokens.forEach(token => {
        if (synonymMap[token]) {
            synonymMap[token].forEach(s => expandedTokens.add(s));
        }
    });

    const scored = [];
    document.querySelectorAll("#helpFaqList .faq-item").forEach(item => {
        const title = (item.querySelector("summary")?.textContent || "").trim();
        const body = (item.querySelector("p")?.textContent || "").trim();
        const keywords = (item.getAttribute("data-keywords") || "").toLowerCase();
        const haystack = (title + " " + body + " " + keywords).toLowerCase();

        let score = 0;
        expandedTokens.forEach(token => {
            if (keywords.includes(token)) score += 3;
            if (title.toLowerCase().includes(token)) score += 2;
            if (haystack.includes(token)) score += 1;
        });

        if (score > 0) {
            scored.push({ title, body, score });
        }
    });

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 3);

    resultsEl.style.display = "block";

    if (!topMatches.length) {
        resultsEl.innerHTML = `
            <div class="help-answer-card">
                <strong>No exact match found for "${escapeHTML(raw)}"</strong>
                <p>Click <strong>Copy Question &amp; Info</strong> above to copy your question with your current app mode details (no financial amounts are included) and send it to your Badyetly maintainer (April Amador).</p>
            </div>
        `;
        return;
    }

    resultsEl.innerHTML = `
        <div class="help-answer-heading">Closest answers for "${escapeHTML(raw)}":</div>
        ${topMatches.map(match => `
            <div class="help-answer-card">
                <strong>${escapeHTML(match.title)}</strong>
                <p>${escapeHTML(match.body)}</p>
            </div>
        `).join("")}
    `;
}

async function copyHelpDiagnosticQuestion() {
    const inputEl = document.getElementById("helpAskInput");
    const searchEl = document.getElementById("helpSearchInput");
    const questionText =
        (inputEl && inputEl.value.trim()) ||
        (searchEl && searchEl.value.trim()) ||
        "(Describe your issue here)";

    const isFile = typeof window !== "undefined" && window.location.protocol === "file:";
    const summary = [
        "Badyetly Support Question",
        "-------------------------",
        "Question: " + questionText,
        "App Version: v3.0",
        "Mode: " + (isFile ? "Local File (file://)" : (typeof isPWAStandalone !== "undefined" && isPWAStandalone ? "Installed PWA" : "Browser")),
        "Cloud Sync: " + (typeof cloudSyncUser !== "undefined" && cloudSyncUser ? "Connected" : "Local Only"),
        "Online: " + (typeof navigator !== "undefined" && navigator.onLine ? "Yes" : "No")
    ].join("\n");

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(summary);
            showToast("Question & diagnostic info copied! Ready to paste.", "success");
            return;
        }
    } catch (e) {}

    await showPromptModal({
        eyebrow: "COPY SUPPORT MESSAGE",
        title: "Copy Your Question & App Info",
        message: "Select and copy this summary to send to the maintainer (no financial amounts are included):",
        label: "Support Summary",
        defaultValue: summary,
        confirmText: "Done"
    });
}
/* ==========================================
   STRONGER PASSWORD RESET & REQUIRED PIN
   ========================================== */
const resetPinAttempts = {};

(function syncRequiredPinUI() {
    const apply = () => {
        const lbl = document.querySelector('label[for="registerPin"]');
        const inp = document.getElementById("registerPin");
        if (lbl) lbl.textContent = "4-Digit Recovery PIN (Required)";
        if (inp) {
            inp.required = true;
            inp.placeholder = "4 digits (protects password resets)";
        }
        const loginNameEl = document.getElementById("loginName");
        if (loginNameEl && !loginNameEl.dataset.passSyncBound) {
            loginNameEl.dataset.passSyncBound = "1";
            loginNameEl.addEventListener("input", () => syncLoginPassRequirement(loginNameEl.value.trim()));
        }
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply);
    } else {
        apply();
    }
})();

function register() {
    const name = document.getElementById("registerName").value.trim();
    const pass = document.getElementById("registerPass").value;
    const confirmPass = document.getElementById("confirmPass").value;
    const pinEl = document.getElementById("registerPin");
    const recoveryPin = pinEl ? pinEl.value.trim() : "";
    const regDebug = document.getElementById("registerDebug");
    const setErr = msg => {
        if (regDebug) regDebug.innerText = msg;
        showToast(msg, "warning");
    };

    if (regDebug) regDebug.innerText = "";
    if (!name || !pass || !confirmPass || !recoveryPin) return setErr("Please complete all fields including your 4-digit Recovery PIN.");
    if (pass.length < 4) return setErr("Password must be at least 4 characters.");
    if (pass !== confirmPass) {
        if (regDebug) regDebug.innerText = "Passwords do not match.";
        return showToast("Passwords do not match.", "error");
    }
    if (!/^\d{4}$/.test(recoveryPin)) return setErr("Recovery PIN must be exactly 4 digits.");
    if (getAccount(name)) return setErr("This account name already exists. Please log in.");

    const newAccount = setAccountPasswordFields({ name }, pass);
    setAccountRecoveryPinFields(newAccount, recoveryPin);
    accounts.push(newAccount);
    if (!saveAccounts()) { accounts.pop(); return; }

    localStorage.setItem(getUserDataKey(name), JSON.stringify(emptyData()));
    showToast("Account created with Recovery PIN protection!", "success");

    document.getElementById("loginName").value = name;
    syncLoginPassRequirement(name);
    document.getElementById("loginPass").value = "";
    document.getElementById("registerPass").value = "";
    document.getElementById("confirmPass").value = "";
    if (pinEl) pinEl.value = "";
    updateRegisterValidationUI();
    showLogin();
    renderSaved();
}

async function forgotPassword() {
    let name = document.getElementById("loginName").value.trim();
    if (!name) {
        name = await showPromptModal({
            eyebrow: "RESET PASSWORD",
            title: "Find Your Account",
            message: "Enter the account name you want to reset.",
            label: "Account Name",
            placeholder: "e.g. April Amador",
            confirmText: "Next"
        });
        if (!name || !name.trim()) return;
        name = name.trim();
    }

    const account = getAccount(name);
    if (!account) return showToast("Account not found.", "error");

    if (!hasAccountRecoveryPin(account)) {
        await showConfirmModal({
            eyebrow: "RECOVERY PIN REQUIRED",
            title: "Instant Reset Disabled",
            message: '"' + account.name + '" has no 4-digit Recovery PIN yet, so password reset is locked for security.\n\nLog in and set a Recovery PIN in Settings, or restore from a .json backup.',
            confirmText: "Got it",
            cancelText: "Close"
        });
        return;
    }

    const key = account.name.toLowerCase();
    const state = resetPinAttempts[key] || { fails: 0, lockedUntil: 0 };
    if (state.lockedUntil > Date.now()) {
        const secs = Math.ceil((state.lockedUntil - Date.now()) / 1000);
        return showToast("Too many wrong PIN attempts. Try again in " + secs + "s.", "error");
    }

    const enteredPin = await showPromptModal({
        eyebrow: "SECURITY CHECK",
        title: "Verify Recovery PIN",
        message: 'Enter the 4-digit Recovery PIN for "' + account.name + '".',
        label: "4-Digit Recovery PIN",
        placeholder: "••••",
        inputType: "password",
        confirmText: "Verify PIN"
    });
    if (enteredPin === null) return;

    if (!verifyAccountRecoveryPin(account, enteredPin)) {
        state.fails += 1;
        if (state.fails >= 3) {
            state.lockedUntil = Date.now() + 30000;
            state.fails = 0;
            resetPinAttempts[key] = state;
            return showToast("3 wrong attempts. Password reset locked for 30 seconds.", "error");
        }
        resetPinAttempts[key] = state;
        return showToast("Incorrect PIN. " + (3 - state.fails) + " attempt(s) left.", "error");
    }

    resetPinAttempts[key] = { fails: 0, lockedUntil: 0 };

    const newPassword = await showPromptModal({
        eyebrow: "RESET PASSWORD",
        title: "Create New Password",
        message: 'Enter a new password for "' + account.name + '" (at least 4 characters).',
        label: "New Password",
        placeholder: "At least 4 characters",
        inputType: "password",
        confirmText: "Next"
    });
    if (!newPassword) return;
    if (newPassword.length < 4) return showToast("Password must be at least 4 characters.", "warning");

    const confirmPassword = await showPromptModal({
        eyebrow: "CONFIRM PASSWORD",
        title: "Re-enter New Password",
        message: "Type your new password again to confirm.",
        label: "Confirm New Password",
        placeholder: "Re-enter new password",
        inputType: "password",
        confirmText: "Reset Password"
    });
    if (confirmPassword === null) return;
    if (confirmPassword !== newPassword) return showToast("Passwords do not match. Reset cancelled.", "error");

    upgradeLegacyAccountFields(account);
    setAccountPasswordFields(account, newPassword);
    if (!saveAccounts()) return;
    syncLoginPassRequirement(account.name);
    showToast("Password reset successfully!", "success");
}
/* ==========================================
   HELP CENTER REDESIGN (COMPACT, ENGLISH + TL SUBTITLE)
   ========================================== */
(function initHelpCenterRedesign() {
    const TOPICS = [
        { id: "all", label: "All Topics", sub: "Lahat ng paksa" },
        { id: "account", label: "Account & Login", sub: "Pag-sign in at PIN" },
        { id: "transactions", label: "Transactions", sub: "Kita at gastos" },
        { id: "budgets", label: "Budgets & Goals", sub: "Limit at ipon" },
        { id: "backup", label: "Backup & Security", sub: "JSON backup at lock" },
        { id: "theme", label: "Theme & Display", sub: "Dark mode at app view" }
    ];

    const FAQS = [
        ["account", "How do I create a Badyetly account?", "Open Create Account on the login screen, enter your Account Name, Password (at least 4 characters), and a required 4-digit Recovery PIN.", "Buksan ang Create Account, ilagay ang pangalan, password, at 4-digit Recovery PIN."],
        ["account", "What should I do if I forgot my password?", "Click Forgot password? on the login page, verify your 4-digit Recovery PIN, then enter and confirm your new password.", "Pindutin ang Forgot password?, ilagay ang 4-digit Recovery PIN, at mag-set ng bagong password."],
        ["account", "Why did my saved account disappear after clearing browser data?", "Badyetly stores data locally in your browser. Clearing site data or switching browsers removes local storage—use Restore Backup (.json) to bring it back.", "Naka-save sa browser ang records. Gamitin ang Restore Backup (.json) kung na-clear o lumipat ng browser."],
        ["account", "What is the Demo Account used for?", "Try Demo Account lets you explore sample incomes, expenses, budgets, and goals without affecting your personal account.", "Pang-testing ang Demo Account ng sample records nang hindi nagagalaw ang sarili mong account."],
        ["transactions", "How do I add or edit a transaction?", "Use Quick Expense or Smart Entry in Home or Transactions to add entries, and click Edit or Delete on any recorded item anytime.", "Gamitin ang Quick Expense o Smart Entry para magdagdag, at pindutin ang Edit o Delete kung babaguhin."],
        ["transactions", "How does automatic expense categorization work?", "Badyetly matches keywords in your item name (like rice, coffee, grab, or load) to built-in categories like Food & Drinks or Transportation.", "Kusang ikinakategorya ang gastos base sa keyword ng item (hal. kape → Food & Drinks)."],
        ["transactions", "Why was my expense line skipped or not added?", "Each line must follow Item - Amount (for example, Lunch - 85) with a number above zero. Lines without a valid amount are skipped.", "Siguraduhing may numero bawat linya (hal. Lunch - 85) at higit sa zero."],
        ["transactions", "How do 1-Tap Quick Chips and Recurring Bills work?", "Tap any preset Quick Chip to log common spending in one click, or mark recurring monthly bills as Paid in Transactions.", "Isang pindot lang ang Quick Chips sa madalas na gastos, at madaling i-mark na Paid ang monthly bills."],
        ["budgets", "How do I set monthly category budgets?", "Open Budget Planner, choose a category, and enter your monthly limit. Progress bars turn amber or red as you near or pass your limit.", "Sa Budget Planner, maglagay ng monthly limit bawat kategorya para makita agad kung malapit ka nang lumagpas."],
        ["budgets", "How can I create and track a Savings Goal?", "Go to Savings Goals, add your goal name, target amount, and optional deadline. Badyetly calculates your daily, weekly, and monthly saving pace.", "Sa Savings Goals, ilagay ang target at deadline para makita kung magkano ang dapat ipunin bawat araw o linggo."],
        ["budgets", "Why does my Home balance look lower than expected?", "Check if Home is set to This Month instead of All Time, or if a Savings Goal has 'Deduct from Spendable Balance' enabled.", "I-check kung naka-This Month ang filter o may Savings Goal na nakabawas sa Spendable Balance."],
        ["backup", "How do I back up my records safely?", "Open Settings → Data & Backup and click Download Backup (.json) regularly, or export a CSV/PDF copy of your transactions.", "Sa Settings, laging mag-Download Backup (.json) para may kopya ka ng lahat ng records."],
        ["backup", "How do I restore my account on another device?", "On the login screen, click Restore Backup and select your saved .json file to recover your accounts, budgets, and goals.", "Sa login screen, pindutin ang Restore Backup at piliin ang na-save mong .json file."],
        ["backup", "How do I protect password resets with a Recovery PIN?", "Log in, go to Settings → Security, and save a 4-digit Recovery PIN. Only accounts with a PIN can reset passwords after 3-attempt protection.", "Mag-set ng 4-digit Recovery PIN sa Settings para hindi basta mapalitan ng iba ang password mo."],
        ["theme", "How do I switch between Light Mode and Dark Mode?", "Click the Dark / Light button in the top bar (or on the login card). Your theme preference is saved automatically.", "Pindutin ang Dark / Light button sa itaas; automatic na itong mase-save."],
        ["theme", "Can I install Badyetly as an app and use it offline?", "Yes. Click Install App in the top bar (when supported by Edge/Chrome) to launch Badyetly offline in its own window.", "Oo. Pindutin ang Install App sa itaas para magamit ito offline bilang hiwalay na app."]
    ];

    const TROUBLESHOOTERS = [
        ["Account Recovery", "Only Demo User appears on Login", "Browser cache was cleared or you opened a different browser/URL. Click Restore Backup on the login screen and load your .json file.", "Na-clear ang browser data o ibang browser ang gamit. Pindutin ang Restore Backup at piliin ang .json file mo."],
        ["Smart Entry", "Expense line was skipped or not recorded", "Format each line as Item - Amount (e.g., Coffee - 120) with one item per line and a positive number.", "Isulat nang Item - Amount (hal. Kape - 120) bawat linya at siguraduhing may tamang halaga."],
        ["Balance Check", "Spendable balance looks smaller than total cash", "Switch the Home filter between This Month and All Time, or check Savings Goals with balance deduction turned on.", "I-check ang This Month vs All Time filter sa Home, o ang Savings Goal na nakabawas sa balance."],
        ["App Install", "Install App button is hidden", "Your app may already be installed, or open Badyetly in Edge/Chrome via http://localhost or https:// to enable PWA install.", "Baka naka-install na ang app, o buksan ito sa Edge/Chrome para lumabas ang Install option."]
    ];

    const run = () => {
        const hv = document.getElementById("view-help");
        if (!hv || hv.dataset.hcDone === "1") return;
        hv.dataset.hcDone = "1";

        const st = document.createElement("style");
        st.textContent = `
            #view-help .hc-hero { background: linear-gradient(135deg, #172B4D 0%, #1F3962 100%); color: #fff; border-radius: 18px; padding: 22px 24px; margin-bottom: 18px; border: 1px solid rgba(214,185,121,.28); }
            #view-help .hc-hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
            #view-help .hc-eyebrow { display: block; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #D6B979; margin-bottom: 4px; }
            #view-help .hc-hero h2 { color: #fff; margin: 0 0 4px; font-size: 22px; }
            #view-help .hc-hero-sub { color: rgba(241,245,251,.85); font-size: 13px; margin: 0; }
            #view-help .hc-hero-tl { color: rgba(214,185,121,.9); font-size: 11px; margin: 3px 0 0; }
            #view-help .hc-lang-select { background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(214,185,121,.45); border-radius: 9px; padding: 6px 10px; font-size: 11px; font-weight: 700; }
            #view-help .hc-lang-select option { color: #172B4D; background: #fff; }
            #view-help .hc-search-row { display: flex; gap: 8px; margin-top: 12px; }
            #view-help .hc-search-row input { flex: 1; background: #fff; color: #172B4D; border: 1px solid transparent; border-radius: 10px; padding: 10px 14px; font-size: 13px; }
            #view-help .hc-topics-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-bottom: 18px; }
            #view-help .hc-topic-card { text-align: left; background: var(--card); border: 1px solid var(--border); border-radius: 13px; padding: 12px 14px !important; cursor: pointer; transition: .18s ease; display: flex; flex-direction: column; gap: 3px; }
            #view-help .hc-topic-card:hover { border-color: var(--gold); transform: translateY(-1px); }
            #view-help .hc-topic-card.active { background: #172B4D !important; border-color: #172B4D !important; color: #fff !important; }
            #view-help .hc-topic-card strong { font-size: 13px; color: var(--heading); }
            #view-help .hc-topic-card small { font-size: 11px; color: var(--muted); }
            #view-help .hc-topic-card.active strong, #view-help .hc-topic-card.active small { color: #fff !important; }
            #view-help .hc-topic-count { font-size: 10px; font-weight: 800; color: var(--eyebrow); margin-top: 2px; }
            #view-help .hc-topic-card.active .hc-topic-count { color: #D6B979; }
            #view-help .hc-faq-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
            #view-help .hc-faq-meta { display: flex; align-items: center; gap: 8px; }
            #view-help .hc-count-pill { font-size: 11px; font-weight: 700; color: var(--muted); background: var(--surface-subtle, #f6f4ee); border: 1px solid var(--border); padding: 4px 10px; border-radius: 999px; }
            #view-help .hc-faq-list, #view-help .hc-ts-list { display: grid; gap: 10px; }
            #view-help .hc-item { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 13px 15px; }
            #view-help .hc-item[open] { border-color: rgba(214,185,121,.75); }
            #view-help .hc-item summary { cursor: pointer; font-weight: 700; font-size: 13px; color: var(--heading); line-height: 1.5; }
            #view-help .hc-en { margin: 9px 0 0; font-size: 12.5px; color: var(--text); line-height: 1.65; }
            #view-help .hc-tl { margin: 6px 0 0; font-size: 11.5px; color: var(--muted); line-height: 1.55; }
            #view-help .hc-tl-tag { display: inline-block; font-size: 9px; font-weight: 800; background: var(--gold-soft); color: var(--eyebrow); padding: 1px 6px; border-radius: 5px; margin-right: 5px; }
            #view-help .hc-bottom-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 16px; margin-top: 18px; }
            #view-help .hc-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
            #view-help .hc-chip { background: var(--surface-subtle, #f6f4ee); border: 1px solid var(--border); color: var(--heading); border-radius: 999px; padding: 5px 10px !important; font-size: 11px !important; font-weight: 600 !important; cursor: pointer; }
            #view-help .hc-chip:hover { border-color: var(--gold); }
            #view-help .hc-answer-box { margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: var(--gold-soft); border: 1px solid rgba(214,185,121,.55); font-size: 12px; }
            @media (max-width: 860px) { #view-help .hc-topics-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } #view-help .hc-bottom-grid { grid-template-columns: 1fr; } }
            @media (max-width: 520px) { #view-help .hc-topics-grid { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(st);

        hv.innerHTML = `
            <div class="hc-hero">
                <div class="hc-hero-top">
                    <div>
                        <span class="hc-eyebrow">BADYETLY SUPPORT</span>
                        <h2>How can we help you?</h2>
                        <p class="hc-hero-sub">Find answers and get help with your personal finances.</p>
                        <p class="hc-hero-tl" data-hc-tl>Hanapin ang sagot at gabay para sa iyong Badyetly account.</p>
                    </div>
                    <select id="hcLangSelect" class="hc-lang-select" aria-label="Language filter">
                        <option value="both">EN + TL Subtitle</option>
                        <option value="en">English Only</option>
                        <option value="tl">Tagalog Only</option>
                    </select>
                </div>
                <div class="hc-search-row">
                    <input type="search" id="hcSearchInput" placeholder="Search for help, articles, or questions (e.g. password, backup, expense)...">
                    <button type="button" id="hcClearBtn" class="btn-outline" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.25);">Clear</button>
                </div>
            </div>

            <div class="panel" style="margin-bottom:16px;">
                <div class="panel-heading" style="margin-bottom:12px;">
                    <div><span class="eyebrow">BROWSE HELP TOPICS</span><h3>Select a Category</h3></div>
                </div>
                <div id="hcTopicsGrid" class="hc-topics-grid"></div>
                <div class="hc-faq-head">
                    <h3 style="margin:0;font-size:16px;color:var(--heading);">Frequently Asked Questions</h3>
                    <div class="hc-faq-meta">
                        <span id="hcFaqCount" class="hc-count-pill">Showing ${FAQS.length} of ${FAQS.length} articles</span>
                        <button type="button" id="hcExpandBtn" class="btn-outline">Expand All</button>
                    </div>
                </div>
                <div id="hcFaqList" class="hc-faq-list"></div>
            </div>

            <div class="hc-bottom-grid">
                <article class="panel">
                    <div class="panel-heading"><div><span class="eyebrow">QUICK TROUBLESHOOTERS</span><h3>Common Fixes</h3></div></div>
                    <div class="hc-ts-list">
                        ${TROUBLESHOOTERS.map(([tag, title, en, tl]) => `
                            <details class="hc-item">
                                <summary><span class="hc-tl-tag">${tag}</span>${title}</summary>
                                <p class="hc-en" data-hc-en>${en}</p>
                                <p class="hc-tl" data-hc-tl><span class="hc-tl-tag">TL</span>${tl}</p>
                            </details>
                        `).join("")}
                    </div>
                </article>

                <article class="panel">
                    <div class="panel-heading"><div><span class="eyebrow">STILL NEED HELP?</span><h3>Ask a Question</h3></div></div>
                    <p class="helper-text" style="margin-bottom:6px;">Send a question below or pick a quick topic to see the answer right away.</p>
                    <p class="hc-tl" data-hc-tl style="margin-bottom:10px;"><span class="hc-tl-tag">TL</span>Mag-type ng tanong o pumili sa mabilisang paksa sa baba.</p>
                    <div class="hc-chips">
                        <button type="button" class="hc-chip">Forgot password</button>
                        <button type="button" class="hc-chip">Missing account</button>
                        <button type="button" class="hc-chip">Expense skipped</button>
                        <button type="button" class="hc-chip">How to backup</button>
                    </div>
                    <textarea id="hcAskInput" rows="3" placeholder="Describe your question (e.g. how to restore backup or set PIN)..."></textarea>
                    <div style="display:flex;gap:8px;margin-top:10px;">
                        <button type="button" id="hcAskSubmit" class="btn-primary">Submit Question</button>
                        <button type="button" id="hcAskClear" class="btn-outline">Clear</button>
                    </div>
                    <div id="hcAnswerBox" class="hc-answer-box" style="display:none;"></div>
                </article>
            </div>
        `;

        const topicsEl = document.getElementById("hcTopicsGrid");
        const listEl = document.getElementById("hcFaqList");
        const countEl = document.getElementById("hcFaqCount");
        const searchEl = document.getElementById("hcSearchInput");
        const langEl = document.getElementById("hcLangSelect");
        const expandBtn = document.getElementById("hcExpandBtn");
        let activeTopic = "all";

        topicsEl.innerHTML = TOPICS.map(t => {
            const cnt = t.id === "all" ? FAQS.length : FAQS.filter(f => f[0] === t.id).length;
            return `<button type="button" class="hc-topic-card${t.id === "all" ? " active" : ""}" data-topic="${t.id}">
                <strong>${t.label}</strong>
                <small data-hc-tl>${t.sub}</small>
                <span class="hc-topic-count">${cnt} articles</span>
            </button>`;
        }).join("");

        listEl.innerHTML = FAQS.map(([cat, q, en, tl], i) => `
            <details class="hc-item" data-cat="${cat}">
                <summary>${i + 1}. ${q}</summary>
                <p class="hc-en" data-hc-en>${en}</p>
                <p class="hc-tl" data-hc-tl><span class="hc-tl-tag">TL</span>${tl}</p>
            </details>
        `).join("");

        const applyLang = () => {
            const mode = langEl.value;
            hv.querySelectorAll("[data-hc-en]").forEach(el => { el.style.display = mode === "tl" ? "none" : ""; });
            hv.querySelectorAll("[data-hc-tl]").forEach(el => { el.style.display = mode === "en" ? "none" : ""; });
        };

        const renderFilter = () => {
            const q = searchEl.value.trim().toLowerCase();
            const items = Array.from(listEl.querySelectorAll("details"));
            let shown = 0;
            items.forEach(d => {
                const ok = (activeTopic === "all" || d.dataset.cat === activeTopic) && (!q || d.textContent.toLowerCase().includes(q));
                d.style.display = ok ? "" : "none";
                if (ok) shown++;
                if (q && ok && shown <= 3) d.open = true;
            });
            countEl.textContent = `Showing ${shown} of ${FAQS.length} articles`;
            if (!shown) {
                if (!document.getElementById("hcEmpty")) {
                    const emp = document.createElement("div");
                    emp.id = "hcEmpty";
                    emp.className = "helper-text";
                    emp.style.padding = "14px";
                    emp.textContent = "No matching articles found. Try another keyword or click Clear.";
                    listEl.appendChild(emp);
                }
            } else {
                const emp = document.getElementById("hcEmpty");
                if (emp) emp.remove();
            }
        };

        topicsEl.querySelectorAll(".hc-topic-card").forEach(btn => {
            btn.onclick = () => {
                activeTopic = btn.dataset.topic;
                topicsEl.querySelectorAll(".hc-topic-card").forEach(b => b.classList.toggle("active", b === btn));
                renderFilter();
            };
        });

        searchEl.addEventListener("input", renderFilter);
        langEl.addEventListener("change", applyLang);
        document.getElementById("hcClearBtn").onclick = () => {
            searchEl.value = "";
            activeTopic = "all";
            topicsEl.querySelectorAll(".hc-topic-card").forEach((b, i) => b.classList.toggle("active", i === 0));
            listEl.querySelectorAll("details").forEach(d => { d.open = false; });
            expandBtn.textContent = "Expand All";
            renderFilter();
        };
        expandBtn.onclick = () => {
            const openAll = expandBtn.textContent === "Expand All";
            listEl.querySelectorAll("details").forEach(d => { if (d.style.display !== "none") d.open = openAll; });
            expandBtn.textContent = openAll ? "Collapse All" : "Expand All";
        };

        const askInput = document.getElementById("hcAskInput");
        const ansBox = document.getElementById("hcAnswerBox");
        const answerQuestion = () => {
            const raw = askInput.value.trim().toLowerCase();
            if (!raw) {
                if (typeof showToast === "function") showToast("Please type a question first.", "warning");
                askInput.focus();
                return;
            }
            const words = raw.split(/\s+/).filter(w => w.length > 2);
            const hits = FAQS.map(f => ({
                f,
                score: words.reduce((s, w) => s + ((f[1] + " " + f[2] + " " + f[3]).toLowerCase().includes(w) ? 1 : 0), 0)
            })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2);

            ansBox.style.display = "block";
            ansBox.innerHTML = hits.length
                ? hits.map(({ f }) => `<div style="margin-bottom:8px;"><strong>${f[1]}</strong><p class="hc-en" data-hc-en style="margin-top:4px;">${f[2]}</p><p class="hc-tl" data-hc-tl><span class="hc-tl-tag">TL</span>${f[3]}</p></div>`).join("")
                : `<strong>No exact match found.</strong><p class="hc-en" style="margin-top:4px;">Try keywords like password, backup, expense, budget, or PIN.</p>`;
            applyLang();
        };

        hv.querySelectorAll(".hc-chip").forEach(c => {
            c.onclick = () => { askInput.value = c.textContent; answerQuestion(); };
        });
        document.getElementById("hcAskSubmit").onclick = answerQuestion;
        document.getElementById("hcAskClear").onclick = () => { askInput.value = ""; ansBox.style.display = "none"; askInput.focus(); };
        applyLang();
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
})();
/* ==========================================
   USER GUIDE: MINIMALIST DOCS + INTERACTIVE TUTORIALS
   ========================================== */
(function initUserGuideV2() {
    const READ_KEY = "badyetly_ug_read_v2";
    const BM_KEY = "badyetly_ug_bm_v2";
    const CHAPTERS = [
        { id: "all", label: "All Chapters", sub: "Lahat ng gabay" },
        { id: "start", label: "Getting Started", sub: "Simula at dashboard" },
        { id: "track", label: "Daily Money Tracking", sub: "Kita, gastos at bills" },
        { id: "plan", label: "Financial Planning & Reports", sub: "Budget, ipon at ulat" },
        { id: "safe", label: "Backup, Security & Display", sub: "Backup, PIN at tema" }
    ];

    // [id, chapter, title, desc, tlSub, tipPath, steps:[ [en, tl], ... ], related:[id, ...]]
    const GUIDES = [
        [1, "start", "Account Setup & Recovery PIN", "Create your personal account and lock password resets with a 4-digit PIN.", "Gumawa ng account at lagyan ng 4-digit PIN para protektado.", "Login Screen → Create Account → 4-Digit Recovery PIN", [
            ["Open Create Account on the login screen and enter your Account Name.", "Buksan ang Create Account sa login screen at ilagay ang Account Name."],
            ["Choose a password (at least 4 characters) and confirm it.", "Gumawa ng password (kahit 4 characters pataas) at i-confirm."],
            ["Enter a 4-digit Recovery PIN so only you can reset your password later.", "Maglagay ng 4-digit Recovery PIN para ikaw lang ang makakapag-reset."],
            ["Use Try Demo Account anytime if you want to test with sample data first.", "Gamitin ang Try Demo Account kung gusto mong mag-practice muna."]
        ], [2, 9]],
        [2, "start", "Understanding Your Dashboard", "Read your Spendable Balance, Cashflow summary, and period filters at a glance.", "Intindihin ang Spendable Balance at mga filter sa Home.", "Menu → Home → All Time / This Month", [
            ["View your Total Income, Total Expenses, and Spendable Balance cards at the top.", "Makikita sa taas ang Total Income, Total Expenses, at Spendable Balance."],
            ["Switch between This Month and All Time to inspect recent or overall totals.", "Magpalit sa This Month o All Time para makita ang buwanan o kabuuang total."],
            ["Tap Hide Balance anytime if you want privacy while using Badyetly in public.", "Pindutin ang Hide Balance kung gusto mong itago ang mga halaga sa screen."]
        ], [3, 6]],
        [3, "track", "Quick Expense Chips & Smart Entry", "Log multiple purchases in seconds using 1-tap chips or Item - Amount lines.", "Mag-record ng gastos nang mabilisan gamit ang Chips o Smart Entry.", "Home → Smart Entry (Format: Coffee - 120)", [
            ["Tap any 1-Tap Quick Chip (like Coffee or Fare) to record common expenses instantly.", "Pindutin ang 1-Tap Quick Chips para sa paulit-ulit na araw-araw na gastos."],
            ["For multiple items, use Smart Entry with one item per line: Item - Amount.", "Sa Smart Entry, ilagay bawat linya ang Item - Amount (hal. Lunch - 85)."],
            ["Badyetly auto-categorizes keywords (rice, grab, load) into the right category.", "Kusang ikinakategorya ng app ang gastos base sa pangalan ng item."]
        ], [4, 5]],
        [4, "track", "Managing Income & Transactions", "Record allowances or salary, and edit, filter, or delete entries anytime.", "Magdagdag ng kita at mag-edit o mag-filter ng records.", "Menu → Transactions → Search / Category Filter", [
            ["Add income sources (Allowance, Salary, Freelance) with dates from Home or Transactions.", "Maglagay ng kita o allowance kasama ang petsa sa Home o Transactions."],
            ["Search by keyword or filter by category and date to find past entries fast.", "Gamitin ang search o category filter para mahanap agad ang lumang record."],
            ["Click Edit to fix an amount or Delete to remove an incorrect entry.", "Pindutin ang Edit para baguhin ang halaga o Delete kung nagkamali."]
        ], [3, 8]],
        [5, "track", "Recurring Bills & Subscriptions", "Track monthly bills like WiFi, rent, or postpaid plans and mark them paid.", "Subaybayan ang mga buwanang bayarin tulad ng WiFi o kuryente.", "Transactions → Recurring Bills → Mark Paid", [
            ["Add a recurring bill with its name, monthly amount, category, and due day.", "Ilagay ang pangalan ng bill, halaga, kategorya, at petsa ng due date."],
            ["Check upcoming due status each month inside Transactions.", "Makikita buwan-buwan kung alin ang malapit nang bayaran."],
            ["Click Mark Paid when settled—Badyetly logs the expense automatically.", "Pindutin ang Mark Paid kapag nabayaran na para automatic na ma-record."]
        ], [6, 4]],
        [6, "plan", "Monthly Budget Planner", "Set monthly spending limits per category with automatic color warnings.", "Mag-set ng buwanang limit sa bawat kategorya ng gastos.", "Menu → Budget Planner → Set Monthly Limit", [
            ["Pick a category (e.g., Food & Drinks or Shopping) and enter your monthly limit.", "Pumili ng kategorya at ilagay ang budget limit mo para sa buwan."],
            ["Watch the progress bar: green means safe, amber warns near limit, red means over.", "Green = safe, Amber = malapit na sa limit, Red = lampas na sa budget."],
            ["Adjust limits anytime as your monthly allowance or priorities change.", "Puwedeng baguhin ang budget limit kahit kailan sa Budget Planner."]
        ], [7, 8]],
        [7, "plan", "Savings Goals & Pace Tracker", "Create target savings goals with deadlines and see daily/weekly saving targets.", "Gumawa ng savings goal at alamin ang dapat ipunin araw-araw.", "Menu → Savings Goals → Add Goal", [
            ["Enter your goal name, target amount, and an optional target deadline date.", "Ilagay ang pangalan ng goal, target na halaga, at optional na deadline."],
            ["Optionally turn on 'Deduct from Spendable Balance' to set funds aside cleanly.", "Puwedeng i-on ang Deduct from Spendable Balance para nakahiwalay ang ipon."],
            ["Check the calculated daily, weekly, and monthly pace needed to reach your goal.", "Makikita agad kung magkano ang kailangang ipunin bawat araw o linggo."]
        ], [6, 2]],
        [8, "plan", "Monthly Analytics & CSV/PDF Reports", "Compare months visually and export clean CSV spreadsheets or PDF summaries.", "Ikumpara ang gastos buwan-buwan at mag-export ng CSV o PDF.", "Menu → Analytics / Transactions → Export CSV or PDF", [
            ["Open Analytics to view top spending categories and month-to-month comparisons.", "Buksan ang Analytics para makita ang breakdown ng pinakamalaking gastos."],
            ["Use Export CSV to open your transactions in Excel or Google Sheets.", "Gamitin ang Export CSV kung gusto mong i-open sa Excel."],
            ["Use Print / PDF Report for a clean printable monthly summary.", "Gamitin ang Print / PDF Report para sa malinis na kopya ng buwanang ulat."]
        ], [9, 6]],
        [9, "safe", "JSON Backup, Restore & Security", "Keep a downloadable .json copy of your data so you never lose records.", "Mag-download ng .json backup para hindi mawala ang records.", "Settings → Data & Backup → Download Backup (.json)", [
            ["Go to Settings and click Download Backup (.json) after big updates or weekly.", "Sa Settings, pindutin ang Download Backup (.json) linggo-linggo."],
            ["Store the .json file safely in a folder, USB, or personal drive.", "Itago ang .json file sa ligtas na folder o USB."],
            ["If browser storage clears or you switch PCs, click Restore Backup on Login.", "Kung ma-clear ang browser o lumipat ng PC, gamitin ang Restore Backup sa Login."]
        ], [1, 10]],
        [10, "safe", "Dark Mode & Offline App (PWA)", "Switch between Cream Light and Navy Dark themes or install Badyetly offline.", "Magpalit ng Dark/Light mode at i-install ang app offline.", "Top Bar → Dark / Light · Install App", [
            ["Click Dark / Light in the top bar (or login screen) to switch themes instantly.", "Pindutin ang Dark / Light sa itaas para magpalit ng kulay ng app."],
            ["Click Install App in Edge or Chrome to open Badyetly in its own app window.", "Pindutin ang Install App sa Edge o Chrome para maging standalone app."],
            ["Once loaded, Badyetly works offline anytime using your browser's local storage.", "Gagana ito kahit walang internet gamit ang local storage ng browser mo."]
        ], [9, 1]]
    ];

    const run = () => {
        const gv = document.getElementById("view-guide");
        if (!gv || gv.dataset.ugV2 === "1") return;
        gv.dataset.ugV2 = "1";

        const loadSet = k => { try { return new Set(JSON.parse(localStorage.getItem(k) || "[]")); } catch { return new Set(); } };
        const saveSet = (k, s) => { try { localStorage.setItem(k, JSON.stringify([...s])); } catch {} };
        const readSet = loadSet(READ_KEY);
        const bmSet = loadSet(BM_KEY);

        const st = document.createElement("style");
        st.textContent = `
            #view-guide .ug2-hero { background: linear-gradient(135deg,#172B4D 0%,#1F3962 100%); color:#fff; border-radius:16px; padding:20px 22px; margin-bottom:16px; border:1px solid rgba(214,185,121,.28); }
            #view-guide .ug2-hero-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
            #view-guide .ug2-eyebrow { display:block; font-size:10px; font-weight:800; letter-spacing:1.4px; color:#D6B979; margin-bottom:4px; }
            #view-guide .ug2-hero h2 { color:#fff; margin:0 0 4px; font-size:22px; }
            #view-guide .ug2-hero-sub { color:rgba(241,245,251,.85); font-size:13px; margin:0; }
            #view-guide .ug2-hero-tl { color:rgba(214,185,121,.9); font-size:11px; margin:3px 0 0; }
            #view-guide .ug2-lang { width:auto !important; min-width:138px; flex-shrink:0; background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(214,185,121,.45); border-radius:9px; padding:6px 10px; font-size:11px; font-weight:700; cursor:pointer; }
            #view-guide .ug2-lang option { color:#172B4D; background:#fff; }
            #view-guide .ug2-search { display:flex; gap:8px; margin-top:12px; }
            #view-guide .ug2-search input { flex:1; background:#fff; color:#172B4D; border:1px solid transparent; border-radius:10px; padding:9px 13px; font-size:13px; }
            #view-guide .ug2-shell { display:grid; grid-template-columns:270px minmax(0,1fr); gap:16px; align-items:start; }
            #view-guide .ug2-side { position:sticky; top:16px; display:grid; gap:12px; }
            #view-guide .ug2-prog-card, #view-guide .ug2-chap-card { background:var(--card); border:1px solid var(--border); border-radius:15px; padding:15px; }
            #view-guide .ug2-prog-row { display:flex; justify-content:space-between; align-items:baseline; margin:4px 0 8px; }
            #view-guide .ug2-prog-num { font-size:20px; font-weight:800; color:var(--heading); }
            #view-guide .ug2-track { height:7px; background:var(--track-bg,#e9e6dc); border-radius:999px; overflow:hidden; }
            #view-guide .ug2-fill { height:100%; background:linear-gradient(90deg,var(--gold),var(--green)); transition:width .25s ease; }
            #view-guide .ug2-chap-head { display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:800; font-size:12px; color:var(--heading); }
            #view-guide .ug2-chap-list { display:grid; gap:6px; margin-top:10px; }
            #view-guide .ug2-chap-btn { width:100%; text-align:left; background:var(--surface-subtle,#f8f6f0); border:1px solid var(--border); border-radius:10px; padding:8px 10px !important; display:flex; justify-content:space-between; align-items:center; gap:8px; cursor:pointer; }
            #view-guide .ug2-chap-btn.active { background:#172B4D !important; border-color:#172B4D !important; color:#fff !important; }
            #view-guide .ug2-chap-btn strong { display:block; font-size:12px; color:var(--heading); }
            #view-guide .ug2-chap-btn small { display:block; font-size:10px; color:var(--muted); }
            #view-guide .ug2-chap-btn.active strong, #view-guide .ug2-chap-btn.active small { color:#fff !important; }
            #view-guide .ug2-pill { font-size:10px; font-weight:800; padding:2px 7px; border-radius:999px; background:var(--gold-soft); color:var(--eyebrow); flex-shrink:0; }
            #view-guide .ug2-chap-btn.active .ug2-pill { background:rgba(214,185,121,.22); color:#D6B979; }
            #view-guide .ug2-tools { display:flex; gap:8px; }
            #view-guide .ug2-tools button { flex:1; }
            #view-guide .ug2-grid { display:grid; gap:10px; }
            #view-guide .ug2-card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:15px 17px; cursor:pointer; transition:.18s ease; }
            #view-guide .ug2-card:hover { border-color:var(--gold); transform:translateY(-1px); box-shadow:0 8px 20px rgba(23,43,77,.07); }
            #view-guide .ug2-card-top { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
            #view-guide .ug2-num { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:8px; background:var(--gold-soft); color:var(--eyebrow); font-size:11px; font-weight:800; }
            #view-guide .ug2-card h4 { margin:0 0 4px; font-size:14.5px; color:var(--heading); }
            #view-guide .ug2-card p { margin:0; font-size:12.5px; color:var(--muted); line-height:1.5; }
            #view-guide .ug2-tl { margin:5px 0 0 !important; font-size:11px !important; color:var(--muted); }
            #view-guide .ug2-tl-tag { display:inline-block; font-size:9px; font-weight:800; background:var(--gold-soft); color:var(--eyebrow); padding:1px 6px; border-radius:5px; margin-right:5px; }
            #view-guide .ug2-bm-btn { background:transparent !important; border:1px solid var(--border) !important; border-radius:8px !important; padding:4px 8px !important; font-size:12px !important; color:var(--muted) !important; cursor:pointer; }
            #view-guide .ug2-bm-btn.saved { background:var(--gold-soft) !important; border-color:var(--gold) !important; color:#9a7222 !important; }
            #view-guide .ug2-done { font-size:10px; font-weight:800; color:var(--green,#1f8f5f); background:rgba(31,143,95,.12); padding:2px 8px; border-radius:999px; }
            #view-guide .ug2-reader { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:20px 22px; }
            #view-guide .ug2-reader-top { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border); }
            #view-guide .ug2-tip { margin:12px 0 16px; padding:10px 13px; border-radius:10px; background:var(--gold-soft); border-left:3px solid var(--gold); font-size:12px; font-weight:700; color:var(--heading); }
            #view-guide .ug2-step { display:flex; gap:12px; padding:12px; border:1px solid var(--border); border-radius:12px; margin-bottom:9px; background:var(--surface-subtle,#fbfaf7); }
            #view-guide .ug2-step-n { width:26px; height:26px; border-radius:50%; background:#172B4D; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
            #view-guide .ug2-nav { display:flex; justify-content:space-between; gap:10px; margin-top:16px; padding-top:14px; border-top:1px solid var(--border); }
            @media (max-width:860px) { #view-guide .ug2-shell { grid-template-columns:1fr; } #view-guide .ug2-side { position:static; } }
        `;
        document.head.appendChild(st);

        gv.innerHTML = `
            <div class="ug2-hero" id="ugTop">
                <div class="ug2-hero-top">
                    <div>
                        <span class="ug2-eyebrow">BADYETLY DOCUMENTATION</span>
                        <h2>User Guide</h2>
                        <p class="ug2-hero-sub">Learn how to manage your money with Badyetly.</p>
                        <p class="ug2-hero-tl" data-ug-tl>Malinaw na gabay at tutorial para sa lahat ng features.</p>
                    </div>
                    <select id="ugLang" class="ug2-lang" aria-label="Language">
                        <option value="both">EN + TL Subtitle</option>
                        <option value="en">English Only</option>
                        <option value="tl">Tagalog Only</option>
                    </select>
                </div>
                <div class="ug2-search">
                    <input type="search" id="ugSearch" placeholder="Search guides and tutorials (e.g. PIN, budget, backup, chips)...">
                    <button type="button" id="ugClear" class="btn-outline" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.25);">Clear</button>
                </div>
            </div>

            <div class="ug2-shell">
                <aside class="ug2-side">
                    <div class="ug2-prog-card">
                        <span class="eyebrow">YOUR LEARNING PROGRESS</span>
                        <div class="ug2-prog-row">
                            <span id="ugProgCount" class="ug2-prog-num">0 / 10</span>
                            <span id="ugProgPct" class="ug2-pill">0%</span>
                        </div>
                        <div class="ug2-track"><div id="ugProgFill" class="ug2-fill" style="width:0%;"></div></div>
                        <p class="helper-text" style="margin:8px 0 0;font-size:11px;">Open guides and mark them completed to track progress.</p>
                    </div>

                    <details class="ug2-chap-card" open>
                        <summary class="ug2-chap-head"><span>CHAPTERS</span><span>▾</span></summary>
                        <div id="ugChapters" class="ug2-chap-list"></div>
                    </details>

                    <div class="ug2-tools">
                        <button type="button" id="ugPrintBtn" class="btn-outline">Print Guide</button>
                        <button type="button" id="ugTopBtn" class="btn-outline">↑ Top</button>
                    </div>
                </aside>

                <div id="ugMain"></div>
            </div>
        `;

        let activeChap = "all";
        let activeGuideId = null;
        const searchEl = document.getElementById("ugSearch");
        const langEl = document.getElementById("ugLang");
        const chapsEl = document.getElementById("ugChapters");
        const mainEl = document.getElementById("ugMain");

        const applyLang = () => {
            const m = langEl.value;
            gv.querySelectorAll("[data-ug-en]").forEach(e => { e.style.display = m === "tl" ? "none" : ""; });
            gv.querySelectorAll("[data-ug-tl]").forEach(e => { e.style.display = m === "en" ? "none" : ""; });
        };

        const renderSidebar = () => {
            const done = readSet.size;
            const pct = Math.round((done / GUIDES.length) * 100);
            document.getElementById("ugProgCount").textContent = `${done} / ${GUIDES.length}`;
            document.getElementById("ugProgPct").textContent = `${pct}%`;
            document.getElementById("ugProgFill").style.width = `${pct}%`;

            chapsEl.innerHTML = [
                ...CHAPTERS.map(c => {
                    const cnt = c.id === "all" ? GUIDES.length : GUIDES.filter(g => g[1] === c.id).length;
                    return `<button type="button" class="ug2-chap-btn${activeChap === c.id ? " active" : ""}" data-chap="${c.id}">
                        <div><strong>${c.label}</strong><small data-ug-tl>${c.sub}</small></div>
                        <span class="ug2-pill">${cnt}</span>
                    </button>`;
                }),
                `<button type="button" class="ug2-chap-btn${activeChap === "bm" ? " active" : ""}" data-chap="bm">
                    <div><strong>★ Bookmarked</strong><small data-ug-tl>Naka-save na gabay</small></div>
                    <span class="ug2-pill">${bmSet.size}</span>
                </button>`
            ].join("");

            chapsEl.querySelectorAll(".ug2-chap-btn").forEach(b => {
                b.onclick = () => {
                    activeChap = b.dataset.chap;
                    activeGuideId = null;
                    renderAll();
                };
            });
        };

        const renderMain = () => {
            if (activeGuideId !== null) {
                const idx = GUIDES.findIndex(g => g[0] === activeGuideId);
                const g = GUIDES[idx];
                const [id, ch, title, desc, tlSub, tip, steps, rel] = g;
                const chapObj = CHAPTERS.find(c => c.id === ch);
                const isDone = readSet.has(id);
                const isBm = bmSet.has(id);
                const prevG = GUIDES[idx - 1];
                const nextG = GUIDES[idx + 1];

                mainEl.innerHTML = `
                    <div class="ug2-reader">
                        <div class="ug2-reader-top">
                            <button type="button" id="ugBackList" class="btn-outline">← All Guides</button>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <span class="ug2-pill">${chapObj ? chapObj.label : ""}</span>
                                <button type="button" id="ugReaderBm" class="ug2-bm-btn${isBm ? " saved" : ""}">${isBm ? "★ Saved" : "☆ Bookmark"}</button>
                                <button type="button" id="ugToggleDone" class="${isDone ? "btn-outline" : "btn-primary"}">${isDone ? "✓ Completed" : "Mark Completed"}</button>
                            </div>
                        </div>
                        <h3 style="margin:0 0 4px;font-size:19px;color:var(--heading);">${id}. ${title}</h3>
                        <p class="helper-text" data-ug-en style="margin:0;">${desc}</p>
                        <p class="ug2-tl" data-ug-tl><span class="ug2-tl-tag">TL</span>${tlSub}</p>
                        <div class="ug2-tip">Path / Tip: ${tip}</div>
                        <div>
                            ${steps.map(([en, tl], sIdx) => `
                                <div class="ug2-step">
                                    <span class="ug2-step-n">${sIdx + 1}</span>
                                    <div>
                                        <div style="font-size:13px;color:var(--heading);font-weight:600;" data-ug-en>${en}</div>
                                        <p class="ug2-tl" data-ug-tl><span class="ug2-tl-tag">TL</span>${tl}</p>
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                        <div style="margin-top:14px;">
                            <span class="eyebrow" style="margin-bottom:6px;display:block;">RELATED GUIDES</span>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                                ${rel.map(rid => {
                                    const rg = GUIDES.find(x => x[0] === rid);
                                    return rg ? `<button type="button" class="btn-outline ug2-rel-btn" data-gid="${rid}">${rg[0]}. ${rg[2]}</button>` : "";
                                }).join("")}
                            </div>
                        </div>
                        <div class="ug2-nav">
                            ${prevG ? `<button type="button" class="btn-outline ug2-nav-btn" data-gid="${prevG[0]}">← ${prevG[0]}. ${prevG[2]}</button>` : `<span></span>`}
                            ${nextG ? `<button type="button" class="btn-primary ug2-next-btn" data-gid="${nextG[0]}">Complete & Next →</button>` : `<button type="button" id="ugFinishBtn" class="btn-primary">✓ Finish Guide</button>`}
                        </div>
                    </div>
                `;

                document.getElementById("ugBackList").onclick = () => { activeGuideId = null; renderAll(); };
                document.getElementById("ugReaderBm").onclick = () => {
                    isBm ? bmSet.delete(id) : bmSet.add(id);
                    saveSet(BM_KEY, bmSet);
                    renderAll();
                };
                document.getElementById("ugToggleDone").onclick = () => {
                    isDone ? readSet.delete(id) : readSet.add(id);
                    saveSet(READ_KEY, readSet);
                    renderAll();
                };
                mainEl.querySelectorAll(".ug2-rel-btn, .ug2-nav-btn").forEach(b => {
                    b.onclick = () => { activeGuideId = Number(b.dataset.gid); renderAll(); document.getElementById("ugTop").scrollIntoView({ behavior: "smooth" }); };
                });
                const nxt = mainEl.querySelector(".ug2-next-btn");
                if (nxt) nxt.onclick = () => {
                    readSet.add(id); saveSet(READ_KEY, readSet);
                    activeGuideId = Number(nxt.dataset.gid); renderAll();
                    document.getElementById("ugTop").scrollIntoView({ behavior: "smooth" });
                };
                const fin = document.getElementById("ugFinishBtn");
                if (fin) fin.onclick = () => {
                    readSet.add(id); saveSet(READ_KEY, readSet);
                    activeGuideId = null; renderAll();
                    if (typeof showToast === "function") showToast("All steps completed!", "success");
                };
                applyLang();
                return;
            }

            const q = searchEl.value.trim().toLowerCase();
            const list = GUIDES.filter(([id, ch, title, desc, tl, tip, steps]) => {
                const matchChap = activeChap === "all" ? true : activeChap === "bm" ? bmSet.has(id) : ch === activeChap;
                const hay = (title + " " + desc + " " + tl + " " + tip + " " + steps.flat().join(" ")).toLowerCase();
                return matchChap && (!q || hay.includes(q));
            });

            mainEl.innerHTML = `
                <div class="panel">
                    <div class="panel-heading" style="margin-bottom:12px;">
                        <div><span class="eyebrow">TUTORIALS</span><h3>${activeChap === "bm" ? "Bookmarked Guides" : (CHAPTERS.find(c => c.id === activeChap)?.label || "All Guides")}</h3></div>
                        <span class="ug2-pill">Showing ${list.length} of ${GUIDES.length}</span>
                    </div>
                    <div class="ug2-grid">
                        ${list.length ? list.map(([id, ch, title, desc, tl]) => `
                            <div class="ug2-card" data-gid="${id}">
                                <div class="ug2-card-top">
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <span class="ug2-num">${String(id).padStart(2, "0")}</span>
                                        <span class="ug2-pill">${CHAPTERS.find(c => c.id === ch)?.label || ""}</span>
                                        ${readSet.has(id) ? `<span class="ug2-done">✓ Done</span>` : ""}
                                    </div>
                                    <button type="button" class="ug2-bm-btn${bmSet.has(id) ? " saved" : ""}" data-bm="${id}" title="Bookmark">${bmSet.has(id) ? "★" : "☆"}</button>
                                </div>
                                <h4>${title}</h4>
                                <p data-ug-en>${desc}</p>
                                <p class="ug2-tl" data-ug-tl><span class="ug2-tl-tag">TL</span>${tl}</p>
                            </div>
                        `).join("") : `<p class="helper-text">No matching guides found. Try another keyword or click Clear.</p>`}
                    </div>
                </div>
            `;

            mainEl.querySelectorAll(".ug2-card").forEach(card => {
                card.onclick = e => {
                    if (e.target.closest("[data-bm]")) return;
                    activeGuideId = Number(card.dataset.gid);
                    renderAll();
                };
            });
            mainEl.querySelectorAll("[data-bm]").forEach(btn => {
                btn.onclick = e => {
                    e.stopPropagation();
                    const gid = Number(btn.dataset.bm);
                    bmSet.has(gid) ? bmSet.delete(gid) : bmSet.add(gid);
                    saveSet(BM_KEY, bmSet);
                    renderAll();
                };
            });
            applyLang();
        };

        const renderAll = () => { renderSidebar(); renderMain(); };
        searchEl.addEventListener("input", () => {
            if (searchEl.value.trim()) { activeChap = "all"; activeGuideId = null; }
            renderAll();
        });
        langEl.addEventListener("change", applyLang);
        document.getElementById("ugClear").onclick = () => { searchEl.value = ""; activeChap = "all"; activeGuideId = null; renderAll(); };
        document.getElementById("ugPrintBtn").onclick = () => window.print();
        document.getElementById("ugTopBtn").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
        renderAll();
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
})();
/* ==========================================
   ENABLE SMART BACK BUTTON ON ALL PAGES
   ========================================== */
(function enableUniversalBackNav() {
    if (typeof showView !== "function") return;
    const origShowView = showView;
    showView = function (view, options = {}) {
        const preserve = Boolean(options && options.preserveStack);
        const prevView = currentViewName;
        const prevTab = currentSettingsTab;

        if (!preserve && prevView && prevView !== view) {
            if (view === "home") {
                viewNavStack = [];
            } else {
                viewNavStack.push({
                    view: prevView,
                    settingsTab: prevTab,
                    label: getNavLocationLabel(prevView, prevTab),
                    scrollY: window.scrollY || 0
                });
                if (viewNavStack.length > 10) viewNavStack.shift();
                try {
                    if (window.history && window.history.pushState) {
                        window.history.pushState({ badyetlyBack: true }, "");
                    }
                } catch (e) {}
            }
        }
        return origShowView(view, { ...options, preserveStack: true });
    };
})();