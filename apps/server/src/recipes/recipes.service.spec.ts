import { Test, TestingModule } from '@nestjs/testing';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RecipesService', () => {
  let service: RecipesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('public visibility filter', () => {
    it('findAll queries only active + public recipes', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn().mockResolvedValue(0);
      const svc = new RecipesService({ recipe: { findMany, count } } as any);
      await svc.findAll();
      expect(findMany.mock.calls[0][0].where).toMatchObject({ status: 'active', isPublic: true });
    });

    it('search queries only active + public recipes', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const svc = new RecipesService({ recipe: { findMany } } as any);
      await svc.search('murgh');
      expect(findMany.mock.calls[0][0].where).toMatchObject({ status: 'active', isPublic: true });
    });

    it('findAll ranks by engagement before pagination, not by createdAt', async () => {
      const rows = [
        { id: 'fresh-low', title: 'fresh low', createdAt: new Date('2026-07-01'), ingredients: [], steps: [], searchTerms: [] },
        { id: 'popular', title: 'popular', createdAt: new Date('2026-01-01'), ingredients: [], steps: [], searchTerms: [] },
        { id: 'cooked', title: 'cooked', createdAt: new Date('2026-02-01'), ingredients: [], steps: [], searchTerms: [] },
        { id: 'planned', title: 'planned', createdAt: new Date('2026-03-01'), ingredients: [], steps: [], searchTerms: [] },
      ];
      const findMany = jest.fn().mockResolvedValue(rows);
      const count = jest.fn().mockResolvedValue(rows.length);
      const userEventGroupBy = jest.fn().mockResolvedValue([
        { recipeId: 'popular', type: 'recipe_view', _count: { _all: 10 } },
        { recipeId: 'cooked', type: 'recipe_view', _count: { _all: 1 } },
        { recipeId: 'cooked', type: 'cook_complete', _count: { _all: 8 } },
        { recipeId: 'planned', type: 'recipe_view', _count: { _all: 1 } },
        { recipeId: 'planned', type: 'mealplan_add', _count: { _all: 5 } },
      ]);
      const mealSlotGroupBy = jest.fn().mockResolvedValue([
        { recipeId: 'planned', _count: { _all: 4 } },
      ]);
      const svc = new RecipesService({
        recipe: { findMany, count },
        userEvent: { groupBy: userEventGroupBy },
        mealSlot: { groupBy: mealSlotGroupBy },
      } as any);
      const out = await svc.findAll(0, 4);
      expect(out.data.map((recipe: any) => recipe.id)).toEqual(['popular', 'cooked', 'planned', 'fresh-low']);
      expect(findMany.mock.calls[0][0].orderBy).toBeUndefined();
      expect(findMany.mock.calls[0][0].skip).toBeUndefined();
      expect(findMany.mock.calls[0][0].take).toBeUndefined();
    });

    it('findOne returns null for an unreviewed pending recipe', async () => {
      const findUnique = jest.fn().mockResolvedValue({ id: 'r1', status: 'pending', isPublic: true, ingredients: [], steps: [], searchTerms: [] });
      const svc = new RecipesService({ recipe: { findUnique } } as any);
      expect(await svc.findOne('r1')).toBeNull();
    });

    it('findOne returns null for a private recipe', async () => {
      const findUnique = jest.fn().mockResolvedValue({ id: 'r1', status: 'active', isPublic: false, ingredients: [], steps: [], searchTerms: [] });
      const svc = new RecipesService({ recipe: { findUnique } } as any);
      expect(await svc.findOne('r1')).toBeNull();
    });
  });
});
