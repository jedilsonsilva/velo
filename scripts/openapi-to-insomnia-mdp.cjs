const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const specPath = path.join(__dirname, "..", "collections", "maria-da-penha-openapi.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const schemas = spec.components?.schemas || {};
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const BASE_URL = "https://api-mariadapenha-dev.pmerj.seg.br";
const TAG_ORDER = [
  "Autenticação",
  "Sistema",
  "Militares",
  "Medidas Protetivas",
  "Protegidas",
  "Visitas",
  "Contato Vitima",
  "Meus BOPMs",
  "BOPM Online",
  "Envolvidos",
  "Apreensões",
  "VeiculosEnvolvidos",
  "MeiosUtilizados",
  "Deslocamentos",
  "Guarnicao",
  "Brat",
  "Lookup",
  "Abastecimento",
  "Assunção",
  "Mapa",
];

const LOGIN_AFTER_SCRIPT = [
  "const body = insomnia.response.json();",
  "if (body && body.accessToken) {",
  '  insomnia.environment.set("token", body.accessToken);',
  "}",
  "if (body && body.refreshToken) {",
  '  insomnia.environment.set("refreshToken", body.refreshToken);',
  "}",
].join("\n");

function uid() {
  return crypto.randomUUID().replace(/-/g, "");
}

function envData() {
  return {
    baseUrl: BASE_URL,
    apiKey: "",
    token: "",
    refreshToken: "",
    cpf: "11122233344",
    senha: "123ab",
    placa: "SRR0H86",
  };
}

function envKeys() {
  return Object.keys(envData());
}

function resolveRef(node, seen = new Set()) {
  if (!node || typeof node !== "object") return node;
  if (node.$ref) {
    const name = node.$ref.split("/").pop();
    if (seen.has(name)) return { type: "object" };
    seen.add(name);
    return resolveRef(schemas[name] || {}, seen);
  }
  if (Array.isArray(node.allOf) && node.allOf.length) {
    return node.allOf.reduce(
      (acc, part) => {
        const resolved = resolveRef(part, seen);
        return {
          ...acc,
          ...resolved,
          properties: { ...(acc.properties || {}), ...(resolved.properties || {}) },
          required: [...new Set([...(acc.required || []), ...(resolved.required || [])])],
        };
      },
      { type: "object" }
    );
  }
  if (Array.isArray(node.oneOf) && node.oneOf.length) return resolveRef(node.oneOf[0], seen);
  if (Array.isArray(node.anyOf) && node.anyOf.length) return resolveRef(node.anyOf[0], seen);
  return node;
}

function fieldExample(key, schema) {
  if (key === "cpf") return "{{ _.cpf }}";
  if (key === "senha") return "{{ _.senha }}";
  if (key === "refreshToken") return "{{ _.refreshToken }}";
  if (key === "accessToken") return "{{ _.token }}";
  return exampleFromSchema(schema);
}

function exampleFromSchema(schema, seen = new Set()) {
  const resolved = resolveRef(schema, seen);
  if (!resolved || typeof resolved !== "object") return null;
  if (resolved.example !== undefined) return resolved.example;
  if (Array.isArray(resolved.enum) && resolved.enum.length) return resolved.enum[0];
  if (resolved.default !== undefined) return resolved.default;
  const type = resolved.type;
  if (type === "array") return [exampleFromSchema(resolved.items || { type: "string" }, seen)];
  if (type === "object" || resolved.properties) {
    const obj = {};
    for (const [key, prop] of Object.entries(resolved.properties || {})) {
      obj[key] = fieldExample(key, prop);
    }
    return obj;
  }
  if (type === "integer" || type === "number") return 1;
  if (type === "boolean") return true;
  if (resolved.format === "date-time") return "2026-01-01T00:00:00.000Z";
  if (resolved.format === "date") return "2026-01-01";
  return "";
}

function paramExample(param) {
  const schema = resolveRef(param.schema || {});
  if (param.example !== undefined) return String(param.example);
  if (schema.example !== undefined) return String(schema.example);
  if (param.name === "cpf" || schema.properties?.cpf) return "{{ _.cpf }}";
  if (param.name === "placa") return "{{ _.placa }}";
  if (schema.default !== undefined) return String(schema.default);
  const type = schema.type || param.type;
  if (type === "number" || type === "integer") return "1";
  return "";
}

function securityOf(op) {
  const items = Array.isArray(op.security) ? op.security : [];
  const names = items.flatMap((item) => Object.keys(item));
  return {
    apiKey: names.includes("api-key"),
    jwt: names.includes("JWT-auth"),
  };
}

function rewriteAuthFields(example) {
  if (!example || typeof example !== "object" || Array.isArray(example)) return example;
  const mapped = { ...example };
  if (Object.prototype.hasOwnProperty.call(mapped, "cpf")) mapped.cpf = "{{ _.cpf }}";
  if (Object.prototype.hasOwnProperty.call(mapped, "senha")) mapped.senha = "{{ _.senha }}";
  if (Object.prototype.hasOwnProperty.call(mapped, "refreshToken")) mapped.refreshToken = "{{ _.refreshToken }}";
  if (Object.prototype.hasOwnProperty.call(mapped, "accessToken")) mapped.accessToken = "{{ _.token }}";
  return mapped;
}

function contentTypeAndBody(requestBody) {
  if (!requestBody?.content) return { headers: [], body: {} };
  if (requestBody.content["application/json"]) {
    const json = requestBody.content["application/json"];
    const example = rewriteAuthFields(
      json.examples?.example?.value ?? json.example ?? exampleFromSchema(json.schema)
    );
    return {
      headers: [{ name: "Content-Type", value: "application/json" }],
      body: { mimeType: "application/json", text: JSON.stringify(example ?? {}, null, 2) },
    };
  }
  if (requestBody.content["multipart/form-data"]) {
    const schema = resolveRef(requestBody.content["multipart/form-data"].schema);
    return {
      headers: [],
      body: {
        mimeType: "multipart/form-data",
        params: Object.entries(schema.properties || {}).map(([key, prop]) => {
          const resolved = resolveRef(prop);
          const isFile = resolved.format === "binary" || resolved.type === "file";
          return {
            id: "pair_" + uid(),
            name: key,
            value: isFile ? "" : String(exampleFromSchema(resolved) ?? ""),
            type: isFile ? "file" : "text",
          };
        }),
      },
    };
  }
  return { headers: [], body: {} };
}

function requestName(method, pathname, op) {
  const text = (op.summary || "").trim();
  if (text) return text;
  if ((op.description || "").trim()) return op.description.trim();
  return `${method.toUpperCase()} ${pathname}`;
}

function buildOperations() {
  const ops = [];
  for (const [pathname, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      const params = op.parameters || [];
      const pathParams = params.filter((p) => p.in === "path");
      const queryParams = params.filter((p) => p.in === "query");
      const headerParams = params.filter((p) => p.in === "header");
      const sec = securityOf(op);
      const payload = contentTypeAndBody(op.requestBody);
      const headers = [
        { name: "x-api-key", value: "{{ _.apiKey }}", description: "API Key obrigatória" },
        ...payload.headers,
        ...headerParams.map((p) => ({
          name: p.name,
          value: paramExample(p),
          description: p.description || "",
        })),
      ];
      ops.push({
        pathname,
        method,
        op,
        tag: (op.tags && op.tags[0]) || "Outros",
        pathParams,
        queryParams,
        headers,
        body: payload.body,
        jwt: sec.jwt,
      });
    }
  }
  return ops;
}

function pathValue(pathname, name, pathParams) {
  if (name === "cpf") return "{{ _.cpf }}";
  if (name === "placa") return "{{ _.placa }}";
  const param = pathParams.find((p) => p.name === name);
  if (param) {
    const value = paramExample(param);
    if (value) return value;
  }
  return `{{ _.${name} }}`;
}

function buildInsomnia(ops) {
  const workspaceId = "__WORKSPACE_ID__";
  const baseEnvId = "__BASE_ENVIRONMENT_ID__";
  const resources = [
    {
      _id: workspaceId,
      parentId: null,
      modified: Date.now(),
      created: Date.now(),
      name: "Maria da Penha",
      description:
        "Collection gerada do Swagger Maria da Penha API.\n" +
        "Origem: https://api-mariadapenha-dev.pmerj.seg.br/swagger\n\n" +
        "Como autenticar:\n" +
        "1. Selecione o ambiente DEV no seletor da collection.\n" +
        "2. Preencha apiKey, cpf e senha.\n" +
        "3. Execute Autenticação > Login de usuário.\n" +
        "4. O after-response grava accessToken em token e o refreshToken.\n" +
        "5. Os requests autenticados enviam x-api-key e Bearer {{ _.token }}.",
      scope: "collection",
      _type: "workspace",
    },
    {
      _id: "__COOKIE_JAR_1__",
      parentId: workspaceId,
      modified: Date.now(),
      created: Date.now(),
      name: "Default Jar",
      cookies: [],
      _type: "cookie_jar",
    },
    {
      _id: baseEnvId,
      parentId: workspaceId,
      modified: Date.now(),
      created: Date.now(),
      name: "Base Environment",
      data: envData(),
      dataPropertyOrder: { "&": envKeys() },
      color: null,
      isPrivate: false,
      metaSortKey: 1,
      _type: "environment",
    },
    {
      _id: "__env_dev__",
      parentId: baseEnvId,
      modified: Date.now(),
      created: Date.now(),
      name: "DEV",
      data: envData(),
      dataPropertyOrder: { "&": envKeys() },
      color: "#3b82f6",
      isPrivate: false,
      metaSortKey: 2,
      _type: "environment",
    },
  ];

  const tagNames = [...new Set(ops.map((o) => o.tag))].sort((a, b) => {
    const ia = TAG_ORDER.indexOf(a);
    const ib = TAG_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b, "pt");
  });

  const folderIds = new Map();
  tagNames.forEach((tag, index) => {
    const id = "fld_" + uid();
    folderIds.set(tag, id);
    resources.push({
      _id: id,
      parentId: workspaceId,
      modified: Date.now(),
      created: Date.now(),
      name: tag,
      description: "",
      environment: {},
      environmentPropertyOrder: null,
      metaSortKey: index,
      _type: "request_group",
    });
  });

  ops.forEach((item, index) => {
    const urlPath = item.pathname.replace(/\{([^}]+)\}/g, (_, name) =>
      pathValue(item.pathname, name, item.pathParams)
    );
    const afterResponseScript =
      item.pathname === "/auth/login" || item.pathname === "/auth/refresh" ? LOGIN_AFTER_SCRIPT : "";

    resources.push({
      _id: "req_" + uid(),
      parentId: folderIds.get(item.tag),
      modified: Date.now(),
      created: Date.now(),
      name: requestName(item.method, item.pathname, item.op),
      description: item.op.description || item.op.summary || "",
      url: `{{ _.baseUrl }}${urlPath}`,
      method: item.method.toUpperCase(),
      body: item.body,
      parameters: item.queryParams.map((q) => ({
        id: "pair_" + uid(),
        name: q.name,
        value: paramExample(q),
        description: q.description || "",
        disabled: q.required === false,
      })),
      headers: item.headers,
      authentication: item.jwt
        ? { type: "bearer", token: "{{ _.token }}", prefix: "Bearer" }
        : { type: "none" },
      afterResponseScript,
      metaSortKey: index,
      isPrivate: false,
      settingStoreCookies: true,
      settingSendCookies: true,
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true,
      settingRebuildPath: true,
      settingFollowRedirects: "global",
      _type: "request",
    });
  });

  return {
    _type: "export",
    __export_format: 4,
    __export_date: new Date().toISOString(),
    __export_source: "velo.openapi-to-insomnia-mdp",
    resources,
  };
}

function buildPostmanEnvironment() {
  return {
    id: uid(),
    name: "Maria da Penha DEV",
    values: envKeys().map((key) => ({
      key,
      value: envData()[key],
      enabled: true,
    })),
    _postman_variable_scope: "environment",
  };
}

const ops = buildOperations();
const outDir = path.join(__dirname, "..", "collections");
fs.mkdirSync(outDir, { recursive: true });
const insomniaFile = path.join(outDir, "Maria-da-Penha.insomnia.json");
const envFile = path.join(outDir, "Maria-da-Penha.postman_environment.json");
fs.writeFileSync(insomniaFile, JSON.stringify(buildInsomnia(ops), null, 2));
fs.writeFileSync(envFile, JSON.stringify(buildPostmanEnvironment(), null, 2));

console.log(`operations: ${ops.length}`);
console.log(`folders: ${[...new Set(ops.map((o) => o.tag))].join(" | ")}`);
console.log("jwt:", ops.filter((o) => o.jwt).length);
console.log("api-key only:", ops.filter((o) => !o.jwt).length);
console.log("wrote", insomniaFile);
console.log("wrote", envFile);
