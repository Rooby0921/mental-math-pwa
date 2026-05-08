const STORAGE_KEY = "mental-math-pwa-state-v3";
const MAX_MISTAKES = 12;
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
  },
  referenceView: "within10",
  stats: {
    totalAnswered: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    sequenceIndex: 0,
  },
  mistakes: [],
  currentProblem: null,
  currentInput: "",
};

const state = loadState();
let problemBank = [];
let lastProblemId = "";

const elements = {
  practiceTypeGroup: document.querySelector("#practiceTypeGroup"),
  operationGroup: document.querySelector("#operationGroup"),
  orderModeGroup: document.querySelector("#orderModeGroup"),
  difficultyGroup: document.querySelector("#difficultyGroup"),
  difficultyHint: document.querySelector("#difficultyHint"),
  questionModeLabel: document.querySelector("#questionModeLabel"),
  questionLeft: document.querySelector("#questionLeft"),
  questionOperator: document.querySelector("#questionOperator"),
  questionRight: document.querySelector("#questionRight"),
  answerDisplay: document.querySelector("#answerDisplay"),
  feedbackMessage: document.querySelector("#feedbackMessage"),
  sessionSummary: document.querySelector("#sessionSummary"),
  streakValue: document.querySelector("#streakValue"),
  accuracyValue: document.querySelector("#accuracyValue"),
  correctCountValue: document.querySelector("#correctCountValue"),
  wrongCountValue: document.querySelector("#wrongCountValue"),
  mistakeBankValue: document.querySelector("#mistakeBankValue"),
  keypad: document.querySelector("#keypad"),
  submitButton: document.querySelector("#submitButton"),
  nextQuestionButton: document.querySelector("#nextQuestionButton"),
  resetStatsButton: document.querySelector("#resetStatsButton"),
  mistakeList: document.querySelector("#mistakeList"),
  clearMistakesButton: document.querySelector("#clearMistakesButton"),
  referenceButtons: document.querySelector("#referenceButtons"),
  referenceContent: document.querySelector("#referenceContent"),
  installHintButton: document.querySelector("#installHintButton"),
  installDialog: document.querySelector("#installDialog"),
  closeInstallDialog: document.querySelector("#closeInstallDialog"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return cloneDefaultState();
    return {
      settings: { ...defaultState.settings, ...saved.settings },
      referenceView:
        typeof saved.referenceView === "string"
          ? saved.referenceView
          : defaultState.referenceView,
      stats: { ...defaultState.stats, ...saved.stats },
      mistakes: Array.isArray(saved.mistakes) ? saved.mistakes : [],
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
      if (operation === "addition") {
        for (let left = 10; left <= 99; left += 1) {
          for (let right = 1; right <= 9; right += 1) {
            if (left + right <= 99) {
              bank.push(makeProblem(left, right, operation));
            }
          }
        }
      } else {
        for (let left = 10; left <= 99; left += 1) {
          for (let right = 1; right <= 9; right += 1) {
            bank.push(makeProblem(left, right, operation));
          }
        }
      }
    }
  }

  return bank.filter((problem) => isProblemAllowed(problem, settings));
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

function nextProblem() {
  problemBank = buildProblemBank(state.settings);
  if (problemBank.length === 0) {
    state.currentProblem = null;
    state.currentInput = "";
    setFeedback("这个组合暂时没有题，换个题型或难度试试。", "is-wrong");
    persistAndRender();
    return;
  }

  let problem;
  if (state.settings.orderMode === "sequence") {
    const index = state.stats.sequenceIndex % problemBank.length;
    problem = problemBank[index];
    state.stats.sequenceIndex = (index + 1) % problemBank.length;
  } else {
    if (problemBank.length === 1) {
      problem = problemBank[0];
    } else {
      do {
        problem = problemBank[Math.floor(Math.random() * problemBank.length)];
      } while (problem.id === lastProblemId);
    }
  }

  state.currentProblem = problem;
  state.currentInput = "";
  lastProblemId = problem.id;
  setFeedback("准备好了就开始。");
  persistAndRender();
}

function setFeedback(message, kind = "") {
  elements.feedbackMessage.textContent = message;
  elements.feedbackMessage.classList.remove("is-correct", "is-wrong");
  if (kind) {
    elements.feedbackMessage.classList.add(kind);
  }
}

function formatSettingsLabel() {
  return `${PRACTICE_TYPE_LABELS[state.settings.practiceType]} · ${
    OPERATION_LABELS[state.settings.operation]
  } · ${ORDER_MODE_LABELS[state.settings.orderMode]} · ${
    DIFFICULTY_RULES[state.settings.difficulty].label
  }`;
}

function renderProblem() {
  const problem = state.currentProblem || makeProblem(7, 5, "addition");
  elements.questionLeft.textContent = String(problem.left);
  elements.questionOperator.textContent = problem.operator;
  elements.questionRight.textContent = String(problem.right);
  elements.answerDisplay.textContent = state.currentInput || "?";
  elements.questionModeLabel.textContent = formatSettingsLabel();
}

function renderDifficultyHint() {
  elements.difficultyHint.textContent = DIFFICULTY_RULES[state.settings.difficulty].hint;
}

function renderStats() {
  const { totalAnswered, correct, wrong, streak } = state.stats;
  const accuracy = totalAnswered ? Math.round((correct / totalAnswered) * 100) : 0;
  elements.sessionSummary.textContent = `${totalAnswered} 题`;
  elements.streakValue.textContent = String(streak);
  elements.accuracyValue.textContent = `${accuracy}%`;
  elements.correctCountValue.textContent = String(correct);
  elements.wrongCountValue.textContent = String(wrong);
  elements.mistakeBankValue.textContent = String(state.mistakes.length);
}

function renderSegmented(groupElement, value) {
  for (const button of groupElement.querySelectorAll("button")) {
    button.classList.toggle("is-active", button.dataset.value === value);
  }
}

function getReferenceData(view) {
  if (view === "multiplication") {
    return {
      title: "9×9 乘法口诀表",
      description: "按行看更顺手，每行都是一个乘法家族。",
      cards: [
        {
          title: "乘法口诀",
          rows: buildMultiplicationRows(),
        },
      ],
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
        detail.className = "toolbar-note";
        detail.textContent = row.detail;
        item.append(detail);
      }
      grid.appendChild(item);
    });

    section.append(heading, grid);
    elements.referenceContent.appendChild(section);
  });
}

function renderMistakes() {
  elements.mistakeList.innerHTML = "";
  if (state.mistakes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "mistake-empty";
    emptyItem.textContent = "还没有错题，继续保持。";
    elements.mistakeList.appendChild(emptyItem);
    return;
  }

  state.mistakes.forEach((item) => {
    const row = document.createElement("li");
    const problemText = document.createElement("span");
    problemText.textContent = `${item.left} ${item.operator} ${item.right} = ${item.answer}`;
    const wrongText = document.createElement("span");
    wrongText.textContent = `曾输入 ${item.userAnswer}`;
    row.append(problemText, wrongText);
    elements.mistakeList.appendChild(row);
  });
}

function persistAndRender() {
  saveState();
  renderProblem();
  renderStats();
  renderDifficultyHint();
  renderReferenceView();
  renderMistakes();
  renderSegmented(elements.practiceTypeGroup, state.settings.practiceType);
  renderSegmented(elements.operationGroup, state.settings.operation);
  renderSegmented(elements.orderModeGroup, state.settings.orderMode);
  renderSegmented(elements.difficultyGroup, state.settings.difficulty);
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

function submitAnswer() {
  if (!state.currentProblem) {
    nextProblem();
    return;
  }

  if (state.currentInput === "") {
    setFeedback("先输入答案。", "is-wrong");
    return;
  }

  const userAnswer = Number(state.currentInput);
  const isCorrect = userAnswer === state.currentProblem.answer;
  state.stats.totalAnswered += 1;

  if (isCorrect) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    setFeedback("答对了，真不错。", "is-correct");
    persistAndRender();
    window.setTimeout(nextProblem, 500);
  } else {
    state.stats.wrong += 1;
    state.stats.streak = 0;
    saveMistake(state.currentProblem, userAnswer);
    setFeedback(`这题答案是 ${state.currentProblem.answer}。`, "is-wrong");
    persistAndRender();
    window.setTimeout(nextProblem, 1000);
  }
}

function resetStats() {
  state.stats = { ...defaultState.stats };
  state.currentInput = "";
  setFeedback("记录已清空。");
  persistAndRender();
  nextProblem();
}

function updateSetting(key, value) {
  state.settings[key] = value;

  if (key === "difficulty" && value === "break10" && state.settings.practiceType === "within10") {
    state.settings.practiceType = "within20";
    setFeedback("突破 10 已切到 20 以内。");
  }

  state.currentInput = "";
  if (key !== "orderMode") {
    state.stats.sequenceIndex = 0;
  }
  nextProblem();
}

function bindSegmented(groupElement, key) {
  groupElement.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    updateSetting(key, button.dataset.value);
  });
}

function bindEvents() {
  bindSegmented(elements.practiceTypeGroup, "practiceType");
  bindSegmented(elements.operationGroup, "operation");
  bindSegmented(elements.orderModeGroup, "orderMode");
  bindSegmented(elements.difficultyGroup, "difficulty");

  elements.keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");
    if (!button) return;
    handleDigitInput(button.dataset.key);
  });

  elements.submitButton.addEventListener("click", submitAnswer);
  elements.nextQuestionButton.addEventListener("click", nextProblem);
  elements.resetStatsButton.addEventListener("click", resetStats);
  elements.clearMistakesButton.addEventListener("click", () => {
    state.mistakes = [];
    setFeedback("错题已清空。");
    persistAndRender();
  });
  elements.referenceButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) return;
    state.referenceView = button.dataset.view;
    persistAndRender();
  });

  elements.installHintButton.addEventListener("click", () => {
    elements.installDialog.showModal();
  });
  elements.closeInstallDialog.addEventListener("click", () => {
    elements.installDialog.close();
  });

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

function init() {
  bindEvents();
  persistAndRender();
  nextProblem();
  registerServiceWorker();
}

init();
