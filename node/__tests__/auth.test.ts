import { authConfig } from '../config/auth'
import { auth } from '../middlewares/auth'

describe('Auth Middleware', () => {
  let ctx: any
  let next: jest.Mock

  beforeEach(() => {
    ctx = {
      get: jest.fn(),
      status: 200,
      body: {},
    }
    next = jest.fn()
  })

  it('should call next() when app-key and app-token are valid', async () => {
    // Arrange
    ctx.get.mockImplementation((header: string) => {
      if (header === 'app-key') return authConfig.appKey
      if (header === 'app-token') return authConfig.appToken
      return null
    })

    // Act
    await auth(ctx, next)

    // Assert
    expect(next).toHaveBeenCalled()
    expect(ctx.status).toBe(200)
  })

  it('should return 401 when app-key is invalid', async () => {
    // Arrange
    ctx.get.mockImplementation((header: string) => {
      if (header === 'app-key') return 'invalid-app-key'
      if (header === 'app-token') return authConfig.appToken
      return null
    })

    // Act
    await auth(ctx, next)

    // Assert
    expect(next).not.toHaveBeenCalled()
    expect(ctx.status).toBe(401)
    expect(ctx.body.message).toBe('Unauthorized: Invalid app-key or app-token')
  })

  it('should return 401 when app-token is invalid', async () => {
    // Arrange
    ctx.get.mockImplementation((header: string) => {
      if (header === 'app-key') return authConfig.appKey
      if (header === 'app-token') return 'invalid-app-token'
      return null
    })

    // Act
    await auth(ctx, next)

    // Assert
    expect(next).not.toHaveBeenCalled()
    expect(ctx.status).toBe(401)
    expect(ctx.body.message).toBe('Unauthorized: Invalid app-key or app-token')
  })
})
