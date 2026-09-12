const fs = require("fs");
const path = require("path");

const src = path.join(process.env.TEMP, "swagger-ui-init-190rj.js");
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
      const spec = JSON.parse(txt.slice(i, p + 1));
      const outDir = path.join(__dirname, "..", "collections");
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, "190rj-openapi.json");
      fs.writeFileSync(outFile, JSON.stringify(spec, null, 2));
      console.log("title:", spec.info?.title);
      console.log("version:", spec.info?.version);
      console.log("swagger:", spec.swagger || spec.openapi);
      console.log("host:", spec.host);
      console.log("basePath:", spec.basePath);
      console.log("schemes:", JSON.stringify(spec.schemes));
      console.log("security:", JSON.stringify(spec.security));
      console.log("securityDefinitions:", JSON.stringify(spec.securityDefinitions, null, 2));
      console.log("tags:", (spec.tags || []).map((t) => t.name).join(" | "));
      let opCount = 0;
      for (const [pName, methods] of Object.entries(spec.paths || {})) {
        for (const method of Object.keys(methods)) {
          if (["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
            opCount++;
            const op = methods[method];
            const secs = JSON.stringify(op.security || spec.security || []);
            console.log(
              `${method.toUpperCase().padEnd(6)} ${pName}  [${(op.tags || []).join(",")}]  ${op.summary || op.operationId || ""}  sec=${secs}`
            );
          }
        }
      }
      console.log("opCount:", opCount);
      console.log("definitions:", Object.keys(spec.definitions || {}).length);
      console.log("wrote", outFile);
      break;
    }
  }
}
