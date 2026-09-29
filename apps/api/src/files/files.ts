import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  Inject,
  Module,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { BlobServiceClient, BlobSASPermissions } from "@azure/storage-blob";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { Db } from "../db/db";
import {
  access,
  audit,
  hash,
  id,
  ok,
  owned,
  paging,
  parse,
  user,
  uuid,
} from "../common";
import { groupAccess } from "../workspace";
const maxSize = 10 * 1024 * 1024;
const extensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
  ".md",
  ".csv",
  ".zip",
  ".docx",
  ".pptx",
  ".xlsx",
  ".mp3",
  ".mp4",
  ".wav",
]);
const blob = () =>
  process.env.AZURE_STORAGE_CONNECTION_STRING
    ? BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING,
      ).getContainerClient(process.env.AZURE_STORAGE_CONTAINER || "lms-files")
    : null;
async function validate(name: string, data: Buffer) {
  const ext = path.extname(name).toLowerCase();
  if (!extensions.has(ext) || !data.length || data.length > maxSize)
    throw new BadRequestException("Tệp không được hỗ trợ hoặc vượt quá 10 MB.");
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(data);
  if ([".txt", ".md", ".csv"].includes(ext)) {
    if (
      data.includes(0) ||
      Buffer.from(data.toString("utf8"), "utf8").compare(data) !== 0
    )
      throw new BadRequestException("Tệp văn bản không hợp lệ.");
    return "text/plain";
  }
  const allowed: Record<string, string[]> = {
    ".pdf": ["application/pdf"],
    ".png": ["image/png"],
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".gif": ["image/gif"],
    ".webp": ["image/webp"],
    ".zip": ["application/zip"],
    ".docx": [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ".xlsx": [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    ".pptx": [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ".mp3": ["audio/mpeg"],
    ".mp4": ["video/mp4"],
    ".wav": ["audio/wav", "audio/x-wav"],
  };
  if (!detected || !allowed[ext]?.includes(detected.mime))
    throw new BadRequestException("Nội dung tệp không khớp định dạng.");
  return detected.mime;
}
@Controller("api/v1")
export class FileController {
  constructor(@Inject(Db) private db: Db) {}
  @Get("courses/:sid/files") async list(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid);
    const p = paging(r);
    return ok(
      await this.db.q(
        "SELECT f.id,f.name,f.mime,f.size,f.owner_id,f.visibility,f.group_id,f.created_at,u.name owner FROM file_assets f JOIN users u ON u.id=f.owner_id WHERE f.section_id=$1 AND f.status='READY' AND (f.owner_id=$2 OR f.visibility='COURSE' OR (f.visibility='GROUP' AND EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=f.group_id AND gm.user_id=$2))) AND f.name ILIKE $3 ORDER BY f.created_at DESC LIMIT $4 OFFSET $5",
        [
          sid,
          user(r).id,
          `%${String(r.query.q || "").slice(0, 100)}%`,
          p.limit,
          p.offset,
        ],
      ),
      p,
    );
  }
  @Patch("files/:id/sharing") async sharing(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const f = await owned(this.db, "file_assets", id);
    await access(this.db, r, f.section_id, "course.view", true);
    if (f.owner_id !== user(r).id || f.status !== "READY")
      throw new ForbiddenException(
        "Chỉ người tải lên được thay đổi chia sẻ tệp.",
      );
    const b = parse(
      z.object({
        visibility: z.enum(["PRIVATE", "COURSE", "GROUP"]),
        group_id: uuid.optional(),
      }),
      r.body,
    );
    if (b.visibility === "COURSE")
      await access(this.db, r, f.section_id, "module.manage", true);
    if (b.visibility === "GROUP") {
      if (!b.group_id) throw new BadRequestException("Chưa chọn nhóm.");
      const group = await groupAccess(this.db, r, b.group_id, true);
      if (group.section_id !== f.section_id)
        throw new BadRequestException("Nhóm phải thuộc cùng học phần.");
    }
    await this.db.q(
      "UPDATE file_assets SET visibility=$2,group_id=$3 WHERE id=$1",
      [id, b.visibility, b.visibility === "GROUP" ? b.group_id : null],
    );
    await audit(
      this.db,
      r,
      "FILE_SHARING_UPDATED",
      "file",
      id,
      { visibility: f.visibility },
      b,
    );
    return ok({ updated: true });
  }
  @Post("courses/:sid/files")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: maxSize, files: 1 } }),
  )
  async upload(
    @Req() r: any,
    @Param("sid") sid: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await access(this.db, r, sid, "course.view", true);
    if (!file) throw new BadRequestException("Chưa chọn tệp.");
    if (blob())
      throw new BadRequestException("Vui lòng tải tệp qua URL ký số.");
    const mime = await validate(file.originalname, file.buffer),
      key = id();
    const dir = path.resolve(".data/files");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), file.buffer, { flag: "wx" });
    const row = await this.db.one(
      "INSERT INTO file_assets(section_id,owner_id,name,mime,size,storage_key,checksum) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,size,mime",
      [
        sid,
        user(r).id,
        path.basename(file.originalname),
        mime,
        file.size,
        key,
        hash(file.buffer.toString("base64")),
      ],
    );
    return ok(row);
  }
  @Post("courses/:sid/files/sign") async sign(
    @Req() r: any,
    @Param("sid") sid: string,
  ) {
    await access(this.db, r, sid, "course.view", true);
    const container = blob();
    if (!container) return ok({ mode: "local" });
    const b = parse(
      z.object({
        name: z.string().min(1).max(200),
        size: z.number().int().positive().max(maxSize),
      }),
      r.body,
    );
    if (!extensions.has(path.extname(b.name).toLowerCase()))
      throw new BadRequestException("Định dạng tệp chưa được hỗ trợ.");
    const key = id();
    const row = await this.db.one(
      "INSERT INTO file_assets(section_id,owner_id,name,mime,size,storage_key,checksum,status) VALUES($1,$2,$3,'application/octet-stream',$4,$5,'','PENDING') RETURNING id",
      [sid, user(r).id, path.basename(b.name), b.size, key],
    );
    const uploadUrl = await container.getBlockBlobClient(key).generateSasUrl({
      permissions: BlobSASPermissions.parse("cw"),
      expiresOn: new Date(Date.now() + 10 * 60000),
    });
    return ok({ mode: "azure", id: row!.id, uploadUrl });
  }
  @Post("files/:id/complete") async complete(
    @Req() r: any,
    @Param("id") id: string,
  ) {
    const f = await owned(this.db, "file_assets", id);
    if (f.owner_id !== user(r).id) throw new ForbiddenException();
    await access(this.db, r, f.section_id, "course.view", true);
    const container = blob();
    if (!container) throw new BadRequestException();
    const client = container.getBlockBlobClient(f.storage_key),
      props = await client.getProperties();
    if (props.contentLength !== f.size || f.size > maxSize)
      throw new BadRequestException("Kích thước tệp không khớp.");
    const data = await client.downloadToBuffer();
    const mime = await validate(f.name, data);
    await this.db.q(
      "UPDATE file_assets SET status='READY',mime=$2,checksum=$3 WHERE id=$1",
      [id, mime, hash(data.toString("base64"))],
    );
    return ok({ id, name: f.name, size: f.size, mime });
  }
  @Get("files/:id") async download(
    @Req() r: any,
    @Res() res: any,
    @Param("id") id: string,
  ) {
    const f = await owned(this.db, "file_assets", id),
      s = await access(this.db, r, f.section_id);
    const groupMember =
      f.visibility === "GROUP" &&
      f.group_id &&
      (await this.db.one(
        "SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2",
        [f.group_id, user(r).id],
      ));
    if (
      f.status !== "READY" ||
      (f.owner_id !== user(r).id &&
        !s.manage &&
        f.visibility !== "COURSE" &&
        !groupMember)
    )
      throw new ForbiddenException();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", f.mime);
    res.setHeader(
      "Content-Disposition",
      `${r.query.inline === "1" && /^(image\/|audio\/|video\/|application\/pdf$)/.test(f.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    );
    const container = blob();
    if (container) {
      const data = await container
        .getBlockBlobClient(f.storage_key)
        .downloadToBuffer();
      return res.send(data);
    }
    return res.send(
      await fs.readFile(path.resolve(".data/files", f.storage_key)),
    );
  }
}
@Module({ controllers: [FileController] })
export class FileModule {}
