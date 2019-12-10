import { converters } from './converters';
import { RQLParseError } from './errors';

export interface RQLOperator {
  name: string;
  args: Array<RQLOperator | any>;
}

export function isRQLOperator(arg: any): arg is RQLOperator {
  return arg && arg.name && typeof arg.args === 'object' && Array.isArray(arg.args);
}

export const operatorMap = {
  '!=': 'ne',
  '<': 'lt',
  '<=': 'le',
  '=': 'eq',
  '==': 'eq',
  '>': 'gt',
  '>=': 'ge'
};

export function parse(query: string): RQLOperator {
  if (!query) {
    throw new RQLParseError(`Query empty or invalid: ${query}`);
  }

  if (query.charAt(0) === '?') {
    throw new RQLParseError(`Query must not start with ?: ${query}`);
  }

  const normalizedQuery = normalizeSyntax(query);
  return walkQuery(normalizedQuery);
}

export function walkQuery(query: string, index: number = 0, nestedTopOperator?: RQLOperator): RQLOperator {
  let currentOperator: RQLOperator = {
    name: '',
    args: []
  };
  let topOperator: RQLOperator = nestedTopOperator || currentOperator;
  let aggregateOperator: boolean = !!nestedTopOperator;

  for (index; index < query.length; index++) {
    const char = query[index];
    switch (char) {
      case '&':
      case ',': // support implicit and
        if (aggregateOperator && topOperator.name === 'or') {
          // we already have a top operator. nest.
          const nestedOperator = {
            name: 'and',
            args: [currentOperator]
          };
          topOperator.args.push(walkQuery(query, index + 1, nestedOperator));
          return topOperator;
        } else if (!aggregateOperator) {
          aggregateOperator = true;
          topOperator = {
            name: 'and',
            args: []
          };
        }
        topOperator.args.push(currentOperator);
        currentOperator = {
          name: '',
          args: []
        };
        break;
      case '|':
        if (aggregateOperator && topOperator.name === 'and') {
          // we already have a top operator. nest.
          topOperator.args.push(currentOperator); // 'and' has OoO precedence over 'or'
          const nestedOperator = {
            name: 'or',
            args: []
          };
          topOperator.args.push(walkQuery(query, index + 1, nestedOperator));
          return topOperator;
        } else if (!aggregateOperator) {
          aggregateOperator = true;
          topOperator = {
            name: 'or',
            args: []
          };
        }
        topOperator.args.push(currentOperator);
        currentOperator = {
          name: '',
          args: []
        };
        break;
      case '(':
        // grab insides
        const insides = inside(query.slice(index));
        currentOperator.args = splitArguments(insides).map(parseArg);

        // jump index
        index += insides.length + 1; // include trailing paren
        break;
      default:
        currentOperator.name += char;
    }
  }
  if (aggregateOperator) {
    // push the last one
    topOperator.args.push(currentOperator);
  }

  return topOperator;
}

export function parseArg(arg: string | any[]): RQLOperator | any | any[] {
  if (typeof arg === 'string') {
    return isRQLQuery(arg) ? walkQuery(arg) : stringToValue(arg);
  } else {
    return arg.map(parseArg);
  }
}

export function isRQLQuery(str: string) {
  return str.match(/\w+\(/);
}

export function inside(str: string, delimiter = '\\'): string {
  let insideStr = '';

  let untilCount = 1;
  let index = 1; // assuming the first char is a paren
  let delimited = false;
  let quoteType = '';

  while (index < str.length) {
    const char = str[index];
    // if previous character was a delimiter, then take current character as is
    if (delimited) {
      insideStr += char;
      delimited = false;
      // if we are not quoted and current character is a delimiter, skip character and flag as delimited
    } else if (!quoteType && char === delimiter) {
      delimited = true;
    } else if (char === "'" || char === '"') {
      // if we are not in quotes, we are now
      if (!quoteType) {
        quoteType = char;
        // if this is the next matching non-delimited quote, we're done with quoted string
      } else if (quoteType === char) {
        quoteType = '';
        // we are not quoted with this type of quote, take char as is
      }
      insideStr += char;

      // if we are inside a quoted string, take char as is
    } else if (quoteType) {
      insideStr += char;
      // if hit another open paren
    } else if (char === '(') {
      untilCount++;
      insideStr += char;
    } else if (char === ')') {
      // we hit a close paren
      untilCount--;
      if (untilCount === 0) {
        // we found a match
        return insideStr;
      }
      insideStr += char;
    } else {
      insideStr += char;
    }

    index++;
  }

  throw new Error('Could not find closing paren');
}

export function splitArguments(str: string, delimiter = '\\'): Array<string | any[]> {
  // waiting for recursive types in TS 3.7
  // type Nested<T> = T | Nested<T>;
  const args: Array<string | any[]> = [];

  let currentArg = '';
  let delimited = false;
  let quoteType = '';

  for (let index = 0; index < str.length; index++) {
    const char = str[index];
    // if previous character was a delimiter, then take current character as is
    if (delimited) {
      currentArg += char;
      delimited = false;
      // if we are not quoted and current character is a delimiter, skip character and flag as delimited
    } else if (!quoteType && char === delimiter) {
      delimited = true;
    } else if (char === "'" || char === '"') {
      // if we are not in quotes, we are now
      if (!quoteType) {
        quoteType = char;
        // if this is the next matching non-delimited quote, we're done with quoted string
      } else if (quoteType === char) {
        quoteType = '';
        // we are not quoted with this type of quote, take char as is
      } else {
        currentArg += char;
      }
      // if we are inside a quoted string, take char as is
    } else if (quoteType) {
      currentArg += char;
      // if we are at the first character of an argument
    } else if (currentArg.length === 0) {
      // check if we hit an array
      if (char === '(') {
        const arr = inside(str.slice(index));
        args.push(splitArguments(arr));
        index += arr.length + 1;

        // we need to jump to the next argument
        const toNextArg = /( *,)| *$/.exec(str.slice(index));
        if (toNextArg) {
          index += toNextArg[0].length;
        }
      } else if (char === ' ') {
        // skip any leading spaces
      } else {
        currentArg += char;
      }
      // check if we hit the end of an argument
    } else if (char === ',') {
      args.push(trim(currentArg));
      currentArg = '';
      // grab the insides to a possible query
    } else if (char === '(') {
      const strInside = inside(str.slice(index));
      currentArg += char + strInside;
      index += strInside.length;
      // just an plain old character, add it to the argument
    } else {
      currentArg += char;
    }
  }

  if (currentArg.trim().length > 0) {
    args.push(trim(currentArg)); // grab the last argument
  }

  return args;
}

export function trim(str: string): string {
  const trimmed = str.trim();

  if (/^'.*'$/.test(trimmed) || /^".*"$/.test(trimmed)) {
    return trimmed.slice(1, -1);
  } else {
    return trimmed;
  }
}

export function normalizeSyntax(query: string): string {
  query = query
    .replace(/%3C=/g, '=le=')
    .replace(/%3E=/g, '=ge=')
    .replace(/%3C/g, '=lt=')
    .replace(/%3E/g, '=gt=');

  query = query.replace(
    // tslint:disable-next-line: tsr-detect-unsafe-regexp
    /(\([\+\*\$\-:\w%\._,]+\)|[\+\*\$\-: \w%\._]*|)([<>!]?=(?:[\w]*=)?|>|<)(\([\+\*\$\-:\w%\._,]+\)|[\+\*\$\-:\w %\._]*|)/g,
    // <---------       property        -----------><------  operator -----><----------------   value ------------------>
    function(t, property, operator, value) {
      if (operator.length < 3) {
        if (!operatorMap[operator]) {
          throw new RQLParseError(`Illegal operator: "${operator}"`);
        }
        operator = operatorMap[operator];
      } else {
        operator = operator.substring(1, operator.length - 1);
      }
      return `${operator}(${property},${value})`;
    }
  );

  return query;
}

export function stringToValue(str: string, parameters?: unknown[]) {
  let converter = converters['default'];
  if (/^\w+[^\\]:/.test(str)) {
    const parts = str.split(':', 2);
    converter = converters[parts[0]];
    if (!converter) {
      throw new RQLParseError(`Unknown converter: "${parts[0]}`);
    }
    str = parts[1];
  }

  // replace an colon delimiting
  str = str.replace('\\:', ':');

  return converter(str);
}
