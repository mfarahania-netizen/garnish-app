import { useState } from 'react';
import { Paper, Text, TextInput, Select, Textarea, Button, Alert, useMantineColorScheme } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { useSupportContext } from '../context/SupportContext';

export default function TicketForm() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitted, setSubmitted] = useState(false);
  const { addTicket } = useSupportContext();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const bgColor = dark ? '#1e1e24' : '#fff';
  const inputStyles = {
    label: { color: dark ? '#ccc' : '#333', marginBottom: 6 },
    input: {
      backgroundColor: dark ? '#2a2a2a' : '#fff',
      color: dark ? '#fff' : '#000',
      border: `1px solid ${dark ? '#444' : '#ddd'}`,
    },
  };

  const handleSubmit = () => {
    if (!subject || !message) return;
    addTicket({ subject, message, priority });
    setSubject('');
    setMessage('');
    setPriority('medium');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <Paper shadow="sm" p="md" radius="lg" mb="lg" style={{ backgroundColor: bgColor }}>
      <Text fw={500} mb="sm" c={dark ? '#fff' : '#1A237E'}>ثبت تیکت جدید</Text>
      {submitted && <Alert color="green" mb="sm" style={{ borderRadius: 12 }}>تیکت شما با موفقیت ثبت شد.</Alert>}
      <TextInput
        label="موضوع"
        placeholder="موضوع تیکت را بنویسید..."
        mb="sm"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        styles={inputStyles}
      />
      <Select
        label="اولویت"
        mb="sm"
        data={[
          { value: 'low', label: 'عادی' },
          { value: 'medium', label: 'متوسط' },
          { value: 'high', label: 'فوری' },
        ]}
        value={priority}
        onChange={(val) => setPriority(val)}
        styles={inputStyles}
      />
      <Textarea
        label="توضیحات"
        placeholder="مشکل یا پیشنهاد خود را شرح دهید..."
        minRows={4}
        mb="md"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        styles={inputStyles}
      />
      <Button fullWidth leftSection={<IconSend size={18} />} onClick={handleSubmit} style={{ borderRadius: 12 }}>
        ارسال تیکت
      </Button>
    </Paper>
  );
}