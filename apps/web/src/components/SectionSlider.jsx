import { Group, Title, Text } from '@mantine/core';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, A11y } from 'swiper/modules';
import RecipeCard from './RecipeCard';

export default function SectionSlider({ title, recipes }) {
  if (!recipes.length) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <Group justify="space-between" mb="md">
        <Title order={4}>{title}</Title>
        <Text size="sm" c="orange" style={{ cursor: 'pointer' }}>همه ›</Text>
      </Group>
      <Swiper
        modules={[Autoplay, Pagination, A11y]}
        autoplay={{ delay: 3500 }}
        pagination={{ clickable: true }}
        spaceBetween={16}
        slidesPerView={1}
        observer={true}
        observeParents={true}
        style={{ paddingBottom: 32 }}
      >
        {recipes.map(recipe => <SwiperSlide key={recipe.id}><RecipeCard recipe={recipe} /></SwiperSlide>)}
      </Swiper>
    </div>
  );
}