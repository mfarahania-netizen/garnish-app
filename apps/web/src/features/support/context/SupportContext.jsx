import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loadTickets, saveTicket } from '../services/supportStore';

const SupportContext = createContext();
export const useSupportContext = () => useContext(SupportContext);

export const SupportProvider = ({ children }) => {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    setTickets(loadTickets());
  }, []);

  const addTicket = useCallback((data) => {
    const newTicket = saveTicket(data);
    setTickets(prev => [newTicket, ...prev]);
    return newTicket;
  }, []);

  return (
    <SupportContext.Provider value={{ tickets, addTicket }}>
      {children}
    </SupportContext.Provider>
  );
};