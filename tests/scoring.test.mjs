import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { scoreQuestion } = require("../apps/api/dist/learning/quizzes.js"),
  {
    validateQuestion,
  } = require("../apps/api/dist/learning/question-schema.js");
test("All ten quiz types validate and automatic/manual scoring is consistent", () => {
  const cases = [
    ["SINGLE_CHOICE", ["A", "B"], 1, 1, 0],
    ["MULTIPLE_CHOICE", ["A", "B", "C"], [0, 2], [2, 0], [0]],
    ["TRUE_FALSE", ["Đúng", "Sai"], 0, 0, 1],
    ["SHORT_ANSWER", [], "Tiếng Việt", " tiếng việt ", "English"],
    ["NUMERIC", [], { value: 3, tolerance: 0.1 }, 3.05, 3.2],
    [
      "MATCHING",
      ["Mục 1", "Mục 2"],
      ["Một", "Hai"],
      ["Một", "Hai"],
      ["Hai", "Một"],
    ],
    [
      "ORDERING",
      ["Hai", "Một"],
      ["Một", "Hai"],
      ["Một", "Hai"],
      ["Hai", "Một"],
    ],
    ["FILL_BLANK", ["Chỗ 1", "Chỗ 2"], ["A", "B"], ["a", "b"], ["a", "c"]],
    ["ESSAY", [], null, "Bài luận", null],
    ["FILE_UPLOAD", [], null, { file_id: "test" }, null],
  ];
  for (const [type, options, answer, correct, incorrect] of cases) {
    const q = validateQuestion({
      type,
      options,
      answer,
      prompt: "Câu hỏi kiểm thử",
      points: 2,
    });
    const manual = ["ESSAY", "FILE_UPLOAD"].includes(type);
    assert.equal(scoreQuestion(q, correct), manual ? null : 2, type);
    assert.equal(scoreQuestion(q, incorrect), manual ? null : 0, type);
  }
});
