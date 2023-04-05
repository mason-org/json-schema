const path = require("path");
const util = require("util");
const fs = require("fs");
const Bundler = require("@hyperjump/json-schema-bundle");

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const glob = util.promisify(require("glob"));

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
  bundle.$schema = "http://json-schema.org/draft-07/schema#" // add trailing "#" which gets removed for some reason
  await writeFile(
    path.resolve(__dirname, "bundled-schema.json"),
    JSON.stringify(bundle, null, 2)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
