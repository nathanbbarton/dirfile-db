
// JSON.stringify implicitly uses any, disabling linting rule for 'no use of type: any'
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A replacer function for JSON.stringify(value, <replacer>, space)
 */
type StringifyReplacer = (key: string, value: any) => any

/**
 * Preserves undefined values by replacing them with null
 * @param {string} _  unused key value
 * @param {any} value object value to be compared
 * @returns {any} null if original value is undefined, otherwise orginal value
 */
const undefinedReplacer: StringifyReplacer  =
    (_: string, value: any): any => value === undefined ? null : value

export default undefinedReplacer
