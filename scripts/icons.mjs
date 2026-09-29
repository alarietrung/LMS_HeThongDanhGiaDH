import sharp from "sharp";
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#842e2b"/><rect x="58" y="58" width="396" height="396" rx="70" fill="none" stroke="#dfb660" stroke-width="3"/><path d="M122 353V156h57l77 105 77-105h57v197h-61V251l-73 97-73-97v102z" fill="#edc96f"/><path d="M120 383h272" stroke="#edc96f" stroke-width="5"/></svg>`,
);
for (const size of [192, 512])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`apps/web/public/icon-${size}.png`);
