import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Inject,
  Module,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { Db, Query, Row } from "./db/db";
import { access, audit, ok, owned, paging, parse, user, uuid } from "./common";
export function cleanContent(content: string, format: string) {
  return format === "HTML"
    ? sanitizeHtml(content, {
        allowedTags: [
          "p",
          "br",
          "h1",
          "h2",
          "h3",
          "h4",
          "strong",
          "b",
          "em",
          "i",
          "u",
          "s",
          "ul",
          "ol",
          "li",
          "blockquote",
          "pre",
          "code",
          "hr",
          "a",
          "img",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
        ],
        allowedAttributes: {
          a: ["href", "title", "target", "rel"],
          img: ["src", "alt", "title", "width", "height"],
          th: ["colspan", "rowspan"],
          td: ["colspan", "rowspan"],
        },
        allowedSchemes: ["https", "http"],
        allowProtocolRelative: false,
        transformTags: {
          a: (_tag, attrs) => ({
            tagName: "a",
            attribs: { ...attrs, target: "_blank", rel: "noopener noreferrer" },
          }),
        },
      })
    : content;
}
export async function saveItem(tx: Query, req: any, itemId: string, b: Row) {
  const item = await tx.one(
    "SELECT * FROM module_items WHERE id=$1 FOR UPDATE",
    [itemId],
  );
  if (!item || item.deleted_at)
    throw new BadRequestException("Học liệu không tồn tại.");
  if (b.base_revision !== undefined && b.base_revision !== item.revision)
    throw new ConflictException(
      "Học liệu đã được chỉnh sửa ở nơi khác. Tải lại trước khi lưu để tránh ghi đè.",
    );
  const next = { ...item, ...b };
  if (next.status === "SCHEDULED" && !next.available_at)
    throw new BadRequestException("Nội dung lên lịch cần thời gian mở.");
  next.content = cleanContent(next.content, next.content_format);
  const fields = [
    "title",
    "content",
    "content_format",
    "url",
    "status",
    "position",
    "available_at",
  ];
  if (fields.every((k) => String(item[k] ?? "") === String(next[k] ?? "")))
    return item;
  await tx.q(
    "INSERT INTO item_revisions(item_id,revision,snapshot,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(item_id,revision) DO NOTHING",
    [item.id, item.revision, JSON.stringify(item), user(req).id],
  );
  const saved = await tx.one(
    "UPDATE module_items SET title=$2,content=$3,content_format=$4,url=$5,status=$6,position=$7,available_at=$8,revision=revision+1 WHERE id=$1 RETURNING *",
    [
      item.id,
      next.title,
      next.content,
      next.content_format,
      next.url,
      next.status,
      next.position,
      next.available_at,
    ],
  );
  await audit(
    tx,
    req,
    "ITEM_UPDATED",
    "module_item",
    item.id,
    { revision: item.revision },
    { revision: saved!.revision },
  );
  return saved;
}
@Controller("api/v1")
export class ContentController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("items/:id/revisions") async revisions(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const i = await owned(this.db, "module_items", id),
      m = await owned(this.db, "modules", i.module_id);
    await access(this.db, r, m.section_id, "module.manage");
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT v.id,v.revision,v.snapshot,v.created_at,u.name author FROM item_revisions v LEFT JOIN users u ON u.id=v.created_by WHERE item_id=$1 ORDER BY revision DESC LIMIT $2 OFFSET $3",
        [id, p.limit, p.offset],
      ),
      p,
    );
  }
  @Post("items/:id/revisions/:revision/restore") async restore(
    @Req() r: any,
    @Param("id") id: string,
    @Param("revision") revision: string,
  ) {
    const i = await owned(this.db, "module_items", id),
      m = await owned(this.db, "modules", i.module_id);
    await access(this.db, r, m.section_id, "module.manage", true);
    const b = parse(
        z.object({ base_revision: z.number().int().positive() }),
        r.body,
      ),
      v = await this.db.one(
        "SELECT snapshot FROM item_revisions WHERE item_id=$1 AND revision=$2",
        [id, parse(z.coerce.number().int().positive(), revision)],
      );
    if (!v) throw new BadRequestException("Không tìm thấy phiên bản.");
    return ok(
      await this.db.tx(async (tx) => {
        const saved = await saveItem(tx, r, id, {
          title: v.snapshot.title,
          content: v.snapshot.content,
          content_format: v.snapshot.content_format || "TEXT",
          url: v.snapshot.url,
          base_revision: b.base_revision,
        });
        await audit(tx, r, "ITEM_RESTORED", "module_item", id, null, {
          from: revision,
        });
        return saved;
      }),
    );
  }
  @Post("items/:id/duplicate") async duplicate(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const item = await owned(this.db, "module_items", id),
      m = await owned(this.db, "modules", item.module_id);
    await access(this.db, r, m.section_id, "module.manage", true);
    return ok(
      await this.db.tx(async (tx) => {
        const copy = await tx.one(
          "INSERT INTO module_items(module_id,title,type,content,content_format,url,position,status) VALUES($1,$2,$3,$4,$5,$6,(SELECT coalesce(max(position),-1)+1 FROM module_items WHERE module_id=$1),'DRAFT') RETURNING *",
          [
            m.id,
            `${item.title} — Bản sao`,
            item.type,
            item.content,
            item.content_format,
            item.url,
          ],
        );
        await audit(tx, r, "ITEM_DUPLICATED", "module_item", copy!.id);
        return copy;
      }),
    );
  }
}
@Module({ controllers: [ContentController] })
export class ContentModule {}
