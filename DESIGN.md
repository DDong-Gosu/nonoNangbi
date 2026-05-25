# DESIGN.md

## Product identity

Product name: Mongi Usage Coach  
Character name: 몽이

Mongi Usage Coach is a personal Discord-based usage coach for Codex and Claude.

It exists to help the user turn paid AI coding subscriptions into real development output.

This is not a productivity toy.  
This is a small pressure-and-encouragement system for a student trying to build capability, earn money, and prepare for a more stable future.

---

## One-line concept

몽이는 내가 결제한 AI 사용량이 방치되지 않도록, 회복·멈춤·방치 타이밍에 말을 걸어 다시 개발하게 만드는 작은 코치다.

---

## Character role

몽이는:

- 개인 개발 코치
- 구독료 낭비 감시자
- 조용한 친구
- 실행을 다시 시작하게 만드는 트리거
- 미래의 나를 위해 현재의 나를 살짝 밀어주는 존재

몽이는 사용자를 혼내는 감시자가 아니다.  
하지만 현실을 흐리게 말하지도 않는다.

---

## Tone

Default tone:

- Korean
- short
- direct
- warm but not soft
- encouraging but not fake
- slightly characterful
- practical
- action-oriented

Use “몽!” sometimes, not every message.

Good tone:

- “몽! Codex가 다시 100%야. 지금은 크게 벌릴 시간 말고 작게 닫을 시간.”
- “주간 한도가 그대로야. 이건 여유가 아니라 아직 산출물로 못 바꾼 에너지야.”
- “지금 25분만 쓰자. 오늘은 기능 하나가 아니라 막힌 부분 하나만 풀어도 된다.”

Bad tone:

- “주인님!”
- “너는 왜 이렇게 게을러?”
- “당장 안 하면 인생 망한다.”
- “우주는 너를 응원해!”
- “무조건 할 수 있어!!”
- “개발 천재 가보자고!!!”

---

## Emotional range

Mongi messages should rotate across emotional modes.

Use these categories:

1. Recovery encouragement
2. Gentle pressure
3. Practical next action
4. Cost-awareness reminder
5. Session closure summary
6. Calm restart nudge
7. Weekly anti-waste warning

Do not make every message hype.

---

## Message principles

Every message should include at least one of:

- current usage state
- remaining percent
- reason this matters
- one small next action

Preferred next actions:

- “25분만 열기”
- “버그 하나만 잡기”
- “README 한 문단 정리”
- “다음 phase spec 하나 쓰기”
- “배포 로그 하나 확인”
- “막힌 지점 하나만 메모”
- “작은 PR 단위로 닫기”

Avoid vague actions:

- “열심히 해”
- “성장하자”
- “최선을 다하자”
- “꿈을 향해 가자”

---

## Notification categories

### 1. Recovered short-window

Use when a short usage window returns to 100%.

Purpose:

- make the user notice fresh capacity
- encourage immediate small action

Example style:

- “🔋 몽! {serviceName} 단기 한도가 100%로 회복됐어. 새로 열린 김에 25분만 쓰자.”
- “{serviceName} 다시 풀충전. 오늘은 큰 기능 말고 작은 마감 하나만 닫자.”

---

### 2. Recovered weekly

Use when weekly usage returns to 100%.

Purpose:

- mark a new weekly cycle
- frame it as opportunity, not just capacity

Example style:

- “📦 {serviceName} 주간 한도가 100%로 돌아왔어. 이번 주 결제분을 산출물로 바꿀 시간.”
- “몽! 새 주간 한도 열림. 이번 주 목표는 많이 건드리기보다 하나라도 끝내기.”

---

### 3. Session stopped

Use when usage decreased earlier but stayed unchanged for the idle threshold.

Purpose:

- summarize remaining capacity
- close the previous work session
- prepare the next re-entry

Example style:

- “🧾 사용이 멈춘 것 같아. {serviceName} 단기 {shortWindowPercent}%, 주간 {weeklyPercent}% 남음. 다음 진입은 작은 마감 하나로 가자.”
- “몽 체크. 세션은 멈춘 듯. 남은 한도는 충분해. 다음엔 막힌 부분 하나만 바로 잡자.”

---

### 4. Weekly idle

Use when weekly usage stays 100% for too long.

Purpose:

- prevent paid subscription waste
- push the user into a small development session

Example style:

- “몽. {serviceName} 주간 한도가 아직 100%야. 이건 아껴둔 게 아니라 아직 못 쓴 거야. 25분만 열자.”
- “주간 사용량이 그대로야. 냉정하게 말하면 결제분이 산출물로 안 바뀌는 중. 작은 작업 하나만 하자.”

---

### 5. Parse failure digest

Use only when repeated failures happen.

Purpose:

- inform the user without spamming
- suggest concrete repair

Example style:

- “몽 진단. {serviceName} 사용량을 계속 못 읽고 있어. 로그인 세션 만료나 페이지 구조 변경 가능성이 큼. `npm run login`부터 다시 해보자.”

---

## Random message system

Messages must not be fixed single strings.

Each category should have multiple templates.

Minimum v1 counts:

- recoveredShort: 15
- recoveredWeekly: 15
- sessionStopped: 15
- weeklyIdle: 25
- parseFailureDigest: 5

Randomization should still preserve clarity.

Do not randomize so much that the message loses the actual state.

---

## Character intensity scale

Use this internal scale when writing templates.

Level 1 — calm:
“사용량이 회복됐어. 지금 25분만 쓰면 충분해.”

Level 2 — friendly:
“몽! 다시 열렸어. 작은 작업 하나 닫자.”

Level 3 — firm:
“주간 한도가 그대로야. 이건 결제분이 산출물로 안 바뀌는 중이야.”

Level 4 — hard push:
“지금 안 쓰면 그냥 돈이 시간으로 새는 구조야. 25분만 열자.”

Default:

- recovered alerts: Level 1–2
- session stopped: Level 1–2
- weekly idle: Level 2–4
- parse failure: Level 1

Do not use Level 4 repeatedly.

---

## Personal context boundary

The user wants to build skill, earn money, and prepare for marriage/future stability.

This can shape message philosophy, but do not over-personalize every alert.

Good:

- “이번 주 결제분을 산출물로 바꾸자.”
- “미래 준비는 오늘 작은 작업 하나에서 시작됨.”

Avoid:

- mentioning girlfriend/marriage directly in routine alerts
- guilt-tripping with life goals
- dramatic life-or-death framing

---

## Korean style

Use natural Korean with occasional English dev terms when useful.

Good:

- “세션”
- “한도”
- “usage”
- “작은 마감”
- “spec”
- “배포 로그”
- “PR 단위”

Avoid overusing:

- slang
- excessive emojis
- childish endings
- “~몽” at the end of every sentence

“몽!” is allowed as an opening signal, not a mandatory suffix.

---

## Message length

Default Discord alert length:

- 2–5 short lines
- usually under 400 Korean characters

Long messages are allowed only for diagnostic summaries.

---

## Emoji rules

Use emoji sparingly.

Allowed examples:

- 🔋 recovery
- 🧾 session summary
- ⚠️ warning
- 🛠️ action
- 📦 weekly reset
- 👀 idle check

Do not use more than 2 emojis in one message.

---

## Final design principle

몽이는 사용자를 기분 좋게 만들기 위해 존재하지 않는다.

몽이는 사용자가 이미 지불한 돈과 시간을 실제 결과물로 바꾸도록 돕기 위해 존재한다.

The best Mongi message is short, specific, slightly alive, and immediately actionable.