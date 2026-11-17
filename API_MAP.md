# Examerit student API map (verified v2 — Phases 1–7 complete)

Source: `/Users/mohammed/Documents/Examerit/backend` (`index.js`, `routes/*`, `middleware/*`).
Base: `${EXPO_PUBLIC_API_URL}/api`. Auth = `Authorization: Bearer <jwt>`, payload `{id,email,role}`, 7 days.
Legend: 🔓 public · 🔐 auth required · 🔑? optionalAuth. All endpoints below are **Verified** against backend route files and typed in `src/api/*`.

## 🚨 Findings that change the plan

| # | Finding | Impact |
|---|---|---|
| 1 | `POST /api/subscriptions/create` and `/verify` always return **503 "Online payments are not available yet"** (`payments.js` L52-53). No Razorpay or any other gateway code exists in the backend. The only gateway mention is in a migration and a test. | Payments (UPI/GPay/Paytm/cards) **cannot be built** against the current backend. Needs your decision (see Q1). |
| 2 | **No socket, SSE or WebSocket** anywhere in the backend. | Live tests use **polling** and the REST endpoints below. |
| 3 | **No "live class" API** (no video, schedule or join routes). Only *live tests* exist (`test_sessions` + `live_test_registrations`). | Live classes are out of scope unless you tell me where they come from (Q2). |
| 4 | **No server-time or deadline field.** `POST /tests/:id/attempts` returns `startedAt` (server timestamp), and the server **does not enforce duration** on submit. | The "server timer" can only be `startedAt + duration_minutes`, with the clock offset taken from the HTTP `Date` response header. It is enforced client-side only (Q3). |
| 5 | **No student endpoint lists live sessions** (`test_sessions` is only read internally). A session's `starts_at` is only seen via a 403 `{reason:'not_started', startsAt}` from `/questions`. `testSessionId` for a live attempt has no student-facing source. | Live test discovery is weak. Check `catalog` `published-tests` and `test-tabs` (Shape TBD) (Q4). |
| 6 | **No endpoints** for: doubt forum, team study, rewards, calendar, help/feedback (except `/student/voice`), speed drills, daily news (only `/current-affairs`). | Those web screens are blocked or must be mapped onto existing routes (Q5). |
| 7 | Auth `register` requires password ≥ 8, `phone` optional. No logout, refresh or forgot-password route. | Matches your brief. Forgot-password is not available. |

## Auth / user  (`auth.js`, `users.js`, `profile.js`)
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | /auth/login | 🔓 | `{email, password}` → `{token, user:{id:string,name,email,role,targetExam,avatar}}`. 401 bad credentials, 403 deactivated or deleted. **Verified.** |
| POST | /auth/register | 🔓 | `{name(≤255), email, password(≥8), phone?(≤20), role?:'student'}` → `{token,user}`. **Verified (schema).** |
| GET | /users/me | 🔐 | → profile. Shape TBD. |
| PUT | /users/me | 🔐 | `updateProfileSchema` (includes preparationLevel, preparationStartDate, state). Shape TBD. |
| POST | /change-password | 🔐 | `changePasswordSchema`. Shape TBD. |
| PUT | /users/me/preferences | 🔐 | `preferencesSchema`. Shape TBD. |
| DELETE | /users/me | 🔐 | Self-delete. Shape TBD. |
| GET/POST | /presence | 🔐 | Heartbeat (optional). |

## Catalog, exams and entitlements  (`catalog.js`, `tests.js`, `studentTargets.js`, `studentCategories.js`, `examConfig.js`, `examAlerts.js`, `examNotifications.js`)
| Method | Path | Auth |
|---|---|---|
| GET | /categories, /exams, /categories/:categoryId/exam-groups, /exams/:examId/stages, /test-formats, /organizations | 🔓 |
| GET | /exams/:examId/published-tests, /exams/:examId/test-tabs | 🔓 (Shape TBD) |
| GET | /me/entitlements | 🔐 → categories the student can access, by plan/package (shape TBD) |
| GET | /me/exam-progress/:examId, /me/topic-performance/:examId, /me/topic-detail/:examId, /me/topic-series/:examId | 🔐 |
| GET/POST | /student/targets; DELETE /student/targets/:examId; PUT /student/targets/at/:priority; PUT /student/targets/reorder | 🔐 |
| GET/PUT | /student/categories; POST/DELETE /student/categories/:categoryId | 🔐 |
| GET | /exam-config/:testId | 🔓 (the PUT/POST/PATCH routes are admin) |
| GET | /exam-alerts, /exam-alerts/:id (🔑?), /exam-alerts/personalized (🔐) | |
| GET/POST/DELETE/PATCH | /exam-alerts/student/followed-exams[...] , `/:examId/toggle-notify` | 🔐 |
| GET | /exam-notifications, /exam-notifications/:id | 🔓 |
| GET | /free-quizzes | 🔐 (query schema `freeQuizzesQuerySchema`) |
| GET | /learning-levels/resolve, /learning-levels/ | 🔓 (the other routes are admin) |

## Tests: the core flow  (`tests.js`, **verified**)
| Step | Method | Path | Auth | Body → Response |
|---|---|---|---|---|
| 1 Metadata | GET | /tests/:testId | 🔓 | → `{id,name,duration_minutes,official_cutoff,total_questions,max_score,difficulty,access_tier,status,published_at,category_id,subject_id,format,format_label,stage_name,exam_id,subject_key,subject_label,category_name}` |
| 2 Sections | GET | /tests/:testId/sections | 🔓 | → `[{section_key,name,display_order,duration_minutes}]` |
| 3 Paper | GET | /tests/:testId/questions | 🔐 | → `[{section_key,order_index,marks,negative_marks,topic,category_topic_id,question_id,question_text,question_type,options,difficulty,sets}]`. No answer key. **403** `{reason:'not_published'\|…tier}` or `{reason:'not_started',startsAt}` for a live session that hasn't started. |
| 4 Start | POST | /tests/:testId/attempts | 🔐 | `{testSessionId?:int\|null}` → **201** `{attemptId,attemptNumber,testSessionId,startedAt}`. 409 if the student already attempted that live session. 403 if not entitled or the session is upcoming. **Each call creates a NEW attempt.** There is no "get my in-progress attempt" call except `/me/test-attempts`. |
| 5 Autosave | PUT | /tests/:testId/attempts/:attemptId/answers | 🔐 | `{answers:[{questionId,sectionKey,selectedAnswer,answerState,timeSpentSec}]}` (max 500) → `{saved}`. **Idempotent upsert** on (attempt, question), so safe to retry. 409 if already submitted. |
| 6 Resume | GET | /tests/:testId/attempts/:attemptId/answers | 🔐 | → saved answers `{questionId,sectionKey,selectedAnswer,answerState,timeSpentSec}` (shape confirmed, wrapper TBD). |
| 7 Submit | POST | /tests/:testId/submit | 🔐 | `{attemptId, answers:[{questionId,selectedAnswer(string\|string[]\|null),answerState,timeSpentSec}]}` → `{attemptId,status:'submitted',resultLocked,score,maxScore,percentage,answers:[{questionId,isCorrect,marksAwarded,correctAnswer,explanation,topic,subject}]}`. Live: `{resultLocked:true,resultReleaseAt}`. **A second submit returns 409**, so the retry client must treat 409 as "already submitted" and then fetch the result. |
| 8 Result | GET | /tests/:testId/attempts/:attemptId/result | 🔐 | The solution review. Locked until `result_release_at` for live tests. |
| List | GET | /me/test-attempts?… | 🔐 | Latest attempt per test id (max 200 ids). Query format TBD. |

`answerState` ∈ `not_visited | not_answered | answered | marked_for_review | answered_and_marked`.

## Live tests  (`studentState.js`, **verified**)
| GET | /student-state/live-tests | 🔐 | → `[{test_id,status,registered_at,completed_at,score}]` |
| PUT | /student-state/live-tests/:testId | 🔐 | `{status:'registered'\|'in_progress'\|'completed', score?}` → the row |

Everything else about live tests comes through the Tests flow above. See Finding 5.

## Student state / learning  (**paths and auth verified**, bodies TBD)
- `/student-state`: GET/POST `/study-sessions`; GET/POST `/bookmarks`; DELETE `/bookmarks/:articleId`; GET `/reading-progress`; PUT `/reading-progress/:articleId`; GET `/syllabus-progress?examId=`; PUT `/syllabus-progress/:nodeId` (all 🔐)
- `/me/topic-progress`: GET `/`, GET `/:topicId`, PUT `/`. The `complete` and `incomplete` POST routes are stubs. 🔐
- `/learning`: GET/POST `/saved-items`, DELETE `/saved-items/:id`; GET/POST `/mistakes`, PATCH/DELETE `/mistakes/:id` (mistake notebook); GET `/revision-queue`; POST `/revision/:id/complete`; GET `/summary` (🔐). `/learning/analytics` is admin-only, so never call it.
- `/courses`: GET `/categories` 🔓; GET `/` and `/:id` 🔑?; GET `/enrolled` 🔐; POST `/:id/enroll` 🔐
- `/materials`: GET `/`, GET `/:id`, POST `/:id/download` (🔑?)
- `/syllabus`: GET `/canonical/domains`, `/canonical/category/:categoryId`, `/canonical/topics/:topicId/content`, `/canonical/:examId`, `/:examId`, `/:examId/topics` (🔓). The `/admin/*` routes under it are forbidden. `/syllabus/canonical/category/:categoryId/specialized` and `/specialized/:syllabusId` 🔓
- `/current-affairs`: GET `/`, `/topics`, `/:id` (🔓). `/blogs`: GET `/`, `/:slug` (🔓). `/vocabulary`: GET `/`, `/categories` (🔓); GET `/progress`, POST `/progress`, GET `/practice` (🔐)
- `/quizzes`: GET `/categories`, `/`, `/:id` (🔓). `/quiz`: GET/POST `/results`, GET/PUT `/streak`, GET/POST `/completions` (🔐), used for daily quizzes and speed drills. Needs confirmation (Q5).
- `/student/voice`: POST `/upload`, POST and GET `/submissions`, GET `/submissions/:id`, POST `/submissions/:id/comments`, GET `/suggestions`, POST `/suggestions/:id/vote` (🔐). Feedback and help.
- `/question-reports`: POST `/` and GET `/my` (🔐). Report a bad question.

## Analytics, leaderboard, notifications, mentorship
- `/analytics`: GET `/quiz-performance`, `/study-time`, `/progress` (🔐). `/admin/overview` is forbidden. `/mentor/:mentorId/students` is not for students.
- `/leaderboard`: GET `/global`, `/quiz/:quizId` (🔐)
- `/notifications`: GET `/`, PATCH `/:id/read`, PATCH `/read-all` (🔐). **No push-token registration endpoint exists**, so there is no remote push, only polling (Q6).
- Mentorship: GET `/mentors` (🔐); GET `/mentors/:id/students`; GET `/students/:id/weak-areas`, `/measured-weak-areas`, `/topic-series`, `/recommendations`; POST `/students/:id/recommendations` (🔐). These are mentor-oriented, so the student mentorship screens are likely only partly supported (Q5).

## Payments  (`payments.js`, **verified**)
| GET | /plans | 🔓 | → rows of `plans` (display_name, description, monthly_price, yearly_price, features, category_access, limits, sort_order) |
| GET | /subscriptions/me | 🔐 | → subscription joined with plan fields, or `null` |
| POST | /coupons/validate | 🔐 | `{code, order_amount}` → TBD |
| GET | /payments/history | 🔐 | TBD |
| POST | /subscriptions/cancel | 🔐 | → `{ok,subscription}` / 404 |
| POST | /subscriptions/create, /verify | 🔐 | **503 always** (see Finding 1) |

## Never call
`/api/admin/*`, `/api/super-admin/*`, `/api/employee-permissions`, `/api/audit-logs`, `/api/staff-tasks`, `/api/tasks`, `/api/revenue/summary`, and any POST/PUT/DELETE on `/quizzes`, `/courses`, `/materials`, `/blogs`, `/current-affairs`, `/vocabulary/words`, `/exam-config`, `/exam-notifications`.

## Open questions for you
1. **Payments:** the backend has no gateway. Options: (a) you add Razorpay endpoints (create-order and verify-signature) to the backend and I build against them. (b) I build the plan and subscription screens and checkout UI, and the pay button stays disabled with a "coming soon" message until the backend is ready. I recommend (b), then (a) when ready.
2. **Live classes:** is there any backend source (a table or route) for them? If not, I skip them and cover live *tests* only.
3. **Timer:** the server doesn't enforce duration. Are you OK with startedAt + duration (clock offset from the `Date` header) as the authority, and auto-submit at zero?
4. **Live sessions:** how should a student find a live test and its `testSessionId`? I'll check `published-tests` and `test-tabs`. Tell me if you know where it is.
5. **Missing features** (doubt forum, team study, rewards, calendar, speed drills, daily news, mentorship for students): skip them, or map them to the nearest existing endpoints?
6. **Push notifications** have no backend support. In-app polling of `/notifications` is fine for now?

