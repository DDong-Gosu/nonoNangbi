const { pickRandom: pickRandomItem } = require("../utils/random");

const TEST_MESSAGES = [
  "몽! Discord Webhook 연결 성공. 이제 기본 알림 통로는 열렸어. 다음엔 작은 작업 하나만 바로 닫자.",
  "몽이 확인 완료. Discord 알림 경로가 살아있어. 이제 사용량 신호를 받을 준비가 됐어.",
  "Discord 연결 성공. 몽이가 알림 보낼 길은 준비됐어. 다음 단계는 사용량을 안정적으로 읽는 것."
];

const EVENT_TEMPLATES = {
  recoveredShort: [
    "몽! {serviceName} 단기 한도가 100%로 회복됐어. 지금 {suggestedAction}.",
    "{serviceName} 단기 한도 다시 100%. 크게 벌리지 말고 {suggestedAction}.",
    "단기 한도 회복 확인. {serviceName}는 지금 바로 쓸 수 있어. {suggestedAction}.",
    "몽이가 알려줌. {serviceName} 단기 사용량이 꽉 찼어. {suggestedAction}.",
    "{serviceName} 단기 여유가 돌아왔어. 오늘은 완벽보다 {suggestedAction}.",
    "지금 {serviceName} 단기 한도 100%. 미루지 말고 {suggestedAction}.",
    "회복 완료. {serviceName} 단기 한도 100%야. {suggestedAction}.",
    "{serviceName} 단기 한도가 다시 열렸어. 작게 들어가서 {suggestedAction}.",
    "몽 체크. {serviceName} 단기 한도 100%. 지금은 {suggestedAction}.",
    "단기 사용 가능량이 돌아왔어. {serviceName}로 {suggestedAction}.",
    "{serviceName} 단기 한도 회복. 오늘의 목표는 크게 시작보다 {suggestedAction}.",
    "다시 쓸 수 있어. {serviceName} 단기 100%. {suggestedAction}.",
    "몽! {serviceName} 단기 회복 신호 잡힘. 지금 {suggestedAction}.",
    "{serviceName} 단기 한도가 찼어. 다음 진입은 가볍게 {suggestedAction}.",
    "단기 100% 확인. {serviceName}를 열고 {suggestedAction}."
  ],
  recoveredWeekly: [
    "{serviceName} 주간 한도 100%로 돌아왔어. 이번 주 결제분은 {suggestedAction}부터 산출물로 바꾸자.",
    "몽! {serviceName} 주간 한도 새로 열림. 첫 단추는 {suggestedAction}.",
    "주간 한도 회복 확인. {serviceName}로 {suggestedAction}부터 닫자.",
    "{serviceName} 주간 사용 가능량 100%. 이번 주는 {suggestedAction}으로 시작하자.",
    "새 주간 한도가 열렸어. {serviceName}에서 {suggestedAction}.",
    "몽이가 알려줌. {serviceName} 주간 한도 100%. 오늘은 {suggestedAction}.",
    "{serviceName} 주간 한도가 돌아왔어. 많이 하기보다 {suggestedAction}.",
    "주간 100% 확인. {serviceName} 결제분을 {suggestedAction}으로 바꾸자.",
    "{serviceName} 주간 한도 회복. 지금 바로 {suggestedAction}.",
    "이번 주 {serviceName} 사용 가능량이 새로 찼어. {suggestedAction}.",
    "몽 체크. {serviceName} 주간 한도 100%. 시작은 {suggestedAction}.",
    "{serviceName} 주간 한도가 비어 있지 않고 열려 있어. {suggestedAction}.",
    "새 주간 사이클 시작. {serviceName}로 {suggestedAction}.",
    "{serviceName} 주간 100%. 큰 목표보다 먼저 {suggestedAction}.",
    "주간 한도 회복 신호. {serviceName}를 열고 {suggestedAction}."
  ],
  sessionStopped: [
    "{serviceName} 사용이 멈춘 것 같아. 단기 {remainingShortWindowPercent}%, 주간 {remainingWeeklyPercent}% 남음. 다음엔 {suggestedAction}.",
    "몽 체크. {serviceName} 세션은 멈춘 듯. 남은 한도는 단기 {remainingShortWindowPercent}%, 주간 {remainingWeeklyPercent}%. {suggestedAction}.",
    "{idleMinutes}분째 변화가 없어. {serviceName} 남은 한도 확인하고 {suggestedAction}.",
    "방금 흐름은 여기서 끊긴 듯해. {serviceName} 단기 {remainingShortWindowPercent}%. 다음 진입은 {suggestedAction}.",
    "세션 종료로 볼게. {serviceName} 주간 {remainingWeeklyPercent}% 남음. 다시 들어갈 때 {suggestedAction}.",
    "몽이가 정리함. {serviceName} 사용이 멈췄어. 다음 시작 전에 {suggestedAction}.",
    "{serviceName} 변화 없음 {idleMinutes}분. 남은 한도를 기억하고 {suggestedAction}.",
    "멈춘 타이밍 잡았어. {serviceName} 단기 {remainingShortWindowPercent}%, 주간 {remainingWeeklyPercent}%. {suggestedAction}.",
    "오늘 세션은 잠깐 닫힌 듯해. {serviceName} 다음 진입은 {suggestedAction}.",
    "사용 흐름이 멈췄어. {serviceName} 남은 주간 {remainingWeeklyPercent}%. {suggestedAction}.",
    "몽 체크인. {serviceName} 세션 정지. 다음엔 큰 기능 말고 {suggestedAction}.",
    "{idleMinutes}분 동안 그대로야. {serviceName}를 다시 열기 전 {suggestedAction}.",
    "세션 요약. {serviceName} 단기 {remainingShortWindowPercent}%, 주간 {remainingWeeklyPercent}%. 다음은 {suggestedAction}.",
    "멈춘 건 괜찮아. 대신 다음 진입이 쉬워야 해. {serviceName}에서 {suggestedAction}.",
    "{serviceName} 사용 종료로 판단. 남은 한도는 충분히 확인됨. {suggestedAction}."
  ],
  weeklyIdle: [
    "{serviceName} 주간 한도가 아직 100%야. 이건 여유가 아니라 미사용이야. {suggestedAction}.",
    "몽. {serviceName} 주간 100%가 유지 중이야. 결제분을 {suggestedAction}으로 바꾸자.",
    "{serviceName} 주간 사용량이 그대로야. 오늘은 {suggestedAction}.",
    "주간 한도가 전혀 줄지 않았어. {serviceName}로 {suggestedAction}.",
    "{reminderHours}시간 넘게 {serviceName} 주간 한도가 100%야. 지금 {suggestedAction}.",
    "몽이가 살짝 찌름. {serviceName} 주간 한도 100%. {suggestedAction}.",
    "{serviceName} 결제분이 아직 산출물로 안 바뀌는 중이야. {suggestedAction}.",
    "주간 100%는 좋은 소식이면서 경고야. {serviceName}로 {suggestedAction}.",
    "{serviceName} 주간 한도가 계속 가만히 있어. 작게라도 {suggestedAction}.",
    "몽 체크. {serviceName} 주간 100%. 오늘은 {suggestedAction}.",
    "이번 주 {serviceName}를 아직 충분히 못 쓴 흐름이야. {suggestedAction}.",
    "한도가 남아 있는 건 기회야. {serviceName}에서 {suggestedAction}.",
    "{serviceName} 주간 한도 100% 유지. 지금은 아끼는 시간보다 {suggestedAction}.",
    "주간 사용 가능량이 그대로야. {serviceName}로 {suggestedAction}.",
    "몽. {serviceName} 주간 한도 방치 신호. {suggestedAction}.",
    "{serviceName} 주간 한도를 산출물로 바꿀 시간. 먼저 {suggestedAction}.",
    "아직 {serviceName} 주간 100%. 부담 키우지 말고 {suggestedAction}.",
    "결제분이 기다리고 있어. {serviceName}를 열고 {suggestedAction}.",
    "{serviceName} 주간 사용량이 안 움직였어. 오늘은 {suggestedAction}.",
    "몽이가 확인함. {serviceName} 주간 한도 그대로. {suggestedAction}.",
    "지금은 크게 달릴 필요 없어. {serviceName}로 {suggestedAction}.",
    "{serviceName} 주간 100% 유지 중. 작은 산출물 하나로 {suggestedAction}.",
    "이번 주 흐름을 만들자. {serviceName}에서 {suggestedAction}.",
    "주간 한도 방치가 길어지고 있어. {serviceName}로 {suggestedAction}.",
    "{serviceName} 주간 한도가 열려 있어. 지금 {suggestedAction}."
  ],
  parseFailureDigest: [
    "몽 진단. {serviceName} 사용량을 계속 못 읽고 있어. Chrome에서 usage page를 열고 {suggestedAction}.",
    "{serviceName} 파싱 실패가 반복됐어. 로그인 세션이나 페이지 구조를 확인하고 {suggestedAction}.",
    "사용량 진단 필요. {serviceName} 값을 못 읽는 중이야. 먼저 {suggestedAction}.",
    "몽 체크. {serviceName} 사용량 읽기가 막혔어. CDP Chrome에서 페이지를 확인하고 {suggestedAction}.",
    "{serviceName} diagnostic. 파싱 실패가 쌓였어. usage page가 보이는지 보고 {suggestedAction}."
  ],
  cdpUnreachableDigest: [
    "몽 진단. Chrome CDP에 연결할 수 없어. Chrome을 CDP 모드로 열고 {suggestedAction}.",
    "CDP 연결이 끊겼어. port 9222 Chrome을 확인하고 {suggestedAction}.",
    "사용량 확인 전에 Chrome CDP가 필요해. Chrome을 다시 열고 {suggestedAction}.",
    "몽 체크. CDP Chrome이 안 잡혀. `npm run chrome:command` 확인 후 {suggestedAction}.",
    "Chrome CDP 연결 실패. 브라우저가 열려 있는지 확인하고 {suggestedAction}."
  ]
};

const EVENT_TYPE_TO_CATEGORY = {
  recovered_short: "recoveredShort",
  recovered_weekly: "recoveredWeekly",
  session_stopped: "sessionStopped",
  weekly_idle: "weeklyIdle",
  parse_failure_digest: "parseFailureDigest",
  cdp_unreachable_digest: "cdpUnreachableDigest"
};

const SUGGESTED_ACTIONS = [
  "25분만 열기",
  "버그 하나만 잡기",
  "README 한 문단 정리",
  "다음 phase spec 하나 쓰기",
  "배포 로그 하나 확인",
  "막힌 지점 하나만 메모",
  "작은 PR 단위로 닫기"
];

function pickRandom(items) {
  return pickRandomItem(items);
}

function interpolateTemplate(template, variables = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      return match;
    }

    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function getTestMessage() {
  return pickRandom(TEST_MESSAGES);
}

function getEventMessage(event, variables = {}) {
  const category = EVENT_TYPE_TO_CATEGORY[event.type];

  if (!category || !EVENT_TEMPLATES[category]) {
    throw new Error(`No message templates for event type: ${event.type}`);
  }

  const now = event.occurredAt ? new Date(event.occurredAt) : new Date();
  const template = pickRandom(EVENT_TEMPLATES[category]);
  const mergedVariables = {
    suggestedAction: pickRandom(SUGGESTED_ACTIONS),
    time: now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    date: now.toLocaleDateString("ko-KR"),
    idleMinutes: event.idleMinutes,
    reminderHours: event.reminderHours,
    serviceName: event.serviceName,
    remainingShortWindowPercent: event.remainingShortWindowPercent,
    remainingWeeklyPercent: event.remainingWeeklyPercent,
    rawShortWindowPercent: event.rawShortWindowPercent,
    rawWeeklyPercent: event.rawWeeklyPercent,
    ...variables
  };

  return interpolateTemplate(template, mergedVariables);
}

module.exports = {
  EVENT_TEMPLATES,
  getEventMessage,
  getTestMessage,
  pickRandom,
  interpolateTemplate
};
