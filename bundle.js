const path = require("path");
const util = require("util");
const fs = require("fs");
const Bundler = require("@hyperjump/json-schema-bundle");

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const glob = util.promisify(require("glob"));

/**
 * @param {string} id
 * @return {string}
 */
function normalizeId(id) {
  return id
    .replace("https://github.com/mason-org/mason-registry/schemas/", "")
    .replace("/mason-org/mason-registry/schemas/", "")
    .replace(/\//g, ":");
}

/**
 * @param {Record<string, any>} schema
 * @param {string[]} path
 * @return {string}
 */
function expandId(schema, path) {
  let id = "";
  for (const p of path) {
    if (schema[p]["$id"]) {
      id = `${id}/${schema[p]["$id"].split("/").slice(0, -1).join("/")}`;
    }
    schema = schema[p];
  }
  if (id != "") {
    return normalizeId(id).replace(/^:/, "/") + ":";
  } else {
    return "/";
  }
}

const visits = {};

/**
 * @param {Record<string, any>} schema
 * @param {string[]?} path
 */
function normalizeRefs(schema, path) {
  path = path ?? [];
  const localSchema = path.reduce((obj, key) => obj[key], schema);
  visits[path.join(".")] = (visits[path.join(".")] ?? 0) + 1;
  if (visits[path.join(".")] > 1) {
    return;
  }
  for (const key in localSchema) {
    if (key === "$ref") {
      if (!/^[\/#]/.test(localSchema["$ref"])) {
        localSchema["$ref"] = `#/$defs${expandId(schema, path)}${normalizeId(
          localSchema["$ref"]
        )}`;
      } else if (!localSchema["$ref"].startsWith("#")) {
        localSchema["$ref"] = `#/$defs/${normalizeId(localSchema["$ref"])}`;
      }
    } else if (key === "$defs") {
      for (const def in localSchema["$defs"]) {
        delete localSchema["$defs"][def]["$id"];
        normalizeRefs(schema, [...path, key]);
        schema["$defs"][normalizeId(def)] = localSchema["$defs"][def];
        delete localSchema["$defs"][def];
      }
    } else if (typeof localSchema[key] === "object") {
      normalizeRefs(schema, [...path, key]);
    }
  }
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
  const bundle = await Bundler.bundle(main);
  normalizeRefs(bundle);
  console.log(visits);
  await writeFile(
    path.resolve(__dirname, "bundled-schema.json"),
    JSON.stringify(bundle, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
