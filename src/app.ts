import Graceful from '@ladjs/graceful'
import Bree from 'bree'
// @ts-ignore
import Cabin from 'cabin'
import { ConfigManager } from './config'
import { ModuleManager } from './modules'

const bree = new Bree({
  logger: new Cabin(),
  jobs: [],
  root: false, // join(__dirname, '../jobs'),
  async workerMessageHandler(message, workerMetadata) {
    if (message === 'terminate') {
      await bree.stop()
      console.log('Worker triggered terminate')
      process.exit()
    }
  },
  // removeCompleted: true,
})

// handle graceful reloads, pm2 support, and events like SIGHUP, SIGINT, etc.
const graceful = new Graceful({ brees: [bree] })
graceful.listen();

// start all jobs (this is the equivalent of reloading a crontab):
(async () => {
  const cm = new ConfigManager()
  const config = await cm.getConfig()
  const modman = new ModuleManager(config, bree)
  for(const mod of config.mods) {
    await modman.enableMod(mod)
  }
  await modman.writeMods()
  for(const [module, enabled] of Object.entries(config.modules)) {
    if (enabled) {
      await modman.startModule(module)
    }
  }
  // await bree.start()
})()
