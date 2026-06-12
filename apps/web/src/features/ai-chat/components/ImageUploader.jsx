import { useRef, useState } from 'react';
import { ActionIcon, Tooltip, Box, Image } from '@mantine/core';
import { IconCamera, IconX } from '@tabler/icons-react';
import { analyzeImage, isImageFile } from '../services/visionService';

export default function ImageUploader({ onImageAnalyzed }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !isImageFile(file)) return;

    // پیش‌نمایش
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    // تحلیل تصویر
    setAnalyzing(true);
    try {
      const result = await analyzeImage(file);
      if (result.success && result.ingredients.length > 0) {
        onImageAnalyzed?.(result.ingredients, result);
        setPreview(null); // پاک کردن پیش‌نمایش
      }
    } catch (error) {
      console.error('خطا در تحلیل تصویر:', error);
    }
    setAnalyzing(false);
    // ریست input
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Tooltip label="عکس از یخچال">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          radius="xl"
          onClick={() => inputRef.current?.click()}
          loading={analyzing}
        >
          <IconCamera size={18} />
        </ActionIcon>
      </Tooltip>

      {/* پیش‌نمایش تصویر */}
      {preview && (
        <Box style={{ position: 'relative', display: 'inline-block' }}>
          <Image src={preview} alt="پیش‌نمایش" height={120} radius="md" />
          <ActionIcon
            variant="filled"
            color="red"
            radius="xl"
            size="xs"
            style={{ position: 'absolute', top: -6, right: -6 }}
            onClick={() => setPreview(null)}
          >
            <IconX size={12} />
          </ActionIcon>
        </Box>
      )}
    </>
  );
}
