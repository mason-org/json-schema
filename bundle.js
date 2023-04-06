const path = require("path");
const util = require("util");
const fs = require("fs");
const Bundler = require("@hyperjump/json-schema-bundle");
const resolveUri = require("@jridgewell/resolve-uri");
const parseURI = require("parse-uri");

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const glob = util.promisify(require("glob"));

function normalizeRef(ref) {
  const uri = parseURI(ref);
  return uri.relative
    .replace(/^\/mason-registry\.json\//, "")
    .replaceAll("/", ":");
}

function normalizeKeys(schema) {
  for (const key in schema) {
    const new_key = normalizeRef(key);
    schema[new_key] = schema[key];
    delete schema[new_key].$id;
    delete schema[key];
  }
}

function expandRefs(schema, id) {
  if (typeof schema !== "object") {
    return;
  }

  if (Array.isArray(schema)) {
    for (const item of schema) {
      expandRefs(item, id);
    }
    return;
  }

  for (let [key, value] of Object.entries(schema)) {
    if (key == "$defs") {
      schema.definitions = value;
      delete schema.$defs;
    } else if (key == "$ref") {
      value = value.replace(/\$defs/, "definitions");
      schema.$ref = resolveUri(value, id);
    }

    expandRefs(value, schema.$id ?? id);
  }
}

function normalizeRefs(schema) {
  if (typeof schema !== "object") {
    return;
  }

  if (Array.isArray(schema)) {
    for (const item of schema) {
      normalizeRefs(item);
    }
    return;
  }

  for (const [key, value] of Object.entries(schema)) {
    delete value.$id;
    if (key == "$ref") {
      const uri = parseURI(value);
      schema.$ref = "#/definitions/" + normalizeRef(uri.path) + uri.anchor;
    } else {
      normalizeRefs(value);
    }
  }
}

function draft07Compat(schema) {
  const originalId = schema.$id;
  expandRefs(schema, originalId);
  normalizeKeys(schema.definitions);
  normalizeRefs(schema);
  schema.$id = originalId;
  schema.$schema = "http://json-schema.org/draft-07/schema#";
}

async function main() {
  for (const schema of await glob(
    path.join(
      path.resolve(__dirname, "mason-registry", "schemas"),
      "{components,enums}/**/*.json"
    ),
    {}
  )) {
    console.log("Adding schema", schema);
    Bundler.add(JSON.parse(await readFile(schema)));
  }

  const main = await Bundler.get(
    `file://${path.resolve(
      __dirname,
      "mason-registry",
      "schemas",
      "package.schema.json"
    )}`
  );

  console.log("Bundling…");
  const schema = await Bundler.bundle(main);
  draft07Compat(schema);
  await writeFile(
    path.resolve(__dirname, "bundled-schema.json"),
    JSON.stringify(schema, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
