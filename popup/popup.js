(function () {
  const form = document.getElementById("author-form");
  const urlInput = document.getElementById("author-url");
  const statusNode = document.getElementById("status");
  const worksBody = document.getElementById("works-body");
  const authorNameNode = document.getElementById("author-name");
  const lastRefreshNode = document.getElementById("last-refresh");
  const workCountNode = document.getElementById("work-count");
  const clearButton = document.getElementById("clear-button");
  const exportButton = document.getElementById("export-button");
  const periodSwitch = document.getElementById("period-switch");

  let currentPeriodDays = 1;
  let currentAuthorRecord = null;

  function setStatus(message, isError) {
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#8d1d1d" : "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
      "window_days",
      "last_captured_at"
    ];

    const rows = works.map((work) => {
      const current = work.current || {};
      return [
        work.title || "",
        work.url || "",
        work.fandom || "",
        current.hits || 0,
        window.checkAo3Dates.computeDelta(work.history, "hits", currentPeriodDays) ?? "",
        current.kudos || 0,
        window.checkAo3Dates.computeDelta(work.history, "kudos", currentPeriodDays) ?? "",
        current.bookmarks || 0,
        window.checkAo3Dates.computeDelta(work.history, "bookmarks", currentPeriodDays) ?? "",
        current.comments || 0,
        window.checkAo3Dates.computeDelta(work.history, "comments", currentPeriodDays) ?? "",
        currentPeriodDays,
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
    link.href = url;
    link.download = `${safeAuthor}-${currentPeriodDays}d.csv`;
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
        const hitsDelta = window.checkAo3Dates.computeDelta(work.history, "hits", currentPeriodDays);
        const kudosDelta = window.checkAo3Dates.computeDelta(work.history, "kudos", currentPeriodDays);
        const bookmarksDelta = window.checkAo3Dates.computeDelta(work.history, "bookmarks", currentPeriodDays);
        const commentsDelta = window.checkAo3Dates.computeDelta(work.history, "comments", currentPeriodDays);

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
      const isActive = Number(button.dataset.days) === currentPeriodDays;
      button.classList.toggle("is-active", isActive);
    });
  }

  async function loadLatestAuthor() {
    const latestKey = await window.checkAo3Storage.getLatestAuthorKey();
    if (!latestKey) {
      currentAuthorRecord = null;
      renderTable(null);
      authorNameNode.textContent = "Not loaded";
      lastRefreshNode.textContent = "Never";
      return;
    }

    const authorRecord = await window.checkAo3Storage.getAuthor(latestKey);
    if (!authorRecord) {
      return;
    }

    currentAuthorRecord = authorRecord;
    urlInput.value = authorRecord.url || "";
    authorNameNode.textContent = authorRecord.name || latestKey;
    lastRefreshNode.textContent = window.checkAo3Dates.formatDateTime(authorRecord.lastCapturedAt);
    renderTable(authorRecord);
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

  clearButton.addEventListener("click", async () => {
    await window.checkAo3Storage.clearAll();
    currentAuthorRecord = null;
    setStatus("Local data cleared.");
    await loadLatestAuthor();
  });

  exportButton.addEventListener("click", () => {
    if (!currentAuthorRecord) {
      setStatus("Refresh an author first before exporting CSV.", true);
      return;
    }

    downloadCsv(currentAuthorRecord);
    setStatus(`Exported CSV for the current ${currentPeriodDays}d window.`);
  });

  periodSwitch.addEventListener("click", (event) => {
    const button = event.target.closest(".period-button");
    if (!button) {
      return;
    }

    currentPeriodDays = Number(button.dataset.days);
    updatePeriodButtons();
    renderTable(currentAuthorRecord);
  });

  updatePeriodButtons();
  loadLatestAuthor().catch((error) => {
    setStatus(error.message, true);
  });
})();
