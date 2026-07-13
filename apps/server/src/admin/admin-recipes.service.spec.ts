import { AdminService } from './admin.service';

describe('AdminService recipe operations projection', () => {
  const make = (rows: any[] = [], total = rows.length) => {
    const prisma: any = {
      recipe: {
        findMany: jest.fn(async () => rows),
        count: jest.fn(async () => total),
      },
    };
    return { prisma, service: new AdminService(prisma, {} as any, {} as any) };
  };

  it('applies allowlisted filters/sort and returns a light projection with truthful range', async () => {
    const updatedAt = new Date('2026-07-13T09:00:00.000Z');
    const { prisma, service } = make([{
      id: 'r1', title: 'آش رشته', category: 'main', status: 'pending', isPublic: false, imageUrl: '/a.jpg',
      createdAt: updatedAt, updatedAt, author: { name: 'Editor' }, _count: { ingredients: 8, steps: 5 },
    }], 21);

    const result = await service.getAllRecipes({ q: 'آش', status: 'pending', visibility: 'private', sort: 'title', direction: 'asc', page: 2, limit: 20 });

    expect(prisma.recipe.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { title: { contains: 'آش', mode: 'insensitive' }, status: 'pending', isPublic: false },
      skip: 20,
      take: 20,
      orderBy: { title: 'asc' },
      select: expect.objectContaining({ id: true, title: true, _count: { select: { ingredients: true, steps: true } } }),
    }));
    expect(prisma.recipe.findMany.mock.calls[0][0].select).not.toHaveProperty('description');
    expect(prisma.recipe.findMany.mock.calls[0][0].select).not.toHaveProperty('gris');
    expect(result.range).toEqual({ from: 21, to: 21 });
    expect(result.data[0]).toMatchObject({ id: 'r1', hasImage: true, ingredientCount: 8, stepCount: 5, authorName: 'Editor' });
    expect(result.data[0]).not.toHaveProperty('_count');
    expect(result.data[0]).not.toHaveProperty('imageUrl');
  });

  it('falls back to updatedAt desc when direct callers pass unknown sort values', async () => {
    const { prisma, service } = make();
    const result = await service.getAllRecipes({ sort: 'createdAt; DROP TABLE Recipe' as any, direction: 'sideways' as any });
    expect(prisma.recipe.findMany.mock.calls[0][0].orderBy).toEqual({ updatedAt: 'desc' });
    expect(result).toMatchObject({ sort: 'updatedAt', direction: 'desc' });
  });

  it('bounds recipe analytics to the requested window instead of all-time data', async () => {
    const prisma: any = {
      userEvent: { findMany: jest.fn(async () => []) },
      favoriteRecipe: { groupBy: jest.fn(async () => []) },
      recipe: { findMany: jest.fn(async () => []) },
    };
    const result = await new AdminService(prisma, {} as any, {} as any).getRecipeStats(30);
    const eventWhere = prisma.userEvent.findMany.mock.calls[0][0].where;
    const favoriteWhere = prisma.favoriteRecipe.groupBy.mock.calls[0][0].where;

    expect(eventWhere).toMatchObject({ type: 'recipe_view', timestamp: { gte: expect.any(Date), lte: expect.any(Date) } });
    expect(favoriteWhere).toMatchObject({ addedAt: { gte: expect.any(Date), lte: expect.any(Date) } });
    expect(result).toMatchObject({ windowDays: 30, source: 'UserEvent.recipe_view + FavoriteRecipe.addedAt' });
  });
});
