interface CalendarEvent {
    title: string;
    description?: string;
    location?: string;
    start: Date;
    end?: Date;
    allDay?: boolean;
}

const toUTC_ISO_Format = (date: Date): string => {
    // Returns YYYYMMDDTHHMMSSZ
    return date.toISOString().replace(/-|:|\.\d+/g, '');
};

const toAllDayFormat = (date: Date): string => {
    // Returns YYYYMMDD based on UTC values to be timezone-agnostic
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

export const generateGoogleCalendarLink = (event: CalendarEvent): string => {
    const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';

    const params = new URLSearchParams();
    params.append('text', event.title);

    if (event.allDay) {
        const startDate = toAllDayFormat(event.start);
        // For Google Calendar all-day events, the end date is exclusive.
        // So for a single-day event, the end date must be the following day.
        const endDate = new Date(event.start);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        params.append('dates', `${startDate}/${toAllDayFormat(endDate)}`);
    } else {
        const startTime = toUTC_ISO_Format(event.start);
        // If no end time is provided, default to a 1-hour duration.
        const endTime = event.end ? toUTC_ISO_Format(event.end) : toUTC_ISO_Format(new Date(event.start.getTime() + 60 * 60 * 1000));
        params.append('dates', `${startTime}/${endTime}`);
    }
    
    if (event.description) {
        params.append('details', event.description);
    }
    if (event.location) {
        params.append('location', event.location);
    }

    return `${baseUrl}&${params.toString()}`;
}