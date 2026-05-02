const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "dist");

const games = [
  {
    name: "RoboChip",
    inputDir: path.join(rootDir, "games", "RoboChip"),
  },
  {
    name: "PadelArcade",
    inputDir: path.join(rootDir, "games", "Pong"),
  },
];

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function inlineGameAssets(game) {
  const htmlPath = path.join(game.inputDir, "index.html");
  const cssPath = path.join(game.inputDir, "src", "styles.css");
  const jsPath = path.join(game.inputDir, "src", "game.js");

  const html = readFile(htmlPath);
  const css = readFile(cssPath);
  const js = readFile(jsPath);

  const standalone = html
    .replace(
      '<link rel="stylesheet" href="src/styles.css" />',
      `<style>\n${css}\n</style>`
    )
    .replace(
      '<script src="src/game.js"></script>',
      `<script>\n(() => {\n${js}\n})();\n</script>`
    )
    .replaceAll('href="../../index.html"', 'href="../index.html"');

  return standalone;
}

fs.mkdirSync(outputDir, { recursive: true });

games.forEach((game) => {
  const standalone = inlineGameAssets(game);
  const standalonePath = path.join(outputDir, `${game.name}_standalone.html`);
  const base64Path = path.join(outputDir, `${game.name}_base64.txt`);

  fs.writeFileSync(standalonePath, standalone);
  fs.writeFileSync(base64Path, Buffer.from(standalone, "utf8").toString("base64"));
  console.log(`Built ${game.name}: ${path.relative(rootDir, standalonePath)}`);
  console.log(`Built ${game.name}: ${path.relative(rootDir, base64Path)}`);
});
