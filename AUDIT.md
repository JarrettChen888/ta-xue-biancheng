# 《她学编程》上线前独立审计报告

**总体结论：修完 P0 后可以上线。** 11 页完整、无死链、无注册付费、交互正常、axe WCAG 2.2 AA 全站 0 违规；仅剩 1 个 P0：第一次要她自己敲 `<` `>` 时，全站没有一句"怎么打字 / 切输入法"的说明（3 处文案即可修）。其余为 P1/P2。

- 审计时点 2026-11-06 18:55。Lead 在 18:35–18:53 已修复我首轮上报的问题；标注「已修复」的条目保留为记录，行号以 18:55 版本为准。

## P0（必须修）
1. `lessons/lesson-1.html:121,143,152`、`lessons/lesson-2.html:158,167`、`start.html:69-89`：全站没有一句"怎么打出 `<` `>` `/` 和英文冒号"的说明。读者只用过微信，中文输入法下 Shift＋逗号打出的是 `《`，而 `lesson-1.html:152` 的任务第 3 步直接要她打 `<p></p>`；`:143` 的卡点提示只归因"尖括号少一半 / 把 h1 写成 hl"，解释不了 `《》`。这是唯一可能让她"照着页面也做不出来"的动作。改法：`lesson-1.html:121` 的 tip 补"按 Shift 切英文；`<` 是 Shift＋逗号，`>` 是 Shift＋句号，`/` 是问号键左边"；`:143` 补"打出《》是输入法还在中文，不是你打错了"；`start.html:74` 与 `lesson-2.html:158` 各补一句同样的说明。

## P0/P1 已修复（保留记录，供复核）
- ~~第 3–6 课 JS 运行结果区（首轮 P0）~~：曾"iframe 该藏没藏 + 空白深色框 + 状态行指向下方"；已改为深色 iframe 结果框、状态行"结果在上面的运行结果框里"、`styles.css:252` 加 `[hidden]{display:none!important}`；18:4x 浏览器实测输出正常。
- ~~报错文案与代码不一致~~：`assets/app.js` 已把英文报错翻成"❌…"人话；`lesson-3.html:149`、`lesson-4.html:126`、`lesson-5.html:124`、`lesson-6.html:153` 的卡点提示已同步改成"❌ 开头"。
- ~~`console.log(undefined)` 输出空行~~：`app.js` 已加 `__str`，实测打印 `undefined`，与 `lesson-6.html:153` 一致。
- ~~变量名口径冲突~~：`lesson-3.html:100,124` 已改成"英文最稳妥，中文也能用，第 4 课会见到"，与 `lesson-4/6` 的中文变量名一致。
- ~~结业作品口径~~：`project.html` 已把"前六课"改"前面七课"、"第 2 课和第 3 课"改"第 2 课"。

## P1（应该修）
1. **第 5 课 10 行看不全**：`assets/styles.css:1426` `.pg-frame{min-height:12rem}`；实测 10 行时 iframe 内 `scrollHeight 313 / clientHeight 238`，一次只看到约 8 行，而 `lesson-5.html:160,163` 要她"数到 10 行"。改：加 `[data-playground="js"] .pg-frame{min-height:17rem}`。
2. **朗读按钮旧名字未同步**：实际按钮已改为"读一读目标与开场 / 读一读这三句话"（`lessons/lesson-*.html:83-84,200-217`），但 `index.html:103`、`start.html:107,133`、`help.html:81` 仍写"读给我听"，她按说明找不到按钮。改：4 处换成新按钮名。
3. **结业作品存出的 .html 无 doctype/charset**：`project.html:135` 代码以 `<style>` 开头；实测存盘后 `compatMode=BackCompat`、编码靠浏览器猜（页面 `:257` 却强调"编码选 UTF-8"）。改：textarea 顶部加 `<!DOCTYPE html>` + `<meta charset="utf-8">` 两行（预览和存盘均已实测正常）。
4. **"你已经会的东西"有 2 处不实**：`project.html:95`"不需要新学什么"、`:101`"h2/ul/li"、`:103`"你在第 1 课就写过了"、`:110` 色号——第 1 课只教 h1/p，全站未教 h2/ul/li/div/class，第 2 课只教英文颜色名。改：换成"大部分见过，剩下几样不用会写，照样子改"。
5. **测验选项与题干无读屏关联**：如 `lesson-0.html:162-169`，无 fieldset/legend/role=group；实测读屏 Tab 到选项只读选项、不读题干（axe 查不出）。改：`assets/app.js:382` 的 `initQuizzes` 里给 `.quiz-q` 加 id、`.quiz-options` 加 `role="group" aria-labelledby`。
6. **练习区改动不保存，项目页无提醒**：`project.html:73` 说"可以随时回到这一页重来"，但实测刷新即回初始代码；30 分钟的作品，只有 `help.html:149` 在 FAQ 里提了一句。改：项目动手区上方加醒目提示，或 app.js 存 localStorage 草稿。
7. **朗读仍不覆盖知识卡/小任务**：`lessons/lesson-*.html:83-84,200-217` 只读"目标+故事+回顾"；实测每课约 410–460 字，页面 1800–2300 字（约 20%）。改：给 `.concepts`/`.task` 加 id 和各加一个 `data-speak` 按钮（无需改 JS）。
8. **重复 complementary 地标**：每课 2–3 个 `<aside>`（如 `lesson-4.html:123,125,155`、`project.html:178,219,260`），axe best-practice `landmark-unique` 命中；读屏地标列表出现多个"补充信息"。改：给 aside 加 `aria-label`（"小提示"/"卡住了怎么办"）。

## P2（可选）
- `lesson-0.html:88,89,90,97,98,112,114,141,149` 用了半角直引号，与指南"中文标点全角"及全站其他页不一致。
- `lesson-5.html:151` 一段 200+ 字 5 句，违背"一句 ≤25 字、一段 2–3 句"；建议拆段。
- `lesson-3.html` 故事用"通讯录"（:88-92），知识卡换"收纳盒"（:98），测验又回"盒子"（:173）；建议用一句话把两个比喻缝起来。
- 七课生活场景集中在厨房/家务（电饭煲/桌布/凉拌黄瓜/家宴），指南第 8 条提醒不默认她是妈妈/妻子；建议换一课非家务场景。
- "每天 15 分钟"（`index.html:64,71,325`）与课时"约 20/25 分钟"（`lesson-1.html:68` 起）口径不一致。
- `index.html:64`"不用懂英文"与要认/打十多个英文词矛盾；`help.html:123` 已有更准的口径可用。
- 弱干扰项：`lesson-0.html:175`"心里默念三遍"、`lesson-5.html:177`"让页面变慢"、`lesson-6.html:198`"关掉网页"。
- `lesson-1.html:143`"h1 写成 hl 会冒出 `<h1>`"归因不准（hl 会被当未知标签，不会显示尖括号）。
- `lesson-4.html:156`"超过 30 度"与代码 `>= 30` 不符；`lesson-4.html:163` 任务要删两行，比前面课难度跳档。
- 完成按钮再点会取消已学完（`app.js:512-515`），无提示；`aria-current` 取值不统一（`lesson-0.html:44`=`true` vs `index.html:44`=`page`）。
- `index.html:120`"七节课"与课程地图"第 0 课"编号易混；`start.html:91`"五步"漏了知识卡；`lesson-2.html:125` 动手区标题没写"改成你自己的"。
- `<style>` 写在 body（`lesson-2.html:136` 起、`project.html:135`）浏览器可用但非标准；`help.html:86`"图片都有替代文字"站内并无图片。

## 我实测过的东西
- 11 页 + 指南 + 范文逐页通读；按"50 岁、零基础、只用过微信"身份走完"看 → 动手 → 小任务 → 三题 → 回顾"。
- Chrome 156（puppeteer-core，本地 8765）：链接/标题/重复 id/390px 无横向溢出/25px 字号/Tab 前 16 焦点/完成进度闭环（做满 7 课 → 花瓣 7/7、按钮变"七课都学完了"）。
- JS 动手区实跑：默认输出、中文引号、漏花括号、`retrun`、忘 `return`（undefined）、漏 `i++`（循环卡死，测试进程挂起后终止）；5→10 行输出正确但 313>238 需滚动。
- `node --check` + `node` 实跑 4 段 JS：全部通过，输出与课文一致。
- 结业作品代码原样存成 .html 打开：`BackCompat`；加 doctype+charset 后 `CSS1Compat`，站内预览也正常。
- axe-core 11 页 × 两色主题 WCAG 2.0/2.1/2.2 A/AA：0 违规；best-practice：7 个课程页 + 项目页命中 `landmark-unique`、`region`。
- 朗读：stub `speechSynthesis` 抓实际朗读文本（每课 2 个按钮、410–460 字）。
- 局限：未在真实 Windows + 中文输入法下实测（P0 依据是输入法常识 + 页面文本缺失），未测 iPhone/Safari 真机语音。
