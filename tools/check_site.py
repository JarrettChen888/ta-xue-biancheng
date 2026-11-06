#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
她学编程 · 全站静态检查
用法：python3 tools/check_site.py
退出码：0 = 全部必须项通过（允许 warning）；1 = 有 error
"""
import os
import re
import sys
import json
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LESSON_FILES = ["lessons/lesson-%d.html" % i for i in range(7)]
OTHER_FILES = ["index.html", "start.html", "help.html", "project.html"]
ALL_FILES = OTHER_FILES[:3] + LESSON_FILES + ["project.html"]

REQUIRED = ["index.html", "start.html", "help.html", "assets/styles.css", "assets/app.js"]
PENDING_OK = ["project.html"] + LESSON_FILES[1:]

BANNED = ["赋能", "底层逻辑", "一键上手", "小白必看", "保姆级", "轻松学会",
          "干货满满", "程序员", "您", "小姐姐", "姐妹们", "阿姨"]

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}
AUTO_CLOSE = {"p", "li", "dt", "dd", "tr", "td", "th", "option", "thead",
              "tbody", "tfoot", "colgroup", "caption"}

errors = []
warnings = []
notes = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


class Analyzer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = []
        self.hrefs = []
        self.classes = set()
        self.tags = []
        self.img_no_alt = 0
        self.inline_styles = 0
        self.buttons_no_type = 0
        self.lang = None
        self.title = None
        self._in_title = False
        self.meta_desc = None
        self.text_parts = []
        self._skip_text = 0
        self.has_skip_link = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append(tag)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "title":
            self._in_title = True
        if tag == "meta" and a.get("name") == "description":
            self.meta_desc = a.get("content")
        if "id" in a:
            self.ids.append(a["id"])
        if "href" in a:
            self.hrefs.append(a["href"])
        if "class" in a:
            self.classes.update(a["class"].split())
        if "style" in a:
            self.inline_styles += 1
        if tag == "img" and "alt" not in a:
            self.img_no_alt += 1
        if tag == "button" and "type" not in a:
            self.buttons_no_type += 1
        if tag == "a" and "skip-link" in (a.get("class") or ""):
            self.has_skip_link = True
        # 跳过 script/style 里的“文字”
        if tag in ("script", "style", "textarea"):
            self._skip_text += 1
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag in ("title",):
            self._in_title = False
        if tag in ("script", "style", "textarea") and self._skip_text > 0:
            self._skip_text -= 1
        if tag in VOID:
            return
        if tag in self.stack:
            while self.stack:
                top = self.stack.pop()
                if top == tag:
                    break
        else:
            if tag not in AUTO_CLOSE:
                warn("多余的结束标签 </%s>" % tag)

    def handle_data(self, data):
        if self._in_title and self.title is None:
            self.title = data.strip()
        if self._skip_text == 0:
            self.text_parts.append(data)

    @property
    def text(self):
        return "".join(self.text_parts)


def strip_tags_len(text):
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def check_file(rel):
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        if rel in PENDING_OK:
            notes.append("%s 尚未生成（内容作者进行中）" % rel)
        else:
            err("%s 缺失" % rel)
        return None
    raw = read(path)
    an = Analyzer()
    try:
        an.feed(raw)
        an.close()
    except Exception as e:  # noqa: BLE001
        err("%s HTML 解析异常：%s" % (rel, e))
        return an

    # 基础结构
    if an.lang != "zh-CN":
        err("%s：<html lang> 应为 zh-CN" % rel)
    if not an.title:
        err("%s：缺少 <title>" % rel)
    if not an.meta_desc:
        err("%s：缺少 meta description" % rel)
    if len(an.meta_desc or "") > 120:
        warn("%s：meta description 偏长（%d 字）" % (rel, len(an.meta_desc)))
    if "assets/styles.css" not in raw:
        err("%s：没有引入 assets/styles.css" % rel)
    if "assets/app.js" not in raw:
        err("%s：没有引入 assets/app.js" % rel)
    if "skip-link" not in raw:
        err("%s：缺少跳到正文的 skip-link" % rel)
    if an.img_no_alt:
        err("%s：有 %d 个 img 缺 alt" % (rel, an.img_no_alt))
    if an.buttons_no_type:
        err("%s：有 %d 个 button 缺 type 属性" % (rel, an.buttons_no_type))
    if an.inline_styles > 2:
        warn("%s：内联 style 有点多（%d 处）" % (rel, an.inline_styles))

    # 占位符 / 禁用词
    if "【【" in raw:
        err("%s：仍残留模板占位符 【【" % rel)
    for word in BANNED:
        if word in an.text:
            err("%s：出现禁用词「%s」" % (rel, word))

    # id 唯一
    dup = {i for i in an.ids if an.ids.count(i) > 1}
    if dup:
        err("%s：重复 id %s" % (rel, sorted(dup)))

    # 内部链接
    for href in an.hrefs:
        if href.startswith(("#", "http://", "https://", "mailto:", "tel:", "javascript:")):
            continue
        target = href.split("#")[0].split("?")[0]
        if not target:
            continue
        resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
        if not os.path.exists(resolved):
            err("%s：链接失效 → %s" % (rel, href))
    # 页内锚点
    anchors = set(an.ids)
    for href in an.hrefs:
        if href.startswith("#") and len(href) > 1:
            if href[1:] not in anchors:
                err("%s：页内锚点不存在 → %s" % (rel, href))

    # 课程页专项
    m = re.match(r"lessons/lesson-(\d+)\.html$", rel)
    if m:
        num = int(m.group(1))
        if 'data-lesson="%d"' % num not in raw:
            err("%s：body 的 data-lesson 应为 %d" % (rel, num))
        if 'data-complete="%d"' % num not in raw:
            err("%s：完成按钮的 data-complete 应为 %d" % (rel, num))
        if raw.count('data-playground') < 1:
            err("%s：缺少动手区 data-playground" % rel)
        quiz_count = raw.count('class="quiz" data-quiz')
        if quiz_count != 3:
            err("%s：应有 3 道测验，实际 %d" % (rel, quiz_count))
        quiz_blocks = raw.split('class="quiz" data-quiz')[1:]
        for idx, block in enumerate(quiz_blocks, 1):
            correct = block.count('data-correct="true"')
            if correct != 1:
                err("%s：第 %d 道测验的正确选项数为 %d（应为 1）" % (rel, idx, correct))
        if "data-speak" not in raw:
            warn("%s：没有朗读按钮" % rel)
        cn = strip_tags_len(an.text)
        if cn < 900:
            err("%s：中文正文只有 %d 字（至少 900）" % (rel, cn))
        notes.append("%s：中文正文约 %d 字" % (rel, cn))
        # 上一课/下一课
        if num > 0 and ('href="lesson-%d.html"' % (num - 1)) not in raw:
            warn("%s：没找到“上一课”链接" % rel)
        if num < 6 and ('href="lesson-%d.html"' % (num + 1)) not in raw:
            warn("%s：没找到“下一课”链接" % rel)
        if num == 6 and 'href="../project.html"' not in raw:
            warn("%s：第 6 课的下一课应指向结业作品" % rel)
    else:
        # 首页/文档页
        if rel == "index.html":
            for i in range(7):
                if "lessons/lesson-%d.html" % i not in raw:
                    err("index.html：课程地图缺第 %d 课链接" % i)
            if "data-next-lesson" not in raw:
                err("index.html：缺少 data-next-lesson 继续学习按钮")
        if rel == "project.html":
            if "data-playground" not in raw:
                err("project.html：结业作品页应有可运行的示例动手区")
    return an


def check_css_classes(files):
    css_path = os.path.join(ROOT, "assets/styles.css")
    css = read(css_path)
    css_classes = set(re.findall(r"\.([A-Za-z][A-Za-z0-9_-]*)", css))
    js = read(os.path.join(ROOT, "assets/app.js"))
    js_classes = set(re.findall(r"classList\.(?:add|toggle|remove)\(\s*['\"]([A-Za-z0-9_-]+)", js))
    js_classes |= {"is-done", "is-open", "is-right", "is-wrong", "is-on", "is-error", "is-ok"}
    known = css_classes | js_classes
    used = set()
    for rel in files:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        an = Analyzer()
        an.feed(read(path))
        used |= an.classes
    unknown = sorted(c for c in used if c not in known)
    if unknown:
        warn("使用了样式表里没有的类名（可能是笔误）：%s" % ", ".join(unknown))


def main():
    for rel in REQUIRED:
        if not os.path.exists(os.path.join(ROOT, rel)):
            err("缺少必需文件 %s" % rel)

    good_files = []
    for rel in ALL_FILES:
        if check_file(rel):
            good_files.append(rel)

    if os.path.exists(os.path.join(ROOT, "assets/styles.css")):
        check_css_classes(good_files)

    # 资源引用 & 文件体积
    for name in ("assets/styles.css", "assets/app.js"):
        p = os.path.join(ROOT, name)
        if os.path.exists(p):
            notes.append("%s：%.1f KB" % (name, os.path.getsize(p) / 1024))

    print("=" * 62)
    print("她学编程 · 全站检查")
    print("=" * 62)
    for n in notes:
        print("  · %s" % n)
    if warnings:
        print("\n警告（%d）：" % len(warnings))
        for w in warnings:
            print("  ! %s" % w)
    if errors:
        print("\n错误（%d）：" % len(list(dict.fromkeys(errors))))
        for e in list(dict.fromkeys(errors)):
            print("  ✗ %s" % e)
        print("\n结论：未通过。")
        return 1
    print("\n结论：通过（%d 个页面，%d 条警告）。" % (len(good_files), len(warnings)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
