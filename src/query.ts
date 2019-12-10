import { converters } from './converters';
import { isRQLOperator, parse, RQLOperator } from './parser';

export class RQLQuery {
  static isRQLQuery(item: unknown): item is RQLQuery {
    return item && item instanceof RQLQuery;
  }

  /**
   * URL encodes an RQL string
   */
  static encodeString(str: string): string {
    str = encodeURIComponent(str);
    if (str.match(/[\(\)]/)) {
      str = str.replace('(', '%28').replace(')', '%29');
    }

    return str;
  }

  /**
   *
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
      }
      val = `${type}:${val}`;
    }

    if (!encoded && typeof val === 'string') {
      val = RQLQuery.encodeString(val);
    }
    return val;
  }

  /**
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
   *
   * @param args takes an array of RQLQuery or values
   * @param delimiter
   * @returns {string} a string representation of the array of RQLQuery or
   *  values, delimited with the delimiter
   */
  static serializeArgs(args: Array<RQLQuery | any>, delimiter: string): string {
    return args.map(arg => this.queryToString(arg)).join(delimiter);
  }

  static parse(query: string): RQLQuery {
    return RQLQuery.parseObject(parse(query));
  }

  static parseObject(obj: RQLOperator): RQLQuery {
    const args: any[] = [];
    obj.args.forEach(arg => {
      args.push(RQLQuery.parseArg(arg));
    });
    return new RQLQuery(obj.name, args);
  }

  static parseArg(obj: any): any {
    if (isRQLOperator(obj)) {
      return RQLQuery.parseObject(obj);
    } else {
      return obj;
    }
  }

  constructor(public name: string, public args: any[]) {}

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

  toString() {
    return RQLQuery.queryToString(this);
  }

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

  toJSON(): string {
    return JSON.stringify(this.toPlainObject());
  }

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
