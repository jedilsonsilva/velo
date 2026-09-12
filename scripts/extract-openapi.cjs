const fs = require("fs");
const path = require("path");

const src = path.join(process.env.TEMP, "swagger-ui-init.js");
const txt = fs.readFileSync(src, "utf8");
const start = txt.indexOf('"swaggerDoc":');
if (start < 0) {
  console.error("swaggerDoc not found");
  process.exit(1);
}

let i = txt.indexOf("{", start);
let depth = 0;
let inStr = false;
let esc = false;
let quote = null;

for (let p = i; p < txt.length; p++) {
  const c = txt[p];
  if (inStr) {
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === quote) {
      inStr = false;
      quote = null;
    }
    continue;
  }
  if (c === '"' || c === "'") {
    inStr = true;
    quote = c;
    continue;
  }
  if (c === "{") depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) {
      const json = txt.slice(i, p + 1);
      const spec = JSON.parse(json);
      const outDir = path.join(__dirname, "..", "collections");
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, "smart-gm-openapi.json");
      fs.writeFileSync(outFile, JSON.stringify(spec, null, 2));
      console.log("title:", spec.info?.title);
      console.log("version:", spec.info?.version);
      console.log("servers:", JSON.stringify(spec.servers));
      console.log("security:", JSON.stringify(spec.security));
      console.log("securitySchemes:", JSON.stringify(Object.keys(spec.components?.securitySchemes || {})));
      console.log("tags:", (spec.tags || []).map((t) => t.name).join(" | "));
      let opCount = 0;
      for (const [pName, methods] of Object.entries(spec.paths || {})) {
        for (const method of Object.keys(methods)) {
          if (["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
            opCount++;
            const op = methods[method];
            console.log(
              `${method.toUpperCase().padEnd(6)} ${pName}  [${(op.tags || []).join(",")}]  ${op.operationId || ""}`
            );
          }
        }
      }
      console.log("opCount:", opCount);
      console.log("schemaCount:", Object.keys(spec.components?.schemas || {}).length);
      console.log("wrote", outFile);
      break;
    }
  }
}
