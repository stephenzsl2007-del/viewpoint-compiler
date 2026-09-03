import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { removeMarketplaceEntry, upsertMarketplace } from "../bin/viewpoint-compiler.mjs";

test("upsertMarketplace creates and updates a personal marketplace without duplicates", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "viewpoint-marketplace-test-"));
  const marketplacePath = path.join(root, ".agents", "plugins", "marketplace.json");
  try {
    assert.equal(await upsertMarketplace(marketplacePath), "personal");
    assert.equal(await upsertMarketplace(marketplacePath), "personal");
    const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
    assert.equal(marketplace.plugins.length, 1);
    assert.equal(marketplace.plugins[0].name, "viewpoint-compiler");
    assert.equal(marketplace.plugins[0].source.path, "./plugins/viewpoint-compiler");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removeMarketplaceEntry preserves unrelated plugins", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "viewpoint-marketplace-test-"));
  const marketplacePath = path.join(root, ".agents", "plugins", "marketplace.json");
  try {
    await mkdir(path.dirname(marketplacePath), { recursive: true });
    await writeFile(marketplacePath, JSON.stringify({
      name: "personal",
      interface: { displayName: "Personal" },
      plugins: [{ name: "other-plugin" }, { name: "viewpoint-compiler" }],
    }));
    assert.equal(await removeMarketplaceEntry(marketplacePath), true);
    const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
    assert.deepEqual(marketplace.plugins, [{ name: "other-plugin" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
