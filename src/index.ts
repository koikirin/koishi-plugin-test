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
    
    // Remove low-authority warning
    ctx.before('send', (session) => {
      if (session.content === '权限不足。') return true
    })

    // Handle self message
    ctx.guild().on('message', (session) => {
      if (session.userId === session.bot.selfId && session.content.slice(0, 2) === '//') {
        let newSession = session.bot.session(session);
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(2)
        session.bot.dispatch(newSession)
      }
    })
  }
}

export default TestService