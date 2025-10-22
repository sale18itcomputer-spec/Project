/**
 * Safely evaluates simple mathematical formulas from a Google Sheet string (e.g., "=50*0.7").
 * If the input is not a formula, it attempts to parse it as a number.
 * @param value The string value from the sheet cell.
 * @returns The calculated numeric value, or 0 if parsing fails.
 */
export const parseSheetValue = (value: any): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const stringValue = String(value).trim();

  if (stringValue.startsWith('=')) {
    const expression = stringValue.substring(1);
    // Sanitize to allow only numbers, basic operators, parentheses, and whitespace.
    // This is a security measure to prevent arbitrary code execution.
    const sanitizedExpression = expression.replace(/[^0-9.*/+\-().\s]/g, '');

    if (sanitizedExpression !== expression) {
      console.warn(`Attempted to evaluate a potentially unsafe formula: "${expression}"`);
      return 0;
    }

    try {
      // Using the Function constructor is safer than a direct eval().
      const result = new Function(`return ${sanitizedExpression}`)();
      return typeof result === 'number' && isFinite(result) ? result : 0;
    } catch (e) {
      console.error(`Error evaluating formula: "${expression}"`, e);
      return 0; // Return 0 if the formula is invalid or fails to execute.
    }
  }

  // If not a formula, parse it as a plain number, removing currency symbols, commas etc.
  const numericString = stringValue.replace(/[^0-9.-]/g, '');
  const num = parseFloat(numericString);
  return isNaN(num) ? 0 : num;
};

export const getInitials = (name: string): string => {
  if (!name || typeof name !== 'string') return '?';
  const names = name.split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
};