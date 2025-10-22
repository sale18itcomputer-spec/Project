const aDay = 24 * 60 * 60 * 1000;

export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  // Don't compare time, just date
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const aDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = today.getTime() - aDate.getTime();
  const diffDays = Math.round(diffTime / aDay);

  if (diffDays === 0) {
    const fullDiffTime = now.getTime() - date.getTime();
    const diffHours = Math.round(fullDiffTime / (60 * 60 * 1000));
    if (diffHours < 1) {
        const diffMinutes = Math.round(fullDiffTime / (60 * 1000));
        if (diffMinutes < 1) return 'just now';
        return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Formats a Date object into "M/D/YYYY" format, correctly representing the date in UTC+7.
 * @param date The date to format.
 * @returns The formatted date string, e.g., "9/3/2025".
 */
export const formatDateAsMDY = (date: Date): string => {
    // Use toLocaleDateString with a UTC+7 timezone to format correctly.
    // 'Asia/Bangkok' is in the Indochina Time Zone (UTC+7).
    return date.toLocaleDateString('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
};


/**
 * Parses a date string from various formats into a consistent Date object.
 * Handles formats: 'M/D/YYYY', 'YYYY-MM-DD', and 'Month Day, Year' (e.g., "September 18, 2025").
 * The resulting Date object will represent midnight in the UTC+7 timezone.
 * @param dateStr The date string to parse.
 * @returns A Date object or null if parsing fails.
 */
export const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
        return null;
    }
    
    let cleanDateStr = dateStr.trim();
    if (cleanDateStr.startsWith("'")) {
        cleanDateStr = cleanDateStr.substring(1);
    }
    
    // Check for full ISO 8601 format first, as it's the most reliable.
    if (cleanDateStr.includes('T') && (cleanDateStr.endsWith('Z') || cleanDateStr.match(/[+-]\d{2}:\d{2}$/))) {
        const isoDate = new Date(cleanDateStr);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
    }

    const monthMap: { [key: string]: number } = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
        'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
    };

    let year, month, day;

    // Try parsing M/D/YYYY
    const mdyParts = cleanDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdyParts) {
        month = parseInt(mdyParts[1], 10);
        day = parseInt(mdyParts[2], 10);
        year = parseInt(mdyParts[3], 10);
    } else {
        // Try parsing YYYY-MM-DD
        const ymdParts = cleanDateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (ymdParts) {
            year = parseInt(ymdParts[1], 10);
            month = parseInt(ymdParts[2], 10);
            day = parseInt(ymdParts[3], 10);
        } else {
            // Try parsing "Month Day, Year"
            const fullMonthParts = cleanDateStr.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s(\d{1,2}),\s(\d{4})/i);
            if (fullMonthParts) {
                month = monthMap[fullMonthParts[1].toLowerCase()];
                day = parseInt(fullMonthParts[2], 10);
                year = parseInt(fullMonthParts[3], 10);
            } else {
                // Final attempt with native parser for any other valid date string.
                const fallbackDate = new Date(cleanDateStr);
                if (!isNaN(fallbackDate.getTime())) {
                    // Extract components based on the user's local time to avoid timezone shifts,
                    // then we'll reconstruct it consistently.
                    year = fallbackDate.getFullYear();
                    month = fallbackDate.getMonth() + 1; // getMonth() is 0-indexed
                    day = fallbackDate.getDate();
                } else {
                    return null; // All parsing attempts failed.
                }
            }
        }
    }
    
    // Basic validation of parsed components
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    // Construct an ISO 8601 date string with the UTC+7 timezone offset.
    // This represents midnight at the beginning of the day in UTC+7.
    const isoDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000+07:00`;
    const date = new Date(isoDateString);
    
    // Final check if the created date is valid
    if (isNaN(date.getTime())) {
        return null;
    }
    
    return date;
};

/**
 * Combines a date string and a time string into a single Date object, assuming UTC+7 timezone.
 * @param dateStr The date string (e.g., '9/18/2025' or '2025-09-18').
 * @param timeStr The time string (e.g., '9:00:00 AM').
 * @returns A Date object representing the specific moment in UTC+7, or null on failure.
 */
export const parseDateTime = (dateStr?: string, timeStr?: string): Date | null => {
    const dateInputStr = formatToInputDate(dateStr);
    // If no date or no time, return the parsed date (which could be null)
    if (!dateInputStr || !timeStr) return parseDate(dateStr);

    // Regex to handle "9:30:00 AM" or "14:30:00"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})\s*([AP]M)?/i);
    if (!timeMatch) {
        // Fallback for just the date if time is unparseable
        return parseDate(dateStr);
    }

    let [, hoursStr, minutesStr, secondsStr, ampm] = timeMatch;
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const seconds = parseInt(secondsStr, 10);

    // Convert 12-hour clock to 24-hour
    if (ampm) {
        ampm = ampm.toUpperCase();
        if (ampm === 'PM' && hours < 12) {
            hours += 12;
        }
        if (ampm === 'AM' && hours === 12) { // Handle 12 AM (midnight)
            hours = 0;
        }
    }
    
    const timeInputStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Create the full ISO string with the explicit +07:00 offset for Cambodia timezone
    const isoStringWithTimezone = `${dateInputStr}T${timeInputStr}+07:00`;
    
    const resultDate = new Date(isoStringWithTimezone);
    return isNaN(resultDate.getTime()) ? null : resultDate;
};


/**
 * Parses a date string and formats it as "M/D/YYYY".
 * If parsing fails, it returns null, allowing the caller to handle fallback UI.
 * @param dateStr The date string to format.
 * @returns The formatted date string or null.
 */
export const formatDisplayDate = (dateStr?: string): string | null => {
    if (!dateStr) return null;
    const date = parseDate(dateStr);
    return date ? formatDateAsMDY(date) : null;
};

/**
 * Converts a date string from any format parseDate understands into 'YYYY-MM-DD' for date inputs.
 */
export const formatToInputDate = (dateStr?: string): string => {
    const date = parseDate(dateStr);
    if (!date) return '';

    // Use toLocaleDateString with a specific timezone and format to prevent local timezone shifts.
    // The 'en-CA' locale reliably produces the 'YYYY-MM-DD' format.
    // 'Asia/Bangkok' is used for UTC+7.
    return date.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
};

/**
 * Converts a date string from an HTML date input ('YYYY-MM-DD') to 'M/D/YYYY' for the sheet,
 * prepending an apostrophe to force Google Sheets to treat it as a literal string.
 */
export const formatToSheetDate = (inputDateStr?: string): string => {
    if (!inputDateStr || !inputDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return inputDateStr || '';
    }
    const [year, month, day] = inputDateStr.split('-');
    // Prepend apostrophe to force string type in Google Sheets and prevent auto-formatting
    return `'${Number(month)}/${Number(day)}/${year}`;
};

/**
 * Calculates a due date by adding a time frame (e.g., "30 days", 7) to a created date.
 * Handles both string and number types for the time frame.
 * @param createdDateStr The starting date string.
 * @param timeFrameValue The time frame value (e.g., "2 weeks", "1 month", 7).
 * @returns A new Date object for the calculated due date, or null if parsing fails.
 */
export function calculateDueDate(createdDateStr?: string, timeFrameValue?: string | number): Date | null {
  const createdDate = parseDate(createdDateStr);
  if (!createdDate) return null;

  // Check if timeFrameValue is null, undefined, or an empty string after conversion.
  if (timeFrameValue === null || timeFrameValue === undefined || String(timeFrameValue).trim() === '') {
    return null;
  }
  
  const timeFrame = String(timeFrameValue).toLowerCase().trim();
  const newDate = new Date(createdDate.getTime());

  // First, check if the timeFrame is just a number (representing days)
  const daysAsNumber = parseInt(timeFrame, 10);
  if (!isNaN(daysAsNumber) && String(daysAsNumber) === timeFrame) {
      newDate.setDate(newDate.getDate() + daysAsNumber);
      return newDate;
  }

  // If not a plain number, try matching patterns like "30 days", "1 week", etc.
  const match = timeFrame.match(/(\d+)\s*(day|week|month)s?/);

  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'day':
      newDate.setDate(newDate.getDate() + value);
      break;
    case 'week':
      newDate.setDate(newDate.getDate() + value * 7);
      break;
    case 'month':
      newDate.setMonth(newDate.getMonth() + value);
      break;
    default:
      return null;
  }

  return newDate;
}