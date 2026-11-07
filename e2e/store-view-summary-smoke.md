# Slice 1b smoke checklist (added only; not executed)

Run after separately approved migration + integrated phase9-owner-ingestion deployment.
Use an owner test account with a known store; record viewport and light/dark theme.

1. Open Store View. Verify Summary button has collapsed state. Open it; verify Hide summary, six count tiles, stock value label and “All books, including private and paused”. Panel precedes chips.
2. Tap each tile; its matching chip becomes selected and list results match the count after loading all pages. Check publication failure and attention + zero-stock overlaps.
3. Reload while open, then while closed: each state restores for this account/store. Confirm tile-selected filter also restores.
4. Switch store/account: no previous summary or preference appears. Log out and back in: panel starts closed and filter All.
5. Save a price, adjust stock, change a photo, publish/pause/retry and commit a scanned book. Verify summary refetches. Make a change in another session; refocus Store View and pull to refresh, confirming totals update.
6. Delay/fail only the summary response: loading and Retry appear inside the panel; list/filter chips still work. Retry succeeds. Empty store shows all zeros and ₹0.00.
7. With a test total above 2^53, compare every displayed digit with the server decimal string using integer paise. Check Indian grouping, narrow viewport wrapping, large text, screen-reader button expanded state and tile labels, light and dark themes.

No Playwright or connected smoke run is part of this implementation session.
