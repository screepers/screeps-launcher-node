import jsYaml from 'js-yaml'
import { access, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export type StringMap = {
  [key: string]: string
}

export type EnvMap = StringMap

export interface ConfigEnv {
  [name: string]: EnvMap
  // shared: EnvMap
  // backend: EnvMap
  // engine: EnvMap
  // storage: EnvMap
}

export interface ConfigBackup {
  dirs: string[]
  files: string[]
}

export interface ConfigCli {
  username: string
  password: string
  host: string
  port: number
}

export interface Config {
  steamKey: string
  steamKeyFile: string
  cli: ConfigCli
  env: ConfigEnv
  processors: number
  runnerThreads: number
  version: string
  nodeVersion: string
  mods: string[]
  bots: StringMap
  extraPackages: StringMap
  localMods: string
  backup: ConfigBackup
  modules: {
    backend: boolean
    main: boolean
    processor: boolean
    runner: boolean
    storage: boolean
  }
}

export class ConfigManager {
  public readonly config: Config
  constructor() {
    const cores = os.cpus().length
    const runners = Math.max(1, cores - 1)
    this.config = {
      processors: cores,
      runnerThreads: runners,
      version: 'latest',
      nodeVersion: 'Erbium',
      steamKey: '',
      steamKeyFile: '',
      cli: {
        username: '',
        password: '',
        host: '127.0.0.1',
        port: 21026,
      },
      env: {
        shared: {
          MODFILE: 'mods.json',
          STORAGE_HOST: '127.0.0.1',
          STORAGE_PORT: '21027',
        },
        backend: {
          GAME_HOST: '0.0.0.0',
          GAME_PORT: '21025',
          CLI_HOST: '127.0.0.1',
          CLI_PORT: '21026',
          ASSET_DIR: 'assets',
        },
        engine: {
          // DRIVER_MODULE: path.resolve(__dirname, '../driver'),
          DRIVER_MODULE: '@screeps/driver'
        },
        storage: {
          DB_PATH: 'db.json',
        },
      },
      localMods: 'mods',
      mods: [],
      bots: {},
      extraPackages: {},
      backup: {
        dirs: [],
        files: [],
      },
      modules: {
        backend: true,
        main: true,
        processor: true,
        runner: true,
        storage: true,
      },
    }
  }
  async getConfig(dir: string = ''): Promise<Config> {
    const files = ['config.yml', 'config.yaml']
    for (const file of files) {
      const filePath = dir ? path.join(dir, file) : file
      try {
        const data = await readFile(filePath, 'utf8')
        const conf = jsYaml.load(data) as Partial<Config>
        Object.assign(this.config, conf)
        console.log(`Loaded config from ${filePath}`)
      } catch(e) {
        // Ignore, not handling missing files.
      }
    }
    await this.syncConfig()
    return this.config
  }

  async syncConfig() {
    const c = this.config
    c.env.shared["MODFILE"] = "mods.json"
    c.env.backend = Object.assign(c.env.backend, c.env.shared, c.env.backend)
    c.env.engine = Object.assign(c.env.engine, c.env.shared, c.env.engine)
    c.env.storage = Object.assign(c.env.storage, c.env.shared, c.env.storage)
    if (c.runnerThreads > 0) {
      c.env.engine['RUNNER_THREADS'] = c.runnerThreads.toString()
    }
    const isSuccess = (p: Promise<any>): Promise<boolean> => p.then(() => true).catch(() => false)
    if (await isSuccess(access('STEAM_KEY'))) {
      c.steamKeyFile = 'STEAM_KEY'
    }
    if (c.steamKeyFile) {
      c.steamKey = await readFile(c.steamKeyFile, 'utf8')
    }
    if (c.steamKey) {
      c.env.backend['STEAM_KEY'] = c.steamKey
    }
    if (!c.backup.dirs) {
      c.backup.dirs = []
    }
    if (!c.backup.files) {
      c.backup.files = []
    }
    return c
  }
}