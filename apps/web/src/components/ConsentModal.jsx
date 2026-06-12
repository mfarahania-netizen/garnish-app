// apps/web/src/components/ConsentModal.jsx
import { useState } from 'react';
import { Modal, Text, Button, Group, Checkbox, Stack } from '@mantine/core';
import apiClient from '../lib/apiClient';
import { enableAnalytics, disableAnalytics } from '../lib/analytics-init';

export default function ConsentModal({ opened, onClose, onConsentGiven }) {
  // E4: analytics consent must be OPT-IN — default unticked.
  const [dataCollection, setDataCollection] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [cookies, setCookies] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      // 1) Apply analytics consent locally FIRST. This gates PostHog and persists
      //    across reloads regardless of auth state.
      if (dataCollection) {
        enableAnalytics();
      } else {
        disableAnalytics();
      }

      // 2) Best-effort: persist consent on the server, but only for authenticated
      //    users. Calling /users/consent while anonymous would 401 and bounce the
      //    visitor to /auth via the response interceptor.
      const token = localStorage.getItem('token');
      if (token) {
        await Promise.all([
          apiClient.post('/users/consent', { type: 'DATA_COLLECTION', granted: dataCollection }),
          apiClient.post('/users/consent', { type: 'MARKETING', granted: marketing }),
          apiClient.post('/users/consent', { type: 'COOKIES', granted: cookies }),
        ]).catch((e) => console.error('Server consent sync failed:', e));
      }

      onConsentGiven?.();
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="رضایت‌نامه حریم خصوصی" centered radius="lg" size="md" dir="rtl">
      <Text size="sm" mb="md">
        برای استفاده بهتر از Garnish OS و ارائه پیشنهادهای شخصی‌سازی‌شده، لطفاً موارد زیر را تأیید کنید:
      </Text>
      <Stack gap="sm">
        <Checkbox
          label="موافقت با جمع‌آوری داده‌های تحلیلی استفاده (اختیاری)"
          checked={dataCollection}
          onChange={(e) => setDataCollection(e.currentTarget.checked)}
        />
        <Checkbox
          label="دریافت اعلان‌های بازاریابی و پیشنهادهای ویژه (اختیاری)"
          checked={marketing}
          onChange={(e) => setMarketing(e.currentTarget.checked)}
        />
        <Checkbox
          label="استفاده از کوکی‌های ضروری برای عملکرد اپ"
          checked={cookies}
          onChange={(e) => setCookies(e.currentTarget.checked)}
          disabled
        />
      </Stack>
      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={onClose} radius="xl">بعداً</Button>
        <Button loading={loading} onClick={handleAccept} radius="xl" color="orange">ذخیره انتخاب</Button>
      </Group>
    </Modal>
  );
}
