import { Group, Text } from '@mantine/core';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, A11y } from 'swiper/modules';
import RecipeCard from './RecipeCard';

/**
 * SectionSlider — a titled horizontal rail of RecipeCards.
 *
 * GES-reconciled (DS-ALIGN-L4-20): token-pure spacing + the saffron "see all"
 * link uses the brand token (was the Mantine `orange` named color), heading uses
 * the SectionHeader scale, logical alignment (RTL-safe). API preserved:
 * `{ title, recipes }`; Swiper behavior unchanged.
 */
export default function SectionSlider({ title, recipes }) {
  if (!recipes || recipes.length === 0) return null;

  return (
    <div style={{ marginBlockEnd: 'var(--g-space-8)' }}>
      <Group justify="space-between" align="center" mb="var(--g-space-3)">
        <Text
          component="h2"
          style={{
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-18)',
            fontWeight: 700,
            lineHeight: 'var(--g-leading-heading)',
            color: 'var(--g-color-text-primary)',
            textAlign: 'start',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-14)',
            fontWeight: 500,
            color: 'var(--g-color-food-saffron)',
            cursor: 'pointer',
          }}
        >
          همه ›
        </Text>
      </Group>
      <Swiper
        modules={[Autoplay, Pagination, A11y]}
        autoplay={{ delay: 3500 }}
        pagination={{ clickable: true }}
        spaceBetween={16}
        slidesPerView={1}
        style={{ paddingBottom: 'var(--g-space-8)' }}
      >
        {recipes.map((recipe) => (
          <SwiperSlide key={recipe.id}>
            <RecipeCard recipe={recipe} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
