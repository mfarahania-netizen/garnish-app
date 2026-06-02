import { useState, useEffect } from 'react';
import {
  Container, Title, Group, ActionIcon, Paper, Stack, Button, Alert, Text,
  useMantineColorScheme
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight, IconSend } from '@tabler/icons-react';
import { AddRecipeProvider, useAddRecipe } from '../context/AddRecipeContext';
import { useAnalytics } from '../../../hooks/useAnalytics'; // 👈 جدید
import BasicInfoSection from '../components/BasicInfoSection';
import MediaSection from '../components/MediaSection';
import IngredientsSection from '../components/IngredientsSection';
import StepsSection from '../components/StepsSection';
import TipsSection from '../components/TipsSection';
import FaqSection from '../components/FaqSection';
import NutritionSection from '../components/NutritionSection';

function AddRecipeForm() {
  const { trackEvent } = useAnalytics(); // 👈 جدید
  const context = useAddRecipe();
  const {
    title, setTitle,
    description, setDescription,
    category, setCategory,
    difficulty, setDifficulty,
    cookingTime, setCookingTime,
    servings, setServings,
    prepTime, setPrepTime,
    totalTime, setTotalTime,
    mealType, setMealType,
    diet, setDiet,
    cost, setCost,
    region, setRegion,
    ingredients, setIngredients,
    steps, setSteps,
    tools, setTools,
    tips, setTips,
    faq, setFaq,
    categories, setCategories,
    allergens, setAllergens,
    occasion, setOccasion,
    submitRecipe
  } = context;
  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const textColor = dark ? '#fff' : '#1A237E';
  const cardBg = dark ? '#25262b' : '#ffffff';
  const borderColor = dark ? '#333' : '#e0e0e0';

  const [alert, setAlert] = useState(null);

  // 👇 ردیابی بازدید از صفحه
  useEffect(() => {
    trackEvent('add_recipe_view');
  }, []);

  const handleSubmit = async () => {
    if (!title || ingredients.filter(i => i.name.trim()).length === 0 || steps.filter(s => s.instruction.trim()).length === 0) {
      setAlert({ type: 'error', message: 'عنوان، حداقل یک ماده اولیه و یک مرحله پخت الزامی هستند.' });
      return;
    }
    const result = await submitRecipe();
    if (result) {
      trackEvent('add_recipe_submit', { title, category, difficulty }); // 👈 ردیابی ثبت موفق
      setAlert({ type: 'success', message: 'رسپی با موفقیت ثبت شد! در حال انتقال...' });
      setTimeout(() => navigate(`/recipe/${result.id}`), 1500);
    } else {
      trackEvent('add_recipe_error'); // 👈 ردیابی خطا
    }
  };

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 12px 60px' }}>
      <Group justify="space-between" align="center" mb="lg">
        <Title order={3} c={textColor}>📝 افزودن رسپی جدید</Title>
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => navigate(-1)}>
          <IconArrowRight size={20} style={{ transform: 'rotate(180deg)' }} />
        </ActionIcon>
      </Group>

      {alert && (
        <Alert
          color={alert.type === 'success' ? 'green' : 'red'}
          mb="lg"
          radius="xl"
          withCloseButton
          onClose={() => setAlert(null)}
        >
          {alert.message}
        </Alert>
      )}

      <Stack gap="md">
        <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <BasicInfoSection
            dark={dark}
            inputStyles={{
              label: { color: dark ? '#ccc' : '#333', marginBottom: 8 },
              input: { backgroundColor: dark ? '#2a2a2a' : '#fff', color: dark ? '#fff' : '#000', border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 8 },
            }}
            textColor={textColor}
            title={title} setTitle={setTitle}
            description={description} setDescription={setDescription}
            category={category} setCategory={setCategory}
            difficulty={difficulty} setDifficulty={setDifficulty}
            cookingTime={cookingTime} setCookingTime={setCookingTime}
            servings={servings} setServings={setServings}
            prepTime={prepTime} setPrepTime={setPrepTime}
            totalTime={totalTime} setTotalTime={setTotalTime}
            mealType={mealType} setMealType={setMealType}
            diet={diet} setDiet={setDiet}
            cost={cost} setCost={setCost}
            region={region} setRegion={setRegion}
            categories={categories} setCategories={setCategories}
            allergens={allergens} setAllergens={setAllergens}
            occasion={occasion} setOccasion={setOccasion}
          />
        </Paper>

        <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <MediaSection dark={dark} textColor={textColor} />
        </Paper>

        <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <IngredientsSection
            inputStyles={{
              label: { color: dark ? '#ccc' : '#333' },
              input: { backgroundColor: dark ? '#2a2a2a' : '#fff', color: dark ? '#fff' : '#000', border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 8 },
            }}
            textColor={textColor}
            ingredients={ingredients}
            setIngredients={setIngredients}
          />
        </Paper>

        <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <StepsSection
            dark={dark}
            inputStyles={{
              label: { color: dark ? '#ccc' : '#333' },
              input: { backgroundColor: dark ? '#2a2a2a' : '#fff', color: dark ? '#fff' : '#000', border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 8 },
            }}
            textColor={textColor}
            steps={steps}
            setSteps={setSteps}
          />
        </Paper>

        <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <TipsSection
            inputStyles={{
              label: { color: dark ? '#ccc' : '#333' },
              input: { backgroundColor: dark ? '#2a2a2a' : '#fff', color: dark ? '#fff' : '#000', border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 8 },
            }}
            textColor={textColor}
            tips={tips}
            setTips={setTips}
          />
        </Paper>

        <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <FaqSection
            dark={dark}
            inputStyles={{
              label: { color: dark ? '#ccc' : '#333' },
              input: { backgroundColor: dark ? '#2a2a2a' : '#fff', color: dark ? '#fff' : '#000', border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 8 },
            }}
            textColor={textColor}
            faq={faq}
            setFaq={setFaq}
          />
        </Paper>

        <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
          <NutritionSection
            inputStyles={{
              label: { color: dark ? '#ccc' : '#333' },
              input: { backgroundColor: dark ? '#2a2a2a' : '#fff', color: dark ? '#fff' : '#000', border: `1px solid ${dark ? '#444' : '#ddd'}`, borderRadius: 8 },
            }}
            textColor={textColor}
          />
        </Paper>

        <Button
          fullWidth
          size="lg"
          radius="xl"
          color="orange"
          leftSection={<IconSend size={20} />}
          onClick={handleSubmit}
          style={{ boxShadow: '0 4px 12px rgba(255,107,53,0.3)' }}
        >
          ثبت رسپی جدید
        </Button>
      </Stack>
    </Container>
  );
}

export default function AddRecipePage() {
  return (
    <AddRecipeProvider>
      <AddRecipeForm />
    </AddRecipeProvider>
  );
}