import React from 'react';
import { Link } from 'react-router-dom';

export default function Breadcrumb({ paths }) {
  return (
    <nav className="px-4 py-2 text-sm text-gray-600" aria-label="Breadcrumb">
      <ol className="list-reset flex">
        {paths.map((path, index) => (
          <li key={index}>
            {index > 0 && <span className="mx-2">/</span>}
            <Link to={path.link} className="text-blue-600 hover:underline">
              {path.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
