import { } from '@koishijs/plugin-adapter-onebot'
import { } from '@koishijs/plugin-adapter-kook'
import { } from '@koishijs/plugin-auth'
import { } from '@koishijs/plugin-console'
import { Context, Element, Loader, Logger, Schema, Service, Session, h } from 'koishi'

declare module 'koishi' {
  interface Context {
    test: TestService
    // foo: Foo
  }
}

const logger = new Logger('test')

export class TestService extends Service {
  static using = ['database']
  
  _findPlugin(name: string, parent: Context): [string, Context, Context] {
    if (!parent) return
    const reg = parent.scope[Loader.kRecord]
    if (!reg) return
    for (const key of Object.getOwnPropertyNames(reg)) {
      const i1 = key.indexOf('/'), i2 = key.indexOf(':')
      const mkey = key.slice(i1 === -1 ? 0 : i1+1, i2 === i1 ? key.length: i2)
      // console.log(mkey)
      // if (mkey === 'group') continue
      if (mkey === name) return [key, parent, reg[key]?.ctx]
      // console.log(reg[key]?.ctx)
      const res = this._findPlugin(name, reg[key]?.ctx)
      if (res) return res
    }
  }

  findPlugin(name: string) {
    return this._findPlugin(name, this.ctx.loader.entry)
  }

  constructor(ctx: Context, private config: TestService.Config) {
    super(ctx, 'test', true)

    const selfSendPrefixLength = config.selfSendPrefix?.length

    console.log('Test plugin initializing.')

    // ctx.plugin(Foo)


    ctx.middleware((session, next) => {
      if (session.content === 'help') return
      // console.log(session)
      return next()
    }, true)

    // Handle self message
    ctx.guild().on('message', (session) => {
      if (config.infoAllSessions === 'event') {
        logger.info(session)
      }
      if (session.userId === session.bot.selfId && selfSendPrefixLength &&
        session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        let newSession = session.bot.session(session);
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

    ctx.before('send', (session) => {
      if (selfSendPrefixLength && session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        let newSession = session.bot.session(session);
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

    const forwardToMe = (session: Session, msg: Element.Fragment) => {
      session.bot.sendPrivateMessage(config.forwardUserId || session.selfId, msg)
    }

    // Handle tome message
    ctx.private().middleware((session, next) => {
      if (session.userId == session.selfId) return next()
      return next((next) => {
        forwardToMe(session, h('', `From ${session.author.username}(${session.author.userId})\n`, session.elements))
      })
    })

    ctx.guild().middleware((session, next) => {
      let flag = false
      if (session.quote && session.quote.userId === session.selfId) flag = true
      else for (const ele of session.elements) {
        if (ele.type == 'at' && ele.attrs.id === session.selfId) {
          flag = true
          break
        }
      }
      if (flag) return next((next) => {
        forwardToMe(session, h('', `From ${session.author.nickname}(${session.author.userId}) from ${session.guildName}(${session.guildId}):`, session.elements))
      })
      else return next()
    })

    if (config.infoAllSessions === 'middleware') {
      // ctx.on('guild-member/ban', (session) => {
      //   ctx.logger('test').info(session.onebot?.sub_type)
      // })
      ctx.middleware((session, next) => {
        if (config.testMode === 'all' || !session.userId)
          logger.info(session)
        return next()
      }, true)
    }


    if (config.fixChannelName) {
      ctx.guild().middleware(async (session, nect) => {
        const channel = await session.getChannel()
        // if (session.channelName && channel.)
        
      })
    }

    ctx.command('test.real').action((argv) => {
      const [key, parent, plugin] = this.findPlugin('adapter')??[]
      console.log(plugin.scope.runtime.ctx['__CHRONO_LAUNCHER__'])
      return 'Hello!'
    })


    ctx.command('test.rel').userFields(['locales']).action(async (argv) => {
      console.log(argv.session.text('general.name'), argv.session.user.locales)
      return await argv.session.execute('test.real')
      return '.......'
    })

    ctx.command('test.reload <plugin:string>').action(async (argv, name) => {
      const [key, parent, plugin] = this.findPlugin(name)??[]
      if (!key) return 'Not found'
      ctx.loader.unloadPlugin(parent, key)
      await ctx.loader.reloadPlugin(parent, key, parent.config)
      
      return 'Success' + plugin
    })

    // ctx.on('send', (session) => {
    //   // console.log('before-execute', argv)
    //   console.log(session)
    // })
  }
}

export namespace TestService {
  export interface Config {
    forwardUserId?: string
    selfSendPrefix?: string
    infoAllSessions: 'off' | 'middleware' | 'event'
    testMode: 'all' | 'undefined-userid'
    fixChannelName: boolean
  }

  export let Config: Schema<Config> = Schema.object({
    forwardUserId: Schema.string(),
    selfSendPrefix: Schema.string().default('//'),
    infoAllSessions: Schema.union(['off', 'middleware', 'event'] as const).default('off'),
    testMode: Schema.union(['all', 'undefined-userid'] as const).default('all'),
    fixChannelName: Schema.boolean().default(false),
  })
}

export default TestService