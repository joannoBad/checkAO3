# checkAO3

`checkAO3` is a Firefox extension for tracking AO3 author work stats without opening individual work pages.

## What the extension does

- accepts any AO3 author URL
- can save frequently used author URLs in a local dropdown list
- normalizes author links to `/users/<name>/works`
- walks author work pages one by one
- reads stats from listing pages only
- stores local history in Firefox storage
- shows current stats plus growth for `24h`, `7d`, `30d`, and `All time`
- shows the date of the oldest preserved snapshot
- exports the current table as CSV
- includes a diagnostics panel for snapshot counts, storage size, and cleanup settings

## Requirements

- Firefox desktop
- a local copy of this repository
- access to public AO3 author pages

## How to run the extension in Firefox

### First launch

1. Open Firefox.
2. Type `about:debugging#/runtime/this-firefox` into the address bar and press Enter.
3. On the `This Firefox` page, click `Load Temporary Add-on`.
4. In the file picker, open the project folder:
   `d:\projects\checkAO3`
5. Select [manifest.json](d:\projects\checkAO3\manifest.json).
6. Firefox will load the extension temporarily.

After that, the extension should appear in the Firefox extensions list and in the extensions menu.

### How to open the popup

1. In Firefox, click the puzzle-piece icon in the top-right toolbar.
2. Find `checkAO3` in the extensions list.
3. Click `checkAO3` to open the popup.
4. If you want faster access, pin the extension to the toolbar from the same menu.

## How to use the extension

1. Open the popup.
2. Paste an AO3 author URL into the input field.
   Example:
   `https://archiveofourown.org/users/username/works`
3. Optional: click `Save` to keep this author in the local dropdown list.
4. Optional: choose a saved author from the dropdown instead of pasting the URL again.
5. Click `Refresh`.
6. Wait while the extension walks the author's works pages.
7. The table will fill with current stats for each work.
8. Use the `24h`, `7d`, `30d`, and `All time` buttons to switch the growth window.
9. Click `Export CSV` if you want to save the current table.
10. Click `Diagnostics` if you want to inspect storage and cleanup settings.

## Screenshot

Example popup view with sensitive AO3 identifiers redacted:

![Redacted checkAO3 popup screenshot](docs/images/popup-redacted.png)

Saved author links can be kept in a local dropdown for faster switching:

![Redacted saved authors screenshot](docs/images/popup-saved-authors-redacted.png)

## How growth values work

The extension stores snapshots locally and compares the newest snapshot with an older one.

- On the first refresh, you only get current stats.
- If there is no older snapshot yet, rolling windows show `-`.
- As soon as you have at least two snapshots, the extension starts showing changes.
- For each selected rolling window (`24h`, `7d`, `30d`), the extension uses the latest snapshot at or before the window boundary.
- If there is no snapshot old enough for the full window yet, it falls back to the earliest older snapshot you do have.
- `All time` compares the current values to the oldest preserved snapshot for each work.
- The popup also shows the date of the oldest preserved snapshot currently available for the loaded author.

This means growth can start showing immediately after the second refresh, even if a full 24 hours have not passed yet.

Example:

- first refresh: `77`, rolling growth is `-`, all-time growth is `0`
- second refresh a few minutes later: `78`, `24h` can show `+1`
- after more snapshots over time: `7d`, `30d`, and `All time` become more informative

## Diagnostics and cleanup

The diagnostics panel shows:

- number of authors stored
- number of works stored
- number of snapshots stored
- approximate local storage usage
- oldest stored snapshot date

The panel also includes retention settings:

- `Automatically delete snapshots older than 31 days`
- `Delete primary snapshots during cleanup`
- `Run cleanup now`
- `Clear all snapshots`

Cleanup rules are designed so that:

- the latest snapshot is always kept
- a 30-day comparison anchor is preserved when such history exists
- the first snapshot is preserved by default so `All time` can still be calculated
- if `Delete primary snapshots during cleanup` is enabled, the oldest baseline may be removed during pruning

`Clear all snapshots` removes stored snapshot history but keeps the extension settings and saved author links.

Diagnostics view with author-specific identifiers redacted:

![Redacted diagnostics screenshot](docs/images/popup-diagnostics-redacted.png)

## How to reload the extension after code changes

Firefox temporary add-ons do not always update automatically when you edit files.

To reload the extension:

1. Open `about:debugging#/runtime/this-firefox`
2. Find `checkAO3`
3. Click `Reload`
4. Close the popup if it is open
5. Open the popup again

Do this every time after changing HTML, CSS, or JavaScript.

## How to remove and install again

If something looks stale or broken, reinstall the extension cleanly.

1. Open `about:debugging#/runtime/this-firefox`
2. Find `checkAO3`
3. Click `Remove`
4. Click `Load Temporary Add-on`
5. Select [manifest.json](d:\projects\checkAO3\manifest.json) again

## How to verify that it works

A quick smoke test:

1. Load the extension.
2. Open the popup.
3. Paste a public AO3 author URL.
4. Click `Refresh`.
5. Check that:
   - the author name appears
   - `Works tracked` is greater than `0`
   - the table shows work titles and current stats
   - the oldest snapshot date is shown after history exists
   - growth values show `-`, `0`, or signed numbers such as `+1`
6. Save the author URL and confirm it appears in the dropdown list.
7. Open `Diagnostics` and confirm snapshot counts and approximate storage are visible.

## Troubleshooting

### The popup opens but nothing happens

- Make sure the URL is from `https://archiveofourown.org`
- Try a public author page
- Click `Refresh` again
- Check that Firefox still has the temporary add-on loaded

### The popup still shows an old design or old behavior

- Open `about:debugging#/runtime/this-firefox`
- Click `Reload` for `checkAO3`
- Reopen the popup

### I see `-` under rolling growth values

That is expected when there is not enough history yet.

### Why does `All time` stop working after cleanup?

That can happen only if you enabled `Delete primary snapshots during cleanup`, because the oldest baseline may then be removed.

### The extension disappears after restarting Firefox

That is expected for a temporary add-on.
You need to load [manifest.json](d:\projects\checkAO3\manifest.json) again after Firefox restarts.

### I want to inspect errors

1. Open `about:debugging#/runtime/this-firefox`
2. Find `checkAO3`
3. Click `Inspect`
4. Look at the console for popup or background errors

## Testing

Run the snapshot-history tests locally with:

```bash
node --test tests/*.test.js
```

This project includes generated snapshot cases for:

- rolling delta calculation
- all-time delta calculation
- window-boundary selection
- unchanged refreshes
- duplicate timestamp protection
- snapshot cleanup and retention rules

## Current development state

- optimized for public author work pages
- stores data only in the local Firefox profile
- does not handle AO3 login flows inside the extension UI
- cleanup currently keeps history at the per-work snapshot level rather than using an external database

## Notes

This extension is not registered for regular Firefox distribution yet and is currently intended to run only as a temporary add-on in Firefox debug mode.

## Legal and policy note

- AO3 policy is separate from the source-code license
- this project is unofficial and is not affiliated with AO3 or OTW
- see [NOTICE.md](d:\projects\checkAO3\NOTICE.md) for the AO3-specific notice

## Project structure

- [manifest.json](d:\projects\checkAO3\manifest.json): Firefox extension manifest
- [popup/popup.html](d:\projects\checkAO3\popup\popup.html): popup markup
- [popup/popup.css](d:\projects\checkAO3\popup\popup.css): popup styling
- [popup/popup.js](d:\projects\checkAO3\popup\popup.js): popup rendering, saved authors, diagnostics, and CSV export
- [background/background.js](d:\projects\checkAO3\background\background.js): page walking and snapshot saving
- [content/ao3-parser.js](d:\projects\checkAO3\content\ao3-parser.js): AO3 page parser
- [lib/dates.js](d:\projects\checkAO3\lib\dates.js): formatting, oldest snapshot lookup, and delta calculations
- [lib/storage.js](d:\projects\checkAO3\lib\storage.js): local Firefox storage, saved authors, diagnostics, and cleanup helpers
- [tests/snapshot-history.test.js](d:\projects\checkAO3\tests\snapshot-history.test.js): snapshot and cleanup tests
- [docs/images/popup-redacted.png](d:\projects\checkAO3\docs\images\popup-redacted.png): redacted popup screenshot
- [docs/images/popup-saved-authors-redacted.png](d:\projects\checkAO3\docs\images\popup-saved-authors-redacted.png): redacted saved authors screenshot
- [docs/images/popup-diagnostics-redacted.png](d:\projects\checkAO3\docs\images\popup-diagnostics-redacted.png): redacted diagnostics screenshot




