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
