const parseScalar = (rawValue) => {
  const value = rawValue.trim();

  if (value === "") {
    return "";
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();

    if (!inner) {
      return [];
    }

    return inner.split(",").map((item) => parseScalar(item));
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
};

const getIndent = (line) => line.match(/^ */)[0].length;

const stripComments = (line) => {
  let quote = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if ((char === '"' || char === "'") && line[index - 1] !== "\\") {
      quote = quote === char ? null : quote || char;
    }

    if (char === "#" && !quote && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }

  return line;
};

const parseKeyValue = (content) => {
  const match = content.match(/^([^:]+):(.*)$/);

  if (!match) {
    throw new Error(`Invalid YAML line: ${content}`);
  }

  return [match[1].trim(), match[2].trim()];
};

/**
 * Parse the small, intentionally limited YAML subset used by this site.
 * It supports nested objects, arrays, inline arrays, strings, numbers, and booleans.
 */
export const parseYaml = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map(stripComments)
    .filter((line) => line.trim() !== "");

  const parseBlock = (startIndex, indent) => {
    const first = lines[startIndex];

    if (!first || getIndent(first) < indent) {
      return [null, startIndex];
    }

    if (first.trimStart().startsWith("- ")) {
      return parseArray(startIndex, indent);
    }

    return parseObject(startIndex, indent);
  };

  const parseArray = (startIndex, indent) => {
    const items = [];
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      const currentIndent = getIndent(line);
      const content = line.trimStart();

      if (currentIndent < indent || !content.startsWith("- ")) {
        break;
      }

      if (currentIndent > indent) {
        throw new Error(`Unexpected indentation: ${line}`);
      }

      const itemContent = content.slice(2).trim();

      if (itemContent === "") {
        const [nested, nextIndex] = parseBlock(index + 1, indent + 2);
        items.push(nested);
        index = nextIndex;
        continue;
      }

      if (/^[^:]+:/.test(itemContent)) {
        const [key, rawValue] = parseKeyValue(itemContent);
        const item = {
          [key]: rawValue === "" ? null : parseScalar(rawValue),
        };
        index += 1;

        while (index < lines.length && getIndent(lines[index]) > indent) {
          const nestedIndent = getIndent(lines[index]);

          if (nestedIndent !== indent + 2) {
            throw new Error(`Unexpected indentation: ${lines[index]}`);
          }

          const [nestedKey, nestedRawValue] = parseKeyValue(lines[index].trim());

          if (nestedRawValue === "") {
            const [nestedValue, nextIndex] = parseBlock(index + 1, indent + 4);
            item[nestedKey] = nestedValue;
            index = nextIndex;
          } else {
            item[nestedKey] = parseScalar(nestedRawValue);
            index += 1;
          }
        }

        items.push(item);
        continue;
      }

      items.push(parseScalar(itemContent));
      index += 1;
    }

    return [items, index];
  };

  const parseObject = (startIndex, indent) => {
    const object = {};
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      const currentIndent = getIndent(line);

      if (currentIndent < indent || line.trimStart().startsWith("- ")) {
        break;
      }

      if (currentIndent > indent) {
        throw new Error(`Unexpected indentation: ${line}`);
      }

      const [key, rawValue] = parseKeyValue(line.trim());

      if (rawValue === "") {
        const [nested, nextIndex] = parseBlock(index + 1, indent + 2);
        object[key] = nested;
        index = nextIndex;
      } else {
        object[key] = parseScalar(rawValue);
        index += 1;
      }
    }

    return [object, index];
  };

  const [data] = parseBlock(0, 0);
  return data ?? {};
};
