import { Context, Schema, Service } from 'koishi'
import { Foo } from './foo'


declare module 'koishi' {
  interface Context {
    test: TestService
  }
}

export class TestService extends Service {
  a: string

  constructor(ctx: Context, private config: TestService.Config) {
    super(ctx, 'test', true)

    const selfSendPrefixLength = config.selfSendPrefix.length

    console.log('Test plugin initializing.')

    ctx.plugin(Foo)
    
    ctx.middleware((session, next) => {
      if (session.content === 'help') return
      return next()
    }, true)

    // Handle self message
    ctx.guild().on('message', (session) => {
      if (session.userId === session.bot.selfId &&
        session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        let newSession = session.bot.session(session);
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

    ctx.before('send', (session) => {
      if (session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        let newSession = session.bot.session(session);
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

  }
}

export namespace TestService {
  export interface Config {
    selfSendPrefix: string
  }

  export const Config: Schema<Config> = Schema.object({
    selfSendPrefix: Schema.string().default('//')
  })
}

export default TestService