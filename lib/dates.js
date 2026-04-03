(function () {
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

  function computeDelta(history, field, days) {
    if (!Array.isArray(history) || history.length < 2) {
      return null;
    }

    const current = history[history.length - 1];
    const currentTime = Date.parse(current.capturedAt);
    const targetTime = currentTime - days * 24 * 60 * 60 * 1000;
    const previousSnapshots = history.slice(0, -1);

    const snapshotsWithinWindow = previousSnapshots.filter((snapshot) => Date.parse(snapshot.capturedAt) >= targetTime);

    let baseline = null;

    if (snapshotsWithinWindow.length > 0) {
      baseline = snapshotsWithinWindow[0];
    } else {
      baseline = previousSnapshots[0] || null;
    }

    if (!baseline) {
      return null;
    }

    return (current[field] || 0) - (baseline[field] || 0);
  }

  window.checkAo3Dates = {
    computeDelta,
    formatDateTime,
    formatDelta,
    formatNumber
  };
})();
