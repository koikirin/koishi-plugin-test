import { Context } from 'cordis'

const ctx = new Context()
let counter = 0
ctx.on('foo', () => counter++)

ctx.on('ready', async () => {
  const start = performance.now()

  for (let i = 0; i < 10000; i++) {
    await ctx.parallel('foo')
  }
  console.log(counter)
  console.log('event', performance.now() - start)
})

await ctx.start()
