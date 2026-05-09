const STORAGE_KEY = "mental-math-pwa-state-v7";
const REVIEW_INTERVALS_MS = [
  30 * 1000,
  2 * 60 * 1000,
  10 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];
const MAX_HISTORY = 600;
const MAX_MISTAKES = 20;
const AUTO_SUBMIT_DELAY_MS = 220;

const RANGE_OPTIONS = {
  within10Random: { label: "10以内随机", limit: 10, oddEven: false },
  within20Random: { label: "20以内随机", limit: 20, oddEven: false },
  within20OddEven: { label: "20以内单双", limit: 20, oddEven: true },
  within30Random: { label: "30以内随机", limit: 30, oddEven: false },
  within30OddEven: { label: "30以内单双", limit: 30, oddEven: true },
};

const OPERATION_OPTIONS = {
  random: { label: "随机" },
  addition: { label: "加法" },
  subtraction: { label: "减法" },
  multiplication: { label: "乘法" },
};

const FILTER_LABELS = {
  "result-0": "结果为0",
  "result-1": "结果为1",
  "result-2": "结果为2",
  "addend-0": "加数为0",
  "addend-1": "加数为1",
  "addend-2": "加数为2",
  "subtrahend-0": "减数为0",
  "subtrahend-1": "减数为1",
  "subtrahend-2": "减数为2",
  "multiplier-0": "乘数/被乘数为0",
  "multiplier-1": "乘数/被乘数为1",
  "multiplier-2": "乘数/被乘数为2",
  "multiplier-3": "乘数/被乘数为3",
};

const defaultState = {
  settings: {
    range: "within10Random",
    operation: "random",
    fixedNumber: "none",
    reviewMode: "all",
    filters: [],
  },
  stats: {
    totalAnswered: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    totalTimeMs: 0,
    lastResult: "未作答",
  },
  currentProblem: null,
  currentInput: "",
  isRunning: false,
  factProgress: {},
  mistakes: [],
  history: [],
  historySort: {
    key: "timestamp",
    order: "desc",
  },
  referenceView: "within10",
  todayReview: [],
};

const elements = {
  toggleRunButton: document.querySelector("#toggleRunButton"),
  nextQuestionButton: document.querySelector("#nextQuestionButton"),
  panelNav: document.querySelector("#panelNav"),
  panelBackdrop: document.querySelector("#panelBackdrop"),
  closePanelButton: document.querySelector("#closePanelButton"),
  panelTitle: document.querySelector("#panelTitle"),
  questionModeLabel: document.querySelector("#questionModeLabel"),
  liveTimerValue: document.querySelector("#liveTimerValue"),
  lastResultValue: document.querySelector("#lastResultValue"),
  accuracyValue: document.querySelector("#accuracyValue"),
  avgTimeValue: document.querySelector("#avgTimeValue"),
  streakValue: document.querySelector("#streakValue"),
  sessionSummary: document.querySelector("#sessionSummary"),
  questionLeft: document.querySelector("#questionLeft"),
  questionOperator: document.querySelector("#questionOperator"),
  questionRight: document.querySelector("#questionRight"),
  answerDisplay: document.querySelector("#answerDisplay"),
  focusHint: document.querySelector("#focusHint"),
  feedbackMessage: document.querySelector("#feedbackMessage"),
  keypad: document.querySelector("#keypad"),
  rangeGroup: document.querySelector("#rangeGroup"),
  operationGroup: document.querySelector("#operationGroup"),
  fixedNumberGroup: document.querySelector("#fixedNumberGroup"),
  reviewModeGroup: document.querySelector("#reviewModeGroup"),
  filterGroup: document.querySelector("#filterGroup"),
  fixedNumberHint: document.querySelector("#fixedNumberHint"),
  reviewList: document.querySelector("#reviewList"),
  generateReviewButton: document.querySelector("#generateReviewButton"),
  correctCountValue: document.querySelector("#correctCountValue"),
  wrongCountValue: document.querySelector("#wrongCountValue"),
  mistakeBankValue: document.querySelector("#mistakeBankValue"),
  slowFactValue: document.querySelector("#slowFactValue"),
  resetStatsButton: document.querySelector("#resetStatsButton"),
  clearMistakesButton: document.querySelector("#clearMistakesButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  historyTableBody: document.querySelector("#historyTableBody"),
  referenceButtons: document.querySelector("#referenceButtons"),
  referenceContent: document.querySelector("#referenceContent"),
  panelSections: [...document.querySelectorAll(".panel-section[data-panel-section]")],
};

const PANEL_TITLES = {
  review: "复习",
  history: "历史",
  reference: "口诀",
  settings: "设置",
};

const state = loadState();
let problemBank = [];
let timerHandle = 0;
let lastProblemId = "";
let autoSubmitHandle = 0;
let nextProblemHandle = 0;
let isAnswerLocked = false;
let activePanel = "settings";
let isPanelOpen = false;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) {
      return cloneDefaultState();
    }

    const savedProblem =
      saved.currentProblem && typeof saved.currentProblem === "object"
        ? {
            ...saved.currentProblem,
            shownAt: null,
            elapsedBeforePauseMs: 0,
          }
        : null;

    return {
      settings: {
        ...defaultState.settings,
        ...saved.settings,
        filters: Array.isArray(saved.settings?.filters) ? saved.settings.filters : [],
      },
      stats: { ...defaultState.stats, ...saved.stats },
      currentProblem: savedProblem,
      currentInput: typeof saved.currentInput === "string" ? saved.currentInput : "",
      isRunning: false,
      factProgress:
        saved.factProgress && typeof saved.factProgress === "object" ? saved.factProgress : {},
      mistakes: Array.isArray(saved.mistakes) ? saved.mistakes : [],
      history: Array.isArray(saved.history) ? saved.history : [],
      historySort: { ...defaultState.historySort, ...saved.historySort },
      referenceView:
        typeof saved.referenceView === "string"
          ? saved.referenceView
          : defaultState.referenceView,
      todayReview: Array.isArray(saved.todayReview) ? saved.todayReview : [],
    };
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearPendingNextProblem() {
  if (nextProblemHandle) {
    window.clearTimeout(nextProblemHandle);
    nextProblemHandle = 0;
  }
}

function clearAutoSubmit() {
  if (autoSubmitHandle) {
    window.clearTimeout(autoSubmitHandle);
    autoSubmitHandle = 0;
  }
}

function releaseAnswerLock() {
  isAnswerLocked = false;
}

function getAllowedOperations() {
  if (state.settings.operation === "random") {
    return ["addition", "subtraction", "multiplication"];
  }
  return [state.settings.operation];
}

function buildProblemBank() {
  const rangeRule = RANGE_OPTIONS[state.settings.range];
  const bank = [];
  const limit = rangeRule.limit;
  const operations = getAllowedOperations();

  for (const operation of operations) {
    if (operation === "addition") {
      for (let left = 0; left <= limit; left += 1) {
        for (let right = 0; right <= limit; right += 1) {
          const problem = makeProblem(left, right, operation);
          if (isProblemAllowed(problem, rangeRule)) {
            bank.push(problem);
          }
        }
      }
    } else if (operation === "subtraction") {
      for (let left = 0; left <= limit; left += 1) {
        for (let right = 0; right <= limit; right += 1) {
          if (left < right) {
            continue;
          }
          const problem = makeProblem(left, right, operation);
          if (isProblemAllowed(problem, rangeRule)) {
            bank.push(problem);
          }
        }
      }
    } else {
      for (let left = 0; left <= limit; left += 1) {
        for (let right = 0; right <= limit; right += 1) {
          const problem = makeProblem(left, right, operation);
          if (isProblemAllowed(problem, rangeRule)) {
            bank.push(problem);
          }
        }
      }
    }
  }

  return bank;
}

function makeProblem(left, right, operation) {
  const operator = operation === "addition" ? "+" : operation === "subtraction" ? "-" : "×";
  const answer =
    operation === "addition"
      ? left + right
      : operation === "subtraction"
        ? left - right
        : left * right;
  return {
    id: `${operation}-${left}-${right}`,
    left,
    right,
    operator,
    operation,
    answer,
  };
}

function isProblemAllowed(problem, rangeRule) {
  if (rangeRule.oddEven) {
    const oneOddOneEven = isOdd(problem.left) !== isOdd(problem.right);
    if (!oneOddOneEven) {
      return false;
    }
  }

  if (!matchesFixedNumber(problem)) {
    return false;
  }

  return !isFiltered(problem);
}

function isOdd(value) {
  return Math.abs(value % 2) === 1;
}

function matchesFixedNumber(problem) {
  if (state.settings.fixedNumber === "none") {
    return true;
  }

  const fixed = Number(state.settings.fixedNumber);
  if (problem.operation === "subtraction") {
    return problem.left === fixed;
  }
  return problem.left === fixed || problem.right === fixed;
}

function isFiltered(problem) {
  const filters = new Set(state.settings.filters);
  if (filters.has(`result-${problem.answer}`)) {
    return true;
  }

  if (problem.operation === "addition") {
    if (filters.has(`addend-${problem.left}`) || filters.has(`addend-${problem.right}`)) {
      return true;
    }
  }

  if (problem.operation === "subtraction") {
    if (filters.has(`subtrahend-${problem.right}`)) {
      return true;
    }
  }

  if (problem.operation === "multiplication") {
    if (
      filters.has(`multiplier-${problem.left}`) ||
      filters.has(`multiplier-${problem.right}`)
    ) {
      return true;
    }
  }

  return false;
}

function chooseNextProblem() {
  clearPendingNextProblem();
  clearAutoSubmit();
  releaseAnswerLock();
  problemBank = buildProblemBank();
  if (problemBank.length === 0) {
    state.currentProblem = null;
    state.currentInput = "";
    setFeedback("这个组合没有可练的题，换个范围或取消一些过滤。", "is-wrong");
    persistAndRender();
    return;
  }

  const reviewFiltered = getReviewFilteredProblems(problemBank);
  if (state.settings.reviewMode !== "all" && reviewFiltered.length === 0) {
    state.currentProblem = null;
    state.currentInput = "";
    setFeedback("这个复习模式里还没有题，先做几题，或者切回“全部”。", "is-wrong");
    persistAndRender();
    return;
  }

  const basePool = state.settings.reviewMode === "all" ? problemBank : reviewFiltered;
  const dueProblems = getDueProblems(basePool);
  const candidates = dueProblems.length > 0 ? dueProblems : basePool;
  const weighted = candidates
    .map((problem) => ({
      problem,
      score: getProblemPriority(problem),
    }))
    .sort((left, right) => right.score - left.score);

  const topSlice = weighted.slice(0, Math.min(18, weighted.length));
  let picked;
  do {
    picked = topSlice[Math.floor(Math.random() * topSlice.length)].problem;
  } while (topSlice.length > 1 && picked.id === lastProblemId);

  state.currentProblem = {
    ...picked,
    shownAt: state.isRunning ? Date.now() : null,
    elapsedBeforePauseMs: 0,
  };
  state.currentInput = "";
  lastProblemId = picked.id;
  setFeedback(state.isRunning ? "直接输入答案，会自动提交。" : "点“开始”后直接输入答案。");
  persistAndRender();
}

function getReviewFilteredProblems(bank) {
  if (state.settings.reviewMode === "all") {
    return bank;
  }

  if (state.settings.reviewMode === "wrongOnly") {
    return bank.filter((problem) => getFactProgress(getFactKey(problem)).wrong > 0);
  }

  return bank.filter((problem) => {
    const progress = getFactProgress(getFactKey(problem));
    return progress.avgMs >= getSlowThresholdMs();
  });
}

function getDueProblems(bank) {
  const now = Date.now();
  return bank.filter((problem) => {
    const progress = getFactProgress(getFactKey(problem));
    return progress.nextDueAt > 0 && progress.nextDueAt <= now;
  });
}

function getProblemPriority(problem) {
  const progress = getFactProgress(getFactKey(problem));
  const accuracy = progress.attempts ? progress.correct / progress.attempts : 1;
  const overdue = progress.nextDueAt > 0 ? Math.max(0, Date.now() - progress.nextDueAt) : 0;
  return (
    overdue / 1000 +
    progress.wrong * 100 +
    progress.slow * 40 +
    (1 - accuracy) * 100 +
    progress.avgMs / 100
  );
}

function getFactKey(problem) {
  const normalized =
    problem.operation === "addition" || problem.operation === "multiplication"
      ? [Math.min(problem.left, problem.right), Math.max(problem.left, problem.right)]
      : [problem.left, problem.right];
  return `${problem.operation}-${normalized[0]}-${normalized[1]}`;
}

function getFactLabelFromKey(key) {
  const [operation, left, right] = key.split("-");
  const operator = operation === "addition" ? "+" : operation === "subtraction" ? "-" : "×";
  const answer =
    operation === "addition"
      ? Number(left) + Number(right)
      : operation === "subtraction"
        ? Number(left) - Number(right)
        : Number(left) * Number(right);
  return `${left} ${operator} ${right} = ${answer}`;
}

function getFactProgress(key) {
  return (
    state.factProgress[key] || {
      attempts: 0,
      correct: 0,
      wrong: 0,
      slow: 0,
      avgMs: 0,
      nextDueAt: 0,
      reviewStep: 0,
      label: getFactLabelFromKey(key),
    }
  );
}

function startRun() {
  clearPendingNextProblem();
  releaseAnswerLock();
  state.isRunning = true;
  elements.toggleRunButton.textContent = "暂停";
  elements.toggleRunButton.classList.add("is-running");
  if (!state.currentProblem) {
    chooseNextProblem();
    return;
  }
  if (!state.currentProblem.shownAt) {
    state.currentProblem.shownAt = Date.now();
  }
  setFeedback("开始了，直接输入答案。");
  persistAndRender();
}

function pauseRun() {
  clearPendingNextProblem();
  clearAutoSubmit();
  releaseAnswerLock();
  state.isRunning = false;
  elements.toggleRunButton.textContent = "开始";
  elements.toggleRunButton.classList.remove("is-running");
  if (state.currentProblem?.shownAt) {
    state.currentProblem.elapsedBeforePauseMs =
      (state.currentProblem.elapsedBeforePauseMs || 0) + (Date.now() - state.currentProblem.shownAt);
    state.currentProblem.shownAt = null;
  }
  setFeedback("已暂停。");
  persistAndRender();
}

function toggleRun() {
  if (state.isRunning) {
    pauseRun();
  } else {
    startRun();
  }
}

function getCurrentElapsedMs() {
  if (!state.currentProblem) {
    return 0;
  }
  const base = state.currentProblem.elapsedBeforePauseMs || 0;
  if (!state.currentProblem.shownAt) {
    return base;
  }
  return base + (Date.now() - state.currentProblem.shownAt);
}

function handleDigitInput(key) {
  if (isPanelOpen || isAnswerLocked) {
    return;
  }
  if (!state.isRunning) {
    setFeedback("先点“开始”。", "is-wrong");
    persistAndRender();
    return;
  }
  if (!state.currentProblem) {
    chooseNextProblem();
    return;
  }

  if (key === "clear") {
    state.currentInput = "";
  } else if (key === "backspace") {
    state.currentInput = state.currentInput.slice(0, -1);
  } else if (state.currentInput.length < 4) {
    state.currentInput = `${state.currentInput}${key}`.replace(/^0(\d)/, "$1");
  }

  persistAndRender();
  scheduleAutoSubmitIfReady();
}

function scheduleAutoSubmitIfReady() {
  clearAutoSubmit();

  if (!state.currentProblem || state.currentInput === "") {
    return;
  }

  const expectedLength = getExpectedAnswerLength(state.currentProblem);
  if (state.currentInput.length < expectedLength) {
    return;
  }

  autoSubmitHandle = window.setTimeout(() => {
    autoSubmitHandle = 0;
    const latestLength = state.currentInput.length;
    if (latestLength >= expectedLength) {
      submitCurrentAnswer();
    }
  }, expectedLength > 1 ? AUTO_SUBMIT_DELAY_MS : 80);
}

function getExpectedAnswerLength(problem) {
  return String(problem.answer).length;
}

function submitCurrentAnswer() {
  if (!state.currentProblem || state.currentInput === "") {
    return;
  }

  clearAutoSubmit();
  clearPendingNextProblem();

  const responseMs = getCurrentElapsedMs();
  const userAnswer = Number(state.currentInput);
  const isCorrect = userAnswer === state.currentProblem.answer;
  const factKey = getFactKey(state.currentProblem);
  updateFactProgress(factKey, responseMs, isCorrect);
  appendHistory(state.currentProblem, responseMs, isCorrect);
  updateStats(responseMs, isCorrect);

  if (isCorrect) {
    setFeedback(`答对了，用时 ${(responseMs / 1000).toFixed(1)} 秒。`, "is-correct");
  } else {
    setFeedback(
      `答案是 ${state.currentProblem.answer}，我会把这题加进后面的重点复习。`,
      "is-wrong"
    );
    saveMistake(state.currentProblem, userAnswer);
  }

  state.currentInput = "";
  isAnswerLocked = true;
  persistAndRender();
  nextProblemHandle = window.setTimeout(() => {
    nextProblemHandle = 0;
    if (state.isRunning) {
      chooseNextProblem();
      return;
    }
    releaseAnswerLock();
  }, isCorrect ? 500 : 1000);
}

function updateFactProgress(factKey, responseMs, isCorrect) {
  const current = getFactProgress(factKey);
  const slowThresholdMs = getSlowThresholdMs();
  const wasSlow = responseMs > slowThresholdMs;
  const next = {
    ...current,
    attempts: current.attempts + 1,
    correct: current.correct + (isCorrect ? 1 : 0),
    wrong: current.wrong + (isCorrect ? 0 : 1),
    slow: current.slow + (wasSlow ? 1 : 0),
    avgMs:
      current.attempts === 0
        ? responseMs
        : Math.round((current.avgMs * current.attempts + responseMs) / (current.attempts + 1)),
  };

  if (!isCorrect) {
    next.reviewStep = 0;
    next.nextDueAt = Date.now() + 20 * 1000;
  } else if (wasSlow) {
    next.reviewStep = Math.max(0, current.reviewStep);
    next.nextDueAt = Date.now() + REVIEW_INTERVALS_MS[1];
  } else {
    next.reviewStep = Math.min(current.reviewStep + 1, REVIEW_INTERVALS_MS.length - 1);
    next.nextDueAt = Date.now() + REVIEW_INTERVALS_MS[next.reviewStep];
  }

  state.factProgress[factKey] = next;
}

function getSlowThresholdMs() {
  const limit = RANGE_OPTIONS[state.settings.range].limit;
  if (state.settings.operation === "multiplication" || state.settings.operation === "random") {
    return limit <= 10 ? 3500 : 5000;
  }
  return limit <= 10 ? 2500 : limit <= 20 ? 3500 : 4500;
}

function appendHistory(problem, responseMs, isCorrect) {
  const item = {
    id: `${problem.id}-${Date.now()}`,
    problem: `${problem.left} ${problem.operator} ${problem.right} = ${problem.answer}`,
    responseMs,
    isCorrect,
    timestamp: Date.now(),
  };
  state.history = [item, ...state.history].slice(0, MAX_HISTORY);
}

function updateStats(responseMs, isCorrect) {
  state.stats.totalAnswered += 1;
  state.stats.totalTimeMs += responseMs;
  if (isCorrect) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    state.stats.lastResult = "正确";
  } else {
    state.stats.wrong += 1;
    state.stats.streak = 0;
    state.stats.lastResult = "错误";
  }
}

function saveMistake(problem, userAnswer) {
  const item = {
    id: `${problem.id}-${Date.now()}`,
    problem: `${problem.left} ${problem.operator} ${problem.right} = ${problem.answer}`,
    userAnswer,
  };
  state.mistakes = [item, ...state.mistakes].slice(0, MAX_MISTAKES);
}

function nextProblem() {
  clearPendingNextProblem();
  releaseAnswerLock();
  chooseNextProblem();
}

function updateSetting(key, value) {
  clearAutoSubmit();
  clearPendingNextProblem();
  releaseAnswerLock();
  state.settings[key] = value;
  state.currentInput = "";
  chooseNextProblem();
}

function toggleFilter(filterKey) {
  clearAutoSubmit();
  clearPendingNextProblem();
  releaseAnswerLock();
  const current = new Set(state.settings.filters);
  if (current.has(filterKey)) {
    current.delete(filterKey);
  } else {
    current.add(filterKey);
  }
  state.settings.filters = Array.from(current);
  chooseNextProblem();
}

function generateTodayReview() {
  const facts = Object.entries(state.factProgress)
    .map(([key, progress]) => ({
      key,
      label: progress.label || getFactLabelFromKey(key),
      progress,
      score: getReviewScore(progress),
    }))
    .filter((item) => item.progress.attempts > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
  state.todayReview = facts;
  persistAndRender();
}

function getReviewScore(progress) {
  const accuracy = progress.attempts ? progress.correct / progress.attempts : 1;
  return progress.wrong * 100 + progress.slow * 50 + progress.avgMs / 100 + (1 - accuracy) * 100;
}

function setFeedback(message, kind = "") {
  elements.feedbackMessage.textContent = message;
  elements.feedbackMessage.classList.remove("is-correct", "is-wrong");
  if (kind) {
    elements.feedbackMessage.classList.add(kind);
  }
}

function renderProblem() {
  const problem = state.currentProblem || makeProblem(7, 5, "addition");
  elements.questionLeft.textContent = String(problem.left);
  elements.questionOperator.textContent = problem.operator;
  elements.questionRight.textContent = String(problem.right);
  elements.answerDisplay.textContent = state.currentInput || "?";
  elements.focusHint.textContent = getFocusHint(problem);
}

function getFocusHint(problem) {
  if (state.settings.fixedNumber !== "none") {
    const fixed = Number(state.settings.fixedNumber);
    if (problem.operation === "subtraction") {
      return `固定数 ${fixed}：当前减法会优先让它放在前面。`;
    }
    return `固定数 ${fixed}：当前题里至少会有一个数是 ${fixed}。`;
  }
  if (state.settings.reviewMode === "wrongOnly") {
    return "当前复习模式：优先刷做错过的题。";
  }
  if (state.settings.reviewMode === "slowOnly") {
    return "当前复习模式：优先刷你最慢的题。";
  }
  return "";
}

function renderHeaderStatus() {
  const rangeLabel = RANGE_OPTIONS[state.settings.range].label;
  const operationLabel = OPERATION_OPTIONS[state.settings.operation].label;
  const runLabel = state.isRunning ? "进行中" : "未开始";
  const fixedLabel =
    state.settings.fixedNumber === "none" ? "" : ` · 固定${state.settings.fixedNumber}`;
  elements.questionModeLabel.textContent = `${rangeLabel} · ${operationLabel}${fixedLabel} · ${runLabel}`;
  elements.toggleRunButton.textContent = state.isRunning ? "暂停" : "开始";
  elements.toggleRunButton.classList.toggle("is-running", state.isRunning);
}

function renderPanelState() {
  if (elements.panelNav) {
    for (const button of elements.panelNav.querySelectorAll("button[data-open-panel]")) {
      button.classList.toggle(
        "is-active",
        isPanelOpen && button.dataset.openPanel === activePanel
      );
    }
  }

  for (const section of elements.panelSections) {
    section.classList.toggle("is-active", section.dataset.panelSection === activePanel);
  }

  if (elements.panelTitle) {
    elements.panelTitle.textContent = PANEL_TITLES[activePanel] || "设置";
  }

  if (elements.panelBackdrop) {
    elements.panelBackdrop.hidden = !isPanelOpen;
  }
}

function openPanel(panelName) {
  activePanel = panelName;
  isPanelOpen = true;
  renderPanelState();
}

function closePanel() {
  isPanelOpen = false;
  renderPanelState();
}

function renderStats() {
  const total = state.stats.totalAnswered;
  const accuracy = total ? Math.round((state.stats.correct / total) * 100) : 0;
  const avgTimeMs = total ? state.stats.totalTimeMs / total : 0;
  elements.liveTimerValue.textContent = `${(getCurrentElapsedMs() / 1000).toFixed(1)}s`;
  elements.lastResultValue.textContent = state.stats.lastResult;
  elements.accuracyValue.textContent = `${accuracy}%`;
  elements.avgTimeValue.textContent = `${(avgTimeMs / 1000).toFixed(1)}s`;
  elements.streakValue.textContent = String(state.stats.streak);
  elements.sessionSummary.textContent = `${total}题`;
  elements.correctCountValue.textContent = String(state.stats.correct);
  elements.wrongCountValue.textContent = String(state.stats.wrong);
  elements.mistakeBankValue.textContent = String(state.mistakes.length);
  elements.slowFactValue.textContent = getSlowestFactLabel();
}

function getSlowestFactLabel() {
  const items = Object.values(state.factProgress);
  if (items.length === 0) {
    return "暂无";
  }
  const slowest = [...items].sort((a, b) => b.avgMs - a.avgMs)[0];
  return slowest?.label ? slowest.label.replace(" = ", "=") : "暂无";
}

function renderSegmented(groupElement, value) {
  for (const button of groupElement.querySelectorAll("button[data-value]")) {
    button.classList.toggle("is-active", button.dataset.value === value);
  }
}

function renderFilterButtons() {
  const selected = new Set(state.settings.filters);
  for (const button of elements.filterGroup.querySelectorAll("button[data-filter]")) {
    button.classList.toggle("is-active", selected.has(button.dataset.filter));
  }
}

function renderReviewList() {
  const items = getReviewItems();
  elements.reviewList.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "先练几题，这里会出现你的今日复习清单。";
    elements.reviewList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "review-item";
    const title = document.createElement("strong");
    title.textContent = item.label;
    const detail = document.createElement("span");
    const accuracy = item.progress.attempts
      ? Math.round((item.progress.correct / item.progress.attempts) * 100)
      : 0;
    detail.textContent = `正确率 ${accuracy}% · 平均 ${(item.progress.avgMs / 1000).toFixed(1)}s · 错 ${item.progress.wrong} 次`;
    row.append(title, detail);
    elements.reviewList.appendChild(row);
  });
}

function getReviewItems() {
  let facts = state.todayReview.length > 0
    ? state.todayReview
    : Object.entries(state.factProgress).map(([key, progress]) => ({
        key,
        label: progress.label || getFactLabelFromKey(key),
        progress,
        score: getReviewScore(progress),
      }));

  facts = facts.filter((item) => item.progress.attempts > 0);

  if (state.settings.reviewMode === "wrongOnly") {
    facts = facts.filter((item) => item.progress.wrong > 0);
  }

  if (state.settings.reviewMode === "slowOnly") {
    facts = facts.filter((item) => item.progress.avgMs >= getSlowThresholdMs());
  }

  return [...facts].sort((a, b) => b.score - a.score).slice(0, 12);
}

function sortHistoryRows() {
  const rows = [...state.history];
  const direction = state.historySort.order === "asc" ? 1 : -1;
  rows.sort((left, right) => {
    if (state.historySort.key === "problem") {
      return left.problem.localeCompare(right.problem, "zh-CN") * direction;
    }
    if (state.historySort.key === "responseMs") {
      return (left.responseMs - right.responseMs) * direction;
    }
    if (state.historySort.key === "isCorrect") {
      return (Number(left.isCorrect) - Number(right.isCorrect)) * direction;
    }
    return (left.timestamp - right.timestamp) * direction;
  });
  return rows;
}

function renderHistoryTable() {
  elements.historyTableBody.innerHTML = "";
  const rows = sortHistoryRows();
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "empty-state";
    td.textContent = "还没有历史记录。";
    tr.appendChild(td);
    elements.historyTableBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.problem}</td>
      <td>${(row.responseMs / 1000).toFixed(1)}s</td>
      <td>${row.isCorrect ? "正确" : "错误"}</td>
      <td>${formatTimestamp(row.timestamp)}</td>
    `;
    elements.historyTableBody.appendChild(tr);
  });
}

function renderReferenceView() {
  for (const button of elements.referenceButtons.querySelectorAll("button[data-view]")) {
    button.classList.toggle("is-active", button.dataset.view === state.referenceView);
  }

  const data = getReferenceData(state.referenceView);
  elements.referenceContent.innerHTML = "";
  const intro = document.createElement("div");
  intro.className = "reference-card";
  intro.innerHTML = `<h3>${data.title}</h3><p>${data.description}</p>`;
  elements.referenceContent.appendChild(intro);

  data.cards.forEach((card) => {
    const block = document.createElement("article");
    block.className = "reference-card";
    block.innerHTML = `<h3>${card.title}</h3>`;
    const grid = document.createElement("div");
    grid.className = "reference-grid";
    card.rows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "reference-row";
      item.innerHTML = `<strong>${row.label}</strong><span>${row.formulas.join("  ·  ")}</span>`;
      if (row.detail) {
        const detail = document.createElement("span");
        detail.textContent = row.detail;
        item.appendChild(detail);
      }
      grid.appendChild(item);
    });
    block.appendChild(grid);
    elements.referenceContent.appendChild(block);
  });
}

function getReferenceData(view) {
  if (view === "multiplication") {
    return {
      title: "9×9乘法口诀",
      description: "按行看更顺手。",
      cards: [{ title: "乘法口诀", rows: buildMultiplicationRows() }],
    };
  }

  const limit = view === "within10" ? 10 : 20;
  return {
    title: `${limit}以内加减法`,
    description: "上面是加法，下面是减法。",
    cards: [
      { title: `${limit}以内加法`, rows: buildAdditionRows(limit) },
      { title: `${limit}以内减法`, rows: buildSubtractionRows(limit) },
    ],
  };
}

function buildAdditionRows(limit) {
  const rows = [];
  for (let left = 0; left <= limit; left += 1) {
    const formulas = [];
    for (let right = 0; right <= limit; right += 1) {
      formulas.push(`${left} + ${right} = ${left + right}`);
    }
    rows.push({ label: `${left} 开头`, formulas: formulas.slice(0, 6) });
  }
  return rows;
}

function buildSubtractionRows(limit) {
  const rows = [];
  for (let left = 0; left <= limit; left += 1) {
    const formulas = [];
    for (let right = 0; right <= left; right += 1) {
      formulas.push(`${left} - ${right} = ${left - right}`);
    }
    rows.push({ label: `${left} 开头`, formulas: formulas.slice(0, 6) });
  }
  return rows;
}

function buildMultiplicationRows() {
  const rows = [];
  for (let left = 0; left <= 9; left += 1) {
    const formulas = [];
    for (let right = 0; right <= 9; right += 1) {
      formulas.push(`${left} × ${right} = ${left * right}`);
    }
    rows.push({ label: `${left} 的表`, formulas: formulas.slice(0, 6) });
  }
  return rows;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
}

function persistAndRender() {
  saveState();
  renderHeaderStatus();
  renderPanelState();
  renderProblem();
  renderStats();
  renderReviewList();
  renderHistoryTable();
  renderReferenceView();
  renderSegmented(elements.rangeGroup, state.settings.range);
  renderSegmented(elements.operationGroup, state.settings.operation);
  renderSegmented(elements.fixedNumberGroup, state.settings.fixedNumber);
  renderSegmented(elements.reviewModeGroup, state.settings.reviewMode);
  renderFilterButtons();
}

function clearStats() {
  clearAutoSubmit();
  clearPendingNextProblem();
  releaseAnswerLock();
  state.stats = { ...defaultState.stats };
  state.factProgress = {};
  state.todayReview = [];
  state.currentInput = "";
  state.history = [];
  state.mistakes = [];
  setFeedback("统计、历史和复习记忆已清空。");
  persistAndRender();
  chooseNextProblem();
}

function startTimerLoop() {
  if (timerHandle) {
    window.clearInterval(timerHandle);
  }
  timerHandle = window.setInterval(() => {
    elements.liveTimerValue.textContent = `${(getCurrentElapsedMs() / 1000).toFixed(1)}s`;
  }, 100);
}

function bindEvents() {
  elements.toggleRunButton.addEventListener("click", toggleRun);
  elements.nextQuestionButton.addEventListener("click", nextProblem);
  elements.generateReviewButton.addEventListener("click", generateTodayReview);
  elements.resetStatsButton.addEventListener("click", clearStats);
  elements.clearMistakesButton.addEventListener("click", () => {
    state.mistakes = [];
    setFeedback("错题本已清空，做题表现记录仍保留。");
    persistAndRender();
  });
  elements.clearHistoryButton.addEventListener("click", () => {
    state.history = [];
    setFeedback("历史记录已清空。");
    persistAndRender();
  });

  elements.rangeGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (button) {
      updateSetting("range", button.dataset.value);
    }
  });

  elements.operationGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (button) {
      updateSetting("operation", button.dataset.value);
    }
  });

  elements.fixedNumberGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (button) {
      updateSetting("fixedNumber", button.dataset.value);
    }
  });

  elements.reviewModeGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (button) {
      updateSetting("reviewMode", button.dataset.value);
    }
  });

  elements.filterGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (button) {
      toggleFilter(button.dataset.filter);
    }
  });

  elements.keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");
    if (button) {
      handleDigitInput(button.dataset.key);
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sort-key]");
    if (!button) {
      return;
    }
    const key = button.dataset.sortKey;
    if (state.historySort.key === key) {
      state.historySort.order = state.historySort.order === "asc" ? "desc" : "asc";
    } else {
      state.historySort.key = key;
      state.historySort.order = key === "timestamp" ? "desc" : "asc";
    }
    persistAndRender();
  });

  elements.referenceButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (button) {
      state.referenceView = button.dataset.view;
      persistAndRender();
    }
  });

  if (elements.panelNav) {
    elements.panelNav.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-open-panel]");
      if (!button) {
        return;
      }
      const panelName = button.dataset.openPanel;
      if (isPanelOpen && activePanel === panelName) {
        closePanel();
        return;
      }
      openPanel(panelName);
    });
  }

  if (elements.closePanelButton) {
    elements.closePanelButton.addEventListener("click", closePanel);
  }

  if (elements.panelBackdrop) {
    elements.panelBackdrop.addEventListener("click", (event) => {
      if (event.target === elements.panelBackdrop) {
        closePanel();
      }
    });
  }

  window.addEventListener(
    "dblclick",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isPanelOpen) {
      closePanel();
      return;
    }
    if (/^\d$/.test(event.key)) {
      handleDigitInput(event.key);
      return;
    }
    if (event.key === "Backspace") {
      handleDigitInput("backspace");
      return;
    }
    if (event.key === "Escape") {
      handleDigitInput("clear");
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

function init() {
  bindEvents();
  persistAndRender();
  chooseNextProblem();
  startTimerLoop();
  registerServiceWorker();
}

init();
