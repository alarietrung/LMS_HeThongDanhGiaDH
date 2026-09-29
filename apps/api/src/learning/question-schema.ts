import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { parse, text } from "../common";
export const TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
  "NUMERIC",
  "MATCHING",
  "ORDERING",
  "FILL_BLANK",
  "FILE_UPLOAD",
] as const;
export const questionSchema = z.object({
  type: z.enum(TYPES),
  prompt: text,
  options: z.array(z.string().trim().min(1).max(2000)).max(30).default([]),
  answer: z.any(),
  points: z.number().finite().positive().max(1000).default(1),
  explanation: z.string().max(10000).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});
export function validateQuestion(input: unknown) {
  const b = parse(questionSchema, input);
  const invalid = (message: string): never => {
    throw new BadRequestException(message);
  };
  if (
    ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(b.type) &&
    b.options.length < 2
  )
    invalid("Câu hỏi lựa chọn cần ít nhất hai phương án.");
  if (b.type === "TRUE_FALSE" && b.options.length !== 2)
    invalid("Câu đúng/sai cần đúng hai phương án.");
  if (
    ["SINGLE_CHOICE", "TRUE_FALSE"].includes(b.type) &&
    (!Number.isInteger(b.answer) ||
      b.answer < 0 ||
      b.answer >= b.options.length)
  )
    invalid("Đáp án phải là chỉ số phương án hợp lệ.");
  if (
    b.type === "MULTIPLE_CHOICE" &&
    (!Array.isArray(b.answer) ||
      !b.answer.length ||
      new Set(b.answer).size !== b.answer.length ||
      b.answer.some(
        (v: any) => !Number.isInteger(v) || v < 0 || v >= b.options.length,
      ))
  )
    invalid("Danh sách đáp án không hợp lệ hoặc bị trùng.");
  if (
    ["MATCHING", "ORDERING", "FILL_BLANK"].includes(b.type) &&
    (!Array.isArray(b.answer) ||
      !b.answer.length ||
      b.answer.length > 30 ||
      b.answer.some(
        (v: any) => typeof v !== "string" || !v.trim() || v.length > 2000,
      ))
  )
    invalid("Loại câu hỏi này cần một danh sách đáp án văn bản.");
  if (
    ["MATCHING", "ORDERING", "FILL_BLANK"].includes(b.type) &&
    b.options.length !== b.answer.length
  )
    invalid("Số mục / chỗ trống phải bằng số đáp án.");
  if (
    b.type === "ORDERING" &&
    (new Set(b.options).size !== b.options.length ||
      JSON.stringify([...b.options].sort()) !==
        JSON.stringify([...b.answer].sort()))
  )
    invalid("Đáp án sắp xếp phải chứa mỗi phương án đúng một lần.");
  if (
    b.type === "SHORT_ANSWER" &&
    (typeof b.answer !== "string" || !b.answer.trim() || b.answer.length > 2000)
  )
    invalid("Câu trả lời ngắn cần đáp án văn bản.");
  if (b.type === "NUMERIC") {
    const numeric =
      typeof b.answer === "number"
        ? { value: b.answer, tolerance: 0 }
        : b.answer;
    b.answer = parse(
      z.object({
        value: z.number().finite(),
        tolerance: z.number().finite().nonnegative().default(0),
      }),
      numeric,
    );
  }
  if (["ESSAY", "FILE_UPLOAD"].includes(b.type)) b.answer = null;
  return b;
}
