import { converters } from './converters';
import { RQLParseError } from './errors';

/**
 * An interface for RQL parsed into nested object form
 *
 * @export
 * @interface RQLOperator
 */
export interface RQLOperator {
  name: string;
  args: Array<RQLOperator | any>;
}

/**
 * User-Defined Type Guard for the RQLOperator interface
 *
 * @export
 * @param arg an unknown value
 * @returns the arg cast as RQLOperator
 */
export function isRQLOperator(arg: any): arg is RQLOperator {
  return arg && arg.name && Array.isArray(arg.args);
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

/**
 * The main function for parsing an RQL string into object form with typed values
 *
 * @export
 * @param query the RQL string
 * @returns the parsed RQL object
 * @throws {RQLParseError} if the RQL string is invalid for any reason
 * @throws {RQLConversionError} if a string argument can't be converted into a value
 */
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

/**
 * Steps through the RQL string character by character identifying operators
 * and their arguments to build RQLOperator objects.
 *
 * @export
 * @param query the RQL string
 * @param [index=0] the current index where we are in the string
 * @param [nestedTopOperator] the parent AND or OR operator under which we are parsing
 * @returns the parsed RQL object
 */
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

/**
 * Helper function for walkQuery -- recursively parse the arguments of a given
 * operator: arguments may be another RQL operator, a value, or an array of values
 *
 * @export
 * @param arg the RQL string argument of an RQL operator
 * @returns the parsed argument: either an RQL operator, a parsed value of
 *  whichever type, or an array of values
 */
export function parseArg(arg: string | any[]): RQLOperator | any | any[] {
  if (typeof arg === 'string') {
    return isRQLQuery(arg) ? walkQuery(arg) : stringToValue(arg);
  } else {
    return arg.map(parseArg);
  }
}

/**
 * Checks wehether argument to an RQL operator may itself be an RQL operator
 *
 * @export
 * @param str the RQL string argument of an RQL operator
 * @returns whether or not this is an RQL operator itself
 */
export function isRQLQuery(str: string): boolean {
  return str.match(/\w+\(/) !== null;
}

/**
 * Returns the string of arguments inside of an RQL operator.
 *
 * @export
 * @param str the current portion of an RQL string being parsed, beginning with
 *  the arguments inside of an RQL operator
 * @param [delimiter='\\'] an escape character
 * @returns the arguments of an RQL operator as a string
 * @throws {RQLParseError} if a closing paren is missing
 */
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

  throw new RQLParseError('Could not find closing paren');
}

/**
 * Takes a string of all the arguments of an RQL operator and returns an array of
 * strings of the arguments.
 *
 * @export
 * @param str the string of arguments inside an RQL operator
 * @param [delimiter='\\'] an escape character
 * @returns the arguments as an array of strings or string arrays
 */
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

/**
 * Removes spaces and matching quotes ('' or "") from around a string
 *
 * @export
 * @param str a string value with or without surrounding spaces or quotes
 * @returns a trimmed string
 */
export function trim(str: string): string {
  const trimmed = str.trim();

  if (/^'.*'$/.test(trimmed) || /^".*"$/.test(trimmed)) {
    return trimmed.slice(1, -1);
  } else {
    return trimmed;
  }
}

/**
 * Converts a raw RQL string into a standardized format
 *    - changes infix operators to prefix
 *    - removes spaces from around infix operators
 *
 * @export
 * @param query a raw RQL string
 * @returns a normalized RQL string
 * @throws {RQLParseError} in case there is an illegal operator
 */
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

/**
 * Parses an RQL string argument into its typed value using a converter
 *
 * @export
 * @param str an argument of an RQL operator in string format
 * @returns the typed value converted from the string
 * @throws {RQLParseError} if an unknown converter is used
 * @throws {RQLConversionError} if the string can't be converted using the converter
 */
export function stringToValue(str: string): any {
  let converter = converters['default'];
  if (/^\w+[^\\]:/.test(str)) {
    const ind = str.indexOf(':');
    const converterPart = str.substring(0, ind).toLowerCase();
    const valuePart = str.substring(ind + 1);
    converter = converters[converterPart];
    if (!converter) {
      throw new RQLParseError(`Unknown converter: "${converterPart}`);
    }
    str = valuePart;
  }

  // replace an colon delimiting
  str = str.replace('\\:', ':');

  return converter(str);
}
