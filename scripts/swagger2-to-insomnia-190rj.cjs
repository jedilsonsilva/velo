const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const specPath = path.join(__dirname, "..", "collections", "190rj-openapi.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const definitions = spec.definitions || {};
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const BASE_URL = "https://api-homologacao190rj.pmerj.seg.br/api/v3/teste-190-rj";
const TAG_ORDER = [
  "Autenticação",
  "Usuário",
  "Chamados",
  "Denuncia",
  "Tipo de denuncia",
  "Tipo de chamado",
  "Tipo de endereço",
  "Familiares",
  "Guardiao",
  "Desaparecidos",
  "Veículo",
  "Bike",
  "IMEI",
  "Celulares",
  "Cidades",
  "Grupo de atuação",
  "Waze",
  "DASHBOARDS",
  "Stats Usuário",
  "Agenda",
  "EVENTO",
  "Carnaval",
  "Pesquisa Satifação",
  "Notificação App",
  "Banner",
  "Token",
  "Admin",
  "Public",
  "CHAVES",
  "Versionamento",
];

const LOGIN_AFTER_SCRIPT = [
  "const body = insomnia.response.json();",
  "if (body && body.tokenLogin) {",
  '  insomnia.environment.set("token", body.tokenLogin);',
  "}",
  "if (body && body.refreshToken) {",
  '  insomnia.environment.set("refreshToken", body.refreshToken);',
  "}",
].join("\n");

function uid() {
  return crypto.randomUUID().replace(/-/g, "");
}

function resolveRef(node, seen = new Set()) {
  if (!node || typeof node !== "object") return node;
  if (node.$ref) {
    const name = node.$ref.split("/").pop();
    if (seen.has(name)) return { type: "object" };
    seen.add(name);
    return resolveRef(definitions[name] || {}, seen);
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
  return node;
}

function fieldExample(key, schema) {
  if (key === "email") return "{{ _.email }}";
  if (key === "senha") return "{{ _.senha }}";
  if (key === "tokenLogin") return "{{ _.token }}";
  if (key === "tokenRefresh" || key === "refreshToken") return "{{ _.refreshToken }}";
  return exampleFromSchema(schema);
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
      obj[key] = fieldExample(key, prop);
    }
    return obj;
  }
  if (type === "integer" || type === "number") return 1;
  if (type === "boolean") return true;
  if (resolved.format === "date-time") return "2026-01-01T00:00:00.000Z";
  if (resolved.format === "date") return "2026-01-01";
  if (resolved.format === "binary" || type === "file") return null;
  return "";
}

function paramExample(param) {
  const schema = resolveRef(param.schema || {});
  if (param.example !== undefined) return String(param.example);
  if (schema.example !== undefined) return String(schema.example);
  if (param.name === "email") return "{{ _.email }}";
  if (param.name === "token" && !/resetar-senha/.test(param.name)) return "{{ _.token }}";
  if (param.name === "tokenSms") return "{{ _.tokenSms }}";
  const type = param.type || schema.type;
  if (type === "number" || type === "integer") return "1";
  return schema.example !== undefined ? String(schema.example) : "";
}

function isAuthHeader(param) {
  const loc = String(param.in || "");
  const name = String(param.name || "");
  return loc === "Authorization" || name === "Authorization" || (name === "header" && loc === "Authorization");
}

function usesBearer(op) {
  const security = op.security;
  if (!Array.isArray(security) || security.length === 0) return false;
  return security.some((item) => Object.keys(item).includes("bearerAuth"));
}

function requestName(method, pathname, op) {
  const text = (op.summary || op.description || "").trim();
  if (text) return text;
  return `${method.toUpperCase()} ${pathname}`;
}

function buildOperations() {
  const ops = [];
  for (const [pathname, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      const params = op.parameters || [];
      const pathParams = params
        .filter((p) => p.in === "path" || p.in === "params")
        .map((p) => {
          const key = p.name;
          const isResetToken = pathname.includes("/auth/resetar-senha") && key === "token";
          return {
            key,
            value: isResetToken ? "{{ _.tokenReset }}" : paramExample(p) || `{{ _.${key} }}`,
            description: p.description || "",
          };
        });
      const queryParams = params
        .filter((p) => p.in === "query")
        .map((p) => ({
          key: p.name,
          value: paramExample(p),
          description: p.description || "",
          disabled: p.required === false,
        }));

      const extraHeaders = [];
      for (const p of params) {
        if (isAuthHeader(p)) continue;
        if (p.in === "x-refresh-token" || p.name === "x-refresh-token") {
          extraHeaders.push({
            name: "x-refresh-token",
            value: "{{ _.refreshToken }}",
            description: p.description || "Refresh token",
          });
          continue;
        }
        if (p.in === "header" && p.name === "Accept-Language") {
          extraHeaders.push({
            name: "Accept-Language",
            value: "{{ _.locale }}",
            description: p.description || "",
          });
        }
      }

      const bodyParam = params.find((p) => p.in === "body");
      const formParams = params.filter((p) => p.in === "formData");
      let body = {};
      const headers = [...extraHeaders];

      if (formParams.length) {
        body = {
          mimeType: "multipart/form-data",
          params: formParams.map((p) => {
            const isFile = p.type === "file" || p.items?.type === "file" || p.type === "array";
            return {
              id: "pair_" + uid(),
              name: p.name,
              value: isFile ? "" : String(paramExample(p)),
              description: p.description || "",
              type: isFile ? "file" : "text",
              disabled: p.required === false,
            };
          }),
        };
      } else if (bodyParam?.schema) {
        const example = exampleFromSchema(bodyParam.schema);
        headers.push({ name: "Content-Type", value: "application/json" });
        body = {
          mimeType: "application/json",
          text: JSON.stringify(example ?? {}, null, 2),
        };
      }

      ops.push({
        pathname,
        method,
        op,
        tag: (op.tags && op.tags[0]) || "Outros",
        pathParams,
        queryParams,
        headers,
        body,
        auth: usesBearer(op),
      });
    }
  }
  return ops;
}

function envData() {
  return {
    baseUrl: BASE_URL,
    token: "",
    refreshToken: "",
    email: "usuario@mail.com",
    senha: "123456",
    locale: "pt-BR",
    tokenReset: "",
    tokenSms: "",
  };
}

function envKeys() {
  return Object.keys(envData());
}

function buildInsomnia(ops) {
  const workspaceId = "__WORKSPACE_ID__";
  const baseEnvId = "__BASE_ENVIRONMENT_ID__";
  const homologEnvId = "__env_homologacao__";
  const resources = [
    {
      _id: workspaceId,
      parentId: null,
      modified: Date.now(),
      created: Date.now(),
      name: "190RJ",
      description:
        "Collection gerada do Swagger 190RJ.\n" +
        "Origem: https://api-homologacao190rj.pmerj.seg.br/api/v3/teste-190-rj/docs/\n\n" +
        "Como autenticar:\n" +
        "1. Selecione o ambiente Homologação no seletor da collection.\n" +
        "2. Preencha email e senha.\n" +
        "3. Execute Autenticação > POST /auth/login.\n" +
        "4. O after-response grava tokenLogin em token e o refreshToken.\n" +
        "5. Os demais requests autenticados usam Bearer {{ _.token }}.",
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
      _id: homologEnvId,
      parentId: baseEnvId,
      modified: Date.now(),
      created: Date.now(),
      name: "Homologação",
      data: envData(),
      dataPropertyOrder: { "&": envKeys() },
      color: "#22c55e",
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
    let urlPath = item.pathname.replace(/\{([^}]+)\}/g, (_, name) => {
      if (item.pathname.includes("/auth/resetar-senha") && name === "token") return "{{ _.tokenReset }}";
      const mapped = item.pathParams.find((p) => p.key === name);
      return mapped?.value || `{{ _.${name} }}`;
    });

    const afterResponseScript =
      item.pathname === "/auth/login" || item.pathname === "/auth/refresh-token" ? LOGIN_AFTER_SCRIPT : "";

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
        name: q.key,
        value: q.value,
        description: q.description,
        disabled: Boolean(q.disabled),
      })),
      headers: item.headers,
      authentication: item.auth
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
    __export_source: "velo.swagger2-to-insomnia",
    resources,
  };
}

function buildPostmanEnvironment() {
  return {
    id: uid(),
    name: "190RJ Homologação",
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
const insomniaFile = path.join(outDir, "190RJ.insomnia.json");
const envFile = path.join(outDir, "190RJ.postman_environment.json");
fs.writeFileSync(insomniaFile, JSON.stringify(buildInsomnia(ops), null, 2));
fs.writeFileSync(envFile, JSON.stringify(buildPostmanEnvironment(), null, 2));

console.log(`operations: ${ops.length}`);
console.log(`folders: ${[...new Set(ops.map((o) => o.tag))].join(" | ")}`);
console.log("bearer:", ops.filter((o) => o.auth).length);
console.log("public:", ops.filter((o) => !o.auth).length);
console.log("json bodies:", ops.filter((o) => o.body?.mimeType === "application/json").length);
console.log("formdata:", ops.filter((o) => o.body?.mimeType === "multipart/form-data").length);
console.log("wrote", insomniaFile);
console.log("wrote", envFile);
