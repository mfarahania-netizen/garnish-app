import { useState, useEffect } from 'react';
import {
  Container, Title, Group, Text, Paper, Badge, Stack, Skeleton, Alert
} from '@mantine/core';
import { IconCheck, IconClock, IconPencil, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../lib/apiClient';
import { useAuth } from "../../../context/AuthContext";
import { useAnalytics } from '../../../hooks/useAnalytics';
import { EventType } from '../../../lib/eventTaxonomy'; // 👈 اضافه شد

const statusMap = {
  pending: { label: 'در انتظار بررسی', color: 'yellow', icon: <IconClock size={14} /> },
  approved: { label: 'تأیید شده', color: 'green', icon: <IconCheck size={14} /> },
  needs_revision: { label: 'نیاز به اصلاح', color: 'orange', icon: <IconPencil size={14} /> },
  rejected: { label: 'رد شده', color: 'red', icon: <IconX size={14} /> },
};

export default function MyRecipesPage() {
  const { token } = useAuth();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    trackEvent(EventType.MY_RECIPES_VIEW);
    apiClient.get('/recipes/my')
      .then(res => setRecipes(res.data))
      .catch(err => console.error('خطا در دریافت رسپی‌ها:', err))
      .finally(() => setLoading(false));
  }, [token, trackEvent]);

  return (
    <Container size="xs" py="md" style={{ paddingBottom: 80 }}>
      <Group justify="space-between" mb="lg">
        <Title order={3}>📋 رسپی‌های ارسالی من</Title>
      </Group>

      {loading ? (
        <Stack gap="sm">
          {[1,2,3].map(i => <Skeleton key={i} height={80} radius="md" />)}
        </Stack>
      ) : recipes.length === 0 ? (
        <Alert color="orange" radius="lg">هنوز رسپی‌ای ارسال نکرده‌اید.</Alert>
      ) : (
        <Stack gap="sm">
          {recipes.map(r => {
            const status = statusMap[r.status] || statusMap.pending;
            return (
              <Paper
                key={r.id}
                p="sm"
                radius="md"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  trackEvent(EventType.MY_RECIPE_CLICK, { recipeId: r.id, title: r.title });
                  navigate(`/recipe/${r.id}`);
                }}
              >
                <Group justify="space-between" mb={4}>
                  <Text size="sm" fw={600}>{r.title}</Text>
                  <Badge variant="light" color={status.color} leftSection={status.icon}>
                    {status.label}
                  </Badge>
                </Group>
                {r.adminNote && (
                  <Text size="xs" c="dimmed" mt={4}>یادداشت ادمین: {r.adminNote}</Text>
                )}
                <Text size="xs" c="gray" mt={4}>
                  {new Date(r.createdAt).toLocaleDateString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
