# Examerit — UI/UX redesign plan

## 1. What the API actually gives us (and what the UI should do about it)

| Domain | Endpoints | Product signal | UX consequence |
|---|---|---|---|
| Goals | `/student/targets`, `/student/categories`, `/exam-alerts/personalized` | Student has ≤3 target exams + categories | Everything should be **exam-scoped**: one global "active exam" switcher, not per-screen pickers |
| Practice | `/exams/:id/published-tests`, `/free-quizzes`, `/me/exam-progress/:id`, `/tests/:id/*` | Mocks, quizzes, attempts, resume | Home must surface **Continue / Next test**; test list shows per-test state (new / in progress / done + score) |
| Live | `/student-state/live-tests`, `/leaderboard/global` | Scheduled, gated by `starts_at` | Countdown + register CTA; no real-time, so poll politely |
| Learning | `/courses`, `/materials`, `/syllabus`, `/current-affairs`, `/vocabulary` | Content library | Learn tab = content shelves, not a list of tabs |
| Retention | `/quiz/streak`, `/learning/summary` (open_mistakes, revision_due), `/learning/mistakes` | Streak, daily goal, spaced repetition | **"Today" plan** card on Home: daily goal + revision due + mistakes |
| Insight | `/analytics/quiz-performance`, `/study-time`, `/progress`, `/me/topic-performance` | Subject/topic accuracy, trend | Strong/weak topics → direct CTA "Practice this topic" |
| Money | `/plans`, `/subscriptions/me`, `/me/entitlements` | Free vs Pro; payments return 503 | Lock states and upsell must be gentle; checkout shows "coming soon" honestly |

Constraints from `API_MAP.md` that shape the design: no websockets (polling), server doesn't enforce test duration (client timer from `startedAt` + `Date` header offset), no forgot-password, no doubt forum/live classes → **don't design UI for features the backend lacks**.

## 2. Current UI/UX audit

**Good:** consistent theme hook, skeleton loaders, pull-to-refresh, safe-area handling, a11y roles on buttons/tabs, solid test window (palette, autosave, report).

**Problems**
1. **Home is a launcher, not a dashboard.** An 8-icon grid + 3 stacked lists; no clear "what should I do now". Streak is a tiny pill.
2. **Flat, bordered boxes everywhere** (`borderWidth:1` on every card) → dense, low hierarchy, "admin panel" feel.
3. **Duplicated primitives** — each screen re-implements cards, chips, section headers, segmented controls, pills (8.8k lines, only 8 shared components).
4. **Tab bar**: 5 tabs, tiny 20px icons, 10.5px labels; "Account" is a settings dump. Analytics ("Stats") is a destination rather than woven into practice.
5. **Navigation depth**: Home → Exams → Exam → Test → Intro → Window. Exam picker is repeated on Home, Tests, Exams, Onboarding.
6. **Progress is invisible**: result/attempt scores are text; no rings, bars or trends on the main surfaces.
7. **Typography scale is minimal** (title/heading/body/small), no numeric/display style for scores & stats.
8. **No motion/haptics**; `Animated` only for skeletons (reanimated is installed but unused).
9. Light-only polish: dark palette exists but surfaces have little elevation separation.

## 3. Design direction — "Calm focus"

- **Personality:** confident study coach. Indigo brand, warm accent for streak/gold, generous radius (18–26), soft shadows instead of borders, one hero card per screen.
- **Principles:** (1) answer "what next?" on every top-level screen; (2) numbers get visual form (rings, bars); (3) one primary action per card; (4) thumb-zone primary actions; (5) honest empty/locked/error states.
- **Tokens** (already started in `src/theme/index.ts`): `hero` gradient-ish deep indigo, `heroSoft/heroMuted`, `shadow`, `radius.xl/pill`, `elevation()`.

### Component kit (`src/components/ui/kit.tsx`)
`Card` (elevated, pressable) · `Hero` · `SectionHeader` (title + "See all") · `Chip` / `ChipRow` · `Segmented` · `Badge` · `IconTile` · `ProgressBar` · `StatTile` (ProgressRing deferred: needs `react-native-svg` via `npx expo install`) · `ListRow` · pressable scale feedback.

## 4. New information architecture

Tabs (4 + profile via avatar):
1. **Home** — Today
2. **Practice** (Tests) — Mocks / Quizzes / Live, scoped by active exam
3. **Learn** — Courses, Materials, Syllabus, Current affairs, Vocabulary as shelves
4. **Progress** (Stats) — Overview, subjects, mistakes & revision
5. **You** — profile, plan, settings (kept as tab for now; avatar shortcut on Home)

Global **exam switcher** chip in the header of Home/Practice/Progress (writes nothing; just filters from `/student/targets`).

## 5. Screen redesigns

**Home (Today)**
- Header: avatar + greeting + notification bell (unread dot from `/notifications`).
- **Hero card**: streak ring (`currentStreak`, `dailyGoalCompleted`), points, active target exam with application/exam dates from alerts.
- **Today's plan** row: Revision due (`revision_due`) · Mistakes to fix (`open_mistakes`) · Daily quiz CTA.
- **Quick access** horizontally scrollable rounded tiles (8 destinations) instead of a 4×2 grid.
- **Target exams** as stacked cards with priority; **Exam alerts** as timeline cards with NEW badge and primary action from `actions[]`.
- Skeletons per section (not whole-screen blocking).

**Practice**: sticky segmented (Mocks · Quizzes), exam chips, test cards with state ribbon (New / Resume / Score ring), lock icon + upgrade for `access_tier`, live banner with countdown.

**Test intro**: hero with duration/questions/marks tiles, section list, past attempts timeline, single sticky CTA (Start / Resume / View result).

**Test window** (keep logic, polish only): sticky top bar with timer pill (turns amber <5 min, red <1 min), section tabs, bottom action bar (Mark · Clear · Next), palette as bottom sheet with legend counts.

**Result**: score ring hero, accuracy/time/rank tiles, section breakdown bars, solutions with filter chips (All / Wrong / Skipped / Marked).

**Progress**: score trend line, subject accuracy bars, weak topics with "Practice" CTA, study-time bars, revision queue card.

**Learn**: search + shelf rows (Continue course, Syllabus progress via `/me/topic-progress`, Today's current affairs, Word of the day from `/vocabulary/practice`).

**Auth/Onboarding**: single-column, big inputs, stepper for onboarding (Category → Exams → Level), inline validation using `ApiError.body.details`.

## 6. Cross-cutting
- Haptics (`expo-haptics` via `npx expo install`) on option select, submit, streak complete.
- Reanimated for card press scale, ring fill, sheet transitions.
- Pull-to-refresh retained; optimistic bookmark/target toggles.
- Accessibility: ≥44pt targets, dynamic type-safe layouts, AA contrast in both themes.
- Offline: banner via `expo-network`; autosave already queued.

## 7. Delivery phases
1. **Foundation** — tokens, kit primitives, tab bar. ✅
2. **Home** redesign. ✅
3. Practice + Test intro + Result. ✅
4. Progress + Learn. ✅
5. Auth, onboarding, profile polish ✅; haptics ✅ (`src/lib/haptics.ts`, used in test window + onboarding); test window polish ✅ (timer amber <5 min / red <1 min, answered-progress strip, rounder options, elevated bottom bar).

### Also done
- Shared active-exam switcher (`src/features/exam/active-exam.tsx`, `ExamSwitcher`) used by Home, Practice, Progress and Learn; persisted on device.
- Reanimated motion: spring press on `Card`, animated `ProgressBar`, animated `ProgressRing` (react-native-svg) on Home streak and Result accuracy.
- Learn shelves: continue course, syllabus progress ring, word of the day, today's reading.
- Secondary screens restyled: exams, exam detail, live tests, leaderboard, subscription, pricing, help, mistakes, notifications (via `ScreenHeader`, `Card`, `Chip`, `Segmented`).

### Final pass
- Restyled the last screens: syllabus (per-subject progress, segmented levels), vocabulary (flashcards with progress + haptics), current affairs list/detail, course detail, checkout, security settings.
- Test palette is now an animated bottom sheet (spring slide-in, tap-outside to close, live Answered/Skipped/Review counts).

### Still open
- Nothing planned remains from this document. Next: device QA (iOS + Android), dark-mode contrast check, dynamic-type check, and EAS build.
