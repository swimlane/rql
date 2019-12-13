/**
 * When converting an RQL string into a typed value (e.g. a number, a date, JSON, etc.),
 *  if the string fails to parse this error will be thrown.
 *
 * @export
 * @class RQLConversionError
 */
export class RQLConversionError extends Error {}

/**
 * When parsing an RQL string, if the string is invalid for any reason, this error
 *  will be thrown
 *
 * @export
 * @class RQLParseError
 */
export class RQLParseError extends Error {}
