(function () {
  "use strict";

  // ------------------------------------------------------------
  // データ準備
  // 将来、令和5年度などのデータを追加するときは、
  // 同じ形式の data/questions-rXX.js を読み込んで、この配列に
  // concat するだけで「ランダムに解く」に自動的に混ざります。
  // ------------------------------------------------------------
  var ALL_QUESTIONS = [].concat(
    typeof QUESTIONS_R06 !== "undefined" ? QUESTIONS_R06 : []
  );

  var WRONG_STORAGE_KEY = "skillsExamApp_wrongQuestions_v1";

  // ------------------------------------------------------------
  // localStorage: 間違えた問題の管理
  // { [questionId]: { count: number, lastWrongAt: ISOString } }
  // ------------------------------------------------------------
  function loadWrongMap() {
    try {
      var raw = localStorage.getItem(WRONG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveWrongMap(map) {
    try {
      localStorage.setItem(WRONG_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      // localStorageが使えない環境でもアプリ自体は動作させる
    }
  }

  function markAsCorrect(questionId) {
    var map = loadWrongMap();
    if (map[questionId]) {
      delete map[questionId];
      saveWrongMap(map);
    }
  }

  function markAsWrong(questionId) {
    var map = loadWrongMap();
    var entry = map[questionId] || { count: 0 };
    entry.count += 1;
    entry.lastWrongAt = new Date().toISOString();
    map[questionId] = entry;
    saveWrongMap(map);
  }

  // ------------------------------------------------------------
  // ユーティリティ
  // ------------------------------------------------------------
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function showScreen(name) {
    ["top", "quiz", "result"].forEach(function (n) {
      el("screen-" + n).hidden = n !== name;
    });
  }

  // ------------------------------------------------------------
  // アプリの状態
  // ------------------------------------------------------------
  var state = {
    list: [],
    index: 0,
    correctCount: 0,
    wrongCount: 0,
    mode: null,
    answered: false
  };

  function updateWrongCountDesc() {
    var map = loadWrongMap();
    var count = Object.keys(map).length;
    var descEl = el("wrong-count-desc");
    if (count === 0) {
      descEl.textContent = "まだ間違えた問題はありません。問題を解くとここに反映されます。";
    } else {
      descEl.textContent = "現在 " + count + " 問が「間違えた問題」として保存されています。";
    }
  }

  // ------------------------------------------------------------
  // クイズ開始
  // ------------------------------------------------------------
  function startQuiz(opts) {
    var list;

    if (opts.mode === "year") {
      list = ALL_QUESTIONS.filter(function (q) {
        return q.year === opts.year;
      });
    } else if (opts.mode === "random") {
      list = shuffle(ALL_QUESTIONS);
    } else if (opts.mode === "wrong") {
      var wrongMap = loadWrongMap();
      var ids = Object.keys(wrongMap);
      list = shuffle(
        ALL_QUESTIONS.filter(function (q) {
          return ids.indexOf(q.id) !== -1;
        })
      );
      if (list.length === 0) {
        alert("まだ間違えた問題がありません。他のメニューから問題を解いてみてください。");
        return;
      }
    } else {
      list = [];
    }

    state = {
      list: list,
      index: 0,
      correctCount: 0,
      wrongCount: 0,
      mode: opts.mode,
      answered: false
    };

    showScreen("quiz");
    renderQuestion();
  }

  // ------------------------------------------------------------
  // 問題の描画
  // ------------------------------------------------------------
  function renderQuestion() {
    var q = state.list[state.index];
    state.answered = false;

    el("quiz-progress").textContent =
      (state.index + 1) + " / " + state.list.length + " 問目";
    el("quiz-source").textContent =
      q.yearLabel + " " + q.groupLabel + " 問題" + String(q.number).padStart(2, "0");

    el("quiz-question").textContent = q.text;

    var imageWrap = el("quiz-image-wrap");
    var imageEl = el("quiz-image");
    if (q.image) {
      imageEl.src = "data/" + q.image;
      imageWrap.hidden = false;
    } else {
      imageEl.removeAttribute("src");
      imageWrap.hidden = true;
    }

    var choiceForm = el("quiz-choices");
    choiceForm.innerHTML = "";
    q.choices.forEach(function (choice) {
      var label = document.createElement("label");
      label.className = "choice-item";
      label.dataset.key = choice.key;

      var input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.value = choice.key;
      input.addEventListener("change", function () {
        el("btn-answer").disabled = false;
        Array.prototype.forEach.call(
          choiceForm.querySelectorAll(".choice-item"),
          function (item) {
            item.classList.remove("is-selected");
          }
        );
        label.classList.add("is-selected");
      });

      var span = document.createElement("span");
      var keySpan = document.createElement("span");
      keySpan.className = "choice-item__key";
      keySpan.textContent = choice.key;
      span.appendChild(keySpan);
      span.appendChild(document.createTextNode(choice.text || ""));

      label.appendChild(input);
      label.appendChild(span);
      choiceForm.appendChild(label);
    });

    el("btn-answer").disabled = true;
    el("btn-answer").hidden = false;
    el("quiz-feedback").hidden = true;
  }

  function handleAnswer() {
    if (state.answered) return;

    var q = state.list[state.index];
    var selected = document.querySelector('#quiz-choices input[name="answer"]:checked');
    if (!selected) return;

    var selectedKey = selected.value;
    var isCorrect = selectedKey === q.correctAnswer;
    state.answered = true;

    if (isCorrect) {
      state.correctCount += 1;
      markAsCorrect(q.id);
    } else {
      state.wrongCount += 1;
      markAsWrong(q.id);
    }

    Array.prototype.forEach.call(
      document.querySelectorAll("#quiz-choices .choice-item"),
      function (item) {
        var key = item.dataset.key;
        if (key === q.correctAnswer) {
          item.classList.add("is-correct");
        } else if (key === selectedKey) {
          item.classList.add("is-incorrect");
        }
      }
    );

    var resultEl = el("feedback-result");
    if (isCorrect) {
      resultEl.textContent = "正解！";
      resultEl.className = "feedback-result is-correct";
    } else {
      resultEl.textContent = "不正解";
      resultEl.className = "feedback-result is-incorrect";
    }

    el("feedback-correct").textContent = formatAnswerLabel(q, q.correctAnswer);
    el("feedback-explanation-text").textContent = q.explanation;

    var noteEl = el("feedback-confidence-note");
    if (q.confidence === "low" || q.confidence === "medium") {
      noteEl.hidden = false;
      noteEl.textContent = "※この解説はAIが作成した参考情報です。断定が難しい内容を含むため、正式な学習前に人による確認をおすすめします。";
    } else {
      noteEl.hidden = true;
    }

    el("btn-answer").hidden = true;
    el("quiz-feedback").hidden = false;
  }

  function formatAnswerLabel(q, key) {
    var choice = q.choices.filter(function (c) {
      return c.key === key;
    })[0];
    if (!choice) return key;
    if (q.type === "truefalse") {
      return key;
    }
    return key + "　" + (choice.text || "");
  }

  function goNext() {
    state.index += 1;
    if (state.index >= state.list.length) {
      renderResult();
      showScreen("result");
    } else {
      renderQuestion();
    }
  }

  // ------------------------------------------------------------
  // 結果画面
  // ------------------------------------------------------------
  function renderResult() {
    var total = state.list.length;
    var correct = state.correctCount;
    var wrong = state.wrongCount;
    var rate = total > 0 ? Math.round((correct / total) * 100) : 0;

    el("result-total").textContent = total;
    el("result-correct").textContent = correct;
    el("result-wrong").textContent = wrong;
    el("result-rate").textContent = rate + "%";

    var retryBtn = el("btn-retry-wrong");
    var wrongMap = loadWrongMap();
    retryBtn.hidden = Object.keys(wrongMap).length === 0;

    updateWrongCountDesc();
  }

  // ------------------------------------------------------------
  // イベント登録
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    updateWrongCountDesc();

    Array.prototype.forEach.call(document.querySelectorAll(".menu-btn"), function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.dataset.mode;
        var year = btn.dataset.year;
        startQuiz({ mode: mode, year: year });
      });
    });

    el("btn-answer").addEventListener("click", handleAnswer);
    el("btn-next").addEventListener("click", goNext);

    el("btn-back-top").addEventListener("click", function () {
      updateWrongCountDesc();
      showScreen("top");
    });

    el("btn-retry-wrong").addEventListener("click", function () {
      startQuiz({ mode: "wrong" });
    });
  });
})();
