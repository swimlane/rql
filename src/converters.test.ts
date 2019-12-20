import { autoConverted, converters } from './converters';
import { RQLConversionError } from './errors';

describe('Converters', () => {
  describe('number', () => {
    it('should correctly convert a string to a number', done => {
      expect(converters.number('1')).toEqual(1);
      expect(converters.number('3.14')).toEqual(3.14);

      done();
    });

    it('should throw a conversion error on invalid numbers', done => {
      expect(() => converters.number('foo')).toThrowError(RQLConversionError);
      expect(() => converters.number('NaN')).toThrowError(RQLConversionError);
      expect(() => converters.number('one')).toThrowError(RQLConversionError);
      expect(() => converters.number('%1.23')).toThrowError(RQLConversionError);
      expect(() => converters.number('1num')).toThrowError(RQLConversionError);
      expect(() => converters.number('1 is the loneliest number')).toThrowError(RQLConversionError);

      done();
    });
  });
  describe('epoch', () => {
    it('should convert an epoch to a Date', done => {
      expect(converters.epoch('1')).toEqual(new Date(1));
      expect(converters.epoch('390750120000')).toEqual(new Date('1982-05-20T08:42:00-0500'));

      done();
    });

    it('should throw an error on an invalid date string', done => {
      expect(() => converters.epoch('foo')).toThrowError(RQLConversionError);

      done();
    });

    it('should throw an error on an invalid date number', done => {
      expect(() => converters.epoch('99999999999999999999')).toThrowError(RQLConversionError);

      done();
    });
  });
  describe('isodate', () => {
    it('should create a valid date object', done => {
      expect(converters.isodate('2019')).toEqual(new Date('2019-01-01T00:00:00Z'));
      expect(converters.isodate('2019-04')).toEqual(new Date('2019-04-01T00:00:00Z'));
      expect(converters.isodate('2019-04-12')).toEqual(new Date('2019-04-12T00:00:00Z'));
      expect(converters.isodate('2019-04-12T12:12:24')).toEqual(new Date('2019-04-12T12:12:24Z'));

      done();
    });

    it('should throw an error on invalid date', done => {
      expect(() => converters.isodate('foo')).toThrowError(RQLConversionError);

      done();
    });
  });
  describe('date', () => {
    it('should create a valid date object', done => {
      expect(converters.date('2019')).toEqual(new Date('2019-01-01T00:00:00Z')); // UTC
      expect(converters.date('2019-04')).toEqual(new Date('2019-04-01T00:00:00Z')); // UTC
      expect(converters.date('2019-04-12')).toEqual(new Date('2019-04-12T00:00:00Z')); // UTC
      expect(converters.date('2019-04-12T12:12:24')).toEqual(new Date('2019-04-12T12:12:24')); // Local

      done();
    });

    it('should throw an error on invalid date', done => {
      expect(() => converters.date('foo')).toThrowError(RQLConversionError);

      done();
    });
  });
  describe('boolean', () => {
    it('should convert a string to a boolean', done => {
      expect(converters.boolean('true')).toEqual(true);
      expect(converters.boolean('True')).toEqual(true);
      expect(converters.boolean('TRUE')).toEqual(true);

      expect(converters.boolean('false')).toEqual(false);
      expect(converters.boolean('nope')).toEqual(false);
      expect(converters.boolean('FALSE')).toEqual(false);
      expect(converters.boolean('False')).toEqual(false);

      done();
    });
  });
  describe('string', () => {
    it('should decode any URI components of a string', done => {
      expect(converters.string('foo%20bar')).toEqual('foo bar');

      done();
    });
  });
  describe('ire', () => {
    it('should create a case-insensitive regexp', done => {
      expect(converters.ire('^foo$')).toEqual(new RegExp('^foo$', 'i'));
      expect(converters.ire('foo%26bar')).toEqual(new RegExp('foo&bar', 'i'));

      done();
    });

    it('should throw an error on invalid regexp', done => {
      expect(() => converters.ire('notValid[')).toThrowError(RQLConversionError);

      done();
    });
  });
  describe('re', () => {
    it('should create a case-insensitive regexp', done => {
      expect(converters.re('^foo$')).toEqual(new RegExp('^foo$'));
      expect(converters.re('foo%26bar')).toEqual(new RegExp('foo&bar'));

      done();
    });

    it('should throw an error on invalid regexp', done => {
      expect(() => converters.re('notValid[')).toThrowError(RQLConversionError);

      done();
    });
  });
  describe('json', () => {
    it('should parse a JSON string', done => {
      expect(converters.json('"foo"')).toEqual('foo');
      expect(converters.json('[1,2,3]')).toStrictEqual([1, 2, 3]);

      done();
    });

    it('should throw an error if invalid JSON', done => {
      expect(() => converters.json('{')).toThrowError(RQLConversionError);

      done();
    });
  });
  describe('auto', () => {
    it('should autoconvert known values', done => {
      for (const key in autoConverted) {
        expect(converters.auto(key)).toEqual(autoConverted[key]);
      }

      // number
      expect(converters.auto('1')).toEqual(1);

      // JSON String
      expect(converters.auto("'foo'")).toEqual('foo');

      // regular string
      expect(converters.auto('foo')).toEqual('foo');

      done();
    });
  });
});
