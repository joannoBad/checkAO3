(function () {
  const AUTHORS_KEY = "authors";
  const LATEST_AUTHOR_KEY = "latestAuthorKey";
  const SETTINGS_KEY = "settings";
  const SAVED_AUTHORS_KEY = "savedAuthors";
  const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const DEFAULT_SETTINGS = {
    autoDeleteOldSnapshots: false,
    deletePrimarySnapshots: false
  };

  function normalizeSettings(settings) {
    return {
      autoDeleteOldSnapshots: Boolean(settings?.autoDeleteOldSnapshots),
      deletePrimarySnapshots: Boolean(settings?.deletePrimarySnapshots)
    };
  }

  function normalizeSavedAuthors(entries) {
    return Array.isArray(entries)
      ? entries
          .filter((entry) => entry && entry.url)
          .map((entry) => ({
            name: entry.name || entry.url,
            url: entry.url,
            savedAt: entry.savedAt || new Date().toISOString()
          }))
      : [];
  }

  function cloneHistory(history) {
    return Array.isArray(history) ? [...history] : [];
  }

  function pruneWorkHistory(history, settings, nowIso) {
    const normalizedSettings = normalizeSettings(settings);
    const sourceHistory = cloneHistory(history);

    if (!normalizedSettings.autoDeleteOldSnapshots || sourceHistory.length <= 1) {
      return sourceHistory;
    }

    const nowTime = Date.parse(nowIso || new Date().toISOString());
    const cutoffTime = nowTime - THIRTY_ONE_DAYS_MS;
    const thirtyDayBoundary = nowTime - THIRTY_DAYS_MS;
    const latestIndex = sourceHistory.length - 1;
    let anchorIndex = -1;

    for (let index = latestIndex - 1; index >= 0; index -= 1) {
      if (Date.parse(sourceHistory[index].capturedAt) <= thirtyDayBoundary) {
        anchorIndex = index;
        break;
      }
    }

    const keepIndexes = new Set([latestIndex]);

    if (!normalizedSettings.deletePrimarySnapshots) {
      keepIndexes.add(0);
    }

    if (anchorIndex >= 0) {
      keepIndexes.add(anchorIndex);
    }

    const pruned = sourceHistory.filter((snapshot, index) => {
      if (keepIndexes.has(index)) {
        return true;
      }

      return Date.parse(snapshot.capturedAt) > cutoffTime;
    });

    if (pruned.length === 0) {
      return [sourceHistory[latestIndex]];
    }

    return pruned;
  }

  function cleanupAuthors(authors, settings, nowIso) {
    const normalizedSettings = normalizeSettings(settings);
    let changed = false;
    const cleanedAuthors = {};

    Object.entries(authors || {}).forEach(([authorKey, author]) => {
      const cleanedWorks = {};
      let authorChanged = false;

      Object.entries(author?.works || {}).forEach(([workId, work]) => {
        const originalHistory = cloneHistory(work.history);
        const nextHistory = pruneWorkHistory(originalHistory, normalizedSettings, nowIso);

        if (nextHistory.length !== originalHistory.length) {
          authorChanged = true;
        }

        cleanedWorks[workId] = {
          ...work,
          history: nextHistory,
          current: nextHistory[nextHistory.length - 1] || work.current || null
        };
      });

      if (authorChanged) {
        changed = true;
      }

      cleanedAuthors[authorKey] = {
        ...author,
        works: cleanedWorks
      };
    });

    return {
      authors: cleanedAuthors,
      changed
    };
  }

  function getAuthorSnapshotStats(author) {
    let workCount = 0;
    let snapshotCount = 0;
    let oldestSnapshotAt = null;

    Object.values(author?.works || {}).forEach((work) => {
      workCount += 1;
      const history = cloneHistory(work.history);
      snapshotCount += history.length;

      if (history.length > 0) {
        const oldest = history[0].capturedAt;
        if (!oldestSnapshotAt || Date.parse(oldest) < Date.parse(oldestSnapshotAt)) {
          oldestSnapshotAt = oldest;
        }
      }
    });

    return {
      workCount,
      snapshotCount,
      oldestSnapshotAt
    };
  }

  function measureApproxBytes(payload) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(JSON.stringify(payload)).length;
    }

    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  }

  function getDiagnostics(authors, settings, savedAuthors) {
    const normalizedSettings = normalizeSettings(settings);
    let authorCount = 0;
    let workCount = 0;
    let snapshotCount = 0;
    let oldestSnapshotAt = null;

    Object.values(authors || {}).forEach((author) => {
      authorCount += 1;
      const stats = getAuthorSnapshotStats(author);
      workCount += stats.workCount;
      snapshotCount += stats.snapshotCount;

      if (stats.oldestSnapshotAt && (!oldestSnapshotAt || Date.parse(stats.oldestSnapshotAt) < Date.parse(oldestSnapshotAt))) {
        oldestSnapshotAt = stats.oldestSnapshotAt;
      }
    });

    return {
      authorCount,
      workCount,
      snapshotCount,
      savedAuthorCount: normalizeSavedAuthors(savedAuthors).length,
      approxBytes: measureApproxBytes({ authors, settings: normalizedSettings, savedAuthors: normalizeSavedAuthors(savedAuthors) }),
      oldestSnapshotAt
    };
  }

  async function getAllAuthors() {
    const stored = await browser.storage.local.get(AUTHORS_KEY);
    return stored[AUTHORS_KEY] || {};
  }

  async function saveAllAuthors(authors) {
    await browser.storage.local.set({ [AUTHORS_KEY]: authors });
  }

  async function getAuthor(key) {
    const authors = await getAllAuthors();
    return authors[key] || null;
  }

  async function getSavedAuthors() {
    const stored = await browser.storage.local.get(SAVED_AUTHORS_KEY);
    return normalizeSavedAuthors(stored[SAVED_AUTHORS_KEY]);
  }

  async function saveSavedAuthors(entries) {
    const normalized = normalizeSavedAuthors(entries);
    await browser.storage.local.set({ [SAVED_AUTHORS_KEY]: normalized });
    return normalized;
  }

  async function addSavedAuthor(entry) {
    const savedAuthors = await getSavedAuthors();
    const normalizedEntry = normalizeSavedAuthors([entry])[0];
    const existingIndex = savedAuthors.findIndex((item) => item.url === normalizedEntry.url);

    if (existingIndex >= 0) {
      savedAuthors[existingIndex] = {
        ...savedAuthors[existingIndex],
        name: normalizedEntry.name,
        savedAt: new Date().toISOString()
      };
    } else {
      savedAuthors.push({
        ...normalizedEntry,
        savedAt: new Date().toISOString()
      });
    }

    savedAuthors.sort((left, right) => left.name.localeCompare(right.name));
    await saveSavedAuthors(savedAuthors);
    return savedAuthors;
  }

  async function removeSavedAuthor(url) {
    const savedAuthors = await getSavedAuthors();
    const next = savedAuthors.filter((entry) => entry.url !== url);
    await saveSavedAuthors(next);
    return next;
  }

  async function getSettings() {
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(stored[SETTINGS_KEY] || DEFAULT_SETTINGS);
  }

  async function saveSettings(settings) {
    const normalizedSettings = normalizeSettings(settings);
    await browser.storage.local.set({ [SETTINGS_KEY]: normalizedSettings });
    return normalizedSettings;
  }

  async function setSettings(patch) {
    const current = await getSettings();
    const next = normalizeSettings({ ...current, ...patch });
    await saveSettings(next);
    return next;
  }

  async function saveAuthor(key, author, nowIso) {
    const authors = await getAllAuthors();
    authors[key] = author;
    const settings = await getSettings();
    const { authors: cleanedAuthors } = cleanupAuthors(authors, settings, nowIso || new Date().toISOString());
    await saveAllAuthors(cleanedAuthors);
  }

  async function getLatestAuthorKey() {
    const stored = await browser.storage.local.get(LATEST_AUTHOR_KEY);
    return stored[LATEST_AUTHOR_KEY] || null;
  }

  async function setLatestAuthorKey(key) {
    await browser.storage.local.set({ [LATEST_AUTHOR_KEY]: key });
  }

  async function clearAll() {
    await browser.storage.local.clear();
  }

  async function clearAllSnapshots() {
    await browser.storage.local.remove([AUTHORS_KEY, LATEST_AUTHOR_KEY]);
  }

  async function cleanupStoredData(nowIso) {
    const settings = await getSettings();
    const authors = await getAllAuthors();
    const result = cleanupAuthors(authors, settings, nowIso || new Date().toISOString());

    if (result.changed) {
      await saveAllAuthors(result.authors);
    }

    return result;
  }

  async function getStoredDiagnostics() {
    const authors = await getAllAuthors();
    const settings = await getSettings();
    const savedAuthors = await getSavedAuthors();
    return {
      diagnostics: getDiagnostics(authors, settings, savedAuthors),
      settings,
      savedAuthors
    };
  }

  const api = {
    addSavedAuthor,
    clearAll,
    clearAllSnapshots,
    cleanupAuthors,
    cleanupStoredData,
    getAllAuthors,
    getAuthor,
    getAuthorSnapshotStats,
    getDiagnostics,
    getLatestAuthorKey,
    getSavedAuthors,
    getSettings,
    getStoredDiagnostics,
    pruneWorkHistory,
    removeSavedAuthor,
    saveAuthor,
    saveSavedAuthors,
    saveSettings,
    setLatestAuthorKey,
    setSettings
  };

  if (typeof window !== "undefined") {
    window.checkAo3Storage = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
