import { Context, Service } from 'koishi'


declare module 'koishi' {
  interface Tables {
    'foo/test': Foo.TestFields
  }
}

export class Foo extends Service {
  static using = ['database']
  constructor(ctx: Context) {
    super(ctx, 'foo', true)

    console.log('Foo service initializing.')

    ctx.model.extend('foo/test', {
      id: 'unsigned',
      a: 'string',
      b: 'string',
      c: 'string',
    }, {autoInc: true})
 
    // ctx.on('ready', async () => {
    //   // await ctx.database.drop('foo/test')
    //   // await ctx.database.create('foo/test', { a: 'foo', b: 'bar' })
    //   // await ctx.database.upsert('foo/test', [{ a: 'foo', b: 'bar',  c: 'foobar' }], ['a', 'b'])
    //   const records = await ctx.database.get('foo/test', {a:'foo', b: ''})
    //   console.log(records.length)
    //   await ctx.database.upsert('foo/test', [{ a: 'foo', b: '', c: 'foobar' }], ['a', 'b'])
    //   // await ctx.database.upsert('foo/test', [{ a: 'foo',  c: 'foobar' }], ['a', 'b'])
    // })

  }
}

export namespace Foo {
  export interface TestFields {
    id: number
    a: string
    b: string
    c: string
  }
}


export default Foo
