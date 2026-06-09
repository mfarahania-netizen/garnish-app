// apps/web/src/app/admin/page.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../lib/apiClient';
import { Center, Loader, Stack, Text, Button } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import AdminLayout from './components/AdminLayout';

import DashboardTab from './components/DashboardTab';
import UsersTab from './components/UsersTab';
import RecipesTab from './components/RecipesTab';
import SearchTab from './components/SearchTab';
import MealPlanTab from './components/MealPlanTab';
import ShoppingTab from './components/ShoppingTab';
import AITab from './components/AITab';
import EventsTab from './components/EventsTab';
import TicketsTab from './components/TicketsTab';
import BehaviorTab from './components/BehaviorTab';
import PagesTab from './components/PagesTab';
import HealthTab from './components/HealthTab';
import IntelligenceTab from './components/IntelligenceTab';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!token) return;
    apiClient.get('/users/me')
      .then(res => setIsAdmin(res.data.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [token]);

  if (!token || isAdmin === false) {
    return (
      <Center style={{ height: '100vh', background: '#f5f5f5' }}>
        <Stack align="center" gap="md">
          <IconLock size={48} color="red" />
          <Text fw={700} size="lg">دسترسی غیرمجاز</Text>
          <Button variant="outline" onClick={() => window.location.href = '/'}>بازگشت</Button>
        </Stack>
      </Center>
    );
  }

  if (isAdmin === null) return <Center style={{ height: '100vh' }}><Loader /></Center>;

  const tabs = {
    dashboard: <DashboardTab />,
    users: <UsersTab />,
    recipes: <RecipesTab />,
    search: <SearchTab />,
    mealplan: <MealPlanTab />,
    shopping: <ShoppingTab />,
    ai: <AITab />,
    events: <EventsTab />,
    tickets: <TicketsTab />,
    behavior: <BehaviorTab />,
    pages: <PagesTab />,
    health: <HealthTab />,
    intelligence: <IntelligenceTab />,
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {tabs[activeTab] || <DashboardTab />}
    </AdminLayout>
  );
}
