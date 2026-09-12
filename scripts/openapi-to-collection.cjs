const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const specPath = path.join(__dirname, "..", "collections", "smart-gm-openapi.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const schemas = spec.components?.schemas || {};
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const BASE_URL = "https://api-smart-gm-dev.pmerj.seg.br";
const TAG_ORDER = [
  "Auth",
  "Buscas",
  "BOPM - Boletim",
  "BOPM",
  "BOPM - Armas",
  "BOPM - Drogas",
  "BOPM - Locais",
  "BOPM - Apreensões",
  "BOPM - Veículos",
  "Pessoa",
  "BOPM - BRAT",
  "BFF",
];

function uid() {
  return crypto.randomUUID();
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

function exampleFromSchema(schema, seen = new Set()) {
  const resolved = resolveRef(schema, seen);
  if (!resolved || typeof resolved !== "object") return null;
  if (resolved.example !== undefined) return resolved.example;
  if (Array.isArray(resolved.enum) && resolved.enum.length) return resolved.enum[0];
  if (resolved.default !== undefined) return resolved.default;

  const type = resolved.type;
  if (type === "array") {
    const item = exampleFromSchema(resolved.items || { type: "string" }, seen);
    return [item];
  }
  if (type === "object" || resolved.properties) {
    const obj = {};
    for (const [key, prop] of Object.entries(resolved.properties || {})) {
      obj[key] = exampleFromSchema(prop, seen);
    }
    return obj;
  }
  if (type === "integer" || type === "number") return 1;
  if (type === "boolean") return true;
  if (resolved.format === "date-time") return "2026-01-01T00:00:00.000Z";
  if (resolved.format === "date") return "2026-01-01";
  if (resolved.format === "binary") return null;
  return "";
}

const AUTH_EXAMPLES = {
  LoginRequestDto: { cpf: "{{cpf}}", senha: "{{senha}}" },
  EnviarCodigoLoginRequestDto: { cpf: "{{cpf}}" },
  EnviarCodigoRequestDto: { cpf: "{{cpf}}", dataNascimento: "{{dataNascimento}}" },
  ValidarSmsRequestDto: { codigo: "{{codigoSms}}" },
  DefinirSenhaRequestDto: { cpf: "{{cpf}}", codigo: "{{codigoSms}}", senha: "{{senha}}" },
  ConsultarCodigoSmsRequestDto: { cpf: "{{cpf}}" },
};

function schemaRefName(schema) {
  return schema?.$ref ? schema.$ref.split("/").pop() : null;
}

function contentTypeAndBody(requestBody) {
  if (!requestBody?.content) return { mode: null };
  if (requestBody.content["application/json"]) {
    const schema = requestBody.content["application/json"].schema;
    const refName = schemaRefName(schema);
    const example =
      AUTH_EXAMPLES[refName] ??
      requestBody.content["application/json"].example ??
      requestBody.content["application/json"].examples?.default?.value ??
      exampleFromSchema(schema);
    return {
      mode: "raw",
      contentType: "application/json",
      raw: JSON.stringify(example ?? {}, null, 2),
    };
  }
  if (requestBody.content["multipart/form-data"]) {
    const schema = resolveRef(requestBody.content["multipart/form-data"].schema);
    const formdata = Object.entries(schema.properties || {}).map(([key, prop]) => {
      const resolved = resolveRef(prop);
      const isFile = resolved.format === "binary" || resolved.type === "string" && resolved.format === "binary";
      if (key === "photo" || isFile) {
        return { key, type: "file", src: "", description: resolved.description || "" };
      }
      return {
        key,
        type: "text",
        value: String(exampleFromSchema(resolved) ?? ""),
        description: resolved.description || "",
      };
    });
    return { mode: "formdata", contentType: "multipart/form-data", formdata };
  }
  return { mode: null };
}

const PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/telefone",
  "/auth/senha/codigo",
  "/auth/senha/definir",
  "/auth/senha/codigo/existe",
]);

function usesBearer(pathname) {
  return !PUBLIC_PATHS.has(pathname);
}

function paramValue(param) {
  const schema = resolveRef(param.schema || {});
  if (param.example !== undefined) return String(param.example);
  if (schema.example !== undefined) return String(schema.example);
  if (param.name === "cpf") return "{{cpf}}";
  if (param.name === "idBoletim") return "{{idBoletim}}";
  if (param.name === "placa") return "{{placa}}";
  if (param.name === "idMarcaArma") return "{{idMarcaArma}}";
  if (schema.type === "number" || schema.type === "integer") return "1";
  return "";
}

function postmanUrl(pathname, pathParams, queryParams) {
  const segments = pathname.split("/").filter(Boolean).map((seg) => {
    const m = seg.match(/^\{(.+)\}$/);
    return m ? `:${m[1]}` : seg;
  });
  return {
    raw: `{{baseUrl}}${pathname.replace(/\{([^}]+)\}/g, ":$1")}${
      queryParams.length ? `?${queryParams.map((q) => `${q.key}=${q.value}`).join("&")}` : ""
    }`,
    host: ["{{baseUrl}}"],
    path: segments,
    variable: pathParams.map((p) => ({ key: p.key, value: p.value, description: p.description })),
    query: queryParams,
  };
}

function buildOperations() {
  const ops = [];
  for (const [pathname, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      const tag = (op.tags && op.tags[0]) || "Outros";
      const params = op.parameters || [];
      const pathParams = params
        .filter((p) => p.in === "path")
        .map((p) => ({
          key: p.name,
          value: paramValue(p),
          description: p.description || "",
        }));
      const queryParams = params
        .filter((p) => p.in === "query")
        .map((p) => ({
          key: p.name,
          value: paramValue(p),
          description: p.description || "",
          disabled: !p.required,
        }));
      ops.push({
        pathname,
        method,
        op,
        tag,
        pathParams,
        queryParams,
        body: contentTypeAndBody(op.requestBody),
        auth: usesBearer(pathname),
      });
    }
  }
  return ops;
}

function loginScripts(pathname, method) {
  if (method === "post" && (pathname === "/auth/login" || pathname === "/auth/mfa/sms/validar")) {
    return {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          "if (pm.response.code === 200) {",
          "  const json = pm.response.json();",
          "  if (json.accessToken) {",
          "    pm.collectionVariables.set('token', json.accessToken);",
          "    pm.environment.set('token', json.accessToken);",
          "  }",
          "}",
        ],
      },
    };
  }
  return null;
}

function buildPostman(ops) {
  const folders = new Map();
  const tagNames = [...new Set(ops.map((o) => o.tag))].sort((a, b) => {
    const ia = TAG_ORDER.indexOf(a);
    const ib = TAG_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });

  for (const tag of tagNames) {
    folders.set(tag, {
      name: tag,
      item: [],
      description: `Endpoints do grupo ${tag}`,
    });
  }

  for (const item of ops) {
    const name = item.op.summary || item.op.operationId || `${item.method.toUpperCase()} ${item.pathname}`;
    const body = {};
    const headers = [];
    if (item.body.mode === "raw") {
      body.mode = "raw";
      body.raw = item.body.raw;
      body.options = { raw: { language: "json" } };
      headers.push({ key: "Content-Type", value: "application/json" });
    } else if (item.body.mode === "formdata") {
      body.mode = "formdata";
      body.formdata = item.body.formdata;
    }

    const events = [];
    const test = loginScripts(item.pathname, item.method);
    if (test) events.push(test);

    folders.get(item.tag).item.push({
      name,
      request: {
        method: item.method.toUpperCase(),
        header: headers,
        body: item.body.mode ? body : undefined,
        url: postmanUrl(item.pathname, item.pathParams, item.queryParams),
        description: item.op.description || item.op.summary || "",
        auth: item.auth
          ? undefined
          : { type: "noauth" },
      },
      event: events.length ? events : undefined,
    });
  }

  return {
    info: {
      _postman_id: uid(),
      name: spec.info?.title || "INTEGRACAO-GM",
      description:
        `${spec.info?.description || "API de Integracao GM"}\n\n` +
        `Origem: https://api-smart-gm-dev.pmerj.seg.br/docs\n` +
        `Versão do contrato: ${spec.info?.version || "1.0"}\n\n` +
        `Como usar:\n` +
        `1. Importe esta collection e o environment.\n` +
        `2. Preencha cpf e senha no environment.\n` +
        `3. Execute Auth > Realizar login e, se MFA estiver pendente, envie o SMS e valide o código.\n` +
        `4. Os requests autenticados usam o Bearer {{token}} automaticamente.`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{token}}", type: "string" }],
    },
    variable: [
      { key: "baseUrl", value: BASE_URL },
      { key: "token", value: "" },
      { key: "cpf", value: "12345678901" },
      { key: "senha", value: "Senha@123" },
      { key: "codigoSms", value: "123456" },
      { key: "dataNascimento", value: "1990-01-01" },
      { key: "idBoletim", value: "1" },
      { key: "placa", value: "SRR0H86" },
      { key: "idMarcaArma", value: "1" },
    ],
    item: tagNames.map((tag) => folders.get(tag)),
  };
}

function buildEnvironment() {
  return {
    id: uid(),
    name: "INTEGRACAO-GM DEV",
    values: [
      { key: "baseUrl", value: BASE_URL, enabled: true },
      { key: "token", value: "", enabled: true },
      { key: "cpf", value: "12345678901", enabled: true },
      { key: "senha", value: "Senha@123", enabled: true },
      { key: "codigoSms", value: "123456", enabled: true },
      { key: "dataNascimento", value: "1990-01-01", enabled: true },
      { key: "idBoletim", value: "1", enabled: true },
      { key: "placa", value: "SRR0H86", enabled: true },
      { key: "idMarcaArma", value: "1", enabled: true },
    ],
    _postman_variable_scope: "environment",
  };
}

function buildInsomnia(ops) {
  const workspaceId = "wrk_" + uid().replace(/-/g, "");
  const envId = "env_" + uid().replace(/-/g, "");
  const resources = [
    {
      _id: workspaceId,
      parentId: null,
      modified: Date.now(),
      created: Date.now(),
      name: spec.info?.title || "INTEGRACAO-GM",
      description: spec.info?.description || "",
      scope: "collection",
      _type: "workspace",
    },
    {
      _id: envId,
      parentId: workspaceId,
      modified: Date.now(),
      created: Date.now(),
      name: "Base Environment",
      data: {
        baseUrl: BASE_URL,
        token: "",
        cpf: "12345678901",
        senha: "Senha@123",
        codigoSms: "123456",
        dataNascimento: "1990-01-01",
        idBoletim: "1",
        placa: "SRR0H86",
        idMarcaArma: "1",
      },
      dataPropertyOrder: {
        "&": [
          "baseUrl",
          "token",
          "cpf",
          "senha",
          "codigoSms",
          "dataNascimento",
          "idBoletim",
          "placa",
          "idMarcaArma",
        ],
      },
      color: null,
      isPrivate: false,
      metaSortKey: 1,
      _type: "environment",
    },
  ];

  const tagNames = [...new Set(ops.map((o) => o.tag))].sort((a, b) => {
    const ia = TAG_ORDER.indexOf(a);
    const ib = TAG_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });
  const folderIds = new Map();
  tagNames.forEach((tag, index) => {
    const id = "fld_" + uid().replace(/-/g, "");
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
    const urlPath = item.pathname.replace(/\{([^}]+)\}/g, "{{$1}}");
    const query = item.queryParams.map((q) => ({
      id: "pair_" + uid().replace(/-/g, ""),
      name: q.key,
      value: q.value,
      description: q.description,
      disabled: Boolean(q.disabled),
    }));
    const headers = [];
    let body = {};
    if (item.body.mode === "raw") {
      headers.push({ name: "Content-Type", value: "application/json" });
      body = { mimeType: "application/json", text: item.body.raw };
    } else if (item.body.mode === "formdata") {
      body = {
        mimeType: "multipart/form-data",
        params: item.body.formdata.map((field) => ({
          id: "pair_" + uid().replace(/-/g, ""),
          name: field.key,
          value: field.type === "file" ? "" : field.value,
          description: field.description,
          type: field.type === "file" ? "file" : "text",
          fileName: field.type === "file" ? "" : undefined,
        })),
      };
    }

    resources.push({
      _id: "req_" + uid().replace(/-/g, ""),
      parentId: folderIds.get(item.tag),
      modified: Date.now(),
      created: Date.now(),
      name: item.op.summary || item.op.operationId || `${item.method.toUpperCase()} ${item.pathname}`,
      description: item.op.description || "",
      url: `{{ _.baseUrl }}${urlPath}`,
      method: item.method.toUpperCase(),
      body,
      parameters: query,
      headers,
      authentication: item.auth
        ? { type: "bearer", token: "{{ _.token }}", prefix: "Bearer" }
        : { type: "none" },
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
    __export_source: "velo.openapi-to-collection",
    resources,
  };
}

const ops = buildOperations();
const outDir = path.join(__dirname, "..", "collections");
const postmanFile = path.join(outDir, "INTEGRACAO-GM.postman_collection.json");
const envFile = path.join(outDir, "INTEGRACAO-GM.postman_environment.json");
const insomniaFile = path.join(outDir, "INTEGRACAO-GM.insomnia.json");

fs.writeFileSync(postmanFile, JSON.stringify(buildPostman(ops), null, 2));
fs.writeFileSync(envFile, JSON.stringify(buildEnvironment(), null, 2));
fs.writeFileSync(insomniaFile, JSON.stringify(buildInsomnia(ops), null, 2));

console.log(`operations: ${ops.length}`);
console.log(`folders: ${[...new Set(ops.map((o) => o.tag))].join(" | ")}`);
console.log("wrote", postmanFile);
console.log("wrote", envFile);
console.log("wrote", insomniaFile);
