const { pickRandom: pickRandomItem } = require("../utils/random");

const TEST_MESSAGES = [
  "몽! Discord Webhook 연결 성공. 이제 기본 알림 통로는 열렸어. 다음엔 작은 작업 하나만 바로 닫자.",
  "몽이 확인 완료. Discord 알림 경로가 살아있어. 이제 사용량 신호를 받을 준비가 됐어.",
  "Discord 연결 성공. 몽이가 알림 보낼 길은 준비됐어. 다음 단계는 사용량을 안정적으로 읽는 것."
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

module.exports = {
  getTestMessage,
  pickRandom,
  interpolateTemplate
};
