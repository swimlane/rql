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
  number(x: any): number {
    const num = Number(x);
    if (isNaN(num)) {
      throw new RQLConversionError('Invalid number ' + num);
    }
    return num;
  },
  epoch(x: any): Date {
    const date = new Date(converters.number(x));
    if (isNaN(date.getTime())) {
      throw new RQLConversionError(`Invalid date ${x}`);
    }
    return date;
  },
  isodate(x: any): Date {
    // four-digit year
    let date = '0000'.substr(0, 4 - x.length) + x;
    // pattern for partial dates
    date += '0000-01-01T00:00:00Z'.substring(date.length);
    return converters.date(date);
  },
  date(x: any): Date {
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
  boolean(x: any): boolean {
    return x.toLowerCase() === 'true';
  },
  string(str: string): string {
    return decodeURIComponent(str);
  },
  re(x: string): RegExp {
    try {
      // tslint:disable-next-line: tsr-detect-non-literal-regexp
      return new RegExp(converters.string(x), 'i');
    } catch (err) {
      throw new RQLConversionError(err.message);
    }
  },
  RE(x: string): RegExp {
    try {
      // tslint:disable-next-line: tsr-detect-non-literal-regexp
      return new RegExp(converters.string(x));
    } catch (err) {
      throw new RQLConversionError(err.message);
    }
  },
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
