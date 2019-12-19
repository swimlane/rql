import { RQLQuery } from './query';

describe('RQLQuery', () => {
  describe('toPlainObject()', () => {
    it('should convert an RQLQuery into a RQLOperator object', done => {
      expect(new RQLQuery('and', [new RQLQuery('eq', ['a', 'b'])]).toPlainObject()).toEqual({
        name: 'and',
        args: [
          {
            name: 'eq',
            args: ['a', 'b']
          }
        ]
      });
      done();
    });
  });
  describe('toJSON()', () => {
    it('should convert an RQLQuery into a RQLOperator object', done => {
      expect(new RQLQuery('eq', ['a', 'b']).toJSON()).toEqual('{"name":"eq","args":["a","b"]}');
      done();
    });
  });
  describe('equals()', () => {
    it('should return true if two RQLQuery objects are equal', done => {
      expect(new RQLQuery('eq', ['a', 'b']).equals(new RQLQuery('eq', ['a', 'b'])));
      done();
    });
    it('should return false if two RQLQuery objects are not equal', done => {
      expect(!new RQLQuery('eq', ['a', 'b']).equals(new RQLQuery('eq', ['b', 'a'])));
      expect(!new RQLQuery('eq', ['a', 'b']).equals(new RQLQuery('ne', ['a', 'a'])));
      expect(!new RQLQuery('eq', ['a', 'b']).equals(new RQLQuery('eq', ['a', 'b', 'c'])));
      expect(!new RQLQuery('eq', [new RQLQuery('x', ['y']), 'b']).equals(new RQLQuery('eq', ['a', 'b'])));
      expect(!new RQLQuery('eq', ['a', 'b']).equals(new RQLQuery('eq', [new RQLQuery('x', ['y']), 'a'])));
      expect(
        !new RQLQuery('eq', ['a', 'b', new RQLQuery('x', ['y'])]).equals(
          new RQLQuery('eq', ['a', new RQLQuery('z', ['y'])])
        )
      );
      expect(
        !new RQLQuery('and', [new RQLQuery('eq', ['foo', 'bar']), new RQLQuery('eq', ['a', 'b'])]).equals(
          new RQLQuery('and', [new RQLQuery('eq', ['a', 'b']), new RQLQuery('eq', ['a', 'b'])])
        )
      );
      done();
    });
  });
  describe('parse()', () => {
    it('should walk a query with sub-operators', done => {
      expect(
        RQLQuery.parse('eq(foo,gt(fizz,buzz),bar)').equals(
          new RQLQuery('eq', ['foo', new RQLQuery('gt', ['fizz', 'buzz']), 'bar'])
        )
      );
      done();
    });
  });
  describe('encodeString()', () => {
    it('should encode a string', done => {
      expect(RQLQuery.encodeString('foo')).toEqual('foo');
      expect(RQLQuery.encodeString('foo bar')).toEqual('foo%20bar');
      expect(RQLQuery.encodeString('(foo)')).toEqual('%28foo%29');

      done();
    });
  });
  describe('encodeValue()', () => {
    it('should encode values', done => {
      expect(RQLQuery.encodeValue('foo')).toEqual('foo');
      expect(RQLQuery.encodeValue(5)).toEqual(5);
      expect(RQLQuery.encodeValue('7')).toEqual('string:7');
      expect(RQLQuery.encodeValue({ hi: 'there' })).toEqual('json:\'{"hi":"there"}\'');
      expect(RQLQuery.encodeValue(/foo/)).toEqual('RE:foo');
      expect(RQLQuery.encodeValue(/foo/i)).toEqual('re:foo');
      expect(RQLQuery.encodeValue(new Date('2019-11-20T12:00:00Z'))).toEqual('date:2019-11-20T12:00:00.000Z');
      expect(RQLQuery.encodeValue(null)).toEqual('null');
      expect(RQLQuery.encodeValue('null')).toEqual('string:null');
      done();
    });
  });
  describe('queryToString()', () => {
    it('should convert query part to a string', done => {
      expect(RQLQuery.queryToString('foo')).toEqual('foo');
      expect(RQLQuery.queryToString([1, 2, 3])).toEqual('(1,2,3)');
      expect(RQLQuery.queryToString(new RQLQuery('eq', ['foo', 'bar']))).toEqual('eq(foo,bar)');

      done();
    });
  });
  describe('toString()', () => {
    it('should convert an RQL query to a string', done => {
      expect(new RQLQuery('eq', ['foo', 'bar']).toString()).toEqual('eq(foo,bar)');

      done();
    });
  });
  describe('serializeArgs()', () => {
    it('should serialize args into a string by delimiter', done => {
      expect(RQLQuery.serializeArgs([1, 2, 3], ',')).toEqual('1,2,3');
      expect(RQLQuery.serializeArgs([1, 2, 3], '/')).toEqual('1/2/3');

      done();
    });
  });
  describe('push()', () => {
    it('should add args to the object', done => {
      const rqlQuery: RQLQuery = new RQLQuery('hi', ['h', 'e', 'l', 'l']);
      rqlQuery.push('o');
      expect(rqlQuery.args.join('')).toEqual('hello');
      done();
    });
  });
  describe('walk()', () => {
    it('should call the function for each RQLQuery and replace it', done => {
      const rqlQuery: RQLQuery = new RQLQuery('some-top-name', [
        1,
        new RQLQuery('some-name', ['h']),
        new RQLQuery('some-other-name', ['i'])
      ]);
      const called: string[] = [];
      rqlQuery.walk(
        (nextRQLQuery: RQLQuery): RQLQuery => {
          called.push(nextRQLQuery.name);
          if (nextRQLQuery.name === 'some-name') return new RQLQuery('some-changed-name', nextRQLQuery.args);
          else return nextRQLQuery;
        }
      );
      expect(called).toEqual(['some-name', 'some-other-name']);
      expect(rqlQuery.args[1].name).toEqual('some-changed-name');
      done();
    });
  });
});
