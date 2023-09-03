import { } from '@hieuzest/koishi-plugin-send'
import { } from '@koishijs/plugin-market'
import { Argv, Context, Element, h, Loader, Logger, noop, Schema, Service, Session } from 'koishi'
import { } from '@hieuzest/koishi-plugin-adapter-red'
import { } from '@hieuzest/koishi-plugin-permissions'
// import { resolve } from 'path'

declare module 'koishi' {
  interface Context {
    test: TestService
    // foo: Foo
  }

  interface Tables {
    'test/f': TestF
  }
}

interface TestF {
  name: string
  b: boolean
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
    if (typeof plugin === 'string') { return this._findPlugin(plugin, this.ctx.loader.entry) } else { return this._findPluginC(plugin, this.ctx.loader.entry) }
  }

  constructor(ctx: Context, private config: TestService.Config) {
    super(ctx, 'test', true)

    const selfSendPrefixLength = config.selfSendPrefix?.length

    // ctx.plugin(Foo)
    console.log('Test plugin initializing.')
    ctx.model.extend('test/f', {
      name: 'string',
      b: 'boolean',
    }, {
      // autoInc: true,
      primary: ['name'],
    })

    // ctx.database.create('test/f', { name: '1', b: true })
    // ctx.database.create('test/f', { name: '2', b: false })

    // ctx.before('send', async (session, options) => {
    //   console.log(session.content)
    //   return true
    // })

    ctx.on('guild-member-added', session => {
      console.log(session)
    })

    ctx.guild().middleware((session, next) => {
      console.log(session.elements)
      return next()
    })

    ctx.command('hrecall <msgId:string>').action(({ session }, msgId) => {
      session.red.recall([msgId], 2, session.channelId)
    })

    ctx.guild().middleware(async (session, next) => {
      // if (!session.red.roleType) {
      logger.info('[test role] %s:%s %s', session.channelId, session.userId, session.red?.roleType, session.author)
      // }
      return next()
    }, true)

    ctx.middleware(async (session, next) => {
      if (session.content.trim().toLowerCase() === 'help') return
      return next()
    }, true)

    // Handle self message
    ctx.guild().on('message', (session) => {
      if (session.userId === session.bot.selfId && selfSendPrefixLength
        && session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        const newSession = session.bot.session(session)
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

    ctx.before('send', (session) => {
      if (selfSendPrefixLength && session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        const newSession = session.bot.session(session)
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

    const forwardToMe = (session: Session, content: Element.Fragment) => {
      for (const { platform, channelId } of config.forwardTargets) {
        if (session.platform === platform && session.channelId === channelId) continue
        this.ctx.sendMessage({ platform, channelId }, content)
      }
    }

    // Handle tome message
    ctx.private().middleware((session, next) => {
      if (session.userId === session.selfId) return next()
      return next((next) => {
        forwardToMe(session, h('', `From ${session.author.username}(${session.author.userId})\n`, ...session.elements))
      })
    })

    ctx.guild().middleware((session, next) => {
      let flag = false
      if (session.quote && session.quote.userId === session.selfId) flag = true
      else {
        for (const ele of session.elements) {
          if (ele.type === 'at' && ele.attrs.id === session.selfId) {
            flag = true
            break
          }
        }
      }
      if (flag) {
        return next((next) => {
          forwardToMe(session, h('',
            `From ${session.author.nickname}(${session.author.userId}) `
            + `from ${session.channelName || session.guildName}(${session.channelId || session.guildId}):`,
            ...session.elements))
        })
      } else return next()
    })

    if (config.infoAllSessions === 'middleware') {
      ctx.middleware((session, next) => {
        if (config.testMode === 'all' || !session.userId) { logger.info(session) }
        return next()
      }, true)
    }

    if (config.infoAllSessions === 'message') {
      ctx.on('message', (session) => {
        if (config.testMode === 'all' || !session.userId) { logger.info(session) }
      }, true)
    }

    if (config.fixChannelName) {
      ctx.guild().middleware(async (session, next) => {
        // const channel = await session.getChannel()
        // if (!channel.name) {
        //   console.log(session.channelName, session.guildName, session.username)

        // }
        // channel
        return next()
      }, true)
    }

    ctx.permissions.inherit('custom.test.admin', 'custom.test.operator')

    ctx.command('test', { permissions: [] }).action(noop)

    ctx.command('test.image', { permissions: ['custom.test.operator'] })
      .option('url', '-u <url:string>', { fallback: 'https://koishi.chat/logo.png' })
      .option('mime', '-m <mime:string>', { fallback: 'image/png' })
      .action(async ({ session, options, args }) => {
        console.log(session.author.roles)
        return await ctx.http.axios(options.url, { method: 'GET', responseType: 'arraybuffer' })
          .then(resp => Buffer.from(resp.data, 'binary')).then(b => h.image(b, options.mime))
      })

    ctx.command('test.real <arg:number>', { checkUnknown: true, checkArgCount: true, permissions: ['custom.test.operator'] })
      .option('-w', 'www')
      .action(({ session, options, args }) => {
        return JSON.stringify({ options, args })
      })

    ctx.command('test.rel', { permissions: ['custom.test.operator'] }).userFields(['locales']).action(async (argv) => {
      console.log(argv.session.text('general.name'), argv.session.user.locales)
      return await argv.session.execute('test.real')
    })

    ctx.command('test.reload <plugin:string>', { permissions: ['custom.test.admin'] }).action(async (argv, name) => {
      const [key, parent] = this.findPlugin(name) ?? []
      if (!key) return 'Not found'
      ctx.loader.unloadPlugin(parent, key)
      await ctx.loader.reloadPlugin(parent, key, parent.config[key])
      return 'Success ' + key
    })

    ctx.command('test.cmd <cmd:text>')
      .action(async ({ session }, cmd) => {
        const argv = Argv.parse(cmd)
        session.resolveCommand(argv)
        const { command, options } = argv
        if (!command) return 'Command not found'
        const permissions = [`command.${command.name}`]
        for (const option of Object.values(command._options)) {
          if (option.name in options) {
            permissions.push(`command.${command.name}.option.${option.name}`)
          }
        }
        return (await ctx.permissions.test(permissions, session as any)) ? 'Success' : 'Fail'
      })

    ctx.command('testt.foo', { authority: null }).action(_ => 'a')
    ctx.command('testt.bar')
    console.log(ctx.$commander.get('testt').config)
    console.log(ctx.$commander.get('testt.foo').config)
    console.log(ctx.$commander.get('testt.bar').config)

    ctx.command('test.logger <label:string> <level:number>').action(async (argv, label, level) => {
      new Logger(label).level = level
    })

    // ctx.on('internal/service', (name, oldValue) => {
    //   console.log('internal/service', name, !oldValue ? 'enable' : 'disable')
    // })
  }
}

export namespace TestService {
  export interface ForwardTarget {
    platform: string
    channelId: string
  }

  export interface Config {
    forwardTargets?: ForwardTarget[]
    selfSendPrefix?: string
    infoAllSessions: 'off' | 'message' | 'middleware'
    testMode: 'all' | 'undefined-userid'
    fixChannelName: boolean
  }

  export const Config: Schema<Config> = Schema.object({
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
