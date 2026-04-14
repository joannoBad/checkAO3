(function () {
  const ALL_TIME_PERIOD = "all";

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function formatDelta(value) {
    if (value === null || value === undefined) {
      return "-";
    }

    if (value === 0) {
      return "0";
    }

    return value > 0 ? `+${formatNumber(value)}` : String(value);
  }

  function formatDateTime(value) {
    if (!value) {
      return "Never";
    }

    return new Date(value).toLocaleString();
  }

  function formatPeriodLabel(periodKey) {
    if (periodKey === ALL_TIME_PERIOD) {
      return "all-time";
    }

    return `${periodKey}d`;
  }

  function getOldestSnapshotAt(history) {
    if (!Array.isArray(history) || history.length === 0) {
      return null;
    }

    return history[0].capturedAt || null;
  }

  function computeAllTimeDelta(history, field) {
    if (!Array.isArray(history) || history.length === 0) {
      return null;
    }

    const oldest = history[0];
    const current = history[history.length - 1];
    return (current[field] || 0) - (oldest[field] || 0);
  }

  function computeDelta(history, field, periodKey) {
    if (!Array.isArray(history) || history.length === 0) {
      return null;
    }

    if (periodKey === ALL_TIME_PERIOD) {
      return computeAllTimeDelta(history, field);
    }

    if (history.length < 2) {
      return null;
    }

    const days = Number(periodKey);
    const current = history[history.length - 1];
    const currentTime = Date.parse(current.capturedAt);
    const targetTime = currentTime - days * 24 * 60 * 60 * 1000;
    const previousSnapshots = history.slice(0, -1);

    let baseline = null;

    for (let index = previousSnapshots.length - 1; index >= 0; index -= 1) {
      const snapshot = previousSnapshots[index];
      if (Date.parse(snapshot.capturedAt) <= targetTime) {
        baseline = snapshot;
        break;
      }
    }

    if (!baseline) {
      baseline = previousSnapshots[0] || null;
    }

    if (!baseline) {
      return null;
    }

    return (current[field] || 0) - (baseline[field] || 0);
  }

  const api = {
    ALL_TIME_PERIOD,
    computeDelta,
    formatDateTime,
    formatDelta,
    formatNumber,
    formatPeriodLabel,
    getOldestSnapshotAt
  };

  if (typeof window !== "undefined") {
    window.checkAo3Dates = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
