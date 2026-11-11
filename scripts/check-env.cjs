// Nothing secret is needed at build time; this only checks Node is new enough for node:sqlite.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error(`Node ${process.versions.node} is too old. Use Node 22.5 or newer (needed for the built-in SQLite).`);
  process.exit(1);
}
