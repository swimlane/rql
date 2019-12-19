import { RQLConversionError } from './errors';

export const autoConverted = {
  true: true,
  false: false,
  null: null,
  undefined,
  Infinity,
  '-Infinity': -Infinity
};

export const converters = {
  /**
   * Default converter - tries to infer if the type is a number, json, or string.
   *
   * @param str a string to parse a value from
   * @returns the value parsed from the string
   */
  auto(str: string) {
    if (autoConverted.hasOwnProperty(str)) {
      return autoConverted[str];
    }
    try {
      return converters.number(str);
    } catch (numErr) {
      const strVal = converters.string(str);
      if (strVal.charAt(0) === "'" && strVal.charAt(str.length - 1) === "'") {
        return converters.json('"' + str.substring(1, str.length - 1) + '"');
      } else {
        return strVal;
      }
    }
  },
  /**
   * Parse a number from a string
   *
   * @param x
   * @returns
   * @throws {RQLConversionError} when the string cannot be parsed
   */
  number(x: string): number {
    const num = Number(x);
    if (isNaN(num)) {
      throw new RQLConversionError('Invalid number ' + num);
    }
    return num;
  },
  /**
   * Parse a date from a string containing a number representing a UTC timestamp.
   *
   * @param x
   * @returns
   * @throws {RQLConversionError} when the string cannot be parsed
   */
  epoch(x: string): Date {
    const date = new Date(converters.number(x));
    if (isNaN(date.getTime())) {
      throw new RQLConversionError(`Invalid date ${x}`);
    }
    return date;
  },
  /**
   * Parse a date from a string in ISO date format
   *
   * @param x
   * @returns
   */
  isodate(x: string): Date {
    // four-digit year
    let date = '0000'.substr(0, 4 - x.length) + x;
    // pattern for partial dates
    date += '0000-01-01T00:00:00Z'.substring(date.length);
    return converters.date(date);
  },
  /**
   * Parse a date from a string in YYYY-MM-DDTHH:mm:ss.SSSZ format
   *
   * Milliseconds and "Z" are optional.
   *
   * @param x
   * @returns
   * @throws {RQLConversionError} when the string cannot be parsed
   */
  date(x: string): Date {
    // tslint:disable-next-line: tsr-detect-unsafe-regexp
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(x);
    let date;
    if (isoDate) {
      date = new Date(
        Date.UTC(+isoDate[1], +isoDate[2] - 1, +isoDate[3], +isoDate[4], +isoDate[5], +isoDate[6], +isoDate[7] || 0)
      );
    } else {
      date = new Date(x);
    }
    if (isNaN(date.getTime())) {
      throw new RQLConversionError(`Invalid date ${x}`);
    }
    return date;
  },
  /**
   * Parse a boolean from a string. The string must be 'true' (case insensitive), otherwise it is false.
   *
   * @param x
   * @returns
   */
  boolean(x: string): boolean {
    return x.toLowerCase() === 'true';
  },
  /**
   * Parse as a string regardless of string contents. Also will URL decode the string.
   *
   * @param str
   * @returns
   */
  string(str: string): string {
    return decodeURIComponent(str);
  },
  /**
   * Parse a case-insensitive regular expression from a string.
   *
   * @param x
   * @returns
   * @throws {RQLConversionError} when the string cannot be parsed
   */
  re(x: string): RegExp {
    try {
      // tslint:disable-next-line: tsr-detect-non-literal-regexp
      return new RegExp(converters.string(x), 'i');
    } catch (err) {
      throw new RQLConversionError(err.message);
    }
  },
  /**
   * Parse a case-sensitive regular expression from a string
   *
   * @param x
   * @returns
   */
  RE(x: string): RegExp {
    try {
      // tslint:disable-next-line: tsr-detect-non-literal-regexp
      return new RegExp(converters.string(x));
    } catch (err) {
      throw new RQLConversionError(err.message);
    }
  },
  /**
   * Parse JSON from a string
   *
   * @param x
   * @returns
   * @throws {RQLConversionError} when the string cannot be parsed
   */
  json(x: string): any {
    try {
      return JSON.parse(x);
    } catch (jsonErr) {
      throw new RQLConversionError(jsonErr.message);
    }
  }
};

// set a default converter
converters['default'] = converters.auto;
