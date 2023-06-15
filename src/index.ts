import { Context, Service } from 'koishi'
import { Foo } from './foo'


declare module 'koishi' {
  interface Context {
    test: TestSerice
  }
}

export class TestSerice extends Service {
  a: string

  constructor(ctx: Context) {
    super(ctx, 'test', true)
    ctx.plugin(Foo)

    ctx.command('test').subcommand('.hello').action(({session, args, options}) => {
      return JSON.stringify({options, args})
    })
  }
}

export default TestSerice