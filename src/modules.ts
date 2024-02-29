import Bree from "bree"
import { createWriteStream } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { Config } from "./config"

const moduleCode = `process.on('unhandledRejection', err => console.error(err));require(process.argv[2])`

interface BotMap {
  [key: string]: string
}

interface BotFile {
  mods: string[]
  bots: BotMap
}

const moduleMap = {
  backend: {
    envKey: 'backend',
    module: '@screeps/backend/bin/start',
  },
  main: {
    envKey: 'engine',
    module: '@screeps/engine/dist/main',
  },
  processor: {
    envKey: 'engine',
    module: '@screeps/engine/dist/processor',
  },
  runner: {
    envKey: 'engine',
    module: '@screeps/engine/dist/runner',
  },
  storage: {
    envKey: 'storage',
    module: '@screeps/storage/bin/start',
  },
} as {
  [name: string]: {
    envKey: string
    module: string
  }
}

export class ModuleManager {
  public config: Config
  private bree: Bree
  private jobs: { [module: string]: string[] } = {}
  constructor(config: Config, bree: Bree) {
    this.config = config
    this.bree = bree
    this.bree.on('worker deleted', worker => {
      const [mod] = worker.split('_')
      if(this.jobs[mod].includes(worker)) {
        setTimeout(() => {
          console.log(`Restarting ${worker}`)
          // bree.start(worker)
        }, 1000);
        
      }
    })
  }
  async startModule(name: string) {
    await this.stopModule(name)
    console.log(`Starting ${name}`)
    const ps = []
    const jobs = this.jobs[name] = this.jobs[name] || []
    const add = async (job: string) => {
      const mod = moduleMap[name]
      const env = Object.assign({}, this.config.env[mod.envKey] || {}, process.env)
      console.log(job, env)
      await this.bree.add({
        name: job,
        path: moduleCode, //`${__dirname}/jobs/${name}.js`,
        worker: {
          argv: [require.resolve(mod.module)],
          eval: true,
          env,
          // stdout: true,
          // stderr: true,
        },
      })
      await this.bree.start(job)
      const worker = await this.bree.workers.get(job)
      await mkdir('logs', {recursive:true})
      const log = createWriteStream(`logs/${job}.log`, { flags: 'a' })
      worker?.stdout.on('data', data => {
        console.log(job, data)
        log.write(data, () => {})
      })
      worker?.stderr.on('data', data => {
        console.log(job, data)
        log.write(data, () => {})
      })
      worker?.on('exit', () => log.close())
    }
    switch (name) {
      case 'processor':
        for (let i = 0; i < this.config.processors; i++) {
          const n = `processor_${i}`
          await add(n)
          jobs.push(n)
        }
        break
      default:
        await add(name)
        jobs.push(name)
        break
    }
    // await Promise.all(ps)
  }
  async stopModule(name: string) {
    const jobs = this.jobs[name] || []
    this.jobs[name] = []
    if (!jobs.length) return
    console.log(`Stopping ${name}`)
    await Promise.all(jobs.map(async j => {
      await this.bree.stop(j)
      await this.bree.remove(j)
    }))
  }
  enableMod(mod: string) {
    const mods = new Set(this.config.mods)
    mods.add(mod)
    this.config.mods = Array.from(mods)
  }
  
  disableMod(mod: string) {
    const mods = new Set(this.config.mods)
    mods.delete(mod)
    this.config.mods = Array.from(mods)
  }

  async writeMods() {
    const c = this.config
    const bots: BotMap = {}
    const mods = await Promise.all(c.mods.map(mod => this.getPackageMain(mod)))
    for (const [name, bot] of Object.entries(c.bots)) {
      if (bot.startsWith('.')) {
        bots[name] = bot
      } else {
        const main = await this.getPackageMain(bot)
        bots[name] = dirname(main)
      }
    }
    if (c.localMods) {
      await mkdir(c.localMods, { recursive: true })
      const modDir = await readdir(c.localMods)
      mods.push(...modDir
        .filter(m => m.endsWith('.js'))
        .map(m => join(c.localMods, m))
      )
    }
    console.log(`Writing ${mods.length} mods and ${Object.keys(bots).length} bots to mods.json`)
    await writeFile('mods.json', JSON.stringify({ mods, bots, }, null, 2))
  }

  async getPackageMain(pkg: string): Promise<string> {
    const pack = JSON.parse(await readFile(join(__dirname, '..', 'node_modules', pkg, 'package.json'), 'utf8'))
    return join(__dirname, '..', 'node_modules', pkg, pack.main)
  }
}