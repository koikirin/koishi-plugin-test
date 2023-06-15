import { Context, Service } from 'koishi'
import { Foo } from './foo'


declare module 'koishi' {
  interface Context {
    test: TestService
  }
}

export class TestService extends Service {
  a: string

  constructor(ctx: Context) {
    super(ctx, 'test', true)
    ctx.plugin(Foo)
    
    ctx.before('send', (session) => {
      if (session.content === '权限不足。') return true
    })
  }
}

export default TestService