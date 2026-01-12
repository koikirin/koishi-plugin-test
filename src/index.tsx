import { } from '@hieuzest/koishi-plugin-send'
import { } from '@hieuzest/koishi-plugin-mahjong'
import { Computed, Context, Element, h, Loader, Logger, noop, Schema, Service, Session } from 'koishi'

declare module 'koishi' {
  interface Context {
    test: TestService
  }

  interface User {
    'test/migrate-onebot': number
  }
}

const logger = new Logger('test')

export class TestService extends Service {
  static inject = ['database', 'sendMessage']

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
    if (typeof plugin === 'string') {
      return this._findPlugin(plugin, this.ctx.loader.entry)
    } else {
      return this._findPluginC(plugin, this.ctx.loader.entry)
    }
  }

  constructor(ctx: Context, config: TestService.Config) {
    super(ctx, 'test', true)

    const selfSendPrefixLength = config.selfSendPrefix?.length

    ctx.logger.info('Test plugin initializing.')

    ctx.model.extend('user', {
      'test/migrate-onebot': 'unsigned',
    })

    ctx.command('ccb').action(({ session }) => {
      return `> ${session.resolve(config.testBool)}`
    })

    ctx.inject(['mahjong', 'mahjong.majsoul'], (ctx) => {
      ctx.logger.info('Test plugin initializing mahjong commands.')
      ctx.platform('lark').command('zhulu')
        .option('cid', '-c <cid:string>', { fallback: 23369782 })
        .option('teamMaxGame', '-T <teamMaxGame:number>', { fallback: 100 })
        .option('teamMinGame', '-t <teamMinGame:number>', { fallback: 8 })
        .option('playerMaxGame', '-P <playerMaxGame:number>', { fallback: 6 })
        .option('playerMinGame', '-i <playerMinGame:number>', { fallback: 1 })
        .action(async ({ session, options }) => {
          const teamRank: {
            team_id: number
            name: string
            data: {
              total_point: number
              total_game_count: number
              member_count: number
            }
            rank: number
            err?: string[]
          }[] = await ctx.mahjong.majsoul.execute('fetchContestTeamRank', { unique_id: options.cid }).then(x => x.rank)
          const playerRank: {
            account_id: number
            nickname: string
            data: {
              total_game_count: number
            }
            team_name: string
          }[] = await ctx.mahjong.majsoul.execute('fetchContestTeamPlayerRank', { unique_id: options.cid }).then(x => x.rank)
          if (!teamRank || !playerRank) return 'No rank data.'
          teamRank.forEach(team => {
            team.err = []
            if (team.data.total_game_count < options.teamMinGame) team.err.push(`总局数不足 ${options.teamMinGame} 局`)
            if (team.data.total_game_count > options.teamMaxGame) team.err.push(`总局数超过 ${options.teamMaxGame} 局`)
            const members = playerRank.filter(p => p.team_name === team.name)
            if (members.length < team.data.member_count) team.err.push(`参赛选手不足`)
            members.forEach(p => {
              if (p.data.total_game_count < options.playerMinGame) team.err.push(`选手 ${p.nickname} 总局数不足 ${options.playerMinGame} 局`)
              if (p.data.total_game_count > options.playerMaxGame) team.err.push(`选手 ${p.nickname} 总局数超过 ${options.playerMaxGame} 局`)
            })
          })
          const valids = teamRank.filter(team => team.err.length === 0)
          valids.sort((a, b) => a.rank - b.rank)
          const linesValid = valids.map((team, i) => `| ${i + 1} | ${team.name} | ${team.data.total_point} | ${team.data.total_game_count} | |`)
          const linesInvalid = teamRank.filter(team => team.err.length > 0)
            .map(team => `| - | ${team.name} | ${team.data.total_point} | ${team.data.total_game_count} | ${team.err.join('，')} |`)

          return <>
            <lark:card title="Zhulu scoreboard">
              <div>
                <br />|Rank|Team|Point|GameCount|ErrMsg|
                <br />|-|-|-|-|-|
                <br />{linesValid.concat(linesInvalid).join('\n')}
              </div>
            </lark:card>
          </>
        })
    })

    ctx.on('before-attach-user', (_, fields) => {
      fields.add('test/migrate-onebot')
    })

    ctx.middleware(async (session, next) => {
      if (session.platform === 'chronocat' && session.user && !session.user['test/migrate-onebot']) {
        const [account] = await ctx.database.get('binding', { platform: 'onebot', pid: session.userId })
        if (account) {
          await ctx.database.set('binding', { platform: 'chronocat', pid: session.userId }, { aid: account.aid })
          session.user['test/migrate-onebot'] = 1
        } else {
          session.user['test/migrate-onebot'] = 2
        }
        await session.user.$update()
      }
      return next()
    })

    ctx.before('command/execute', ({ session, command }) => {
      if (session.elements?.[0]?.type === 'at' && session.elements?.[0]?.attrs?.id !== session.selfId) return ''
      if (config.blockChannels.includes(session.cid)) return ''
      if (config.blockCommands.includes(command.name) && (session.user as any)?.authority < 4) return ''
    })

    // Handle self message
    ctx.guild().on('message', (session) => {
      if (config.sids.length && !config.sids.includes(session.sid)) return
      if (session.userId === session.bot.selfId && selfSendPrefixLength
        && session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        const newSession = session.bot.session(session.event)
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

    ctx.before('send', (session) => {
      if (config.blockChannels.includes(session.cid)) return true
      if (config.sids.length && !config.sids.includes(session.sid)) return
      if (selfSendPrefixLength && session.content.slice(0, selfSendPrefixLength) === config.selfSendPrefix) {
        const newSession = session.bot.session(session.event)
        newSession.userId = '@self'
        newSession.content = newSession.content.slice(selfSendPrefixLength)
        session.bot.dispatch(newSession)
      }
    })

    const forwardToMe = (session: Session, content: Element.Fragment) => {
      if (config.sids.length && !config.sids.includes(session.sid)) return
      for (const { platform, channelId } of config.forwardTargets) {
        if (session.platform === platform && session.channelId === channelId) continue
        this.ctx.sendMessage({ platform, channelId }, content).catch(e => logger.error(`Failed to forward message: ${content} but ${e}: ${e?.message}`))
      }
    }

    // Handle tome message
    ctx.private().middleware((session, next) => {
      if (session.userId === session.selfId || config.blockForwardUsers?.includes(session.uid)) return next()
      return next((next) => {
        forwardToMe(session, h('', `From ${session.username}(${session.userId})\n`, ...session.elements))
      })
    })

    ctx.guild().middleware((session, next) => {
      if (session.userId === session.selfId || config.blockForwardUsers?.includes(session.uid)) return next()
      let flag = false
      if (session.quote && session.quote.user?.id === session.selfId) flag = true
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
            `From ${session.username}(${session.userId}) `
            + `from ${session.event.channel?.name || session.event.guild?.name}(${session.channelId || session.guildId}):`,
            ...session.elements))
        })
      } else return next()
    })

    if (config.infoAllSessions === 'middleware') {
      ctx.middleware((session, next) => {
        if (config.infoPlatforms.length && !config.infoPlatforms.includes(session.platform)) return next()
        if (config.testMode === 'all' || !session.userId) { logger.info(session.toJSON()) }
        return next()
      }, true)
    }

    if (config.infoAllSessions === 'message') {
      ctx.on('message', (session) => {
        if (config.infoPlatforms.length && !config.infoPlatforms.includes(session.platform)) return
        if (config.testMode === 'all' || !session.userId) { logger.info(session.toJSON()) }
      }, true)
    }

    ctx.before('send', (session, options) => {
      if (options.session?.messageId) session.elements.unshift(h('passive', { messageId: options.session.messageId }))
    })

    ctx.command('test', { authority: 5 }).action(noop)

    ctx.command('test.image')
      .option('url', '-u <url:string>', { fallback: 'https://koishi.chat/logo.png' })
      .option('mime', '-m <mime:string>', { fallback: 'image/png' })
      .action(async ({ session, options, args }) => {
        return await ctx.http.axios(options.url, { method: 'GET', responseType: 'arraybuffer' })
          .then(resp => Buffer.from(resp.data, 'binary')).then(b => h.image(b, options.mime))
      })

    ctx.command('test.real <arg:number>', { checkUnknown: true, checkArgCount: true })
      .option('-w', 'www')
      .action(({ session, options, args }) => {
        return JSON.stringify({ options, args })
      })

    ctx.command('test.rel').userFields(['locales']).action(async (argv) => {
      console.log(argv.session.text('general.name'), argv.session.user.locales)
      return h.text('aaaa <Sss>')
    })

    ctx.command('test.reload <plugin:string>').action(async (argv, name) => {
      const [key,, ctx] = this.findPlugin(name) ?? []
      if (!key) return 'Not found'
      ctx.scope.update(ctx.scope.config, true)
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
    sids: string[]
    forwardTargets?: ForwardTarget[]
    blockForwardUsers?: string[]
    selfSendPrefix?: string
    infoAllSessions: 'off' | 'message' | 'middleware'
    infoPlatforms: string[]
    testMode: 'all' | 'undefined-userid'
    blockChannels: string[]
    whiteChannels: string[]
    blockCommands: string[]
    secondBot?: string
    testBool: Computed<boolean>
  }

  export const Config: Schema<Config> = Schema.object({
    sids: Schema.array(String).default([]),
    forwardTargets: Schema.array(Schema.object({
      platform: Schema.string(),
      channelId: Schema.string(),
    })).role('table'),
    blockForwardUsers: Schema.array(String).default([]).role('table'),
    selfSendPrefix: Schema.string().default('//'),
    infoAllSessions: Schema.union(['off', 'message', 'middleware'] as const).default('off'),
    infoPlatforms: Schema.array(String).default([]).role('table'),
    testMode: Schema.union(['all', 'undefined-userid'] as const).default('all'),
    blockChannels: Schema.array(String).default([]).role('table'),
    whiteChannels: Schema.array(String).default([]).role('table'),
    blockCommands: Schema.array(String).default([]).role('table'),
    secondBot: Schema.string(),
    testBool: Schema.computed(Schema.boolean().default(true)).default(true),
  })
}

export default TestService
