const keyboardWords = new Set(['Enter', 'Escape', 'Esc', 'Tab', 'Shift', 'Ctrl', 'Control', 'Alt', 'Meta', 'Space', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'WebGL', 'WebGL2']);
const humanProperties = new Set(['name', 'treeName', 'saplingName', 'label', 'title', 'detail', 'description', 'message', 'notice', 'reason', 'hint', 'instructions', 'benefit', 'ingredientLabel', 'use', 'emptyLabel', 'ariaLabel', 'announcement']);
const humanMaps = /^(?:.*Names|.*Labels|messages|instructions|hints|cues|sources|locationLabels|upgradedLocationLabels)$/;
const humanAttributes = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'];
const htmlTag = /<\/?(?:a|article|aside|b|button|canvas|details|dialog|div|em|fieldset|footer|h[1-6]|header|i|img|input|kbd|label|legend|li|main|nav|ol|option|p|progress|section|select|small|span|strong|summary|table|tbody|td|textarea|th|thead|title|tr|ul)(?:\s|>)/i;

/** Detect untranslated prose while accepting named keys, technical names, and quoted player recipe names. */
export function inspectRussianText(text) {
  const prose = text.replace(/«[^»]*»/g, '').replace(/https?:\/\/\S+/g, '').replace(/\uFFF0/g, ' ');
  const words = Array.from(prose.matchAll(/[A-Za-z][A-Za-z’'-]+/g), match => match[0]).filter(word => !keyboardWords.has(word));
  const units = Array.from(prose.matchAll(/\d\s*(m|cm|kg|g)\b/g), match => match[1]);
  return [...new Set([...words, ...units])];
}

function markupText(markup) {
  const text = [];
  for (const match of markup.matchAll(/\b(aria-label|aria-description|title|placeholder|alt)\s*=\s*(["'])(.*?)\2/gs)) text.push(match[3]);
  text.push(...markup.split(/<[^>]*>/gs));
  return text;
}

/** Scan only literal text flowing through UI labels, HTML, and DOM text writes. IDs and shaders are not prose. */
export async function auditRussianSource(source, filename = 'source.ts') {
  const { default: ts } = await import('typescript');
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const results = [], seen = new Set();
  const record = (text, node, context, html = false) => {
    for (const part of html ? markupText(text) : [text]) {
      const words = inspectRussianText(part);
      if (!words.length) continue;
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      const key = `${line}:${part}`;
      if (!seen.has(key)) results.push({ file: filename, line, context, text: part.trim(), words });
      seen.add(key);
    }
  };
  const literals = (node, context, html = false) => {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) record(node.text, node, context, html || htmlTag.test(node.text));
    else if (ts.isTemplateExpression(node)) {
      const markup = html || htmlTag.test(node.head.text + node.templateSpans.map(span => span.literal.text).join(''));
      record(node.head.text + node.templateSpans.map(span => '\uFFF0' + span.literal.text).join(''), node, context, markup);
      let prefix = node.head.text;
      for (const span of node.templateSpans) {
        const insideTag = markup && prefix.lastIndexOf('<') > prefix.lastIndexOf('>');
        const humanAttribute = /\b(?:aria-label|aria-description|title|placeholder|alt)\s*=\s*(["'])[^"']*$/.test(prefix);
        if (!insideTag || humanAttribute) literals(span.expression, context, false);
        prefix += '\uFFF0' + span.literal.text;
      }
    } else if (ts.isConditionalExpression(node)) {
      literals(node.whenTrue, context, html); literals(node.whenFalse, context, html);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      literals(node.left, context, html); literals(node.right, context, html);
    } else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) literals(node.expression, context, html);
    else if (ts.isArrayLiteralExpression(node)) for (const element of node.elements) literals(element, context, html);
    else if (ts.isObjectLiteralExpression(node)) for (const prop of node.properties) if (ts.isPropertyAssignment(prop)) literals(prop.initializer, context, html);
  };
  const nameOf = node => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : '';
  const unwrap = node => node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) ? unwrap(node.expression) : node;
  const walk = node => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && htmlTag.test(node.text)) literals(node, 'markup', true);
    if (ts.isTemplateExpression(node) && htmlTag.test(node.head.text + node.templateSpans.map(span => span.literal.text).join(''))) literals(node, 'markup', true);
    if (ts.isPropertyAssignment(node) && humanProperties.has(nameOf(node.name))) {
      const geometryName = nameOf(node.name) === 'name' && ts.isObjectLiteralExpression(node.parent) && ['x', 'y'].every(key => node.parent.properties.some(prop => ts.isPropertyAssignment(prop) && nameOf(prop.name) === key));
      if (!geometryName) literals(node.initializer, `property:${nameOf(node.name)}`);
    }
    if (ts.isVariableDeclaration(node) && humanMaps.test(nameOf(node.name))) {
      const namedObject = /(?:Names|Labels)$/.test(nameOf(node.name));
      if (!namedObject || node.initializer && ts.isObjectLiteralExpression(unwrap(node.initializer))) literals(node.initializer, `map:${nameOf(node.name)}`);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left)) {
      const prop = node.left.name.text;
      if (['textContent', 'innerText', 'innerHTML', 'title', 'placeholder', 'alt'].includes(prop)) literals(node.right, `DOM:${prop}`, prop === 'innerHTML');
    }
    if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
      const positions = { button:[0], control:[0], tile:[0], row:[1,2], task:[1,2], statusItem:[2], textAt:[1], notify:[0], announce:[0], failure:[0], success:[0], setLabel:[0] }[callee];
      if (Array.isArray(positions)) for (const index of positions) literals(node.arguments[index], `call:${callee}`);
      if (callee === 'setAttribute' && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && humanAttributes.includes(node.arguments[0].text)) literals(node.arguments[1], `attribute:${node.arguments[0].text}`);
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
  return results;
}

const numberForms = [
  [['день'], ['дня'], ['дней']], [['ночь'], ['ночи'], ['ночей']], [['монета', 'монету'], ['монеты'], ['монет']],
  [['рыба', 'рыбу'], ['рыбы'], ['рыб']], [['яйцо'], ['яйца'], ['яиц']], [['порция', 'порцию'], ['порции'], ['порций']],
  [['булочка', 'булочку'], ['булочки'], ['булочек']], [['место'], ['места'], ['мест']],
];

/** Advisory checks: genitive phrases and ratios need their own sentence context. */
export function inspectRussianQuantities(text) {
  const findings = [];
  for (const match of text.matchAll(/\b(\d+(?:[.,]\d+)?)\s+([А-Яа-яЁё]+)/g)) {
    const prefix = text.slice(Math.max(0, match.index - 25), match.index);
    if (/(?:из|до|от|без|для|после|около|не менее|не более)\s*$/i.test(prefix) || /[\d/]\s*$/.test(prefix)) continue;
    const word = match[2].toLowerCase(), forms = numberForms.find(group => group.flat().includes(word));
    if (!forms) continue;
    const value = Number(match[1].replace(',', '.')), last = value % 10, lastTwo = value % 100;
    const index = !Number.isInteger(value) ? 1 : lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2;
    if (!forms[index].includes(word)) findings.push({ text: match[0], expected: forms[index], advisory: true });
  }
  return findings;
}

/** Import in Vite/Playwright: (await import('/scripts/audit-russian.mjs')).auditRussianDOM(). */
export function auditRussianDOM(root = document, { visibleOnly = false, quantities = true } = {}) {
  const results = [];
  const playerText = '.cookery-recipe-name, [data-user-text], [data-recipe-name]';
  for (const element of root.querySelectorAll('*')) {
    if (element.closest('script,style,template') || element.matches(playerText)) continue;
    if (visibleOnly && (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden')) continue;
    const location = element.id ? `#${element.id}` : element.tagName.toLowerCase() + (element.classList.length ? '.' + [...element.classList].join('.') : '');
    for (const attribute of humanAttributes) {
      // These accessible names contain the player's saved recipe name.
      if (attribute === 'aria-label' && (element.matches('.cookery-game') || element.matches('.signature-page header button'))) continue;
      const text = element.getAttribute(attribute);
      if (!text) continue;
      const words = inspectRussianText(text);
      if (words.length) results.push({ location, context: attribute, text, words });
    }
    for (const node of element.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const text = node.textContent.trim(), words = inspectRussianText(text);
      if (words.length) results.push({ location, context: 'text', text, words });
      if (quantities) for (const finding of inspectRussianQuantities(text)) results.push({ location, context: 'quantity', ...finding });
    }
  }
  return results;
}

async function main() {
  const fs = await import('node:fs/promises'), path = await import('node:path'), url = await import('node:url');
  const game = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node scripts/audit-russian.mjs [--json] [source.ts ...]\nScans src/ and index.html by default. Exit 1 means untranslated UI text was found.\nBrowser: import /scripts/audit-russian.mjs, then auditRussianDOM(document, {visibleOnly:true}).\nQuantity findings from the DOM audit are advisory. Saved player recipe names are excluded.');
    return;
  }
  async function files(dir) { const entries = await fs.readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(ts|html|css)$/.test(entry.name) ? [path.join(dir, entry.name)] : []))).flat(); }
  const requested = args.filter(arg => !arg.startsWith('--'));
  const targets = requested.length ? requested.map(file => path.resolve(file)) : [...await files(path.join(game, 'src')), path.join(game, 'index.html')];
  const findings = [];
  for (const filename of targets) {
    const source = await fs.readFile(filename, 'utf8'), relative = path.relative(game, filename).replaceAll('\\', '/');
    if (filename.endsWith('.html')) {
      for (const text of markupText(source.replace(/<script\b[^>]*>.*?<\/script>/gs, ''))) { const words = inspectRussianText(text); if (words.length) findings.push({ file: relative, line: 1, context: 'HTML', text: text.trim(), words }); }
    } else if (filename.endsWith('.css')) {
      for (const match of source.matchAll(/\bcontent\s*:\s*(["'])(.*?)\1/g)) { const words = inspectRussianText(match[2]); if (words.length) findings.push({ file: relative, line: source.slice(0, match.index).split('\n').length, context: 'CSS:content', text: match[2], words }); }
    } else findings.push(...await auditRussianSource(source, relative));
  }
  if (args.includes('--json')) console.log(JSON.stringify({ files: targets.length, findings }, null, 2));
  else { for (const finding of findings) console.log(`${finding.file}:${finding.line} [${finding.context}] ${finding.text}`); console.log(`${targets.length} files checked; ${findings.length} untranslated UI strings.`); }
  if (findings.length) process.exitCode = 1;
}

if (typeof process !== 'undefined' && process.argv?.[1]) {
  const { pathToFileURL } = await import('node:url');
  if (pathToFileURL(process.argv[1]).href === import.meta.url) await main();
}
