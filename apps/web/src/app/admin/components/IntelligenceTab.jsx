import { useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  SimpleGrid,
  Badge,
  ThemeIcon,
  Loader,
  Center,
  Table,
  useMantineColorScheme,
} from '@mantine/core';
import { IconBrain, IconChartRadar, IconGauge, IconReportAnalytics } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

const scenarioLabels = {
  fitness: 'Fitness',
  family: 'Family',
  budget: 'Budget',
};

export default function IntelligenceTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [report, setReport] = useState(null);
  const [compare, setCompare] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.get('/report'), apiClient.get('/recommendations/compare')])
      .then(([reportRes, compareRes]) => {
        setReport(reportRes.data);
        setCompare(compareRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.72)' : 'rgba(255,255,255,0.86)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  const metricCards = useMemo(() => {
    const quality = report?.summary?.quality?.metricValue ?? 0;
    const reward = report?.summary?.reward?.metricValue ?? 0;
    const ctr = report?.summary?.attribution?.clickThroughRate ?? 0;
    const friction = report?.summary?.attribution?.frictionRate ?? 0;
    return [
      { label: 'Recommendation Quality', value: `${quality.toFixed(1)}`, icon: IconGauge, color: '#FF6B35' },
      { label: 'Reward Score', value: `${reward.toFixed(1)}`, icon: IconBrain, color: '#5C6BC0' },
      { label: 'CTR', value: `${(ctr * 100).toFixed(1)}%`, icon: IconChartRadar, color: '#66BB6A' },
      { label: 'Friction', value: `${(friction * 100).toFixed(1)}%`, icon: IconReportAnalytics, color: '#AB47BC' },
    ];
  }, [report]);

  if (loading) {
    return <Center py="xl"><Loader /></Center>;
  }

  const topSignals = report?.summary?.topSignals || [];
  const topFeatures = report?.summary?.topFeatureImportance || [];
  const metrics = report?.metrics?.metrics || {};
  const governance = report?.governance?.governance || {};
  const scenarios = compare?.scenarios || {};

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={800} size="1.9rem" c={dark ? 'white' : '#1A237E'}>هوش محصول</Text>
          <Text size="sm" c="dimmed">خلاصه‌ی زنده‌ی recommendation، governance، و تفاوت سناریوهای کاربر</Text>
        </div>
        <Badge color="teal" variant="light" size="lg" radius="xl">
          Live report
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {metricCards.map((card) => (
          <Paper key={card.label} p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
            <Group justify="space-between" mb="sm">
              <ThemeIcon size={44} radius="xl" style={{ background: `${card.color}18`, color: card.color }}>
                <card.icon size={22} />
              </ThemeIcon>
            </Group>
            <Text fw={800} size="2rem" c={dark ? 'white' : '#1A237E'}>{card.value}</Text>
            <Text size="xs" c="dimmed">{card.label}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={700} mb="md">Top signals</Text>
          <Stack gap="xs">
            {topSignals.slice(0, 6).map((signal) => (
              <Group key={signal.signalName || signal.featureKey || signal.id} justify="space-between">
                <Text size="sm">{signal.signalName || signal.featureKey || 'signal'}</Text>
                <Badge variant="light">{String(signal.value ?? signal.contribution ?? 0).slice(0, 5)}</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>

        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={700} mb="md">Top feature importance</Text>
          <Stack gap="xs">
            {topFeatures.slice(0, 6).map((item) => (
              <Group key={`${item.recipeId}-${item.featureKey}`} justify="space-between">
                <Text size="sm">{item.featureKey}</Text>
                <Badge variant="light">{Number(item.contribution || 0).toFixed(2)}</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        <Text fw={700} mb="md">Metrics snapshots</Text>
        <Table striped highlightOnHover>
          <thead>
            <tr>
              <th>Window</th>
              <th>Quality</th>
              <th>Reward</th>
              <th>CTR</th>
              <th>Save</th>
              <th>Cook</th>
            </tr>
          </thead>
          <tbody>
            {(['7d', '30d', '90d']).map((window) => (
              <tr key={window}>
                <td>{window}</td>
                <td>{Number(metrics[window]?.recommendationQuality || 0).toFixed(1)}</td>
                <td>{Number(metrics[window]?.recommendationReward || 0).toFixed(1)}</td>
                <td>{((metrics[window]?.clickThroughRate || 0) * 100).toFixed(1)}%</td>
                <td>{((metrics[window]?.saveRate || 0) * 100).toFixed(1)}%</td>
                <td>{((metrics[window]?.cookRate || 0) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Paper>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        <Group justify="space-between" mb="md">
          <Text fw={700}>Scenario comparison</Text>
          <Badge variant="light">{compare?.candidateCount || 0} candidates</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
          {Object.entries(scenarios).map(([key, items]) => (
            <Paper key={key} p="md" style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#fff', borderRadius: 14, border: borderStyle }}>
              <Text fw={700} mb="xs">{scenarioLabels[key] || key}</Text>
              <Stack gap={8}>
                {(items || []).map((item, index) => (
                  <Group key={`${key}-${item.recipeId}`} justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={600}>{index + 1}. {item.title || item.recipeId}</Text>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {(item.matchedSignals || []).slice(0, 4).join(' · ')}
                      </Text>
                    </div>
                    <Badge variant="light">{Number(item.finalScore || 0).toFixed(2)}</Badge>
                  </Group>
                ))}
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Paper>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        <Text fw={700} mb="md">Governance snapshot</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <Paper p="md" style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#fff', borderRadius: 14, border: borderStyle }}>
            <Text size="xs" c="dimmed">Retention policy</Text>
            <Text fw={700}>{governance.retentionPolicyDays || 365} days</Text>
          </Paper>
          <Paper p="md" style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#fff', borderRadius: 14, border: borderStyle }}>
            <Text size="xs" c="dimmed">Active assignments</Text>
            <Text fw={700}>{governance.activeAssignments || 0}</Text>
          </Paper>
          <Paper p="md" style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#fff', borderRadius: 14, border: borderStyle }}>
            <Text size="xs" c="dimmed">Recent events</Text>
            <Text fw={700}>{governance.recentEventVolume || 0}</Text>
          </Paper>
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}
