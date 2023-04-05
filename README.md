# json-schema

Hosts JSON schemas for Mason registries.

## Schema bundling

This repository contains a script that bundles the [package schema files](https://github.com/mason-org/mason-registry/tree/main/schemas)
into a single, portable, JSON schema file.

```sh
$ git submodule update --init
$ npm install
$ node bundle
```
