import { } from '@hieuzest/koishi-plugin-send'
import { } from '@koishijs/plugin-market'
import { Context, Dict, Element, Loader, Logger, Schema, Service, Session, User, deepEqual, h, z } from 'koishi'
import { } from '@hieuzest/koishi-plugin-adapter-red'

declare module 'koishi' {
  interface Context {
    test: TestService
    // foo: Foo
  }
}

const logger = new Logger('test')

export class TestService extends Service {
  static using = ['__send__']

  _findPlugin(name: string, parent: Context): [string, Context, Context] {
    if (!parent) return
    const reg = parent.scope[Loader.kRecord]
    if (!reg) return
    for (const key of Object.getOwnPropertyNames(reg)) {
      const i1 = key.indexOf('/'), i2 = key.indexOf(':')
      const mkey = key.slice(0, i2 === i1 ? key.length : i2)
      if (mkey === name) return [key, parent, reg[key]?.ctx]
      const res = this._findPlugin(name, reg[key]?.ctx)
      if (res) return res
    }
  }

  _findPluginC(plugin: Context, parent: Context): [string, Context, Context] {
    if (!parent) return
    const reg = parent.scope[Loader.kRecord]
    if (!reg) return
    for (const key of Object.getOwnPropertyNames(reg)) {
      if (reg[key]?.ctx === plugin) return [key, parent, reg[key]?.ctx]
      const res = this._findPluginC(plugin, reg[key]?.ctx)
      if (res) return res
    }
  }

  findPlugin(plugin: string | Context) {
    if (typeof plugin === 'string')
      return this._findPlugin(plugin, this.ctx.loader.entry)
    else
      return this._findPluginC(plugin, this.ctx.loader.entry)
  }

  constructor(ctx: Context, private config: TestService.Config) {
    super(ctx, 'test', true)

    const selfSendPrefixLength = config.selfSendPrefix?.length

    // ctx.plugin(Foo)
    console.log('Test plugin initializing.')

    ctx.middleware(async (session, next) => {
      if (session.content.trim() === 'help') return
      return next()
    }, true)

    // Handle self message
    ctx.guild().on('message', (session) => {
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

    const forwardToMe = (session: Session, content: Element.Fragment) => {
      for (const { platform, channelId } of config.forwardTargets) {
        if (session.platform == platform && session.channelId === channelId) continue
        this.ctx.sendMessage({ platform, channelId }, content)
      }
    }

    // Handle tome message
    ctx.private().middleware((session, next) => {
      if (session.userId == session.selfId) return next()
      return next((next) => {
        forwardToMe(session, h('', `From ${session.author.username}(${session.author.userId})\n`, ...session.elements))
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
        forwardToMe(session, h('',
          `From ${session.author.nickname}(${session.author.userId}) from ${session.channelName || session.guildName}(${session.channelId || session.guildId}):`,
          ...session.elements))
      })
      else return next()
    })

    if (config.infoAllSessions === 'middleware') {
      ctx.middleware((session, next) => {
        if (config.testMode === 'all' || !session.userId)
          logger.info(session)
        return next()
      }, true)
    }

    if (config.infoAllSessions === 'message') {
      ctx.on('message', (session) => {
        if (config.testMode === 'all' || !session.userId)
          logger.info(session)
      }, true)
    }

    if (config.fixChannelName) {
      ctx.guild().middleware(async (session, next) => {
        const channel = await session.getChannel()
        // if (!channel.name) {
        //   console.log(session.channelName, session.guildName, session.username)

        // }
        // channel
        return next()

      }, true)
    }

    ctx.command('test.image')
      .option('url', '-u <url:string>', { fallback: 'https://koishi.chat/logo.png' })
      .option('mime', '-m <mime:string>', { fallback: 'image/png' })
      .action(async ({ session, options, args }) => {
        console.log(session.author.roles)
        return await ctx.http.axios(options.url, { method: 'GET', responseType: 'arraybuffer' }).then(resp => Buffer.from(resp.data, 'binary')).then(b => h.image(b, options.mime))
      })

    ctx.command('test.real <arg:number>', { checkUnknown: true, checkArgCount: true })
      .option('-w', 'www')
      .action(({ session, options, args }) => {
        return JSON.stringify({ options, args })
      })

    ctx.command('test.rel').userFields(['locales']).action(async (argv) => {
      console.log(argv.session.text('general.name'), argv.session.user.locales)
      return await argv.session.execute('test.real')
    })

    ctx.command('test.reload <plugin:string>').action(async (argv, name) => {
      const [key, parent, plugin] = this.findPlugin(name) ?? []
      if (!key) return 'Not found'
      ctx.loader.unloadPlugin(parent, key)
      await ctx.loader.reloadPlugin(parent, key, parent.config[key])
      return 'Success ' + key
    })

    ctx.command('test.logger <label:string> <level:number>').action(async (argv, label, level) => {
      new Logger(label).level = level
    })
  }
}

export namespace TestService {
  export interface ForwardTarget {
    platform: string
    channelId: string
  }

  export interface Config {
    forwardTargets?: ForwardTarget[],
    selfSendPrefix?: string
    infoAllSessions: 'off' | 'message' | 'middleware'
    testMode: 'all' | 'undefined-userid'
    fixChannelName: boolean
  }

  export let Config: Schema<Config> = Schema.object({
    forwardTargets: Schema.array(Schema.object({
      platform: Schema.string(),
      channelId: Schema.string(),
    })).role('table'),
    selfSendPrefix: Schema.string().default('//'),
    infoAllSessions: Schema.union(['off', 'message', 'middleware'] as const).default('off'),
    testMode: Schema.union(['all', 'undefined-userid'] as const).default('all'),
    fixChannelName: Schema.boolean().default(false),
  })
}

export default TestService
