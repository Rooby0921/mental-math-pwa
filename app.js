const STORAGE_KEY = "mental-math-pwa-state-v6";
const MAX_MISTAKES = 12;
const MAX_HISTORY = 500;
const REVIEW_INTERVALS_MS = [
  30 * 1000,
  2 * 60 * 1000,
  10 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

const PRACTICE_TYPE_LABELS = {
  within10: "10 以内",
  within20: "20 以内",
  twoDigitOneDigit: "两位数 ± 个位数",
};

const OPERATION_LABELS = {
  mixed: "混合",
  addition: "加法",
  subtraction: "减法",
};

const ORDER_MODE_LABELS = {
  random: "随机",
  sequence: "顺序",
};

const FOCUS_MODE_LABELS = {
  none: "常规",
  teenFamily: "11-19 家族",
  borrowCore: "借位核心",
  reverseBridge10: "反向凑十",
};

const FOCUS_MODE_HINTS = {
  none: "常规：按你选的题型、运算和难度自由练习。",
  teenFamily:
    "11-19 家族：以 11 到 19 为第一个数，第二个数固定在 2 到 9，可以选单个家族，也可以混合随机。",
  borrowCore:
    "借位核心：只练像 53 - 8、62 - 7 这种要借位的题，并拆回 13 - 8、12 - 7 这种核心小题。",
  reverseBridge10:
    "反向凑十：只练 8 + 5 = 13、7 + 6 = 13 这种过 10 的组合，帮你更快认出关键搭配。",
};

const DIFFICULTY_RULES = {
  standard: {
    label: "基础",
    hint: "基础：不过滤简单题。",
    blockedDigits: [],
    blockedResults: [],
  },
  level1: {
    label: "难度 1",
    hint: "难度 1：过滤一位数里的 1、2，以及结果为 1、2 的题。",
    blockedDigits: [1, 2],
    blockedResults: [1, 2],
  },
  level2: {
    label: "难度 2",
    hint: "难度 2：过滤一位数里的 1、2、3、4，以及结果为 1、2、3、4 的题。",
    blockedDigits: [1, 2, 3, 4],
    blockedResults: [1, 2, 3, 4],
  },
  break10: {
    label: "突破 10",
    hint: "突破 10：只练过 10、退位、借位这类题，比如 8 + 3、11 - 8、14 - 6。",
    blockedDigits: [],
    blockedResults: [],
  },
};

const defaultState = {
  settings: {
    practiceType: "within10",
    operation: "mixed",
    orderMode: "random",
    difficulty: "standard",
    focusMode: "none",
    teenFamilyTarget: "mixed",
  },
  referenceView: "within10",
  stats: {
    totalAnswered: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    sequenceIndex: 0,
    totalTimeMs: 0,
    lastResponseMs: 0,
    lastResult: "未作答",
  },
  factProgress: {},
  mistakes: [],
  history: [],
  historySort: {
    key: "timestamp",
    order: "desc",
  },
  currentProblem: null,
  currentInput: "",
};

const elements = {
  practiceTypeGroup: document.querySelector("#practiceTypeGroup"),
  operationGroup: document.querySelector("#operationGroup"),
  orderModeGroup: document.querySelector("#orderModeGroup"),
  difficultyGroup: document.querySelector("#difficultyGroup"),
  difficultyHint: document.querySelector("#difficultyHint"),
  focusModeGroup: document.querySelector("#focusModeGroup"),
  focusModeHint: document.querySelector("#focusModeHint"),
  teenFamilySection: document.querySelector("#teenFamilySection"),
  teenFamilyGroup: document.querySelector("#teenFamilyGroup"),
  questionModeLabel: document.querySelector("#questionModeLabel"),
  questionLeft: document.querySelector("#questionLeft"),
  questionOperator: document.querySelector("#questionOperator"),
  questionRight: document.querySelector("#questionRight"),
  answerDisplay: document.querySelector("#answerDisplay"),
  focusHint: document.querySelector("#focusHint"),
  feedbackMessage: document.querySelector("#feedbackMessage"),
  liveTimerValue: document.querySelector("#liveTimerValue"),
  lastResultValue: document.querySelector("#lastResultValue"),
  sessionSummary: document.querySelector("#sessionSummary"),
  streakValue: document.querySelector("#streakValue"),
  accuracyValue: document.querySelector("#accuracyValue"),
  avgTimeValue: document.querySelector("#avgTimeValue"),
  correctCountValue: document.querySelector("#correctCountValue"),
  wrongCountValue: document.querySelector("#wrongCountValue"),
  mistakeBankValue: document.querySelector("#mistakeBankValue"),
  keypad: document.querySelector("#keypad"),
  submitButton: document.querySelector("#submitButton"),
  nextQuestionButton: document.querySelector("#nextQuestionButton"),
  resetStatsButton: document.querySelector("#resetStatsButton"),
  clearMistakesButton: document.querySelector("#clearMistakesButton"),
  referenceButtons: document.querySelector("#referenceButtons"),
  referenceContent: document.querySelector("#referenceContent"),
  weakFactList: document.querySelector("#weakFactList"),
  historyTableBody: document.querySelector("#historyTableBody"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  openSettingsButton: document.querySelector("#openSettingsButton"),
  openReferenceButton: document.querySelector("#openReferenceButton"),
  openHistoryButton: document.querySelector("#openHistoryButton"),
  installHintButton: document.querySelector("#installHintButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  closeSettingsDialog: document.querySelector("#closeSettingsDialog"),
  referenceDialog: document.querySelector("#referenceDialog"),
  closeReferenceDialog: document.querySelector("#closeReferenceDialog"),
  historyDialog: document.querySelector("#historyDialog"),
  closeHistoryDialog: document.querySelector("#closeHistoryDialog"),
  installDialog: document.querySelector("#installDialog"),
  closeInstallDialog: document.querySelector("#closeInstallDialog"),
};

const state = loadState();
let problemBank = [];
let lastProblemId = "";
let timerHandle = 0;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) {
      return cloneDefaultState();
    }
    return {
      settings: { ...defaultState.settings, ...saved.settings },
      referenceView:
        typeof saved.referenceView === "string"
          ? saved.referenceView
          : defaultState.referenceView,
      stats: { ...defaultState.stats, ...saved.stats },
      factProgress:
        saved.factProgress && typeof saved.factProgress === "object" ? saved.factProgress : {},
      mistakes: Array.isArray(saved.mistakes) ? saved.mistakes : [],
      history: Array.isArray(saved.history) ? saved.history : [],
      historySort: { ...defaultState.historySort, ...saved.historySort },
      currentProblem: saved.currentProblem || null,
      currentInput: typeof saved.currentInput === "string" ? saved.currentInput : "",
    };
  } catch {
    return cloneDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function buildProblemBank(settings) {
  if (settings.focusMode !== "none") {
    return buildFocusProblemBank(settings);
  }

  const operations =
    settings.operation === "mixed"
      ? ["addition", "subtraction"]
      : [settings.operation];
  const bank = [];

  for (const operation of operations) {
    if (settings.practiceType === "within10" || settings.practiceType === "within20") {
      const limit = settings.practiceType === "within10" ? 10 : 20;
      if (operation === "addition") {
        for (let left = 1; left <= limit; left += 1) {
          for (let right = 1; right <= limit; right += 1) {
            if (left + right <= limit) {
              bank.push(makeProblem(left, right, operation));
            }
          }
        }
      } else {
        for (let left = 1; left <= limit; left += 1) {
          for (let right = 1; right <= left; right += 1) {
            bank.push(makeProblem(left, right, operation));
          }
        }
      }
    } else {
      for (let left = 10; left <= 99; left += 1) {
        for (let right = 1; right <= 9; right += 1) {
          if (operation === "addition" && left + right > 99) {
            continue;
          }
          bank.push(makeProblem(left, right, operation));
        }
      }
    }
  }

  return bank.filter((problem) => isProblemAllowed(problem, settings));
}

function buildFocusProblemBank(settings) {
  const bank = [];

  if (settings.focusMode === "teenFamily") {
    const starts =
      settings.teenFamilyTarget === "mixed"
        ? [11, 12, 13, 14, 15, 16, 17, 18, 19]
        : [Number(settings.teenFamilyTarget)];
    const operations =
      settings.operation === "mixed"
        ? ["addition", "subtraction"]
        : [settings.operation];
    for (const left of starts) {
      for (const operation of operations) {
        for (let right = 2; right <= 9; right += 1) {
          bank.push(makeProblem(left, right, operation));
        }
      }
    }
    return bank;
  }

  if (settings.focusMode === "borrowCore") {
    for (let left = 10; left <= 99; left += 1) {
      for (let right = 3; right <= 9; right += 1) {
        const problem = makeProblem(left, right, "subtraction");
        if (isBorrowCoreProblem(problem)) {
          bank.push(problem);
        }
      }
    }
    return bank;
  }

  if (settings.focusMode === "reverseBridge10") {
    for (let left = 2; left <= 9; left += 1) {
      for (let right = 2; right <= 9; right += 1) {
        const problem = makeProblem(left, right, "addition");
        if (problem.answer >= 11 && problem.answer <= 18) {
          bank.push(problem);
        }
      }
    }
    return bank;
  }

  return bank;
}

function makeProblem(left, right, operation) {
  return {
    id: `${operation}-${left}-${right}`,
    left,
    right,
    operator: operation === "addition" ? "+" : "-",
    operation,
    answer: operation === "addition" ? left + right : left - right,
  };
}

function isProblemAllowed(problem, settings) {
  const rule = DIFFICULTY_RULES[settings.difficulty] || DIFFICULTY_RULES.standard;
  if (settings.difficulty === "break10") {
    return isBreak10Problem(problem, settings);
  }
  if (rule.blockedDigits.length === 0 && rule.blockedResults.length === 0) {
    return true;
  }

  const oneDigitParts =
    settings.practiceType === "twoDigitOneDigit"
      ? [problem.right]
      : [problem.left, problem.right];

  const hasBlockedDigit = oneDigitParts.some((value) => rule.blockedDigits.includes(value));
  const hasBlockedResult = rule.blockedResults.includes(problem.answer);
  return !hasBlockedDigit && !hasBlockedResult;
}

function isBreak10Problem(problem, settings) {
  if (settings.practiceType === "twoDigitOneDigit") {
    const ones = problem.left % 10;
    if (problem.operation === "addition") {
      return problem.right > 2 && ones + problem.right > 10;
    }
    return problem.left > 10 && problem.right > 2 && ones < problem.right && problem.answer > 2;
  }

  if (settings.practiceType === "within20") {
    if (problem.operation === "addition") {
      return problem.left > 2 && problem.right > 2 && problem.answer > 10;
    }
    return problem.left > 10 && problem.right > 2 && problem.answer > 2;
  }

  return false;
}

function isBorrowCoreProblem(problem) {
  const ones = problem.left % 10;
  const coreLeft = 10 + ones;
  const coreResult = coreLeft - problem.right;
  return (
    ones >= 1 &&
    ones <= 8 &&
    problem.right >= 3 &&
    problem.right <= 9 &&
    ones < problem.right &&
    coreResult >= 2 &&
    coreResult <= 9
  );
}

function nextProblem() {
  problemBank = buildProblemBank(state.settings);
  if (problemBank.length === 0) {
    state.currentProblem = null;
    state.currentInput = "";
    setFeedback("这个组合暂时没有题，换个模式试试。", "is-wrong");
    persistAndRender();
    return;
  }

  state.currentProblem = chooseNextProblem(problemBank, state.settings);
  state.currentProblem.shownAt = Date.now();
  state.currentInput = "";
  lastProblemId = state.currentProblem.id;
  setFeedback("准备好了就开始。");
  persistAndRender();
}

function chooseNextProblem(bank, settings) {
  const grouped = new Map();
  const now = Date.now();

  for (const problem of bank) {
    const fact = getFactDescriptor(problem, settings);
    if (!grouped.has(fact.key)) {
      grouped.set(fact.key, {
        fact,
        problems: [],
        progress: getFactProgress(fact.key),
      });
    }
    grouped.get(fact.key).problems.push(problem);
  }

  const groups = Array.from(grouped.values());
  const dueGroups = groups.filter(
    (group) => group.progress.nextDueAt > 0 && group.progress.nextDueAt <= now
  );
  if (dueGroups.length > 0) {
    return chooseProblemFromGroups(dueGroups, true);
  }

  const weakGroups = groups.filter((group) => isWeakFact(group.progress, settings));
  if (weakGroups.length > 0) {
    return chooseProblemFromGroups(weakGroups, false);
  }

  const unseenGroups = groups.filter((group) => group.progress.attempts === 0);
  if (unseenGroups.length > 0) {
    return chooseProblemFromGroups(unseenGroups, false);
  }

  if (settings.orderMode === "sequence") {
    const index = state.stats.sequenceIndex % bank.length;
    const problem = bank[index];
    state.stats.sequenceIndex = (index + 1) % bank.length;
    return problem;
  }

  return chooseRandomProblem(bank);
}

function chooseProblemFromGroups(groups, isDue) {
  const ranked = [...groups].sort((left, right) => {
    return getFactPriority(right.progress, isDue) - getFactPriority(left.progress, isDue);
  });

  for (const group of ranked) {
    const candidate = chooseRandomProblem(group.problems);
    if (candidate.id !== lastProblemId || ranked.length === 1) {
      return candidate;
    }
  }

  return chooseRandomProblem(ranked[0].problems);
}

function chooseRandomProblem(list) {
  if (list.length === 1) {
    return list[0];
  }
  let candidate;
  do {
    candidate = list[Math.floor(Math.random() * list.length)];
  } while (candidate.id === lastProblemId);
  return candidate;
}

function getFactPriority(progress, isDue) {
  const overdueBoost = isDue ? Date.now() - progress.nextDueAt : 0;
  const accuracy = progress.attempts ? progress.correct / progress.attempts : 0;
  return (
    progress.wrong * 100 +
    progress.slow * 40 +
    Math.round((1 - accuracy) * 100) +
    overdueBoost / 1000
  );
}

function isWeakFact(progress, settings) {
  if (progress.attempts < 2) {
    return false;
  }
  const accuracy = progress.correct / progress.attempts;
  return accuracy < 0.8 || progress.avgMs > getSlowThresholdMs(settings);
}

function getFactProgress(factKey) {
  return (
    state.factProgress[factKey] || {
      label: "",
      attempts: 0,
      correct: 0,
      wrong: 0,
      slow: 0,
      avgMs: 0,
      nextDueAt: 0,
      reviewStep: 0,
      lastSeenAt: 0,
      lastResponseMs: 0,
    }
  );
}

function getFactDescriptor(problem, settings) {
  if (settings.focusMode === "borrowCore") {
    const coreLeft = 10 + (problem.left % 10);
    return {
      key: `sub-${coreLeft}-${problem.right}`,
      label: `${coreLeft} - ${problem.right}`,
    };
  }

  if (settings.focusMode === "teenFamily") {
    return {
      key: `${problem.operation}-${problem.left}-${problem.right}`,
      label: `${problem.left} ${problem.operator} ${problem.right}`,
    };
  }

  if (problem.operation === "addition") {
    const left = Math.min(problem.left, problem.right);
    const right = Math.max(problem.left, problem.right);
    return {
      key: `add-${left}-${right}`,
      label: `${left} + ${right}`,
    };
  }

  return {
    key: `sub-${problem.left}-${problem.right}`,
    label: `${problem.left} - ${problem.right}`,
  };
}

function getSlowThresholdMs(settings) {
  if (settings.focusMode === "borrowCore") {
    return 5000;
  }
  if (settings.focusMode === "teenFamily" || settings.focusMode === "reverseBridge10") {
    return 3200;
  }
  if (settings.practiceType === "twoDigitOneDigit") {
    return 5000;
  }
  return 4000;
}

function setFeedback(message, kind = "") {
  elements.feedbackMessage.textContent = message;
  elements.feedbackMessage.classList.remove("is-correct", "is-wrong");
  if (kind) {
    elements.feedbackMessage.classList.add(kind);
  }
}

function formatSettingsLabel() {
  const base = `${PRACTICE_TYPE_LABELS[state.settings.practiceType]} · ${
    OPERATION_LABELS[state.settings.operation]
  } · ${ORDER_MODE_LABELS[state.settings.orderMode]} · ${
    DIFFICULTY_RULES[state.settings.difficulty].label
  }`;
  if (state.settings.focusMode === "none") {
    return base;
  }
  if (state.settings.focusMode === "teenFamily" && state.settings.teenFamilyTarget !== "mixed") {
    return `${base} · ${state.settings.teenFamilyTarget} 家族`;
  }
  return `${base} · ${FOCUS_MODE_LABELS[state.settings.focusMode]}`;
}

function renderProblem() {
  const problem = state.currentProblem || makeProblem(7, 5, "addition");
  elements.questionLeft.textContent = String(problem.left);
  elements.questionOperator.textContent = problem.operator;
  elements.questionRight.textContent = String(problem.right);
  elements.answerDisplay.textContent = state.currentInput || "?";
  elements.questionModeLabel.textContent = formatSettingsLabel();
  elements.focusHint.textContent = getFocusHint(problem, state.settings);
}

function getFocusHint(problem, settings) {
  if (settings.focusMode === "borrowCore") {
    const ones = problem.left % 10;
    const tens = problem.left - ones;
    return `核心拆分：${problem.left} - ${problem.right} = ${tens} + (${10 + ones} - ${problem.right})`;
  }

  if (settings.focusMode === "teenFamily") {
    if (settings.teenFamilyTarget === "mixed") {
      return "当前专项：11 到 19 与 2 到 9 的加减法混合随机。";
    }
    return `当前专项：${settings.teenFamilyTarget} 和 2 到 9 的加减法。`;
  }

  if (settings.focusMode === "reverseBridge10") {
    return `核心题型：记住 ${problem.left} + ${problem.right} = ${problem.answer} 这种过 10 的组合。`;
  }

  return "";
}

function renderDifficultyHint() {
  if (state.settings.focusMode !== "none") {
    elements.difficultyHint.textContent = "当前开启专项练习，普通难度过滤会先让位给专项规则。";
    return;
  }
  elements.difficultyHint.textContent = DIFFICULTY_RULES[state.settings.difficulty].hint;
}

function renderFocusModeHint() {
  elements.focusModeHint.textContent = FOCUS_MODE_HINTS[state.settings.focusMode];
  elements.teenFamilySection.hidden = state.settings.focusMode !== "teenFamily";
}

function renderStats() {
  const { totalAnswered, correct, wrong, streak, totalTimeMs, lastResult } = state.stats;
  const accuracy = totalAnswered ? Math.round((correct / totalAnswered) * 100) : 0;
  const avgTimeMs = totalAnswered ? totalTimeMs / totalAnswered : 0;
  elements.sessionSummary.textContent = `${totalAnswered} 题`;
  elements.correctCountValue.textContent = String(correct);
  elements.wrongCountValue.textContent = String(wrong);
  elements.mistakeBankValue.textContent = String(state.mistakes.length);
  elements.streakValue.textContent = String(streak);
  elements.accuracyValue.textContent = `${accuracy}%`;
  elements.avgTimeValue.textContent = `${(avgTimeMs / 1000).toFixed(1)}s`;
  elements.lastResultValue.textContent = lastResult;
}

function renderLiveTimer() {
  if (!state.currentProblem?.shownAt) {
    elements.liveTimerValue.textContent = "0.0s";
    return;
  }
  const elapsedMs = Math.max(0, Date.now() - state.currentProblem.shownAt);
  elements.liveTimerValue.textContent = `${(elapsedMs / 1000).toFixed(1)}s`;
}

function renderSegmented(groupElement, value) {
  for (const button of groupElement.querySelectorAll("button[data-value]")) {
    button.classList.toggle("is-active", button.dataset.value === value);
  }
}

function getReferenceData(view) {
  if (view === "multiplication") {
    return {
      title: "9×9 乘法口诀表",
      description: "按行看更顺手，每行都是一个乘法家族。",
      cards: [{ title: "乘法口诀", rows: buildMultiplicationRows() }],
    };
  }

  const limit = view === "within10" ? 10 : 20;
  return {
    title: `${limit} 以内加减法口诀表`,
    description: "上面是加法，下面是减法，方便随手对照。",
    cards: [
      {
        title: `${limit} 以内加法`,
        rows: buildAdditionRows(limit),
      },
      {
        title: `${limit} 以内减法`,
        rows: buildSubtractionRows(limit),
      },
    ],
  };
}

function buildAdditionRows(limit) {
  const rows = [];
  for (let left = 1; left <= limit; left += 1) {
    const formulas = [];
    for (let right = left; right <= limit - left; right += 1) {
      formulas.push(`${left} + ${right} = ${left + right}`);
    }
    if (formulas.length > 0) {
      rows.push({
        label: `${left} 开头`,
        formulas,
      });
    }
  }
  return rows;
}

function buildSubtractionRows(limit) {
  const rows = [];
  for (let left = 1; left <= limit; left += 1) {
    const formulas = [];
    for (let right = 1; right <= left; right += 1) {
      formulas.push(`${left} - ${right} = ${left - right}`);
    }
    rows.push({
      label: `${left} 开头`,
      formulas,
    });
  }
  return rows;
}

function buildMultiplicationRows() {
  const rows = [];
  for (let left = 1; left <= 9; left += 1) {
    const formulas = [];
    const sayings = [];
    for (let right = 1; right <= left; right += 1) {
      formulas.push(`${left} × ${right} = ${left * right}`);
      sayings.push(`${toChineseDigit(right)}${toChineseDigit(left)}得${toChineseNumber(left * right)}`);
    }
    rows.push({
      label: `${left} 的口诀`,
      formulas,
      detail: sayings.join("，"),
    });
  }
  return rows;
}

function toChineseDigit(value) {
  const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  return map[value] || String(value);
}

function toChineseNumber(value) {
  if (value < 10) {
    return toChineseDigit(value);
  }
  if (value === 10) {
    return "十";
  }
  if (value < 20) {
    return `十${toChineseDigit(value - 10)}`;
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return ones === 0
    ? `${toChineseDigit(tens)}十`
    : `${toChineseDigit(tens)}十${toChineseDigit(ones)}`;
}

function renderReferenceView() {
  const data = getReferenceData(state.referenceView);
  for (const button of elements.referenceButtons.querySelectorAll("button")) {
    button.classList.toggle("is-active", button.dataset.view === state.referenceView);
  }

  elements.referenceContent.innerHTML = "";
  const title = document.createElement("div");
  title.className = "reference-card";
  title.innerHTML = `<h3>${data.title}</h3><p>${data.description}</p>`;
  elements.referenceContent.appendChild(title);

  data.cards.forEach((card) => {
    const section = document.createElement("article");
    section.className = "reference-card";
    const heading = document.createElement("h3");
    heading.textContent = card.title;
    const grid = document.createElement("div");
    grid.className = "reference-grid";

    card.rows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "reference-row";
      const label = document.createElement("strong");
      label.textContent = row.label;
      const formulas = document.createElement("span");
      formulas.textContent = row.formulas.join("  ·  ");
      item.append(label, formulas);
      if (row.detail) {
        const detail = document.createElement("span");
        detail.textContent = row.detail;
        item.append(detail);
      }
      grid.appendChild(item);
    });

    section.append(heading, grid);
    elements.referenceContent.appendChild(section);
  });
}

function renderWeakFacts() {
  elements.weakFactList.innerHTML = "";
  const items = Object.entries(state.factProgress)
    .map(([key, progress]) => ({ key, progress }))
    .filter((item) => item.progress.attempts > 0)
    .sort((left, right) => getFactPriority(right.progress, false) - getFactPriority(left.progress, false))
    .slice(0, 8);

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "还没有足够的练习数据。";
    elements.weakFactList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "weak-fact-item";
    const label = document.createElement("strong");
    label.textContent = item.progress.label || item.key.replace(/^add-/, "").replace(/^sub-/, "");
    const info = document.createElement("span");
    const accuracy = item.progress.attempts
      ? Math.round((item.progress.correct / item.progress.attempts) * 100)
      : 0;
    info.textContent = `正确率 ${accuracy}% · 平均 ${(item.progress.avgMs / 1000).toFixed(1)}s · 错 ${item.progress.wrong} 次`;
    row.append(label, info);
    elements.weakFactList.appendChild(row);
  });
}

function renderHistoryTable() {
  elements.historyTableBody.innerHTML = "";
  const rows = sortHistoryRows(state.history, state.historySort);

  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.className = "empty-state";
    cell.textContent = "还没有练习历史。";
    row.appendChild(cell);
    elements.historyTableBody.appendChild(row);
    return;
  }

  rows.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.problem}</td>
      <td>${(item.responseMs / 1000).toFixed(1)}s</td>
      <td>${item.isCorrect ? "正确" : "错误"}</td>
      <td>${formatTimestamp(item.timestamp)}</td>
    `;
    elements.historyTableBody.appendChild(row);
  });
}

function sortHistoryRows(rows, sortState) {
  const sorted = [...rows];
  const direction = sortState.order === "asc" ? 1 : -1;
  sorted.sort((left, right) => {
    if (sortState.key === "problem") {
      return left.problem.localeCompare(right.problem, "zh-CN") * direction;
    }
    if (sortState.key === "responseMs") {
      return (left.responseMs - right.responseMs) * direction;
    }
    if (sortState.key === "isCorrect") {
      return (Number(left.isCorrect) - Number(right.isCorrect)) * direction;
    }
    return (left.timestamp - right.timestamp) * direction;
  });
  return sorted;
}

function persistAndRender() {
  saveState();
  renderProblem();
  renderDifficultyHint();
  renderFocusModeHint();
  renderStats();
  renderReferenceView();
  renderWeakFacts();
  renderHistoryTable();
  renderLiveTimer();
  renderSegmented(elements.practiceTypeGroup, state.settings.practiceType);
  renderSegmented(elements.operationGroup, state.settings.operation);
  renderSegmented(elements.orderModeGroup, state.settings.orderMode);
  renderSegmented(elements.difficultyGroup, state.settings.difficulty);
  renderSegmented(elements.focusModeGroup, state.settings.focusMode);
  renderSegmented(elements.teenFamilyGroup, state.settings.teenFamilyTarget);
}

function handleDigitInput(key) {
  if (key === "clear") {
    state.currentInput = "";
  } else if (key === "backspace") {
    state.currentInput = state.currentInput.slice(0, -1);
  } else if (state.currentInput.length < 3) {
    state.currentInput = `${state.currentInput}${key}`.replace(/^0(\d)/, "$1");
  }
  persistAndRender();
}

function saveMistake(problem, userAnswer) {
  const entry = {
    id: `${problem.id}-${Date.now()}`,
    left: problem.left,
    right: problem.right,
    operator: problem.operator,
    answer: problem.answer,
    userAnswer,
  };
  state.mistakes = [entry, ...state.mistakes].slice(0, MAX_MISTAKES);
}

function addHistoryEntry(problem, responseMs, isCorrect) {
  state.history = [
    {
      id: `${problem.id}-${Date.now()}`,
      problem: `${problem.left} ${problem.operator} ${problem.right} = ${problem.answer}`,
      responseMs,
      isCorrect,
      timestamp: Date.now(),
    },
    ...state.history,
  ].slice(0, MAX_HISTORY);
}

function applyFocusModeDefaults(focusMode) {
  if (focusMode === "teenFamily") {
    state.settings.practiceType = "within20";
    state.settings.operation = "mixed";
    state.settings.orderMode = "random";
    setFeedback("已切到 11-19 家族专项。");
    return;
  }

  if (focusMode === "borrowCore") {
    state.settings.practiceType = "twoDigitOneDigit";
    state.settings.operation = "subtraction";
    state.settings.orderMode = "random";
    setFeedback("已切到借位核心专项。");
    return;
  }

  if (focusMode === "reverseBridge10") {
    state.settings.practiceType = "within20";
    state.settings.operation = "addition";
    state.settings.orderMode = "random";
    setFeedback("已切到反向凑十专项。");
    return;
  }

  setFeedback("已回到常规练习。");
}

function updateFactProgressAfterAnswer(problem, responseMs, isCorrect) {
  const fact = getFactDescriptor(problem, state.settings);
  const thresholdMs = getSlowThresholdMs(state.settings);
  const wasSlow = responseMs > thresholdMs;
  const current = getFactProgress(fact.key);
  const next = {
    ...current,
    label: fact.label,
    attempts: current.attempts + 1,
    lastSeenAt: Date.now(),
    lastResponseMs: responseMs,
    avgMs:
      current.attempts === 0
        ? responseMs
        : Math.round((current.avgMs * current.attempts + responseMs) / (current.attempts + 1)),
  };

  if (isCorrect) {
    next.correct += 1;
  } else {
    next.wrong += 1;
  }

  if (wasSlow) {
    next.slow += 1;
  }

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

  state.factProgress[fact.key] = next;
  return {
    wasSlow,
    factLabel: fact.label,
  };
}

function submitAnswer() {
  if (!state.currentProblem) {
    nextProblem();
    return;
  }

  if (state.currentInput === "") {
    setFeedback("先输入答案。", "is-wrong");
    persistAndRender();
    return;
  }

  const userAnswer = Number(state.currentInput);
  const isCorrect = userAnswer === state.currentProblem.answer;
  const responseMs = Math.max(0, Date.now() - (state.currentProblem.shownAt || Date.now()));
  const reviewState = updateFactProgressAfterAnswer(state.currentProblem, responseMs, isCorrect);

  state.stats.totalAnswered += 1;
  state.stats.totalTimeMs += responseMs;
  state.stats.lastResponseMs = responseMs;
  addHistoryEntry(state.currentProblem, responseMs, isCorrect);

  if (isCorrect) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    state.stats.lastResult = "正确";
    if (reviewState.wasSlow) {
      setFeedback(
        `答对了，用时 ${(responseMs / 1000).toFixed(1)} 秒，这题后面还会再出现。`,
        "is-correct"
      );
    } else {
      setFeedback(`答对了，用时 ${(responseMs / 1000).toFixed(1)} 秒。`, "is-correct");
    }
    persistAndRender();
    window.setTimeout(nextProblem, 650);
  } else {
    state.stats.wrong += 1;
    state.stats.streak = 0;
    state.stats.lastResult = "错误";
    saveMistake(state.currentProblem, userAnswer);
    setFeedback(
      `这题答案是 ${state.currentProblem.answer}，核心题是 ${reviewState.factLabel}，我会安排它反复练。`,
      "is-wrong"
    );
    persistAndRender();
    window.setTimeout(nextProblem, 1200);
  }
}

function resetStats() {
  state.stats = { ...defaultState.stats };
  state.factProgress = {};
  state.currentInput = "";
  setFeedback("统计和学习记忆已清空。");
  persistAndRender();
  nextProblem();
}

function updateSetting(key, value) {
  if ((key === "practiceType" || key === "operation") && state.settings.focusMode !== "none") {
    state.settings.focusMode = "none";
  }

  state.settings[key] = value;

  if (key === "difficulty" && value === "break10" && state.settings.practiceType === "within10") {
    state.settings.practiceType = "within20";
    setFeedback("突破 10 已切到 20 以内。");
  }

  if (key === "focusMode") {
    applyFocusModeDefaults(value);
  }

  state.currentInput = "";
  if (key !== "orderMode") {
    state.stats.sequenceIndex = 0;
  }
  nextProblem();
}

function toggleHistorySort(key) {
  if (state.historySort.key === key) {
    state.historySort.order = state.historySort.order === "asc" ? "desc" : "asc";
  } else {
    state.historySort.key = key;
    state.historySort.order = key === "timestamp" ? "desc" : "asc";
  }
  persistAndRender();
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

function bindSegmented(groupElement, key) {
  groupElement.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) {
      return;
    }
    updateSetting(key, button.dataset.value);
  });
}

function bindDialogs() {
  elements.openSettingsButton.addEventListener("click", () => {
    elements.settingsDialog.showModal();
  });
  elements.closeSettingsDialog.addEventListener("click", () => {
    elements.settingsDialog.close();
  });

  elements.openReferenceButton.addEventListener("click", () => {
    elements.referenceDialog.showModal();
  });
  elements.closeReferenceDialog.addEventListener("click", () => {
    elements.referenceDialog.close();
  });

  elements.openHistoryButton.addEventListener("click", () => {
    elements.historyDialog.showModal();
  });
  elements.closeHistoryDialog.addEventListener("click", () => {
    elements.historyDialog.close();
  });

  elements.installHintButton.addEventListener("click", () => {
    elements.installDialog.showModal();
  });
  elements.closeInstallDialog.addEventListener("click", () => {
    elements.installDialog.close();
  });
}

function bindEvents() {
  bindSegmented(elements.practiceTypeGroup, "practiceType");
  bindSegmented(elements.operationGroup, "operation");
  bindSegmented(elements.orderModeGroup, "orderMode");
  bindSegmented(elements.difficultyGroup, "difficulty");
  bindSegmented(elements.focusModeGroup, "focusMode");
  bindSegmented(elements.teenFamilyGroup, "teenFamilyTarget");
  bindDialogs();

  elements.keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");
    if (!button) {
      return;
    }
    handleDigitInput(button.dataset.key);
  });

  elements.referenceButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) {
      return;
    }
    state.referenceView = button.dataset.view;
    persistAndRender();
  });

  elements.historyDialog.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sort-key]");
    if (!button) {
      return;
    }
    toggleHistorySort(button.dataset.sortKey);
  });

  elements.submitButton.addEventListener("click", submitAnswer);
  elements.nextQuestionButton.addEventListener("click", nextProblem);
  elements.resetStatsButton.addEventListener("click", resetStats);
  elements.clearMistakesButton.addEventListener("click", () => {
    state.mistakes = [];
    setFeedback("错题已清空。");
    persistAndRender();
  });
  elements.clearHistoryButton.addEventListener("click", () => {
    state.history = [];
    setFeedback("历史记录已清空。");
    persistAndRender();
  });

  window.addEventListener(
    "dblclick",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (event) => {
    if (/^\d$/.test(event.key)) {
      handleDigitInput(event.key);
      return;
    }
    if (event.key === "Backspace") {
      handleDigitInput("backspace");
      return;
    }
    if (event.key === "Enter") {
      submitAnswer();
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

function startLiveTimer() {
  if (timerHandle) {
    window.clearInterval(timerHandle);
  }
  timerHandle = window.setInterval(renderLiveTimer, 100);
}

function init() {
  bindEvents();
  persistAndRender();
  nextProblem();
  startLiveTimer();
  registerServiceWorker();
}

init();
