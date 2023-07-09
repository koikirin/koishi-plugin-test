import { Context, Service } from 'koishi'


declare module 'koishi' {
  interface Tables {
    'foo/test': Foo.TestFields
  }
}

export class Foo extends Service {

  constructor(ctx: Context) {
    super(ctx, 'foo', true)
    // ctx.using(['database'], async () => {
    //   ctx.model.drop('foo/test')
    console.log('Foo service initializing.')

    ctx.model.extend('foo/test', {
      id: 'unsigned',
      a: 'unsigned',
      b: 'boolean',
      c: 'boolean'
    }, { primary: ['id', 'a'] })
 
    //   await ctx.database.create('foo/test', { a: 1, b: true, c: true })
    //   await ctx.database.create('foo/test', { a: 1, b: false, c: true })
    //   await ctx.database.create('foo/test', { a: 1, b: false, c: false })
  
    //   let res = await ctx.database.get('foo/test', {
    //     b: false,
    //     c: true
    //   })
    //   console.log('Result', res)
    // })
    // console.log(ctx.database.tables.user.fields)

    ctx.command('foo.testdb <cnt:number>').action(async (argv, cnt) => {
      // console.log(argv)
      // config.testConfig = 'a'
      // TestService.Config = Schema.object({
      //   selfSendPrefix: Schema.string().default('//'),
      //   testConfig: Schema.union(['c', 'd'])
      // })
      console.log(typeof cnt, cnt)
      const records: Partial<Foo.TestFields>[] = []
      for (const i of [...Array(cnt).keys()]) records.push({
        id: 10000 + i,
        a: i,
        b: true,
        c: false
      })
      // console.log(records)
      await ctx.database.upsert('foo/test', records)
      return 'Hello!'
    })

  }
}

export namespace Foo {
  export interface TestFields {
    id: number
    a: number
    b: boolean
    c: boolean
  }
}


export default Foo
