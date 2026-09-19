import { ModelsController } from '../src/modules/models-admin/models.controller';

describe('ModelsController user role resolution', () => {
  it('passes the current database role to model access filtering', async () => {
    const listActive = jest.fn().mockResolvedValue([]);
    const controller = new ModelsController(
      { listActive, getUsableDefault: jest.fn() } as any,
      { findById: jest.fn().mockResolvedValue({ id: 'u1', role: 'admin' }) } as any,
    );

    await controller.list({ user: { sub: 'u1', role: 'user' } });

    expect(listActive).toHaveBeenCalledWith({ id: 'u1', role: 'admin' });
  });
});