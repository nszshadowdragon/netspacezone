import React, { createContext, useContext, useState } from 'react';
import NotificationPopup from '../components/NotificationPopup';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [message, setMessage] = useState('');

  const notify = (msg, duration = 10000) => {
    setMessage('');
    setTimeout(() => setMessage(msg), 50); // slight delay to retrigger
    setTimeout(() => setMessage(''), duration);
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {message && <NotificationPopup message={message} />}
    </NotificationContext.Provider>
  );
}

export const useNotify = () => useContext(NotificationContext);
