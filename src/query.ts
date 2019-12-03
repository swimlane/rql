import { converters } from './converters';

export class RQLQuery {
  static isRQLQuery(item: unknown): item is RQLQuery {
    return item && item instanceof RQLQuery;
  }

  static encodeString(str: string): string {
    str = encodeURIComponent(str);
    if (str.match(/[\(\)]/)) {
      str = str.replace('(', '%28').replace(')', '%29');
    }

    return str;
  }

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

  static queryToString(part: unknown): string {
    if (Array.isArray(part)) {
      return `(${this.serializeArgs(part, ',')})`;
    }

    if (RQLQuery.isRQLQuery(part)) {
      return `${part.name}(${RQLQuery.serializeArgs(part.args, ',')})`;
    }

    return RQLQuery.encodeValue(part);
  }

  static serializeArgs(args: Array<RQLQuery | any>, delimiter: string): string {
    return args.map(arg => this.queryToString(arg)).join(delimiter);
  }

  constructor(public name: string, public args: Array<RQLQuery | any> = []) {}

  toString() {
    return RQLQuery.queryToString(this);
  }

  push(term: RQLQuery | any) {
    this.args.push(term);
    return this;
  }

  walk(fn, options = {}) {
    function walk(name, terms) {
      terms = terms || [];

      let i = 0,
        l = terms.length,
        term,
        args,
        func,
        newTerm;

      for (; i < l; i++) {
        term = terms[i];
        if (term == null) {
          term = {};
        }
        func = term.name;
        args = term.args;
        if (!func || !args) {
          continue;
        }
        if (args[0] instanceof RQLQuery) {
          walk.call(this, func, args);
        } else {
          newTerm = fn.call(this, func, args);
          if (newTerm && newTerm.name && newTerm.args) {
            terms[i] = newTerm;
          }
        }
      }
    }
    walk.call(this, this.name, this.args);
  }
}
