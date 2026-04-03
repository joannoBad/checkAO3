(function () {
  const AUTHORS_KEY = "authors";
  const LATEST_AUTHOR_KEY = "latestAuthorKey";

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

  async function saveAuthor(key, author) {
    const authors = await getAllAuthors();
    authors[key] = author;
    await saveAllAuthors(authors);
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

  window.checkAo3Storage = {
    clearAll,
    getAllAuthors,
    getAuthor,
    getLatestAuthorKey,
    saveAuthor,
    setLatestAuthorKey
  };
})();
