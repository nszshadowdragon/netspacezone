// src/pages/SearchResultsPage.jsx
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ThemeSelector from '../components/ThemeSelector';
import axios from '../api';
import { SearchContext } from '../context/SearchContext';

export default function SearchResultsPage() {
  const { query } = useContext(SearchContext);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);

    axios.get('/search', { params: { query } })
      .then(({ data }) => {
        // expect data to be an array of { id, title, excerpt, ... }
        setResults(data);
      })
      .catch(err => {
        console.error('Search error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="fixed top-[70px] right-4 z-50">
        <ThemeSelector />
      </div>

      <main className="mt-[70px] flex-grow px-4 py-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">
          Search Results{query && <> for “{query}”</>}
        </h2>

        {loading && <p>Loading results…</p>}
        {error && <p className="text-red-500">Error: {error}</p>}

        {!loading && !error && results.length === 0 && (
          <p>No results found.</p>
        )}

        <ul className="space-y-6">
          {results.map(item => (
            <li key={item.id} className="border-b pb-4">
              <h3
                className="text-xl text-teal-600 cursor-pointer hover:underline"
                onClick={() => navigate(`/posts/${item.id}`)}
              >
                {item.title}
              </h3>
              {item.excerpt && <p className="mt-1 text-gray-700">{item.excerpt}</p>}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
