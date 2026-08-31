import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";
import {
  EVENT_TYPES,
  INTEGRATION_HEADERS,
} from "../src/constants.mjs";
import { validateSchema } from "../src/validate.mjs";

const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const schemaDirectory = path.join(packageDirectory, "schemas", "v1");
const openapiPath = path.join(packageDirectory, "openapi", "openapi.v1.yaml");

const schemaFiles = fs
  .readdirSync(schemaDirectory)
  .filter((name) => name.endsWith(".schema.json"))
  .sort();

assert.ok(schemaFiles.length >= 10, "Seluruh schema V1 harus tersedia.");

for (const name of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDirectory, name), "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.match(schema.$id, /^https:\/\/seputarjaminan\.com\/contracts\/v1\//);
  assert.equal(schema.additionalProperties, false, name + " harus menolak unknown field pada root.");
  validateSchema(schema.$id, {});
}

const api = await SwaggerParser.validate(openapiPath);
assert.equal(api.openapi, "3.1.0");
assert.equal(api.info.version, "1.0.0");

const expectedSecurityHeaders = Object.values(INTEGRATION_HEADERS).sort();
const actualSecurityHeaders = [
  "InstitutionId",
  "KeyId",
  "RequestTimestamp",
  "RequestNonce",
  "ContentSha256",
  "Ed25519Signature",
]
  .map((name) => api.components.securitySchemes[name].name)
  .sort();
assert.deepEqual(actualSecurityHeaders, expectedSecurityHeaders);

const signedOperations = [
  api.paths["/v1/ingest/events"].post,
  api.paths["/v1/media/upload-sessions"].post,
  api.paths["/v1/media/upload-sessions/{sessionId}/complete"].post,
  api.paths["/v1/media/{mediaId}/status"].get,
  api.paths["/v1/reconciliation/manifests"].post,
  api.paths["/v1/reconciliation/runs/{runId}"].get,
];

for (const operation of signedOperations) {
  const schemeNames = Object.keys(operation.security[0]).sort();
  assert.deepEqual(
    schemeNames,
    [
      "ContentSha256",
      "Ed25519Signature",
      "InstitutionId",
      "KeyId",
      "RequestNonce",
      "RequestTimestamp",
    ],
  );
}

for (const [route, pathItem] of Object.entries(api.paths)) {
  if (!route.startsWith("/v1/public/")) {
    continue;
  }
  for (const method of Object.keys(pathItem)) {
    if (["parameters", "summary", "description"].includes(method)) {
      continue;
    }
    assert.equal(method, "get", "Public API V1 wajib view-only: " + route);
    assert.deepEqual(pathItem[method].security, []);
  }
}

const envelope = JSON.parse(
  fs.readFileSync(path.join(schemaDirectory, "event-envelope.schema.json"), "utf8"),
);
assert.deepEqual(envelope.properties.event_type.enum, EVENT_TYPES);

const forbiddenOps = [];
for (const [route, pathItem] of Object.entries(api.paths)) {
  if (!route.startsWith("/v1/ops/")) {
    continue;
  }
  for (const method of ["patch", "put"]) {
    if (pathItem[method]) {
      forbiddenOps.push(method.toUpperCase() + " " + route);
    }
  }
}
assert.deepEqual(
  forbiddenOps,
  [],
  "Ops pusat tidak boleh mempunyai endpoint untuk mengedit konten katalog.",
);

console.log(
  "Kontrak V1 valid: " + schemaFiles.length + " JSON Schema dan " + Object.keys(api.paths).length + " path OpenAPI.",
);
