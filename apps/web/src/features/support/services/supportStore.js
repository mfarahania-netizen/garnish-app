const STORAGE_KEY = 'support_tickets';

export const loadTickets = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveTicket = (ticket) => {
  const tickets = loadTickets();
  const newTicket = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    status: 'open',
    ...ticket,
  };
  tickets.unshift(newTicket);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  return newTicket;
};