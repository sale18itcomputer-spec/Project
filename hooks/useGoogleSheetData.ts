import { useState, useEffect } from 'react';
import { readRecords } from '../services/api';

export const useGoogleSheetData = <T extends {}>(sheetName: string, headers: readonly string[], refetchTrigger: number) => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sheetName) {
        // This can happen if a sheet is meant to be mocked, like SiteSurveys.
        // We'll let the loading state be handled by the caller.
        setLoading(false);
        return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await readRecords<T>(sheetName);

        if (!Array.isArray(items)) {
          throw new Error("API did not return an array. Check the Apps Script response.");
        }
        
        // This more robust normalization handles two common issues from Google Sheets:
        // 1. Ragged rows: The API may return objects with missing keys if trailing cells are empty.
        // 2. Header typos: Users might have extra whitespace in column headers (e.g., "Company Name ").
        const normalizedItems = items.map(item => {
          // First, create an intermediate object with keys trimmed of whitespace.
          const trimmedKeyItem: { [key: string]: any } = {};
          for (const key in item) {
              trimmedKeyItem[key.trim()] = (item as any)[key];
          }

          // Then, build the final normalized object using the canonical headers from schemas.ts.
          // This ensures every expected property exists, defaulting to an empty string if it was
          // missing from the original object or had a misspelled/untrimmed header.
          const normalizedItem = {} as T;
          headers.forEach(header => {
            (normalizedItem as any)[header] = trimmedKeyItem[header] ?? '';
          });
          return normalizedItem;
        });

        setData(normalizedItems);
      } catch (e: any) {
        setError(e.message);
        console.error(`Error fetching data for sheet "${sheetName}":`, e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sheetName, refetchTrigger, headers]);

  return { data, loading, error };
};