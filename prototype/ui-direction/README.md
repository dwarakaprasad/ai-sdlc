# PROTOTYPE: Home Tutor UI direction (throwaway)

**Question:** which visual direction is "kid-friendly but not kiddish" for grades 4–8?

Three directions × eight screens, switchable via `?variant=A|B|C&screen=<id>` on one throwaway page.
Fake data shaped like `src/shared/api.ts` (`data.ts`); no server, no LLM, nothing persisted.
This branch (`prototype/ui-direction`) never merges to `main`; only the chosen direction does, rebuilt properly.

## Run

```sh
npm run prototype:ui     # http://localhost:5199 (also on the LAN, so a real tablet can open it)
```

Floating bar (dev only): `←/→` direction, `↑/↓` screen, `N` next Tutor-name candidate, and a viewport picker
(fit / tablet 1024×768 / tablet portrait / laptop 1440×900 / phone). In-screen buttons navigate too (Start → chat, Send → quiz…).
The quiz is live: pick, Check, Continue through all three questions to the score.

## The directions

| | A · Playground | B · Studio | C · Bright |
|---|---|---|---|
| Close to | Duolingo | Brilliant.org | in between |
| Shell | left rail + right stats column | top bar, one "Continue" hero, subject list rows | header with stat chips, 2×2 Subject tiles |
| Learning Path | winding vertical nodes, Unit banners | timeline list + progress ring | Units as horizontal tracks of tiles |
| Chat | bubbles, step bar | lesson panel + document-style replies | Subject-coloured band, reply starters, modal break prompt |
| Quiz | bottom feedback sheet | inline feedback in a card | colour-tile choices, number pad, floating feedback toast |
| Goal met | owl + confetti + stat tiles | drawn check, quiet confetti, dark "Up next" | full-colour screen, robot dance |
| Parent | same rail, calm tables | dense table + "needs attention" filter | "Needs you" panel first, a card per Subject |
| Tutor | owl: Ollie / Pip / Juno | orb mark: Atlas / Nova / Sage | robot: Orbit / Pico / Kit |

Social Studies and Science are invented so every home-card state shows at once (overdue, normal, Unit Test, with your Parent).

## Verdict (2026-10-06)

**Direction B, Studio, as a whole.** It's the one a 12-year-old won't cringe at, and it still gives a 9-year-old colour, progress and feedback.
The Tutor ships as **Jarvis**, drawn as B's dark rounded mark with pill eyes and a yellow corner. In the domain and in code it stays the "Tutor".
A and C stay on this branch as reference only.

The real build follows the agreed approach: plain CSS with design tokens and a few shared components, built properly with tests, not copied from here.
Screens to rebuild from B: the profile picker, the Avatar pick, Today (the home screen), the Learning Path, the Session chat, the Quiz with its score screen, Goal met, and the Parent Goals list.
