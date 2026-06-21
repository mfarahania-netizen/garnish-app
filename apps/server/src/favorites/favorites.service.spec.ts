import { FavoritesService } from './favorites.service';
import { NotFoundException } from '@nestjs/common';

describe('FavoritesService — publish gate (advisor audit)', () => {
  it('addFavorite REJECTS another user\'s unpublished recipe (no create)', async () => {
    const prisma: any = {
      recipe: { findUnique: jest.fn().mockResolvedValue({ status: 'pending', isPublic: true, authorId: 'other' }) },
      favoriteRecipe: { findUnique: jest.fn(), create: jest.fn() },
    };
    await expect(new FavoritesService(prisma).addFavorite('me', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.favoriteRecipe.create).not.toHaveBeenCalled();
  });

  it('addFavorite allows a published recipe', async () => {
    const prisma: any = {
      recipe: { findUnique: jest.fn().mockResolvedValue({ status: 'active', isPublic: true, authorId: 'other' }) },
      favoriteRecipe: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'f1' }) },
    };
    await expect(new FavoritesService(prisma).addFavorite('me', 'r1')).resolves.toEqual({ id: 'f1' });
  });

  it('addFavorite allows the user\'s OWN draft (pending but authored by them)', async () => {
    const prisma: any = {
      recipe: { findUnique: jest.fn().mockResolvedValue({ status: 'pending', isPublic: true, authorId: 'me' }) },
      favoriteRecipe: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'f2' }) },
    };
    await expect(new FavoritesService(prisma).addFavorite('me', 'r1')).resolves.toEqual({ id: 'f2' });
  });

  it('getFavorites omits an unpublished recipe the user does not own (keeps published + own draft)', async () => {
    const prisma: any = {
      favoriteRecipe: { findMany: jest.fn().mockResolvedValue([
        { recipe: { id: 'a', status: 'active', isPublic: true, authorId: 'x' } },
        { recipe: { id: 'b', status: 'pending', isPublic: true, authorId: 'x' } }, // hidden (others' draft)
        { recipe: { id: 'c', status: 'pending', isPublic: true, authorId: 'me' } }, // own draft → kept
        { recipe: { id: 'd', status: 'active', isPublic: false, authorId: 'x' } }, // private others' → hidden
      ]) },
    };
    const out = await new FavoritesService(prisma).getFavorites('me');
    expect(out.map((f: any) => f.recipe.id)).toEqual(['a', 'c']);
  });
});
