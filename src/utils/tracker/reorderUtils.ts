
/**
 * Helper to reorder an array (move item from startIndex to endIndex).
 */
export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArr = array.slice();
  const [moved] = newArr.splice(from, 1);
  newArr.splice(to, 0, moved);
  return newArr;
}
