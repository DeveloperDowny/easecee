# Quiet Analytics

A small experiment inspired by the A2UI idea: an AI agent answers with an interactive screen instead of a wall of text. Here the screens show analytics for the [overstimulation launcher](https://github.com/DeveloperDowny/launcher-plus-overstimulation-indicator) study data.

This is **A2UI-inspired, not the official A2UI protocol or SDK.** It borrows the ideas: the agent describes a screen, the app draws it with its own components, and data is filled in on the server.

## How it works
1. You ask a question.
2. Gemini replies with a JSON screen: a list of components from a fixed catalog (`catalog.js`) plus the named data queries it wants.
3. The server checks the screen (unknown components are dropped), runs the queries against Supabase, and returns the rows.
4. `public/renderer.js` draws it. The model never sees your data, only the tool names. Picker chips re-fetch live data without calling the model again.

Charts are inline SVG with a text summary and a "View as table" fallback. The look is calm: soft colors, no animation, light and dark.

## Run it
```
cd overstim-a2ui
GEMINI_API_KEY=your_key npm start      # http://localhost:3000
```
Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`), `SUPABASE_URL`, `SUPABASE_KEY` (default to the launcher's public read-only values).
`npm run dev:mock` serves one canned screen so you can try the UI without a key.

## Notes
- The API key stays on the server and is never sent to the browser.
- Approval cards are a demo: they remember your choice in the browser and change nothing in the launcher.
- The launcher database allows anonymous reads, so this app can read all tester rows. Screens show tester IDs and aggregates only.
