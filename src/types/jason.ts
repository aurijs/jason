/**
 * Options for creating a JasonDB instance
 * @property path - The root directory where the database folder will be created
 * @property basename - The name of the database folder itself
 * 
 * @example
 * // Database will be created at "/absolute/path/to/custom-location/my-database"
 * const options = {
 *   basename: 'my-database',
 *   path: '/absolute/path/to/custom-location'
 * };
 */
export interface JasonDBOptions {
  basename: string;
  path: string;
}

