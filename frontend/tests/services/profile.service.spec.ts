import { beforeEach, describe, expect, it, vi } from 'vitest'
import { profileService } from '../../src/services/profile.service'
import * as apiModule from '../../src/services/api'

describe('Profile Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves a relative avatar URL against the API origin after upload', async () => {
    vi.spyOn(apiModule, 'request').mockResolvedValue({
      id: 'u-1',
      email: 'user@example.com',
      displayName: 'User',
      username: null,
      avatarUrl: '/static/avatars/u-1/avatar.png',
      role: 'user',
    } as any)

    const result = await profileService.uploadAvatar(new File(['image'], 'avatar.png', { type: 'image/png' }))

    const expectedOrigin = new URL(apiModule.getApiBaseUrl()).origin
    expect(result.avatarUrl).toBe(`${expectedOrigin}/static/avatars/u-1/avatar.png`)
  })
})