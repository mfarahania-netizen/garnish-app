import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconApple, IconArrowBackUp, IconBottle, IconBowlSpoon, IconBread, IconCandy, IconCarrot,
  IconDroplet, IconEggs, IconFish, IconLeaf, IconMeat, IconMilk, IconPepper, IconPlant,
  IconTrash,
} from '@tabler/icons-react';

const iconByKey = {
  protein: IconMeat,
  fish: IconFish,
  egg: IconEggs,
  dairy: IconMilk,
  aromatic: IconPlant,
  vegetable: IconCarrot,
  herb: IconLeaf,
  legume: IconBowlSpoon,
  grain: IconBowlSpoon,
  oil: IconDroplet,
  spice: IconPepper,
  sauce: IconBottle,
  citrus: IconApple,
  nut: IconPlant,
  bread: IconBread,
  fruit: IconApple,
  sweetener: IconCandy,
  liquid: IconDroplet,
  default: IconBowlSpoon,
};

const muted = {
  fontFamily: 'var(--g-font-fa)',
  fontSize: 'var(--g-font-size-12)',
  color: 'var(--g-color-text-muted)',
};

function IngredientMeta({ children, tone = 'muted' }) {
  if (!children) return null;
  return (
    <Text
      component="p"
      style={{
        ...muted,
        margin: '3px 0 0',
        color: tone === 'amount' ? 'var(--g-color-brand-700)' : 'var(--g-color-text-muted)',
        fontWeight: tone === 'amount' ? 800 : 500,
        overflowWrap: 'anywhere',
        textAlign: 'right',
      }}
    >
      {children}
    </Text>
  );
}

export default function IngredientRow({
  item,
  amountLabelOverride = '',
  applied = null,
  gone = false,
  canAskSwap = false,
  canRemove = false,
  onAskSwap = null,
  onToggleRemove = null,
}) {
  const Icon = iconByKey[item?.iconKey] || iconByKey.default;
  const title = item?.titleFa || '';
  const displayTitle = applied && !gone ? applied.to : title;
  const amountLabel = amountLabelOverride || item?.amountLabel || '';

  return (
    <Box
      component="li"
      dir="rtl"
      data-ingredient-row="true"
      style={{
        listStyle: 'none',
        padding: 'var(--g-space-3) var(--g-space-4)',
        borderBlockStart: '1px solid var(--g-color-border-subtle)',
        opacity: gone ? 0.62 : 1,
      }}
    >
      <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-3)' }}>
        <Box
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            inlineSize: 36,
            blockSize: 36,
            borderRadius: 'var(--g-radius-input)',
            background: gone ? 'var(--g-color-bg-muted)' : 'var(--g-color-brand-50)',
            color: 'var(--g-color-brand-700)',
            border: '1px solid var(--g-color-brand-100)',
            flexShrink: 0,
          }}
        >
          <Icon size={19} stroke={1.7} />
        </Box>

        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Text
            component="div"
            style={{
              fontFamily: 'var(--g-font-fa)',
              fontSize: 'var(--g-font-size-14)',
              fontWeight: 850,
              color: applied && !gone ? 'var(--g-color-brand-700)' : 'var(--g-color-text-primary)',
              textDecoration: gone ? 'line-through' : 'none',
              textAlign: 'right',
            }}
          >
            {displayTitle}
          </Text>

          {applied && !gone ? <IngredientMeta>به‌جای {title}</IngredientMeta> : null}
          {gone ? <IngredientMeta>حذف شد</IngredientMeta> : null}
          {!gone ? <IngredientMeta tone="amount">{amountLabel}</IngredientMeta> : null}
          {!gone ? <IngredientMeta>{item?.preparationLabel}</IngredientMeta> : null}
          {!gone ? <IngredientMeta>{item?.roleLabel}</IngredientMeta> : null}

          {(onAskSwap && !gone && canAskSwap) || (onToggleRemove && (gone || canRemove)) ? (
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-2)' }}>
              {onAskSwap && !gone && canAskSwap ? (
                <UnstyledButton
                  type="button"
                  onClick={onAskSwap}
                  aria-label={`جایگزین برای ${title}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minBlockSize: 36,
                    paddingInline: 'var(--g-space-3)',
                    borderRadius: 'var(--g-radius-chip)',
                    border: `1px solid ${applied ? 'var(--g-color-brand-600)' : 'var(--g-color-brand-200)'}`,
                    background: applied ? 'var(--g-color-brand-50)' : 'transparent',
                    color: 'var(--g-color-brand-700)',
                    fontFamily: 'var(--g-font-fa)',
                    fontSize: 'var(--g-font-size-11)',
                    fontWeight: 750,
                  }}
                >
                  {applied ? 'تغییر جایگزین' : 'جایگزین؟'}
                </UnstyledButton>
              ) : null}
              {onToggleRemove && (gone || canRemove) ? (
                <UnstyledButton
                  type="button"
                  onClick={onToggleRemove}
                  aria-label={gone ? `برگرداندن ${title}` : `حذف ${title}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    inlineSize: 36,
                    minBlockSize: 36,
                    borderRadius: 'var(--g-radius-chip)',
                    border: '1px solid var(--g-color-border-subtle)',
                    color: gone ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)',
                  }}
                >
                  {gone ? <IconArrowBackUp size={16} stroke={1.8} /> : <IconTrash size={15} stroke={1.8} />}
                </UnstyledButton>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
