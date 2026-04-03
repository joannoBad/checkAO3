(function () {
  function extractNumber(node) {
    if (!node) {
      return 0;
    }

    const match = node.textContent.replace(/,/g, "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function getStatValue(workNode, selector) {
    return extractNumber(workNode.querySelector(selector));
  }

  function absoluteUrl(href) {
    if (!href) {
      return "";
    }

    return new URL(href, window.location.origin).toString();
  }

  function parseWork(workNode) {
    const titleLink = workNode.querySelector("h4.heading a[href*='/works/']");
    const fandomLink = workNode.querySelector(".fandoms.heading a");
    const workUrl = absoluteUrl(titleLink?.getAttribute("href"));
    const workIdMatch = workUrl.match(/\/works\/(\d+)/);

    if (!titleLink || !workIdMatch) {
      return null;
    }

    return {
      workId: workIdMatch[1],
      title: titleLink.textContent.trim(),
      url: workUrl,
      fandom: fandomLink ? fandomLink.textContent.trim() : "",
      updatedAt: "",
      comments: getStatValue(workNode, "dd.comments"),
      kudos: getStatValue(workNode, "dd.kudos"),
      bookmarks: getStatValue(workNode, "dd.bookmarks"),
      hits: getStatValue(workNode, "dd.hits")
    };
  }

  function parseDocument() {
    const works = Array.from(document.querySelectorAll("li.work.blurb")).map(parseWork).filter(Boolean);
    const nextPageLink = document.querySelector("ol.pagination.actions li.next a");

    return {
      works,
      nextPageUrl: nextPageLink ? absoluteUrl(nextPageLink.getAttribute("href")) : null
    };
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "parse-ao3-author-page") {
      return undefined;
    }

    try {
      return Promise.resolve({
        ok: true,
        payload: parseDocument()
      });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: error.message
      });
    }
  });
})();
