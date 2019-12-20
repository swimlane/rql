import { RQLParseError } from './errors';
import { inside, normalizeSyntax, parse, splitArguments, stringToValue, trim, walkQuery } from './parser';

describe('parse()', () => {
  it('should parse a valid query', done => {
    expect(parse('eq(foo,bar)')).toEqual({ name: 'eq', args: ['foo', 'bar'] });
    expect(parse('eq(foo,json:\'{"hi": "there"}\')')).toEqual({ name: 'eq', args: ['foo', { hi: 'there' }] });
    done();
  });
  it('should parse a valid query with an array value', done => {
    expect(parse('in(foo,(bar,foo,moo))')).toEqual({ name: 'in', args: ['foo', ['bar', 'foo', 'moo']] });
    done();
  });
  it('should throw an error if the query is empty', done => {
    expect(() => {
      parse('');
    }).toThrowError(RQLParseError);
    done();
  });
  it('should throw an error if the query begins with ?', done => {
    expect(() => {
      parse('?eq(foo,3)');
    }).toThrowError(RQLParseError);
    done();
  });
});

describe('walkQuery()', () => {
  it('should walk a query', done => {
    expect(walkQuery('eq(foo,bar)')).toEqual({ name: 'eq', args: ['foo', 'bar'] });
    done();
  });

  it('should walk a query with multiple operators', done => {
    expect(walkQuery('after(foo),limit(10)')).toEqual({
      name: 'and',
      args: [{ name: 'after', args: ['foo'] }, { name: 'limit', args: [10] }]
    });
    expect(walkQuery('eq(foo,bar)&limit(10)')).toEqual({
      name: 'and',
      args: [{ name: 'eq', args: ['foo', 'bar'] }, { name: 'limit', args: [10] }]
    });
    expect(walkQuery('eq(foo,bar)|eq(fizz,buzz)')).toEqual({
      name: 'or',
      args: [{ name: 'eq', args: ['foo', 'bar'] }, { name: 'eq', args: ['fizz', 'buzz'] }]
    });
    expect(walkQuery('eq(foo,bar)|eq(fizz,buzz)')).toEqual({
      name: 'or',
      args: [{ name: 'eq', args: ['foo', 'bar'] }, { name: 'eq', args: ['fizz', 'buzz'] }]
    });
    done();
  });

  it('should walk a query with sub-operators', done => {
    expect(walkQuery('eq(foo,gt(fizz,buzz),bar)')).toEqual({
      name: 'eq',
      args: ['foo', { name: 'gt', args: ['fizz', 'buzz'] }, 'bar']
    });
    done();
  });

  describe("when there's an OR then an AND inline", () => {
    it('should have OR at the top with the AND operator nested and its args together', () => {
      expect(walkQuery('eq(foo,bar)|eq(fizz,buzz)&limit(10)')).toEqual({
        name: 'or',
        args: [
          { name: 'eq', args: ['foo', 'bar'] },
          { name: 'and', args: [{ name: 'eq', args: ['fizz', 'buzz'] }, { name: 'limit', args: [10] }] }
        ]
      });
    });
  });

  describe("when there's an OR then multiple ANDs inline", () => {
    it('should have OR at the top, with the ANDs nested together', () => {
      expect(walkQuery('eq(foo,bar)|eq(fizz,buzz)&limit(10)&gt(moo,1)')).toEqual({
        name: 'or',
        args: [
          { name: 'eq', args: ['foo', 'bar'] },
          {
            name: 'and',
            args: [
              { name: 'eq', args: ['fizz', 'buzz'] },
              { name: 'limit', args: [10] },
              { name: 'gt', args: ['moo', 1] }
            ]
          }
        ]
      });
      expect(walkQuery('eq(foo,bar)|eq(fizz,buzz)|eq(oof,rab)&limit(10)&gt(moo,1)&lt(boo,2)')).toEqual({
        name: 'or',
        args: [
          { name: 'eq', args: ['foo', 'bar'] },
          { name: 'eq', args: ['fizz', 'buzz'] },
          {
            name: 'and',
            args: [
              { name: 'eq', args: ['oof', 'rab'] },
              { name: 'limit', args: [10] },
              { name: 'gt', args: ['moo', 1] },
              { name: 'lt', args: ['boo', 2] }
            ]
          }
        ]
      });
    });
  });

  describe("when there's an AND then an OR inline", () => {
    it('should have AND at the top with the operators together, with the OR nested', () => {
      expect(walkQuery('eq(foo,bar)&eq(fizz,buzz)|limit(10)')).toEqual({
        name: 'and',
        args: [
          { name: 'eq', args: ['foo', 'bar'] },
          { name: 'eq', args: ['fizz', 'buzz'] },
          { name: 'or', args: [{ name: 'limit', args: [10] }] }
        ]
      });
    });
  });

  describe("when there's an AND then multiple ORs inline", () => {
    it('should have AND at the top with the operators together, with the ORs nested together', () => {
      expect(walkQuery('eq(foo,bar)&eq(fizz,buzz)|limit(10)|gt(moo,1)')).toEqual({
        name: 'and',
        args: [
          { name: 'eq', args: ['foo', 'bar'] },
          { name: 'eq', args: ['fizz', 'buzz'] },
          { name: 'or', args: [{ name: 'limit', args: [10] }, { name: 'gt', args: ['moo', 1] }] }
        ]
      });
      expect(walkQuery('eq(foo,bar)&eq(fizz,buzz)&eq(oof,rab)|limit(10)|gt(moo,1)|lt(boo,2)')).toEqual({
        name: 'and',
        args: [
          { name: 'eq', args: ['foo', 'bar'] },
          { name: 'eq', args: ['fizz', 'buzz'] },
          { name: 'eq', args: ['oof', 'rab'] },
          {
            name: 'or',
            args: [{ name: 'limit', args: [10] }, { name: 'gt', args: ['moo', 1] }, { name: 'lt', args: ['boo', 2] }]
          }
        ]
      });
    });
  });

  describe("when there's many nested ANDs and ORs", () => {
    it('should give AND precedence and nest them correctly', () => {
      expect(walkQuery('eq(foo,bar)&eq(fizz,buzz)|eq(oof,rab)|limit(10)&gt(moo,1)|lt(boo,2)')).toEqual({
        name: 'and',
        args: [
          { name: 'eq', args: ['foo', 'bar'] },
          { name: 'eq', args: ['fizz', 'buzz'] },
          {
            name: 'or',
            args: [
              { name: 'eq', args: ['oof', 'rab'] },
              {
                name: 'and',
                args: [
                  { name: 'limit', args: [10] },
                  { name: 'gt', args: ['moo', 1] },
                  { name: 'or', args: [{ name: 'lt', args: ['boo', 2] }] }
                ]
              }
            ]
          }
        ]
      });
    });
  });
});

describe('stringToValue()', () => {
  it('should convert a string to a value', done => {
    expect(stringToValue('foo')).toEqual('foo');
    expect(stringToValue('1')).toEqual(1);
    expect(stringToValue('true')).toEqual(true);
    expect(stringToValue('false')).toEqual(false);
    expect(stringToValue('null')).toEqual(null);

    done();
  });

  it('should use the correct converter', done => {
    expect(stringToValue('epoch:390750120000')).toEqual(new Date('1982-05-20T08:42:00-0500'));
    expect(stringToValue('isodate:2019')).toEqual(new Date('2019-01-01T00:00:00Z'));
    expect(stringToValue('date:2019-04')).toEqual(new Date('2019-04-01T00:00:00Z'));
    expect(stringToValue('boolean:True')).toEqual(true);
    expect(stringToValue('json:{"hi": "there"}')).toEqual({ hi: 'there' });
    done();
  });

  it('should throw an error on an unknown converter', done => {
    expect(() => stringToValue('foo:bar')).toThrowError(RQLParseError);

    done();
  });

  it('should allow you to delimit a colon', done => {
    expect(stringToValue('12\\:12')).toEqual('12:12');
    expect(stringToValue('"12:12"')).toEqual('"12:12"');

    done();
  });
});

describe('inside()', () => {
  it('should return the inside of a pair of parens', done => {
    expect(inside('(foo)')).toEqual('foo');
    expect(inside('(foo())')).toEqual('foo()');
    expect(inside('(foo")")')).toEqual('foo")"');
    expect(inside('(foo\\))')).toEqual('foo)');
    expect(inside('(foo\\")')).toEqual('foo"');
    expect(inside('(eq(fizz, "buzz)")&eq(deep(),really(deep(in(there\\))))))')).toEqual(
      'eq(fizz, "buzz)")&eq(deep(),really(deep(in(there)))))'
    );

    done();
  });

  it('should throw an error on mismatched parens', done => {
    expect(() => inside('(foo()')).toThrowError(Error);
    expect(() => inside('(foo')).toThrowError(Error);

    done();
  });
});

describe('splitArguments()', () => {
  it('should return the individual arguments', done => {
    expect(splitArguments('foo')).toEqual(['foo']);
    expect(splitArguments('foo,bar')).toEqual(['foo', 'bar']);
    expect(splitArguments('foo, bar')).toEqual(['foo', 'bar']);
    expect(splitArguments('foo , bar')).toEqual(['foo', 'bar']);
    expect(splitArguments('foo,"fizz,buzz"')).toEqual(['foo', 'fizz,buzz']);
    expect(splitArguments("foo,'fizz,buzz'")).toEqual(['foo', 'fizz,buzz']);
    expect(splitArguments('foo\\,bar')).toEqual(['foo,bar']);
    expect(splitArguments('"foo\\,bar"')).toEqual(['foo\\,bar']);
    expect(splitArguments('foo,"fizz,\'buzz\'"')).toEqual(['foo', "fizz,'buzz'"]);
    expect(splitArguments('(foo,bar) ,baz')).toEqual([['foo', 'bar'], 'baz']);
    done();
  });

  it('should handle arrays', done => {
    expect(splitArguments('(foo,bar)')).toEqual([['foo', 'bar']]);
    expect(splitArguments('foo, (fizz, buzz)')).toEqual(['foo', ['fizz', 'buzz']]);
    expect(splitArguments('foo, (bar, (fizz, buzz)), bazz')).toEqual(['foo', ['bar', ['fizz', 'buzz']], 'bazz']);

    done();
  });

  it('should handle sub-queries', done => {
    expect(splitArguments('foo, gt(fizz, buzz), bar')).toEqual(['foo', 'gt(fizz, buzz)', 'bar']);

    done();
  });

  it('should allow delimited or quoted paren', done => {
    expect(splitArguments('foo, "gt(fizz, buzz", bar')).toEqual(['foo', 'gt(fizz, buzz', 'bar']);
    expect(splitArguments('foo, "startsWith(foo", bar')).toEqual(['foo', 'startsWith(foo', 'bar']);

    done();
  });
});

describe('trim()', () => {
  it('should trim off spaces and matching quotes', done => {
    expect(trim(' foo')).toEqual('foo');
    expect(trim('" foo"')).toEqual(' foo');
    expect(trim("' foo'")).toEqual(' foo');
    expect(trim('" foo\'')).toEqual('" foo\'');

    done();
  });
});

describe('normalizeSyntax()', () => {
  it('should convert query to a standard syntax', done => {
    expect(() => {
      normalizeSyntax('foo>==bar');
    }).toThrowError(RQLParseError);
    expect(normalizeSyntax('foo=bar')).toEqual('eq(foo,bar)');
    expect(normalizeSyntax('foo = bar')).toEqual('eq(foo , bar)');
    expect(normalizeSyntax('foo>bar')).toEqual('gt(foo,bar)');
    expect(normalizeSyntax('foo>=bar')).toEqual('ge(foo,bar)');
    expect(normalizeSyntax('foo<bar')).toEqual('lt(foo,bar)');
    expect(normalizeSyntax('foo<=bar')).toEqual('le(foo,bar)');
    expect(normalizeSyntax('foo=bar&fizz<buzz')).toEqual('eq(foo,bar)&lt(fizz,buzz)');

    done();
  });
});
