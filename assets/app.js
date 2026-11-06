/* ============================================================
   她学编程 · 全站交互脚本
   功能：阅读设置（字号/主题/动画）、朗读、代码运行、测验、
        学习进度与花瓣进度、无障碍提示
   ============================================================ */
(function () {
  "use strict";

  var TOTAL_LESSONS = 7; // 第 0 课 ~ 第 6 课
  var STORE_SETTINGS = "hx.settings";
  var STORE_PROGRESS = "hx.progress";
  var FONT_STEPS = [18, 20, 22, 25];

  /* ---------- 小工具 ---------- */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function storeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 无痕模式等情况：静默失败，不打断学习 */
    }
  }
  function announce(message) {
    var toast = $("#toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-on");
    window.clearTimeout(announce._timer);
    announce._timer = window.setTimeout(function () {
      toast.classList.remove("is-on");
    }, 2600);
  }

  /* ---------- 1. 阅读设置 ---------- */
  var settings = storeGet(STORE_SETTINGS, {});
  var fontIndex = typeof settings.font === "number" ? settings.font : 1;
  fontIndex = Math.max(0, Math.min(FONT_STEPS.length - 1, fontIndex));

  var theme = settings.theme;
  if (theme !== "dark" && theme !== "light") {
    theme =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }
  var motion = settings.motion || ""; // "" 跟随系统 / "reduce" / "on"

  function applySettings() {
    var root = document.documentElement;
    root.style.fontSize = FONT_STEPS[fontIndex] + "px";
    root.setAttribute("data-theme", theme);
    if (motion) {
      root.setAttribute("data-motion", motion);
    } else {
      root.removeAttribute("data-motion");
    }
    storeSet(STORE_SETTINGS, { font: fontIndex, theme: theme, motion: motion });

    $$("[data-font]").forEach(function (btn) {
      var dir = btn.getAttribute("data-font");
      btn.disabled = dir === "down" ? fontIndex === 0 : fontIndex === FONT_STEPS.length - 1;
    });
    var themeBtn = $("[data-theme-toggle]");
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      themeBtn.setAttribute(
        "aria-label",
        theme === "dark" ? "☀ 切换浅色模式（当前深色）" : "☾ 切换深色模式（当前浅色）"
      );
      themeBtn.title = theme === "dark" ? "浅色模式" : "深色模式";
      themeBtn.textContent = theme === "dark" ? "☀" : "☾";
    }
    var motionBtn = $("[data-motion-toggle]");
    if (motionBtn) {
      var reduced = motion === "reduce" || (motion === "" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      motionBtn.setAttribute("aria-pressed", reduced ? "true" : "false");
      motionBtn.setAttribute(
        "aria-label",
        reduced ? "◌ 恢复动画效果（当前已减少动画）" : "✳ 减少动画效果"
      );
      motionBtn.title = reduced ? "恢复动画" : "减少动画";
      motionBtn.textContent = reduced ? "◌" : "✳";
    }
  }

  function initSettings() {
    applySettings();
    $$("[data-font]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dir = btn.getAttribute("data-font");
        fontIndex = Math.max(0, Math.min(FONT_STEPS.length - 1, fontIndex + (dir === "up" ? 1 : -1)));
        applySettings();
        announce(dir === "up" ? "字号放大了" : "字号调小了");
      });
    });
    var themeBtn = $("[data-theme-toggle]");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        theme = theme === "dark" ? "light" : "dark";
        applySettings();
        announce(theme === "dark" ? "已换成深色背景" : "已换成浅色背景");
      });
    }
    var motionBtn = $("[data-motion-toggle]");
    if (motionBtn) {
      motionBtn.addEventListener("click", function () {
        var reduced =
          motion === "reduce" ||
          (motion === "" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        motion = reduced ? "on" : "reduce";
        applySettings();
        announce(reduced ? "已恢复动画效果" : "已减少动画效果");
      });
    }
    $$("[data-reset-settings]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        fontIndex = 1;
        theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        motion = "";
        applySettings();
        announce("阅读设置已恢复默认");
      });
    });
  }

  /* ---------- 2. 朗读（把文字读给你听） ---------- */
  var speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  var currentSpeakBtn = null;

  function pickChineseVoice() {
    var voices = window.speechSynthesis.getVoices() || [];
    var zh = voices.filter(function (v) {
      return /^zh(-|_)?/i.test(v.lang || "") || /chinese|中文|普通话/i.test(v.name || "");
    });
    if (!zh.length) return null;
    var cn = zh.filter(function (v) {
      return /zh[-_]CN/i.test(v.lang || "") || /普通话|Mandarin|Ting|Mei|Xiaoxiao|Yunxi/i.test(v.name || "");
    });
    return (cn.length ? cn : zh)[0];
  }

  function stopSpeaking() {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    if (currentSpeakBtn) {
      currentSpeakBtn.setAttribute("aria-pressed", "false");
      var label = currentSpeakBtn.getAttribute("data-label") || "读给我听";
      currentSpeakBtn.textContent = "🔊 " + label;
      currentSpeakBtn = null;
    }
  }

  function splitSentences(text) {
    var chunks = [];
    var normalized = String(text).replace(/\s+/g, " ");
    // 不用 lookbehind 正则：老版本 Safari 会直接语法报错，整站脚本都跑不起来
    var parts = normalized.match(/[^。！？；!?]+[。！？；!?]?/g) || [normalized];
    var buffer = "";
    parts.forEach(function (part) {
      if ((buffer + part).length > 90) {
        if (buffer.trim()) chunks.push(buffer.trim());
        buffer = part;
      } else {
        buffer += part;
      }
    });
    if (buffer.trim()) chunks.push(buffer.trim());
    return chunks.filter(function (c) {
      return c.length > 1;
    });
  }

  function speakText(text, btn) {
    if (!speechSupported) return;
    stopSpeaking();
    var chunks = splitSentences(text);
    if (!chunks.length) return;
    var voice = pickChineseVoice();
    chunks.forEach(function (chunk, index) {
      var utter = new SpeechSynthesisUtterance(chunk);
      utter.lang = "zh-CN";
      utter.rate = 0.92;
      utter.pitch = 1;
      if (voice) utter.voice = voice;
      if (index === chunks.length - 1) {
        utter.onend = function () {
          stopSpeaking();
        };
      }
      window.speechSynthesis.speak(utter);
    });
    if (btn) {
      currentSpeakBtn = btn;
      btn.setAttribute("aria-pressed", "true");
      btn.textContent = "⏸ 停止朗读";
    }
  }

  function initSpeech() {
    $$("[data-speak]").forEach(function (btn) {
      btn.setAttribute("data-label", btn.textContent.trim().replace(/^🔊\s*/, ""));
      btn.addEventListener("click", function () {
        if (!speechSupported) {
          announce("这个浏览器不支持朗读，可以换个浏览器试试");
          return;
        }
        if (currentSpeakBtn === btn && window.speechSynthesis.speaking) {
          stopSpeaking();
          return;
        }
        var ids = (btn.getAttribute("data-speak") || "").split(",");
        var texts = ids
          .map(function (id) {
            var el = document.getElementById(id.trim());
            return el ? el.innerText || el.textContent : "";
          })
          .join(" ");
        if (texts.trim()) {
          speakText(texts.trim(), btn);
          announce("开始朗读，按 Esc 可以随时停止");
        }
      });
    });
    if (!speechSupported) {
      $$("[data-speak]").forEach(function (btn) {
        btn.style.display = "none";
      });
      $$("[data-tts-note]").forEach(function (el) {
        el.hidden = false;
      });
      return;
    }
    if (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices().length) {
      pickChineseVoice();
    }
    if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
      window.speechSynthesis.onvoiceschanged = function () {
        pickChineseVoice();
      };
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") stopSpeaking();
    });
    window.addEventListener("beforeunload", stopSpeaking);
  }

  /* ---------- 3. 代码运行区 ---------- */
  var BASE_STYLE =
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<style>" +
    "html{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;" +
    "font-size:18px;line-height:1.75;color:#241f1b;background:#fffdf9;padding:16px 18px;}" +
    "body{margin:0;}h1{font-size:1.7rem;line-height:1.3;}h2{font-size:1.35rem;}p{margin:.6em 0;}" +
    "img{max-width:100%;height:auto;}strong{font-weight:700;}ul{padding-left:1.3em;}" +
    "#__out{white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:15px;" +
    "line-height:1.85;color:#14352a;background:#eaf5ee;border-radius:10px;padding:12px 14px;min-height:3em;margin:0;}" +
    "</style>";

  // JS 动手区的结果区做成"深色控制台"，和文字内容区分开
  var JS_STYLE =
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<style>" +
    "html,body{margin:0;padding:0;background:#1f2a24;color:#d9f2e3;}" +
    "body{padding:14px 16px;font-family:ui-monospace,Menlo,Consolas,'Courier New',monospace;font-size:15px;line-height:1.9;}" +
    "#__out{white-space:pre-wrap;margin:0;min-height:2em;font-family:inherit;font-size:inherit;color:inherit;}" +
    "</style>";

  function buildDocument(code, mode) {
    if (mode === "js") {
      // 把用户代码放进 new Function 里执行，这样连"语法错误"也能被捕获并翻译，
      // 而不是让整个预览区空白一片。
      var codeJson = JSON.stringify(String(code)).replace(/</g, "\\u003c");
      return (
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
        JS_STYLE +
        '</head><body><pre id="__out"></pre><script>\n(function(){\n' +
        'var out=document.getElementById("__out");\n' +
        'function show(t){out.textContent+=t+"\\n";}\n' +
        'function __str(a){return a===undefined?"undefined":a;}\n' +
        'function friendly(m){' +
        'var s=String(m||"");' +
        'if(/Invalid or unexpected token|Unexpected token|Unexpected identifier/i.test(s)){return "这段代码里有个符号电脑没看懂。检查三样：引号是不是打成中文的了、括号有没有配对、每句结尾是不是漏了分号。";}' +
        'if(/Unexpected end of input|missing \\)|missing \\}/i.test(s)){return "代码好像没写完：可能少了一个右引号、右括号或右花括号。";}' +
        'if(/is not defined/i.test(s)){return "有个名字电脑不认识。检查一下拼写；文字外面是不是忘了加引号。";}' +
        'if(/Cannot read|is not a function|of undefined|of null/i.test(s)){return "电脑读到一个空的东西。检查一下变量名有没有写错，或者那个变量是不是还没赋值。";}' +
        'return "运行出错了。先检查引号、括号、分号这三样，再点一次运行。";}' +
        'console.log=function(){show(Array.prototype.map.call(arguments,__str).join(" "));};\n' +
        'console.info=console.log;\n' +
        'console.warn=function(){show("提示："+Array.prototype.map.call(arguments,__str).join(" "));};\n' +
        'console.error=function(){show("出错："+Array.prototype.map.call(arguments,__str).join(" "));};\n' +
        'var __code=' + codeJson + ';\n' +
        'try{ (new Function(__code))(); }catch(err){ show("❌ " + friendly(err && err.message ? err.message : err)); }\n' +
        "})();\n<\/script></body></html>"
      );
    }
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' + BASE_STYLE + "</head><body>" + code + "</body></html>";
  }

  function initPlaygrounds() {
    $$("[data-playground]").forEach(function (box, boxIndex) {
      var mode = box.getAttribute("data-playground") || "html";
      var editor = $(".pg-editor", box);
      var frame = $(".pg-frame", box);
      var consoleEl = $(".pg-console", box);
      var status = $(".pg-status", box);
      var runBtn = $("[data-run]", box);
      var resetBtn = $("[data-reset]", box);
      if (!editor || !frame) return;
      editor.id = editor.id || "pg-editor-" + boxIndex;
      var original = editor.value;

      // 草稿：把改动存在本机浏览器里，误关页面或刷新后还能找回来
      var draftKey = null;
      var draftTimer = null;
      var restoredNote = null;
      try {
        draftKey = "hx.draft." + window.location.pathname + "." + boxIndex;
        var savedDraft = window.localStorage.getItem(draftKey);
        if (savedDraft !== null && savedDraft !== original) {
          editor.value = savedDraft;
          restoredNote = "已恢复你上次没保存的改动。想从头来，点“恢复原样”。";
        }
      } catch (e) {
        draftKey = null;
      }

      // 两种模式都用 iframe 显示结果：JS 模式是深色控制台，HTML 模式是网页预览。
      frame.hidden = false;
      if (consoleEl) consoleEl.hidden = true;

      function run(silent) {
        var code = editor.value;
        try {
          frame.srcdoc = buildDocument(code, mode);
          if (status) {
            status.classList.remove("is-error");
            status.classList.add("is-ok");
            status.textContent = silent ? "" : "已经运行了，结果在上面的运行结果框里。";
          }
        } catch (err) {
          if (status) {
            status.classList.remove("is-ok");
            status.classList.add("is-error");
            status.textContent = "这段代码没能运行：" + (err && err.message ? err.message : err);
          }
        }
      }

      if (runBtn) {
        runBtn.addEventListener("click", function () {
          run(false);
        });
      }
      if (resetBtn) {
        resetBtn.addEventListener("click", function () {
          editor.value = original;
          if (draftKey) {
            try {
              window.localStorage.removeItem(draftKey);
            } catch (e) {
              /* 忽略 */
            }
          }
          run(false);
          if (status) {
            status.classList.remove("is-error");
            status.classList.add("is-ok");
            status.textContent = "已经恢复成原来的样子。";
          }
        });
      }
      editor.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          run(false);
        }
      });
      if (draftKey) {
        editor.addEventListener("input", function () {
          window.clearTimeout(draftTimer);
          draftTimer = window.setTimeout(function () {
            try {
              window.localStorage.setItem(draftKey, editor.value);
            } catch (e) {
              /* 存不下就算了，不打断学习 */
            }
          }, 500);
        });
      }
      // 首次进入自动展示一次结果，让学习者先“看见”
      run(true);
      if (restoredNote && status) {
        status.classList.add("is-ok");
        status.textContent = restoredNote;
      }
    });
  }

  /* ---------- 4. 小测验 ---------- */
  function initQuizzes() {
    $$("[data-quiz]").forEach(function (quiz, quizIndex) {
      var feedback = $(".quiz-feedback", quiz);
      var options = $$(".quiz-opt", quiz);
      var question = $(".quiz-q", quiz);
      var optionBox = $(".quiz-options", quiz);
      if (question && optionBox) {
        var qid = "quiz-question-" + quizIndex + "-" + String(window.location.pathname).replace(/[^a-zA-Z0-9]/g, "");
        question.id = qid;
        optionBox.setAttribute("role", "group");
        optionBox.setAttribute("aria-labelledby", qid);
      }
      options.forEach(function (opt) {
        opt.addEventListener("click", function () {
          if (quiz.getAttribute("data-solved") === "1") return;
          var correct = opt.getAttribute("data-correct") === "true";
          if (correct) {
            quiz.setAttribute("data-solved", "1");
            opt.classList.add("is-right");
            options.forEach(function (other) {
              other.disabled = other !== opt;
              if (other !== opt && other.classList.contains("is-wrong")) {
                other.classList.remove("is-wrong");
              }
            });
            if (feedback) {
              feedback.classList.remove("is-wrong");
              feedback.classList.add("is-right");
              feedback.textContent = "答对了。" + (feedback.getAttribute("data-ok") || "");
            }
            announce("答对了");
          } else {
            opt.classList.add("is-wrong");
            if (feedback) {
              feedback.classList.remove("is-right");
              feedback.classList.add("is-wrong");
              feedback.textContent = feedback.getAttribute("data-no") || "再想一想，你可以直接换个答案试试。";
            }
            announce("再想一想，可以换一个答案");
          }
        });
      });
    });
  }

  /* ---------- 5. 学习进度 ---------- */
  function getProgress() {
    var p = storeGet(STORE_PROGRESS, {});
    return p && typeof p === "object" ? p : {};
  }
  function saveProgress(p) {
    storeSet(STORE_PROGRESS, p);
  }
  function doneCount() {
    var p = getProgress();
    var n = 0;
    for (var i = 0; i < TOTAL_LESSONS; i++) {
      if (p[String(i)]) n++;
    }
    return n;
  }

  function paintProgress() {
    var p = getProgress();
    var n = doneCount();

    // 课程页顶部进度条
    $$(".course-progress").forEach(function (bar) {
      bar.setAttribute("aria-valuenow", String(n));
      bar.setAttribute("aria-valuetext", "已学 " + n + " 课，共 " + TOTAL_LESSONS + " 课");
      var fill = $(".course-progress-bar", bar);
      if (fill) fill.style.width = (n / TOTAL_LESSONS) * 100 + "%";
    });

    // 首页课程地图
    $$(".lesson-row[data-lesson]").forEach(function (row) {
      var num = row.getAttribute("data-lesson");
      if (num === null) return;
      var done = !!p[num];
      row.classList.toggle("is-done", done);
      var status = $("[data-status]", row);
      if (status) status.textContent = done ? "✓ 已学完" : "还没学";
    });

    // 花瓣
    var flower = $(".flower");
    if (flower) {
      $$(".petal", flower).forEach(function (petal, index) {
        petal.classList.toggle("is-open", index < n);
      });
      flower.setAttribute("aria-label", "学习进度：七片花瓣已开 " + n + " 片，共 7 片");
    }

    // 数字文案
    $$("[data-progress-text]").forEach(function (el) {
      el.textContent = "已学 " + n + " / " + TOTAL_LESSONS + " 课";
    });

    // 首页“下一课”按钮（可能有多个入口）
    var inLessonsDir = /\/lessons\//.test(window.location.pathname);
    var nextIndex = 0;
    while (nextIndex < TOTAL_LESSONS && p[String(nextIndex)]) nextIndex++;
    $$("[data-next-lesson]").forEach(function (nextBtn) {
      if (n >= TOTAL_LESSONS) {
        nextBtn.textContent = "七课都学完了，去看看结业作品 →";
        nextBtn.setAttribute("href", inLessonsDir ? "../project.html" : "project.html");
      } else {
        nextBtn.textContent = (n === 0 ? "从第 0 课开始" : "继续第 " + nextIndex + " 课") + " →";
        nextBtn.setAttribute("href", inLessonsDir ? "lesson-" + nextIndex + ".html" : "lessons/lesson-" + nextIndex + ".html");
      }
    });

    // 课程页“已学”按钮状态
    var body = document.body;
    var lessonNum = body ? body.getAttribute("data-lesson") : null;
    if (lessonNum !== null) {
      var done = !!p[lessonNum];
      $$("[data-complete='" + lessonNum + "']").forEach(function (btn) {
        if (done) {
          btn.textContent = "✓ 这一课已经学完";
          btn.classList.add("is-done");
          btn.setAttribute("aria-pressed", "true");
        } else {
          btn.textContent = "我学完这一课了";
          btn.classList.remove("is-done");
          btn.setAttribute("aria-pressed", "false");
        }
      });
    }
  }

  function initProgress() {
    $$("[data-complete]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        var num = btn.getAttribute("data-complete");
        var p = getProgress();
        if (p[num]) {
          announce("这一课已经标记为学完了，不用再点。");
          return;
        }
        p[num] = true;
        saveProgress(p);
        paintProgress();
        var n = doneCount();
        announce("第 " + num + " 课完成，花瓣已开 " + n + " 片，共 7 片");
      });
    });
    paintProgress();
  }

  /* ---------- 6. 启动 ---------- */
  function init() {
    initSettings();
    initSpeech();
    initPlaygrounds();
    initQuizzes();
    initProgress();
    // 给所有按钮补上最小可点区域提示（仅屏幕阅读器）
    $$("a[target='_blank']").forEach(function (a) {
      a.setAttribute("rel", "noopener noreferrer");
      if (!/打开|新窗口/.test(a.getAttribute("aria-label") || "")) {
        a.setAttribute("aria-label", (a.textContent || "").trim() + "（在新窗口打开）");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
