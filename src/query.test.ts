import { RQLQuery } from './query';

describe('Query', () => {
  describe('toPlainObject()', () => {});
  describe('toJSON()', () => {});
  describe('parse()', () => {});
  describe('walk()', () => {});
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
      expect(RQLQuery.encodeValue(/foo/)).toEqual('RE:foo');
      expect(RQLQuery.encodeValue(/foo/i)).toEqual('re:foo');
      expect(RQLQuery.encodeValue(new Date('2019-11-20T12:00:00Z'))).toEqual('date:2019-11-20T12:00:00.000Z');
      expect(RQLQuery.encodeValue(null)).toEqual('null');

      done();
    });
  });
  describe('queryToString()', () => {
    it('should convert query part to a string', done => {
      expect(RQLQuery.queryToString('foo')).toEqual('foo');
      expect(RQLQuery.queryToString([1, 2, 3])).toEqual('(1,2,3)');

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
});
