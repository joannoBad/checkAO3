const REFRESH_DELAY_MS = 1400;

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "refresh-author") {
    return refreshAuthor(message.payload.url);
  }

  return undefined;
});

function sleep(timeoutMs) {
  return new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
}

function normalizeAuthorUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new Error("That does not look like a valid URL.");
  }

  if (parsed.origin !== "https://archiveofourown.org") {
    throw new Error("Use a URL from https://archiveofourown.org.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  const userIndex = parts.indexOf("users");

  if (userIndex === -1 || !parts[userIndex + 1]) {
    throw new Error("Expected a user URL like /users/<name>/works.");
  }

  const username = decodeURIComponent(parts[userIndex + 1]);
  const normalized = `https://archiveofourown.org/users/${encodeURIComponent(username)}/works`;
  return { username, normalized };
}

async function createHiddenTab(url) {
  return browser.tabs.create({ url, active: false });
}

async function waitForTabReady(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        browser.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    };

    browser.tabs.onUpdated.addListener(listener);
  });
}

async function fetchPageStats(url) {
  const tab = await createHiddenTab(url);

  try {
    await waitForTabReady(tab.id);
    await sleep(REFRESH_DELAY_MS);

    const result = await browser.tabs.sendMessage(tab.id, {
      type: "parse-ao3-author-page"
    });

    if (!result?.ok) {
      throw new Error(result?.error || "Could not parse AO3 author page.");
    }

    return result.payload;
  } finally {
    await browser.tabs.remove(tab.id);
  }
}

function mergeWorkHistory(existingWork, incomingWork, capturedAt) {
  const history = Array.isArray(existingWork?.history) ? [...existingWork.history] : [];
  const snapshot = {
    capturedAt,
    hits: incomingWork.hits,
    kudos: incomingWork.kudos,
    bookmarks: incomingWork.bookmarks,
    comments: incomingWork.comments
  };

  const lastSnapshot = history[history.length - 1];
  const sameStats =
    lastSnapshot &&
    lastSnapshot.hits === snapshot.hits &&
    lastSnapshot.kudos === snapshot.kudos &&
    lastSnapshot.bookmarks === snapshot.bookmarks &&
    lastSnapshot.comments === snapshot.comments;

  if (!sameStats) {
    history.push(snapshot);
  }

  return {
    workId: incomingWork.workId,
    title: incomingWork.title,
    url: incomingWork.url,
    fandom: incomingWork.fandom,
    updatedAt: incomingWork.updatedAt,
    current: snapshot,
    history
  };
}

async function refreshAuthor(rawUrl) {
  try {
    const { username, normalized } = normalizeAuthorUrl(rawUrl);
    const capturedAt = new Date().toISOString();

    let nextUrl = normalized;
    let pageCount = 0;
    const aggregatedWorks = [];

    while (nextUrl) {
      const pagePayload = await fetchPageStats(nextUrl);
      pageCount += 1;
      aggregatedWorks.push(...pagePayload.works);
      nextUrl = pagePayload.nextPageUrl || null;

      if (nextUrl) {
        await sleep(REFRESH_DELAY_MS);
      }
    }

    const existingAuthor = (await window.checkAo3Storage.getAuthor(username)) || {
      name: username,
      url: normalized,
      works: {}
    };

    const works = { ...(existingAuthor.works || {}) };

    aggregatedWorks.forEach((work) => {
      works[work.workId] = mergeWorkHistory(works[work.workId], work, capturedAt);
    });

    const updatedAuthor = {
      name: username,
      url: normalized,
      lastCapturedAt: capturedAt,
      works
    };

    await window.checkAo3Storage.saveAuthor(username, updatedAuthor);
    await window.checkAo3Storage.setLatestAuthorKey(username);

    return {
      ok: true,
      payload: {
        authorKey: username,
        pageCount,
        workCount: aggregatedWorks.length
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}
