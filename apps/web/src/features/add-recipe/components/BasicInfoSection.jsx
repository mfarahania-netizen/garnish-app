import { TextInput, Select, Textarea, Group, Text, MultiSelect, Stack, Grid, NumberInput } from '@mantine/core';

const categories = [
  { value: 'کباب', label: 'کباب' },
  { value: 'خورشت', label: 'خورشت' },
  { value: 'پلو', label: 'پلو' },
  { value: 'آش', label: 'آش' },
  { value: 'دسر', label: 'دسر' },
  { value: 'سالاد', label: 'سالاد' },
  { value: 'نوشیدنی', label: 'نوشیدنی' },
  { value: 'پیش‌غذا', label: 'پیش‌غذا' },
  { value: 'فست‌فود', label: 'فست‌فود' },
  { value: 'کوکو', label: 'کوکو' },
  { value: 'سس', label: 'سس' },
  { value: 'صبحانه', label: 'صبحانه' },
];

const difficulties = ['آسان', 'متوسط', 'سخت'];
const diets = [
  { value: 'regular', label: 'معمولی' },
  { value: 'vegetarian', label: 'گیاه‌خوار' },
  { value: 'vegan', label: 'وگان' },
  { value: 'healthy', label: 'سالم' },
];
const costs = ['کم‌هزینه', 'متوسط', 'گران'];
const mealTypes = [
  { value: 'breakfast', label: 'صبحانه' },
  { value: 'lunch', label: 'ناهار' },
  { value: 'dinner', label: 'شام' },
  { value: 'snack', label: 'میان‌وعده' },
];
const occasions = ['مهمانی', 'پیک‌نیک', 'شب یلدا', 'افطار', 'نذری', 'روزمره'];
const allergens = [
  { value: 'milk', label: 'شیر' },
  { value: 'eggs', label: 'تخم‌مرغ' },
  { value: 'fish', label: 'ماهی' },
  { value: 'shellfish', label: 'صدف' },
  { value: 'tree_nuts', label: 'آجیل درختی' },
  { value: 'peanuts', label: 'بادام‌زمینی' },
  { value: 'wheat', label: 'گندم' },
  { value: 'soy', label: 'سویا' },
];
const regions = ['persian', 'north', 'south', 'west', 'central', 'international'];

export default function BasicInfoSection({
  dark, inputStyles, textColor,
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
  categories: cats, setCategories: setCats,
  allergens: allers, setAllergens: setAllers,
  occasion: occs, setOccasion: setOccs
}) {
  return (
    <Stack gap="md">
      <TextInput
        label="عنوان رسپی"
        placeholder="مثلاً جوجه کباب زعفرانی"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        styles={inputStyles}
      />
      <Textarea
        label="توضیحات"
        placeholder="توضیح کوتاهی درباره این رسپی بنویسید..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        minRows={3}
        styles={inputStyles}
      />
      <Grid>
        <Grid.Col span={6}>
          <Select
            label="دسته‌بندی اصلی"
            data={categories}
            value={category}
            onChange={setCategory}
            searchable
            styles={inputStyles}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <Select
            label="سختی"
            data={difficulties}
            value={difficulty}
            onChange={setDifficulty}
            styles={inputStyles}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="زمان آماده‌سازی"
            placeholder="مثلاً ۱۵ دقیقه"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            styles={inputStyles}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <NumberInput
            label="زمان پخت (دقیقه)"
            value={cookingTime}
            onChange={(v) => setCookingTime(v)}
            min={0}
            styles={inputStyles}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="زمان کل"
            placeholder="مثلاً ۱ ساعت"
            value={totalTime}
            onChange={(e) => setTotalTime(e.target.value)}
            styles={inputStyles}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <NumberInput
            label="تعداد نفرات"
            value={servings}
            onChange={(v) => setServings(v)}
            min={1}
            styles={inputStyles}
          />
        </Grid.Col>
      </Grid>
      <MultiSelect
        label="وعده غذایی"
        data={mealTypes}
        value={mealType}
        onChange={setMealType}
        styles={inputStyles}
      />
      <Select
        label="رژیم غذایی"
        data={diets}
        value={diet}
        onChange={setDiet}
        styles={inputStyles}
      />
      <Select
        label="هزینه"
        data={costs}
        value={cost}
        onChange={setCost}
        styles={inputStyles}
      />
      <Select
        label="منطقه"
        data={regions}
        value={region}
        onChange={setRegion}
        styles={inputStyles}
      />
      <MultiSelect
        label="دسته‌بندی‌های فرعی"
        data={categories}
        value={cats}
        onChange={setCats}
        searchable
        styles={inputStyles}
      />
      <MultiSelect
        label="آلرژی‌ها"
        data={allergens}
        value={allers}
        onChange={setAllers}
        searchable
        styles={inputStyles}
      />
      <MultiSelect
        label="مناسبت‌ها"
        data={occasions}
        value={occs}
        onChange={setOccs}
        searchable
        styles={inputStyles}
      />
    </Stack>
  );
}