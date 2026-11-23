# atomic-design

Claude Code plugin that keeps UI work atomic: plan the levels first, reuse existing components, and audit every UI edit.

Works with React, Next.js, React Native, Expo, Vue, Nuxt, Svelte, Angular (preset `js`), Flutter (`flutter`), Jetpack Compose (`compose`) and SwiftUI (`swiftui`). Needs Node 18+.

## Use

```
claude --plugin-dir path/to/atomic-design
```

1. `/atomic-design:atomic-init`: detects the framework, writes `atomic.config.json`, baselines existing violations.
2. Ask for UI work as usual. The `atomic-design` skill plans the pieces (reuse / extend / new) before coding.
3. Every `Edit`/`Write` on a UI file runs the audit. New violations go back to Claude to fix.
4. `/atomic-design:atomic-audit`: full report (rules, wrong levels, near-duplicates, unused). Changes nothing.

## Rules the hook checks

| Rule | Example |
|---|---|
| `import-direction` | a molecule imports an organism |
| `hardcoded-value` | `#333`, `24px`, `Color(0xFF…)`, `16.dp`, `.padding(12)` outside token files |
| `missed-reuse` | `<button>` / `ElevatedButton` / `Button(` above the atom level when a Button atom exists |
| `duplicate` | two components with the same name |

SwiftUI has no import-direction check (one module has no file imports); `/atomic-design:atomic-audit` reviews it.

## Add a framework

Add an entry to `scripts/presets.mjs` and a fixture under `tests/fixtures/`.

## Test

```
node --test tests/audit.test.mjs
```
