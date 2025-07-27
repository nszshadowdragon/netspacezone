// src/context/SearchContext.jsx
import React, { createContext, useContext, useState } from 'react';
import api from '../api';

/* ❶ ── create + export the context itself */
export const SearchContext = createContext();

export function SearchProvider({ children }) {
  const [query, setQuery]           = useState('');
  const [searchResults, setResults] = useState([]);
  const [isLoading, setLoading]     = useState(false);

  async function performSearch(text) {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(text)}`);
      setResults(data.results || []);
    } catch (err) {
      console.error('[SearchContext] search error', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SearchContext.Provider
      value={{ query, setQuery, searchResults, isLoading, performSearch }}
    >
      {children}
    </SearchContext.Provider>
  );
}

/* ❷ ── helper hook */
export function useSearch() {
  return useContext(SearchContext);
}
