const fs = require("fs");
const planPath = process.argv[2];
const n = Number(process.argv[3]);
const outPath = process.argv[4];
const plan = fs.readFileSync(planPath, "utf8");
const lines = plan.split(/\r?\n/);
let out = [];
let intask = false;
let infence = false;
const heading = new RegExp("^#{1,6}\\s+Task\\s+" + n + "([^0-9]|$)");
for (const line of lines) {
  if (/^```/.test(line)) infence = !infence;
  if (!infence && /^#{1,6}\s+Task\s+\d+/.test(line)) {
    intask = heading.test(line);
  }
  if (intask) out.push(line);
}
if (!out.length) {
  console.error("task not found", n);
  process.exit(3);
}
fs.mkdirSync(require("path").dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out.join("\n"));
console.log("wrote", outPath, out.length, "lines");
