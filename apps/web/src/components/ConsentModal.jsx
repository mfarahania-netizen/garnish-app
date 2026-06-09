// apps/web/src/components/ConsentModal.jsx
import { useState } from 'react';
import { Modal, Text, Button, Group, Checkbox, Stack } from '@mantine/core';
import apiClient from '../lib/apiClient';

export default function ConsentModal({ opened, onClose, onConsentGiven }) {
  const [dataCollection, setDataCollection] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [cookies, setCookies] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await Promise.all([
        apiClient.post('/users/consent', { type: 'DATA_COLLECTION', granted: dataCollection }),
        apiClient.post('/users/consent', { type: 'MARKETING', granted: marketing }),
        apiClient.post('/users/consent', { type: 'COOKIES', granted: cookies }),
      ]);
      onConsentGiven();
      onClose();
    } catch (e) {
      console.error('Consent failed:', e);
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
          label="موافقت با جمع‌آوری داده‌های استفاده (ضروری)"
          checked={dataCollection}
          onChange={(e) => setDataCollection(e.currentTarget.checked)}
        />
        <Checkbox
          label="دریافت اعلان‌های بازاریابی و پیشنهادهای ویژه (اختیاری)"
          checked={marketing}
          onChange={(e) => setMarketing(e.currentTarget.checked)}
        />
        <Checkbox
          label="استفاده از کوکی‌ها برای بهبود تجربه کاربری (ضروری)"
          checked={cookies}
          onChange={(e) => setCookies(e.currentTarget.checked)}
          disabled
        />
      </Stack>
      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={onClose} radius="xl">بعداً</Button>
        <Button loading={loading} onClick={handleAccept} radius="xl" color="orange">تأیید</Button>
      </Group>
    </Modal>
  );
}