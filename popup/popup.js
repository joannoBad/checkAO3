(function () {
  const form = document.getElementById("author-form");
  const urlInput = document.getElementById("author-url");
  const saveAuthorButton = document.getElementById("save-author-button");
  const savedAuthorsSelect = document.getElementById("saved-authors-select");
  const removeSavedAuthorButton = document.getElementById("remove-saved-author-button");
  const statusNode = document.getElementById("status");
  const worksBody = document.getElementById("works-body");
  const authorNameNode = document.getElementById("author-name");
  const lastRefreshNode = document.getElementById("last-refresh");
  const workCountNode = document.getElementById("work-count");
  const oldestSnapshotNode = document.getElementById("oldest-snapshot");
  const exportButton = document.getElementById("export-button");
  const diagnosticsButton = document.getElementById("diagnostics-button");
  const diagnosticsPanel = document.getElementById("diagnostics-panel");
  const periodSwitch = document.getElementById("period-switch");
  const autoDeleteSetting = document.getElementById("auto-delete-setting");
  const deletePrimarySetting = document.getElementById("delete-primary-setting");
  const runCleanupButton = document.getElementById("run-cleanup-button");
  const clearSnapshotsButton = document.getElementById("clear-snapshots-button");
  const diagnosticAuthorCountNode = document.getElementById("diagnostic-author-count");
  const diagnosticWorkCountNode = document.getElementById("diagnostic-work-count");
  const diagnosticSnapshotCountNode = document.getElementById("diagnostic-snapshot-count");
  const diagnosticSizeNode = document.getElementById("diagnostic-size");
  const diagnosticNoteNode = document.getElementById("diagnostic-note");

  let currentPeriodKey = "1";
  let currentAuthorRecord = null;

  function setStatus(message, isError) {
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#f08d8d" : "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getCurrentAuthorOldestSnapshotAt(authorRecord) {
    let oldestSnapshotAt = null;

    Object.values(authorRecord?.works || {}).forEach((work) => {
      const oldest = window.checkAo3Dates.getOldestSnapshotAt(work.history);
      if (oldest && (!oldestSnapshotAt || Date.parse(oldest) < Date.parse(oldestSnapshotAt))) {
        oldestSnapshotAt = oldest;
      }
    });

    return oldestSnapshotAt;
  }

  function renderSavedAuthors(savedAuthors) {
    const currentValue = savedAuthorsSelect.value;
    savedAuthorsSelect.innerHTML = '<option value="">Select a saved author</option>';

    savedAuthors.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.url;
      option.textContent = entry.name;
      option.title = entry.url;
      savedAuthorsSelect.appendChild(option);
    });

    if (savedAuthors.some((entry) => entry.url === currentValue)) {
      savedAuthorsSelect.value = currentValue;
    }
  }

  async function refreshSavedAuthors() {
    const savedAuthors = await window.checkAo3Storage.getSavedAuthors();
    renderSavedAuthors(savedAuthors);
    return savedAuthors;
  }

  function metricCell(currentValue, deltaValue) {
    const formattedDelta = window.checkAo3Dates.formatDelta(deltaValue);
    const deltaClass = formattedDelta === "-" ? "metric-delta is-empty" : "metric-delta";
    return `
      <div class="metric-main">${window.checkAo3Dates.formatNumber(currentValue)}</div>
      <div class="${deltaClass}">${formattedDelta}</div>
    `;
  }

  function buildCsv(authorRecord) {
    const works = Object.values(authorRecord?.works || {});
    const header = [
      "title",
      "url",
      "fandom",
      "hits",
      "hits_delta",
      "kudos",
      "kudos_delta",
      "bookmarks",
      "bookmarks_delta",
      "comments",
      "comments_delta",
      "window",
      "oldest_snapshot_at",
      "last_captured_at"
    ];

    const rows = works.map((work) => {
      const current = work.current || {};
      return [
        work.title || "",
        work.url || "",
        work.fandom || "",
        current.hits || 0,
        window.checkAo3Dates.computeDelta(work.history, "hits", currentPeriodKey) ?? "",
        current.kudos || 0,
        window.checkAo3Dates.computeDelta(work.history, "kudos", currentPeriodKey) ?? "",
        current.bookmarks || 0,
        window.checkAo3Dates.computeDelta(work.history, "bookmarks", currentPeriodKey) ?? "",
        current.comments || 0,
        window.checkAo3Dates.computeDelta(work.history, "comments", currentPeriodKey) ?? "",
        window.checkAo3Dates.formatPeriodLabel(currentPeriodKey),
        window.checkAo3Dates.getOldestSnapshotAt(work.history) || "",
        current.capturedAt || ""
      ];
    });

    return [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
  }

  function downloadCsv(authorRecord) {
    const csv = buildCsv(authorRecord);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeAuthor = (authorRecord.name || "ao3-author").replace(/[^a-z0-9_-]+/gi, "-");
    const periodLabel = window.checkAo3Dates.formatPeriodLabel(currentPeriodKey).replace(/[^a-z0-9_-]+/gi, "-");
    link.href = url;
    link.download = `${safeAuthor}-${periodLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderTable(authorRecord) {
    const works = Object.values(authorRecord?.works || {});
    workCountNode.textContent = String(works.length);

    if (!works.length) {
      worksBody.innerHTML = '<tr><td colspan="5" class="empty">No stats yet.</td></tr>';
      return;
    }

    works.sort((left, right) => {
      const leftHits = left.current?.hits || 0;
      const rightHits = right.current?.hits || 0;
      return rightHits - leftHits;
    });

    worksBody.innerHTML = works
      .map((work) => {
        const current = work.current || {};
        const hitsDelta = window.checkAo3Dates.computeDelta(work.history, "hits", currentPeriodKey);
        const kudosDelta = window.checkAo3Dates.computeDelta(work.history, "kudos", currentPeriodKey);
        const bookmarksDelta = window.checkAo3Dates.computeDelta(work.history, "bookmarks", currentPeriodKey);
        const commentsDelta = window.checkAo3Dates.computeDelta(work.history, "comments", currentPeriodKey);

        return `
          <tr>
            <td>
              <div class="work-title">${escapeHtml(work.title || "Untitled")}</div>
              <div class="work-subtitle">${escapeHtml(work.fandom || "Unknown fandom")}</div>
            </td>
            <td>${metricCell(current.hits, hitsDelta)}</td>
            <td>${metricCell(current.kudos, kudosDelta)}</td>
            <td>${metricCell(current.bookmarks, bookmarksDelta)}</td>
            <td>${metricCell(current.comments, commentsDelta)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function updatePeriodButtons() {
    const buttons = periodSwitch.querySelectorAll(".period-button");
    buttons.forEach((button) => {
      const isActive = button.dataset.period === currentPeriodKey;
      button.classList.toggle("is-active", isActive);
    });
  }

  function updateDiagnosticsView(diagnostics, settings) {
    diagnosticAuthorCountNode.textContent = window.checkAo3Dates.formatNumber(diagnostics.authorCount);
    diagnosticWorkCountNode.textContent = window.checkAo3Dates.formatNumber(diagnostics.workCount);
    diagnosticSnapshotCountNode.textContent = window.checkAo3Dates.formatNumber(diagnostics.snapshotCount);
    diagnosticSizeNode.textContent = formatBytes(diagnostics.approxBytes);
    autoDeleteSetting.checked = settings.autoDeleteOldSnapshots;
    deletePrimarySetting.checked = settings.deletePrimarySnapshots;
    diagnosticNoteNode.textContent = diagnostics.oldestSnapshotAt
      ? `Oldest stored snapshot: ${window.checkAo3Dates.formatDateTime(diagnostics.oldestSnapshotAt)}. Cleanup preserves the latest snapshot and a 30-day comparison anchor when available.`
      : "No snapshots stored yet. Once history exists, this panel will show how much local data is being kept.";
  }

  async function refreshDiagnostics() {
    const { diagnostics, settings } = await window.checkAo3Storage.getStoredDiagnostics();
    updateDiagnosticsView(diagnostics, settings);
  }

  async function loadLatestAuthor() {
    await window.checkAo3Storage.cleanupStoredData();
    const latestKey = await window.checkAo3Storage.getLatestAuthorKey();

    if (!latestKey) {
      currentAuthorRecord = null;
      renderTable(null);
      authorNameNode.textContent = "Not loaded";
      lastRefreshNode.textContent = "Never";
      oldestSnapshotNode.textContent = "Never";
      await refreshDiagnostics();
      await refreshSavedAuthors();
      return;
    }

    const authorRecord = await window.checkAo3Storage.getAuthor(latestKey);
    if (!authorRecord) {
      await refreshDiagnostics();
      await refreshSavedAuthors();
      return;
    }

    currentAuthorRecord = authorRecord;
    urlInput.value = authorRecord.url || "";
    authorNameNode.textContent = authorRecord.name || latestKey;
    lastRefreshNode.textContent = window.checkAo3Dates.formatDateTime(authorRecord.lastCapturedAt);
    oldestSnapshotNode.textContent = window.checkAo3Dates.formatDateTime(getCurrentAuthorOldestSnapshotAt(authorRecord));
    renderTable(authorRecord);
    await refreshDiagnostics();
    await refreshSavedAuthors();
  }

  async function refreshAuthor(url) {
    setStatus("Refreshing AO3 stats. This can take a bit if the author has many pages.");
    const response = await browser.runtime.sendMessage({
      type: "refresh-author",
      payload: { url }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Unknown refresh error");
    }

    setStatus(`Captured ${response.payload.workCount} works across ${response.payload.pageCount} page(s).`);
    await loadLatestAuthor();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = urlInput.value.trim();
    if (!url) {
      setStatus("Insert an AO3 author URL first.", true);
      return;
    }

    try {
      await refreshAuthor(url);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  saveAuthorButton.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) {
      setStatus("Insert an author URL before saving it.", true);
      return;
    }

    const savedAuthors = await window.checkAo3Storage.addSavedAuthor({
      name: currentAuthorRecord?.name || url,
      url
    });

    renderSavedAuthors(savedAuthors);
    savedAuthorsSelect.value = url;
    setStatus("Author URL saved to the local dropdown list.");
  });

  savedAuthorsSelect.addEventListener("change", () => {
    if (!savedAuthorsSelect.value) {
      return;
    }

    urlInput.value = savedAuthorsSelect.value;
    setStatus("Loaded a saved author URL into the input field.");
  });

  removeSavedAuthorButton.addEventListener("click", async () => {
    const url = savedAuthorsSelect.value || urlInput.value.trim();
    if (!url) {
      setStatus("Choose a saved author first.", true);
      return;
    }

    const savedAuthors = await window.checkAo3Storage.removeSavedAuthor(url);
    renderSavedAuthors(savedAuthors);
    if (urlInput.value.trim() === url) {
      urlInput.value = "";
    }
    setStatus("Saved author removed from the dropdown list.");
  });

  exportButton.addEventListener("click", () => {
    if (!currentAuthorRecord) {
      setStatus("Refresh an author first before exporting CSV.", true);
      return;
    }

    downloadCsv(currentAuthorRecord);
    setStatus(`Exported CSV for the current ${window.checkAo3Dates.formatPeriodLabel(currentPeriodKey)} window.`);
  });

  diagnosticsButton.addEventListener("click", async () => {
    diagnosticsPanel.classList.toggle("hidden");
    if (!diagnosticsPanel.classList.contains("hidden")) {
      await refreshDiagnostics();
      setStatus("Diagnostics panel opened.");
    } else {
      setStatus("Diagnostics panel closed.");
    }
  });

  periodSwitch.addEventListener("click", (event) => {
    const button = event.target.closest(".period-button");
    if (!button) {
      return;
    }

    currentPeriodKey = button.dataset.period;
    updatePeriodButtons();
    renderTable(currentAuthorRecord);
  });

  autoDeleteSetting.addEventListener("change", async () => {
    await window.checkAo3Storage.setSettings({ autoDeleteOldSnapshots: autoDeleteSetting.checked });
    await window.checkAo3Storage.cleanupStoredData();
    await loadLatestAuthor();
    setStatus(autoDeleteSetting.checked ? "Automatic 31-day snapshot cleanup enabled." : "Automatic snapshot cleanup disabled.");
  });

  deletePrimarySetting.addEventListener("change", async () => {
    await window.checkAo3Storage.setSettings({ deletePrimarySnapshots: deletePrimarySetting.checked });
    await window.checkAo3Storage.cleanupStoredData();
    await loadLatestAuthor();
    setStatus(deletePrimarySetting.checked ? "Primary snapshots may now be removed during cleanup." : "Primary snapshots are now preserved for all-time comparisons.");
  });

  runCleanupButton.addEventListener("click", async () => {
    await window.checkAo3Storage.cleanupStoredData();
    await loadLatestAuthor();
    setStatus("Cleanup completed using the current retention settings.");
  });

  clearSnapshotsButton.addEventListener("click", async () => {
    await window.checkAo3Storage.clearAllSnapshots();
    currentAuthorRecord = null;
    await loadLatestAuthor();
    setStatus("All stored snapshots were removed. Settings were kept.");
  });

  updatePeriodButtons();
  loadLatestAuthor().catch((error) => {
    setStatus(error.message, true);
  });
})();
