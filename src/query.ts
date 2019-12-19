import { converters } from './converters';
import { isRQLOperator, parse, RQLOperator } from './parser';

/**
 * A class representing an RQL query.
 *
 * A query consists of an RQL operator which has a name and arguments, where
 * the arguments may themselves be an RQL operator.
 *
 * @export
 * @class RQLQuery
 */
export class RQLQuery {
  /**
   * User-Defined Type Guard for the RQLQuery class
   *
   * @static
   * @param item a variable of an unknown type
   * @returns the value cast as an RQLQuery
   */
  static isRQLQuery(item: unknown): item is RQLQuery {
    return item && item instanceof RQLQuery;
  }

  /**
   * URL encodes an RQL string
   *
   * @static
   * @param str a string
   * @returns the URL encoded string
   */
  static encodeString(str: string): string {
    str = encodeURIComponent(str);
    if (str.match(/[\(\)]/)) {
      str = str.replace('(', '%28').replace(')', '%29');
    }

    return str;
  }

  /**
   * Encodes any value in an RQL string format
   *
   * @param {any} val a value of any type
   * @returns {string} a string representation of an RQL value
   */
  static encodeValue(val: any): string {
    let encoded = false;

    // convert null to string
    if (val === null) return 'null';

    const convertedValue = converters['default'](val.toString());
    if (val !== convertedValue) {
      let type: string = typeof val; // start with common types
      if (val instanceof RegExp) {
        type = val.ignoreCase ? 're' : 'RE';
        val = RQLQuery.encodeString(val.source);
        encoded = true;
      } else if (val instanceof Date) {
        type = 'date';
        val = val.toISOString();
        encoded = true;
      } else if (type === 'string') {
        val = RQLQuery.encodeString(val);
        encoded = true;
      } else if (type === 'object') {
        type = 'json';
        val = "'" + JSON.stringify(val) + "'";
        encoded = true;
      }
      val = `${type}:${val}`;
    }

    if (!encoded && typeof val === 'string') {
      val = RQLQuery.encodeString(val);
    }
    return val;
  }

  /**
   * Converts a part of an RQL query from object form into string form
   *
   * @param part part of an RQL query (RQLQuery, a value, or an array of values)
   * @returns {string} returns a string representation of the RQLQuery
   */
  static queryToString(part: unknown): string {
    if (Array.isArray(part)) {
      return `(${this.serializeArgs(part, ',')})`;
    }

    if (RQLQuery.isRQLQuery(part)) {
      return `${part.name}(${RQLQuery.serializeArgs(part.args, ',')})`;
    }

    return RQLQuery.encodeValue(part);
  }

  /**
   * Converts an array of RQLQuery objects or rql values into string form
   *
   * @param args takes an array of RQLQuery or values
   * @param delimiter
   * @returns {string} a string representation of the array of RQLQuery or
   *  values, delimited with the delimiter
   */
  static serializeArgs(args: Array<RQLQuery | any>, delimiter: string): string {
    return args.map(arg => this.queryToString(arg)).join(delimiter);
  }

  /**
   * Parse a raw RQL string into an RQLQuery
   *
   * @static
   * @param query
   * @returns
   * @throws {RQLParseError} if the RQL string is invalid for any reason
   * @throws {RQLConversionError} if a string argument can't be converted into a value
   */
  static parse(query: string): RQLQuery {
    return RQLQuery.parseObject(parse(query));
  }

  /**
   * Converts an RQLOperator object into an RQLQuery, and recursively for each
   * of its args.
   *
   * @static
   * @param obj
   * @returns
   */
  static parseObject(obj: RQLOperator): RQLQuery {
    const args: any[] = [];
    obj.args.forEach(arg => {
      args.push(RQLQuery.parseArg(arg));
    });
    return new RQLQuery(obj.name, args);
  }

  /**
   * Takes an object of any type: if its an RQLOperator, parse it with
   * [[RQLQuery.parseObject]], otherwise return the raw object value.
   *
   * @static
   * @param obj
   * @returns
   */
  static parseArg(obj: any): any {
    if (isRQLOperator(obj)) {
      return RQLQuery.parseObject(obj);
    } else {
      return obj;
    }
  }

  constructor(public name: string, public args: any[]) {}

  /**
   * Compares on RQLQuery to another and returns whether they are equal
   *
   * @param b
   * @returns
   */
  equals(b: RQLQuery): boolean {
    if (this.name !== b.name) return false;
    if (this.args.length !== b.args.length) return false;
    for (let i = 0; i < this.args.length; i++) {
      if (RQLQuery.isRQLQuery(this.args[i])) {
        if (!RQLQuery.isRQLQuery(b.args[i])) return false;
        if (!this.args[i].equals(b.args[i])) return false;
      } else {
        if (this.args[i] !== b.args[i]) return false;
      }
    }
    return true;
  }

  /**
   * Converts this RQLQuery into a raw RQL string
   *
   * @returns
   */
  toString() {
    return RQLQuery.queryToString(this);
  }

  /**
   * Converts this RQLQuery into a plain javascript object
   *
   * @returns
   */
  toPlainObject(): RQLOperator {
    return {
      name: this.name,
      args: this.args.map((arg: any) => {
        if (RQLQuery.isRQLQuery(arg)) {
          return arg.toPlainObject();
        } else {
          return arg;
        }
      })
    };
  }

  /**
   * Converts this RQLQuery into a valid JSON string
   *
   * @returns
   */
  toJSON(): string {
    return JSON.stringify(this.toPlainObject());
  }

  /**
   * Takes an RQLQuery or a value of any type and adds it to the list of args.
   *
   * @param term
   * @returns
   */
  push(term: RQLQuery | any) {
    this.args.push(term);
    return this;
  }

  /**
   * This will call the provided function with each RQLQuery in the args of this
   * RQLQuery object, and each of RQLQuery objects in the args of that, and so on.
   * The return value of the provided function is an RQLQuery which will be
   * substituted for the passed in value in the tree.
   *
   * @param {Function} fn a function which takes an RQLQuery and returns a replacement RQLQuery
   * @returns
   */
  walk(fn: (rqlQuery: RQLQuery) => RQLQuery): void {
    for (let i = 0; i < this.args.length; i++) {
      if (RQLQuery.isRQLQuery(this.args[i])) {
        this.args[i] = fn(this.args[i]);
        this.args[i].walk(fn);
      }
    }
  }
}
